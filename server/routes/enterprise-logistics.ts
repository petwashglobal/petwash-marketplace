import { Router } from "express";
import { storage } from "../storage";
import { insertLogisticsWarehouseSchema, insertLogisticsInventorySchema, insertLogisticsFulfillmentOrderSchema } from "@shared/schema-logistics";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";

const router = Router();

// =================== LOGISTICS WAREHOUSES ===================

router.post("/warehouses", requireAdmin, async (req, res, next) => {
  try {
    const validated = insertLogisticsWarehouseSchema.parse(req.body);
    const warehouse = await storage.createWarehouse(validated);
    logger.info(`[Logistics] Warehouse created: ${warehouse.warehouseId}`);
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

router.patch("/warehouses/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateWarehouse(id, req.body);
    logger.info(`[Logistics] Warehouse updated: ${id}`);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/warehouses/:id/deactivate", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const deactivated = await storage.deactivateWarehouse(id);
    logger.info(`[Logistics] Warehouse deactivated: ${id}`);
    res.json(deactivated);
  } catch (error) {
    next(error);
  }
});

// =================== LOGISTICS INVENTORY ===================

router.post("/inventory", requireAdmin, async (req, res, next) => {
  try {
    const validated = insertLogisticsInventorySchema.parse(req.body);
    const item = await storage.createInventoryItem(validated);
    logger.info(`[Logistics] Inventory item created: ${item.sku}`);
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

router.patch("/inventory/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateInventoryItem(id, req.body);
    logger.info(`[Logistics] Inventory item updated: ${id}`);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/inventory/:id/adjust", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { quantityChange, notes } = req.body;
    const updated = await storage.adjustInventoryQuantity(id, quantityChange, notes);
    logger.info(`[Logistics] Inventory adjusted: ${id}, change: ${quantityChange}`);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// =================== LOGISTICS FULFILLMENT ORDERS ===================

router.post("/fulfillment-orders", requireAdmin, async (req, res, next) => {
  try {
    const validated = insertLogisticsFulfillmentOrderSchema.parse(req.body);
    const order = await storage.createFulfillmentOrder(validated);
    logger.info(`[Logistics] Fulfillment order created: ${order.orderId}`);
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

router.patch("/fulfillment-orders/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateFulfillmentOrder(id, req.body);
    logger.info(`[Logistics] Fulfillment order updated: ${id}`);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/fulfillment-orders/:id/ship", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { trackingNumber, carrier } = req.body;
    if (!trackingNumber || !carrier) {
      return res.status(400).json({ error: "trackingNumber and carrier are required" });
    }
    const shipped = await storage.shipFulfillmentOrder(id, trackingNumber, carrier);
    logger.info(`[Logistics] Order shipped: ${id}, tracking: ${trackingNumber}`);
    res.json(shipped);
  } catch (error) {
    next(error);
  }
});

router.post("/fulfillment-orders/:id/deliver", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const delivered = await storage.deliverFulfillmentOrder(id);
    logger.info(`[Logistics] Order delivered: ${id}`);
    res.json(delivered);
  } catch (error) {
    next(error);
  }
});

router.post("/fulfillment-orders/:id/cancel", requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const cancelled = await storage.cancelFulfillmentOrder(id, reason);
    logger.info(`[Logistics] Order cancelled: ${id}, reason: ${reason}`);
    res.json(cancelled);
  } catch (error) {
    next(error);
  }
});

export default router;
