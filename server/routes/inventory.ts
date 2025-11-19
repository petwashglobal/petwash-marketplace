import express from 'express';
import { requireAuth } from '../customAuth';
import { requireAdmin } from '../adminAuth';
import { inventoryService } from '../services/InventoryService';
import { 
  insertSupplySchema, 
  updateSupplySchema,
  insertStationSupplySchema,
  insertInventoryRefillSchema,
} from '@shared/schema';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router = express.Router();

/**
 * POST /api/inventory/supplies
 * Create a new supply in the master catalog
 * Requires admin authentication
 */
router.post('/supplies', requireAdmin, async (req, res) => {
  try {
    const validatedData = insertSupplySchema.parse(req.body);
    
    const supply = await inventoryService.createSupply(validatedData);
    
    res.json(supply);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to create supply', {
      error: error.message,
      body: req.body,
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to create supply' });
  }
});

/**
 * GET /api/inventory/supplies
 * List all supplies with optional filters
 * Requires authentication
 */
router.get('/supplies', requireAuth, async (req, res) => {
  try {
    const filters: any = {};
    
    if (req.query.category) {
      filters.category = req.query.category as string;
    }
    
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    
    const supplies = await inventoryService.listSupplies(filters);
    
    res.json(supplies);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to list supplies', {
      error: error.message,
      query: req.query,
    });
    
    res.status(500).json({ error: 'Failed to list supplies' });
  }
});

/**
 * GET /api/inventory/supplies/:id
 * Get supply details by ID
 * Requires authentication
 */
router.get('/supplies/:id', requireAuth, async (req, res) => {
  try {
    const supplyId = parseInt(req.params.id);
    
    if (isNaN(supplyId)) {
      return res.status(400).json({ error: 'Invalid supply ID' });
    }
    
    const supplies = await inventoryService.listSupplies();
    const supply = supplies.find(s => s.id === supplyId);
    
    if (!supply) {
      return res.status(404).json({ error: 'Supply not found' });
    }
    
    res.json(supply);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to get supply', {
      error: error.message,
      supplyId: req.params.id,
    });
    
    res.status(500).json({ error: 'Failed to get supply' });
  }
});

/**
 * PATCH /api/inventory/supplies/:id
 * Update a supply
 * Requires admin authentication
 */
router.patch('/supplies/:id', requireAdmin, async (req, res) => {
  try {
    const supplyId = parseInt(req.params.id);
    
    if (isNaN(supplyId)) {
      return res.status(400).json({ error: 'Invalid supply ID' });
    }
    
    const validatedData = updateSupplySchema.parse(req.body);
    
    const updatedSupply = await inventoryService.updateSupply(supplyId, validatedData);
    
    res.json(updatedSupply);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to update supply', {
      error: error.message,
      supplyId: req.params.id,
      body: req.body,
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update supply' });
  }
});

/**
 * POST /api/inventory/station/:stationId/supplies
 * Add a supply to a station
 * Requires admin authentication
 */
router.post('/station/:stationId/supplies', requireAdmin, async (req, res) => {
  try {
    const stationId = parseInt(req.params.stationId);
    
    if (isNaN(stationId)) {
      return res.status(400).json({ error: 'Invalid station ID' });
    }
    
    const schema = z.object({
      supplyId: z.number(),
      initialLevel: z.number().min(0).optional(),
    });
    
    const { supplyId, initialLevel } = schema.parse(req.body);
    
    const stationSupply = await inventoryService.addStationSupply(
      stationId,
      supplyId,
      initialLevel
    );
    
    res.json(stationSupply);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to add station supply', {
      error: error.message,
      stationId: req.params.stationId,
      body: req.body,
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    if (error.message.includes('not found') || error.message.includes('already assigned')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to add station supply' });
  }
});

/**
 * GET /api/inventory/station/:stationId/supplies
 * Get all supplies for a station
 * Requires authentication
 */
router.get('/station/:stationId/supplies', requireAuth, async (req, res) => {
  try {
    const stationId = parseInt(req.params.stationId);
    
    if (isNaN(stationId)) {
      return res.status(400).json({ error: 'Invalid station ID' });
    }
    
    const inventory = await inventoryService.getStationInventory(stationId);
    
    res.json(inventory);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to get station inventory', {
      error: error.message,
      stationId: req.params.stationId,
    });
    
    res.status(500).json({ error: 'Failed to get station inventory' });
  }
});

