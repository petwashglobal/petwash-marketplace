/**
 * Admin Nayax Lynx — control + read-only operational endpoints.
 *
 * Surfaces the Lynx integration (machine inventory, device status, restock pick
 * lists) to the admin UI WITHOUT touching customer money. Mirrors admin-sumit:
 * super-admin only; env-presence booleans only (NEVER the token); a real
 * connection test that proves the token works the moment it is saved.
 *
 *   GET  /api/admin/lynx/health                  → wired status + env presence
 *   POST /api/admin/lynx/connection-test         → one real authed Lynx call
 *   GET  /api/admin/lynx/machine/:id/products    → a machine's planogram + stock
 *   GET  /api/admin/lynx/device/:id              → device status (station health)
 *   POST /api/admin/lynx/machine/:id/pick-list   → generate a restock pick list
 *
 * DARK until LYNX_ENABLED=true + LYNX_USER_TOKEN set (the client no-ops otherwise).
 * Super-admin so a compromised regular-admin cannot enumerate which secrets are
 * configured or pull operator inventory. 404 (not 403) on non-super-admin.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, checkAccessLevel, isSuperAdminVerified } from '../middleware/rbac';
import { LynxClient } from '../services/LynxClient';
import { LynxCardService } from '../services/LynxCardService';
import { logger } from '../lib/logger';

const router = Router();

function requireSuperAdminGate(_req: Request, res: Response, next: NextFunction) {
  if (!isSuperAdminVerified(_req)) return res.status(404).json({ error: 'Not found' });
  next();
}
const requireSuperAdmin = [validateFirebaseToken, loadUserRole, checkAccessLevel(8), requireSuperAdminGate];

async function audit(req: Request, eventType: string, metadata: Record<string, unknown>) {
  try {
    const { recordAuditEvent } = await import('../utils/auditSignature');
    await recordAuditEvent({
      eventType,
      customerUid: (req as any).userRecord?.uid || (req as any).firebaseUser?.uid || 'admin',
      metadata,
      ipAddress: req.ip || null,
      userAgent: '[AdminLynx]',
    });
  } catch (e: any) {
    logger.warn('[AdminLynx] audit failed (continuing)', { eventType, err: e?.message });
  }
}

// Env-presence booleans only — never the token value.
function envFlags() {
  return {
    lynxEnabled: (process.env.LYNX_ENABLED || '').trim().toLowerCase() === 'true',
    lynxUserToken: Boolean(process.env.LYNX_USER_TOKEN),
    lynxOperatorId: Boolean(process.env.LYNX_OPERATOR_ID),
    lynxTestMachineId: Boolean(process.env.LYNX_TEST_MACHINE_ID),
  };
}

router.get('/health', ...requireSuperAdmin, (_req: Request, res: Response) => {
  try {
    return res.json({ ...LynxClient.health(), env: envFlags() });
  } catch (err: any) {
    logger.error('[AdminLynx] health failed', { err: err?.message });
    return res.status(500).json({ error: 'Health check failed' });
  }
});

router.post('/connection-test', ...requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await LynxClient.connectionTest();
    await audit(req, 'lynx.connection_test', { ok: result.ok, status: result.status, wired: result.wired, sandbox: result.sandbox });
    return res.json(result); // structured verdict; UI renders ok vs reason. Never the token.
  } catch (err: any) {
    logger.error('[AdminLynx] connection-test failed', { err: err?.message });
    return res.status(500).json({ ok: false, wired: false, error: 'connection_test_crashed' });
  }
});

router.get('/machine/:machineId/products', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const machineId = String(req.params.machineId || '').trim();
  if (!machineId) return res.status(400).json({ error: 'machineId required' });
  try {
    return res.json(await LynxClient.getMachineProducts(machineId));
  } catch (err: any) {
    logger.error('[AdminLynx] machine products failed', { err: err?.message });
    return res.status(500).json({ error: 'Lynx machine products failed' });
  }
});

router.get('/device/:deviceId', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const deviceId = String(req.params.deviceId || '').trim();
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  try {
    return res.json(await LynxClient.getDevice(deviceId));
  } catch (err: any) {
    logger.error('[AdminLynx] device status failed', { err: err?.message });
    return res.status(500).json({ error: 'Lynx device status failed' });
  }
});

// Inventory/logistics action (NOT money) — audited.
router.post('/machine/:machineId/pick-list', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const machineId = String(req.params.machineId || '').trim();
  if (!machineId) return res.status(400).json({ error: 'machineId required' });
  try {
    const result = await LynxClient.generatePickList(machineId);
    await audit(req, 'lynx.pick_list_generate', { machineId, ok: result.ok, status: result.status });
    return res.json(result);
  } catch (err: any) {
    logger.error('[AdminLynx] pick-list failed', { err: err?.message });
    return res.status(500).json({ error: 'Lynx pick-list generation failed' });
  }
});

// MONEY (mint) — verification endpoint: mint ONE small single-use prepaid QR card
// against live Lynx to prove the Cortina-free rail works. Doubly gated in the
// service (LYNX_CARD_MINT_ENABLED + operator id). Audited. Default ₪1.
router.post('/test-mint', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const amountIls = Math.min(Math.max(Number(req.body?.amountIls) || 1, 1), 10); // clamp 1–10 for a test
  try {
    const adminId = (req as any).user?.uid || 'admin';
    const result = await LynxCardService.mintWashCard({
      userId: `admin-test-${adminId}`.slice(0, 40),
      amountIls,
      holderName: 'PetWash Test',
      remarks: 'admin verification mint',
    });
    await audit(req, 'lynx.test_mint', { ok: result.ok, status: result.status, wired: result.wired, amountIls, cardUidTail: result.cardUid?.slice(-6) });
    return res.json(result); // includes the raw create response so we can see the card's QR field
  } catch (err: any) {
    logger.error('[AdminLynx] test-mint failed', { err: err?.message });
    return res.status(500).json({ ok: false, error: 'test_mint_crashed' });
  }
});

export default router;
