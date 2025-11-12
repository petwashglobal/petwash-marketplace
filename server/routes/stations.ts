// Stations Management API Routes
// Handles stations registry, inventory, alerts, and analytics

import { Router, Request, Response } from 'express';
import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { requireAdmin } from '../adminAuth';
import { 
  stationSchema, 
  insertStationSchema,
  stationInventorySchema,
  insertStationEventSchema,
  FIRESTORE_PATHS,
  type Station,
  type StationInventory,
  type StationEvent,
} from '@shared/firestore-schema';
import { nanoid } from 'nanoid';

const router = Router();

// ============================================
// STATION CRUD OPERATIONS
// ============================================

// GET /api/admin/stations - List all stations with filters
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, city, search } = req.query;
    
    let query = db.collection('stations');
    
    // Apply filters
    if (status && typeof status === 'string') {
      query = query.where('status', '==', status) as any;
    }
    if (city && typeof city === 'string') {
      query = query.where('address.city', '==', city) as any;
    }
    
    const snapshot = await query.get();
    let stations: any[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      openedAt: doc.data().openedAt?.toDate(),
    }));
    
    // Client-side search filter for serialNumber or name
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      stations = stations.filter(s => 
        s.serialNumber?.toLowerCase().includes(searchLower) ||
        s.name?.toLowerCase().includes(searchLower)
      );
    }
    
    logger.info('[Stations] Listed stations', { 
      count: stations.length, 
      status, 
      city, 
      search 
    });
    
    res.json({ stations });
  } catch (error) {
    logger.error('[Stations] Error listing stations', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

// GET /api/admin/stations/:id - Get station details with inventory (subcollection format)
router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Fetch station
    const stationDoc = await db.collection('stations').doc(id).get();
    if (!stationDoc.exists) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    const stationData = stationDoc.data();
    const station = {
      id: stationDoc.id,
      ...stationData,
      createdAt: stationData?.createdAt?.toDate(),
      updatedAt: stationData?.updatedAt?.toDate(),
      openedAt: stationData?.openedAt?.toDate(),
      utilities: {
        ...stationData?.utilities,
        insurance: stationData?.utilities?.insurance ? {
          ...stationData.utilities.insurance,
          renewalDate: stationData.utilities.insurance.renewalDate?.toDate?.()?.toISOString() || stationData.utilities.insurance.renewalDate,
        } : undefined,
        electricity: stationData?.utilities?.electricity,
        water: stationData?.utilities?.water,
        council: stationData?.utilities?.council,
      },
    };
    
    // Fetch inventory from subcollection (stations/{id}/inventory/{sku})
    const inventorySnapshot = await db.collection('stations').doc(id).collection('inventory').get();
    const inventory: Record<string, any> = {};
    
    inventorySnapshot.docs.forEach(doc => {
      const data = doc.data();
      inventory[doc.id] = {
        ...data,
        lastRefillAt: data.lastRefillAt?.toDate?.()?.toISOString() || data.lastRefillAt,
      };
    });
    
    // Fetch recent events
    const eventsSnapshot = await db.collection('station_events')
      .where('stationId', '==', id)
      .orderBy('at', 'desc')
      .limit(20)
      .get();
    
    const events = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      at: doc.data().at?.toDate(),
    }));
    
    logger.info('[Stations] Fetched station details', { stationId: id, inventoryCount: Object.keys(inventory).length });
    
    res.json({ station, inventory, events });
  } catch (error) {
    logger.error('[Stations] Error fetching station', error);
    res.status(500).json({ error: 'Failed to fetch station' });
  }
});

