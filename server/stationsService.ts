/**
 * Stations Service - Smart Monitoring System
 * Manages station health, heartbeats, alerts per technical spec
 */

import { db } from './lib/firebase-admin';
import { logger } from './lib/logger';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// ==================== TYPES ====================

export type StationStatus = 'online' | 'idle' | 'warning_low_activity' | 'offline' | 'maintenance' | 'fault';

export interface Station {
  stationId: string;           // e.g., "IL-001"
  label: string;                // e.g., "TLV – Dizengoff"
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  terminalId: string;           // Nayax terminal ID
  apiKey: string;               // For station auth (HMAC)
  status: StationStatus;
  lastHeartbeatAt: Date;        // Last heartbeat/ping (distinct from transactions!)
  lastTxnAt: Date | null;       // Last approved payment/redeem
  lastStatusChangeAt: Date;     // When status last changed
  uptime: {
    daily: number;              // 0-100%
    weekly: number;             // 0-100%
  };
  alertsOpen: number;           // Count of unresolved alerts
  maintenance?: {               // Only present if status=maintenance
    enabled: boolean;
    reason?: string;
    setBy?: string;             // Admin UID
    setAt?: Date;
  };
}

export interface StationAlert {
  id?: string;
  stationId: string;
  type: 'offline' | 'warning_low_activity' | 'webhook_failure' | 'ecu_fault' | 'redeem_error';
  severity: 'info' | 'warn' | 'critical';
  message: string;
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  dashboardOnly?: boolean;      // True for warning_low_activity
  meta?: Record<string, any>;   // Freeform (HTTP codes, Nayax error, ECU code)
}

export interface MonitoringConfig {
  busyHours: {
    start: string;              // "08:00"
    end: string;                // "20:00"
    tz: string;                 // "Asia/Jerusalem"
  };
  transactionQuietWindowBusy: number;    // Minutes (default: 90)
  transactionQuietWindowQuiet: number;   // Minutes (default: 240)
  offlineThreshold: number;              // Minutes (default: 30) - heartbeat loss
  weatherSuppression: {
    enabled: boolean;
    coldC: number;              // Below this = suppress (default: 10)
    hotC: number;               // Above this = suppress (default: 35)
    precipitation: boolean;     // Suppress on rain/snow
  };
  email: {
    offline: {
      first: boolean;           // Send on first transition
      remindHours: number;      // Reminder cadence (default: 6)
    };
    lowActivityEmail: boolean;  // Should be false
  };
}

export interface StationMonitoringOverrides {
  offlineThreshold?: number;
  transactionQuietWindowBusy?: number;
  transactionQuietWindowQuiet?: number;
}

export interface StationEvent {
  id?: string;
  stationId: string;
  timestamp: Date;
  eventType: 'status_change' | 'alert_created' | 'alert_resolved' | 'maintenance_toggle';
  previousStatus?: StationStatus;
  newStatus?: StationStatus;
  reason: string;
  thresholds?: Record<string, any>;
  suppressionFlags?: {
    weather?: boolean;
    maintenance?: boolean;
  };
  meta?: Record<string, any>;
}

export interface ECUFault {
  id?: string;
  stationId: string;
  code: string;                 // ECU fault code
  desc: string;                 // Description
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;          // Admin UID
  notes?: string;
}

// ==================== CONFIG & HELPERS ====================

const DEFAULT_CONFIG: MonitoringConfig = {
  busyHours: { start: "08:00", end: "20:00", tz: "Asia/Jerusalem" },
  transactionQuietWindowBusy: 90,
  transactionQuietWindowQuiet: 240,
  offlineThreshold: 30,
  weatherSuppression: { enabled: true, coldC: 10, hotC: 35, precipitation: true },
  email: { offline: { first: true, remindHours: 6 }, lowActivityEmail: false }
};

/**
 * Get monitoring config from Firestore, fallback to defaults
 * Caches for 15 minutes to avoid excessive reads
 */
