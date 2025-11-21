/**
 * ===================================================================
 * PET WASH™ K9000 LED ECOSYSTEM - 7-STAR LUXURY VISUAL UX
 * ===================================================================
 * Complete LED automation and control system for K9000 wash stations
 * Integrates: IoT hardware, wash sessions, driver dispatch, admin control
 * 
 * Features (A + C):
 * - Smart automation based on wash lifecycle
 * - Driver proximity triggers (GPS-based)
 * - Manual admin override with auto-expiry
 * - Real-time hardware bridge (MQTT/WebSocket/TCP ready)
 * - Complete audit trail for compliance
 * ===================================================================
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import type { EventEmitter } from 'events';
import { db } from '../db';
import { k9000LedStatus, k9000LedCommandHistory, petWashStations } from '../../shared/schema-enterprise';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

/**
 * LED State Machine - 7-Star UX States
 */
export enum LedState {
  OFF = 'OFF',
  AVAILABLE = 'AVAILABLE',
  DRIVER_ON_ROUTE = 'DRIVER_ON_ROUTE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE',
  ERROR = 'ERROR',
  PAUSED = 'PAUSED'
}

export type LedPattern =
  | 'SOLID'
  | 'PULSE_SLOW'
  | 'PULSE_MEDIUM'
  | 'PULSE_FAST'
  | 'FLASH_SLOW'
  | 'FLASH_FAST'
  | 'BREATH'
  | 'RAINBOW';

export type LedColor =
  | 'GREEN'
  | 'BLUE'
  | 'YELLOW'
  | 'RED'
  | 'WHITE'
  | 'PURPLE'
  | 'CYAN'
  | 'OFF';

export interface LedStatus {
  stationId: number;
  state: LedState;
  color: LedColor;
  pattern: LedPattern;
  lastUpdatedAt: string;
  source: 'AUTOMATION' | 'MANUAL' | 'SYSTEM';
  manualOverride: boolean;
  manualExpiresAt?: string | null;
  reason?: string;
}

/**
 * Event types for LED automation
 */
export interface WashSessionEvent {
  stationId: number;
  sessionId: string;
  status: 'CREATED' | 'WAITING_FOR_CUSTOMER' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
}

export interface DriverEvent {
  stationId: number;
  driverId: string;
  status: 'ASSIGNED' | 'ON_ROUTE' | 'ARRIVED' | 'CANCELLED';
  etaMinutes?: number | null;
}

/**
 * ===================================================================
 * LED VISUAL MAPPING - Color & Pattern Logic
 * ===================================================================
 */

function mapStateToVisual(state: LedState): { color: LedColor; pattern: LedPattern } {
  switch (state) {
    case LedState.AVAILABLE:
      return { color: 'GREEN', pattern: 'SOLID' };
    case LedState.DRIVER_ON_ROUTE:
      return { color: 'BLUE', pattern: 'PULSE_SLOW' };
    case LedState.IN_USE:
      return { color: 'YELLOW', pattern: 'FLASH_SLOW' };
    case LedState.MAINTENANCE:
      return { color: 'PURPLE', pattern: 'PULSE_MEDIUM' };
    case LedState.ERROR:
      return { color: 'RED', pattern: 'FLASH_FAST' };
    case LedState.PAUSED:
      return { color: 'CYAN', pattern: 'BREATH' };
    case LedState.OFF:
    default:
      return { color: 'OFF', pattern: 'SOLID' };
  }
}

/**
 * ===================================================================
 * AUTOMATION BRAIN - Smart LED State Decision Engine
 * ===================================================================
 */

interface AutomationContext {
  station: any; // petWashStations record
  lastLed: LedStatus | null;
  lastWashEvent?: WashSessionEvent | null;
  lastDriverEvent?: DriverEvent | null;
}

