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
        users = await storage.getUsersByRole(role as 'admin' | 'driver' | 'disponent');
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

  // Create local user
  app.post('/api/users/create', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { email, firstName, lastName, password, role, status } = req.body;
      
      if (!email || !firstName || !lastName || !password || !role || !status) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const newUser = await storage.createLocalUser({
        email,
        firstName,
        lastName,
        password,
        role,
        status,
      });

      res.json({ id: newUser.id, message: "User created successfully" });
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ message: "User with this email already exists" });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Order management routes
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      if (currentUser?.role === 'admin') {
        const orders = await storage.getOrders();
        res.json(orders);
      } else if (currentUser?.role === 'disponent') {
        // Disponents only see orders they created
        const orders = await storage.getOrdersByCreator(req.user.claims.sub);
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
      if (currentUser?.role !== 'admin' && currentUser?.role !== 'disponent') {
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
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      // Pass driverId for cancellation fee logic
      const driverId = currentUser?.role === 'driver' ? req.user.claims.sub : undefined;
      const order = await storage.updateOrderStatus(req.params.id, status, driverId);
      
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

      if (currentUser.status !== 'active') {
        return res.status(403).json({ message: "Account must be active to purchase auctions" });
      }

      const result = await storage.purchaseAuction(req.params.id, req.user.claims.sub);
      if (!result) {
        return res.status(404).json({ message: "Auction not found or already sold" });
      }

      res.json({ 
        message: "Auction purchased successfully and order created",
        auction: result.auction,
        order: result.order
      });
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

  // Purchase auction (driver)
  app.post('/api/auctions/:id/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can purchase auctions" });
      }

      if (currentUser.status !== 'active') {
        return res.status(403).json({ message: "Account must be active to purchase auctions" });
      }

      const result = await storage.purchaseAuction(req.params.id, req.user.claims.sub);
      if (!result) {
        return res.status(404).json({ message: "Auction not found or already sold" });
      }

      res.json({ 
        message: "Auction purchased successfully and order created",
        auction: result.auction,
        order: result.order
      });
    } catch (error) {
      console.error("Error purchasing auction:", error);
      res.status(500).json({ message: "Failed to purchase auction" });
    }
  });

  // Get billing data
  app.get('/api/billing', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      
      if (currentUser?.role === 'admin') {
        const billings = await storage.getAllBillings();
        res.json(billings);
      } else {
        const billings = await storage.getBillingsByUser(req.user.claims.sub);
        res.json(billings);
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
      res.status(500).json({ message: "Failed to fetch billing data" });
    }
  });

  // Get completed orders pending billing approval (admin only)
  app.get('/api/admin/billing/pending', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const pendingOrders = await storage.getCompletedOrdersForBilling();
      res.json(pendingOrders);
    } catch (error) {
      console.error("Error fetching pending billing orders:", error);
      res.status(500).json({ message: "Failed to fetch pending billing orders" });
    }
  });

  // Create billing for completed order (admin only)
  app.post('/api/admin/billing/create', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { orderId, driverId, amount } = req.body;
      
      if (!orderId || !driverId || !amount) {
        return res.status(400).json({ message: "orderId, driverId, and amount are required" });
      }

      const billing = await storage.createCompletionBilling(
        orderId, 
        driverId, 
        amount, 
        req.user.claims.sub
      );
      
      res.json(billing);
    } catch (error) {
      console.error("Error creating billing:", error);
      res.status(500).json({ message: "Failed to create billing" });
    }
  });

  // Get pending billing approvals (admin only)
  app.get('/api/admin/billing/approvals', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const pendingBillings = await storage.getPendingBillingApprovals();
      res.json(pendingBillings);
    } catch (error) {
      console.error("Error fetching pending billing approvals:", error);
      res.status(500).json({ message: "Failed to fetch pending billing approvals" });
    }
  });

  // Approve or reject billing (admin only)
  app.patch('/api/admin/billing/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { status, adminNotes, newAmount } = req.body;
      const billingId = req.params.id;
      
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
      }

      const billing = await storage.updateBillingStatus(billingId, status, adminNotes, newAmount);
      res.json(billing);
    } catch (error) {
      console.error("Error updating billing status:", error);
      res.status(500).json({ message: "Failed to update billing status" });
    }
  });

  // Vehicle handover routes
  app.post('/api/orders/:id/handover', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.user.claims.sub);
      if (currentUser?.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can submit handover documentation" });
      }

      const orderId = req.params.id;
      const { type, pickupKm, deliveryKm, condition, damageNotes, pickupNotes, deliveryNotes } = req.body;

      // Create handover record
      const handover = await storage.createVehicleHandover({
        orderId,
        type,
        kmReading: type === 'pickup' ? pickupKm : deliveryKm,
        condition,
        damageNotes,
        notes: type === 'pickup' ? pickupNotes : deliveryNotes,
        driverId: req.user.claims.sub,
      });

      // Update order status
      const updatedOrder = await storage.updateOrderAfterHandover(orderId, type);

      res.json({ handover, order: updatedOrder });
    } catch (error) {
      console.error("Error creating vehicle handover:", error);
      res.status(500).json({ message: "Failed to create vehicle handover" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
