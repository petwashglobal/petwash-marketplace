import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { washMachines, activationSessions, activationAuditLog } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth } from '../customAuth';
import { redis } from '../services/redis';
import { logger } from '../lib/logger';
import {
  verifyQrSignature,
  assertValidQrPayload,
  assertValidStaticStickerPayload,
} from '../utils/generateQrPayload';
import { NayaxSparkService } from '../services/NayaxSparkService';

const router = Router();

const APP_SESSION_SECRET = (() => {
  const s = process.env.APP_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: APP_SESSION_SECRET or SESSION_SECRET must be set in production');
  }
  return s || crypto.randomBytes(32).toString('hex'); // dev-only random fallback
})();
const ACTIVATION_TOKEN_TTL_SECONDS = 120;  // 2 min window to tap "Start"
const QR_MAX_AGE_SECONDS = 90;             // dynamic QR only
const VEND_SENT_TIMEOUT_SECONDS = 60;      // rollback if machine never acked the vend
const MACHINE_ACK_TIMEOUT_SECONDS = 300;   // rollback if acked but never started
const SESSION_MAX_RUN_SECONDS = 1800;      // 30 min hard cap on running sessions
const RATE_LIMIT_MAX_IP = 10;
const RATE_LIMIT_MAX_USER = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// ── State machine ─────────────────────────────────────────────────────────────
// created → authorized → vend_sent → machine_ack → running → completed
//                     ↘ failed (any step)
// ─────────────────────────────────────────────────────────────────────────────

function createActivationToken(sessionId: string, userId: string, machineId: string): string {
  const raw = `${sessionId}:${userId}:${machineId}:${Date.now()}:${crypto.randomUUID()}`;
  return crypto.createHmac('sha256', APP_SESSION_SECRET).update(raw).digest('hex');
}

function getIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// ── Audit log ─────────────────────────────────────────────────────────────────
async function audit(params: {
  sessionId: string;
  userId: string;
  machineId: string;
  event: string;
  status?: string;
  detail?: string;
  errorCode?: string;
  ip?: string;
}): Promise<void> {
  try {
    await db.insert(activationAuditLog).values({
      sessionId: params.sessionId,
      userId:    params.userId,
      machineId: params.machineId,
      event:     params.event,
      status:    params.status || null,
      detail:    params.detail || null,
      errorCode: params.errorCode || null,
      ip:        params.ip || null,
    });
  } catch (err: any) {
    logger.warn('[QRAudit] Insert failed (non-blocking)', { error: err.message });
  }
}