/**
 * PATCH /api/inventory/station-supplies/:id/level
 * Update station supply level (manual adjustment)
 * Requires admin authentication
 */
router.patch('/station-supplies/:id/level', requireAdmin, async (req, res) => {
  try {
    const stationSupplyId = parseInt(req.params.id);
    
    if (isNaN(stationSupplyId)) {
      return res.status(400).json({ error: 'Invalid station supply ID' });
    }
    
    const schema = z.object({
      newLevel: z.number().min(0),
    });
    
    const { newLevel } = schema.parse(req.body);
    const userId = (req as any).userId || 'system';
    
    const updated = await inventoryService.updateStationSupplyLevel(
      stationSupplyId,
      newLevel,
      userId
    );
    
    res.json(updated);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to update station supply level', {
      error: error.message,
      stationSupplyId: req.params.id,
      body: req.body,
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update station supply level' });
  }
});

/**
 * POST /api/inventory/station-supplies/:id/refill
 * Record a refill for a station supply
 * Requires admin authentication
 */
router.post('/station-supplies/:id/refill', requireAdmin, async (req, res) => {
  try {
    const stationSupplyId = parseInt(req.params.id);
    
    if (isNaN(stationSupplyId)) {
      return res.status(400).json({ error: 'Invalid station supply ID' });
    }
    
    const schema = z.object({
      amount: z.number().min(1),
      notes: z.string().max(1000).optional(),
    });
    
    const { amount, notes } = schema.parse(req.body);
    const userId = (req as any).userId || 'system';
    
    const refill = await inventoryService.refillStationSupply(
      stationSupplyId,
      amount,
      userId,
      notes
    );
    
    res.json(refill);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to refill station supply', {
      error: error.message,
      stationSupplyId: req.params.id,
      body: req.body,
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to refill station supply' });
  }
});

/**
 * GET /api/inventory/low-stock
 * Get all stations with low stock items
 * Requires admin authentication
 */
router.get('/low-stock', requireAdmin, async (req, res) => {
  try {
    const lowStockStations = await inventoryService.getLowStockStations();
    
    res.json(lowStockStations);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to get low stock stations', {
      error: error.message,
    });
    
    res.status(500).json({ error: 'Failed to get low stock stations' });
  }
});

/**
 * GET /api/inventory/dashboard
 * Get inventory analytics dashboard
 * Requires admin authentication
 */
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const dashboard = await inventoryService.getInventoryDashboard();
    
    res.json(dashboard);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to get inventory dashboard', {
      error: error.message,
    });
    
    res.status(500).json({ error: 'Failed to get inventory dashboard' });
  }
});

/**
 * GET /api/inventory/purchase-order
 * Generate purchase order for low stock items
 * Requires admin authentication
 * Query params: stationIds (optional comma-separated list)
 */
router.get('/purchase-order', requireAdmin, async (req, res) => {
  try {
    let stationIds: number[] | undefined;
    
    if (req.query.stationIds) {
      const idsString = req.query.stationIds as string;
      stationIds = idsString.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }
    
    const purchaseOrder = await inventoryService.generatePurchaseOrder(stationIds);
    
    res.json(purchaseOrder);
  } catch (error: any) {
    logger.error('[Inventory Routes] Failed to generate purchase order', {
      error: error.message,
      query: req.query,
    });
    
    res.status(500).json({ error: 'Failed to generate purchase order' });
  }
});

export default router;
