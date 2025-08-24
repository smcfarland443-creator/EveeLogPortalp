import {
  users,
  orders,
  auctions,
  type User,
  type UpsertUser,
  type Order,
  type InsertOrder,
  type Auction,
  type InsertAuction,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Additional user operations
  getUsersByStatus(status: 'pending' | 'active' | 'inactive'): Promise<User[]>;
  updateUserStatus(id: string, status: 'pending' | 'active' | 'inactive'): Promise<User | undefined>;
  getUsersByRole(role: 'admin' | 'driver'): Promise<User[]>;
  
  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, orderData: Partial<InsertOrder>): Promise<Order | undefined>;
  getOrders(): Promise<Order[]>;
  getOrdersByDriver(driverId: string): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | undefined>;
  updateOrderStatus(id: string, status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'): Promise<Order | undefined>;
  assignOrderToDriver(orderId: string, driverId: string): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  acceptOrder(orderId: string, driverId: string): Promise<Order | undefined>;
  rejectOrder(orderId: string, driverId: string): Promise<Order | undefined>;
  
  // Auction operations
  createAuction(auction: InsertAuction): Promise<Auction>;
  getActiveAuctions(): Promise<Auction[]>;
  getAuctionById(id: string): Promise<Auction | undefined>;
  purchaseAuction(auctionId: string, buyerId: string): Promise<Auction | undefined>;
  updateAuctionStatus(id: string, status: 'active' | 'sold' | 'cancelled'): Promise<Auction | undefined>;
  deleteAuction(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Additional user operations
  async getUsersByStatus(status: 'pending' | 'active' | 'inactive'): Promise<User[]> {
    return await db.select().from(users).where(eq(users.status, status));
  }

  async updateUserStatus(id: string, status: 'pending' | 'active' | 'inactive'): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUsersByRole(role: 'admin' | 'driver'): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role)).orderBy(desc(users.createdAt));
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrder(id: string, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ ...orderData, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrdersByDriver(driverId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.assignedDriverId, driverId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async updateOrderStatus(id: string, status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async assignOrderToDriver(orderId: string, driverId: string): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ assignedDriverId: driverId, status: 'assigned', updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return order;
  }

  async deleteOrder(id: string): Promise<boolean> {
    const result = await db.delete(orders).where(eq(orders.id, id));
    return result.rowCount > 0;
  }

  async acceptOrder(orderId: string, driverId: string): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.assignedDriverId, driverId)))
      .returning();
    return order;
  }

  async rejectOrder(orderId: string, driverId: string): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ assignedDriverId: null, status: 'open', updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.assignedDriverId, driverId)))
      .returning();
    return order;
  }

  // Auction operations
  async createAuction(auction: InsertAuction): Promise<Auction> {
    const [newAuction] = await db.insert(auctions).values(auction).returning();
    return newAuction;
  }

  async getActiveAuctions(): Promise<Auction[]> {
    return await db
      .select()
      .from(auctions)
      .where(eq(auctions.status, 'active'))
      .orderBy(desc(auctions.createdAt));
  }

  async getAuctionById(id: string): Promise<Auction | undefined> {
    const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
    return auction;
  }

  async purchaseAuction(auctionId: string, buyerId: string): Promise<Auction | undefined> {
    const [auction] = await db
      .update(auctions)
      .set({ 
        status: 'sold', 
        purchasedById: buyerId, 
        purchasedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(and(eq(auctions.id, auctionId), eq(auctions.status, 'active')))
      .returning();
    return auction;
  }

  async updateAuctionStatus(id: string, status: 'active' | 'sold' | 'cancelled'): Promise<Auction | undefined> {
    const [auction] = await db
      .update(auctions)
      .set({ status, updatedAt: new Date() })
      .where(eq(auctions.id, id))
      .returning();
    return auction;
  }

  async deleteAuction(id: string): Promise<boolean> {
    const result = await db.delete(auctions).where(eq(auctions.id, id));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
