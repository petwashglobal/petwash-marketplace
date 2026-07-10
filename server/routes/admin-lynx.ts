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
 *   GET  /api/admin/lynx/machine/:id/last-sales  → the bay's recent transactions (pull)
 *   GET  /api/admin/lynx/machine/:id/reconciliation → summarized: settled/unsettled/prepaid
 *   GET  /api/admin/lynx/reports/widgets         → discover dashboard report widgets
 *   POST /api/admin/lynx/reports/widget-data     → deep fleet revenue analytics (filters)
 *   POST /api/admin/lynx/ereceipt/generate       → fiscal eReceipt for a bay tx (no email by default)
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
import { summarizeBaySales } from '../services/lynxReconciliation';
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

// Bay-transaction reconciliation feed for Tower Control — Nayax Lynx is PULL, not
// push (verified against the dev portal: GET /operational/v1/machines/{id}/lastSales).
// READ-ONLY: views what already happened at the bay; never moves money. Dark until
// LYNX_ENABLED=true + LYNX_USER_TOKEN set (returns {wired:false} otherwise).
router.get('/machine/:machineId/last-sales', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const machineId = String(req.params.machineId || '').trim();
  if (!machineId) return res.status(400).json({ error: 'machineId required' });
  try {
    const result = await LynxClient.getLastSales(machineId);
    await audit(req, 'ADMIN_LYNX_LAST_SALES', { machineId, ok: result.ok, status: result.status });
    return res.json(result);
  } catch (err: any) {
    logger.error('[AdminLynx] last sales failed', { err: err?.message });
    return res.status(500).json({ error: 'Lynx last sales failed' });
  }
});

// RECONCILIATION — pulls a bay's last-sales and summarizes them for Tower Control:
// totals, settled-vs-unsettled, authorize/settle discrepancies, per-payment-method,
// and the prepaid (member QR-redeem) slice that is OURS to receipt vs public card
// sales that are Nayax's. READ-ONLY; pure transform over the pull feed. Dark until
// LYNX_ENABLED + LYNX_USER_TOKEN.
router.get('/machine/:machineId/reconciliation', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const machineId = String(req.params.machineId || '').trim();
  if (!machineId) return res.status(400).json({ error: 'machineId required' });
  try {
    const result = await LynxClient.getLastSales(machineId);
    if (!result.ok) {
      // Surface the dark/failed state honestly instead of a fake all-zero summary.
      await audit(req, 'ADMIN_LYNX_RECONCILIATION', { machineId, ok: false, status: result.status });
      return res.json({ ok: false, wired: result.wired, status: result.status, error: result.error, machineId });
    }
    const summary = summarizeBaySales(machineId, result.data);
    await audit(req, 'ADMIN_LYNX_RECONCILIATION', {
      machineId, ok: true, status: result.status,
      totalCount: summary.totalCount, needsAttentionCount: summary.needsAttentionCount,
    });
    return res.json({ ok: true, wired: result.wired, status: result.status, summary });
  } catch (err: any) {
    logger.error('[AdminLynx] reconciliation failed', { err: err?.message });
    return res.status(500).json({ error: 'Lynx reconciliation failed' });
  }
});

// Deep fleet REPORTS for Tower Control — the dual-bay analytics (revenue per
// machine/day/month, sales-by-period). Two steps mirror the dev portal: discover
// widgets, then fetch a widget's data with filters. READ-ONLY (analytics over past
// sales); never moves money. Dark until LYNX_ENABLED + LYNX_USER_TOKEN.
router.get('/reports/widgets', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const screenTypeId = Number(req.query.screenTypeId) || 1;
  try {
    const result = await LynxClient.getReportWidgets(screenTypeId);
    await audit(req, 'ADMIN_LYNX_REPORT_WIDGETS', { screenTypeId, ok: result.ok, status: result.status });
    return res.json(result);
  } catch (err: any) {
    logger.error('[AdminLynx] report widgets failed', { err: err?.message });
    return res.status(500).json({ error: 'Lynx report widgets failed' });
  }
});

