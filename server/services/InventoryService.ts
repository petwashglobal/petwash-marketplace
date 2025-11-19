import { db } from '../db';
import { 
  supplies, 
  stationSupplies, 
  inventoryRefills,
  stations,
  type Supply,
  type InsertSupply,
  type StationSupply,
  type InsertStationSupply,
  type InventoryRefill,
} from '@shared/schema';
import { eq, and, or, desc, lt, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { eventPublisher } from './EventPublisher';
import { DomainEventType } from '@shared/events';

export class InventoryService {
  /**
   * Create a new supply in the master catalog
   */
  async createSupply(supply: InsertSupply): Promise<Supply> {
    try {
      const [newSupply] = await db
        .insert(supplies)
        .values(supply)
        .returning();

      logger.info('[InventoryService] Supply created', {
        supplyId: newSupply.id,
        sku: newSupply.sku,
        name: newSupply.name,
      });

      return newSupply;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to create supply', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Update an existing supply
   */
  async updateSupply(supplyId: number, updates: Partial<InsertSupply>): Promise<Supply> {
    try {
      const [updatedSupply] = await db
        .update(supplies)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(supplies.id, supplyId))
        .returning();

      if (!updatedSupply) {
        throw new Error(`Supply not found: ${supplyId}`);
      }

      logger.info('[InventoryService] Supply updated', {
        supplyId: updatedSupply.id,
        updates,
      });

      return updatedSupply;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to update supply', {
        supplyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List supplies with optional filters
   */
  async listSupplies(filters?: {
    category?: string;
    isActive?: boolean;
  }): Promise<Supply[]> {
    try {
      let query = db.select().from(supplies);

      const conditions = [];
      
      if (filters?.category) {
        conditions.push(eq(supplies.category, filters.category));
      }
      
      if (filters?.isActive !== undefined) {
        conditions.push(eq(supplies.isActive, filters.isActive));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query;

      logger.info('[InventoryService] Supplies listed', {
        count: results.length,
        filters,
      });

      return results;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to list supplies', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add a supply to a station with initial level
   */
  async addStationSupply(
    stationId: number,
    supplyId: number,
    initialLevel: number = 0
  ): Promise<StationSupply> {
    try {
      // Verify supply exists
      const [supply] = await db
        .select()
        .from(supplies)
        .where(eq(supplies.id, supplyId))
        .limit(1);

      if (!supply) {
        throw new Error(`Supply not found: ${supplyId}`);
      }

      // Check if already exists
      const existing = await db
        .select()
        .from(stationSupplies)
        .where(
          and(
            eq(stationSupplies.stationId, stationId),
            eq(stationSupplies.supplyId, supplyId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new Error(`Supply already assigned to station`);
      }

      const [stationSupply] = await db
        .insert(stationSupplies)
        .values({
          stationId,
          supplyId,
          currentLevel: initialLevel,
          reorderThreshold: supply.reorderThreshold,
        })
        .returning();

      logger.info('[InventoryService] Supply added to station', {
        stationSupplyId: stationSupply.id,
        stationId,
        supplyId,
        initialLevel,
      });

      // Check if low stock
      await this.checkLowStock(stationId);

      return stationSupply;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to add station supply', {
        stationId,
        supplyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update station supply level (manual adjustment)
   */
  async updateStationSupplyLevel(
    stationSupplyId: number,
    newLevel: number,
    userId: string
  ): Promise<StationSupply> {
    try {
      const [current] = await db
        .select()
        .from(stationSupplies)
        .where(eq(stationSupplies.id, stationSupplyId))
        .limit(1);

      if (!current) {
        throw new Error(`Station supply not found: ${stationSupplyId}`);
      }

      const [updated] = await db
        .update(stationSupplies)
        .set({
          currentLevel: newLevel,
          updatedAt: new Date(),
        })
        .where(eq(stationSupplies.id, stationSupplyId))
        .returning();

      logger.info('[InventoryService] Station supply level updated', {
        stationSupplyId,
        previousLevel: current.currentLevel,
        newLevel,
        userId,
      });

      // Check if low stock after update
      await this.checkLowStock(current.stationId);

      return updated;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to update station supply level', {
        stationSupplyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Record a refill and update stock levels
   */
  async refillStationSupply(
    stationSupplyId: number,
    amount: number,
    userId: string,
    notes?: string
  ): Promise<InventoryRefill> {
    try {
      // Get current station supply
      const [stationSupply] = await db
        .select()
        .from(stationSupplies)
        .where(eq(stationSupplies.id, stationSupplyId))
        .limit(1);

      if (!stationSupply) {
        throw new Error(`Station supply not found: ${stationSupplyId}`);
      }

      // Get supply details for event
      const [supply] = await db
        .select()
        .from(supplies)
        .where(eq(supplies.id, stationSupply.supplyId))
        .limit(1);

      // Get station details for event
      const [station] = await db
        .select()
        .from(stations)
        .where(eq(stations.id, stationSupply.stationId))
        .limit(1);

      const previousLevel = stationSupply.currentLevel || 0;
      const newLevel = previousLevel + amount;

      // Record refill
      const [refill] = await db
        .insert(inventoryRefills)
        .values({
          stationSupplyId,
          amount,
          previousLevel,
          newLevel,
          refilledByUserId: userId,
          notes: notes || null,
        })
        .returning();

      // Update station supply
      await db
        .update(stationSupplies)
        .set({
          currentLevel: newLevel,
          lastRefillAt: new Date(),
          lastRefillAmount: amount,
          lastRefillByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(stationSupplies.id, stationSupplyId));

      logger.info('[InventoryService] Inventory refilled', {
        stationSupplyId,
        amount,
        previousLevel,
        newLevel,
        userId,
      });

      // Emit INVENTORY_REFILLED event
      await eventPublisher.publishEvent(
        DomainEventType.INVENTORY_REFILLED,
        {
          stationSupplyId,
          stationId: station?.stationCode || `${stationSupply.stationId}`,
          supplyName: supply?.name || 'Unknown Supply',
          previousLevel,
          newLevel,
          amount,
          refilledBy: userId,
        },
        {
          aggregateType: 'station_supply',
          aggregateId: `${stationSupplyId}`,
          userId,
        }
      );

      return refill;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to refill station supply', {
        stationSupplyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all inventory for a station
   */
  async getStationInventory(stationId: number): Promise<any[]> {
    try {
      const inventory = await db
        .select({
          id: stationSupplies.id,
          stationId: stationSupplies.stationId,
          supplyId: stationSupplies.supplyId,
          currentLevel: stationSupplies.currentLevel,
          reorderThreshold: stationSupplies.reorderThreshold,
          lastRefillAt: stationSupplies.lastRefillAt,
          lastRefillAmount: stationSupplies.lastRefillAmount,
          lastRefillByUserId: stationSupplies.lastRefillByUserId,
          supply: {
            id: supplies.id,
            sku: supplies.sku,
            name: supplies.name,
            category: supplies.category,
            unitType: supplies.unitType,
            unitCost: supplies.unitCost,
            supplier: supplies.supplier,
          },
        })
        .from(stationSupplies)
        .leftJoin(supplies, eq(stationSupplies.supplyId, supplies.id))
        .where(eq(stationSupplies.stationId, stationId));

      logger.info('[InventoryService] Station inventory retrieved', {
        stationId,
        itemCount: inventory.length,
      });

      return inventory;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to get station inventory', {
        stationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all stations with low stock items
   */
  async getLowStockStations(): Promise<any[]> {
    try {
      const lowStockItems = await db
        .select({
          stationSupplyId: stationSupplies.id,
          stationId: stationSupplies.stationId,
          currentLevel: stationSupplies.currentLevel,
          reorderThreshold: stationSupplies.reorderThreshold,
          stationCode: stations.stationCode,
          stationName: stations.name,
          supply: {
            id: supplies.id,
            sku: supplies.sku,
            name: supplies.name,
            category: supplies.category,
            unitType: supplies.unitType,
          },
        })
        .from(stationSupplies)
        .leftJoin(supplies, eq(stationSupplies.supplyId, supplies.id))
        .leftJoin(stations, eq(stationSupplies.stationId, stations.id))
        .where(
          sql`${stationSupplies.currentLevel} < COALESCE(${stationSupplies.reorderThreshold}, ${supplies.reorderThreshold}, 10)`
        );

      logger.info('[InventoryService] Low stock stations retrieved', {
        count: lowStockItems.length,
      });

      return lowStockItems;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to get low stock stations', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if a station has low stock and emit events
   */
  async checkLowStock(stationId: number): Promise<void> {
    try {
      const lowStockItems = await db
        .select({
          stationSupplyId: stationSupplies.id,
          currentLevel: stationSupplies.currentLevel,
          reorderThreshold: stationSupplies.reorderThreshold,
          supply: {
            name: supplies.name,
            category: supplies.category,
          },
        })
        .from(stationSupplies)
        .leftJoin(supplies, eq(stationSupplies.supplyId, supplies.id))
        .where(
          and(
            eq(stationSupplies.stationId, stationId),
            sql`${stationSupplies.currentLevel} < COALESCE(${stationSupplies.reorderThreshold}, ${supplies.reorderThreshold}, 10)`
          )
        );

      // Get station details
      const [station] = await db
        .select()
        .from(stations)
        .where(eq(stations.id, stationId))
        .limit(1);

      // Emit INVENTORY_LOW event for each low stock item
      for (const item of lowStockItems) {
        await eventPublisher.publishEvent(
          DomainEventType.INVENTORY_LOW,
          {
            stationId: station?.stationCode || `${stationId}`,
            itemType: item.supply?.name || 'Unknown',
            currentLevel: item.currentLevel || 0,
            threshold: item.reorderThreshold || 10,
          },
          {
            aggregateType: 'station',
            aggregateId: `${stationId}`,
          }
        );
      }

      if (lowStockItems.length > 0) {
        logger.warn('[InventoryService] Low stock items detected', {
          stationId,
          count: lowStockItems.length,
        });
      }
    } catch (error: any) {
      logger.error('[InventoryService] Failed to check low stock', {
        stationId,
        error: error.message,
      });
    }
  }

  /**
   * Generate purchase order for low stock items
   */
  async generatePurchaseOrder(stationIds?: number[]): Promise<any> {
    try {
      let query = db
        .select({
          stationId: stationSupplies.stationId,
          stationCode: stations.stationCode,
          stationName: stations.name,
          supplyId: supplies.id,
          sku: supplies.sku,
          name: supplies.name,
          category: supplies.category,
          unitType: supplies.unitType,
          unitCost: supplies.unitCost,
          supplier: supplies.supplier,
          currentLevel: stationSupplies.currentLevel,
          reorderThreshold: stationSupplies.reorderThreshold,
        })
        .from(stationSupplies)
        .leftJoin(supplies, eq(stationSupplies.supplyId, supplies.id))
        .leftJoin(stations, eq(stationSupplies.stationId, stations.id))
        .where(
          sql`${stationSupplies.currentLevel} < COALESCE(${stationSupplies.reorderThreshold}, ${supplies.reorderThreshold}, 10)`
        );

      if (stationIds && stationIds.length > 0) {
        query = query.where(
          and(
            sql`${stationSupplies.currentLevel} < COALESCE(${stationSupplies.reorderThreshold}, ${supplies.reorderThreshold}, 10)`,
            sql`${stationSupplies.stationId} IN (${sql.join(stationIds.map(id => sql`${id}`), sql`, `)})`
          )
        ) as any;
      }

      const items = await query;

      // Group by supplier
      const groupedBySupplier = items.reduce((acc: any, item) => {
        const supplier = item.supplier || 'Unknown Supplier';
        if (!acc[supplier]) {
          acc[supplier] = [];
        }
        acc[supplier].push({
          ...item,
          quantityNeeded: (item.reorderThreshold || 10) - (item.currentLevel || 0),
        });
        return acc;
      }, {});

      const purchaseOrder = {
        generatedAt: new Date().toISOString(),
        totalSuppliers: Object.keys(groupedBySupplier).length,
        totalItems: items.length,
        suppliers: groupedBySupplier,
      };

      logger.info('[InventoryService] Purchase order generated', {
        totalSuppliers: purchaseOrder.totalSuppliers,
        totalItems: purchaseOrder.totalItems,
        stationIds,
      });

      return purchaseOrder;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to generate purchase order', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get inventory dashboard analytics
   */
  async getInventoryDashboard(): Promise<any> {
    try {
      // Total supplies in catalog
      const totalSupplies = await db
        .select({ count: sql<number>`count(*)` })
        .from(supplies)
        .where(eq(supplies.isActive, true));

      // Total station supplies
      const totalStationSupplies = await db
        .select({ count: sql<number>`count(*)` })
        .from(stationSupplies);

      // Low stock items
      const lowStockCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(stationSupplies)
        .leftJoin(supplies, eq(stationSupplies.supplyId, supplies.id))
        .where(
          sql`${stationSupplies.currentLevel} < COALESCE(${stationSupplies.reorderThreshold}, ${supplies.reorderThreshold}, 10)`
        );

      // Recent refills
      const recentRefills = await db
        .select()
        .from(inventoryRefills)
        .orderBy(desc(inventoryRefills.refilledAt))
        .limit(10);

      const dashboard = {
        totalSupplies: totalSupplies[0]?.count || 0,
        totalStationSupplies: totalStationSupplies[0]?.count || 0,
        lowStockCount: lowStockCount[0]?.count || 0,
        recentRefills,
      };

      logger.info('[InventoryService] Dashboard retrieved', dashboard);

      return dashboard;
    } catch (error: any) {
      logger.error('[InventoryService] Failed to get inventory dashboard', {
        error: error.message,
      });
      throw error;
    }
  }
}

export const inventoryService = new InventoryService();
