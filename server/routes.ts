import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertOrderSchema, insertAuctionSchema, insertUserSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User management routes (Admin only)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { role, status } = req.query;
      let users;
      
      if (role) {
        users = await storage.getUsersByRole(role as 'admin' | 'driver');
      } else if (status) {
        users = await storage.getUsersByStatus(status as 'pending' | 'active' | 'inactive');
      } else {
        users = await storage.getUsersByRole('driver'); // Default to drivers
      }

      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/drivers/active', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const activeDrivers = await storage.getUsersByStatus('active');
      const drivers = activeDrivers.filter(user => user.role === 'driver');
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching active drivers:", error);
      res.status(500).json({ message: "Failed to fetch active drivers" });
    }
  });

  app.patch('/api/users/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { status } = req.body;
      const user = await storage.updateUserStatus(req.params.id, status);
      res.json(user);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Order management routes
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      if (currentUser?.role === 'admin') {
        const orders = await storage.getOrders();
        res.json(orders);
      } else {
        // Drivers only see their assigned orders
        const orders = await storage.getOrdersByDriver(req.user.claims.sub);
        res.json(orders);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Manually prepare data with correct date conversion
      const orderInput = {
        ...req.body,
        pickupDate: req.body.pickupDate ? new Date(req.body.pickupDate) : new Date(),
        deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : null,
        createdById: req.user.claims.sub,
      };

      // Remove any undefined deliveryDate
      if (!orderInput.deliveryDate) {
        delete orderInput.deliveryDate;
      }

      const order = await storage.createOrder(orderInput);
      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.patch('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Manually prepare data with correct date conversion
      const updateData: any = { ...req.body };
      if (updateData.pickupDate) {
        updateData.pickupDate = new Date(updateData.pickupDate);
      }
      if (updateData.deliveryDate) {
        updateData.deliveryDate = new Date(updateData.deliveryDate);
      }

      const order = await storage.updateOrder(req.params.id, updateData);
      res.json(order);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.patch('/api/orders/:id/assign', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { driverId } = req.body;
      const order = await storage.assignOrderToDriver(req.params.id, driverId);
      res.json(order);
    } catch (error) {
      console.error("Error assigning order:", error);
      res.status(500).json({ message: "Failed to assign order" });
    }
  });

  app.patch('/api/orders/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'driver') {
        return res.status(403).json({ message: "Access denied" });
      }

      const order = await storage.acceptOrder(req.params.id, req.user.claims.sub);
      res.json(order);
    } catch (error) {
      console.error("Error accepting order:", error);
      res.status(500).json({ message: "Failed to accept order" });
    }
  });

  app.patch('/api/orders/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'driver') {
        return res.status(403).json({ message: "Access denied" });
      }

      const order = await storage.rejectOrder(req.params.id, req.user.claims.sub);
      res.json(order);
    } catch (error) {
      console.error("Error rejecting order:", error);
      res.status(500).json({ message: "Failed to reject order" });
    }
  });

  app.patch('/api/orders/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.body;
      const order = await storage.updateOrderStatus(req.params.id, status);
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  app.delete('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const success = await storage.deleteOrder(req.params.id);
      if (success) {
        res.json({ message: "Order deleted successfully" });
      } else {
        res.status(404).json({ message: "Order not found" });
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  // Auction routes
  app.get('/api/auctions', isAuthenticated, async (req: any, res) => {
    try {
      const auctions = await storage.getActiveAuctions();
      res.json(auctions);
    } catch (error) {
      console.error("Error fetching auctions:", error);
      res.status(500).json({ message: "Failed to fetch auctions" });
    }
  });

  app.post('/api/auctions', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Manually prepare data with correct date conversion
      const auctionInput = {
        ...req.body,
        pickupDate: req.body.pickupDate ? new Date(req.body.pickupDate) : new Date(),
        deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : null,
        createdById: req.user.claims.sub,
      };

      // Remove any undefined deliveryDate
      if (!auctionInput.deliveryDate) {
        delete auctionInput.deliveryDate;
      }

      const auction = await storage.createAuction(auctionInput);
      res.json(auction);
    } catch (error) {
      console.error("Error creating auction:", error);
      res.status(500).json({ message: "Failed to create auction" });
    }
  });

  app.post('/api/auctions/:id/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can purchase auctions" });
      }

      const auction = await storage.purchaseAuction(req.params.id, req.user.claims.sub);
      
      if (!auction) {
        return res.status(404).json({ message: "Auction not found or already sold" });
      }

      // Create an order from the purchased auction
      const orderData = {
        pickupLocation: auction.pickupLocation,
        deliveryLocation: auction.deliveryLocation,
        vehicleBrand: auction.vehicleBrand,
        vehicleModel: auction.vehicleModel,
        vehicleYear: auction.vehicleYear,
        pickupDate: auction.pickupDate,
        deliveryDate: auction.deliveryDate,
        price: auction.instantPrice,
        distance: auction.distance,
        notes: auction.notes,
        status: 'assigned' as const,
        assignedDriverId: req.user.claims.sub,
        createdById: auction.createdById,
      };

      const order = await storage.createOrder(orderData);
      res.json({ auction, order });
    } catch (error) {
      console.error("Error purchasing auction:", error);
      res.status(500).json({ message: "Failed to purchase auction" });
    }
  });

  app.patch('/api/auctions/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { status } = req.body;
      const auction = await storage.updateAuctionStatus(req.params.id, status);
      res.json(auction);
    } catch (error) {
      console.error("Error updating auction status:", error);
      res.status(500).json({ message: "Failed to update auction status" });
    }
  });

  app.delete('/api/auctions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const success = await storage.deleteAuction(req.params.id);
      if (success) {
        res.json({ message: "Auction deleted successfully" });
      } else {
        res.status(404).json({ message: "Auction not found" });
      }
    } catch (error) {
      console.error("Error deleting auction:", error);
      res.status(500).json({ message: "Failed to delete auction" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
