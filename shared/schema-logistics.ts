import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  integer,
  decimal,
  boolean,
  serial,
  date
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =================== LOGISTICS DEPARTMENT ===================

export const logisticsWarehouses = pgTable("logistics_warehouses", {
  id: serial("id").primaryKey(),
  warehouseId: varchar("warehouse_id").unique().notNull(), // WH-IL-001
  name: varchar("name").notNull(),
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  country: varchar("country").default("IL"),
  coordinates: jsonb("coordinates"),
  capacity: integer("capacity"), // total storage capacity in cubic meters
  currentUtilization: decimal("current_utilization", { precision: 5, scale: 2 }), // percentage
  managerEmployeeId: integer("manager_employee_id"),
  operatingHours: jsonb("operating_hours"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const logisticsInventory = pgTable("logistics_inventory", {
  id: serial("id").primaryKey(),
  sku: varchar("sku").unique().notNull(),
  productName: varchar("product_name").notNull(),
  productNameHe: varchar("product_name_he"),
  category: varchar("category").notNull(), // shampoo, equipment, supplies, parts
  warehouseId: integer("warehouse_id").references(() => logisticsWarehouses.id, { onDelete: 'set null' }),
  quantity: integer("quantity").notNull().default(0),
  unit: varchar("unit").default("units"), // units, liters, kg, boxes
  reorderLevel: integer("reorder_level").default(0),
  reorderQuantity: integer("reorder_quantity").default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  supplierId: integer("supplier_id"),
  lastRestockedDate: date("last_restocked_date"),
  expiryDate: date("expiry_date"),
  locationInWarehouse: varchar("location_in_warehouse"), // Aisle-Shelf format
  barcodeEan: varchar("barcode_ean"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  skuIdx: uniqueIndex("idx_inventory_sku").on(table.sku),
  categoryIdx: index("idx_inventory_category").on(table.category),
  warehouseIdx: index("idx_inventory_warehouse").on(table.warehouseId),
}));

export const logisticsFulfillmentOrders = pgTable("logistics_fulfillment_orders", {
  id: serial("id").primaryKey(),
  orderId: varchar("order_id").unique().notNull(), // FO-2025-0001
  orderType: varchar("order_type").notNull(), // station_restock, customer_delivery, franchise_shipment
  stationId: varchar("station_id"), // FK to stationRegistry - cross-module
  warehouseId: integer("warehouse_id").references(() => logisticsWarehouses.id, { onDelete: 'set null' }),
  requestedBy: integer("requested_by"),
  assignedTo: integer("assigned_to"),
  items: jsonb("items").notNull(), // array of {sku, quantity, picked_quantity}
  priority: varchar("priority").default("normal"), // low, normal, high, urgent
  status: varchar("status").default("pending"), // pending, picking, packing, shipped, delivered, cancelled
  orderDate: timestamp("order_date").defaultNow(),
  shipDate: timestamp("ship_date"),
  deliveryDate: timestamp("delivery_date"),
  estimatedDelivery: date("estimated_delivery"),
  trackingNumber: varchar("tracking_number"),
  shippingCarrier: varchar("shipping_carrier"),
  deliveryAddress: text("delivery_address"),
  deliveryNotes: text("delivery_notes"),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orderIdIdx: uniqueIndex("idx_fulfillment_id").on(table.orderId),
  statusIdx: index("idx_fulfillment_status").on(table.status),
  stationIdx: index("idx_fulfillment_station").on(table.stationId),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertLogisticsWarehouseSchema = createInsertSchema(logisticsWarehouses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLogisticsWarehouse = z.infer<typeof insertLogisticsWarehouseSchema>;
export type LogisticsWarehouse = typeof logisticsWarehouses.$inferSelect;

export const insertLogisticsInventorySchema = createInsertSchema(logisticsInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  lastRestockedDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  expiryDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertLogisticsInventory = z.infer<typeof insertLogisticsInventorySchema>;
export type LogisticsInventory = typeof logisticsInventory.$inferSelect;

export const insertLogisticsFulfillmentOrderSchema = createInsertSchema(logisticsFulfillmentOrders).omit({
  id: true,
  orderDate: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  shipDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  deliveryDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  estimatedDelivery: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertLogisticsFulfillmentOrder = z.infer<typeof insertLogisticsFulfillmentOrderSchema>;
export type LogisticsFulfillmentOrder = typeof logisticsFulfillmentOrders.$inferSelect;
