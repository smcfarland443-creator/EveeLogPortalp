import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'driver']);

// User status enum
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'inactive']);

// Order status enum
export const orderStatusEnum = pgEnum('order_status', ['open', 'assigned', 'in_progress', 'completed', 'cancelled']);

// Auction status enum
export const auctionStatusEnum = pgEnum('auction_status', ['active', 'sold', 'cancelled']);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default('driver'),
  status: userStatusEnum("status").notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pickupLocation: varchar("pickup_location").notNull(),
  deliveryLocation: varchar("delivery_location").notNull(),
  vehicleBrand: varchar("vehicle_brand").notNull(),
  vehicleModel: varchar("vehicle_model").notNull(),
  vehicleYear: integer("vehicle_year"),
  pickupDate: timestamp("pickup_date").notNull(),
  deliveryDate: timestamp("delivery_date"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  distance: integer("distance"), // in km
  notes: text("notes"),
  status: orderStatusEnum("status").notNull().default('open'),
  assignedDriverId: varchar("assigned_driver_id").references(() => users.id),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Auctions table
export const auctions = pgTable("auctions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pickupLocation: varchar("pickup_location").notNull(),
  deliveryLocation: varchar("delivery_location").notNull(),
  vehicleBrand: varchar("vehicle_brand").notNull(),
  vehicleModel: varchar("vehicle_model").notNull(),
  vehicleYear: integer("vehicle_year"),
  pickupDate: timestamp("pickup_date").notNull(),
  deliveryDate: timestamp("delivery_date"),
  instantPrice: decimal("instant_price", { precision: 10, scale: 2 }).notNull(),
  distance: integer("distance"), // in km
  notes: text("notes"),
  status: auctionStatusEnum("status").notNull().default('active'),
  purchasedById: varchar("purchased_by_id").references(() => users.id),
  purchasedAt: timestamp("purchased_at"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdOrders: many(orders, { relationName: "createdOrders" }),
  assignedOrders: many(orders, { relationName: "assignedOrders" }),
  createdAuctions: many(auctions, { relationName: "createdAuctions" }),
  purchasedAuctions: many(auctions, { relationName: "purchasedAuctions" }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  assignedDriver: one(users, {
    fields: [orders.assignedDriverId],
    references: [users.id],
    relationName: "assignedOrders",
  }),
  createdBy: one(users, {
    fields: [orders.createdById],
    references: [users.id],
    relationName: "createdOrders",
  }),
}));

export const auctionsRelations = relations(auctions, ({ one }) => ({
  purchasedBy: one(users, {
    fields: [auctions.purchasedById],
    references: [users.id],
    relationName: "purchasedAuctions",
  }),
  createdBy: one(users, {
    fields: [auctions.createdById],
    references: [users.id],
    relationName: "createdAuctions",
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuctionSchema = createInsertSchema(auctions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  purchasedById: true,
  purchasedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = z.infer<typeof insertAuctionSchema>;
