/**
 * K9000 SUPPLIER & FRANCHISE ORDERING API
 * 
 * Exclusive Israel partnership management system for K9000 dog wash stations
 * Features:
 * - Inventory tracking for all stations
 * - Franchise order requests
 * - Stock transactions
 * - WhatsApp notifications for low stock
 * - Supplier dashboard analytics
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  spareParts, 
  stationSpareParts,
  franchiseOrderRequests,
  stockTransactions,
  supplierNotificationSettings,
  petWashStations,
  franchisees,
  insertSparePartSchema,
  insertFranchiseOrderRequestSchema,
  insertStockTransactionSchema,
  insertSupplierNotificationSettingSchema
} from '@shared/schema-enterprise';
import { eq, and, desc, sql, gte, lte, or } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { validateFirebaseToken } from '../middleware/firebase-auth';

const router = Router();

// Middleware: All routes require authentication
router.use(validateFirebaseToken);

// ====================  SPARE PARTS & INVENTORY ====================

/**
 * GET /api/k9000/spare-parts - List all spare parts with stock levels
 */
router.get('/spare-parts', async (req: Request, res: Response) => {
  try {
    const { category, lowStock, critical } = req.query;
    
    const conditions: any[] = [];
    if (category) {
      conditions.push(eq(spareParts.category, category as string));
    }
    if (lowStock === 'true') {
      conditions.push(sql`${spareParts.quantityInStock} <= ${spareParts.reorderPoint}`);
    }
    if (critical === 'true') {
      conditions.push(eq(spareParts.isCritical, true));
    }
    
    const parts = conditions.length > 0
      ? await db.select().from(spareParts).where(and(...conditions)).orderBy(desc(spareParts.createdAt))
      : await db.select().from(spareParts).orderBy(desc(spareParts.createdAt));
    
    // Calculate stock health for each part
    const partsWithHealth = parts.map(part => ({
      ...part,
      stockHealth: (part.quantityInStock || 0) <= (part.reorderPoint || 0) ? 'low' :
                   (part.quantityInStock || 0) <= (part.minimumStockLevel || 0) ? 'warning' : 'healthy',
      stockPercentage: part.maximumStockLevel ? Math.round(((part.quantityInStock || 0) / part.maximumStockLevel) * 100) : 0
    }));
    
    res.json({ parts: partsWithHealth });
  } catch (error) {
    logger.error('Error fetching spare parts:', error);
    res.status(500).json({ error: 'Failed to fetch spare parts' });
  }
});

/**
 * GET /api/k9000/spare-parts/:id - Get specific spare part
 */
router.get('/spare-parts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [part] = await db
      .select()
      .from(spareParts)
      .where(eq(spareParts.id, parseInt(id)));
    
    if (!part) {
      return res.status(404).json({ error: 'Spare part not found' });
    }
    
    // Get stations that have this part
    const stationParts = await db
      .select({
        stationId: stationSpareParts.stationId,
        quantity: stationSpareParts.quantity,
        minimumQuantity: stationSpareParts.minimumQuantity,
        storageLocation: stationSpareParts.storageLocation,
        stationCode: petWashStations.stationCode,
        stationName: petWashStations.stationName,
        city: petWashStations.city,
      })
      .from(stationSpareParts)
      .leftJoin(petWashStations, eq(stationSpareParts.stationId, petWashStations.id))
      .where(eq(stationSpareParts.sparePartId, parseInt(id)));
    
    res.json({ part, stationParts });
  } catch (error) {
    logger.error('Error fetching spare part:', error);
    res.status(500).json({ error: 'Failed to fetch spare part' });
  }
});

/**
 * POST /api/k9000/spare-parts - Add new spare part
 */
router.post('/spare-parts', async (req: Request, res: Response) => {
  try {
    const validation = insertSparePartSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const validatedData = validation.data;
    
    const [newPart] = await db
      .insert(spareParts)
      .values(validatedData)
      .returning();
    
    logger.info(`New spare part added: ${newPart.partNumber} - ${newPart.partName}`);
    res.status(201).json({ part: newPart });
  } catch (error) {
    logger.error('Error adding spare part:', error);
    res.status(400).json({ error: 'Failed to add spare part' });
  }
});

/**
 * PATCH /api/k9000/spare-parts/:id - Update spare part
 */
router.patch('/spare-parts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [updatedPart] = await db
      .update(spareParts)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(spareParts.id, parseInt(id)))
      .returning();
    
    if (!updatedPart) {
      return res.status(404).json({ error: 'Spare part not found' });
    }
    
    logger.info(`Spare part updated: ${updatedPart.partNumber}`);
    res.json({ part: updatedPart });
  } catch (error) {
    logger.error('Error updating spare part:', error);
    res.status(500).json({ error: 'Failed to update spare part' });
  }
});

/**
 * GET /api/k9000/inventory-dashboard - Get comprehensive inventory overview
 */
