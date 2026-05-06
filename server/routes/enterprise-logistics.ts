import { Router } from "express";
import { storage } from "../storage";
import { insertLogisticsWarehouseSchema, insertLogisticsInventorySchema, insertLogisticsFulfillmentOrderSchema } from "@shared/schema-logistics";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";
import { logAuditEvent } from "../middleware/auditLog";

/**
 * PR-W34i: every enterprise-logistics admin mutation writes a hash-
 * chained audit_events row. Fire-and-forget; never blocks request.
 */
function emitLogisticsAudit(params: {
  actionType: string;
  actorUserId: string | null | undefined;
  targetType: string;
  targetId: string | number | null | undefined;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): void {
  setImmediate(() => {
    logAuditEvent({
      actorUserId: params.actorUserId ?? undefined,
      actorRole: 'admin',
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId != null ? String(params.targetId) : undefined,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: params.metadata ?? {},
    }).catch((e) =>
      logger.warn('[Enterprise/Logistics] audit_events write failed (non-blocking)', { error: e?.message }),
    );
  });
}

const router = Router();

// =================== LOGISTICS WAREHOUSES ===================

router.post("/warehouses", requireAdmin, async (req: any, res, next) => {
  try {
    const validated = insertLogisticsWarehouseSchema.parse(req.body);
    const warehouse = await storage.createWarehouse(validated);
    logger.info(`[Logistics] Warehouse created: ${warehouse.warehouseId}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_WAREHOUSE_CREATE',
      actorUserId: req.adminUser?.id,
      targetType: 'warehouse',
      targetId: (warehouse as any)?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { warehouseId: (warehouse as any)?.warehouseId, country: (warehouse as any)?.country },
    });
    res.status(201).json(warehouse);
  } catch (error) {
    next(error);
  }
});

router.get("/warehouses", requireAdmin, async (req, res, next) => {
  try {
    const { isActive, country, limit, offset } = req.query;
    const warehouses = await storage.getWarehouses({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      country: country as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(warehouses);
  } catch (error) {
    next(error);
  }
});

router.get("/warehouses/utilization", requireAdmin, async (req, res, next) => {
  try {
    const utilization = await storage.getWarehouseUtilization();
    res.json(utilization);
  } catch (error) {
    next(error);
  }
});

router.get("/warehouses/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const warehouse = await storage.getWarehouse(id);
    if (!warehouse) {
      return res.status(404).json({ error: "Warehouse not found" });
    }
    res.json(warehouse);
  } catch (error) {
    next(error);
  }
});

router.patch("/warehouses/:id", requireAdmin, async (req: any, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateWarehouse(id, req.body);
    logger.info(`[Logistics] Warehouse updated: ${id}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_WAREHOUSE_UPDATE',
      actorUserId: req.adminUser?.id,
      targetType: 'warehouse',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { fields: Object.keys(req.body || {}) },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/warehouses/:id/deactivate", requireAdmin, async (req: any, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const deactivated = await storage.deactivateWarehouse(id);
    logger.info(`[Logistics] Warehouse deactivated: ${id}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_WAREHOUSE_DEACTIVATE',
      actorUserId: req.adminUser?.id,
      targetType: 'warehouse',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json(deactivated);
  } catch (error) {
    next(error);
  }
});

// =================== LOGISTICS INVENTORY ===================

router.post("/inventory", requireAdmin, async (req: any, res, next) => {
  try {
    const validated = insertLogisticsInventorySchema.parse(req.body);
    const item = await storage.createInventoryItem(validated);
    logger.info(`[Logistics] Inventory item created: ${item.sku}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_INVENTORY_CREATE',
      actorUserId: req.adminUser?.id,
      targetType: 'inventory_item',
      targetId: (item as any)?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { sku: (item as any)?.sku, warehouseId: (item as any)?.warehouseId },
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory", requireAdmin, async (req, res, next) => {
  try {
    const { warehouseId, category, searchTerm, limit, offset } = req.query;
    const items = await storage.getInventoryItems({
      warehouseId: warehouseId ? parseInt(warehouseId as string) : undefined,
      category: category as string,
      searchTerm: searchTerm as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/low-stock", requireAdmin, async (req, res, next) => {
  try {
    const items = await storage.getLowStockItems();
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/expiring", requireAdmin, async (req, res, next) => {
  try {
    const { daysThreshold } = req.query;
    const items = await storage.getExpiringItems(daysThreshold ? parseInt(daysThreshold as string) : 30);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/sku/:sku", requireAdmin, async (req, res, next) => {
  try {
    const item = await storage.getInventoryBySku(req.params.sku);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const item = await storage.getInventoryItem(id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/warehouse/:warehouseId", requireAdmin, async (req, res, next) => {
  try {
    const warehouseId = parseInt(req.params.warehouseId);
    const items = await storage.getInventoryByWarehouse(warehouseId);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.patch("/inventory/:id", requireAdmin, async (req: any, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateInventoryItem(id, req.body);
    logger.info(`[Logistics] Inventory item updated: ${id}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_INVENTORY_UPDATE',
      actorUserId: req.adminUser?.id,
      targetType: 'inventory_item',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { fields: Object.keys(req.body || {}) },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/inventory/:id/adjust", requireAdmin, async (req: any, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { quantityChange, notes } = req.body;
    const updated = await storage.adjustInventoryQuantity(id, quantityChange, notes);
    logger.info(`[Logistics] Inventory adjusted: ${id}, change: ${quantityChange}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_INVENTORY_ADJUST',
      actorUserId: req.adminUser?.id,
      targetType: 'inventory_item',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { quantityChange, hasNotes: !!notes },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// =================== LOGISTICS FULFILLMENT ORDERS ===================

router.post("/fulfillment-orders", requireAdmin, async (req: any, res, next) => {
  try {
    const validated = insertLogisticsFulfillmentOrderSchema.parse(req.body);
    const order = await storage.createFulfillmentOrder(validated);
    logger.info(`[Logistics] Fulfillment order created: ${order.orderId}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_ORDER_CREATE',
      actorUserId: req.adminUser?.id,
      targetType: 'fulfillment_order',
      targetId: (order as any)?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { orderId: (order as any)?.orderId, orderType: (order as any)?.orderType, stationId: (order as any)?.stationId },
    });
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.get("/fulfillment-orders", requireAdmin, async (req, res, next) => {
  try {
    const { orderType, status, priority, stationId, warehouseId, limit, offset } = req.query;
    const orders = await storage.getFulfillmentOrders({
      orderType: orderType as string,
      status: status as string,
      priority: priority as string,
      stationId: stationId as string,
      warehouseId: warehouseId ? parseInt(warehouseId as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get("/fulfillment-orders/pending", requireAdmin, async (req, res, next) => {
  try {
    const orders = await storage.getPendingOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get("/fulfillment-orders/station/:stationId", requireAdmin, async (req, res, next) => {
  try {
    const orders = await storage.getOrdersByStation(req.params.stationId);
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get("/fulfillment-orders/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const order = await storage.getFulfillmentOrder(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
});

router.patch("/fulfillment-orders/:id", requireAdmin, async (req: any, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateFulfillmentOrder(id, req.body);
    logger.info(`[Logistics] Fulfillment order updated: ${id}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_ORDER_UPDATE',
      actorUserId: req.adminUser?.id,
      targetType: 'fulfillment_order',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { fields: Object.keys(req.body || {}) },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/fulfillment-orders/:id/ship", requireAdmin, async (req: any, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { trackingNumber, carrier } = req.body;
    if (!trackingNumber || !carrier) {
      return res.status(400).json({ error: "trackingNumber and carrier are required" });
    }
    const shipped = await storage.shipFulfillmentOrder(id, trackingNumber, carrier);
    logger.info(`[Logistics] Order shipped: ${id}, tracking: ${trackingNumber}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_ORDER_SHIP',
      actorUserId: req.adminUser?.id,
      targetType: 'fulfillment_order',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: {
        carrier,
        // mask tracking number — store last 6 chars only (full number is
        // a customer-shareable secret in some carriers)
        trackingLast6: typeof trackingNumber === 'string' ? trackingNumber.slice(-6) : undefined,
      },
    });
    res.json(shipped);
  } catch (error) {
    next(error);
  }
});

router.post("/fulfillment-orders/:id/deliver", requireAdmin, async (req: any, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const delivered = await storage.deliverFulfillmentOrder(id);
    logger.info(`[Logistics] Order delivered: ${id}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_ORDER_DELIVER',
      actorUserId: req.adminUser?.id,
      targetType: 'fulfillment_order',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json(delivered);
  } catch (error) {
    next(error);
  }
});

router.post("/fulfillment-orders/:id/cancel", requireAdmin, async (req: any, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const cancelled = await storage.cancelFulfillmentOrder(id, reason);
    logger.info(`[Logistics] Order cancelled: ${id}, reason: ${reason}`);
    emitLogisticsAudit({
      actionType: 'LOGISTICS_ORDER_CANCEL',
      actorUserId: req.adminUser?.id,
      targetType: 'fulfillment_order',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { reason },
    });
    res.json(cancelled);
  } catch (error) {
    next(error);
  }
});

export default router;