function decideLedState(context: AutomationContext): LedState {
  const { station, lastWashEvent, lastDriverEvent } = context;

  // Priority 1: Hard stop - station offline or critical error
  if (station.operationalStatus === 'offline' || station.healthStatus === 'critical') {
    return LedState.ERROR;
  }

  // Priority 2: Maintenance mode
  if (station.operationalStatus === 'maintenance') {
    return LedState.MAINTENANCE;
  }

  // Priority 3: Driver in motion (GPS triggered)
  if (lastDriverEvent && ['ASSIGNED', 'ON_ROUTE'].includes(lastDriverEvent.status)) {
    return LedState.DRIVER_ON_ROUTE;
  }

  // Priority 4: Driver arrived, ready for wash
  if (lastDriverEvent && lastDriverEvent.status === 'ARRIVED') {
    if (lastWashEvent && lastWashEvent.status === 'IN_PROGRESS') {
      return LedState.IN_USE;
    }
    return LedState.AVAILABLE;
  }

  // Priority 5: Wash session lifecycle
  if (lastWashEvent) {
    if (lastWashEvent.status === 'IN_PROGRESS') {
      return LedState.IN_USE;
    }
    if (lastWashEvent.status === 'WAITING_FOR_CUSTOMER') {
      return LedState.AVAILABLE;
    }
    if (lastWashEvent.status === 'ERROR') {
      return LedState.ERROR;
    }
  }

  // Priority 6: Default - station is online and healthy
  return station.operationalStatus === 'active' ? LedState.AVAILABLE : LedState.OFF;
}

function buildLedStatus(
  stationId: number,
  state: LedState,
  source: 'AUTOMATION' | 'MANUAL' | 'SYSTEM',
  prev?: LedStatus | null,
  reason?: string
): LedStatus {
  const { color, pattern } = mapStateToVisual(state);
  return {
    stationId,
    state,
    color,
    pattern,
    lastUpdatedAt: new Date().toISOString(),
    source,
    manualOverride: prev?.manualOverride ?? false,
    manualExpiresAt: prev?.manualExpiresAt ?? null,
    reason: reason ?? prev?.reason
  };
}

/**
 * ===================================================================
 * HARDWARE BRIDGE - Send commands to physical LED hardware
 * ===================================================================
 * This is where you integrate MQTT, WebSocket, TCP, or HTTP to the K9000 hardware
 */

export interface HardwareBridge {
  sendLedCommand(stationId: number, status: LedStatus): Promise<void>;
}

export class K9000HardwareBridge implements HardwareBridge {
  async sendLedCommand(stationId: number, status: LedStatus): Promise<void> {
    try {
      // TODO: Implement actual hardware communication
      // Example integrations:
      // 1. MQTT: await mqttClient.publish(`k9000/station/${stationId}/led`, JSON.stringify(status))
      // 2. WebSocket: await wsClient.send(`station-${stationId}`, 'led-command', status)
      // 3. HTTP: await axios.post(`http://station-${stationId}.local/api/led`, status)
      // 4. TCP: await tcpClient.send(stationId, { command: 'LED_SET', ...status })
      
      logger.info('[K9000 LED] Hardware command sent', {
        stationId,
        state: status.state,
        color: status.color,
        pattern: status.pattern
      });

      // Simulate hardware response time
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      logger.error('[K9000 LED] Hardware command failed', { error, stationId, status });
      throw error;
    }
  }
}

/**
 * ===================================================================
 * LED SERVICE - Core business logic
 * ===================================================================
 */

export class LedService {
  private hardwareBridge: HardwareBridge;

  constructor(hardwareBridge: HardwareBridge) {
    this.hardwareBridge = hardwareBridge;
  }

  async getStatus(stationId: number): Promise<LedStatus> {
    try {
      const [row] = await db
        .select()
        .from(k9000LedStatus)
        .where(eq(k9000LedStatus.stationId, stationId))
        .limit(1);

      if (row) {
        return {
          stationId: row.stationId,
          state: row.state as LedState,
          color: row.color as LedColor,
          pattern: row.pattern as LedPattern,
          lastUpdatedAt: row.lastUpdatedAt.toISOString(),
          source: row.source as 'AUTOMATION' | 'MANUAL' | 'SYSTEM',
          manualOverride: row.manualOverride,
          manualExpiresAt: row.manualExpiresAt?.toISOString() ?? null,
          reason: row.reason ?? undefined
        };
      }

      // Default state for new stations
      const defaultStatus: LedStatus = {
        stationId,
        state: LedState.OFF,
        color: 'OFF',
        pattern: 'SOLID',
        lastUpdatedAt: new Date().toISOString(),
        source: 'SYSTEM',
        manualOverride: false,
        manualExpiresAt: null,
        reason: 'Default initial state'
      };

      return defaultStatus;
    } catch (error) {
      logger.error('[LED Service] getStatus failed', { error, stationId });
      throw error;
    }
  }

