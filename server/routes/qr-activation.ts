import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { washMachines, activationSessions } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth } from '../customAuth';
import { redis } from '../services/redis';
import { logger } from '../lib/logger';
import { verifyQrSignature } from '../utils/generateQrPayload';
import type { QrPayload } from '../utils/generateQrPayload';

const router = Router();

const APP_SESSION_SECRET = process.env.APP_SESSION_SECRET || 'petwash-session-secret-replace';
const ACTIVATION_TOKEN_TTL_SECONDS = 120;
const QR_MAX_AGE_SECONDS = 90;
const RATE_LIMIT_MAX_IP = 10;
const RATE_LIMIT_MAX_USER = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;
// Max time a session stays in 'running' before being auto-released
const SESSION_MAX_RUN_SECONDS = 1800; // 30 minutes

function createActivationToken(sessionId: string, userId: string, machineId: string): string {
  const raw = `${sessionId}:${userId}:${machineId}:${Date.now()}:${crypto.randomUUID()}`;
  return crypto.createHmac('sha256', APP_SESSION_SECRET).update(raw).digest('hex');
}

function assertValidQrPayload(input: any): input is QrPayload {
  return (
    input &&
    typeof input.machineId === 'string' &&
    typeof input.locationId === 'string' &&
    typeof input.ts === 'number' &&
    typeof input.nonce === 'string' &&
    typeof input.sig === 'string'
  );
}

function getIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

async function checkRateLimit(ip: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const ipKey = `qr:ratelimit:ip:${ip}`;
    const uidKey = `qr:ratelimit:uid:${userId}`;
    const [ipCount, uidCount] = await Promise.all([
      redis.incr(ipKey),
      redis.incr(uidKey),
    ]);
    if (ipCount === 1) await redis.expire(ipKey, RATE_LIMIT_WINDOW_SECONDS);
    if (uidCount === 1) await redis.expire(uidKey, RATE_LIMIT_WINDOW_SECONDS);
    if (ipCount > RATE_LIMIT_MAX_IP) return { allowed: false, reason: 'ip' };
    if (uidCount > RATE_LIMIT_MAX_USER) return { allowed: false, reason: 'user' };
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/** Release isBusy on machines whose session has been 'running' past SESSION_MAX_RUN_SECONDS */
async function releaseStuckSessions(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - SESSION_MAX_RUN_SECONDS * 1000);
    const stuck = await db
      .select()
      .from(activationSessions)
      .where(and(eq(activationSessions.status, 'running')));

    for (const s of stuck) {
      if (s.startedAt && new Date(s.startedAt) < cutoff) {
        logger.warn('[QRActivation] Releasing stuck session', { sessionId: s.id, machineId: s.machineId });
        await db.update(activationSessions)
          .set({ status: 'failed', failureReason: 'Auto-released: session exceeded max run time', updatedAt: new Date() })
          .where(eq(activationSessions.id, s.id));
        await db.update(washMachines)
          .set({ isBusy: false, updatedAt: new Date() })
          .where(eq(washMachines.machineId, s.machineId));
      }
    }
  } catch (err: any) {
    logger.error('[QRActivation] releaseStuckSessions failed', { error: err.message });
  }
}

// Run stuck session cleanup every 5 minutes
setInterval(releaseStuckSessions, 5 * 60 * 1000);

async function markNonceUsed(nonce: string): Promise<void> {
  await redis.setRaw(`qr:nonce:${nonce}`, '1', QR_MAX_AGE_SECONDS + 10);
}

async function isNonceUsed(nonce: string): Promise<boolean> {
  const val = await redis.getRaw(`qr:nonce:${nonce}`);
  return val !== null;
}

async function getIdempotencyResult(key: string): Promise<any | null> {
  return redis.get(`qr:idem:${key}`);
}

async function setIdempotencyResult(key: string, result: any): Promise<void> {
  await redis.set(`qr:idem:${key}`, result, ACTIVATION_TOKEN_TTL_SECONDS);
}

function calculatePriceCents(machine: { priceCents: number }, loyaltyTier?: string): number {
  const discount = loyaltyTier === 'gold' ? 0.10 : loyaltyTier === 'platinum' ? 0.15 : 0;
  return Math.round(machine.priceCents * (1 - discount));
}

/* ──────────────────────────────────────────────────────────────────────────
   NAYAX AUTHORIZATION PLACEHOLDER
   TODO: Replace with real Nayax/Lynx API integration.
   This function must never fail silently in production.
   ────────────────────────────────────────────────────────────────────────── */
