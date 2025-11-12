// ===================================================================
// PET WASH™ 2026 ENTERPRISE API ROUTES
// ===================================================================
// Complete API for global franchise management, station operations,
// billing, inventory, maintenance, subscriptions, and analytics
// ===================================================================

import { Router } from "express";
import { db } from "../db";
import { 
  countries,
  franchiseTerritories,
  franchisees,
  petWashStations,
  stationBills,
  stationAssets,
  spareParts,
  stationSpareParts,
  maintenanceWorkOrders,
  subscriptionPlans,
  userSubscriptions,
  subscriptionUsageHistory,
  stationTelemetry,
  stationAlerts,
  stationPerformanceMetrics,
  customerAchievements,
  insertCountrySchema,
  insertFranchiseTerritorySchema,
  insertFranchiseeSchema,
  insertPetWashStationSchema,
  insertStationBillSchema,
  insertStationAssetSchema,
  insertSparePartSchema,
  insertStationSparePartSchema,
  insertMaintenanceWorkOrderSchema,
  insertSubscriptionPlanSchema,
  insertUserSubscriptionSchema,
  insertSubscriptionUsageHistorySchema,
  insertStationTelemetrySchema,
  insertStationAlertSchema,
  insertStationPerformanceMetricsSchema,
  insertCustomerAchievementSchema
} from "../../shared/schema-enterprise";
import { eq, and, desc, gte, lte, sql, count, sum } from "drizzle-orm";
import { requireAdmin } from "../adminAuth";
import { requireAuth } from "../customAuth";
import { logger } from "../lib/logger";
import { ZodError } from "zod";

const router = Router();

// =================== COUNTRY & TERRITORY MANAGEMENT ===================

// Get all countries
router.get("/countries", requireAdmin, async (req, res) => {
  try {
    const allCountries = await db.select().from(countries).orderBy(countries.name);
    res.json(allCountries);
  } catch (error) {
    logger.error("Error fetching countries:", error);
    res.status(500).json({ error: "Failed to fetch countries" });
  }
});

// Create country
router.post("/countries", requireAdmin, async (req, res) => {
  try {
    const validation = insertCountrySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [newCountry] = await db.insert(countries).values(validation.data).returning();
    res.json(newCountry);
  } catch (error) {
    logger.error("Error creating country:", error);
    res.status(500).json({ error: "Failed to create country" });
  }
});

// Get territories by country
router.get("/territories", requireAdmin, async (req, res) => {
  try {
    const { countryId } = req.query;
    
    const territories = countryId
      ? await db.select().from(franchiseTerritories)
          .where(eq(franchiseTerritories.countryId, Number(countryId)))
          .orderBy(franchiseTerritories.name)
      : await db.select().from(franchiseTerritories)
          .orderBy(franchiseTerritories.name);
    
    res.json(territories);
  } catch (error) {
    logger.error("Error fetching territories:", error);
    res.status(500).json({ error: "Failed to fetch territories" });
  }
});

// Create territory
router.post("/territories", requireAdmin, async (req, res) => {
  try {
    const validation = insertFranchiseTerritorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [newTerritory] = await db.insert(franchiseTerritories).values(validation.data).returning();
    res.json(newTerritory);
  } catch (error) {
    logger.error("Error creating territory:", error);
    res.status(500).json({ error: "Failed to create territory" });
  }
});

// =================== FRANCHISEE MANAGEMENT ===================

// Get all franchisees
router.get("/franchisees", requireAdmin, async (req, res) => {
  try {
    const { status, countryId, territoryId } = req.query;
    
    const conditions = [];
    if (status) conditions.push(eq(franchisees.status, status as string));
    if (countryId) conditions.push(eq(franchisees.countryId, Number(countryId)));
    if (territoryId) conditions.push(eq(franchisees.territoryId, Number(territoryId)));
    
    const allFranchisees = conditions.length > 0
      ? await db.select().from(franchisees).where(and(...conditions)).orderBy(desc(franchisees.createdAt))
      : await db.select().from(franchisees).orderBy(desc(franchisees.createdAt));
    
    res.json(allFranchisees);
  } catch (error) {
    logger.error("Error fetching franchisees:", error);
    res.status(500).json({ error: "Failed to fetch franchisees" });
  }
});