let configCache: { config: MonitoringConfig; timestamp: number } | null = null;
const CONFIG_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function getMonitoringConfig(): Promise<MonitoringConfig> {
  try {
    // Return cached config if still valid
    if (configCache && Date.now() - configCache.timestamp < CONFIG_CACHE_TTL) {
      return configCache.config;
    }

    const doc = await db.collection('config').doc('monitoring').get();
    const config = doc.exists ? { ...DEFAULT_CONFIG, ...doc.data() } : DEFAULT_CONFIG;
    
    configCache = { config, timestamp: Date.now() };
    return config;
  } catch (error) {
    logger.error('[Stations] Failed to load monitoring config, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Merge global config with per-station overrides
 */
export async function getMergedMonitoringConfig(stationId: string): Promise<MonitoringConfig> {
  const globalConfig = await getMonitoringConfig();
  
  try {
    const stationDoc = await db.collection('stations').doc(stationId).get();
    const overrides = stationDoc.data()?.monitoringOverrides as StationMonitoringOverrides | undefined;
    
    if (!overrides) return globalConfig;

    return {
      ...globalConfig,
      offlineThreshold: overrides.offlineThreshold ?? globalConfig.offlineThreshold,
      transactionQuietWindowBusy: overrides.transactionQuietWindowBusy ?? globalConfig.transactionQuietWindowBusy,
      transactionQuietWindowQuiet: overrides.transactionQuietWindowQuiet ?? globalConfig.transactionQuietWindowQuiet,
    };
  } catch (error) {
    logger.error(`[Stations] Failed to load overrides for ${stationId}:`, error);
    return globalConfig;
  }
}

/**
 * Check if current time is within busy hours
 */
export function isBusyHours(config: MonitoringConfig, now: Date = new Date()): boolean {
  try {
    // Parse time strings
    const [busyStartHour, busyStartMin] = config.busyHours.start.split(':').map(Number);
    const [busyEndHour, busyEndMin] = config.busyHours.end.split(':').map(Number);
    
    // Get current time in station timezone (simplified - assumes local time is correct)
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMin;
    
    const busyStartMinutes = busyStartHour * 60 + busyStartMin;
    const busyEndMinutes = busyEndHour * 60 + busyEndMin;
    
    return currentMinutes >= busyStartMinutes && currentMinutes < busyEndMinutes;
  } catch (error) {
    logger.error('[Stations] Error checking busy hours:', error);
    return false; // Default to quiet hours on error
  }
}

/**
 * Check if low-activity warnings should be suppressed due to weather
 * Returns true if weather conditions warrant suppression
 */
export async function shouldSuppressLowActivity(stationId: string, config: MonitoringConfig): Promise<boolean> {
  if (!config.weatherSuppression.enabled) return false;

  try {
    // Check weather data for station (stored in Firestore)
    const weatherDoc = await db.collection('config').doc('weather').get();
    const weatherData = weatherDoc.data()?.[stationId];
    
    if (!weatherData) return false;

    const { tempC, precipitation } = weatherData;
    
    // Suppress if too cold, too hot, or precipitation
    if (tempC !== undefined && (tempC < config.weatherSuppression.coldC || tempC > config.weatherSuppression.hotC)) {
      return true;
    }
    
    if (config.weatherSuppression.precipitation && precipitation) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`[Stations] Error checking weather for ${stationId}:`, error);
    return false; // Don't suppress on error
  }
}

/**
 * Log station event to audit trail (30-day retention)
 */
export async function logStationEvent(event: Omit<StationEvent, 'id'>): Promise<void> {
  try {
    await db.collection('station_events').add({
      ...event,
      timestamp: Timestamp.fromDate(event.timestamp),
    });
    
    // Note: 30-day cleanup handled by scheduled job
  } catch (error) {
    logger.error('[Stations] Failed to log station event:', error);
  }
}

// ==================== STATION CRUD ====================

export async function getStationByTerminalId(terminalId: string): Promise<Station | null> {
  try {
    const snapshot = await db.collection('stations')
      .where('terminalId', '==', terminalId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      stationId: doc.id,
      ...data,
      lastHeartbeatAt: data.lastHeartbeatAt?.toDate() || data.lastSeenAt?.toDate(),
      lastTxnAt: data.lastTxnAt?.toDate() || null,
      lastStatusChangeAt: data.lastStatusChangeAt?.toDate() || new Date(),
      maintenance: data.maintenance ? {
        ...data.maintenance,
        setAt: data.maintenance.setAt?.toDate(),
      } : undefined,
    } as Station;
  } catch (error) {
    logger.error('[Stations] Get station by terminal error:', error);
    return null;
  }
}

export async function getStation(stationId: string): Promise<Station | null> {
  try {
    const doc = await db.collection('stations').doc(stationId).get();
    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;
    
    return {
      stationId: doc.id,
      ...data,
      lastHeartbeatAt: data.lastHeartbeatAt?.toDate() || data.lastSeenAt?.toDate(),
      lastTxnAt: data.lastTxnAt?.toDate() || null,
      lastStatusChangeAt: data.lastStatusChangeAt?.toDate() || new Date(),
      maintenance: data.maintenance ? {
        ...data.maintenance,
        setAt: data.maintenance.setAt?.toDate(),
      } : undefined,
    } as Station;
  } catch (error) {
    logger.error('[Stations] Get station error:', error);
    throw error;
  }
}

export async function getAllStations(filters?: {
  status?: string;
  q?: string;
  limit?: number;
  page?: number;
}): Promise<Station[]> {
  try {
    let query = db.collection('stations') as any;

    // Filter by status
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }

    // Search by label/terminalId (basic text match)
    if (filters?.q) {
      // Firestore doesn't support full-text search, so we'll filter in memory
      // For production, consider Algolia or Elasticsearch
    }

    // Limit
    const limit = filters?.limit || 100;
    query = query.limit(limit);

    const snapshot = await query.get();
    let stations = snapshot.docs.map((doc: any) => ({
      stationId: doc.id,
      ...doc.data(),
      lastSeenAt: doc.data().lastSeenAt?.toDate(),
      lastTxnAt: doc.data().lastTxnAt?.toDate() || null,
    })) as Station[];

    // Client-side search filter if q provided
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      stations = stations.filter(s =>
        s.label.toLowerCase().includes(q) ||
        s.stationId.toLowerCase().includes(q) ||
        s.terminalId.toLowerCase().includes(q)
      );
    }

    return stations;
  } catch (error) {
    logger.error('[Stations] Get all stations error:', error);
    throw error;
  }
}

export async function createStation(station: Omit<Station, 'status' | 'lastSeenAt' | 'uptime' | 'alertsOpen'>): Promise<void> {
  try {
    const stationData = {
      ...station,
      status: 'offline',
      lastSeenAt: Timestamp.now(),
      lastTxnAt: station.lastTxnAt || null,
      uptime: { daily: 0, weekly: 0 },
      alertsOpen: 0,
    };

    await db.collection('stations').doc(station.stationId).set(stationData);
    logger.info('[Stations] Created station:', { stationId: station.stationId });
  } catch (error) {
    logger.error('[Stations] Create station error:', error);
    throw error;
  }
}

// ==================== HEARTBEAT & STATUS ====================

/**
 * CORRECTED: Update station heartbeat - DOES NOT force status changes
 * Only updates lastHeartbeatAt (and lastTxnAt if transaction)
 * Status evaluation happens separately in updateStationStatus()
 * 
 * Sources:
 * 1. Nayax approved transaction (updates both lastHeartbeatAt + lastTxnAt)
 * 2. Successful HTTP ping (updates lastHeartbeatAt only)
 * 3. ECU heartbeat webhook (future)
 */
export async function updateStationHeartbeat(stationId: string, source: 'transaction' | 'ping' | 'ecu' = 'ping'): Promise<void> {
  try {
    const updates: any = {
      lastHeartbeatAt: Timestamp.now(),
    };

    // If source is transaction, also update lastTxnAt
    if (source === 'transaction') {
      updates.lastTxnAt = Timestamp.now();
    }

    await db.collection('stations').doc(stationId).update(updates);

    logger.info('[Stations] Heartbeat updated:', { stationId, source });
    
    // Trigger immediate status evaluation (will handle recovery from offline)
    await updateStationStatus(stationId);
  } catch (error) {
    logger.error('[Stations] Update heartbeat error:', error);
    throw error;
  }
}

/**
 * CORRECTED: 5-state machine with proper heartbeat vs transaction separation
 * 
 * State precedence (evaluated in order):
 * 1. maintenance - Admin-set, silences all alerts
 * 2. fault - Active ECU fault
 * 3. offline - lastHeartbeatAt > offlineThreshold (HEARTBEAT LOSS ONLY!)
 * 4. warning_low_activity - Heartbeat OK + no txn > quietWindow + NOT suppressed
 * 5. idle - Heartbeat OK + no txn > quietWindow + suppressed (weather/quiet hours)
 * 6. online - Default (heartbeat OK, recent transactions OR suppressed)
 * 
 * CRITICAL: Offline is ONLY when heartbeats stop, NOT when transactions stop!
 */