router.post('/reports/widget-data', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const widgetTypeId = Number(req.body?.widgetTypeId);
  if (!Number.isFinite(widgetTypeId)) return res.status(400).json({ error: 'widgetTypeId required' });
  const { entityId, screenTypeId, filters } = req.body || {};
  if (filters !== undefined && !Array.isArray(filters)) return res.status(400).json({ error: 'filters must be an array' });
  try {
    const result = await LynxClient.getReportWidgetData({ widgetTypeId, entityId, screenTypeId, filters });
    await audit(req, 'ADMIN_LYNX_REPORT_WIDGET_DATA', { widgetTypeId, entityId: entityId ?? null, filterCount: Array.isArray(filters) ? filters.length : 0, ok: result.ok, status: result.status });
    return res.json(result);
  } catch (err: any) {
    logger.error('[AdminLynx] report widget-data failed', { err: err?.message });
    return res.status(500).json({ error: 'Lynx report widget-data failed' });
  }
});

// FISCAL reconciliation — generate the eReceipt for one bay transaction (from a
// lastSales row) so a bay sale can be tied to its receipt. By DEFAULT this does
// NOT email anyone: an email is sent ONLY when the caller explicitly passes
// sendEmail:true AND an email address, so a reconciliation pull never spams customers.
router.post('/ereceipt/generate', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const { transactionId, transactionDateTime, siteId, machineId, fullName } = req.body || {};
  if (transactionId === undefined || transactionDateTime === undefined || siteId === undefined || machineId === undefined) {
    return res.status(400).json({ error: 'transactionId, transactionDateTime, siteId, machineId are required' });
  }
  // Email is a customer-facing side-effect — require an explicit opt-in flag AND an address.
  const email = (req.body?.sendEmail === true && typeof req.body?.email === 'string') ? req.body.email : undefined;
  try {
    const result = await LynxClient.generateEReceipt({ transactionId, transactionDateTime, siteId, machineId, fullName, email });
    await audit(req, 'ADMIN_LYNX_ERECEIPT_GENERATE', { transactionId, machineId, emailed: Boolean(email), ok: result.ok, status: result.status });
    return res.json(result);
  } catch (err: any) {
    logger.error('[AdminLynx] ereceipt generate failed', { err: err?.message });
    return res.status(500).json({ error: 'Lynx eReceipt generation failed' });
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

// Who am I on Nayax — the operator ActorID auto-discovered from the connected Lynx
// account (so LYNX_OPERATOR_ID need not be set by hand). Read-only.
router.get('/whoami', ...requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const [hierarchy, operatorId] = await Promise.all([
      LynxClient.getActorHierarchy(),
      LynxCardService.resolveOperatorId(),
    ]);
    return res.json({ ok: hierarchy.ok, operatorId, status: hierarchy.status, hierarchy: hierarchy.data });
  } catch (err: any) {
    logger.error('[AdminLynx] whoami failed', { err: err?.message });
    return res.status(500).json({ ok: false, error: 'whoami_crashed' });
  }
});

// MONEY (mint) — one-click verification: mint ONE small single-use prepaid QR card
// against live Lynx to PROVE the Cortina-free rail + reveal the card's QR field.
// adminTest bypasses the production LYNX_CARD_MINT_ENABLED flag (super-admin only,
// clamped ₪1–10, audited) so we can verify BEFORE turning the customer flow on.
// The operator ActorID is auto-discovered — no manual config needed.
router.post('/test-mint', ...requireSuperAdmin, async (req: Request, res: Response) => {
  const amountIls = Math.min(Math.max(Number(req.body?.amountIls) || 1, 1), 10);
  try {
    const adminId = (req as any).user?.uid || 'admin';
    const result = await LynxCardService.mintWashCard(
      { userId: `admin-test-${adminId}`.slice(0, 40), amountIls, holderName: 'PetWash Test', remarks: 'admin verification mint' },
      { adminTest: true },
    );
    await audit(req, 'lynx.test_mint', { ok: result.ok, status: result.status, wired: result.wired, amountIls, cardUidTail: result.cardUid?.slice(-6) });
    return res.json(result); // includes the raw create response so we can see the card's QR field
  } catch (err: any) {
    logger.error('[AdminLynx] test-mint failed', { err: err?.message });
    return res.status(500).json({ ok: false, error: 'test_mint_crashed' });
  }
});

export default router;