// Get single franchisee
router.get("/franchisees/:id", requireAdmin, async (req, res) => {
  try {
    const [franchisee] = await db
      .select()
      .from(franchisees)
      .where(eq(franchisees.id, Number(req.params.id)));
    
    if (!franchisee) {
      return res.status(404).json({ error: "Franchisee not found" });
    }
    
    res.json(franchisee);
  } catch (error) {
    logger.error("Error fetching franchisee:", error);
    res.status(500).json({ error: "Failed to fetch franchisee" });
  }
});

// Create franchisee
router.post("/franchisees", requireAdmin, async (req, res) => {
  try {
    const validation = insertFranchiseeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [newFranchisee] = await db.insert(franchisees).values(validation.data).returning();
    res.json(newFranchisee);
  } catch (error) {
    logger.error("Error creating franchisee:", error);
    res.status(500).json({ error: "Failed to create franchisee" });
  }
});

// Update franchisee
router.put("/franchisees/:id", requireAdmin, async (req, res) => {
  try {
    const validation = insertFranchiseeSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [updated] = await db
      .update(franchisees)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(eq(franchisees.id, Number(req.params.id)))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Franchisee not found" });
    }
    
    res.json(updated);
  } catch (error) {
    logger.error("Error updating franchisee:", error);
    res.status(500).json({ error: "Failed to update franchisee" });
  }
});

// =================== STATION MANAGEMENT ===================

// Get all stations
router.get("/stations", requireAdmin, async (req, res) => {
  try {
    const { franchiseeId, territoryId, countryId, status, healthStatus } = req.query;
    
    const conditions = [];
    if (franchiseeId) conditions.push(eq(petWashStations.franchiseeId, Number(franchiseeId)));
    if (territoryId) conditions.push(eq(petWashStations.territoryId, Number(territoryId)));
    if (countryId) conditions.push(eq(petWashStations.countryId, Number(countryId)));
    if (status) conditions.push(eq(petWashStations.operationalStatus, status as string));
    if (healthStatus) conditions.push(eq(petWashStations.healthStatus, healthStatus as string));
    
    const stations = conditions.length > 0
      ? await db.select().from(petWashStations).where(and(...conditions)).orderBy(petWashStations.stationCode)
      : await db.select().from(petWashStations).orderBy(petWashStations.stationCode);
    
    res.json(stations);
  } catch (error) {
    logger.error("Error fetching stations:", error);
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});

// Get single station with full details
router.get("/stations/:id", requireAdmin, async (req, res) => {
  try {
    const [station] = await db
      .select()
      .from(petWashStations)
      .where(eq(petWashStations.id, Number(req.params.id)));
    
    if (!station) {
      return res.status(404).json({ error: "Station not found" });
    }
    
    // Get related data
    const [bills, assets, alerts, latestTelemetry] = await Promise.all([
      db.select().from(stationBills)
        .where(eq(stationBills.stationId, station.id))
        .orderBy(desc(stationBills.dueDate))
        .limit(10),
      db.select().from(stationAssets)
        .where(eq(stationAssets.stationId, station.id))
        .orderBy(stationAssets.assetType),
      db.select().from(stationAlerts)
        .where(and(
          eq(stationAlerts.stationId, station.id),
          eq(stationAlerts.status, 'open')
        ))
        .orderBy(desc(stationAlerts.triggeredAt)),
      db.select().from(stationTelemetry)
        .where(eq(stationTelemetry.stationId, station.id))
        .orderBy(desc(stationTelemetry.recordedAt))
        .limit(1)
    ]);
    
    res.json({
      ...station,
      bills,
      assets,
      alerts,
      latestTelemetry: latestTelemetry[0] || null
    });
  } catch (error) {
    logger.error("Error fetching station details:", error);
    res.status(500).json({ error: "Failed to fetch station details" });
  }
});

// Create station
router.post("/stations", requireAdmin, async (req, res) => {
  try {
    const validation = insertPetWashStationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [newStation] = await db.insert(petWashStations).values(validation.data).returning();
    res.json(newStation);
  } catch (error) {
    logger.error("Error creating station:", error);
    res.status(500).json({ error: "Failed to create station" });
  }
});

// Update station
router.put("/stations/:id", requireAdmin, async (req, res) => {
  try {
    const validation = insertPetWashStationSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [updated] = await db
      .update(petWashStations)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(eq(petWashStations.id, Number(req.params.id)))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Station not found" });
    }
    
    res.json(updated);
  } catch (error) {
    logger.error("Error updating station:", error);
    res.status(500).json({ error: "Failed to update station" });
  }
});