router.get('/inventory-dashboard', async (req: Request, res: Response) => {
  try {
    // Get all parts with stock levels
    const allParts = await db.select().from(spareParts);
    
    // Calculate metrics
    const totalParts = allParts.length;
    const lowStockParts = allParts.filter(p => (p.quantityInStock || 0) <= (p.reorderPoint || 0));
    const criticalParts = allParts.filter(p => p.isCritical && (p.quantityInStock || 0) <= (p.minimumStockLevel || 0));
    const totalStockValue = allParts.reduce((sum, p) => sum + ((p.quantityInStock || 0) * parseFloat(p.unitCost)), 0);
    
    // Get recent transactions
    const recentTransactions = await db
      .select()
      .from(stockTransactions)
      .orderBy(desc(stockTransactions.createdAt))
      .limit(10);
    
    // Get pending orders
    const pendingOrders = await db
      .select()
      .from(franchiseOrderRequests)
      .where(or(
        eq(franchiseOrderRequests.status, 'pending'),
        eq(franchiseOrderRequests.status, 'approved')
      ))
      .orderBy(desc(franchiseOrderRequests.createdAt));
    
    res.json({
      overview: {
        totalParts,
        lowStockCount: lowStockParts.length,
        criticalCount: criticalParts.length,
        totalStockValue: totalStockValue.toFixed(2),
        currency: 'ILS'
      },
      lowStockParts: lowStockParts.slice(0, 10),
      criticalParts,
      recentTransactions,
      pendingOrders,
      lastUpdated: new Date()
    });
  } catch (error) {
    logger.error('Error fetching inventory dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ==================== FRANCHISE ORDERS ====================

/**
 * GET /api/k9000/orders - List franchise order requests
 */
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const { status, franchiseeId, priority } = req.query;
    
    const conditions: any[] = [];
    if (status) {
      conditions.push(eq(franchiseOrderRequests.status, status as string));
    }
    if (franchiseeId) {
      conditions.push(eq(franchiseOrderRequests.franchiseeId, parseInt(franchiseeId as string)));
    }
    if (priority) {
      conditions.push(eq(franchiseOrderRequests.priority, priority as string));
    }
    
    const ordersQuery = db
      .select({
        order: franchiseOrderRequests,
        franchisee: franchisees,
        station: petWashStations
      })
      .from(franchiseOrderRequests)
      .leftJoin(franchisees, eq(franchiseOrderRequests.franchiseeId, franchisees.id))
      .leftJoin(petWashStations, eq(franchiseOrderRequests.stationId, petWashStations.id));
    
    const orders = conditions.length > 0
      ? await ordersQuery.where(and(...conditions)).orderBy(desc(franchiseOrderRequests.createdAt))
      : await ordersQuery.orderBy(desc(franchiseOrderRequests.createdAt));
    
    res.json({ orders });
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * POST /api/k9000/orders - Create new franchise order request
 */
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const validation = insertFranchiseOrderRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const validatedData = validation.data;
    
    // Generate order number
    const orderCount = await db.select({ count: sql<number>`count(*)` }).from(franchiseOrderRequests);
    const orderNumber = `FOR-${new Date().getFullYear()}-${String(Number(orderCount[0].count) + 1).padStart(6, '0')}`;
    
    const [newOrder] = await db
      .insert(franchiseOrderRequests)
      .values({
        ...validatedData,
        orderNumber
      })
      .returning();
    
    logger.info(`New franchise order created: ${orderNumber}`);
    
    // TODO: Send notification to supplier
    
    res.status(201).json({ order: newOrder });
  } catch (error) {
    logger.error('Error creating order:', error);
    res.status(400).json({ error: 'Failed to create order' });
  }
});

/**
 * PATCH /api/k9000/orders/:id - Update order status
 */
router.patch('/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approvedBy, rejectionReason, trackingNumber, ...otherUpdates } = req.body;
    
    const updateData: any = { ...otherUpdates, updatedAt: new Date() };
    
    if (status) {
      updateData.status = status;
      if (status === 'approved') {
        updateData.approvedBy = approvedBy;
        updateData.approvedAt = new Date();
      }
      if (status === 'rejected') {
        updateData.rejectionReason = rejectionReason;
      }
      if (status === 'shipped') {
        updateData.trackingNumber = trackingNumber;
      }
    }
    
    const [updatedOrder] = await db
      .update(franchiseOrderRequests)
      .set(updateData)
      .where(eq(franchiseOrderRequests.id, parseInt(id)))
      .returning();
    
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    logger.info(`Order ${updatedOrder.orderNumber} updated to status: ${updatedOrder.status}`);
    
    // TODO: Send notification based on status change
    
    res.json({ order: updatedOrder });
  } catch (error) {
    logger.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ==================== STOCK TRANSACTIONS ====================

/**
 * POST /api/k9000/transactions - Record stock transaction
 */
router.post('/transactions', async (req: Request, res: Response) => {
  try {
    const validation = insertStockTransactionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const validatedData = validation.data;
    
    // Generate transaction number
    const txCount = await db.select({ count: sql<number>`count(*)` }).from(stockTransactions);
    const transactionNumber = `STX-${new Date().getFullYear()}-${String(Number(txCount[0].count) + 1).padStart(6, '0')}`;
    
    const [transaction] = await db
      .insert(stockTransactions)
      .values({
        ...validatedData,
        transactionNumber
      })
      .returning();
    
    // Update spare parts stock level
    const sparePartId = validatedData.sparePartId;
    const quantity = validatedData.quantity;
    const transactionType = validatedData.transactionType;
    
    if (transactionType === 'purchase' || transactionType === 'return') {
      // Increase stock
      await db
        .update(spareParts)
        .set({ 
          quantityInStock: sql`${spareParts.quantityInStock} + ${quantity}`,
          updatedAt: new Date()
        })
        .where(eq(spareParts.id, sparePartId));
    } else if (transactionType === 'usage' || transactionType === 'damage' || transactionType === 'transfer') {
      // Decrease stock
      await db
        .update(spareParts)
        .set({ 
          quantityInStock: sql`${spareParts.quantityInStock} - ${quantity}`,
          updatedAt: new Date()
        })
        .where(eq(spareParts.id, sparePartId));
    }
    
    // Check if stock is low and trigger notification
    const [updatedPart] = await db
      .select()
      .from(spareParts)
      .where(eq(spareParts.id, sparePartId));
    
    if (updatedPart && (updatedPart.quantityInStock || 0) <= (updatedPart.reorderPoint || 0)) {
      // TODO: Trigger WhatsApp notification
      logger.warn(`LOW STOCK ALERT: ${updatedPart.partNumber} - ${updatedPart.partName} (${updatedPart.quantityInStock} units remaining)`);
    }
    
    logger.info(`Stock transaction recorded: ${transactionNumber}`);
    res.status(201).json({ transaction });
  } catch (error) {
    logger.error('Error recording transaction:', error);
    res.status(400).json({ error: 'Failed to record transaction' });
  }
});

/**
 * GET /api/k9000/transactions - Get stock transaction history
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const { sparePartId, transactionType, startDate, endDate } = req.query;
    
    const conditions: any[] = [];
    if (sparePartId) {
      conditions.push(eq(stockTransactions.sparePartId, parseInt(sparePartId as string)));
    }
    if (transactionType) {
      conditions.push(eq(stockTransactions.transactionType, transactionType as string));
    }
    if (startDate) {
      conditions.push(gte(stockTransactions.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(stockTransactions.createdAt, new Date(endDate as string)));
    }
    
    const transactionsQuery = db
      .select({
        transaction: stockTransactions,
        part: spareParts
      })
      .from(stockTransactions)
      .leftJoin(spareParts, eq(stockTransactions.sparePartId, spareParts.id));
    
    const transactions = conditions.length > 0
      ? await transactionsQuery.where(and(...conditions)).orderBy(desc(stockTransactions.createdAt)).limit(100)
      : await transactionsQuery.orderBy(desc(stockTransactions.createdAt)).limit(100);
    
    res.json({ transactions });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ==================== NOTIFICATION SETTINGS ====================

/**
 * GET /api/k9000/notification-settings - Get notification settings
 */
router.get('/notification-settings', async (req: Request, res: Response) => {
  try {
    const settings = await db
      .select()
      .from(supplierNotificationSettings)
      .orderBy(desc(supplierNotificationSettings.createdAt));
    
    res.json({ settings });
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

/**
 * POST /api/k9000/notification-settings - Add notification recipient
 */
router.post('/notification-settings', async (req: Request, res: Response) => {
  try {
    const validation = insertSupplierNotificationSettingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const validatedData = validation.data;
    
    const [setting] = await db
      .insert(supplierNotificationSettings)
      .values(validatedData)
      .returning();
    
    logger.info(`Notification setting added for: ${setting.recipientName} (${setting.recipientRole})`);
    res.status(201).json({ setting });
  } catch (error) {
    logger.error('Error adding notification setting:', error);
    res.status(400).json({ error: 'Failed to add notification setting' });
  }
});

/**
 * PATCH /api/k9000/notification-settings/:id - Update notification setting
 */
router.patch('/notification-settings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [updatedSetting] = await db
      .update(supplierNotificationSettings)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(supplierNotificationSettings.id, parseInt(id)))
      .returning();
    
    if (!updatedSetting) {
      return res.status(404).json({ error: 'Notification setting not found' });
    }
    
    res.json({ setting: updatedSetting });
  } catch (error) {
    logger.error('Error updating notification setting:', error);
    res.status(500).json({ error: 'Failed to update notification setting' });
  }
});

/**
 * DELETE /api/k9000/notification-settings/:id - Remove notification recipient
 */
router.delete('/notification-settings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await db
      .delete(supplierNotificationSettings)
      .where(eq(supplierNotificationSettings.id, parseInt(id)));
    
    logger.info(`Notification setting deleted: ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting notification setting:', error);
    res.status(500).json({ error: 'Failed to delete notification setting' });
  }
});

export default router;