  async setManual(
    stationId: number,
    requestedState: LedState,
    overrideMinutes: number | null,
    actorEmail: string
  ): Promise<LedStatus> {
    try {
      const current = await this.getStatus(stationId);
      const expiresAt =
        overrideMinutes && overrideMinutes > 0
          ? new Date(Date.now() + overrideMinutes * 60_000).toISOString()
          : null;

      const status: LedStatus = {
        ...buildLedStatus(stationId, requestedState, 'MANUAL', current, `Manual override by ${actorEmail}`),
        manualOverride: true,
        manualExpiresAt: expiresAt
      };

      await this.saveStatus(status, current);
      await this.hardwareBridge.sendLedCommand(stationId, status);

      // Log command history
      await this.logCommandHistory(stationId, 'SET_MANUAL', current, status, actorEmail);

      logger.info('[LED Service] Manual override set', {
        stationId,
        state: status.state,
        expiresAt,
        actorEmail
      });

      return status;
    } catch (error) {
      logger.error('[LED Service] setManual failed', { error, stationId, requestedState, actorEmail });
      throw error;
    }
  }

  async clearManual(stationId: number): Promise<LedStatus> {
    try {
      const current = await this.getStatus(stationId);
      const cleared: LedStatus = {
        ...current,
        manualOverride: false,
        manualExpiresAt: null,
        source: 'SYSTEM',
        lastUpdatedAt: new Date().toISOString(),
        reason: 'Manual override cleared'
      };

      await this.saveStatus(cleared, current);
      await this.hardwareBridge.sendLedCommand(stationId, cleared);
      await this.logCommandHistory(stationId, 'CLEAR_MANUAL', current, cleared, 'system');

      logger.info('[LED Service] Manual override cleared', { stationId });

      return cleared;
    } catch (error) {
      logger.error('[LED Service] clearManual failed', { error, stationId });
      throw error;
    }
  }

  private manualExpired(status: LedStatus): boolean {
    if (!status.manualOverride || !status.manualExpiresAt) return false;
    return new Date(status.manualExpiresAt).getTime() < Date.now();
  }

  async applyAutomation(stationId: number, ctx: Omit<AutomationContext, 'lastLed'>): Promise<LedStatus> {
    try {
      const current = await this.getStatus(stationId);

      // Respect manual override unless expired
      if (current.manualOverride && !this.manualExpired(current)) {
        logger.debug('[LED Service] Manual override active, skipping automation', {
          stationId,
          expiresAt: current.manualExpiresAt
        });
        return current;
      }

      if (this.manualExpired(current)) {
        await this.clearManual(stationId);
      }

      const fullCtx: AutomationContext = { ...ctx, lastLed: current };
      const nextState = decideLedState(fullCtx);
      const status = buildLedStatus(stationId, nextState, 'AUTOMATION', current, 'Automation update');

      await this.saveStatus(status, current);
      await this.hardwareBridge.sendLedCommand(stationId, status);
      await this.logCommandHistory(stationId, 'AUTOMATION_UPDATE', current, status, 'automation-engine');

      logger.info('[LED Service] Automation applied', {
        stationId,
        previousState: current.state,
        newState: status.state
      });

      return status;
    } catch (error) {
      logger.error('[LED Service] applyAutomation failed', { error, stationId });
      throw error;
    }
  }

  async markError(stationId: number, reason: string): Promise<LedStatus> {
    try {
      const current = await this.getStatus(stationId);
      const status = buildLedStatus(stationId, LedState.ERROR, 'SYSTEM', current, reason);

      await this.saveStatus(status, current);
      await this.hardwareBridge.sendLedCommand(stationId, status);
      await this.logCommandHistory(stationId, 'ERROR_SIGNAL', current, status, 'system-health-monitor');

      logger.warn('[LED Service] Error state set', { stationId, reason });

      return status;
    } catch (error) {
      logger.error('[LED Service] markError failed', { error, stationId, reason });
      throw error;
    }
  }