export async function updateStationStatus(stationId: string): Promise<void> {
  try {
    const station = await getStation(stationId);
    if (!station) return;

    const now = new Date();
    const previousStatus = station.status;
    
    // Load config with per-station overrides
    const config = await getMergedMonitoringConfig(stationId);
    
    // Calculate time differences
    // Handle stations without lastHeartbeatAt (newly created stations)
    const heartbeatMinutes = station.lastHeartbeatAt
      ? (now.getTime() - station.lastHeartbeatAt.getTime()) / 1000 / 60
      : Infinity; // No heartbeat yet = offline
    const txnMinutes = station.lastTxnAt
      ? (now.getTime() - station.lastTxnAt.getTime()) / 1000 / 60
      : Infinity;

    let newStatus: StationStatus = 'online';
    let reason = '';
    const thresholds: any = {};

    // STATE 1: Maintenance (highest priority)
    if (station.maintenance?.enabled) {
      newStatus = 'maintenance';
      reason = station.maintenance.reason || 'Maintenance mode active';
    }
    // STATE 2: ECU Fault
    else if (await hasActiveECUFault(stationId)) {
      newStatus = 'fault';
      reason = 'Active ECU fault detected';
    }
    // STATE 3: Offline (HEARTBEAT LOSS ONLY!)
    else if (heartbeatMinutes > config.offlineThreshold) {
      newStatus = 'offline';
      reason = `No heartbeat for ${Math.round(heartbeatMinutes)}min (threshold: ${config.offlineThreshold}min)`;
      thresholds.offlineThreshold = config.offlineThreshold;
      thresholds.heartbeatMinutes = Math.round(heartbeatMinutes);
      
      // Create offline alert (with deduplication)
      await createOfflineAlert(stationId, heartbeatMinutes);
    }
    // STATES 4-6: Heartbeat is OK, evaluate transaction activity
    else {
      // Determine transaction quiet window based on time of day
      const isBusy = isBusyHours(config, now);
      const quietWindow = isBusy 
        ? config.transactionQuietWindowBusy 
        : config.transactionQuietWindowQuiet;
      
      thresholds.isBusyHours = isBusy;
      thresholds.quietWindow = quietWindow;
      thresholds.txnMinutes = Math.round(txnMinutes);
      
      // Check if transaction gap exceeds window
      if (txnMinutes > quietWindow) {
        // Check weather suppression
        const weatherSuppressed = await shouldSuppressLowActivity(stationId, config);
        
        if (weatherSuppressed) {
          // STATE 5: Idle (suppressed by weather)
          newStatus = 'idle';
          reason = `No txn for ${Math.round(txnMinutes)}min (${isBusy ? 'busy' : 'quiet'} hours) - weather suppressed`;
        } else {
          // STATE 4: Warning low activity
          newStatus = 'warning_low_activity';
          reason = `No txn for ${Math.round(txnMinutes)}min during ${isBusy ? 'busy' : 'quiet'} hours (threshold: ${quietWindow}min)`;
          
          // Create warning alert (dashboard only, no email)
          await createLowActivityAlert(stationId, txnMinutes, isBusy);
        }
      } else {
        // STATE 6: Online (heartbeat OK, transactions recent OR within window)
        newStatus = 'online';
        reason = 'Heartbeat OK, recent transactions';
      }
    }

    // Update status if changed
    if (newStatus !== previousStatus) {
      await db.collection('stations').doc(stationId).update({ 
        status: newStatus,
        lastStatusChangeAt: Timestamp.now(),
      });
      
      // Log status change to audit trail
      await logStationEvent({
        stationId,
        timestamp: now,
        eventType: 'status_change',
        previousStatus,
        newStatus,
        reason,
        thresholds,
        suppressionFlags: {
          maintenance: station.maintenance?.enabled || false,
        },
      });
      
      logger.info('[Stations] Status changed:', { 
        stationId, 
        previousStatus, 
        newStatus, 
        reason,
        thresholds,
      });

      // Handle offline recovery
      if (previousStatus === 'offline' && newStatus !== 'offline') {
        await handleOfflineRecovery(stationId);
      }
    }
  } catch (error) {
    logger.error('[Stations] Update status error:', error);
    throw error;
  }
}

/**
 * Cron job: Update all station statuses (every 5 min)
 */
export async function updateAllStationStatuses(): Promise<void> {
  try {
    const stations = await getAllStations();
    await Promise.all(stations.map(s => updateStationStatus(s.stationId)));
    logger.info('[Stations] All station statuses updated', { count: stations.length });
  } catch (error) {
    logger.error('[Stations] Update all statuses error:', error);
  }
}

// ==================== ALERTS ====================

export async function createAlert(alert: Omit<StationAlert, 'id' | 'createdAt' | 'resolved'>): Promise<string> {
  try {
    // Check for duplicate alert (deduplication)
    const existingAlert = await getActiveAlertByType(alert.stationId, alert.type);
    if (existingAlert) {
      logger.info('[Stations] Alert already exists (deduplicated):', { stationId: alert.stationId, type: alert.type });
      return existingAlert.id!;
    }

    const alertData = {
      ...alert,
      createdAt: Timestamp.now(),
      resolved: false,
    };

    const docRef = await db.collection('station_alerts').add(alertData);

    // Increment alertsOpen counter
    await db.collection('stations').doc(alert.stationId).update({
      alertsOpen: FieldValue.increment(1),
    });

    logger.info('[Stations] Alert created:', { alertId: docRef.id, stationId: alert.stationId, type: alert.type });
    return docRef.id;
  } catch (error) {
    logger.error('[Stations] Create alert error:', error);
    throw error;
  }
}

/**
 * Create offline alert with two-tier email logic:
 * - First transition to offline: Send immediate email
 * - Reminder emails: Every 6 hours while offline (handled by cron)
 */
async function createOfflineAlert(stationId: string, minutesOffline: number): Promise<void> {
  const config = await getMonitoringConfig();
  
  // Check if alert already exists (deduplication)
  const existingAlert = await getActiveAlertByType(stationId, 'offline');
  if (existingAlert) {
    logger.info('[Stations] Offline alert already exists:', { stationId });
    return;
  }

  const severity = minutesOffline > 30 ? 'critical' : 'warn';
  const alertId = await createAlert({
    stationId,
    type: 'offline',
    severity,
    message: `Station ${stationId} offline - no heartbeat for ${Math.round(minutesOffline)} minutes`,
    meta: { 
      minutesOffline,
      emailSent: false,
      lastReminderAt: null,
    },
  });

  // Send immediate email on first offline detection
  if (config.email.offline.first) {
    await sendOfflineEmail(stationId, minutesOffline);
    
    // Mark email as sent
    await db.collection('station_alerts').doc(alertId).update({
      'meta.emailSent': true,
      'meta.lastReminderAt': Timestamp.now(),
    });
  }
}