// POST /api/admin/stations - Create or update station
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminUid = req.firebaseUser!.uid;
    const { id, ...stationData } = req.body;
    
    // Validate with Zod
    const validationResult = id 
      ? stationSchema.safeParse({ id, ...stationData, updatedBy: adminUid, updatedAt: new Date() })
      : insertStationSchema.safeParse({ ...stationData, createdBy: adminUid, updatedBy: adminUid });
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.errors 
      });
    }
    
    // Check serialNumber uniqueness
    const serialNumber = stationData.serialNumber;
    const existingStations = await db.collection('stations')
      .where('serialNumber', '==', serialNumber)
      .get();
    
    if (!existingStations.empty) {
      const existingDoc = existingStations.docs[0];
      if (!id || existingDoc.id !== id) {
        return res.status(409).json({ 
          error: 'Serial number already exists',
          existingStationId: existingDoc.id 
        });
      }
    }
    
    // Validate Israel address requirements
    if (stationData.address?.country === 'IL') {
      if (!stationData.address.city || !stationData.address.postcode) {
        return res.status(400).json({ 
          error: 'City and postcode are required for Israeli addresses' 
        });
      }
    }
    
    // Validate geo coordinates if provided
    if (stationData.geo) {
      const { lat, lng } = stationData.geo;
      // Israel bounding box: ~29°-33.5°N, ~34°-36°E
      if (lat < 29 || lat > 33.5 || lng < 34 || lng > 36) {
        return res.status(400).json({ 
          error: 'Coordinates must be within Israel' 
        });
      }
    }
    
    const now = new Date();
    const stationId = id || nanoid(20);
    
    const stationDoc = {
      ...stationData,
      ...(id ? {} : { createdBy: adminUid, createdAt: now }),
      updatedBy: adminUid,
      updatedAt: now,
    };
    
    await db.collection('stations').doc(stationId).set(stationDoc, { merge: !!id });
    
    // Log event
    const eventId = nanoid(20);
    await db.collection('station_events').doc(eventId).set({
      id: eventId,
      stationId,
      type: id ? 'status_change' : 'install_completed',
      at: now,
      by: adminUid,
      data: { action: id ? 'updated' : 'created', serialNumber },
    });
    
    logger.info('[Stations] Station saved', { stationId, serialNumber, action: id ? 'update' : 'create' });
    
    res.json({ 
      success: true, 
      stationId,
      message: id ? 'Station updated successfully' : 'Station created successfully'
    });
  } catch (error) {
    logger.error('[Stations] Error saving station', error);
    res.status(500).json({ error: 'Failed to save station' });
  }
});

