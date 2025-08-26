import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Set NODE_ENV to production if not specified (important for deployment)
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'production';
      console.log('NODE_ENV not set, defaulting to production');
    }

    console.log(`Starting application in ${process.env.NODE_ENV} mode`);

    // Check for required environment variables
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
      console.log('Note: REPLIT_DOMAINS is optional - if not provided, only local authentication will be available');
    }

    // Log environment variable status
    console.log('Environment variables status:');
    console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}`);
    console.log(`- SESSION_SECRET: ${process.env.SESSION_SECRET ? 'Set' : 'Missing'}`);
    console.log(`- REPLIT_DOMAINS: ${process.env.REPLIT_DOMAINS ? 'Set' : 'Not set (OAuth disabled)'}`);
    console.log(`- REPL_ID: ${process.env.REPL_ID ? 'Set' : 'Not set'}`);
    console.log(`- ISSUER_URL: ${process.env.ISSUER_URL || 'Using default'}`);

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log error details in production for debugging
      console.error('Application error:', {
        status,
        message,
        stack: err.stack,
        url: _req.url,
        method: _req.method,
      });

      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port} in ${process.env.NODE_ENV} mode`);
      console.log('Server startup completed successfully');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
    });
    process.exit(1);
  }
})();