/**
 * Create low-activity alert (dashboard only, no email)
 */
async function createLowActivityAlert(stationId: string, minutesInactive: number, isBusyHours: boolean): Promise<void> {
  // Check if alert already exists (deduplication)
  const existingAlert = await getActiveAlertByType(stationId, 'warning_low_activity');
  if (existingAlert) {
    return;
  }

  await createAlert({
    stationId,
    type: 'warning_low_activity',
    severity: 'info',
    message: `Low transaction activity: No transactions for ${Math.round(minutesInactive)} minutes during ${isBusyHours ? 'busy' : 'quiet'} hours`,
    dashboardOnly: true, // No email, dashboard badge only
    meta: { 
      minutesInactive,
      isBusyHours,
    },
  });
}

/**
 * Handle offline recovery: Send recovery email and auto-resolve offline alert
 */
async function handleOfflineRecovery(stationId: string): Promise<void> {
  try {
    // Resolve offline alert
    const alert = await getActiveAlertByType(stationId, 'offline');
    if (alert && alert.id) {
      await resolveAlert(alert.id);
      
      // Send recovery email
      const station = await getStation(stationId);
      if (station) {
        await sendRecoveryEmail(stationId);
      }
      
      logger.info('[Stations] Offline recovery handled:', { stationId, alertId: alert.id });
    }
  } catch (error) {
    logger.error('[Stations] Offline recovery error:', error);
  }
}

async function getActiveAlertByType(stationId: string, type: string): Promise<StationAlert | null> {
  try {
    const snapshot = await db.collection('station_alerts')
      .where('stationId', '==', stationId)
      .where('type', '==', type)
      .where('resolved', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      resolvedAt: doc.data().resolvedAt?.toDate(),
    } as StationAlert;
  } catch (error) {
    logger.error('[Stations] Get active alert error:', error);
    return null;
  }
}

async function autoResolveOfflineAlert(stationId: string): Promise<void> {
  try {
    const alert = await getActiveAlertByType(stationId, 'offline');
    if (alert && alert.id) {
      await resolveAlert(alert.id);
      logger.info('[Stations] Auto-resolved offline alert:', { stationId, alertId: alert.id });
    }
  } catch (error) {
    logger.error('[Stations] Auto-resolve alert error:', error);
  }
}

export async function resolveAlert(alertId: string): Promise<void> {
  try {
    const alertDoc = await db.collection('station_alerts').doc(alertId).get();
    if (!alertDoc.exists) return;

    const alert = alertDoc.data();
    if (!alert) return;

    await db.collection('station_alerts').doc(alertId).update({
      resolved: true,
      resolvedAt: Timestamp.now(),
    });

    // Decrement alertsOpen counter
    await db.collection('stations').doc(alert.stationId).update({
      alertsOpen: FieldValue.increment(-1),
    });

    logger.info('[Stations] Alert resolved:', { alertId, stationId: alert.stationId });
  } catch (error) {
    logger.error('[Stations] Resolve alert error:', error);
    throw error;
  }
}

export async function acknowledgeAlerts(stationId: string, types?: string[]): Promise<number> {
  try {
    let query = db.collection('station_alerts')
      .where('stationId', '==', stationId)
      .where('resolved', '==', false) as any;

    if (types && types.length > 0) {
      query = query.where('type', 'in', types);
    }

    const snapshot = await query.get();
    const count = snapshot.size;

    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.update(doc.ref, {
        resolved: true,
        resolvedAt: Timestamp.now(),
      });
    });

    await batch.commit();

    // Update alertsOpen counter
    await db.collection('stations').doc(stationId).update({
      alertsOpen: FieldValue.increment(-count),
    });

    logger.info('[Stations] Alerts acknowledged:', { stationId, count });
    return count;
  } catch (error) {
    logger.error('[Stations] Acknowledge alerts error:', error);
    throw error;
  }
}

export async function getStationAlerts(stationId: string, limit: number = 100): Promise<StationAlert[]> {
  try {
    const snapshot = await db.collection('station_alerts')
      .where('stationId', '==', stationId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      resolvedAt: doc.data().resolvedAt?.toDate(),
    })) as StationAlert[];
  } catch (error) {
    logger.error('[Stations] Get station alerts error:', error);
    throw error;
  }
}

// ==================== ECU FAULTS ====================

export async function createECUFault(fault: Omit<ECUFault, 'id' | 'createdAt' | 'resolved'>): Promise<string> {
  try {
    const faultData = {
      ...fault,
      createdAt: Timestamp.now(),
      resolved: false,
    };

    const docRef = await db.collection('ecu_faults').add(faultData);

    // Update station status to fault
    await db.collection('stations').doc(fault.stationId).update({ status: 'fault' });

    // Create critical alert
    await createAlert({
      stationId: fault.stationId,
      type: 'ecu_fault',
      severity: 'critical',
      message: `ECU Fault ${fault.code}: ${fault.desc}`,
      meta: { code: fault.code, desc: fault.desc },
    });

    logger.info('[Stations] ECU fault created:', { faultId: docRef.id, stationId: fault.stationId, code: fault.code });
    return docRef.id;
  } catch (error) {
    logger.error('[Stations] Create ECU fault error:', error);
    throw error;
  }
}

export async function resolveECUFault(faultId: string, adminUid: string, notes?: string): Promise<void> {
  try {
    await db.collection('ecu_faults').doc(faultId).update({
      resolved: true,
      resolvedAt: Timestamp.now(),
      resolvedBy: adminUid,
      notes: notes || '',
    });

    logger.info('[Stations] ECU fault resolved:', { faultId, adminUid });
  } catch (error) {
    logger.error('[Stations] Resolve ECU fault error:', error);
    throw error;
  }
}

async function hasActiveECUFault(stationId: string): Promise<boolean> {
  try {
    const snapshot = await db.collection('ecu_faults')
      .where('stationId', '==', stationId)
      .where('resolved', '==', false)
      .limit(1)
      .get();

    return !snapshot.empty;
  } catch (error) {
    logger.error('[Stations] Check ECU fault error:', error);
    return false;
  }
}

// ==================== PING JOB ====================