// PUT /api/admin/stations/:id - Update existing station (alias for POST with id)
router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminUid = req.firebaseUser!.uid;
    const updates = req.body;

    // Verify station exists
    const stationDoc = await db.collection('stations').doc(id).get();
    if (!stationDoc.exists) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Validate required fields if provided
    if (updates.serialNumber) {
      // Check serialNumber uniqueness
      const existingStations = await db.collection('stations')
        .where('serialNumber', '==', updates.serialNumber)
        .get();
      
      if (!existingStations.empty) {
        const existingDoc = existingStations.docs[0];
        if (existingDoc.id !== id) {
          return res.status(409).json({ 
            error: 'Serial number already exists',
            existingStationId: existingDoc.id,
            field: 'serialNumber'
          });
        }
      }
    }

    // Build update object
    const now = new Date();
    const updateDoc: any = {
      ...updates,
      updatedBy: adminUid,
      updatedAt: now,
    };

    // Remove read-only fields if accidentally included
    delete updateDoc.id;
    delete updateDoc.createdBy;
    delete updateDoc.createdAt;

    await db.collection('stations').doc(id).set(updateDoc, { merge: true });

    // Fetch updated station
    const updatedDoc = await db.collection('stations').doc(id).get();
    const station = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data()?.createdAt?.toDate(),
      updatedAt: updatedDoc.data()?.updatedAt?.toDate(),
      openedAt: updatedDoc.data()?.openedAt?.toDate(),
    };

    // Log event
    const eventId = nanoid(20);
    await db.collection('station_events').doc(eventId).set({
      id: eventId,
      stationId: id,
      type: 'status_change',
      at: now,
      by: adminUid,
      data: { action: 'updated', fields: Object.keys(updates) },
    });

    logger.info('[Stations] Station updated via PUT', { stationId: id, fields: Object.keys(updates) });

    res.json({ 
      success: true,
      message: 'Saved ✓',
      station
    });
  } catch (error) {
    logger.error('[Stations] Error updating station', error);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

// POST /api/admin/stations/:id/note - Add note to station
router.post('/:id/note', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const adminUid = req.firebaseUser!.uid;
    
    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      return res.status(400).json({ error: 'Note text is required' });
    }
    
    // Verify station exists
    const stationDoc = await db.collection('stations').doc(id).get();
    if (!stationDoc.exists) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    const eventId = nanoid(20);
    await db.collection('station_events').doc(eventId).set({
      id: eventId,
      stationId: id,
      type: 'note',
      at: new Date(),
      by: adminUid,
      data: { note: note.trim() },
    });
    
    logger.info('[Stations] Note added', { stationId: id });
    
    res.json({ success: true, message: 'Note added successfully' });
  } catch (error) {
    logger.error('[Stations] Error adding note', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// ============================================
// INVENTORY MANAGEMENT
// ============================================

// GET /api/admin/stations/:id/inventory - Get inventory with low-stock flags
router.get('/:id/inventory', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Fetch station for thresholds
    const stationDoc = await db.collection('stations').doc(id).get();
    if (!stationDoc.exists) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    const station = stationDoc.data();
    const thresholds = station?.thresholds?.minStock || {
      shampoo: 10,
      conditioner: 10,
      disinfectant: 5,
      fragrance: 5,
    };
    
    // Fetch inventory
    const inventoryDoc = await db.collection('station_inventory').doc(id).get();
    
    if (!inventoryDoc.exists) {
      return res.json({ 
        inventory: null, 
        thresholds,
        lowStockFlags: {}
      });
    }
    
    const inventory = inventoryDoc.data();
    const items = inventory?.items || {};
    
    // Calculate low-stock flags
    const lowStockFlags: Record<string, boolean> = {
      shampoo: (items.shampoo?.onHand || 0) < thresholds.shampoo,
      conditioner: (items.conditioner?.onHand || 0) < thresholds.conditioner,
      disinfectant: (items.disinfectant?.onHand || 0) < thresholds.disinfectant,
      fragrance: (items.fragrance?.onHand || 0) < thresholds.fragrance,
    };
    
    res.json({ 
      inventory, 
      thresholds,
      lowStockFlags,
      hasLowStock: Object.values(lowStockFlags).some(v => v),
    });
  } catch (error) {
    logger.error('[Stations] Error fetching inventory', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// POST /api/admin/stations/:id/inventory/set - Set inventory (admin only)
router.post('/:id/inventory/set', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { item, onHand } = req.body;
    const adminUid = req.firebaseUser!.uid;
    
    // Validate item type
    const validItems = ['shampoo', 'conditioner', 'disinfectant', 'fragrance'];
    if (!validItems.includes(item)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }
    
    // Validate onHand
    if (typeof onHand !== 'number' || onHand < 0) {
      return res.status(400).json({ error: 'onHand must be a non-negative number' });
    }
    
    // Verify station exists
    const stationDoc = await db.collection('stations').doc(id).get();
    if (!stationDoc.exists) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    const now = new Date();
    const inventoryRef = db.collection('station_inventory').doc(id);
    
    await inventoryRef.set({
      stationId: id,
      items: {
        [item]: {
          onHand,
          uom: 'L',
          updatedAt: now,
        }
      }
    }, { merge: true });
    
    // Log event
    const eventId = nanoid(20);
    await db.collection('station_events').doc(eventId).set({
      id: eventId,
      stationId: id,
      type: 'inventory_adjusted',
      at: now,
      by: adminUid,
      data: { item, onHand, action: 'set' },
    });
    
    logger.info('[Stations] Inventory set', { stationId: id, item, onHand });
    
    res.json({ success: true, message: 'Inventory updated successfully' });
  } catch (error) {
    logger.error('[Stations] Error setting inventory', error);
    res.status(500).json({ error: 'Failed to set inventory' });
  }
});

// POST /api/admin/stations/:id/inventory/adjust - Adjust inventory (delta)
router.post('/:id/inventory/adjust', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { item, delta, note } = req.body;
    const adminUid = req.firebaseUser!.uid;
    
    // Validate item type
    const validItems = ['shampoo', 'conditioner', 'disinfectant', 'fragrance'];
    if (!validItems.includes(item)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }
    
    // Validate delta
    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'delta must be a number' });
    }
    
    // Fetch current inventory
    const inventoryDoc = await db.collection('station_inventory').doc(id).get();
    const currentOnHand = inventoryDoc.exists 
      ? (inventoryDoc.data()?.items?.[item]?.onHand || 0)
      : 0;
    
    const newOnHand = currentOnHand + delta;
    
    // Prevent negative inventory
    if (newOnHand < 0) {
      return res.status(400).json({ 
        error: 'Adjustment would result in negative inventory',
        currentOnHand,
        requestedDelta: delta,
        wouldBe: newOnHand,
      });
    }
    
    const now = new Date();
    const inventoryRef = db.collection('station_inventory').doc(id);
    
    await inventoryRef.set({
      stationId: id,
      items: {
        [item]: {
          onHand: newOnHand,
          uom: 'L',
          updatedAt: now,
        }
      }
    }, { merge: true });
    
    // Log event
    const eventId = nanoid(20);
    await db.collection('station_events').doc(eventId).set({
      id: eventId,
      stationId: id,
      type: 'inventory_adjusted',
      at: now,
      by: adminUid,
      data: { 
        item, 
        delta, 
        previousOnHand: currentOnHand,
        newOnHand,
        note: note || null,
      },
    });
    
    logger.info('[Stations] Inventory adjusted', { stationId: id, item, delta, newOnHand });
    
    res.json({ 
      success: true, 
      message: 'Inventory adjusted successfully',
      newOnHand,
    });
  } catch (error) {
    logger.error('[Stations] Error adjusting inventory', error);
    res.status(500).json({ error: 'Failed to adjust inventory' });
  }
});