// ── Rate limiter ──────────────────────────────────────────────────────────────
async function checkRateLimit(ip: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const ipKey = `qr:ratelimit:ip:${ip}`;
    const uidKey = `qr:ratelimit:uid:${userId}`;
    const [ipCount, uidCount] = await Promise.all([redis.incr(ipKey), redis.incr(uidKey)]);
    if (ipCount === 1) await redis.expire(ipKey, RATE_LIMIT_WINDOW_SECONDS);
    if (uidCount === 1) await redis.expire(uidKey, RATE_LIMIT_WINDOW_SECONDS);
    if (ipCount > RATE_LIMIT_MAX_IP) return { allowed: false, reason: 'ip' };
    if (uidCount > RATE_LIMIT_MAX_USER) return { allowed: false, reason: 'user' };
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

// ── Stuck-session recovery (runs every 5 min) ─────────────────────────────────
async function releaseStuckSessions(): Promise<void> {
  try {
    const now = Date.now();
    const runCutoff  = new Date(now - SESSION_MAX_RUN_SECONDS * 1000);
    const vendCutoff = new Date(now - VEND_SENT_TIMEOUT_SECONDS * 1000);
    const ackCutoff  = new Date(now - MACHINE_ACK_TIMEOUT_SECONDS * 1000);

    const stuck = await db
      .select()
      .from(activationSessions)
      .where(inArray(activationSessions.status, ['running', 'vend_sent', 'machine_ack']));

    for (const s of stuck) {
      const createdAt = new Date(s.createdAt);
      const vendSentAt = s.vendSentAt ? new Date(s.vendSentAt) : null;
      const machineAckedAt = s.machineAckedAt ? new Date(s.machineAckedAt) : null;

      let shouldRelease = false;
      let reason = '';

      if (s.status === 'running' && createdAt < runCutoff) {
        shouldRelease = true;
        reason = 'Auto-released: session exceeded 30-minute max run time';
      } else if (s.status === 'vend_sent' && vendSentAt && vendSentAt < vendCutoff) {
        shouldRelease = true;
        reason = 'Auto-released: machine did not acknowledge vend within 60 seconds';
      } else if (s.status === 'machine_ack' && machineAckedAt && machineAckedAt < ackCutoff) {
        shouldRelease = true;
        reason = 'Auto-released: machine acked but session never started within 5 minutes';
      }

      if (shouldRelease) {
        logger.warn('[QRActivation] Releasing stuck session', {
          sessionId: s.id, machineId: s.machineId, status: s.status, reason,
        });
        await db.update(activationSessions)
          .set({ status: 'failed', failureReason: reason, updatedAt: new Date() })
          .where(eq(activationSessions.id, s.id));
        await db.update(washMachines)
          .set({ isBusy: false, updatedAt: new Date() })
          .where(eq(washMachines.machineId, s.machineId));
        audit({
          sessionId: s.id, userId: s.userId, machineId: s.machineId,
          event: 'SESSION_AUTO_RELEASED', status: 'failed', detail: reason,
        });
      }
    }
  } catch (err: any) {
    logger.error('[QRActivation] releaseStuckSessions failed', { error: err.message });
  }
}
setInterval(releaseStuckSessions, 5 * 60 * 1000);

// ── Nonce helpers (dynamic QR only) ──────────────────────────────────────────
async function markNonceUsed(nonce: string): Promise<void> {
  await redis.setRaw(`qr:nonce:${nonce}`, '1', QR_MAX_AGE_SECONDS + 10);
}
async function isNonceUsed(nonce: string): Promise<boolean> {
  return (await redis.getRaw(`qr:nonce:${nonce}`)) !== null;
}

// ── Idempotency helpers ───────────────────────────────────────────────────────
async function getIdempotencyResult(key: string): Promise<any | null> {
  return redis.get(`qr:idem:${key}`);
}
async function setIdempotencyResult(key: string, result: any): Promise<void> {
  await redis.set(`qr:idem:${key}`, result, ACTIVATION_TOKEN_TTL_SECONDS);
}

// ── Price calculator ──────────────────────────────────────────────────────────
function calculatePriceCents(machine: { priceCents: number }, loyaltyTier?: string): number {
  const discount = loyaltyTier === 'gold' ? 0.10 : loyaltyTier === 'platinum' ? 0.15 : 0;
  return Math.round(machine.priceCents * (1 - discount));
}

// ── Shared machine authorization logic ───────────────────────────────────────
async function resolveAndAuthorize(params: {
  machineId: string;
  locationId: string;
  userId: string;
  userLoyaltyTier: string | undefined;
  ip: string;
  userAgent: string | null;
  sourceType: 'static_sticker' | 'dynamic_qr' | 'admin_generated';
  qrNonce: string;
  idempotencyKey: string | undefined;
  req: any;
  res: Response;
}): Promise<void> {
  const { machineId, locationId, userId, userLoyaltyTier, ip, userAgent, sourceType, qrNonce, idempotencyKey, req, res } = params;

  if (idempotencyKey) {
    const cached = await getIdempotencyResult(idempotencyKey);
    if (cached) { res.json(cached); return; }
  }

  const [machine] = await db
    .select()
    .from(washMachines)
    .where(and(eq(washMachines.machineId, machineId), eq(washMachines.locationId, locationId)))
    .limit(1);

  if (!machine) {
    audit({ sessionId: 'n/a', userId, machineId, event: 'MACHINE_NOT_FOUND', errorCode: 'MACHINE_NOT_FOUND', ip });
    res.status(404).json({ success: false, errorCode: 'MACHINE_NOT_FOUND', message: 'Machine not found.' });
    return;
  }

  if (!machine.isActive || !machine.isOnline) {
    audit({ sessionId: 'n/a', userId, machineId, event: 'MACHINE_OFFLINE', errorCode: 'MACHINE_OFFLINE', ip });
    res.status(409).json({ success: false, errorCode: 'MACHINE_OFFLINE', message: 'Machine is currently unavailable.' });
    return;
  }

  if (machine.isBusy) {
    audit({ sessionId: 'n/a', userId, machineId, event: 'MACHINE_BUSY_REJECTED', errorCode: 'MACHINE_BUSY', ip });
    res.status(409).json({ success: false, errorCode: 'MACHINE_BUSY', message: 'Machine is currently in use.' });
    return;
  }

  const existingActive = await db
    .select({ id: activationSessions.id, status: activationSessions.status })
    .from(activationSessions)
    .where(and(
      eq(activationSessions.userId, userId),
      eq(activationSessions.machineId, machine.machineId),
      inArray(activationSessions.status, ['created', 'authorized', 'vend_sent', 'machine_ack', 'running']),
    ))
    .limit(1);

  if (existingActive.length > 0) {
    res.status(409).json({
      success: false,
      errorCode: 'SESSION_ALREADY_ACTIVE',
      message: 'You already have an active session on this machine.',
      existingSessionId: existingActive[0].id,
    });
    return;
  }

  const priceCents = calculatePriceCents(machine, userLoyaltyTier);
  const sessionId = crypto.randomUUID();
  const activationToken = createActivationToken(sessionId, userId, machine.machineId);

  await db.insert(activationSessions).values({
    id: sessionId,
    userId,
    machineId: machine.machineId,
    locationId: machine.locationId,
    status: 'created',
    sourceType,
    activationToken,
    priceCents,
    currency: machine.currency,
    qrNonce,
    ip,
    userAgent,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await audit({ sessionId, userId, machineId: machine.machineId, event: 'SESSION_CREATED', status: 'created', detail: sourceType, ip });

  const nayaxAuth = await authorizeNayaxSession({
    nayaxTerminalId: machine.nayaxTerminalId,
    nayaxMerchantId: machine.nayaxMerchantId,
    machineId: machine.machineId,
    userId,
    sessionId,
    amountCents: priceCents,
    currency: machine.currency,
  });

  if (!nayaxAuth.success || !nayaxAuth.nayaxSessionId) {
    await db.update(activationSessions)
      .set({ status: 'failed', failureReason: nayaxAuth.message || 'Nayax authorization failed', updatedAt: new Date() })
      .where(eq(activationSessions.id, sessionId));
    await audit({ sessionId, userId, machineId: machine.machineId, event: 'PAYMENT_AUTH_FAILED', status: 'failed', detail: nayaxAuth.message, errorCode: 'PAYMENT_AUTH_FAILED', ip });
    res.status(502).json({ success: false, errorCode: 'PAYMENT_AUTH_FAILED', message: 'Unable to authorize payment session.' });
    return;
  }

  await db.update(activationSessions)
    .set({ status: 'authorized', nayaxSessionId: nayaxAuth.nayaxSessionId, updatedAt: new Date() })
    .where(eq(activationSessions.id, sessionId));

  await audit({ sessionId, userId, machineId: machine.machineId, event: 'PAYMENT_AUTHORIZED', status: 'authorized', ip });

  const result = {
    success: true,
    sessionId,
    activationToken,
    nayaxSessionId: nayaxAuth.nayaxSessionId,
    machineId: machine.machineId,
    locationId: machine.locationId,
    machineName: machine.name,
    machineNameHe: machine.nameHe,
    address: machine.address,
    priceCents,
    currency: machine.currency,
    startWindowSeconds: ACTIVATION_TOKEN_TTL_SECONDS,
    estimatedProgramSeconds: machine.defaultProgramSeconds,
    message: 'Session authorized. Ready to start.',
  };

  if (idempotencyKey) await setIdempotencyResult(idempotencyKey, result);

  logger.info('[QRActivation] Session authorized', {
    sessionId, machineId: machine.machineId, sourceType,
    userId: userId.slice(0, 8) + '...',
  });
  res.json(result);
}

/* ──────────────────────────────────────────────────────────────────────────────
   NAYAX AUTHORIZATION — Nayax Spark API integration
   
   POST /api/v1/transaction/authorize
     terminal_id  ← machine.nayaxTerminalId
     merchant_id  ← machine.nayaxMerchantId
     external_id  ← sessionId (our UUID, for idempotency)
     amount       ← amountCents / 100
     currency     ← "ILS"
   Response:
     transaction_id → nayaxSessionId (stored in activation_sessions.nayax_session_id)
   
   Falls back to dev mode when NAYAX_API_KEY is not configured.
   ────────────────────────────────────────────────────────────────────────── */
async function authorizeNayaxSession(params: {
  nayaxTerminalId: string | null | undefined;
  nayaxMerchantId: string | null | undefined;
  machineId: string;
  userId: string;
  sessionId: string;
  amountCents: number;
  currency: string;
}): Promise<{ success: boolean; nayaxSessionId?: string; message?: string }> {
  // No terminal configured → dev mode (no physical machine present)
  if (!params.nayaxTerminalId) {
    logger.warn('[QRActivation] No Nayax terminal ID — dev mode authorization');
    return {
      success: true,
      nayaxSessionId: `nayax_dev_${crypto.randomUUID()}`,
      message: 'Dev mode — no Nayax terminal configured',
    };
  }

  const NAYAX_API_KEY  = process.env.NAYAX_API_KEY;
  const NAYAX_BASE_URL = process.env.NAYAX_BASE_URL || 'https://api.spark.nayax.com';

  // Without a real API key → use demo session ID so the machine flow can proceed in testing
  if (!NAYAX_API_KEY) {
    logger.warn('[QRActivation] NAYAX_API_KEY not configured — using demo session for terminal present');
    return {
      success: true,
      nayaxSessionId: `nayax_demo_${crypto.randomUUID()}`,
      message: 'Demo mode — NAYAX_API_KEY not set',
    };
  }

  try {
    const response = await fetch(`${NAYAX_BASE_URL}/api/v1/transaction/authorize`, {
      method: 'POST',
      headers: { 'X-API-Key': NAYAX_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        terminal_id:  params.nayaxTerminalId,
        merchant_id:  params.nayaxMerchantId,
        external_id:  params.sessionId,
        amount:       params.amountCents / 100,
        currency:     params.currency,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      logger.error('[QRActivation] Nayax authorize failed', { status: response.status, body: errText });
      return { success: false, message: `Nayax authorization failed: HTTP ${response.status}` };
    }

    const data = await response.json();
    logger.info('[QRActivation] Nayax authorized', {
      sessionId: params.sessionId,
      nayaxSessionId: data.transaction_id,
    });
    return { success: true, nayaxSessionId: data.transaction_id };
  } catch (err: any) {
    logger.error('[QRActivation] Nayax authorize network error', { error: err.message });
    return { success: false, message: `Network error contacting Nayax: ${err.message}` };
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   MACHINE START / VEND — Nayax Spark API vend command
   
   POST /api/v1/transaction/vend
     transaction_id ← nayaxSessionId
     product_code   ← machine wash program code (e.g. "DOGWASH_PREMIUM")
     duration       ← machine.defaultProgramSeconds
   
   Nayax physically triggers the machine via the terminal.
   Machine acknowledgment arrives via webhook: POST /api/webhooks/nayax
     event: "session.started" → call /api/qr/ack with sessionId
   ────────────────────────────────────────────────────────────────────────── */
async function sendVendCommand(params: {
  machineId: string;
  sessionId: string;
  nayaxSessionId: string;
  nayaxTerminalId: string | null | undefined;
}): Promise<{ success: boolean; message?: string }> {
  // Resolve terminal ID: prefer explicit terminalId; fall back to machineId
  const terminalId = params.nayaxTerminalId || params.machineId;

  if (!terminalId) {
    logger.error('[QRActivation] sendVendCommand: no terminalId available', params);
    return { success: false, message: 'No terminal ID available for vend command' };
  }

  try {
    const result = await NayaxSparkService.executeRemoteVend({
      terminalId,
      productCode: 'DOGWASH_PREMIUM',
      transactionId: params.nayaxSessionId,
    });

    const success = result.Status === 'SUCCESS';
    logger.info('[QRActivation] Nayax remote vend result', {
      sessionId: params.sessionId,
      terminalId,
      status: result.Status,
      message: result.Message,
    });
    return { success, message: result.Message };
  } catch (err: any) {
    logger.error('[QRActivation] Nayax remote vend failed', {
      sessionId: params.sessionId,
      terminalId,
      error: err.message,
    });
    return { success: false, message: err.message };
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   POST /api/qr/scan-sticker  ← PRODUCTION STATIC STICKER FLOW
   
   The permanent physical sticker contains only:
     https://petwash.co.il/activate?m=<machineId>&l=<locationId>
   
   The app parses the URL and sends { machineId, locationId } to this route.
   All authorization is performed server-side after Firebase auth.
   No signature, timestamp, or nonce required from the sticker.
   ────────────────────────────────────────────────────────────────────────── */
router.post('/scan-sticker', requireAuth, async (req: any, res: Response) => {
  const ip = getIp(req);
  const userId: string = req.userId || req.user?.uid;
  const userLoyaltyTier: string | undefined = req.firebaseUser?.loyaltyTier;

  try {
    const rl = await checkRateLimit(ip, userId);
    if (!rl.allowed) {
      return res.status(429).json({
        success: false,
        errorCode: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait before trying again.',
      });
    }

    if (!assertValidStaticStickerPayload(req.body)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_STICKER_PAYLOAD',
        message: 'Invalid machine identity in QR code.',
      });
    }

    const { machineId, locationId } = req.body;
    const idempotencyKey = (req.headers['idempotency-key'] as string | undefined)?.trim();

    // Static stickers use a server-generated nonce (no QR nonce to replay)
    const serverNonce = crypto.randomUUID();

    await resolveAndAuthorize({
      machineId,
      locationId,
      userId,
      userLoyaltyTier,
      ip,
      userAgent: req.headers['user-agent'] || null,
      sourceType: 'static_sticker',
      qrNonce: serverNonce,
      idempotencyKey,
      req,
      res,
    });
  } catch (error: any) {
    logger.error('[QRActivation] /scan-sticker failed', { error: error.message, ip });
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: 'Activation failed.' });
  }
});

/* ──────────────────────────────────────────────────────────────────────────────
   POST /api/qr/activate  ← DYNAMIC QR FLOW (testing / admin / generated QR)
   ────────────────────────────────────────────────────────────────────────── */
router.post('/activate', requireAuth, async (req: any, res: Response) => {
  const ip = getIp(req);
  const userId: string = req.userId || req.user?.uid;
  const userLoyaltyTier: string | undefined = req.firebaseUser?.loyaltyTier;

  try {
    const rl = await checkRateLimit(ip, userId);
    if (!rl.allowed) {
      return res.status(429).json({
        success: false,
        errorCode: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait before trying again.',
      });
    }

    const payload = req.body;
    if (!assertValidQrPayload(payload)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_QR_PAYLOAD',
        message: 'QR payload is invalid.',
      });
    }

    const currentTs = Math.floor(Date.now() / 1000);
    if (currentTs - payload.ts > QR_MAX_AGE_SECONDS) {
      return res.status(400).json({
        success: false,
        errorCode: 'QR_EXPIRED',
        message: 'QR code expired. Please scan again.',
      });
    }

    if (!verifyQrSignature(payload)) {
      logger.warn('[QRActivation] Invalid QR signature', { machineId: payload.machineId, ip });
      return res.status(403).json({
        success: false,
        errorCode: 'INVALID_SIGNATURE',
        message: 'QR signature verification failed.',
      });
    }

    if (await isNonceUsed(payload.nonce)) {
      return res.status(409).json({
        success: false,
        errorCode: 'QR_ALREADY_USED',
        message: 'This QR code was already used.',
      });
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string | undefined)?.trim();

    // Mark nonce before authorization to prevent concurrent replay
    await markNonceUsed(payload.nonce);

    await resolveAndAuthorize({
      machineId: payload.machineId,
      locationId: payload.locationId,
      userId,
      userLoyaltyTier,
      ip,
      userAgent: req.headers['user-agent'] || null,
      sourceType: 'dynamic_qr',
      qrNonce: payload.nonce,
      idempotencyKey,
      req,
      res,
    });
  } catch (error: any) {
    logger.error('[QRActivation] /activate failed', { error: error.message, ip });
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: 'Activation failed.' });
  }
});

/* ──────────────────────────────────────────────────────────────────────────────
   POST /api/qr/start  —  Send vend command → transitions to 'vend_sent'
   
   State: authorized → vend_sent
   The machine has 60 seconds to acknowledge (via webhook → /api/qr/ack).
   If no ack arrives, releaseStuckSessions() auto-rolls back after 60s.
   ────────────────────────────────────────────────────────────────────────── */
router.post('/start', requireAuth, async (req: any, res: Response) => {
  const userId: string = req.userId || req.user?.uid;

  try {
    const { sessionId, activationToken } = req.body as { sessionId?: string; activationToken?: string };

    if (!sessionId || !activationToken) {
      return res.status(400).json({ success: false, errorCode: 'INVALID_START_REQUEST', message: 'Missing session data.' });
    }

    const [session] = await db
      .select()
      .from(activationSessions)
      .where(eq(activationSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, errorCode: 'SESSION_NOT_FOUND', message: 'Session not found.' });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ success: false, errorCode: 'SESSION_USER_MISMATCH', message: 'Session does not belong to you.' });
    }
    if (session.activationToken !== activationToken) {
      return res.status(403).json({ success: false, errorCode: 'INVALID_ACTIVATION_TOKEN', message: 'Activation token invalid.' });
    }
    if (session.status !== 'authorized') {
      return res.status(409).json({ success: false, errorCode: 'SESSION_NOT_AUTHORIZED', message: 'Session is not ready to start.' });
    }

    const createdMs = new Date(session.createdAt).getTime();
    if (Date.now() - createdMs > ACTIVATION_TOKEN_TTL_SECONDS * 1000) {
      await db.update(activationSessions)
        .set({ status: 'failed', failureReason: 'Activation token expired', updatedAt: new Date() })
        .where(eq(activationSessions.id, sessionId));
      await audit({ sessionId, userId, machineId: session.machineId, event: 'ACTIVATION_TOKEN_EXPIRED', status: 'failed' });
      return res.status(410).json({
        success: false,
        errorCode: 'ACTIVATION_TOKEN_EXPIRED',
        message: 'Activation window expired. Please scan again.',
      });
    }

    const [machine] = await db
      .select()
      .from(washMachines)
      .where(eq(washMachines.machineId, session.machineId))
      .limit(1);

    if (!machine || machine.isBusy) {
      const code = !machine ? 'MACHINE_NOT_FOUND' : 'MACHINE_BUSY';
      await audit({ sessionId, userId, machineId: session.machineId, event: code, status: session.status, errorCode: code });
      return res.status(409).json({ success: false, errorCode: code, message: !machine ? 'Machine not found.' : 'Machine is already in use.' });
    }

    // Send vend command — transitions to vend_sent immediately
    const vendResult = await sendVendCommand({
      machineId: machine.machineId,
      sessionId,
      nayaxSessionId: session.nayaxSessionId || '',
      nayaxTerminalId: machine.nayaxTerminalId,
    });

    if (!vendResult.success) {
      await db.update(activationSessions)
        .set({ status: 'failed', failureReason: vendResult.message || 'Vend command failed', updatedAt: new Date() })
        .where(eq(activationSessions.id, sessionId));
      await audit({ sessionId, userId, machineId: machine.machineId, event: 'VEND_COMMAND_FAILED', status: 'failed', detail: vendResult.message, errorCode: 'MACHINE_START_FAILED' });
      return res.status(502).json({ success: false, errorCode: 'MACHINE_START_FAILED', message: 'Could not start machine.' });
    }

    const vendSentAt = new Date();
    await db.update(washMachines).set({ isBusy: true, updatedAt: new Date() }).where(eq(washMachines.machineId, machine.machineId));
    await db.update(activationSessions)
      .set({ status: 'vend_sent', vendSentAt, updatedAt: new Date() })
      .where(eq(activationSessions.id, sessionId));

    await audit({ sessionId, userId, machineId: machine.machineId, event: 'VEND_COMMAND_SENT', status: 'vend_sent', ip: getIp(req) });

    logger.info('[QRActivation] Vend command sent — waiting for machine ack', { sessionId, machineId: machine.machineId });

    return res.json({
      success: true,
      message: 'Vend command sent. Waiting for machine acknowledgment.',
      sessionId,
      machineId: machine.machineId,
      status: 'vend_sent',
      ackTimeoutSeconds: VEND_SENT_TIMEOUT_SECONDS,
      estimatedSeconds: machine.defaultProgramSeconds,
    });

  } catch (error: any) {
    logger.error('[QRActivation] /start failed', { error: error.message });
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: 'Unable to start machine.' });
  }
});

