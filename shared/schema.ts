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
  boolean,
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
export const userRoleEnum = pgEnum('user_role', ['admin', 'driver', 'disponent']);

// User status enum
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'inactive']);

// Order status enum
export const orderStatusEnum = pgEnum('order_status', ['open', 'assigned', 'in_progress', 'delivered', 'completed', 'cancelled']);

// Auction status enum
export const auctionStatusEnum = pgEnum('auction_status', ['active', 'sold', 'cancelled']);

// Billing status enum
export const billingStatusEnum = pgEnum('billing_status', ['pending', 'approved', 'rejected', 'paid', 'cancelled']);

// Billing type enum
export const billingTypeEnum = pgEnum('billing_type', ['order_payment', 'cancellation_fee', 'credit', 'debit', 'completion_payment']);

// Approval status enum
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected']);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: varchar("password"), // For admin-created users (hashed)
  isLocalUser: varchar("is_local_user").default('false'), // 'true' for admin-created users, 'false' for Replit Auth
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
  pickupTimeFrom: varchar("pickup_time_from"), // e.g., "08:00"
  pickupTimeTo: varchar("pickup_time_to"), // e.g., "14:00"
  deliveryTimeFrom: varchar("delivery_time_from"),
  deliveryTimeTo: varchar("delivery_time_to"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  distance: integer("distance"), // in km
  notes: text("notes"),
  status: orderStatusEnum("status").notNull().default('open'),
  assignedDriverId: varchar("assigned_driver_id").references(() => users.id),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  fromAuction: varchar("from_auction").default('false'), // 'true' if purchased from auction
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
  pickupTimeFrom: varchar("pickup_time_from"), // mandatory for auctions
  pickupTimeTo: varchar("pickup_time_to"), // mandatory for auctions
  deliveryTimeFrom: varchar("delivery_time_from"), // mandatory for auctions
  deliveryTimeTo: varchar("delivery_time_to"), // mandatory for auctions
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

// Billing table for accounting system
export const billings = pgTable("billings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id), // Driver or admin
  orderId: varchar("order_id").references(() => orders.id), // Related order if applicable
  auctionId: varchar("auction_id").references(() => auctions.id), // Related auction if applicable
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }), // Original price before admin adjustment
  type: billingTypeEnum("type").notNull(), // order_payment, cancellation_fee, credit, debit, completion_payment
  status: billingStatusEnum("status").notNull().default('pending'),
  description: text("description").notNull(),
  adminNotes: text("admin_notes"), // Admin reason for rejection/adjustment
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdById: varchar("created_by_id").notNull().references(() => users.id), // Who created this billing entry
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vehicle handover protocol table
export const vehicleHandovers = pgTable("vehicle_handovers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  driverId: varchar("driver_id").notNull().references(() => users.id),
  handoverType: varchar("handover_type").notNull(), // 'pickup' or 'delivery'
  kmReading: integer("km_reading"),
  fuelLevel: varchar("fuel_level"), // e.g., "75%", "1/2", "Full"
  vehicleCondition: text("vehicle_condition"),
  damageNotes: text("damage_notes"),
  photos: text("photos").array(), // Array of photo URLs
  signature: text("signature"), // Base64 signature or URL
  location: varchar("location"),
  handoverDateTime: timestamp("handover_datetime").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order approval requests (for assignments and auction confirmations)
export const orderApprovals = pgTable("order_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  driverId: varchar("driver_id").notNull().references(() => users.id),
  requestType: varchar("request_type").notNull(), // 'assignment', 'auction_purchase', 'price_adjustment'
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }),
  adjustedAmount: decimal("adjusted_amount", { precision: 10, scale: 2 }),
  status: approvalStatusEnum("status").notNull().default('pending'),
  driverResponse: text("driver_response"),
  adminNotes: text("admin_notes"),
  expiresAt: timestamp("expires_at"), // Auto-expire after 24h
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for billing
export const billingsRelations = relations(billings, ({ one }) => ({
  user: one(users, {
    fields: [billings.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [billings.orderId],
    references: [orders.id],
  }),
  auction: one(auctions, {
    fields: [billings.auctionId],
    references: [auctions.id],
  }),
  createdBy: one(users, {
    fields: [billings.createdById],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [billings.approvedBy],
    references: [users.id],
  }),
}));

// Relations for vehicle handovers
export const vehicleHandoversRelations = relations(vehicleHandovers, ({ one }) => ({
  order: one(orders, {
    fields: [vehicleHandovers.orderId],
    references: [orders.id],
  }),
  driver: one(users, {
    fields: [vehicleHandovers.driverId],
    references: [users.id],
  }),
}));

// Relations for order approvals
export const orderApprovalsRelations = relations(orderApprovals, ({ one }) => ({
  order: one(orders, {
    fields: [orderApprovals.orderId],
    references: [orders.id],
  }),
  driver: one(users, {
    fields: [orderApprovals.driverId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  password: true,
  isLocalUser: true,
});

export const createLocalUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isLocalUser: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  pickupDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
  deliveryDate: z.union([z.string(), z.date(), z.undefined()]).transform((val) => 
    val && typeof val === 'string' ? new Date(val) : val
  ).optional(),
});

export const insertAuctionSchema = createInsertSchema(auctions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  purchasedById: true,
  purchasedAt: true,
}).extend({
  pickupDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
  deliveryDate: z.union([z.string(), z.date(), z.undefined()]).transform((val) => 
    val && typeof val === 'string' ? new Date(val) : val
  ).optional(),
  pickupTimeFrom: z.string().min(1, "Abholzeit von ist erforderlich"),
  pickupTimeTo: z.string().min(1, "Abholzeit bis ist erforderlich"),
  deliveryTimeFrom: z.string().min(1, "Zustellzeit von ist erforderlich"),
  deliveryTimeTo: z.string().min(1, "Zustellzeit bis ist erforderlich"),
});

export const insertBillingSchema = createInsertSchema(billings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedBy: true,
  approvedAt: true,
});

export const insertVehicleHandoverSchema = createInsertSchema(vehicleHandovers).omit({
  id: true,
  createdAt: true,
});

export const insertOrderApprovalSchema = createInsertSchema(orderApprovals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  respondedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = z.infer<typeof insertAuctionSchema>;
export type Billing = typeof billings.$inferSelect;
export type InsertBilling = z.infer<typeof insertBillingSchema>;
export type VehicleHandover = typeof vehicleHandovers.$inferSelect;
export type InsertVehicleHandover = z.infer<typeof insertVehicleHandoverSchema>;
export type OrderApproval = typeof orderApprovals.$inferSelect;
export type InsertOrderApproval = z.infer<typeof insertOrderApprovalSchema>;