// =================== STATION BILLS ===================

// Get station bills
router.get("/stations/:id/bills", requireAdmin, async (req, res) => {
  try {
    const { status, billType, fromDate, toDate } = req.query;
    let query = db.select().from(stationBills)
      .where(eq(stationBills.stationId, Number(req.params.id)));
    
    const bills = await query.orderBy(desc(stationBills.dueDate));
    res.json(bills);
  } catch (error) {
    logger.error("Error fetching station bills:", error);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

// Create bill
router.post("/stations/:id/bills", requireAdmin, async (req, res) => {
  try {
    const validation = insertStationBillSchema.safeParse({
      ...req.body,
      stationId: Number(req.params.id)
    });
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [newBill] = await db.insert(stationBills).values(validation.data).returning();
    res.json(newBill);
  } catch (error) {
    logger.error("Error creating bill:", error);
    res.status(500).json({ error: "Failed to create bill" });
  }
});

// Update bill
router.put("/bills/:id", requireAdmin, async (req, res) => {
  try {
    const validation = insertStationBillSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [updated] = await db
      .update(stationBills)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(eq(stationBills.id, Number(req.params.id)))
      .returning();
    
    res.json(updated);
  } catch (error) {
    logger.error("Error updating bill:", error);
    res.status(500).json({ error: "Failed to update bill" });
  }
});

// =================== STATION ASSETS ===================

// Get station assets
router.get("/stations/:id/assets", requireAdmin, async (req, res) => {
  try {
    const assets = await db.select().from(stationAssets)
      .where(eq(stationAssets.stationId, Number(req.params.id)))
      .orderBy(stationAssets.assetType);
    res.json(assets);
  } catch (error) {
    logger.error("Error fetching assets:", error);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

// Create asset
router.post("/stations/:id/assets", requireAdmin, async (req, res) => {
  try {
    const validation = insertStationAssetSchema.safeParse({
      ...req.body,
      stationId: Number(req.params.id)
    });
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [newAsset] = await db.insert(stationAssets).values(validation.data).returning();
    res.json(newAsset);
  } catch (error) {
    logger.error("Error creating asset:", error);
    res.status(500).json({ error: "Failed to create asset" });
  }
});

// Update asset
router.put("/assets/:id", requireAdmin, async (req, res) => {
  try {
    const validation = insertStationAssetSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [updated] = await db
      .update(stationAssets)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(eq(stationAssets.id, Number(req.params.id)))
      .returning();
    
    res.json(updated);
  } catch (error) {
    logger.error("Error updating asset:", error);
    res.status(500).json({ error: "Failed to update asset" });
  }
});

// =================== SPARE PARTS INVENTORY ===================

// Get all spare parts
router.get("/spare-parts", requireAdmin, async (req, res) => {
  try {
    const { category, lowStock } = req.query;
    
    const parts = category
      ? await db.select().from(spareParts).where(eq(spareParts.category, category as string)).orderBy(spareParts.partName)
      : await db.select().from(spareParts).orderBy(spareParts.partName);
    
    // Filter low stock items if requested
    if (lowStock === 'true') {
      const filtered = parts.filter(p => 
        (p.quantityInStock || 0) <= (p.reorderPoint || 0)
      );
      return res.json(filtered);
    }
    
    res.json(parts);
  } catch (error) {
    logger.error("Error fetching spare parts:", error);
    res.status(500).json({ error: "Failed to fetch spare parts" });
  }
});

// Create spare part
router.post("/spare-parts", requireAdmin, async (req, res) => {
  try {
    const validation = insertSparePartSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [newPart] = await db.insert(spareParts).values(validation.data).returning();
    res.json(newPart);
  } catch (error) {
    logger.error("Error creating spare part:", error);
    res.status(500).json({ error: "Failed to create spare part" });
  }
});

// Update spare part
router.put("/spare-parts/:id", requireAdmin, async (req, res) => {
  try {
    const validation = insertSparePartSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const data = validation.data;
    const [updated] = await db
      .update(spareParts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(spareParts.id, Number(req.params.id)))
      .returning();
    
    res.json(updated);
  } catch (error) {
    logger.error("Error updating spare part:", error);
    res.status(500).json({ error: "Failed to update spare part" });
  }
});

// Get station spare parts
router.get("/stations/:id/spare-parts", requireAdmin, async (req, res) => {
  try {
    const stationParts = await db
      .select({
        id: stationSpareParts.id,
        quantity: stationSpareParts.quantity,
        minimumQuantity: stationSpareParts.minimumQuantity,
        storageLocation: stationSpareParts.storageLocation,
        partNumber: spareParts.partNumber,
        partName: spareParts.partName,
        category: spareParts.category,
        unitCost: spareParts.unitCost
      })
      .from(stationSpareParts)
      .innerJoin(spareParts, eq(stationSpareParts.sparePartId, spareParts.id))
      .where(eq(stationSpareParts.stationId, Number(req.params.id)));
    
    res.json(stationParts);
  } catch (error) {
    logger.error("Error fetching station spare parts:", error);
    res.status(500).json({ error: "Failed to fetch station spare parts" });
  }
});

// =================== MAINTENANCE & WORK ORDERS ===================

// Get work orders
router.get("/work-orders", requireAdmin, async (req, res) => {
  try {
    const { stationId, status, priority, technicianId } = req.query;
    
    const conditions = [];
    if (stationId) conditions.push(eq(maintenanceWorkOrders.stationId, Number(stationId)));
    if (status) conditions.push(eq(maintenanceWorkOrders.status, status as string));
    if (priority) conditions.push(eq(maintenanceWorkOrders.priority, priority as string));
    if (technicianId) conditions.push(eq(maintenanceWorkOrders.assignedToTechnicianId, technicianId as string));
    
    const orders = conditions.length > 0
      ? await db.select().from(maintenanceWorkOrders).where(and(...conditions)).orderBy(desc(maintenanceWorkOrders.requestedDate))
      : await db.select().from(maintenanceWorkOrders).orderBy(desc(maintenanceWorkOrders.requestedDate));
    
    res.json(orders);
  } catch (error) {
    logger.error("Error fetching work orders:", error);
    res.status(500).json({ error: "Failed to fetch work orders" });
  }
});

// Create work order
router.post("/work-orders", requireAdmin, async (req, res) => {
  try {
    const validation = insertMaintenanceWorkOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [newOrder] = await db.insert(maintenanceWorkOrders).values(validation.data).returning();
    res.json(newOrder);
  } catch (error) {
    logger.error("Error creating work order:", error);
    res.status(500).json({ error: "Failed to create work order" });
  }
});

// Update work order
router.put("/work-orders/:id", requireAdmin, async (req, res) => {
  try {
    const validation = insertMaintenanceWorkOrderSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }
    
    const [updated] = await db
      .update(maintenanceWorkOrders)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(eq(maintenanceWorkOrders.id, Number(req.params.id)))
      .returning();
    
    res.json(updated);
  } catch (error) {
    logger.error("Error updating work order:", error);
    res.status(500).json({ error: "Failed to update work order" });
  }
});

// =================== ANALYTICS & DASHBOARDS ===================

// HQ Global Analytics
router.get("/analytics/global", requireAdmin, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    // Get global stats
    const [stationStats] = await db
      .select({
        totalStations: count(),
        activeStations: sql<number>`count(*) filter (where ${petWashStations.operationalStatus} = 'active')`,
        offlineStations: sql<number>`count(*) filter (where ${petWashStations.healthStatus} = 'offline')`,
        maintenanceStations: sql<number>`count(*) filter (where ${petWashStations.operationalStatus} = 'maintenance')`
      })
      .from(petWashStations);
    
    // Get franchisee stats
    const [franchiseeStats] = await db
      .select({
        totalFranchisees: count(),
        activeFranchisees: sql<number>`count(*) filter (where ${franchisees.status} = 'active')`
      })
      .from(franchisees);
    
    // Get bill stats
    const [billStats] = await db
      .select({
        totalUnpaid: count(),
        totalOverdue: sql<number>`count(*) filter (where ${stationBills.status} = 'overdue')`,
        totalAmount: sum(stationBills.totalAmount)
      })
      .from(stationBills)
      .where(eq(stationBills.status, 'unpaid'));
    
    // Get open alerts
    const [alertStats] = await db
      .select({
        totalAlerts: count(),
        criticalAlerts: sql<number>`count(*) filter (where ${stationAlerts.severity} = 'critical')`,
        warningAlerts: sql<number>`count(*) filter (where ${stationAlerts.severity} = 'warning')`
      })
      .from(stationAlerts)
      .where(eq(stationAlerts.status, 'open'));
    
    // Get work order stats
    const [workOrderStats] = await db
      .select({
        totalPending: sql<number>`count(*) filter (where ${maintenanceWorkOrders.status} = 'pending')`,
        totalInProgress: sql<number>`count(*) filter (where ${maintenanceWorkOrders.status} = 'in_progress')`,
        totalCompleted: sql<number>`count(*) filter (where ${maintenanceWorkOrders.status} = 'completed')`
      })
      .from(maintenanceWorkOrders);
    
    res.json({
      stations: stationStats,
      franchisees: franchiseeStats,
      bills: billStats,
      alerts: alertStats,
      workOrders: workOrderStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error fetching global analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// Franchisee-specific analytics
router.get("/analytics/franchisee/:id", requireAdmin, async (req, res) => {
  try {
    const franchiseeId = Number(req.params.id);
    
    // Get franchisee's stations
    const stations = await db
      .select()
      .from(petWashStations)
      .where(eq(petWashStations.franchiseeId, franchiseeId));
    
    const stationIds = stations.map(s => s.id);
    
    if (stationIds.length === 0) {
      return res.json({
        stations: [],
        totalRevenue: 0,
        totalBills: 0,
        openAlerts: 0
      });
    }
    
    // Get aggregated data for all stations
    const bills = await db
      .select()
      .from(stationBills)
      .where(sql`${stationBills.stationId} = ANY(${stationIds})`);
    
    const alerts = await db
      .select()
      .from(stationAlerts)
      .where(
        and(
          sql`${stationAlerts.stationId} = ANY(${stationIds})`,
          eq(stationAlerts.status, 'open')
        )
      );
    
    res.json({
      stations,
      totalBills: bills.length,
      unpaidBills: bills.filter(b => b.status === 'unpaid').length,
      openAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length
    });
  } catch (error) {
    logger.error("Error fetching franchisee analytics:", error);
    res.status(500).json({ error: "Failed to fetch franchisee analytics" });
  }
});

// Station map data (for global map view)
router.get("/stations/map", requireAdmin, async (req, res) => {
  try {
    const stations = await db
      .select({
        id: petWashStations.id,
        stationCode: petWashStations.stationCode,
        stationName: petWashStations.stationName,
        latitude: petWashStations.latitude,
        longitude: petWashStations.longitude,
        operationalStatus: petWashStations.operationalStatus,
        healthStatus: petWashStations.healthStatus,
        city: petWashStations.city,
        franchiseeId: petWashStations.franchiseeId
      })
      .from(petWashStations);
    
    res.json(stations);
  } catch (error) {
    logger.error("Error fetching station map data:", error);
    res.status(500).json({ error: "Failed to fetch map data" });
  }
});

export default router;