/* ──────────────────────────────────────────────────────────────────────────────
   POST /api/qr/ack  —  Machine acknowledged vend → transitions to 'machine_ack'
   
   State: vend_sent → machine_ack
   Called by the Nayax webhook handler (POST /api/webhooks/nayax) when the
   terminal fires event: "session.started" — that handler should call this
   endpoint internally, or directly update the session status.
   Also callable by the app if Nayax sends the ack signal to the app directly.
   ────────────────────────────────────────────────────────────────────────── */
router.post('/ack', requireAuth, async (req: any, res: Response) => {
  const userId: string = req.userId || req.user?.uid;

  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      return res.status(400).json({ success: false, errorCode: 'MISSING_SESSION_ID', message: 'Missing sessionId.' });
    }

    const [session] = await db
      .select()
      .from(activationSessions)
      .where(eq(activationSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, errorCode: 'SESSION_NOT_FOUND' });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ success: false, errorCode: 'SESSION_USER_MISMATCH' });
    }
    if (!['vend_sent', 'machine_ack'].includes(session.status)) {
      return res.status(409).json({ success: false, errorCode: 'INVALID_SESSION_STATE', message: `Cannot ack session in status: ${session.status}` });
    }

    const machineAckedAt = new Date();
    await db.update(activationSessions)
      .set({ status: 'machine_ack', machineAckedAt, updatedAt: new Date() })
      .where(eq(activationSessions.id, sessionId));

    await audit({ sessionId, userId, machineId: session.machineId, event: 'MACHINE_ACK_RECEIVED', status: 'machine_ack', ip: getIp(req) });

    logger.info('[QRActivation] Machine acknowledged vend', { sessionId, machineId: session.machineId });

    return res.json({ success: true, sessionId, status: 'machine_ack', ackedAt: machineAckedAt.toISOString() });

  } catch (error: any) {
    logger.error('[QRActivation] /ack failed', { error: error.message });
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' });
  }
});