export async function pingStation(stationId: string): Promise<{ success: boolean; latency?: number }> {
  try {
    const station = await getStation(stationId);
    if (!station) return { success: false };

    // TODO: Implement actual HTTP ping to station controller
    // For now, just update heartbeat (stub)
    const start = Date.now();
    await updateStationHeartbeat(stationId, 'ping');
    const latency = Date.now() - start;

    return { success: true, latency };
  } catch (error) {
    logger.error('[Stations] Ping error:', { stationId, error });
    return { success: false };
  }
}

// ==================== EMAIL ALERTS ====================

async function sendOfflineEmail(stationId: string, minutesOffline: number): Promise<void> {
  try {
    const { EmailService } = await import('./emailService');
    const station = await getStation(stationId);
    if (!station) return;

    const subject = `⚠️ Station ${stationId} offline (${Math.round(minutesOffline)}m)`;
    const html = `
      <div style="font-family: Arial; max-width: 600px;">
        <h2 style="color: #dc2626;">⚠️ STATION OFFLINE</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; background: #f3f4f6;"><strong>Station:</strong></td>
            <td style="padding: 8px;">${stationId} - ${station.label}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f3f4f6;"><strong>Duration:</strong></td>
            <td style="padding: 8px;">${Math.round(minutesOffline)} minutes</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f3f4f6;"><strong>Last Seen:</strong></td>
            <td style="padding: 8px;">${station.lastHeartbeatAt ? station.lastHeartbeatAt.toLocaleString() : 'Never'}</td>
          </tr>
        </table>
        <h3>Action Required:</h3>
        <ul>
          <li>Check physical station connectivity</li>
          <li>Verify Nayax terminal is powered on</li>
          <li>Check network connection</li>
        </ul>
        <p>
          <a href="https://petwash.co.il/admin/stations?id=${stationId}" 
             style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Station Details
          </a>
        </p>
      </div>
    `;

    await EmailService.send({
      to: process.env.ALERT_EMAIL_TO || 'Support@PetWash.co.il',
      subject,
      html,
    });

    logger.info('[Stations] Offline email sent:', { stationId });
  } catch (error) {
    logger.error('[Stations] Send offline email error:', error);
  }
}

async function sendRecoveryEmail(stationId: string): Promise<void> {
  try {
    const { EmailService } = await import('./emailService');
    const station = await getStation(stationId);
    if (!station) return;

    const subject = `✅ Station ${stationId} back online`;
    const html = `
      <div style="font-family: Arial; max-width: 600px;">
        <h2 style="color: #059669;">✅ STATION RECOVERED</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; background: #f3f4f6;"><strong>Station:</strong></td>
            <td style="padding: 8px;">${stationId} - ${station.label}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f3f4f6;"><strong>Status:</strong></td>
            <td style="padding: 8px; color: #059669;"><strong>Online</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f3f4f6;"><strong>Recovered At:</strong></td>
            <td style="padding: 8px;">${new Date().toLocaleString()}</td>
          </tr>
        </table>
        <p>Station ${stationId} has resumed sending heartbeats and is back online.</p>
        <p>
          <a href="https://petwash.co.il/admin/stations?id=${stationId}" 
             style="background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Station Details
          </a>
        </p>
      </div>
    `;

    await EmailService.send({
      to: process.env.ALERT_EMAIL_TO || 'Support@PetWash.co.il',
      subject,
      html,
    });

    logger.info('[Stations] Recovery email sent:', { stationId });
  } catch (error) {
    logger.error('[Stations] Send recovery email error:', error);
  }
}

// ==================== UPTIME CALCULATION ====================

export async function calculateStationUptime(stationId: string, period: 'daily' | 'weekly'): Promise<number> {
  try {
    const hours = period === 'daily' ? 24 : 168; // 24h or 7 days
    const station = await getStation(stationId);
    if (!station) return 0;

    // Get all alerts in period
    // NOTE: Requires Firestore composite index on: stationId, type, createdAt
    // If index missing, silently return 100% uptime
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    try {
      const snapshot = await db.collection('station_alerts')
        .where('stationId', '==', stationId)
        .where('type', '==', 'offline')
        .where('createdAt', '>=', Timestamp.fromDate(startTime))
        .get();

      // Calculate total offline minutes
      let totalOfflineMinutes = 0;
      snapshot.docs.forEach(doc => {
        const alert = doc.data();
        const offlineStart = alert.createdAt.toDate();
        const offlineEnd = alert.resolvedAt?.toDate() || new Date();
        const offlineMinutes = (offlineEnd.getTime() - offlineStart.getTime()) / 1000 / 60;
        totalOfflineMinutes += offlineMinutes;
      });

      const totalMinutes = hours * 60;
      const uptimePercent = ((totalMinutes - totalOfflineMinutes) / totalMinutes) * 100;

      return Math.max(0, Math.min(100, uptimePercent)); // Clamp 0-100
    } catch (indexError: any) {
      // If Firestore index missing, return 100% uptime (optimistic)
      if (indexError.code === 9 || indexError.message?.includes('index')) {
        logger.warn(`[Stations] Firestore index missing for uptime calculation - station ${stationId}. Returning 100% uptime.`);
        return 100;
      }
      throw indexError; // Re-throw other errors
    }
  } catch (error) {
    logger.error('[Stations] Calculate uptime error:', error);
    return 100; // Default to 100% if error
  }
}

export async function updateAllStationUptime(): Promise<void> {
  try {
    const stations = await getAllStations();
    
    for (const station of stations) {
      const daily = await calculateStationUptime(station.stationId, 'daily');
      const weekly = await calculateStationUptime(station.stationId, 'weekly');

      await db.collection('stations').doc(station.stationId).update({
        'uptime.daily': daily,
        'uptime.weekly': weekly,
      });
    }

    logger.info('[Stations] Uptime calculated for all stations', { count: stations.length });
  } catch (error) {
    logger.error('[Stations] Update uptime error:', error);
  }
}

// ==================== OFFLINE REMINDER EMAILS ====================

/**
 * Send reminder emails for stations that have been offline for > 6 hours
 * Called by cron job hourly
 */