  async markOffline(stationId: number, reason = 'Station offline'): Promise<LedStatus> {
    try {
      const current = await this.getStatus(stationId);
      const status = buildLedStatus(stationId, LedState.OFF, 'SYSTEM', current, reason);

      await this.saveStatus(status, current);
      await this.hardwareBridge.sendLedCommand(stationId, status);
      await this.logCommandHistory(stationId, 'SET_OFFLINE', current, status, 'system-health-monitor');

      logger.info('[LED Service] Station marked offline', { stationId, reason });

      return status;
    } catch (error) {
      logger.error('[LED Service] markOffline failed', { error, stationId, reason });
      throw error;
    }
  }

  private async saveStatus(status: LedStatus, previous: LedStatus): Promise<void> {
    const data = {
      stationId: status.stationId,
      state: status.state,
      color: status.color,
      pattern: status.pattern,
      source: status.source,
      manualOverride: status.manualOverride,
      manualExpiresAt: status.manualExpiresAt ? new Date(status.manualExpiresAt) : null,
      manualSetBy: status.source === 'MANUAL' ? status.reason?.split('by ')[1] : null,
      reason: status.reason ?? null,
      lastUpdatedAt: new Date(status.lastUpdatedAt),
      updatedAt: new Date()
    };

    const [existing] = await db.select().from(k9000LedStatus).where(eq(k9000LedStatus.stationId, status.stationId)).limit(1);

    if (existing) {
      await db.update(k9000LedStatus).set(data).where(eq(k9000LedStatus.stationId, status.stationId));
    } else {
      await db.insert(k9000LedStatus).values(data);
    }
  }

  private async logCommandHistory(
    stationId: number,
    commandType: string,
    previous: LedStatus,
    current: LedStatus,
    triggeredBy: string
  ): Promise<void> {
    try {
      await db.insert(k9000LedCommandHistory).values({
        stationId,
        commandType,
        previousState: previous.state,
        newState: current.state,
        previousColor: previous.color,
        newColor: current.color,
        previousPattern: previous.pattern,
        newPattern: current.pattern,
        triggeredBy,
        reason: current.reason ?? null,
        success: true,
        errorMessage: null,
        responseTimeMs: null
      });
    } catch (error) {
      logger.error('[LED Service] Failed to log command history', { error, stationId, commandType });
    }
  }
}

/**
 * ===================================================================
 * EXPRESS ROUTES - API Endpoints
 * ===================================================================
 */

export interface LedRouterDeps {
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
}