async function authorizeNayaxSession(params: {
  nayaxTerminalId: string | null | undefined;
  machineId: string;
  userId: string;
  sessionId: string;
  amountCents: number;
  currency: string;
}): Promise<{ success: boolean; nayaxSessionId?: string; message?: string }> {
  logger.info('[QRActivation] Nayax authorization placeholder called', {
    machineId: params.machineId,
    sessionId: params.sessionId,
    amountCents: params.amountCents,
  });

  if (!params.nayaxTerminalId) {
    logger.warn('[QRActivation] No Nayax terminal ID — skipping payment auth (dev mode)');
    return {
      success: true,
      nayaxSessionId: `nayax_dev_${crypto.randomUUID()}`,
      message: 'Dev mode — no Nayax terminal configured',
    };
  }

  /* TODO: Implement real Nayax authorization:
     1. POST to Nayax/Lynx vend authorization endpoint
     2. Include terminal ID, amount, currency, session reference
     3. Return Nayax session/transaction ID on success
  */
  return {
    success: true,
    nayaxSessionId: `nayax_${crypto.randomUUID()}`,
    message: 'Authorized (placeholder)',
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   MACHINE START PLACEHOLDER
   TODO: Replace with real IoT / Nayax vend command.
   ────────────────────────────────────────────────────────────────────────── */
async function startMachineProgram(machineId: string, sessionId: string): Promise<{ success: boolean; message?: string }> {
  logger.info('[QRActivation] Machine start placeholder called', { machineId, sessionId });
  /* TODO: Send IoT command or Nayax vend command to the machine */
  return { success: true, message: 'Machine start command sent (placeholder)' };
}

/* ──────────────────────────────────────────────────────────────────────────
   POST /api/qr/activate  —  Verify QR + authorize session
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

    const idempotencyKey = (req.headers['idempotency-key'] as string | undefined)?.trim();
    if (idempotencyKey) {
      const cached = await getIdempotencyResult(idempotencyKey);
      if (cached) return res.json(cached);
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

    const [machine] = await db
      .select()
      .from(washMachines)
      .where(
        and(
          eq(washMachines.machineId, payload.machineId),
          eq(washMachines.locationId, payload.locationId),
        ),
      )
      .limit(1);

    if (!machine) {
      return res.status(404).json({
        success: false,
        errorCode: 'MACHINE_NOT_FOUND',
        message: 'Machine not found.',
      });
    }

    if (!machine.isActive || !machine.isOnline) {
      return res.status(409).json({
        success: false,
        errorCode: 'MACHINE_OFFLINE',
        message: 'Machine is currently unavailable.',
      });
    }

    if (machine.isBusy) {
      return res.status(409).json({
        success: false,
        errorCode: 'MACHINE_BUSY',
        message: 'Machine is currently in use.',
      });
    }

    // Block duplicate active sessions for this user+machine
    const existingActive = await db
      .select({ id: activationSessions.id, status: activationSessions.status })
      .from(activationSessions)
      .where(
        and(
          eq(activationSessions.userId, userId),
          eq(activationSessions.machineId, machine.machineId),
          inArray(activationSessions.status, ['created', 'authorized', 'running']),
        ),
      )
      .limit(1);

    if (existingActive.length > 0) {
      return res.status(409).json({
        success: false,
        errorCode: 'SESSION_ALREADY_ACTIVE',
        message: 'You already have an active session on this machine.',
        existingSessionId: existingActive[0].id,
      });
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
      activationToken,
      priceCents,
      currency: machine.currency,
      qrNonce: payload.nonce,
      ip,
      userAgent: req.headers['user-agent'] || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const nayaxAuth = await authorizeNayaxSession({
      nayaxTerminalId: machine.nayaxTerminalId,
      machineId: machine.machineId,
      userId,
      sessionId,
      amountCents: priceCents,
      currency: machine.currency,
    });

    if (!nayaxAuth.success || !nayaxAuth.nayaxSessionId) {
      await db
        .update(activationSessions)
        .set({ status: 'failed', failureReason: nayaxAuth.message || 'Nayax authorization failed', updatedAt: new Date() })
        .where(eq(activationSessions.id, sessionId));

      return res.status(502).json({
        success: false,
        errorCode: 'PAYMENT_AUTH_FAILED',
        message: 'Unable to authorize payment session.',
      });
    }

    await db
      .update(activationSessions)
      .set({ status: 'authorized', nayaxSessionId: nayaxAuth.nayaxSessionId, updatedAt: new Date() })
      .where(eq(activationSessions.id, sessionId));

    await markNonceUsed(payload.nonce);

    const result = {
      success: true,
      sessionId,
      activationToken,
      nayaxSessionId: nayaxAuth.nayaxSessionId,
      machineId: machine.machineId,
      machineName: machine.name,
      priceCents,
      currency: machine.currency,
      startWindowSeconds: ACTIVATION_TOKEN_TTL_SECONDS,
      message: 'Session authorized. Ready to start.',
    };

    if (idempotencyKey) await setIdempotencyResult(idempotencyKey, result);

    logger.info('[QRActivation] Session authorized', { sessionId, machineId: machine.machineId, userId: userId.slice(0, 8) + '...' });
    return res.json(result);

  } catch (error: any) {
    logger.error('[QRActivation] /activate failed', { error: error.message, ip });
    return res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: 'Activation failed.',
    });
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   POST /api/qr/start  —  Start the machine
   ────────────────────────────────────────────────────────────────────────── */
router.post('/start', requireAuth, async (req: any, res: Response) => {
  const userId: string = req.userId || req.user?.uid;

  try {
    const { sessionId, activationToken } = req.body as { sessionId?: string; activationToken?: string };

    if (!sessionId || !activationToken) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_START_REQUEST',
        message: 'Missing session data.',
      });
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
      await db
        .update(activationSessions)
        .set({ status: 'failed', failureReason: 'Activation token expired', updatedAt: new Date() })
        .where(eq(activationSessions.id, sessionId));

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

    if (!machine) {
      return res.status(404).json({ success: false, errorCode: 'MACHINE_NOT_FOUND', message: 'Machine not found.' });
    }
    if (machine.isBusy) {
      return res.status(409).json({ success: false, errorCode: 'MACHINE_BUSY', message: 'Machine is already in use.' });
    }

    const startResult = await startMachineProgram(machine.machineId, sessionId);

    if (!startResult.success) {
      await db
        .update(activationSessions)
        .set({ status: 'failed', failureReason: startResult.message || 'Machine start failed', updatedAt: new Date() })
        .where(eq(activationSessions.id, sessionId));

      return res.status(502).json({ success: false, errorCode: 'MACHINE_START_FAILED', message: 'Could not start machine.' });
    }

    await db.update(washMachines)
      .set({ isBusy: true, updatedAt: new Date() })
      .where(eq(washMachines.machineId, machine.machineId));

    const startedAt = new Date();
    await db
      .update(activationSessions)
      .set({ status: 'running', startedAt, updatedAt: new Date() })
      .where(eq(activationSessions.id, sessionId));

    logger.info('[QRActivation] Machine started', { sessionId, machineId: machine.machineId });

    return res.json({
      success: true,
      message: 'Machine started successfully.',
      sessionId,
      machineId: machine.machineId,
      startedAt: startedAt.toISOString(),
      estimatedSeconds: machine.defaultProgramSeconds,
    });

  } catch (error: any) {
    logger.error('[QRActivation] /start failed', { error: error.message });
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: 'Unable to start machine.' });
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   POST /api/qr/complete  —  Mark session as completed
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

    if (!session) {
      return res.status(404).json({ success: false, errorCode: 'SESSION_NOT_FOUND', message: 'Session not found.' });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ success: false, errorCode: 'SESSION_USER_MISMATCH', message: 'Session does not belong to you.' });
    }
    if (session.status !== 'running') {
      return res.status(409).json({ success: false, errorCode: 'SESSION_NOT_RUNNING', message: 'Session is not running.' });
    }

    const completedAt = new Date();
    await db
      .update(activationSessions)
      .set({ status: 'completed', completedAt, updatedAt: new Date() })
      .where(eq(activationSessions.id, sessionId));

    await db.update(washMachines)
      .set({ isBusy: false, updatedAt: new Date() })
      .where(eq(washMachines.machineId, session.machineId));

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
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: 'Unable to complete session.' });
  }
});

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/qr/session/:sessionId  —  Poll session status
   ────────────────────────────────────────────────────────────────────────── */
router.get('/session/:sessionId', requireAuth, async (req: any, res: Response) => {
  const userId: string = req.userId || req.user?.uid;

  try {
    const [session] = await db
      .select()
      .from(activationSessions)
      .where(
        and(
          eq(activationSessions.id, req.params.sessionId),
          eq(activationSessions.userId, userId),
        ),
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, errorCode: 'SESSION_NOT_FOUND' });
    }

    return res.json({ success: true, session });
  } catch (error: any) {
    logger.error('[QRActivation] /session poll failed', { error: error.message });
    return res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' });
  }
});

export default router;