/* ──────────────────────────────────────────────────────────────────────────────
   POST /api/qr/running  —  Machine has physically started → 'running'
   
   State: machine_ack → running
   Called by the Nayax webhook (event: "machine.started") or by the app.
   ────────────────────────────────────────────────────────────────────────── */
router.post('/running', requireAuth, async (req: any, res: Response) => {
  const userId: string = req.userId || req.user?.uid;

  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      return res.status(400).json({ success: false, errorCode: 'MISSING_SESSION_ID' });
    }

    const [session] = await db
      .select()
      .from(activationSessions)
      .where(eq(activationSessions.id, sessionId))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, errorCode: 'SESSION_NOT_FOUND' });
    if (session.userId !== userId) return res.status(403).json({ success: false, errorCode: 'SESSION_USER_MISMATCH' });
    if (!['machine_ack', 'vend_sent'].includes(session.status)) {
      return res.status(409).json({ success: false, errorCode: 'INVALID_SESSION_STATE', message: `Cannot mark running from status: ${session.status}` });
    }

    const startedAt = new Date();
    await db.update(activationSessions)
      .set({ status: 'running', startedAt, updatedAt: new Date() })
      .where(eq(activationSessions.id, sessionId));

    await audit({ sessionId, userId, machineId: session.machineId, event: 'MACHINE_RUNNING', status: 'running', ip: getIp(req) });

    return res.json({ success: true, sessionId, status: 'running', startedAt: startedAt.toISOString() });

  } catch (error: any) {
    logger.error('[QRActivation] /running failed', { error: error.message });
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' });
  }
});