export async function sendOfflineReminderEmails(): Promise<void> {
  try {
    const config = await getMonitoringConfig();
    const reminderCadence = config.email.offline.remindHours * 60 * 60 * 1000; // Convert hours to ms
    const now = new Date();

    // Get all active offline alerts
    const snapshot = await db.collection('station_alerts')
      .where('type', '==', 'offline')
      .where('resolved', '==', false)
      .get();

    let reminderCount = 0;
    
    for (const doc of snapshot.docs) {
      const alert = doc.data();
      const lastReminder = alert.meta?.lastReminderAt?.toDate();
      
      // Send reminder if:
      // 1. Email was previously sent (emailSent = true)
      // 2. Last reminder was > remindHours ago
      if (alert.meta?.emailSent && lastReminder) {
        const timeSinceReminder = now.getTime() - lastReminder.getTime();
        
        if (timeSinceReminder >= reminderCadence) {
          // Send reminder email
          const station = await getStation(alert.stationId);
          if (station && station.lastHeartbeatAt) {
            const lastHeartbeat = station.lastHeartbeatAt instanceof Date 
              ? station.lastHeartbeatAt 
              : new Date(station.lastHeartbeatAt);
            const minutesOffline = (now.getTime() - lastHeartbeat.getTime()) / 1000 / 60;
            await sendOfflineEmail(alert.stationId, minutesOffline);
            
            // Update last reminder timestamp
            await db.collection('station_alerts').doc(doc.id).update({
              'meta.lastReminderAt': Timestamp.now(),
            });
            
            reminderCount++;
          }
        }
      }
    }

    if (reminderCount > 0) {
      logger.info('[Stations] Sent offline reminder emails:', { count: reminderCount });
    }
  } catch (error) {
    logger.error('[Stations] Send reminder emails error:', error);
  }
}

// ==================== MAINTENANCE MODE ====================

/**
 * Set station maintenance mode
 * When enabled, all alerts are silenced
 */
export async function setMaintenanceMode(
  stationId: string,
  enabled: boolean,
  reason?: string,
  adminUid?: string
): Promise<void> {
  try {
    const updates: any = {
      status: enabled ? 'maintenance' : 'idle',
      lastStatusChangeAt: Timestamp.now(),
    };

    if (enabled) {
      updates.maintenance = {
        enabled: true,
        reason: reason || 'Scheduled maintenance',
        setBy: adminUid || 'system',
        setAt: Timestamp.now(),
      };
      
      // Auto-resolve all open alerts when entering maintenance
      await autoResolveAllAlerts(stationId);
    } else {
      // Remove maintenance field
      updates.maintenance = FieldValue.delete();
    }

    await db.collection('stations').doc(stationId).update(updates);

    // Log maintenance toggle
    await logStationEvent({
      stationId,
      timestamp: new Date(),
      eventType: 'maintenance_toggle',
      reason: enabled 
        ? `Maintenance mode enabled: ${reason || 'Scheduled maintenance'}` 
        : 'Maintenance mode disabled',
      meta: { enabled, adminUid },
    });

    logger.info('[Stations] Maintenance mode updated:', { stationId, enabled, reason });
    
    // Trigger status evaluation to update to idle/online
    if (!enabled) {
      await updateStationStatus(stationId);
    }
  } catch (error) {
    logger.error('[Stations] Set maintenance mode error:', error);
    throw error;
  }
}

/**
 * Auto-resolve all alerts for a station (used when entering maintenance)
 */
async function autoResolveAllAlerts(stationId: string): Promise<void> {
  try {
    const snapshot = await db.collection('station_alerts')
      .where('stationId', '==', stationId)
      .where('resolved', '==', false)
      .get();

    for (const doc of snapshot.docs) {
      await db.collection('station_alerts').doc(doc.id).update({
        resolved: true,
        resolvedAt: Timestamp.now(),
      });
    }

    // Reset alertsOpen counter
    if (!snapshot.empty) {
      await db.collection('stations').doc(stationId).update({
        alertsOpen: 0,
      });
      
      logger.info('[Stations] Auto-resolved all alerts for maintenance:', { 
        stationId, 
        count: snapshot.size 
      });
    }
  } catch (error) {
    logger.error('[Stations] Auto-resolve all alerts error:', error);
  }
}

// ==================== TESTING FRAMEWORK ====================

export interface MonitoringTestCase {
  id: string;
  name: string;
  scenario: string;
  inputs: {
    stationId: string;
    heartbeats?: { timestamp: Date; source: 'ping' | 'transaction' }[];
    transactions?: { timestamp: Date; status: string }[];
    weather?: { tempC: number; precipitation: boolean };
    maintenanceMode?: { enabled: boolean; reason?: string };
    configOverride?: Partial<MonitoringConfig>;
  };
  expected: {
    status: StationStatus;
    alertType?: string;
    emailSent?: boolean;
    suppressionActive?: boolean;
  };
  actual?: {
    status: StationStatus;
    alertsCreated: string[];
    emailsSent: number;
    suppressionActive: boolean;
    logs: string[];
  };
  timestamp: Date;
  passed?: boolean;
}

/**
 * Simulate heartbeats for a test station
 */
export async function simulateHeartbeats(
  stationId: string,
  heartbeats: { timestamp: Date; source: 'ping' | 'transaction' }[]
): Promise<void> {
  for (const hb of heartbeats) {
    await db.collection('stations').doc(stationId).update({
      lastHeartbeatAt: Timestamp.fromDate(hb.timestamp),
      ...(hb.source === 'transaction' && { lastTxnAt: Timestamp.fromDate(hb.timestamp) })
    });
    
    logger.info('[Test] Simulated heartbeat:', { stationId, source: hb.source, time: hb.timestamp });
  }
}

/**
 * Set weather conditions for a test station
 */
export async function setTestWeather(stationId: string, tempC: number, precipitation: boolean): Promise<void> {
  const weatherRef = db.collection('config').doc('weather');
  await weatherRef.set({
    [stationId]: { tempC, precipitation }
  }, { merge: true });
  
  logger.info('[Test] Set weather:', { stationId, tempC, precipitation });
}

/**
 * Apply per-station config override for testing
 */
export async function setTestConfigOverride(stationId: string, override: Partial<MonitoringConfig>): Promise<void> {
  await db.collection('stations').doc(stationId).update({
    monitoringOverrides: override
  });
  
  logger.info('[Test] Set config override:', { stationId, override });
}

/**
 * Reset test station to clean state
 */
export async function resetTestStation(stationId: string): Promise<void> {
  const now = Timestamp.now();
  
  // Reset station state
  await db.collection('stations').doc(stationId).update({
    status: 'online',
    lastHeartbeatAt: now,
    lastTxnAt: now,
    lastStatusChangeAt: now,
    alertsOpen: 0,
    maintenance: FieldValue.delete(),
    monitoringOverrides: FieldValue.delete()
  });
  
  // Clear alerts
  const alertsSnapshot = await db.collection('station_alerts')
    .where('stationId', '==', stationId)
    .get();
  
  for (const doc of alertsSnapshot.docs) {
    await doc.ref.delete();
  }
  
  // Clear events
  const eventsSnapshot = await db.collection('station_events')
    .where('stationId', '==', stationId)
    .get();
  
  for (const doc of eventsSnapshot.docs) {
    await doc.ref.delete();
  }
  
  // Clear weather
  const weatherRef = db.collection('config').doc('weather');
  await weatherRef.update({
    [stationId]: FieldValue.delete()
  });
  
  logger.info('[Test] Reset station:', { stationId });
}