// PUT /api/admin/stations/:id/inventory/:itemId - Update specific inventory item (subcollection)
router.put('/:id/inventory/:itemId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const { qty, name, uom } = req.body;
    const adminUid = req.firebaseUser?.uid || 'admin';

    // Validate item SKU
    if (!['shampoo', 'conditioner', 'disinfectant'].includes(itemId)) {
      return res.status(400).json({ 
        error: 'Invalid item ID. Must be: shampoo, conditioner, or disinfectant',
        field: 'itemId'
      });
    }

    // Validate quantity
    if (qty !== undefined && (typeof qty !== 'number' || qty < 0)) {
      return res.status(400).json({ 
        error: 'Quantity must be a non-negative number',
        field: 'qty'
      });
    }

    // Verify station exists
    const stationDoc = await db.collection('stations').doc(id).get();
    if (!stationDoc.exists) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Get current inventory item
    const inventoryRef = db.collection('stations').doc(id).collection('inventory').doc(itemId);
    const inventoryDoc = await inventoryRef.get();

    if (!inventoryDoc.exists) {
      // Create new inventory item if it doesn't exist
      const newItem = {
        name: name || itemId.charAt(0).toUpperCase() + itemId.slice(1),
        qty: qty || 0,
        uom: uom || 'L',
        lastRefillAt: qty && qty > 0 ? new Date() : null,
        createdBy: adminUid,
        createdAt: new Date(),
        updatedBy: adminUid,
        updatedAt: new Date(),
      };

      await inventoryRef.set(newItem);

      logger.info('[Stations] Inventory item created', { stationId: id, itemId, qty });

      return res.json({
        success: true,
        message: 'Saved ✓',
        item: newItem
      });
    }

    // Update existing item
    const currentData = inventoryDoc.data();
    const oldQty = currentData?.qty || 0;
    const newQty = qty !== undefined ? qty : oldQty;

    const updates: any = {
      updatedBy: adminUid,
      updatedAt: new Date(),
    };

    if (qty !== undefined) {
      updates.qty = qty;
      // Update lastRefillAt if quantity increased
      if (qty > oldQty) {
        updates.lastRefillAt = new Date();
      }
    }

    if (name !== undefined) updates.name = name;
    if (uom !== undefined) updates.uom = uom;

    await inventoryRef.update(updates);

    // Create audit log
    const eventId = nanoid(20);
    await db.collection('stations').doc(id).collection('activity').doc(eventId).set({
      id: eventId,
      type: 'inventory_update',
      updatedAt: new Date(),
      updatedBy: adminUid,
      data: {
        itemId,
        oldQty,
        newQty,
        delta: newQty - oldQty,
        fields: Object.keys(updates),
      },
    });

    logger.info('[Stations] Inventory item updated via PUT', { 
      stationId: id, 
      itemId, 
      oldQty, 
      newQty 
    });

    res.json({
      success: true,
      message: 'Saved ✓',
      item: {
        ...currentData,
        ...updates,
      }
    });
  } catch (error) {
    logger.error('[Stations] Error updating inventory item', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// ============================================
// ALERTS & RENEWALS
// ============================================

// GET /api/admin/alerts/pending - Get low stock and expiring utilities
router.get('/alerts/pending', requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Fetch all active stations
    const stationsSnapshot = await db.collection('stations')
      .where('status', 'in', ['active', 'installing'])
      .get();
    
    const lowStockAlerts: any[] = [];
    const renewalAlerts: any[] = [];
    
    for (const stationDoc of stationsSnapshot.docs) {
      const station = stationDoc.data();
      const stationId = stationDoc.id;
      
      // Check inventory for low stock
      const inventoryDoc = await db.collection('station_inventory').doc(stationId).get();
      if (inventoryDoc.exists) {
        const inventory = inventoryDoc.data();
        const thresholds = station.thresholds?.minStock || {};
        
        for (const item of ['shampoo', 'conditioner', 'disinfectant', 'fragrance']) {
          const onHand = inventory?.items?.[item]?.onHand || 0;
          const threshold = thresholds[item] || 0;
          
          if (onHand < threshold) {
            lowStockAlerts.push({
              stationId,
              serialNumber: station.serialNumber,
              city: station.address?.city,
              item,
              onHand,
              threshold,
              severity: onHand === 0 ? 'critical' : onHand < threshold / 2 ? 'high' : 'medium',
            });
          }
        }
      }
      
      // Check utilities for expiring renewals
      const utilities = station.utilities || {};
      
      for (const [utilityType, utilityData] of Object.entries(utilities) as [string, any][]) {
        if (utilityData?.renewalDate) {
          const renewalDate = utilityData.renewalDate.toDate();
          const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          
          if (daysUntilRenewal <= 30 && daysUntilRenewal >= 0) {
            renewalAlerts.push({
              stationId,
              serialNumber: station.serialNumber,
              city: station.address?.city,
              utilityType,
              provider: utilityData.provider,
              renewalDate: renewalDate.toISOString(),
              daysUntilRenewal,
              severity: daysUntilRenewal <= 7 ? 'critical' : daysUntilRenewal <= 14 ? 'high' : 'medium',
            });
          }
        }
      }
    }
    
    logger.info('[Stations] Alerts fetched', { 
      lowStockCount: lowStockAlerts.length,
      renewalCount: renewalAlerts.length,
    });
    
    res.json({ 
      lowStockAlerts,
      renewalAlerts,
      summary: {
        totalAlerts: lowStockAlerts.length + renewalAlerts.length,
        critical: [...lowStockAlerts, ...renewalAlerts].filter(a => a.severity === 'critical').length,
      }
    });
  } catch (error) {
    logger.error('[Stations] Error fetching alerts', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ============================================
// GOOGLE SHEETS SYNC (Placeholder)
// ============================================

// POST /api/admin/sheets/sync - Sync data to Google Sheets
router.post('/sheets/sync', requireAdmin, async (req: Request, res: Response) => {
  try {
    // TODO: Implement Google Sheets sync with googleapis
    // Will sync 3 tabs: Stations, Inventory, Alerts
    
    logger.warn('[Stations] Google Sheets sync not yet implemented');
    
    res.json({ 
      success: false, 
      message: 'Google Sheets sync not yet implemented' 
    });
  } catch (error) {
    logger.error('[Stations] Error syncing to Google Sheets', error);
    res.status(500).json({ error: 'Failed to sync to Google Sheets' });
  }
});

// ============================================
// HEALTH & STATS
// ============================================

// GET /api/admin/health/stations - Station health summary
router.get('/health/stations', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stationsSnapshot = await db.collection('stations').get();
    
    const statusCounts: Record<string, number> = {};
    let lowStockCount = 0;
    
    for (const doc of stationsSnapshot.docs) {
      const station = doc.data();
      const status = station.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Check if station has low stock
      const inventoryDoc = await db.collection('station_inventory').doc(doc.id).get();
      if (inventoryDoc.exists) {
        const inventory = inventoryDoc.data();
        const thresholds = station.thresholds?.minStock || {};
        
        const hasLowStock = ['shampoo', 'conditioner', 'disinfectant', 'fragrance'].some(item => {
          const onHand = inventory?.items?.[item]?.onHand || 0;
          const threshold = thresholds[item] || 0;
          return onHand < threshold;
        });
        
        if (hasLowStock) {
          lowStockCount++;
        }
      }
    }
    
    res.json({
      totalStations: stationsSnapshot.size,
      byStatus: statusCounts,
      lowStockCount,
      healthy: statusCounts.active || 0,
    });
  } catch (error) {
    logger.error('[Stations] Error fetching health stats', error);
    res.status(500).json({ error: 'Failed to fetch health stats' });
  }
});

// ============================================
// MANUAL TEST TRIGGERS (FOR DEVELOPMENT)
// ============================================

// POST /api/admin/stations/test/low-stock - Manually trigger low stock check
router.post('/test/low-stock', requireAdmin, async (req: Request, res: Response) => {
  try {
    logger.info('[Stations] Manual low stock check triggered by admin');
    
    const { checkLowStockAlerts } = await import('../lib/stationsAlertService');
    await checkLowStockAlerts();
    
    res.json({ 
      success: true, 
      message: 'Low stock check completed. Check email and Slack for alerts.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Stations] Error running manual low stock check', error);
    res.status(500).json({ 
      error: 'Failed to run low stock check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/admin/stations/test/utility-renewals - Manually trigger utility renewal check
router.post('/test/utility-renewals', requireAdmin, async (req: Request, res: Response) => {
  try {
    logger.info('[Stations] Manual utility renewal check triggered by admin');
    
    const { checkUtilityRenewalAlerts } = await import('../lib/stationsAlertService');
    await checkUtilityRenewalAlerts();
    
    res.json({ 
      success: true, 
      message: 'Utility renewal check completed. Check email and Slack for alerts.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Stations] Error running manual utility renewal check', error);
    res.status(500).json({ 
      error: 'Failed to run utility renewal check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/admin/stations/test/google-sheets-sync - Manually trigger Google Sheets sync
router.post('/test/google-sheets-sync', requireAdmin, async (req: Request, res: Response) => {
  try {
    logger.info('[Stations] Manual Google Sheets sync triggered by admin');
    
    const { syncStationsToGoogleSheets } = await import('../lib/stationsAlertService');
    await syncStationsToGoogleSheets();
    
    res.json({ 
      success: true, 
      message: 'Google Sheets sync completed (placeholder - not yet implemented).',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Stations] Error running manual Google Sheets sync', error);
    res.status(500).json({ 
      error: 'Failed to run Google Sheets sync',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// MOBILE APP ENDPOINTS
// ============================================

// GET /api/admin/stations/low-stock - Get all low-stock items across all stations
router.get('/low-stock', requireAdmin, async (req: Request, res: Response) => {
  try {
    const stationsSnapshot = await db.collection('stations').get();
    const lowStockItems: any[] = [];

    for (const stationDoc of stationsSnapshot.docs) {
      const station = stationDoc.data();
      const stationId = stationDoc.id;

      // Fetch inventory for this station
      const inventorySnapshot = await db.collection('stations').doc(stationId).collection('inventory').get();

      for (const invDoc of inventorySnapshot.docs) {
        const item = invDoc.data();
        const sku = invDoc.id;

        // Check if low stock
        if (item.qty <= item.reorderLevel) {
          lowStockItems.push({
            stationId,
            stationName: station.name || station.serialNumber,
            sku,
            itemName: item.name,
            qty: item.qty,
            reorderLevel: item.reorderLevel,
          });
        }
      }
    }

    logger.info('[Stations] Fetched low-stock items', { count: lowStockItems.length });

    res.json({ lowStockItems });
  } catch (error) {
    logger.error('[Stations] Error fetching low-stock items', error);
    res.status(500).json({ error: 'Failed to fetch low-stock items' });
  }
});

// POST /api/admin/stations/:id/inventory/adjust - Adjust inventory (subcollection format)
router.post('/:id/inventory/adjust', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sku, delta } = req.body;
    const adminUid = req.firebaseUser?.uid || 'admin';

    // Validate inputs
    if (!sku || typeof delta !== 'number') {
      return res.status(400).json({ error: 'sku and delta are required' });
    }

    if (!['shampoo', 'conditioner', 'disinfectant'].includes(sku)) {
      return res.status(400).json({ error: 'Invalid SKU. Must be shampoo, conditioner, or disinfectant' });
    }

    // Verify station exists
    const stationDoc = await db.collection('stations').doc(id).get();
    if (!stationDoc.exists) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Get current inventory item
    const inventoryRef = db.collection('stations').doc(id).collection('inventory').doc(sku);
    const inventoryDoc = await inventoryRef.get();
    
    if (!inventoryDoc.exists) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const currentData = inventoryDoc.data();
    const currentQty = currentData?.qty || 0;
    const newQty = Math.max(0, currentQty + delta); // Prevent negative inventory

    // Update inventory
    await inventoryRef.update({
      qty: newQty,
      lastRefillAt: delta > 0 ? new Date() : currentData?.lastRefillAt, // Only update if adding stock
      updatedBy: adminUid,
      updatedAt: new Date(),
    });

    // Create audit log
    const eventId = nanoid(20);
    await db.collection('stations').doc(id).collection('activity').doc(eventId).set({
      id: eventId,
      type: 'inventory_update',
      updatedAt: new Date(),
      updatedBy: adminUid,
      data: {
        itemId: sku,
        oldQty: currentQty,
        newQty,
        delta,
        note: `Adjusted ${currentData?.name || sku} by ${delta > 0 ? '+' : ''}${delta}`,
      },
    });

    logger.info('[Stations] Inventory adjusted', { 
      stationId: id, 
      sku, 
      delta, 
      oldQty: currentQty, 
      newQty 
    });

    res.json({ 
      success: true, 
      message: 'Saved ✓',
      oldQty: currentQty,
      newQty,
    });
  } catch (error) {
    logger.error('[Stations] Error adjusting inventory', error);
    res.status(500).json({ error: 'Failed to adjust inventory' });
  }
});

// POST /api/admin/stations/:id/inventory/set - Set exact inventory values
router.post('/:id/inventory/set', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sku, qty, reorderLevel, notes } = req.body;
    const adminUid = req.firebaseUser?.uid || 'admin';

    // Validate SKU
    if (!sku || !['shampoo', 'conditioner', 'disinfectant'].includes(sku)) {
      return res.status(400).json({ error: 'Invalid SKU. Must be shampoo, conditioner, or disinfectant' });
    }

    // Validate and clamp qty
    if (typeof qty !== 'number' || isNaN(qty)) {
      return res.status(400).json({ error: 'Quantity must be a valid number' });
    }
    const clampedQty = Math.max(0, Math.floor(qty));

    // Validate and clamp reorderLevel
    let clampedReorderLevel = reorderLevel;
    if (reorderLevel !== undefined) {
      if (typeof reorderLevel !== 'number' || isNaN(reorderLevel)) {
        return res.status(400).json({ error: 'Reorder level must be a valid number' });
      }
      clampedReorderLevel = Math.max(0, Math.floor(reorderLevel));
    }

    // Validate notes
    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    // Verify station exists
    const stationDoc = await db.collection('stations').doc(id).get();
    if (!stationDoc.exists) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Get current inventory item
    const inventoryRef = db.collection('stations').doc(id).collection('inventory').doc(sku);
    const inventoryDoc = await inventoryRef.get();
    
    if (!inventoryDoc.exists) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const currentData = inventoryDoc.data();
    const oldQty = currentData?.qty || 0;
    const oldReorderLevel = currentData?.reorderLevel || 0;

    // Prepare update data
    const updateData: any = {
      qty: clampedQty,
      updatedBy: adminUid,
      updatedAt: new Date(),
    };

    // Update lastRefillAt if qty increased
    if (clampedQty > oldQty) {
      updateData.lastRefillAt = new Date();
    }

    // Update reorderLevel if provided
    if (clampedReorderLevel !== undefined) {
      updateData.reorderLevel = clampedReorderLevel;
    }

    // Update notes if provided
    if (notes !== undefined) {
      updateData.notes = notes.trim() || '';
    }

    // Update inventory
    await inventoryRef.update(updateData);

    // Create audit log
    const eventId = nanoid(20);
    await db.collection('stations').doc(id).collection('activity').doc(eventId).set({
      id: eventId,
      type: 'inventory_update',
      updatedAt: new Date(),
      updatedBy: adminUid,
      data: {
        itemId: sku,
        oldQty,
        newQty: clampedQty,
        reorderLevel: clampedReorderLevel !== undefined ? clampedReorderLevel : oldReorderLevel,
        notes: notes || '',
      },
    });

    logger.info('[Stations] Inventory set', { 
      stationId: id, 
      sku, 
      oldQty, 
      newQty: clampedQty,
      reorderLevel: clampedReorderLevel,
    });

    res.json({ 
      success: true, 
      message: 'Saved ✓',
      qty: clampedQty,
      reorderLevel: clampedReorderLevel,
    });
  } catch (error) {
    logger.error('[Stations] Error setting inventory', error);
    res.status(500).json({ error: 'Failed to set inventory' });
  }
});

export default router;