/* ──────────────────────────────────────────────────────────────────────────────
   POST /api/qr/complete  —  Mark session completed → releases machine
   
   State: running → completed
   ────────────────────────────────────────────────────────────────────────── */
router.post('/complete', requireAuth, async (req: any, res: Response) => {
  const userId: string = req.userId || req.user?.uid;

  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      return res.status(400).json({ success: false, errorCode: 'INVALID_COMPLETE_REQUEST', message: 'Missing sessionId.' });
    }

    const [session] = await db
      .select()
      .from(activationSessions)
      .where(eq(activationSessions.id, sessionId))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, errorCode: 'SESSION_NOT_FOUND' });
    if (session.userId !== userId) return res.status(403).json({ success: false, errorCode: 'SESSION_USER_MISMATCH' });
    if (session.status !== 'running') {
      return res.status(409).json({ success: false, errorCode: 'SESSION_NOT_RUNNING', message: 'Session is not running.' });
    }

    const completedAt = new Date();
    await db.update(activationSessions)
      .set({ status: 'completed', completedAt, updatedAt: new Date() })
      .where(eq(activationSessions.id, sessionId));

    await db.update(washMachines)
      .set({ isBusy: false, updatedAt: new Date() })
      .where(eq(washMachines.machineId, session.machineId));

    await audit({ sessionId, userId, machineId: session.machineId, event: 'SESSION_COMPLETED', status: 'completed', ip: getIp(req) });

    logger.info('[QRActivation] Session completed', { sessionId, machineId: session.machineId });

    return res.json({
      success: true,
      message: 'Session completed.',
      sessionId,
      completedAt: completedAt.toISOString(),
      chargedAmountCents: session.priceCents,
      currency: session.currency,
    });

  } catch (error: any) {
    logger.error('[QRActivation] /complete failed', { error: error.message });
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' });
  }
});

/* ──────────────────────────────────────────────────────────────────────────────
   GET /api/qr/session/:sessionId  —  Poll session status
   ────────────────────────────────────────────────────────────────────────── */
router.get('/session/:sessionId', requireAuth, async (req: any, res: Response) => {
  const userId: string = req.userId || req.user?.uid;

  try {
    const [session] = await db
      .select()
      .from(activationSessions)
      .where(and(eq(activationSessions.id, req.params.sessionId), eq(activationSessions.userId, userId)))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, errorCode: 'SESSION_NOT_FOUND' });
    return res.json({ success: true, session });
  } catch (error: any) {
    logger.error('[QRActivation] /session poll failed', { error: error.message });
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' });
  }
});

export default router;