/**
 * Run a monitoring test case
 */
export async function runMonitoringTest(testCase: MonitoringTestCase): Promise<MonitoringTestCase> {
  try {
    logger.info('[Test] Starting test case:', { id: testCase.id, name: testCase.name });
    
    // Reset station to clean state
    await resetTestStation(testCase.inputs.stationId);
    
    // Apply config overrides if specified
    if (testCase.inputs.configOverride) {
      await setTestConfigOverride(testCase.inputs.stationId, testCase.inputs.configOverride);
    }
    
    // Set weather conditions if specified
    if (testCase.inputs.weather) {
      await setTestWeather(
        testCase.inputs.stationId,
        testCase.inputs.weather.tempC,
        testCase.inputs.weather.precipitation
      );
    }
    
    // Simulate heartbeats
    if (testCase.inputs.heartbeats) {
      await simulateHeartbeats(testCase.inputs.stationId, testCase.inputs.heartbeats);
    }
    
    // Set maintenance mode if specified
    if (testCase.inputs.maintenanceMode) {
      await setMaintenanceMode(
        testCase.inputs.stationId,
        testCase.inputs.maintenanceMode.enabled,
        testCase.inputs.maintenanceMode.reason,
        'test-admin'
      );
    }
    
    // Trigger status evaluation
    await updateStationStatus(testCase.inputs.stationId);
    
    // Collect actual results
    const stationDoc = await db.collection('stations').doc(testCase.inputs.stationId).get();
    const station = stationDoc.data() as Station;
    
    const alertsSnapshot = await db.collection('station_alerts')
      .where('stationId', '==', testCase.inputs.stationId)
      .where('resolved', '==', false)
      .get();
    
    const eventsSnapshot = await db.collection('station_events')
      .where('stationId', '==', testCase.inputs.stationId)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    const weatherDoc = await db.collection('config').doc('weather').get();
    const weatherData = weatherDoc.data()?.[testCase.inputs.stationId];
    const config = await getMonitoringConfig();
    const suppressionActive = weatherData ? await shouldSuppressLowActivity(testCase.inputs.stationId, config) : false;
    
    testCase.actual = {
      status: station.status,
      alertsCreated: alertsSnapshot.docs.map(d => d.data().type),
      emailsSent: alertsSnapshot.docs.filter(d => d.data().meta?.emailSent).length,
      suppressionActive,
      logs: eventsSnapshot.docs.map(d => {
        const e = d.data();
        return `${e.eventType}: ${e.previousStatus || ''}→${e.newStatus || ''} (${e.reason || ''})`;
      })
    };
    
    // Check if test passed
    testCase.passed = testCase.actual.status === testCase.expected.status &&
      (!testCase.expected.alertType || testCase.actual.alertsCreated.includes(testCase.expected.alertType)) &&
      (testCase.expected.emailSent === undefined || (testCase.actual.emailsSent > 0) === testCase.expected.emailSent) &&
      (testCase.expected.suppressionActive === undefined || testCase.actual.suppressionActive === testCase.expected.suppressionActive);
    
    logger.info('[Test] Completed test case:', { 
      id: testCase.id, 
      passed: testCase.passed,
      expected: testCase.expected,
      actual: testCase.actual
    });
    
    // Store test result
    await db.collection('monitoring_tests').doc(testCase.id).set({
      ...testCase,
      timestamp: Timestamp.fromDate(testCase.timestamp)
    });
    
    return testCase;
  } catch (error) {
    logger.error('[Test] Test case failed:', error);
    testCase.passed = false;
    testCase.actual = {
      status: 'online',
      alertsCreated: [],
      emailsSent: 0,
      suppressionActive: false,
      logs: [`Error: ${error instanceof Error ? error.message : String(error)}`]
    };
    return testCase;
  }
}

/**
 * Define acceptance tests A-G as per specification
 */
