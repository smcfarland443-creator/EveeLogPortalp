import {
  users,
  orders,
  auctions,
  billings,
  vehicleHandovers,
  type User,
  type UpsertUser,
  type Order,
  type InsertOrder,
  type Auction,
  type InsertAuction,
  type Billing,
  type InsertBilling,
  type VehicleHandover,
  type InsertVehicleHandover,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Additional user operations
  getUsersByStatus(status: 'pending' | 'active' | 'inactive'): Promise<User[]>;
  updateUserStatus(id: string, status: 'pending' | 'active' | 'inactive'): Promise<User | undefined>;
  getUsersByRole(role: 'admin' | 'driver' | 'disponent'): Promise<User[]>;
  createLocalUser(userData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: 'admin' | 'driver' | 'disponent';
    status: 'pending' | 'active' | 'inactive';
  }): Promise<User>;
  deleteUser(id: string): Promise<void>;
  updateUser(id: string, userData: {
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    role?: 'admin' | 'driver' | 'disponent';
    status?: 'pending' | 'active' | 'inactive';
  }): Promise<User | undefined>;
  
  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, orderData: Partial<InsertOrder>): Promise<Order | undefined>;
  getOrders(): Promise<Order[]>;
  getOrdersByDriver(driverId: string): Promise<Order[]>;
  getOrdersByCreator(creatorId: string): Promise<Order[]>;
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
  purchaseAuction(auctionId: string, buyerId: string): Promise<{ auction: Auction; order: Order } | undefined>;
  updateAuctionStatus(id: string, status: 'active' | 'sold' | 'cancelled'): Promise<Auction | undefined>;
  deleteAuction(id: string): Promise<boolean>;
  
  // Billing operations
  createBilling(billing: { userId: string; orderId?: string; auctionId?: string; amount: string; type: 'order_payment' | 'cancellation_fee' | 'credit' | 'debit'; description: string; createdById: string }): Promise<any>;
  getBillingsByUser(userId: string): Promise<any[]>;
  getAllBillings(): Promise<any[]>;
  
  // Vehicle handover operations
  createVehicleHandover(handover: InsertVehicleHandover): Promise<VehicleHandover>;
  getHandoversByOrder(orderId: string): Promise<VehicleHandover[]>;
  getHandoversByDriver(driverId: string): Promise<VehicleHandover[]>;
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

  async getUsersByRole(role: 'admin' | 'driver' | 'disponent'): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role)).orderBy(desc(users.createdAt));
  }

  async createLocalUser(userData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: 'admin' | 'driver' | 'disponent';
    status: 'pending' | 'active' | 'inactive';
  }): Promise<User> {
    // Hash the password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Generate a unique ID
    const uuid = crypto.randomUUID();
    
    const [user] = await db
      .insert(users)
      .values({
        id: uuid,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: hashedPassword,
        isLocalUser: 'true',
        role: userData.role,
        status: userData.status,
      })
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const result = await db.delete(users).where(eq(users.id, id));
    if ((result.rowCount || 0) === 0) {
      throw new Error('User not found');
    }
  }

  async updateUser(id: string, userData: {
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    role?: 'admin' | 'driver' | 'disponent';
    status?: 'pending' | 'active' | 'inactive';
  }): Promise<User | undefined> {
    const updateData: any = { ...userData, updatedAt: new Date() };
    
    // Hash password if provided
    if (userData.password) {
      updateData.password = await bcrypt.hash(userData.password, 10);
    }
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
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

  async getOrdersByCreator(creatorId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.createdById, creatorId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async updateOrderStatus(id: string, status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled', driverId?: string): Promise<Order | undefined> {
    return await db.transaction(async (tx) => {
      // Get the order first to check if it's from auction
      const [order] = await tx.select().from(orders).where(eq(orders.id, id));
      if (!order) return undefined;

      // Update order status
      const [updatedOrder] = await tx
        .update(orders)
        .set({ status, updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning();

      // If cancelling an order from auction, charge 10% cancellation fee
      if (status === 'cancelled' && order.fromAuction === 'true' && driverId) {
        const cancellationFeeAmount = (parseFloat(order.price) * 0.1).toFixed(2);
        await tx
          .insert(billings)
          .values({
            userId: driverId,
            orderId: order.id,
            amount: cancellationFeeAmount,
            type: 'cancellation_fee',
            description: `Storno-Gebühr für Auktionskauf: ${order.vehicleBrand} ${order.vehicleModel} (10% von €${order.price})`,
            createdById: order.createdById,
          });
      }

      return updatedOrder;
    });
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
    return (result.rowCount || 0) > 0;
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

  async purchaseAuction(auctionId: string, buyerId: string): Promise<{ auction: Auction; order: Order } | undefined> {
    return await db.transaction(async (tx) => {
      // Get and lock auction, verify status
      const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId));
      if (!auction || auction.status !== 'active') {
        return undefined; // Auction not found or not available
      }

      // Update auction status with active guard (prevents race conditions)
      const updatedAuctions = await tx
        .update(auctions)
        .set({ 
          status: 'sold',
          purchasedById: buyerId,
          purchasedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq(auctions.id, auctionId), eq(auctions.status, 'active')))
        .returning();

      if (updatedAuctions.length === 0) {
        return undefined; // Already sold by another transaction
      }

      const updatedAuction = updatedAuctions[0];

      // Create order directly assigned to buyer
      const [newOrder] = await tx
        .insert(orders)
        .values({
          pickupLocation: auction.pickupLocation,
          deliveryLocation: auction.deliveryLocation,
          vehicleBrand: auction.vehicleBrand,
          vehicleModel: auction.vehicleModel,
          vehicleYear: auction.vehicleYear,
          pickupDate: auction.pickupDate,
          deliveryDate: auction.deliveryDate,
          pickupTimeFrom: auction.pickupTimeFrom,
          pickupTimeTo: auction.pickupTimeTo,
          deliveryTimeFrom: auction.deliveryTimeFrom,
          deliveryTimeTo: auction.deliveryTimeTo,
          price: auction.instantPrice,
          distance: auction.distance,
          notes: auction.notes,
          status: 'in_progress', // Auction purchases are automatically accepted
          assignedDriverId: buyerId,
          createdById: auction.createdById,
          fromAuction: 'true',
        })
        .returning();

      // Create billing entry
      await tx
        .insert(billings)
        .values({
          userId: buyerId,
          orderId: newOrder.id,
          auctionId: auction.id,
          amount: auction.instantPrice,
          type: 'order_payment',
          description: `Auktionskauf: ${auction.vehicleBrand} ${auction.vehicleModel} von ${auction.pickupLocation} nach ${auction.deliveryLocation}`,
          createdById: auction.createdById,
        });

      return { auction: updatedAuction, order: newOrder };
    });
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
    return (result.rowCount || 0) > 0;
  }

  // Billing operations
  async createBilling(billing: { 
    userId: string; 
    orderId?: string; 
    auctionId?: string; 
    amount: string; 
    type: 'order_payment' | 'cancellation_fee' | 'credit' | 'debit' | 'completion_payment'; 
    description: string; 
    createdById: string 
  }): Promise<Billing> {
    const [newBilling] = await db
      .insert(billings)
      .values(billing)
      .returning();
    return newBilling;
  }

  async getBillingsByUser(userId: string): Promise<Billing[]> {
    return await db.select().from(billings).where(eq(billings.userId, userId)).orderBy(desc(billings.createdAt));
  }

  async getAllBillings(): Promise<Billing[]> {
    return await db.select().from(billings).orderBy(desc(billings.createdAt));
  }

  // Get completed orders pending billing approval  
  async getCompletedOrdersForBilling(): Promise<Order[]> {
    const completedOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.status, 'completed'));

    // Filter out orders that already have billing entries
    const ordersWithoutBilling: Order[] = [];
    for (const order of completedOrders) {
      const existingBilling = await db
        .select()
        .from(billings)
        .where(
          and(
            eq(billings.orderId, order.id),
            eq(billings.type, 'completion_payment')
          )
        );
      
      if (existingBilling.length === 0) {
        ordersWithoutBilling.push(order);
      }
    }

    return ordersWithoutBilling;
  }

  // Create billing for completed order
  async createCompletionBilling(orderId: string, driverId: string, amount: string, createdById: string): Promise<Billing> {
    return await this.createBilling({
      userId: driverId,
      orderId: orderId,
      amount: amount,
      type: 'completion_payment',
      description: `Vergütung für abgeschlossenen Auftrag`,
      createdById: createdById,
    });
  }

  // Get pending billing approvals (for admin)
  async getPendingBillingApprovals(): Promise<Billing[]> {
    return await db
      .select()
      .from(billings)
      .where(eq(billings.status, 'pending'))
      .orderBy(desc(billings.createdAt));
  }

  // Update billing status and amount
  async updateBillingStatus(
    billingId: string, 
    status: 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled',
    adminNotes?: string,
    newAmount?: string
  ): Promise<Billing> {
    const updateData: any = {
      status: status,
      updatedAt: new Date(),
    };

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }
    
    if (newAmount && newAmount !== '') {
      updateData.amount = newAmount;
    }

    const [billing] = await db
      .update(billings)
      .set(updateData)
      .where(eq(billings.id, billingId))
      .returning();
    return billing;
  }

  // Vehicle handover operations
  async createVehicleHandover(handover: InsertVehicleHandover): Promise<VehicleHandover> {
    const [newHandover] = await db
      .insert(vehicleHandovers)
      .values(handover)
      .returning();
    return newHandover;
  }

  async getHandoversByOrder(orderId: string): Promise<VehicleHandover[]> {
    return await db
      .select()
      .from(vehicleHandovers)
      .where(eq(vehicleHandovers.orderId, orderId))
      .orderBy(desc(vehicleHandovers.handoverDateTime));
  }

  async getHandoversByDriver(driverId: string): Promise<VehicleHandover[]> {
    return await db
      .select()
      .from(vehicleHandovers)
      .where(eq(vehicleHandovers.driverId, driverId))
      .orderBy(desc(vehicleHandovers.handoverDateTime));
  }

  // Update order status after handover
  async updateOrderAfterHandover(orderId: string, type: 'pickup' | 'delivery'): Promise<Order | undefined> {
    const newStatus = type === 'pickup' ? 'picked_up' : 'delivered';
    
    const [order] = await db
      .update(orders)
      .set({ 
        status: newStatus,
        updatedAt: new Date() 
      })
      .where(eq(orders.id, orderId))
      .returning();
    
    return order;
  }
}

export const storage = new DatabaseStorage();
