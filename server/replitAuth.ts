import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import { Strategy as LocalStrategy } from "passport-local";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";

// Check if REPLIT_DOMAINS is provided, use fallback if not
const replitDomains = process.env.REPLIT_DOMAINS;
if (!replitDomains) {
  console.warn("REPLIT_DOMAINS environment variable not provided. Replit OAuth will be disabled.");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy für admin-erstellte Benutzer
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        // Find user by email where isLocalUser is true
        const users = await storage.getUsersByRole('driver');
        const adminUsers = await storage.getUsersByRole('admin');
        const allUsers = [...users, ...adminUsers];
        
        const user = allUsers.find(u => u.email === email && u.isLocalUser === 'true');
        
        if (!user) {
          return done(null, false, { message: 'Ungültige E-Mail oder Passwort' });
        }

        if (user.status !== 'active') {
          return done(null, false, { message: 'Account ist nicht aktiv' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password!);
        if (!isValidPassword) {
          return done(null, false, { message: 'Ungültige E-Mail oder Passwort' });
        }

        // Create session object similar to Replit Auth
        const sessionUser = {
          claims: {
            sub: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            profile_image_url: user.profileImageUrl,
          },
          isLocalUser: true,
          expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
        };

        return done(null, sessionUser);
      } catch (error) {
        return done(error);
      }
    }
  ));

  // Only setup Replit OAuth if REPLIT_DOMAINS is available
  if (replitDomains) {
    try {
      const config = await getOidcConfig();

      const verify: VerifyFunction = async (
        tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
        verified: passport.AuthenticateCallback
      ) => {
        const user = {};
        updateUserSession(user, tokens);
        await upsertUser(tokens.claims());
        verified(null, user);
      };

      for (const domain of replitDomains.split(",")) {
        const strategy = new Strategy(
          {
            name: `replitauth:${domain}`,
            config,
            scope: "openid email profile offline_access",
            callbackURL: `https://${domain}/api/callback`,
          },
          verify,
        );
        passport.use(strategy);
      }
      console.log(`Replit OAuth configured for domains: ${replitDomains}`);
    } catch (error) {
      console.error("Failed to setup Replit OAuth:", error);
      console.log("Continuing with local authentication only");
    }
  } else {
    console.log("Replit OAuth disabled - local authentication only");
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Check if Replit OAuth is available for this hostname
    if (!replitDomains || !replitDomains.includes(req.hostname)) {
      return res.status(404).json({ 
        message: "Replit OAuth not available. Please use local login at /api/auth/login" 
      });
    }
    
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Check if Replit OAuth is available for this hostname
    if (!replitDomains || !replitDomains.includes(req.hostname)) {
      return res.status(404).json({ 
        message: "Replit OAuth callback not available" 
      });
    }
    
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(async () => {
      // Check if user was logged in via local auth or if Replit OAuth is not available
      if ((req.user as any)?.isLocalUser || !replitDomains) {
        res.redirect("/");
      } else {
        try {
          // Only attempt Replit logout if OAuth was configured
          if (replitDomains && replitDomains.includes(req.hostname)) {
            const config = await getOidcConfig();
            res.redirect(
              client.buildEndSessionUrl(config, {
                client_id: process.env.REPL_ID!,
                post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
              }).href
            );
          } else {
            res.redirect("/");
          }
        } catch (error) {
          console.error("Error during logout:", error);
          res.redirect("/");
        }
      }
    });
  });

  // Local login route
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Interner Serverfehler" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login fehlgeschlagen" });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Interner Serverfehler" });
        }
        return res.json({ message: "Login erfolgreich", user: { id: user.claims.sub, email: user.claims.email } });
      });
    })(req, res, next);
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  // If it's a local user, check if session is still valid
  if (user.isLocalUser) {
    // Local users don't have refresh tokens, so we just check expiry
    if (now > user.expires_at) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    return next();
  }

  // For Replit Auth users, try to refresh token
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