export function getAcceptanceTestCases(testStationId: string = 'TEST-001'): MonitoringTestCase[] {
  const now = new Date();
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

  return [
    // Test A: Quiet Day, Winter Evening
    {
      id: `test-a-${Date.now()}`,
      name: 'Test A: Quiet Day',
      scenario: 'Heartbeats every 2-3min, no transactions for 5 hours (quiet hours)',
      inputs: {
        stationId: testStationId,
        heartbeats: [
          { timestamp: minutesAgo(2), source: 'ping' },
          { timestamp: minutesAgo(5), source: 'ping' },
          { timestamp: hoursAgo(5), source: 'transaction' }, // Last txn 5 hours ago
        ],
        weather: { tempC: 8, precipitation: false }, // Winter evening
      },
      expected: {
        status: 'idle', // Or warning_low_activity depending on suppression
        emailSent: false,
        suppressionActive: true, // Weather suppression for cold
      },
      timestamp: now,
    },

    // Test B: Busy Hour Gap
    {
      id: `test-b-${Date.now()}`,
      name: 'Test B: Busy Hour Gap',
      scenario: '2 hours no transactions during 10:00-12:00 (busy hours)',
      inputs: {
        stationId: testStationId,
        heartbeats: [
          { timestamp: minutesAgo(2), source: 'ping' },
          { timestamp: hoursAgo(2), source: 'transaction' }, // Last txn 2 hours ago
        ],
      },
      expected: {
        status: 'warning_low_activity',
        alertType: 'warning_low_activity',
        emailSent: false, // Dashboard only
        suppressionActive: false,
      },
      timestamp: now,
    },

    // Test C: Hard Offline
    {
      id: `test-c-${Date.now()}`,
      name: 'Test C: Hard Offline',
      scenario: 'Stop heartbeat for 40 minutes (exceeds 30min threshold)',
      inputs: {
        stationId: testStationId,
        heartbeats: [
          { timestamp: minutesAgo(40), source: 'transaction' }, // Last heartbeat 40min ago
        ],
      },
      expected: {
        status: 'offline',
        alertType: 'offline',
        emailSent: true, // Immediate email
        suppressionActive: false,
      },
      timestamp: now,
    },

    // Test D: Recovery
    {
      id: `test-d-${Date.now()}`,
      name: 'Test D: Recovery',
      scenario: 'Heartbeat resumes after offline period',
      inputs: {
        stationId: testStationId,
        heartbeats: [
          { timestamp: minutesAgo(40), source: 'ping' }, // Was offline
          { timestamp: minutesAgo(2), source: 'ping' }, // Now back online
        ],
      },
      expected: {
        status: 'online',
        emailSent: true, // Recovery email
        suppressionActive: false,
      },
      timestamp: now,
    },

    // Test E: Weather Suppression
    {
      id: `test-e-${Date.now()}`,
      name: 'Test E: Weather Suppression',
      scenario: 'Temp 38°C, no transactions 3 hours, heartbeats OK',
      inputs: {
        stationId: testStationId,
        heartbeats: [
          { timestamp: minutesAgo(2), source: 'ping' },
          { timestamp: hoursAgo(3), source: 'transaction' }, // Last txn 3 hours ago
        ],
        weather: { tempC: 38, precipitation: false }, // Heat suppression
      },
      expected: {
        status: 'idle', // NOT warning_low_activity
        emailSent: false,
        suppressionActive: true,
      },
      timestamp: now,
    },

    // Test F: Maintenance Mode
    {
      id: `test-f-${Date.now()}`,
      name: 'Test F: Maintenance Mode',
      scenario: 'Station in maintenance mode - no alerts',
      inputs: {
        stationId: testStationId,
        heartbeats: [
          { timestamp: minutesAgo(60), source: 'ping' }, // Would be offline
        ],
        maintenanceMode: { enabled: true, reason: 'Hardware upgrade' },
      },
      expected: {
        status: 'maintenance',
        emailSent: false, // No alerts in maintenance
        suppressionActive: false,
      },
      timestamp: now,
    },

    // Test G: Per-Station Override
    {
      id: `test-g-${Date.now()}`,
      name: 'Test G: Per-Station Override',
      scenario: 'IL-001 has custom 45min offline threshold (not 30min)',
      inputs: {
        stationId: testStationId,
        heartbeats: [
          { timestamp: minutesAgo(35), source: 'ping' }, // 35min ago
        ],
        configOverride: {
          offlineThreshold: 45, // Custom threshold
        } as Partial<MonitoringConfig>,
      },
      expected: {
        status: 'online', // Still online because 35 < 45
        emailSent: false,
        suppressionActive: false,
      },
      timestamp: now,
    },
  ];
}

/**
 * Run all acceptance tests A-G
 */
export async function runAllAcceptanceTests(testStationId: string = 'TEST-001'): Promise<MonitoringTestCase[]> {
  const testCases = getAcceptanceTestCases(testStationId);
  const results: MonitoringTestCase[] = [];

  logger.info('[Test] Running all acceptance tests A-G', { count: testCases.length, testStationId });

  for (const testCase of testCases) {
    const result = await runMonitoringTest(testCase);
    results.push(result);
    
    // Wait 1 second between tests to avoid race conditions
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const passedCount = results.filter(r => r.passed).length;
  logger.info('[Test] Acceptance tests completed', { 
    total: results.length, 
    passed: passedCount, 
    failed: results.length - passedCount 
  });

  return results;
}

// ==================== DAILY REPORTING ====================

export interface StationDailyAnalytics {
  stationId: string;
  label: string;
  currentStatus: StationStatus;
  uptimePercent: number;
  offlineIncidents: {
    count: number;
    totalMinutes: number;
  };
  weatherSuppressedWarnings: number;
  lastHeartbeatAt: Date | null;
  lastTxnAt: Date | null;
}

/**
 * Get 24-hour station analytics for daily report
 * Queries station_events to aggregate metrics
 */
export async function getStationAnalyticsFor24Hours(): Promise<StationDailyAnalytics[]> {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get all stations
    const stationsSnapshot = await db.collection('stations').get();
    const analytics: StationDailyAnalytics[] = [];

    for (const stationDoc of stationsSnapshot.docs) {
      const station = stationDoc.data() as Station;

      // Query station events for last 24 hours
      const eventsSnapshot = await db.collection('station_events')
        .where('stationId', '==', station.stationId)
        .where('timestamp', '>=', Timestamp.fromDate(yesterday))
        .orderBy('timestamp', 'asc')
        .get();

      // Calculate offline incidents and duration
      let offlineCount = 0;
      let totalOfflineMinutes = 0;
      let weatherSuppressedCount = 0;
      let lastOfflineTimestamp: Date | null = null;

      eventsSnapshot.docs.forEach((eventDoc, index) => {
        const event = eventDoc.data();

        // Count transitions TO offline
        if (event.eventType === 'status_change' && event.newStatus === 'offline') {
          offlineCount++;
          lastOfflineTimestamp = event.timestamp?.toDate() || new Date();
        }

        // Calculate offline duration (when transitioning FROM offline)
        if (event.eventType === 'status_change' && event.previousStatus === 'offline' && lastOfflineTimestamp) {
          const recoveryTime = event.timestamp?.toDate() || new Date();
          const durationMinutes = Math.floor((recoveryTime.getTime() - lastOfflineTimestamp.getTime()) / 60000);
          totalOfflineMinutes += durationMinutes;
          lastOfflineTimestamp = null;
        }

        // Count weather-suppressed warnings
        if (event.eventType === 'status_change' && 
            event.newStatus === 'idle' && 
            event.suppressionFlags?.weather === true) {
          weatherSuppressedCount++;
        }
      });

      // If still offline, add duration from last offline to now
      if (station.status === 'offline' && lastOfflineTimestamp) {
        const durationMinutes = Math.floor((now.getTime() - lastOfflineTimestamp.getTime()) / 60000);
        totalOfflineMinutes += durationMinutes;
      }

      // Use uptime from station (calculated by updateAllStationUptime)
      const uptimePercent = station.uptime?.daily ?? 0;

      analytics.push({
        stationId: station.stationId,
        label: station.label,
        currentStatus: station.status,
        uptimePercent,
        offlineIncidents: {
          count: offlineCount,
          totalMinutes: totalOfflineMinutes,
        },
        weatherSuppressedWarnings: weatherSuppressedCount,
        lastHeartbeatAt: station.lastHeartbeatAt ? new Date(station.lastHeartbeatAt) : null,
        lastTxnAt: station.lastTxnAt ? new Date(station.lastTxnAt) : null,
      });
    }

    return analytics.sort((a, b) => a.stationId.localeCompare(b.stationId));
  } catch (error) {
    logger.error('[Stations] Failed to get 24h analytics:', error);
    return [];
  }
}