export function createLedRouter(deps: LedRouterDeps): Router {
  const { requireAuth, requireAdmin } = deps;
  const router = Router();
  const hardwareBridge = new K9000HardwareBridge();
  const ledService = new LedService(hardwareBridge);

  // Legacy route: /api/led (kept for backward compatibility)
  router.get('/led', requireAuth, async (req: Request, res: Response) => {
    try {
      const stationId = parseInt(String(req.query.stationId || ''), 10);
      if (!stationId || isNaN(stationId)) {
        return res.status(400).json({ error: 'stationId query param is required and must be a number' });
      }
      const status = await ledService.getStatus(stationId);
      res.json(status);
    } catch (err: any) {
      logger.error('GET /api/led error', { error: err, query: req.query });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get LED status for specific station
  router.get('/stations/:stationId/led', requireAuth, async (req: Request, res: Response) => {
    try {
      const stationId = parseInt(req.params.stationId, 10);
      const status = await ledService.getStatus(stationId);
      res.json(status);
    } catch (err: any) {
      logger.error('GET /stations/:stationId/led error', { error: err, params: req.params });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin manual override
  router.post('/stations/:stationId/led/manual', requireAdmin, async (req: Request, res: Response) => {
    try {
      const stationId = parseInt(req.params.stationId, 10);
      const { state, overrideMinutes } = req.body;

      if (!state || !(Object.values(LedState) as string[]).includes(state)) {
        return res.status(400).json({ error: 'Invalid or missing LED state' });
      }

      const actorEmail = (req as any).user?.email || 'unknown@petwash.co.il';

      const status = await ledService.setManual(
        stationId,
        state as LedState,
        typeof overrideMinutes === 'number' ? overrideMinutes : null,
        actorEmail
      );

      res.json(status);
    } catch (err: any) {
      logger.error('POST /stations/:stationId/led/manual error', { error: err, params: req.params, body: req.body });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Clear manual override
  router.post('/stations/:stationId/led/manual/clear', requireAdmin, async (req: Request, res: Response) => {
    try {
      const stationId = parseInt(req.params.stationId, 10);
      const status = await ledService.clearManual(stationId);
      res.json(status);
    } catch (err: any) {
      logger.error('POST /stations/:stationId/led/manual/clear error', { error: err, params: req.params });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

/**
 * ===================================================================
 * EVENT BUS AUTOMATION WIRING (A + C Integration)
 * ===================================================================
 * Wire LED automation to Pet Wash™ EventBus for smart triggers
 */

export function wireLedAutomation(eventBus: EventEmitter): void {
  const hardwareBridge = new K9000HardwareBridge();
  const ledService = new LedService(hardwareBridge);

  // Wash session events
  eventBus.on('wash.started', async (event: any) => {
    try {
      const stationId = event.data?.stationId;
      if (!stationId) return;

      const [station] = await db.select().from(petWashStations).where(eq(petWashStations.id, stationId)).limit(1);
      if (!station) return;

      await ledService.applyAutomation(stationId, {
        station,
        lastWashEvent: {
          stationId,
          sessionId: event.data.sessionId,
          status: 'IN_PROGRESS'
        }
      });
    } catch (err) {
      logger.error('[LED Automation] wash.started failed', { error: err, event });
    }
  });

  eventBus.on('wash.completed', async (event: any) => {
    try {
      const stationId = event.data?.stationId;
      if (!stationId) return;

      const [station] = await db.select().from(petWashStations).where(eq(petWashStations.id, stationId)).limit(1);
      if (!station) return;

      await ledService.applyAutomation(stationId, {
        station,
        lastWashEvent: {
          stationId,
          sessionId: event.data.sessionId,
          status: 'COMPLETED'
        }
      });
    } catch (err) {
      logger.error('[LED Automation] wash.completed failed', { error: err, event });
    }
  });

  // Driver dispatch events
  eventBus.on('transport.assigned', async (event: any) => {
    try {
      const stationId = event.data?.stationId;
      if (!stationId) return;

      const [station] = await db.select().from(petWashStations).where(eq(petWashStations.id, stationId)).limit(1);
      if (!station) return;

      await ledService.applyAutomation(stationId, {
        station,
        lastDriverEvent: {
          stationId,
          driverId: event.data.driverId,
          status: 'ASSIGNED',
          etaMinutes: event.data.etaMinutes
        }
      });
    } catch (err) {
      logger.error('[LED Automation] transport.assigned failed', { error: err, event });
    }
  });

  eventBus.on('transport.pickup', async (event: any) => {
    try {
      const stationId = event.data?.stationId;
      if (!stationId) return;

      const [station] = await db.select().from(petWashStations).where(eq(petWashStations.id, stationId)).limit(1);
      if (!station) return;

      await ledService.applyAutomation(stationId, {
        station,
        lastDriverEvent: {
          stationId,
          driverId: event.data.driverId,
          status: 'ARRIVED'
        }
      });
    } catch (err) {
      logger.error('[LED Automation] transport.pickup failed', { error: err, event });
    }
  });

  // Station health events
  eventBus.on('station.offline', async (stationId: number) => {
    try {
      await ledService.markOffline(stationId, 'Station reported offline');
    } catch (err) {
      logger.error('[LED Automation] station.offline failed', { error: err, stationId });
    }
  });

  eventBus.on('station.error', async (data: { stationId: number; reason: string }) => {
    try {
      await ledService.markError(data.stationId, data.reason || 'Station error detected');
    } catch (err) {
      logger.error('[LED Automation] station.error failed', { error: err, data });
    }
  });

  logger.info('[K9000 LED] Automation wiring complete - Smart LED triggers active! 🚀');
}
