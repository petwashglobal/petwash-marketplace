/**
 * PetWash Prestige Pass — Backend Routes
 *
 * Endpoints:
 *   GET  /api/prestige-pass/me              — spec-compliant summary (userId, tier, balances)
 *   GET  /api/prestige-pass/wallet          — full wallet data + pass metadata
 *   POST /api/prestige-pass/token/generate  — generate signed short-lived QR token (kiosk)
 *   POST /api/prestige-pass/token/redeem    — kiosk validates + applies smart deduction
 *   POST /api/prestige-pass/redeem-online   — online booking payment via Prestige Pass balance
 *   GET  /api/prestige-pass/history         — last 20 redemption events
 *   POST /api/prestige-pass/topup           — add to cash wallet (from payment)
 *   GET  /api/prestige-pass/apple-wallet    — Apple Wallet pass.json (cert-ready structure)
 *   GET  /api/prestige-pass/google-wallet   — Google Wallet JWT for prestige pass
 *   POST /api/prestige-pass/activate        — enroll + send wallet email (Google + Apple buttons)
 *   POST /api/prestige-pass/resend-wallet-email — resend wallet email to logged-in user
 *
 * Deduction order (spec-compliant):
 *   1. Promo credits (expires first)
 *   2. eGift balance
 *   3. Package washes (kiosk free-wash path)
 *   4. Cash wallet balance
 *   5. Card fallback (shortfall returned to client)
 */

import { Router, Request, Response } from 'express';
import { createHash, createHmac, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import rateLimit from 'express-rate-limit';
import { db as firestoreDb, auth as firebaseAuth } from '../lib/firebase-admin';
import { db } from '../db';
import { walletAccounts, creditTransactions, walletLedgerEntries, walletReconciliationRuns, adminActionReversals, providerPayoutEntries } from '@shared/schema';
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { z } from 'zod';
import multer from 'multer';
import { EmailService } from '../emailService';
import { buildPrestigePassLuxuryEmail } from '../email/templates/prestige-pass-luxury-2026';
import { buildPassLinkToken } from '../lib/passTokens';
import { petwashPassAccounts } from '@shared/schema';

// Multer: in-memory storage for CSV reconciliation uploads (max 4 MB)
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

/**
 * Look up the user's petwash_pass_accounts record and return a signed
 * universal pass URL.  Both Apple and Google buttons can share the same
 * link — the /api/pass/:token handler does UA detection on the device.
 *
 * Falls back to a null-safe tuple so callers can always destructure
 * { appleWalletUrl, googleWalletUrl } without changing existing code.
 */
async function buildPrestigePassWalletUrls(
  userId: string,
  baseUrl: string
): Promise<{ appleWalletUrl: string | null; googleWalletUrl: string | null }> {
  try {
    const [acc] = await db
      .select({ passId: petwashPassAccounts.passId })
      .from(petwashPassAccounts)
      .where(eq(petwashPassAccounts.userId, userId))
      .limit(1);

    const passId = acc?.passId;
    if (!passId) {
      logger.warn('[PrestigePass] buildPrestigePassWalletUrls — no pass record for userId', { userId });
      return { appleWalletUrl: null, googleWalletUrl: null };
    }

    const token = buildPassLinkToken({ passId, userId });
    if (!token) {
      logger.warn('[PrestigePass] buildPrestigePassWalletUrls — PASS_LINK_SECRET not configured');
      return { appleWalletUrl: null, googleWalletUrl: null };
    }

    const url = `${baseUrl}/api/pass/${token}`;
    return { appleWalletUrl: url, googleWalletUrl: url };
  } catch (err) {
    logger.error('[PrestigePass] buildPrestigePassWalletUrls error', err);
    return { appleWalletUrl: null, googleWalletUrl: null };
  }
}
import { sendViaGmail } from './gmail';
import QRCode from 'qrcode';
import {
  getWalletBalances,
  getOrCreateWallet,
  applyDeduction,
  topUpCashWallet,
  adminManualCredit,
  type DeductionBreakdown,
} from '../services/WalletEngine';
import {
  isJtiConsumed,
  logFraudEvent,
  checkVelocity,
} from '../services/WalletLedger';
import {
  buildSaveUrl as googleWalletBuildSaveUrl,
  isGoogleWalletConfigured,
  ensureClassExists as googleWalletEnsureClass,
} from '../services/GoogleWalletService';
import {
  generateAppleWalletPass,
  buildPassJson as applePassJson,
  isAppleWalletConfigured,
} from '../services/AppleWalletService';
import { dispatchAcademySms } from '../services/academySmsHelper';

const router = Router();

// ─── Wallet error → HTTP status mapper ────────────────────────────────────────
// Translates structured error codes from WalletLedger/WalletEngine into proper
// HTTP responses. All codes are uppercase prefixes before the first colon.
function walletErrorResponse(res: Response, err: unknown): Response {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith('INVALID_AMOUNT'))       return res.status(400).json({ ok: false, error: 'Invalid amount', detail: msg });
  if (msg.startsWith('INVALID_CONTEXT'))      return res.status(400).json({ ok: false, error: 'Invalid request context', detail: msg });
  if (msg.startsWith('IDEMPOTENCY_CONFLICT')) return res.status(409).json({ ok: false, error: 'Idempotency key reused with different payload. Use a fresh key.', detail: msg });
  if (msg.startsWith('JTI_ALREADY_CONSUMED')) return res.status(409).json({ ok: false, error: 'Token already used — concurrent replay blocked', detail: msg });
  if (msg.startsWith('VELOCITY_EXCEEDED'))    return res.status(429).json({ ok: false, error: 'Too many requests. Please wait 60 seconds.', detail: msg });
  if (msg.startsWith('INSUFFICIENT_FUNDS'))   return res.status(402).json({ ok: false, error: 'Insufficient balance', detail: msg });
  if (msg.startsWith('WALLET_NOT_FOUND'))     return res.status(404).json({ ok: false, error: 'Wallet not found', detail: msg });
  if (msg.startsWith('HOLD_DECLINED'))        return res.status(402).json({ ok: false, error: 'Transaction held', detail: msg });
  // Fallback: unexpected error
  return res.status(500).json({ ok: false, error: 'Internal error' });
}

// ── SSE Registry — real-time push to user's open wallet tab ──────────────────
// When K9000 redeems a token → we push "wash_started" to the user instantly.
// Keyed by Firebase userId. Per-process (no Redis needed at this scale).
const sseClients = new Map<string, Response>();

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────
const _RAW_QR_SECRET = process.env.PRESTIGE_QR_SECRET;
if (!_RAW_QR_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[Prestige Pass] FATAL: PRESTIGE_QR_SECRET env var is not set. ' +
      'QR tokens are HMAC-signed — a missing secret allows anyone to forge valid tokens. ' +
      'Set PRESTIGE_QR_SECRET in Cloud Run secrets before deploying.'
    );
  } else {
    logger.warn(
      '[Prestige Pass] PRESTIGE_QR_SECRET not set — using insecure dev-only fallback. ' +
      'NEVER run without this secret in production.'
    );
  }
}
const QR_SECRET = _RAW_QR_SECRET ?? 'dev-only-insecure-prestige-qr-secret-do-not-use-in-prod';
const QR_TTL_SECONDS = 45;

// Tier → card variant
const TIER_VARIANT: Record<string, 'black' | 'gold' | 'platinum'> = {
  vip: 'black', elite: 'black', diamond: 'black', black: 'black',
  platinum: 'platinum',
  gold: 'gold', silver: 'gold',
  bronze: 'gold', new: 'gold',
};

// Prestige tier display names
const TIER_DISPLAY: Record<string, { en: string; he: string }> = {
  vip:      { en: 'Prestige Black',    he: 'פרסטיז' + ' שחור' },
  elite:    { en: 'Prestige Black',    he: 'פרסטיז' + ' שחור' },
  diamond:  { en: 'Prestige Black',    he: 'פרסטיז' + ' שחור' },
  black:    { en: 'Prestige Black',    he: 'פרסטיז' + ' שחור' },
  platinum: { en: 'Prestige Platinum', he: 'פרסטיז' + ' פלטינום' },
  gold:     { en: 'Prestige Gold',     he: 'פרסטיז' + ' זהב' },
  silver:   { en: 'Prestige Silver',   he: 'פרסטיז' + ' כסף' },
  bronze:   { en: 'Prestige Pearl',    he: 'פרסטיז' + ' פנינה' },
  new:      { en: 'Prestige Pearl',    he: 'פרסטיז' + ' פנינה' },
};

// ─────────────────────────────────────────────────────────
// RATE LIMITERS
// ─────────────────────────────────────────────────────────
const generateTokenLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { ok: false, error: 'Too many token requests' },
  keyGenerator: (req) => (req as any).session?.user?.uid || 'anon',
  validate: { xForwardedForHeader: false, ip: false, default: false },
});

const redeemLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { ok: false, error: 'Redemption rate limit exceeded' },
  keyGenerator: (req) => req.body?.stationId || req.ip || 'anon',
  validate: { xForwardedForHeader: false, ip: false, default: false },
});

const walletEmailLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: { ok: false, error: 'Maximum 5 wallet email resends per day reached. Try again tomorrow.' },
  keyGenerator: (req) => (req as any).session?.user?.uid || req.ip || 'anon',
  validate: { xForwardedForHeader: false, ip: false, default: false },
  standardHeaders: false,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────────────────
// QR TOKEN HELPERS
// ─────────────────────────────────────────────────────────
interface QrPayload {
  jti: string;
  sub: string;        // userId
  wid: string;        // walletId
  bay: 'left' | 'right' | 'any';
  mid?: string;       // machineId (optional)
  iat: number;
  exp: number;
  nonce: string;
}

function signPayload(payload: QrPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = createHmac('sha256', QR_SECRET).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifyToken(token: string): QrPayload | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = createHmac('sha256', QR_SECRET).update(data).digest('hex');
    if (expected !== sig) return null;
    const payload: QrPayload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (Date.now() / 1000 > payload.exp) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// GET /wallet — all balances + pass metadata
// ─────────────────────────────────────────────────────────
router.get('/wallet', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    let userId = session?.user?.uid;

    // Fallback: accept Firebase Bearer token (mobile Safari / fresh sessions)
    if (!userId) {
      const authHeader = req.headers['authorization'];
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = await firebaseAuth.verifyIdToken(authHeader.split('Bearer ')[1], true);
          userId = decoded.uid;
        } catch {
          return res.status(401).json({ ok: false, error: 'Auth required' });
        }
      }
    }

    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    // Load wallet from DB
    const [wallet] = await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .limit(1);

    // Load prestige pass metadata from Firestore
    const passDoc = await firestoreDb.collection('prestige_passes').doc(userId).get();
    let passData = passDoc.exists ? passDoc.data()! : null;

    if (!passData) {
      // Auto-create pass on first access
      const serialNumber = `PWL-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
      passData = {
        userId,
        serialNumber,
        passClass: 'public_member',
        tier: wallet?.loyaltyTier || 'new',
        issuedAt: new Date().toISOString(),
        cashWalletCents: 0,
      };
      await firestoreDb.collection('prestige_passes').doc(userId).set(passData);
    }

    const tier    = wallet?.loyaltyTier || passData.tier || 'new';
    const variant = TIER_VARIANT[tier] || 'gold';

    // Derive display card number from serialNumber (e.g. PWL-M9XK2Z-ABCD → take last 8 alphanum chars)
    const rawSerial   = (passData.serialNumber as string) || '';
    const alphaOnly   = rawSerial.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const raw8        = alphaOnly.length >= 8 ? alphaOnly.slice(-8) : alphaOnly.padEnd(8, '0');
    const cardId      = `PW-${raw8}`;
    const cardDisplay = `PW • ${raw8.slice(0, 4)} ${raw8.slice(4, 8)}`;

    const displayName = (session?.user?.displayName as string | undefined) || (passData.firstName as string | undefined) || undefined;

    // Persist cardId + userId to Firestore so /staff/lookup can find this user by card scan
    if (!passData.cardId || passData.cardId !== cardId) {
      firestoreDb.collection('prestige_passes').doc(userId).set(
        { cardId, userId, updatedAt: new Date().toISOString() },
        { merge: true },
      ).catch(() => { /* non-blocking */ });
    }

    const pet = {
      petName:  (passData.petName  as string | undefined) || null,
      petType:  (passData.petType  as string | undefined) || null,
      petBreed: (passData.petBreed as string | undefined) || null,
      petNotes: (passData.petNotes as string | undefined) || null,
    };

    return res.json({
      ok: true,
      displayName,
      cardId,
      cardDisplay,
      pet,
      pass: {
        serialNumber:  passData.serialNumber,
        userId,
        tier,
        variant,
        tierDisplay:   TIER_DISPLAY[tier] || TIER_DISPLAY.new,
        passClass:     passData.passClass || 'public_member',
        issuedAt:      passData.issuedAt,
      },
      balances: {
        cashWalletCents:        wallet?.cashWalletBalanceCents  || 0,
        egiftBalanceCents:      wallet?.egiftBalanceCents       || 0,
        promoBalanceCents:      wallet?.promoBalanceCents       || 0,
        packageWashesLeft:      wallet?.washPackageCredits      || 0,
        loyaltyPoints:          wallet?.loyaltyPointsBalance    || 0,
        referralBalanceCents:   wallet?.referralBalanceCents    || 0,
        pendingBalanceCents:    wallet?.pendingBalanceCents     || 0,
        lifetimeEarnedCents:    wallet?.lifetimeEarnedCents     || 0,
        lifetimeRedeemedCents:  wallet?.lifetimeRedeemedCents   || 0,
      },
    });
  } catch (err) {
    logger.error('[PrestigePass] /wallet error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /token/generate — signed short-lived QR token
// ─────────────────────────────────────────────────────────
const generateSchema = z.object({
  bay:       z.enum(['left', 'right', 'any']).default('any'),
  machineId: z.string().max(100).optional(),
});

router.post('/token/generate', generateTokenLimiter, async (req: Request, res: Response) => {
  try {
    const session  = (req as any).session;
    const userId   = session?.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input' });
    const { bay, machineId } = parsed.data;

    // Load wallet to confirm account is valid
    const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);

    const now = Math.floor(Date.now() / 1000);
    const jti = uuidv4();
    const payload: QrPayload = {
      jti,
      sub:   userId,
      wid:   wallet?.walletId || `WALLET-${userId.slice(0, 8)}`,
      bay,
      mid:   machineId,
      iat:   now,
      exp:   now + QR_TTL_SECONDS,
      nonce: randomBytes(16).toString('hex'),
    };

    const token = signPayload(payload);

    // Store in Firestore with TTL (Firestore TTL via field, pruned by cleanup job)
    await firestoreDb.collection('prestige_qr_tokens').doc(jti).set({
      jti,
      userId,
      walletId: payload.wid,
      bay,
      machineId: machineId || null,
      issuedAt:  new Date(now * 1000).toISOString(),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      used:      false,
    });

    logger.info('[PrestigePass] QR token generated', { jti, userId, bay, ttl: QR_TTL_SECONDS });

    return res.json({
      ok:        true,
      token,
      jti,
      bay,
      expiresAt: payload.exp,
      ttl:       QR_TTL_SECONDS,
    });
  } catch (err) {
    logger.error('[PrestigePass] /token/generate error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /token/redeem — kiosk validates + smart deduction
// ─────────────────────────────────────────────────────────
const redeemSchema = z.object({
  token:     z.string().min(10),
  stationId: z.string().max(100).optional(),
  bay:       z.enum(['left', 'right', 'any']).optional(),
  amountCents: z.number().min(0).optional(),
});

// ─────────────────────────────────────────────────────────
// NOTE: Deduction engine is now in WalletEngine.ts (PostgreSQL-only, atomic).
// DeductionBreakdown type imported from WalletEngine.
// ─────────────────────────────────────────────────────────

// Wrapper for the kiosk path — uses WalletEngine (PostgreSQL-only, atomic)
interface SmartRedemptionCtx {
  jti?:             string;
  idempotencyKey?:  string;
  ipAddress?:       string | null;
  userAgent?:       string | null;
  staffId?:         string;
  endpoint?:        string;
}

async function applySmartRedemption(
  userId: string,
  amountCents: number,
  serviceType: string,
  machineId?: string,
  bayId?: string,
  ctx?: SmartRedemptionCtx,
): Promise<{
  source:             string;
  deductedCents:      number;
  newCashWalletCents: number;
  washDeducted:       boolean;
  breakdown:          DeductionBreakdown;
  txnId:              string;
  idempotent:         boolean;
}> {
  const walletBalances = await getWalletBalances(userId);
  if (!walletBalances) {
    return {
      source: 'no_wallet', deductedCents: 0, newCashWalletCents: 0,
      washDeducted: false, txnId: '', idempotent: false,
      breakdown: { promo: 0, gift: 0, package: 0, wallet: 0, cardFallback: amountCents,
        totalCovered: 0, ok: false, shortfall: amountCents, washDeducted: false, serviceDeducted: false },
    };
  }

  const isKioskWash = amountCents === 0 && walletBalances.washPackageCredits > 0;

  // Quick pre-check: skip deduction engine if wallet has nothing to contribute
  const totalMonetary = walletBalances.promoBalanceCents + walletBalances.egiftBalanceCents + walletBalances.cashWalletBalanceCents;
  if (!isKioskWash && totalMonetary === 0 && amountCents > 0) {
    const emptyBreakdown: DeductionBreakdown = {
      promo: 0, gift: 0, package: 0, wallet: 0,
      cardFallback: amountCents, totalCovered: 0,
      ok: false, shortfall: amountCents, washDeducted: false, serviceDeducted: false,
    };
    return { source: 'card_required', deductedCents: 0, newCashWalletCents: walletBalances.cashWalletBalanceCents, washDeducted: false, txnId: '', breakdown: emptyBreakdown, idempotent: false };
  }

  const result = await applyDeduction({
    userId, amountCents, isKioskWash,
    serviceType, machineId, bayId,
    description: `Prestige Pass ${isKioskWash ? 'free wash' : 'kiosk'} — ${machineId || 'terminal'}`,
    // Anti-fraud context — thread through from request
    jti:             ctx?.jti,
    idempotencyKey:  ctx?.idempotencyKey,
    ipAddress:       ctx?.ipAddress,
    userAgent:       ctx?.userAgent,
    staffId:         ctx?.staffId,
    endpoint:        ctx?.endpoint ?? `prestige-pass/${serviceType}`,
    // Division tracking — kiosk path always K9000
    divisionCode:    'station_k9000',
    sourceType:      isKioskWash ? 'k9000_wash' : 'k9000_kiosk_payment',
  });

  // result.source is already computed by WalletEngine.applyDeduction()
  return {
    source:             result.source,
    deductedCents:      result.deductedCents,
    newCashWalletCents: result.newCashWalletCents,
    washDeducted:       result.breakdown.washDeducted,
    txnId:              result.txnId,
    breakdown:          result.breakdown,
    idempotent:         result.idempotent,
  };
}

router.post('/token/redeem', redeemLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input' });
    const { token, stationId, bay, amountCents = 0 } = parsed.data;

    // 1. Verify HMAC signature + expiry
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }

    const { jti, sub: userId, wid: walletId } = payload;
    const clientIp  = req.ip ?? req.socket?.remoteAddress ?? null;
    const clientUa  = (req.headers['user-agent'] as string) ?? null;
    const idemKey   = (req.headers['x-idempotency-key'] as string) || `jti:${jti}`;

    // 2a. Anti-replay check in PostgreSQL (primary guard — cannot be cleared)
    const pgJtiUsed = await isJtiConsumed(jti);
    if (pgJtiUsed) {
      await logFraudEvent({
        userId, action: 'jti_replay_postgresql', riskScore: 95, outcome: 'blocked',
        reason: `JTI ${jti} already consumed in PostgreSQL registry`,
        ipAddress: clientIp, userAgent: clientUa,
      });
      logger.warn('[PrestigePass] Replay blocked (PostgreSQL JTI registry)', { jti, userId });
      return res.status(409).json({ ok: false, error: 'Token already used (anti-replay)' });
    }

    // 2b. Anti-replay check in Firestore (secondary layer)
    const tokenRef = firestoreDb.collection('prestige_qr_tokens').doc(jti);
    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists || tokenDoc.data()?.used === true) {
      await logFraudEvent({
        userId, action: 'jti_replay_firestore', riskScore: 95, outcome: 'blocked',
        reason: `JTI ${jti} already consumed in Firestore`,
        ipAddress: clientIp, userAgent: clientUa,
      });
      logger.warn('[PrestigePass] Replay attack blocked (Firestore)', { jti, userId });
      return res.status(409).json({ ok: false, error: 'Token already used (anti-replay)' });
    }

    // 3. Bay validation
    const requestedBay = bay || payload.bay;
    const effectiveBay = requestedBay === 'any'
      ? (stationId?.includes('L') ? 'left' : 'right')
      : requestedBay;

    // 4. Mark token as used in Firestore (atomic)
    await tokenRef.update({
      used:      true,
      usedAt:    new Date().toISOString(),
      stationId: stationId || null,
      bay:       effectiveBay,
    });

    // 5. Apply smart redemption — threads jti + ip + ua + idempotencyKey into
    //    WalletLedger for full anti-fraud protection (JTI PG registration happens inside tx)
    const result = await applySmartRedemption(userId, amountCents, 'k9000', stationId, effectiveBay, {
      jti,
      idempotencyKey: idemKey,
      ipAddress:      clientIp,
      userAgent:      clientUa,
      endpoint:       'prestige-pass/token/redeem',
    });

    logger.info('[PrestigePass] Token redeemed', {
      jti, userId, stationId, bay: effectiveBay,
      source: result.source, deducted: result.deductedCents, idempotent: result.idempotent,
    });

    // ── Real-time SSE push → user's open wallet tab sees "Wash started" instantly ──
    const sseRes = sseClients.get(userId);
    if (sseRes) {
      try {
        sseRes.write(`data: ${JSON.stringify({
          type:            'wash_started',
          bay:             effectiveBay,
          stationId:       stationId || null,
          deductedCents:   result.deductedCents,
          newBalanceCents: result.newCashWalletCents,
          source:          result.source,
          timestamp:       new Date().toISOString(),
        })}\n\n`);
      } catch { /* client already disconnected */ }
    }

    return res.json({
      ok:           true,
      bay:          effectiveBay,
      stationId:    stationId || null,
      redemption:   result,
      action:       result.source === 'card_required' ? 'prompt_card_payment' : 'start_wash',
      washAuthorized: result.source !== 'card_required',
    });
  } catch (err) {
    logger.error('[PrestigePass] /token/redeem error:', err);
    return walletErrorResponse(res, err);
  }
});

// ─────────────────────────────────────────────────────────
// GET /history — last 20 prestige redemptions
// ─────────────────────────────────────────────────────────
router.get('/history', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const [wallet] = await db.select({ walletId: walletAccounts.walletId })
      .from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);

    if (!wallet) return res.json({ ok: true, events: [] });

    const txns = await db.select()
      .from(creditTransactions)
      .where(eq(creditTransactions.walletId, wallet.walletId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(20);

    return res.json({ ok: true, events: txns });
  } catch (err) {
    logger.error('[PrestigePass] /history error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /division-activity — cross-platform wallet activity
// Returns last 25 ledger debit entries grouped by division.
// Powers the DivisionActivitySection in the Privilege UI.
// Finance query: SELECT division_code, SUM(amount) WHERE direction='debit'
// ─────────────────────────────────────────────────────────
router.get('/division-activity', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    let userId = session?.user?.uid;

    // Firebase Bearer token fallback (mobile Safari)
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = await firebaseAuth.verifyIdToken(authHeader.slice(7));
          userId = decoded.uid;
        } catch { /* ignore */ }
      }
    }
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const [wallet] = await db
      .select({ walletId: walletAccounts.walletId })
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .limit(1);

    if (!wallet) {
      return res.json({
        ok: true,
        activity: { station_k9000: [], petsitter: [], walkers: [], academy: [], pettrek: [], general: [] },
        totals:   { station_k9000: 0, petsitter: 0, walkers: 0, academy: 0, pettrek: 0, general: 0 },
        lifetimeRedeemedCents: 0,
      });
    }

    // Fetch last 60 debit ledger entries for this wallet
    const rawEntries = await db
      .select({
        entryId:      walletLedgerEntries.entryId,
        divisionCode: walletLedgerEntries.divisionCode,
        sourceType:   walletLedgerEntries.sourceType,
        amountCents:  walletLedgerEntries.amountCents,
        bucket:       walletLedgerEntries.bucket,
        eventType:    walletLedgerEntries.eventType,
        bookingId:    walletLedgerEntries.bookingId,
        kioskId:      walletLedgerEntries.kioskId,
        createdAt:    walletLedgerEntries.createdAt,
        metadata:     walletLedgerEntries.metadata,
      })
      .from(walletLedgerEntries)
      .where(
        and(
          eq(walletLedgerEntries.walletId, wallet.walletId),
          eq(walletLedgerEntries.direction, 'debit'),
        )
      )
      .orderBy(desc(walletLedgerEntries.createdAt))
      .limit(60);

    // Division totals query — the spec finance query
    const divisionTotalsRaw: any = await db.execute(sql`
      SELECT 
        COALESCE(division_code, 'general') AS division_code,
        SUM(amount_cents) AS total_cents,
        COUNT(*) AS tx_count
      FROM wallet_ledger_entries
      WHERE wallet_id = ${wallet.walletId}
        AND direction = 'debit'
      GROUP BY COALESCE(division_code, 'general')
    `);

    const totalsRows: any[] = divisionTotalsRaw?.rows ?? divisionTotalsRaw ?? [];
    const totals: Record<string, number> = {};
    for (const row of totalsRows) {
      totals[row.division_code] = Number(row.total_cents) || 0;
    }

    // Lifetime redeemed
    const lifetimeRaw: any = await db.execute(sql`
      SELECT SUM(amount_cents) AS total FROM wallet_ledger_entries
      WHERE wallet_id = ${wallet.walletId} AND direction = 'debit'
    `);
    const lifetimeRows: any[] = lifetimeRaw?.rows ?? lifetimeRaw ?? [];
    const lifetimeRedeemedCents = Number(lifetimeRows[0]?.total) || 0;

    // Group entries by division
    const KNOWN_DIVISIONS = ['station_k9000', 'petsitter', 'walkers', 'academy', 'pettrek', 'general'];
    const activity: Record<string, typeof rawEntries> = {};
    for (const div of KNOWN_DIVISIONS) activity[div] = [];

    for (const entry of rawEntries) {
      const key = entry.divisionCode ?? 'general';
      const target = KNOWN_DIVISIONS.includes(key) ? key : 'general';
      if (activity[target].length < 10) activity[target].push(entry);
    }

    return res.json({
      ok: true,
      activity,
      totals: {
        ...Object.fromEntries(KNOWN_DIVISIONS.map(d => [d, 0])),
        ...totals,
      },
      lifetimeRedeemedCents,
    });
  } catch (err) {
    logger.error('[PrestigePass] /division-activity error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /apple-wallet — pass.json structure (cert-ready)
// ─────────────────────────────────────────────────────────
router.get('/apple-wallet', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const passDoc = await firestoreDb.collection('prestige_passes').doc(userId).get();
    const passData = passDoc.exists ? passDoc.data()! : {};
    const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);

    const tier    = wallet?.loyaltyTier || 'new';
    const balance = ((wallet?.cashWalletBalanceCents || 0) + (wallet?.egiftBalanceCents || 0)) / 100;
    const washes  = wallet?.washPackageCredits || 0;

    // Apple Wallet pass.json structure
    // To generate actual .pkpass: zip this JSON + icons + manifest.json + PKCS#7 signature
    // Certificate required: passTypeIdentifier registered in Apple Developer Portal
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: 'pass.il.petwash.prestige',
      serialNumber: passData.serialNumber || `PWL-${userId.slice(0, 8).toUpperCase()}`,
      teamIdentifier: 'REPLACE_WITH_APPLE_TEAM_ID',
      organizationName: 'PetWash Ltd',
      description: 'PetWash Prestige Pass',
      logoText: 'PetWash™',
      foregroundColor: tier === 'platinum' ? 'rgb(255,255,255)' : 'rgb(255,255,255)',
      backgroundColor: tier === 'black' || tier === 'elite' || tier === 'vip' || tier === 'diamond'
        ? 'rgb(15,15,15)'
        : 'rgb(180,135,40)',
      labelColor: 'rgb(212,175,55)',
      generic: {
        primaryFields: [
          {
            key:   'balance',
            label: 'BALANCE',
            value: `₪${balance.toFixed(0)}`,
          },
        ],
        secondaryFields: [
          {
            key:   'washes',
            label: 'WASH CREDITS',
            value: washes > 0 ? `${washes} washes` : '—',
          },
          {
            key:   'tier',
            label: 'TIER',
            value: TIER_DISPLAY[tier]?.en || 'Prestige Pearl',
          },
        ],
        auxiliaryFields: [
          {
            key:   'member',
            label: 'MEMBER',
            value: session?.user?.displayName || 'Member',
          },
        ],
        backFields: [
          { key: 'terms',   label: 'Terms',   value: 'Not redeemable for cash. Valid at PetWash stations only.' },
          { key: 'support', label: 'Support',  value: 'support@petwash.co.il' },
          { key: 'site',    label: 'Website',  value: 'www.petwash.co.il' },
        ],
      },
      barcode: {
        message:         `PETWASH:${userId}:${passData.serialNumber || 'PASS'}`,
        format:          'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText:         passData.serialNumber || userId.slice(0, 12).toUpperCase(),
      },
      locations: [
        {
          longitude:   34.7818,
          latitude:    32.0853,
          relevantText: 'PetWash station nearby',
        },
      ],
      expirationDate: null,
      webServiceURL: `${process.env.BACKEND_URL || 'https://petwash-api-xxxxx-ew.a.run.app'}/api/prestige-pass/apple-wallet`,
      authenticationToken: Buffer.from(userId).toString('base64').slice(0, 32),
    };

    const serialNumber = passData.serialNumber || `PWL-${userId.slice(0, 8).toUpperCase()}`;

    if (!isAppleWalletConfigured()) {
      const preview = applePassJson({
        passId:             serialNumber,
        userId,
        ownerName:          session?.user?.displayName || 'Member',
        tier:               (tier || 'new').toUpperCase(),
        availableCreditIls: balance,
        qrTokenVersion:     1,
      });
      return res.status(503).json({ ok: false, error: 'Apple Wallet certificates not yet configured', preview });
    }

    const pkpassBuffer = await generateAppleWalletPass({
      passId:             serialNumber,
      userId,
      ownerName:          session?.user?.displayName || 'Member',
      tier:               (tier || 'new').toUpperCase(),
      availableCreditIls: balance,
      qrTokenVersion:     1,
    });
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${serialNumber}.pkpass"`);
    return res.send(pkpassBuffer);
  } catch (err) {
    logger.error('[PrestigePass] /apple-wallet error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /google-wallet — Google Wallet JWT pass (auth-guarded)
// ─────────────────────────────────────────────────────────
router.get('/google-wallet', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const passDoc = await firestoreDb.collection('prestige_passes').doc(userId).get();
    const passData = passDoc.exists ? passDoc.data()! : {};
    const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);

    const tier        = wallet?.loyaltyTier || 'new';
    const balance     = ((wallet?.cashWalletBalanceCents || 0) + (wallet?.egiftBalanceCents || 0)) / 100;
    const washes      = wallet?.washPackageCredits || 0;
    const serialNumber = passData.serialNumber || `PWL-${userId.slice(0, 8).toUpperCase()}`;
    const tierDisplay  = TIER_DISPLAY[tier]?.en || 'Prestige Pearl';

    const issuerId   = process.env.GOOGLE_WALLET_ISSUER_ID;
    const classId    = process.env.GOOGLE_WALLET_CLASS_ID || `petwash.prestige`;
    const saKeyRaw   = process.env.GOOGLE_WALLET_SA_KEY;

    if (!issuerId || !saKeyRaw) {
      return res.status(200).json({
        ok: true,
        configured: false,
        message: 'Google Wallet pass structure ready — set GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SA_KEY in Cloud Run secrets to activate',
        passObject: {
          id:          `${issuerId || 'ISSUER_ID'}.${serialNumber}`,
          classId:     `${issuerId || 'ISSUER_ID'}.${classId}`,
          cardTitle:   { defaultValue: { language: 'en', value: 'PetWash Prestige Pass' } },
          subheader:   { defaultValue: { language: 'en', value: tierDisplay } },
          header:      { defaultValue: { language: 'en', value: `₪${balance.toFixed(0)}` } },
          logo:        { sourceUri: { uri: 'https://petwash.co.il/logo.png' } },
          hexBackgroundColor: tier === 'black' || tier === 'elite' || tier === 'diamond' ? '#0F0F0F' : '#B48728',
          barcode: {
            type:    'QR_CODE',
            value:   `PETWASH:${userId}:${serialNumber}`,
            alternateText: serialNumber,
          },
          textModulesData: [
            { id: 'washes',  header: 'WASH CREDITS', body: washes > 0 ? `${washes} washes` : '—' },
            { id: 'member',  header: 'MEMBER', body: session?.user?.displayName || 'Member' },
          ],
        },
      });
    }

    // Build a real Google Wallet "save" link using RS256-signed JWT
    const { createSign } = await import('crypto');
    let saKey: { client_email: string; private_key: string };
    try {
      saKey = JSON.parse(saKeyRaw);
    } catch {
      logger.error('[PrestigePass] GOOGLE_WALLET_SA_KEY is not valid JSON');
      return res.status(500).json({ ok: false, error: 'Wallet service misconfigured' });
    }

    const objectId = `${issuerId}.${serialNumber}`;
    const now      = Math.floor(Date.now() / 1000);

    const payload = {
      iss: saKey.client_email,
      aud: 'google',
      origins: ['https://petwash.co.il'],
      typ: 'savetowallet',
      iat: now,
      payload: {
        genericObjects: [{
          id:      objectId,
          classId: `${issuerId}.${classId}`,
          cardTitle:   { defaultValue: { language: 'en', value: 'PetWash Prestige Pass' } },
          subheader:   { defaultValue: { language: 'en', value: tierDisplay } },
          header:      { defaultValue: { language: 'en', value: `₪${balance.toFixed(0)}` } },
          logo:        { sourceUri: { uri: 'https://petwash.co.il/logo.png' } },
          hexBackgroundColor: tier === 'black' || tier === 'elite' || tier === 'diamond' ? '#0F0F0F' : '#B48728',
          barcode: {
            type:    'QR_CODE',
            value:   `PETWASH:${userId}:${serialNumber}`,
            alternateText: serialNumber,
          },
          textModulesData: [
            { id: 'washes',  header: 'WASH CREDITS', body: washes > 0 ? `${washes} washes` : '—' },
            { id: 'member',  header: 'MEMBER', body: session?.user?.displayName || 'Member' },
          ],
        }],
      },
    };

    const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body    = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signer  = createSign('RSA-SHA256');
    signer.update(`${header}.${body}`);
    const sig     = signer.sign(saKey.private_key, 'base64url');
    const jwt     = `${header}.${body}.${sig}`;

    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;

    return res.json({ ok: true, configured: true, saveUrl, jwt });
  } catch (err) {
    logger.error('[PrestigePass] /google-wallet error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /topup — add to cash wallet (triggers from payment)
// ─────────────────────────────────────────────────────────
const topupSchema = z.object({
  amountCents: z.number().min(100).max(1_000_000),
  source:      z.enum(['card', 'transfer', 'admin']),
  reference:   z.string().optional(),
});

router.post('/topup', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const parsed = topupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input' });
    const { amountCents, source, reference } = parsed.data;

    const { txnId, newBalanceCents } = await topUpCashWallet(userId, amountCents, source, reference);

    logger.info('[PrestigePass] Top-up applied', { userId, amountCents, source, txnId, newBalanceCents });

    return res.json({
      ok:              true,
      cashWalletCents: newBalanceCents,
      added:           amountCents,
      txnId,
    });
  } catch (err) {
    logger.error('[PrestigePass] /topup error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// EMAIL HELPER — pre-generate Google Wallet save URL for embedding in email
// Thin adapter over GoogleWalletService.buildSaveUrl.
// Returns null silently if secrets aren't configured yet.
// ─────────────────────────────────────────────────────────
async function buildGoogleWalletSaveUrl(opts: {
  userId: string;
  serialNumber: string;
  tier: string;
  balanceILS: number;
  washes: number;
  displayName: string;
}): Promise<string | null> {
  try {
    return googleWalletBuildSaveUrl({
      passId:             opts.serialNumber,
      userId:             opts.userId,
      ownerName:          opts.displayName || 'Member',
      tier:               (opts.tier || 'new').toUpperCase(),
      availableCreditIls: opts.balanceILS,
      qrTokenVersion:     1,
    });
  } catch (err) {
    logger.warn('[PrestigePass] Could not pre-generate Google Wallet save URL for email', { err });
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// EMAIL HELPER — Prestige Pass wallet email
// ─────────────────────────────────────────────────────────
function buildPrestigeWalletEmail(opts: {
  firstName: string;
  tierDisplay: string;
  cardNumber: string;
  appBaseUrl: string;
  cashWalletCents: number;
  freeWashesRemaining: number;
  googleWalletSaveUrl?: string | null;
}): string {
  const { firstName, tierDisplay, cardNumber, appBaseUrl, cashWalletCents, freeWashesRemaining, googleWalletSaveUrl } = opts;
  const cashDisplay = (cashWalletCents / 100).toFixed(2);
  // Both wallet buttons open the app's prestige-pass page where the user logs in and downloads.
  // Google Wallet uses a pre-generated pay.google.com save URL when available.
  const walletUrl      = `${appBaseUrl}/prestige-pass`;
  const googleWalletUrl = googleWalletSaveUrl || walletUrl;
  const appleWalletUrl  = walletUrl;
  const maskedCard = `•••• •••• ${cardNumber.slice(-4)}`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>הפאס הפרסטיז שלך מוכן — PetWash</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;color:#f0f0f0;">

<!-- Wrapper -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td align="center" style="padding:32px 16px;">

<!-- Card -->
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#111111;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">

  <!-- Header bar -->
  <tr>
    <td style="background:linear-gradient(135deg,#1a1a1a 0%,#2a2207 100%);padding:28px 32px;border-bottom:2px solid #D4AF37;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <div style="font-size:11px;letter-spacing:4px;color:#D4AF37;text-transform:uppercase;margin-bottom:6px;">PetWash™</div>
            <div style="font-size:22px;font-weight:700;color:#ffffff;">הפאס הפרסטיז שלך מוכן</div>
          </td>
          <td align="left" style="padding-right:16px;">
            <div style="background:linear-gradient(135deg,#D4AF37,#F0D060);color:#0a0a0a;font-size:11px;font-weight:800;letter-spacing:2px;padding:6px 14px;border-radius:20px;white-space:nowrap;">
              ${tierDisplay.toUpperCase()}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="padding:28px 32px 8px;">
      <p style="margin:0;font-size:16px;color:#cccccc;">שלום ${firstName || 'לקוח יקר'},</p>
      <p style="margin:12px 0 0;font-size:15px;color:#999999;line-height:1.6;">
        כרטיס ה-${tierDisplay} שלך פעיל ומוכן לשימוש. שמור אותו ב-Wallet שלך כדי לגשת מהר לכל התחנות.
      </p>
    </td>
  </tr>

  <!-- Wallet Buttons — top, prominent, just like Oztix -->
  <tr>
    <td style="padding:24px 32px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr>
          <!-- Google Wallet -->
          <td style="padding-left:0;">
            <a href="${googleWalletUrl}" target="_blank" style="display:inline-block;text-decoration:none;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="background:#000000;border:1px solid #444;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <!-- Google logo in text (email-safe) -->
                          <span style="font-size:18px;font-weight:900;color:#4285F4;font-family:Arial;">G</span><span style="font-size:18px;font-weight:900;color:#EA4335;">o</span><span style="font-size:18px;font-weight:900;color:#FBBC05;">o</span><span style="font-size:18px;font-weight:900;color:#4285F4;">g</span><span style="font-size:18px;font-weight:900;color:#34A853;">l</span><span style="font-size:18px;font-weight:900;color:#EA4335;">e</span>
                        </td>
                        <td style="padding:0 12px;border-right:1px solid #333;"></td>
                        <td style="padding-right:12px;">
                          <div style="font-size:10px;color:#aaaaaa;letter-spacing:0.5px;">הוסף ל-</div>
                          <div style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Google Wallet</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </a>
          </td>
          <td style="width:12px;"></td>
          <!-- Apple Wallet -->
          <td>
            <a href="${appleWalletUrl}" target="_blank" style="display:inline-block;text-decoration:none;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="background:#000000;border:1px solid #444;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <span style="font-size:22px;color:#ffffff;font-family:'Apple Color Emoji',Arial;">&#63743;</span>
                        </td>
                        <td style="padding:0 12px;border-right:1px solid #333;"></td>
                        <td style="padding-right:12px;">
                          <div style="font-size:10px;color:#aaaaaa;letter-spacing:0.5px;">הוסף ל-</div>
                          <div style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Apple Wallet</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Divider -->
  <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #2a2a2a;margin:0;"/></td></tr>

  <!-- Card details -->
  <tr>
    <td style="padding:24px 32px;">
      <div style="font-size:11px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;margin-bottom:14px;">פרטי הכרטיס</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding-bottom:10px;">
            <span style="font-size:13px;color:#888;">מספר כרטיס</span><br/>
            <span style="font-size:16px;color:#f0f0f0;font-family:monospace;letter-spacing:2px;">${maskedCard}</span>
          </td>
          <td align="left" style="padding-bottom:10px;">
            <span style="font-size:13px;color:#888;">רמה</span><br/>
            <span style="font-size:16px;color:#D4AF37;font-weight:700;">${tierDisplay}</span>
          </td>
        </tr>
        <tr>
          <td>
            <span style="font-size:13px;color:#888;">יתרת מזומן</span><br/>
            <span style="font-size:20px;color:#F0D060;font-weight:700;">₪${cashDisplay}</span>
          </td>
          <td align="left">
            <span style="font-size:13px;color:#888;">שטיפות חינם</span><br/>
            <span style="font-size:20px;color:#F0D060;font-weight:700;">${freeWashesRemaining} שטיפות</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA button -->
  <tr>
    <td style="padding:8px 32px 32px;">
      <a href="${walletUrl}" target="_blank"
         style="display:inline-block;background:linear-gradient(135deg,#D4AF37,#F0D060);color:#0a0a0a;font-size:15px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:1px;">
        פתח את הפאס שלי ←
      </a>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:20px 32px;background:#0d0d0d;border-top:1px solid #1f1f1f;text-align:center;">
      <p style="margin:0;font-size:12px;color:#555555;">
        PetWash™ · שירות חניון ושטיפת חיות מחמד · <a href="https://petwash.co.il" style="color:#D4AF37;text-decoration:none;">petwash.co.il</a>
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#444444;">
        קיבלת מייל זה כי הצטרפת לתוכנית Prestige Pass של PetWash.
      </p>
    </td>
  </tr>

</table>

</td></tr>
</table>

</body>
</html>`;
}

// ─────────────────────────────────────────────────────────
// POST /activate — enroll user in Prestige Pass + send wallet email
// ─────────────────────────────────────────────────────────
const activateSchema = z.object({
  tier:        z.string().default('new'),
  firstName:   z.string().optional(),
  email:       z.string().email().optional(),
  cardNumber:  z.string().optional(),
});

router.post('/activate', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const parsed = activateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input' });
    const { tier, firstName, email, cardNumber } = parsed.data;

    // Derive card number if not supplied
    const passCardNumber = cardNumber || `${userId.slice(0, 4).toUpperCase()}${Date.now().toString().slice(-8)}`;
    const tierKey        = tier.toLowerCase();
    const tierDisplay    = TIER_DISPLAY[tierKey]?.en || 'Prestige Pearl';

    // Upsert Firestore pass doc
    const passRef = firestoreDb.collection('prestige_passes').doc(userId);
    const existing = await passRef.get();
    if (!existing.exists) {
      await passRef.set({
        userId,
        tier:               tierKey,
        cardNumber:         passCardNumber,
        cashWalletCents:    0,
        freeWashesRemaining: tier === 'black' ? 5 : tier === 'platinum' ? 3 : 1,
        issuedAt:           new Date().toISOString(),
        emailSentAt:        null,
      });
    }

    const [activateWallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);
    const recipientEmail = email || session?.user?.email;

    // Send wallet email with both wallet buttons
    if (recipientEmail) {
      const appBaseUrl        = process.env.APP_BASE_URL || 'https://petwash.co.il';
      const activateCash      = activateWallet?.cashWalletBalanceCents || 0;
      const activateEgift     = activateWallet?.egiftBalanceCents || 0;
      const activateWashes    = activateWallet?.washPackageCredits || 0;
      const activateDisplay   = firstName || session?.user?.displayName || '';

      const googleWalletSaveUrl = await buildGoogleWalletSaveUrl({
        userId,
        serialNumber: passCardNumber,
        tier:         tierKey,
        balanceILS:   (activateCash + activateEgift) / 100,
        washes:       activateWashes,
        displayName:  activateDisplay,
      });

      const html = buildPrestigeWalletEmail({
        firstName:           activateDisplay.split(' ')[0] || 'לקוח יקר',
        tierDisplay,
        cardNumber:          passCardNumber,
        appBaseUrl,
        cashWalletCents:     activateCash + activateEgift,
        freeWashesRemaining: activateWashes,
        googleWalletSaveUrl,
      });

      const sent = await EmailService.send({
        to:      recipientEmail,
        subject: `הפאס הפרסטיז שלך מוכן — ${tierDisplay} 🐾`,
        html,
      });

      if (sent) {
        await passRef.update({ emailSentAt: new Date().toISOString() });
        logger.info('[PrestigePass] Wallet email sent', { userId, recipientEmail, tier: tierKey, googleWalletReady: !!googleWalletSaveUrl });
      }
    }

    return res.json({
      ok:          true,
      cardNumber:  passCardNumber,
      tier:        tierKey,
      tierDisplay,
      emailSent:   !!recipientEmail,
    });
  } catch (err) {
    logger.error('[PrestigePass] /activate error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /me — spec-compliant summary alias (mirrors /wallet)
// Returns: { userId, tier, balances: { promo, gift, wallet, washes, loyaltyPoints } }
// ─────────────────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    if (!userId) return res.status(401).json({ authenticated: false, error: 'Auth required' });

    const [wallet] = await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .limit(1);

    const passDoc  = await firestoreDb.collection('prestige_passes').doc(userId).get();
    const passData = passDoc.data() || {};
    const tier = wallet?.loyaltyTier || passData.tier || 'new';

    // Derive a stable card number: PW- + last 8 chars of userId (uppercase)
    const rawId    = (passData.cardNumber as string) || userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
    const cardId   = `PW-${rawId}`;
    // Formatted for display: PW • XXXX XXXX
    const cardDisplay = rawId.length >= 8
      ? `PW • ${rawId.slice(0,4)} ${rawId.slice(4,8)}`
      : `PW • ${rawId}`;

    const displayName = (session?.user?.displayName as string | undefined) || passData.firstName as string | undefined || undefined;

    return res.json({
      userId,
      tier,
      displayName,
      cardId,
      cardDisplay,
      balances: {
        promo:         wallet?.promoBalanceCents        ?? 0,
        gift:          wallet?.egiftBalanceCents        ?? 0,
        wallet:        wallet?.cashWalletBalanceCents   ?? 0,
        washes:        wallet?.washPackageCredits       ?? 0,
        loyaltyPoints: wallet?.loyaltyPointsBalance     ?? 0,
      },
    });
  } catch (err) {
    logger.error('[PrestigePass] /me error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /redeem-online — online service redemption
// Called from booking checkout when user selects "Pay with Prestige Pass"
// Applies deduction order: promo → gift → package → wallet → card_fallback
// ─────────────────────────────────────────────────────────
const redeemOnlineSchema = z.object({
  bookingId:   z.string().min(1).max(200),
  serviceType: z.enum([
    'pet_sitter', 'dog_walker', 'pet_transport', 'academy',
    'grooming', 'vet', 'daycare', 'other',
  ]),
  amountGross: z.number().min(1).max(500_000),   // in agorot (ILS cents)
});

router.post('/redeem-online', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const parsed = redeemOnlineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { bookingId, serviceType, amountGross } = parsed.data;

    // Load wallet balances from PostgreSQL only
    const walletBalances = await getWalletBalances(userId);
    if (!walletBalances) {
      return res.status(404).json({ ok: false, error: 'No wallet account found. Please activate your Prestige Pass first.' });
    }

    const totalAvailable =
      walletBalances.promoBalanceCents +
      walletBalances.egiftBalanceCents +
      walletBalances.cashWalletBalanceCents;

    if (totalAvailable < amountGross) {
      return res.status(402).json({
        ok:        false,
        error:     'Insufficient balance',
        available: totalAvailable,
        required:  amountGross,
        shortfall: amountGross - totalAvailable,
      });
    }

    // Map service type to platform division code for financial reporting
    const DIVISION_MAP: Record<string, string> = {
      pet_sitter:    'petsitter',
      dog_walker:    'walkers',
      pet_transport: 'pettrek',
      academy:       'academy',
      grooming:      'grooming',
      vet:           'vet',
      daycare:       'petsitter',
      other:         'general',
    };

    // Atomic deduction via WalletEngine (PostgreSQL only — no Firestore split)
    const result = await applyDeduction({
      userId,
      amountCents:  amountGross,
      isKioskWash:  false,
      serviceType,
      bookingId,
      description: `Online redemption — ${serviceType}`,
      divisionCode: DIVISION_MAP[serviceType] ?? 'general',
      sourceType:   'booking',
    });

    if (!result.breakdown.ok && result.breakdown.cardFallback > 0) {
      return res.status(402).json({
        ok:        false,
        error:     'Insufficient balance',
        shortfall: result.breakdown.shortfall,
      });
    }

    logger.info('[PrestigePass] Online redemption completed', {
      userId, bookingId, serviceType, amountGross,
      promo: result.breakdown.promo, gift: result.breakdown.gift, wallet: result.breakdown.wallet,
    });

    return res.json({
      ok:               true,
      bookingConfirmed: true,
      txnId:            result.txnId,
      amountGross,
      deductionBreakdown: {
        promo:        result.breakdown.promo,
        gift:         result.breakdown.gift,
        wallet:       result.breakdown.wallet,
        cardFallback: result.breakdown.cardFallback,
        totalCovered: result.breakdown.totalCovered,
      },
    });
  } catch (err) {
    logger.error('[PrestigePass] /redeem-online error:', err);
    return walletErrorResponse(res, err);
  }
});

// ─────────────────────────────────────────────────────────
// POST /resend-wallet-email — resend to logged-in user
// ─────────────────────────────────────────────────────────
const WALLET_EMAIL_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes between successive sends per user

router.post('/resend-wallet-email', walletEmailLimiter, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    const email   = session?.user?.email;
    if (!userId || !email) return res.status(401).json({ ok: false, error: 'Auth required' });

    const passRef = firestoreDb.collection('prestige_passes').doc(userId);
    const passDoc = await passRef.get();
    if (!passDoc.exists) return res.status(404).json({ ok: false, error: 'No Prestige Pass found' });

    const pass = passDoc.data()!;

    // Enforce 15-minute cooldown between wallet email resends per user
    if (pass.emailSentAt) {
      const lastSentMs = new Date(pass.emailSentAt).getTime();
      const msSinceLast = Date.now() - lastSentMs;
      if (msSinceLast < WALLET_EMAIL_COOLDOWN_MS) {
        const waitSecs = Math.ceil((WALLET_EMAIL_COOLDOWN_MS - msSinceLast) / 1000);
        const waitMins = Math.ceil(waitSecs / 60);
        return res.status(429).json({
          ok: false,
          error: `Wait ${waitMins} more minute${waitMins !== 1 ? 's' : ''} before resending your wallet email.`,
          retryAfterSecs: waitSecs,
        });
      }
    }

    const tierKey    = pass.tier || 'new';
    const tierDisplay = TIER_DISPLAY[tierKey]?.en || 'Prestige Pearl';
    const appBaseUrl  = process.env.APP_BASE_URL || 'https://petwash.co.il';

    const [resendWallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);
    const cashWalletCents = resendWallet?.cashWalletBalanceCents || 0;
    const egiftCents      = resendWallet?.egiftBalanceCents || 0;
    const washes          = resendWallet?.washPackageCredits || 0;
    const cardNum         = pass.cardNumber || userId.slice(-8).toUpperCase();
    const displayName     = session?.user?.displayName || '';

    // Pre-generate Google Wallet save URL when secrets are configured
    const googleWalletSaveUrl = await buildGoogleWalletSaveUrl({
      userId,
      serialNumber: pass.serialNumber || `PWL-${userId.slice(0, 8).toUpperCase()}`,
      tier:         tierKey,
      balanceILS:   (cashWalletCents + egiftCents) / 100,
      washes,
      displayName,
    });

    const html = buildPrestigeWalletEmail({
      firstName:           displayName.split(' ')[0] || 'לקוח יקר',
      tierDisplay,
      cardNumber:          cardNum,
      appBaseUrl,
      cashWalletCents:     cashWalletCents + egiftCents,
      freeWashesRemaining: washes,
      googleWalletSaveUrl,
    });

    const sent = await EmailService.send({
      to:      email,
      subject: `הפאס הפרסטיז שלך — ${tierDisplay} 🐾`,
      html,
    });

    if (sent) {
      await passRef.update({ emailSentAt: new Date().toISOString() });
    }

    return res.json({ ok: true, emailSent: sent, googleWalletReady: !!googleWalletSaveUrl });
  } catch (err) {
    logger.error('[PrestigePass] /resend-wallet-email error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /send-luxury-demo — generate + send the luxury pass email (admin use)
// ─────────────────────────────────────────────────────────
const luxuryDemoSchema = z.object({
  email:           z.string().email().default('nir.h@petwash.co.il'),
  firstName:       z.string().default('ניר'),
  lastName:        z.string().default('הכהן'),
  tier:            z.enum(['pearl','silver','gold','platinum','diamond','emerald','royal','black']).default('black'),
  loyaltyPoints:   z.number().default(12_400),
  cashWalletILS:   z.number().default(850),
  eGiftBalanceILS: z.number().default(300),
  freeWashesRemaining: z.number().default(3),
  memberSinceYear: z.number().default(2023),
  nextTierName:    z.string().optional(),
  nextTierPointsNeeded: z.number().optional(),
  language:        z.enum(['he','en']).default('he'),
});

router.post('/send-luxury-demo', async (req: Request, res: Response) => {
  try {
    const parsed = luxuryDemoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, errors: parsed.error.flatten() });
    const d = parsed.data;

    const BASE_URL = process.env.BASE_URL || 'https://petwash.co.il';

    // Generate QR code for K9000 demo (real kiosk format)
    const qrPayload = JSON.stringify({
      type:   'PRESTIGE_PASS',
      userId: 'admin-demo',
      tier:   d.tier,
      ts:     Date.now(),
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 200, margin: 1, color: { dark: '#D4AF37', light: '#000000' } });

    // Generate secure wallet pass URLs
    const { appleWalletUrl, googleWalletUrl } = await buildPrestigePassWalletUrls('vdiboz7IrUQEm2RbdO7VZLkBu552', BASE_URL);

    // Build the luxury email HTML
    const html = buildPrestigePassLuxuryEmail({
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      tier: d.tier,
      cardNumber: 'PW7731',
      loyaltyPoints: d.loyaltyPoints,
      cashWalletILS: d.cashWalletILS,
      eGiftBalanceILS: d.eGiftBalanceILS,
      freeWashesRemaining: d.freeWashesRemaining,
      memberSinceYear: d.memberSinceYear,
      nextTierName: d.nextTierName,
      nextTierPointsNeeded: d.nextTierPointsNeeded,
      qrDataUrl,
      appleWalletUrl,
      googleWalletUrl,
      appBaseUrl: BASE_URL,
      language: d.language,
    });

    const subjectMap: Record<string, string> = {
      black: '⬛ כרטיס הפרסטיז השחור שלך מוכן — PetWash™',
      diamond: '💎 כרטיס הפרסטיז יהלום שלך מוכן — PetWash™',
      royal: '👑 כרטיס הפרסטיז רויאל שלך מוכן — PetWash™',
      emerald: '💚 כרטיס הפרסטיז אמרלד שלך מוכן — PetWash™',
      platinum: '💠 כרטיס הפרסטיז פלטינום שלך מוכן — PetWash™',
      gold: '🥇 כרטיס הפרסטיז זהב שלך מוכן — PetWash™',
      silver: '🥈 כרטיס הפרסטיז כסף שלך מוכן — PetWash™',
      pearl: '🪨 כרטיס הפרסטיז פנינה שלך מוכן — PetWash™',
    };
    const subject = subjectMap[d.tier] ?? '🐾 הכרטיס הפרסטיז שלך — PetWash™';

    let sent = await EmailService.send({ to: d.email, subject, html });
    let channel = 'sendgrid';
    if (!sent) {
      logger.info('[PrestigePass] SendGrid failed, trying Gmail fallback', { to: d.email });
      sent = await sendViaGmail({ to: d.email, subject, html });
      channel = sent ? 'gmail' : 'none';
    }
    logger.info('[PrestigePass] Luxury demo email sent', { to: d.email, tier: d.tier, sent, channel });

    return res.json({
      ok: true,
      sent,
      channel,
      to: d.email,
      tier: d.tier,
      walletPassConfigured: !!(appleWalletUrl && googleWalletUrl),
    });
  } catch (err) {
    logger.error('[PrestigePass] /send-luxury-demo error:', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────
// POST /generate-wallet-links — Apple + Google pass URLs
// Returns signed URLs the client embeds in "Add to Wallet" buttons
// ─────────────────────────────────────────────────────────
router.post('/generate-wallet-links', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || 'https://petwash.co.il';
    const { appleWalletUrl, googleWalletUrl } = await buildPrestigePassWalletUrls(userId, BASE_URL);

    return res.json({
      ok:             true,
      appleWalletUrl,
      googleWalletUrl,
      applePassUrl:   `${BASE_URL}/api/prestige-pass/apple-wallet`,
      googlePassUrl:  `${BASE_URL}/api/prestige-pass/google-wallet`,
    });
  } catch (err) {
    logger.error('[PrestigePass] /generate-wallet-links error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /issue-gift — issue an eGift card to another user
// Debits sender (or creates gift from admin/promo), credits recipient's egift balance
// Body: { recipientEmail, amountCents, message? }
// ─────────────────────────────────────────────────────────
const issueGiftSchema = z.object({
  recipientEmail: z.string().email(),
  amountCents:    z.number().int().min(100).max(1_000_000), // 1 ILS min
  message:        z.string().max(500).optional(),
  senderId:       z.string().optional(), // admin path: override sender
});

router.post('/issue-gift', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const senderId = session?.user?.uid;
    if (!senderId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const parsed = issueGiftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.flatten() });
    const { recipientEmail, amountCents, message } = parsed.data;

    // Generate unique gift code
    const giftCode    = `PW-GIFT-${randomBytes(6).toString('hex').toUpperCase()}`;
    const giftId      = `GIFT-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt   = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    // Store gift in Firestore (pending claim)
    await firestoreDb.collection('egift_cards').doc(giftId).set({
      giftId,
      giftCode,
      senderId,
      senderEmail:      session?.user?.email || null,
      recipientEmail,
      amountCents,
      message:          message || null,
      status:           'pending',
      issuedAt:         new Date().toISOString(),
      expiresAt:        expiresAt.toISOString(),
      claimedAt:        null,
      claimedByUserId:  null,
    });

    // Send gift email to recipient
    try {
      await EmailService.send({
        to:      recipientEmail,
        subject: `🎁 קיבלת כרטיס מתנה מ-PetWash™ — ₪${(amountCents / 100).toFixed(0)}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #e5e7eb">
            <h2 style="color:#D4AF37;font-size:24px;margin-bottom:8px">🎁 כרטיס מתנה מ-PetWash™</h2>
            <p style="color:#374151;font-size:16px">קיבלת כרטיס מתנה בשווי <strong>₪${(amountCents / 100).toFixed(0)}</strong>!</p>
            ${message ? `<p style="color:#6b7280;font-style:italic">"${message}"</p>` : ''}
            <div style="background:#f9fafb;border-radius:12px;padding:16px;text-align:center;margin:24px 0">
              <p style="color:#6b7280;font-size:14px;margin:0 0 8px">קוד המתנה שלך</p>
              <code style="font-size:28px;font-weight:bold;color:#1f2937;letter-spacing:4px">${giftCode}</code>
            </div>
            <p style="color:#6b7280;font-size:13px">לחץ על הקישור כדי לממש: <a href="https://petwash.co.il/wallet?claim=${giftCode}">לחץ כאן</a></p>
            <p style="color:#9ca3af;font-size:12px">תוקף: ${expiresAt.toLocaleDateString('he-IL')}</p>
          </div>
        `,
      });
    } catch (emailErr) {
      logger.warn('[PrestigePass] Gift email failed (non-fatal)', { giftId, recipientEmail, emailErr });
    }

    logger.info('[PrestigePass] Gift issued', { giftId, giftCode, senderId, recipientEmail, amountCents });

    return res.json({
      ok:       true,
      giftId,
      giftCode,
      amountCents,
      recipientEmail,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    logger.error('[PrestigePass] /issue-gift error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /claim-gift — redeem a gift code, credit egift balance
// Body: { giftCode }
// ─────────────────────────────────────────────────────────
const claimGiftSchema = z.object({
  giftCode: z.string().min(8).max(64),
});

router.post('/claim-gift', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    const email   = session?.user?.email;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const parsed = claimGiftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid gift code' });
    const { giftCode } = parsed.data;

    // Look up gift card by code
    const snapshot = await firestoreDb.collection('egift_cards')
      .where('giftCode', '==', giftCode.toUpperCase().trim())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ ok: false, error: 'Gift code not found' });
    }

    const giftDoc = snapshot.docs[0];
    const gift    = giftDoc.data();

    if (gift.status === 'claimed') {
      return res.status(409).json({ ok: false, error: 'Gift code already claimed' });
    }
    if (gift.status === 'expired' || new Date(gift.expiresAt) < new Date()) {
      await giftDoc.ref.update({ status: 'expired' });
      return res.status(410).json({ ok: false, error: 'Gift code has expired' });
    }
    if (gift.senderId === userId) {
      return res.status(403).json({ ok: false, error: 'You cannot claim your own gift' });
    }
    if (gift.recipientEmail && gift.recipientEmail !== email) {
      return res.status(403).json({ ok: false, error: 'This gift was sent to a different email address' });
    }

    // Credit egift balance
    const wallet = await getOrCreateWallet(userId);
    const { txnId } = await adminManualCredit({
      userId,
      creditType:   'egift',
      amountCents:  gift.amountCents,
      reason:       `Gift claim — code ${giftCode}`,
      adminUserId:  'system',
    });

    // Mark gift as claimed
    await giftDoc.ref.update({
      status:          'claimed',
      claimedAt:       new Date().toISOString(),
      claimedByUserId: userId,
      claimTxnId:      txnId,
    });

    logger.info('[PrestigePass] Gift claimed', { giftId: gift.giftId, userId, amountCents: gift.amountCents, txnId });

    return res.json({
      ok:          true,
      claimed:     true,
      txnId,
      amountCents: gift.amountCents,
      newEgiftBalance: wallet.egiftBalanceCents + gift.amountCents,
      message:     `₪${(gift.amountCents / 100).toFixed(0)} זוכו לארנק ה-eGift שלך!`,
    });
  } catch (err) {
    logger.error('[PrestigePass] /claim-gift error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /session/stream — SSE: real-time K9000 wash events
// Client subscribes; K9000 /token/redeem pushes events here
// ─────────────────────────────────────────────────────────
router.get('/session/stream', (req: Request, res: Response) => {
  const session = (req as any).session;
  const userId  = session?.user?.uid;
  if (!userId) { res.status(401).end(); return; }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Register this response so /token/redeem can push to it
  sseClients.set(userId, res);
  res.write(`: connected\n\n`);

  // Keepalive ping every 20s (prevents proxy timeout)
  const ping = setInterval(() => { res.write(`: ping\n\n`); }, 20_000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(userId);
  });
});

// ─────────────────────────────────────────────────────────
// POST /pet — save / update primary pet profile
// Body: { petName, petType, petBreed, petNotes }
// Auth: session required
// ─────────────────────────────────────────────────────────
const petSchema = z.object({
  petName:  z.string().min(1).max(60),
  petType:  z.enum(['dog', 'cat', 'rabbit', 'bird', 'other']).default('dog'),
  petBreed: z.string().max(80).optional().default(''),
  petNotes: z.string().max(300).optional().default(''),
});

router.post('/pet', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    if (!userId) return res.status(401).json({ ok: false, error: 'Auth required' });

    const parsed = petSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.flatten() });

    const { petName, petType, petBreed, petNotes } = parsed.data;

    await firestoreDb.collection('prestige_passes').doc(userId).set(
      { petName, petType, petBreed, petNotes, petUpdatedAt: new Date().toISOString() },
      { merge: true },
    );

    return res.json({ ok: true, pet: { petName, petType, petBreed, petNotes } });
  } catch (err) {
    logger.error('[PrestigePass] /pet error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /staff/lookup — Staff POS: scan card QR → get profile
// Body: { cardId }  e.g. "PW-45872043" or "petwash://card/PW-45872043"
// Auth: session required (staff user)
// ─────────────────────────────────────────────────────────
router.post('/staff/lookup', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.uid) return res.status(401).json({ ok: false, error: 'Auth required' });

    let { cardId } = req.body as { cardId?: string };
    if (!cardId) return res.status(400).json({ ok: false, error: 'cardId required' });

    // Strip deep-link prefix if present
    cardId = cardId.replace(/^petwash:\/\/card\//i, '').trim().toUpperCase();

    // Find pass doc in Firestore by stored cardId field
    const snap = await firestoreDb.collection('prestige_passes')
      .where('cardId', '==', cardId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ ok: false, error: 'Card not found. Ask customer to open their wallet and refresh.' });
    }

    const passData = snap.docs[0].data();
    const userId   = passData.userId || snap.docs[0].id;

    // Load wallet balances
    const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);

    const totalLiquid = (wallet?.cashWalletBalanceCents ?? 0) +
                        (wallet?.egiftBalanceCents ?? 0) +
                        (wallet?.promoBalanceCents ?? 0);

    // Get display name from Firebase Auth
    let displayName: string | null = null;
    try {
      const authUser = await firebaseAuth.getUser(userId);
      displayName = authUser.displayName || null;
    } catch { /* ignore */ }

    return res.json({
      ok: true,
      customer: {
        userId,
        displayName: displayName || passData.firstName || '—',
        tier:        wallet?.loyaltyTier || passData.tier || 'new',
        serialNumber: passData.serialNumber,
        cardId,
        memberSince: passData.issuedAt || null,
      },
      pet: {
        petName:  passData.petName  || null,
        petType:  passData.petType  || 'dog',
        petBreed: passData.petBreed || null,
        petNotes: passData.petNotes || null,
      },
      balances: {
        cashWalletCents:   wallet?.cashWalletBalanceCents ?? 0,
        egiftCents:        wallet?.egiftBalanceCents       ?? 0,
        promoCents:        wallet?.promoBalanceCents       ?? 0,
        packageWashes:     wallet?.washPackageCredits      ?? 0,
        loyaltyPoints:     wallet?.loyaltyPointsBalance    ?? 0,
        totalLiquidCents:  totalLiquid,
      },
    });
  } catch (err) {
    logger.error('[PrestigePass] /staff/lookup error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /staff/charge — Staff POS: deduct service from pass
// Body: { cardId, serviceType, amountCents, staffNote? }
// Auth: session required (staff user)
// ─────────────────────────────────────────────────────────
const staffChargeSchema = z.object({
  cardId:      z.string().min(1),
  serviceType: z.enum(['grooming', 'full_wash', 'quick_wash', 'vet', 'academy', 'retail', 'transport', 'other']),
  amountCents: z.number().int().min(100).max(100_000),
  staffNote:   z.string().max(200).optional(),
});

router.post('/staff/charge', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.uid) return res.status(401).json({ ok: false, error: 'Auth required' });
    const staffUserId = session.user.uid;

    const parsed = staffChargeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.flatten() });

    let { cardId, serviceType, amountCents, staffNote } = parsed.data;
    cardId = cardId.replace(/^petwash:\/\/card\//i, '').trim().toUpperCase();

    // Find customer by cardId
    const snap = await firestoreDb.collection('prestige_passes')
      .where('cardId', '==', cardId)
      .limit(1).get();
    if (snap.empty) return res.status(404).json({ ok: false, error: 'Card not found' });

    const targetUserId = snap.docs[0].data().userId || snap.docs[0].id;

    // Check balance
    const walletBal = await getWalletBalances(targetUserId);
    if (!walletBal) return res.status(404).json({ ok: false, error: 'Wallet not found' });

    const totalAvail = walletBal.cashWalletBalanceCents + walletBal.egiftBalanceCents + walletBal.promoBalanceCents;
    if (totalAvail < amountCents) {
      return res.status(402).json({
        ok: false,
        error: 'Insufficient balance',
        available: totalAvail,
        required:  amountCents,
        shortfall: amountCents - totalAvail,
      });
    }

    const bookingId = `STAFF-POS-${staffUserId.slice(0, 6)}-${Date.now()}`;
    const clientIp  = req.ip ?? req.socket?.remoteAddress ?? null;
    const clientUa  = (req.headers['user-agent'] as string) ?? null;

    const result = await applyDeduction({
      userId:          targetUserId,
      amountCents,
      isKioskWash:     false,
      serviceType:     serviceType as any,
      bookingId,
      description:     `Staff POS charge — ${serviceType}${staffNote ? `: ${staffNote}` : ''}`,
      // Anti-fraud context
      idempotencyKey:  `STAFF-${staffUserId}-${bookingId}`,
      ipAddress:       clientIp,
      userAgent:       clientUa,
      staffId:         staffUserId,
      endpoint:        'prestige-pass/staff/charge',
    });

    logger.info('[PrestigePass] Staff POS charge', {
      cardId, targetUserId, serviceType, amountCents, staffUserId,
      deducted: result.deductedCents, source: result.source,
    });

    return res.json({
      ok:              true,
      deductedCents:   result.deductedCents,
      newBalanceCents: result.newCashWalletCents,
      source:          result.source,
      bookingId,
    });
  } catch (err) {
    logger.error('[PrestigePass] /staff/charge error:', err);
    return walletErrorResponse(res, err);
  }
});

// ─────────────────────────────────────────────────────────
// POST /revoke-pass — admin: deactivate a Prestige Pass
// Body: { targetUserId, reason }
// Requires admin session (enforced via adminSecret header in dev; Firebase custom claim in prod)
// ─────────────────────────────────────────────────────────
const revokePassSchema = z.object({
  targetUserId: z.string().min(1),
  reason:       z.string().min(1).max(500),
});

router.post('/revoke-pass', async (req: Request, res: Response) => {
  try {
    const adminSecret = req.headers['x-admin-secret'];
    const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.PRESTIGE_ADMIN_SECRET;
    if (!ADMIN_SECRET || adminSecret !== ADMIN_SECRET) {
      return res.status(403).json({ ok: false, error: 'Admin authorization required' });
    }

    const parsed = revokePassSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input' });
    const { targetUserId, reason } = parsed.data;

    // Deactivate in Firestore (pass metadata)
    const passRef = firestoreDb.collection('prestige_passes').doc(targetUserId);
    await passRef.update({
      status:    'revoked',
      revokedAt: new Date().toISOString(),
      revokedReason: reason,
    });

    // Deactivate wallet account in PostgreSQL
    await db
      .update(walletAccounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(walletAccounts.userId, targetUserId));

    logger.warn('[PrestigePass] Pass revoked', { targetUserId, reason });

    return res.json({
      ok:           true,
      revoked:      true,
      targetUserId,
      reason,
      revokedAt:    new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[PrestigePass] /revoke-pass error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /admin/manual-credit — admin: add credits to any balance bucket
// Body: { targetUserId, creditType, amountCents?, units?, reason }
// ─────────────────────────────────────────────────────────
const adminCreditSchema = z.object({
  targetUserId: z.string().min(1),
  creditType:   z.enum(['promo', 'egift', 'cash', 'wash_package']),
  amountCents:  z.number().int().min(1).optional(),
  units:        z.number().int().min(1).optional(),
  reason:       z.string().min(1).max(500),
});

router.post('/admin/manual-credit', async (req: Request, res: Response) => {
  try {
    const adminSecret = req.headers['x-admin-secret'];
    const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.PRESTIGE_ADMIN_SECRET;
    if (!ADMIN_SECRET || adminSecret !== ADMIN_SECRET) {
      return res.status(403).json({ ok: false, error: 'Admin authorization required' });
    }

    const session = (req as any).session;
    const adminUserId = session?.user?.uid || 'admin';

    const parsed = adminCreditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.flatten() });
    const { targetUserId, creditType, amountCents, units, reason } = parsed.data;

    if (creditType !== 'wash_package' && !amountCents) {
      return res.status(400).json({ ok: false, error: 'amountCents required for monetary credit types' });
    }
    if (creditType === 'wash_package' && !units) {
      return res.status(400).json({ ok: false, error: 'units required for wash_package credit type' });
    }

    const { txnId } = await adminManualCredit({ userId: targetUserId, creditType, amountCents, units, reason, adminUserId });

    logger.info('[PrestigePass] Admin manual credit applied', { targetUserId, creditType, amountCents, units, txnId, reason });

    const updatedBalances = await getWalletBalances(targetUserId);

    return res.json({
      ok:      true,
      txnId,
      targetUserId,
      creditType,
      amountCents,
      units,
      balancesAfter: updatedBalances,
    });
  } catch (err) {
    logger.error('[PrestigePass] /admin/manual-credit error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /admin/reissue — admin: reissue pass (new serial, reset Firestore metadata)
// Body: { targetUserId, tier? }
// ─────────────────────────────────────────────────────────
const adminReissueSchema = z.object({
  targetUserId: z.string().min(1),
  tier:         z.string().optional(),
  reason:       z.string().max(500).optional(),
});

router.post('/admin/reissue', async (req: Request, res: Response) => {
  try {
    const adminSecret = req.headers['x-admin-secret'];
    const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.PRESTIGE_ADMIN_SECRET;
    if (!ADMIN_SECRET || adminSecret !== ADMIN_SECRET) {
      return res.status(403).json({ ok: false, error: 'Admin authorization required' });
    }

    const parsed = adminReissueSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid input' });
    const { targetUserId, tier, reason } = parsed.data;

    const newSerial = `PWL-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const passRef   = firestoreDb.collection('prestige_passes').doc(targetUserId);
    const existing  = await passRef.get();
    const existingData = existing.exists ? existing.data()! : {};

    await passRef.set({
      ...existingData,
      userId:        targetUserId,
      serialNumber:  newSerial,
      tier:          tier || existingData.tier || 'new',
      status:        'active',
      reissuedAt:    new Date().toISOString(),
      reissueReason: reason || 'admin_reissue',
      revokedAt:     null,
      revokedReason: null,
    }, { merge: true });

    // Re-activate wallet if it was deactivated
    await db
      .update(walletAccounts)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(walletAccounts.userId, targetUserId));

    logger.info('[PrestigePass] Pass reissued by admin', { targetUserId, newSerial, tier, reason });

    return res.json({
      ok:          true,
      reissued:    true,
      targetUserId,
      newSerial,
      tier:        tier || existingData.tier || 'new',
    });
  } catch (err) {
    logger.error('[PrestigePass] /admin/reissue error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /admin/send-founder-pass
// Looks up Nir Hadad's actual pass data and sends wallet email
// to his dedicated PetWash email (nir.h@petwash.co.il)
// Requires X-Admin-Secret header
// ─────────────────────────────────────────────────────────
router.post('/admin/send-founder-pass', async (req: Request, res: Response) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET || process.env.PRESTIGE_ADMIN_SECRET;
    const provided    = req.headers['x-admin-secret'];
    if (!adminSecret || provided !== adminSecret) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const FOUNDER_EMAIL   = 'nirhadad1@gmail.com';
    const DEDICATED_EMAIL = 'nir.h@petwash.co.il';
    const BASE_URL        = process.env.APP_BASE_URL || process.env.BASE_URL || 'https://petwash.co.il';

    // 1. Look up UID by Firebase Auth email
    let uid: string;
    try {
      const userRecord = await firebaseAuth.getUserByEmail(FOUNDER_EMAIL);
      uid = userRecord.uid;
    } catch (e) {
      logger.warn('[PrestigePass] /admin/send-founder-pass — user not found in Firebase Auth', { FOUNDER_EMAIL });
      return res.status(404).json({ ok: false, error: `Firebase user not found for ${FOUNDER_EMAIL}` });
    }

    // 2. Get pass from Firestore
    const passDoc = await firestoreDb.collection('prestige_passes').doc(uid).get();
    const pass    = passDoc.exists ? passDoc.data()! : null;
    const tier    = (pass?.tier as string) || 'black';
    const cardNumber = (pass?.cardNumber as string) || uid.slice(-8).toUpperCase();
    const memberSinceYear = pass?.createdAt
      ? new Date(pass.createdAt).getFullYear()
      : 2024;

    // 3. Get wallet balances from PostgreSQL
    const [wallet] = await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, uid))
      .limit(1);

    const cashWalletILS       = (wallet?.cashWalletBalanceCents ?? 0) / 100;
    const freeWashesRemaining = wallet?.washPackageCredits ?? wallet?.packageServiceUnitsRemaining ?? 0;
    const loyaltyPoints       = wallet?.loyaltyPointsBalance ?? 0;

    // 4. Generate QR code
    const qrPayload  = JSON.stringify({ type: 'PRESTIGE_PASS', userId: uid, tier, ts: Date.now() });
    const qrDataUrl  = await QRCode.toDataURL(qrPayload, { width: 200, margin: 1, color: { dark: '#D4AF37', light: '#000000' } });

    // 5. Build signed wallet URLs
    const { appleWalletUrl, googleWalletUrl } = await buildPrestigePassWalletUrls(uid, BASE_URL);

    // 6. Build and send the luxury email
    const html = buildPrestigePassLuxuryEmail({
      firstName:            'ניר',
      lastName:             'הדד',
      email:                DEDICATED_EMAIL,
      tier,
      cardNumber,
      loyaltyPoints,
      cashWalletILS,
      eGiftBalanceILS:      0,
      freeWashesRemaining,
      memberSinceYear,
      qrDataUrl,
      appleWalletUrl,
      googleWalletUrl,
      appBaseUrl:           BASE_URL,
      language:             'he',
    });

    const tierSubjects: Record<string, string> = {
      black:    '⬛ כרטיס הפרסטיז השחור שלך מוכן — PetWash™',
      diamond:  '💎 כרטיס הפרסטיז יהלום שלך מוכן — PetWash™',
      royal:    '👑 כרטיס הפרסטיז רויאל שלך מוכן — PetWash™',
      emerald:  '💚 כרטיס הפרסטיז אמרלד שלך מוכן — PetWash™',
      platinum: '💠 כרטיס הפרסטיז פלטינום שלך מוכן — PetWash™',
      gold:     '🥇 כרטיס הפרסטיז זהב שלך מוכן — PetWash™',
      silver:   '🥈 כרטיס הפרסטיז כסף שלך מוכן — PetWash™',
      pearl:    '🪨 כרטיס הפרסטיז פנינה שלך מוכן — PetWash™',
    };
    const subject = tierSubjects[tier] ?? '🐾 הכרטיס הפרסטיז שלך — PetWash™';

    let sent = await EmailService.send({ to: DEDICATED_EMAIL, subject, html });
    let channel = 'sendgrid';
    if (!sent) {
      logger.info('[PrestigePass] SendGrid failed, trying Gmail fallback', { to: DEDICATED_EMAIL });
      sent = await sendViaGmail({ to: DEDICATED_EMAIL, subject, html });
      channel = sent ? 'gmail' : 'none';
    }
    logger.info('[PrestigePass] Founder pass email sent', { to: DEDICATED_EMAIL, uid, tier, sent, channel });

    return res.json({
      ok:   true,
      sent,
      to:   DEDICATED_EMAIL,
      uid,
      tier,
      loyaltyPoints,
      cashWalletILS,
      freeWashesRemaining,
      walletLinksIncluded: !!(appleWalletUrl && googleWalletUrl),
    });
  } catch (err) {
    logger.error('[PrestigePass] /admin/send-founder-pass error:', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/send-demo-receipts
// Sends two demo חשבונית מס קבלה emails to Nir:
//   1. E-Gift Card purchase receipt
//   2. Provider (Petsitter) service transaction receipt
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/send-demo-receipts', async (req: Request, res: Response) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET || process.env.COOKIE_SECRET;
    const provided    = req.headers['x-admin-secret'];
    if (!adminSecret || provided !== adminSecret) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const { buildEGiftReceipt, buildProviderTxReceipt } = await import('../email/templates/transaction-receipt-2026');

    const now = new Date();
    const TO  = 'nirhadad1@gmail.com';

    // ── 1. E-Gift Card receipt ────────────────────────────────────────────────
    const egiftHtml = buildEGiftReceipt({
      invoiceNo:      'PW-INV-2026-003847',
      txId:           'TXN-20260317-884729',
      date:           now,
      buyerName:      'ניר הדד',
      buyerEmail:     TO,
      recipientName:  'רונית הדד',
      giftAmountIls:  500,
      voucherId:      'PGIFT-500-HAD-2026',
      paymentLast4:   '4521',
      paymentBrand:   'Visa',
      personalMessage: 'ליקירתי רונית — מתנה קטנה מהלב לבלות עם מאקס 🐶',
      language:       'he',
    });

    const egiftResult = await EmailService.send({
      to:      TO,
      subject: '🎁 PetWash™ — חשבונית מס קבלה #PW-INV-2026-003847 — כרטיס מתנה ₪500',
      html:    egiftHtml,
    });

    logger.info('[DemoReceipts] eGift receipt sent', { to: TO, ok: egiftResult });

    // ── 2. Provider (Petsitter) transaction receipt ───────────────────────────
    const providerHtml = buildProviderTxReceipt({
      invoiceNo:       'PW-INV-2026-003848',
      txId:            'TXN-20260317-993041',
      date:            now,
      serviceDate:     now,
      serviceType:     'petsitter',
      serviceDescHe:   'שמירה על כלב — מאקס, רועה גרמני',
      serviceDescEn:   'Dog Sitting — Max, German Shepherd',
      providerName:    'מיכל כהן',
      providerBizNo:   '039291847',
      petName:         'מאקס',
      petBreed:        'רועה גרמני',
      customerName:    'ניר הדד',
      customerEmail:   TO,
      grossChargedIls: 320,
      platformFeeRate: 0.15,
      paymentLast4:    '4521',
      paymentBrand:    'Visa',
      durationLabel:   '4 שעות',
      language:        'he',
    });

    const providerResult = await EmailService.send({
      to:      TO,
      subject: '🏠 PetWash™ — חשבונית מס קבלה #PW-INV-2026-003848 — שמירה על כלב ₪320',
      html:    providerHtml,
    });

    logger.info('[DemoReceipts] Provider receipt sent', { to: TO, ok: providerResult });

    return res.json({
      ok: true,
      sent: { egift: egiftResult, provider: providerResult },
      to:   TO,
      invoices: ['PW-INV-2026-003847', 'PW-INV-2026-003848'],
    });
  } catch (err) {
    logger.error('[DemoReceipts] error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── Admin: Division-level wallet report ──────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/division-report
// Returns SUM(amount_cents) grouped by division_code and event_type.
// Requires admin role (checked via Firestore custom claims).
router.get('/admin/wallet/division-report', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    // Admin gate via Firestore custom claims
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    const isAdmin = !!(adminUser?.customClaims as any)?.admin;
    if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const rows: any = await db.execute(sql`
      SELECT
        COALESCE(division_code, 'general')  AS division_code,
        event_type,
        direction,
        COUNT(*)                            AS entry_count,
        SUM(amount_cents)                   AS total_cents,
        MIN(created_at)                     AS first_at,
        MAX(created_at)                     AS last_at
      FROM wallet_ledger_entries
      GROUP BY division_code, event_type, direction
      ORDER BY total_cents DESC
    `);

    const data = (rows?.rows ?? rows ?? []).map((r: any) => ({
      divisionCode:  r.division_code,
      eventType:     r.event_type,
      direction:     r.direction,
      entryCount:    Number(r.entry_count),
      totalCents:    Number(r.total_cents),
      totalIls:      Number(r.total_cents) / 100,
      firstAt:       r.first_at,
      lastAt:        r.last_at,
    }));

    return res.json({ ok: true, generatedAt: new Date().toISOString(), data });
  } catch (err: any) {
    logger.error('[Admin] division-report error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate division report' });
  }
});

// ─── Admin: Per-booking wallet audit trail ────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/booking-audit?bookingId=XXX
// Returns the full hold → debit/release → refund timeline for one booking.
router.get('/admin/wallet/booking-audit', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    const isAdmin = !!(adminUser?.customClaims as any)?.admin;
    if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const bookingId = String(req.query.bookingId || '').trim();
    if (!bookingId) return res.status(400).json({ error: 'bookingId query param required' });

    // Pull booking finance state — try booking_requests first, then trainer_bookings
    let booking: any = null;
    let sourceTable: 'booking_requests' | 'trainer_bookings' = 'booking_requests';

    const bookingRows: any = await db.execute(sql`
      SELECT request_id AS booking_id, owner_id AS user_id,
             service_type AS division_code, finance_state,
             wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents,
             wallet_hold_key, wallet_debit_key, wallet_release_key, wallet_refund_key,
             created_at, updated_at
      FROM booking_requests WHERE request_id = ${bookingId} LIMIT 1
    `);
    booking = (bookingRows?.rows ?? bookingRows ?? [])[0] ?? null;

    if (!booking) {
      const academyRows: any = await db.execute(sql`
        SELECT booking_id, user_id,
               'academy' AS division_code, finance_state,
               wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents,
               wallet_hold_key, wallet_debit_key, wallet_release_key, wallet_refund_key,
               created_at, updated_at
        FROM trainer_bookings WHERE booking_id = ${bookingId} LIMIT 1
      `);
      booking = (academyRows?.rows ?? academyRows ?? [])[0] ?? null;
      if (booking) sourceTable = 'trainer_bookings';
    }

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Pull all ledger entries for this booking
    const ledgerRows: any = await db.execute(sql`
      SELECT entry_id, event_type, direction, bucket,
             amount_cents, currency, division_code,
             idempotency_key, created_at, metadata
      FROM wallet_ledger_entries
      WHERE booking_id = ${bookingId}
      ORDER BY id ASC
    `);
    const ledger = (ledgerRows?.rows ?? ledgerRows ?? []).map((r: any) => ({
      entryId:        r.entry_id,
      eventType:      r.event_type,
      direction:      r.direction,
      bucket:         r.bucket,
      amountCents:    Number(r.amount_cents),
      amountIls:      Number(r.amount_cents) / 100,
      divisionCode:   r.division_code,
      idempotencyKey: r.idempotency_key,
      createdAt:      r.created_at,
      metadata:       r.metadata,
    }));

    return res.json({
      ok: true,
      bookingId,
      sourceTable,
      booking: {
        bookingId:           booking.booking_id,
        userId:              booking.user_id,
        divisionCode:        booking.division_code,
        financeState:        booking.finance_state,
        walletHoldCents:     Number(booking.wallet_hold_cents),
        walletDebitedCents:  Number(booking.wallet_debited_cents),
        walletRefundedCents: Number(booking.wallet_refunded_cents),
        walletHoldKey:       booking.wallet_hold_key,
        walletDebitKey:      booking.wallet_debit_key,
        walletReleaseKey:    booking.wallet_release_key,
        walletRefundKey:     booking.wallet_refund_key,
        createdAt:           booking.created_at,
        updatedAt:           booking.updated_at,
      },
      ledger,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[Admin] booking-audit error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate booking audit' });
  }
});

// ─── Admin: User Wallet Audit ─────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/user-audit?userId=XXX
// Returns the full wallet balance + all ledger entries for one user.
router.get('/admin/wallet/user-audit', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const userId = String(req.query.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId query param required' });

    // Wallet balances
    const walletRow: any = await db.execute(sql`
      SELECT wallet_id, cash_wallet_balance_cents, egift_balance_cents,
             promo_balance_cents, referral_balance_cents, pending_balance_cents,
             lifetime_earned_cents, lifetime_redeemed_cents, loyalty_tier,
             is_active, created_at, updated_at
      FROM wallet_accounts WHERE user_id = ${userId} LIMIT 1
    `).then((r: any) => (r?.rows ?? r ?? [])[0] ?? null);
    if (!walletRow) return res.status(404).json({ error: 'Wallet not found for this user' });

    // Wallet ledger entries (newest first, capped at 200)
    const ledgerRows: any = await db.execute(sql`
      SELECT entry_id, event_type, direction, bucket, amount_cents, currency,
             division_code, source_type, idempotency_key, booking_id, created_at
      FROM wallet_ledger_entries
      WHERE user_id = ${userId}
      ORDER BY id DESC
      LIMIT 200
    `);
    const ledger = (ledgerRows?.rows ?? ledgerRows ?? []).map((r: any) => ({
      entryId:        r.entry_id,
      eventType:      r.event_type,
      direction:      r.direction,
      bucket:         r.bucket,
      amountCents:    Number(r.amount_cents),
      currency:       r.currency,
      divisionCode:   r.division_code,
      sourceType:     r.source_type,
      idempotencyKey: r.idempotency_key,
      bookingId:      r.booking_id,
      createdAt:      r.created_at,
    }));

    // Booking finance summary (across both tables)
    const bkSummary: any = await db.execute(sql`
      SELECT finance_state, COUNT(*) AS cnt,
             SUM(wallet_hold_cents) AS total_hold,
             SUM(wallet_debited_cents) AS total_debited,
             SUM(wallet_refunded_cents) AS total_refunded
      FROM booking_requests
      WHERE owner_id = ${userId} AND finance_state != 'none'
      GROUP BY finance_state
      UNION ALL
      SELECT finance_state, COUNT(*) AS cnt,
             SUM(wallet_hold_cents) AS total_hold,
             SUM(wallet_debited_cents) AS total_debited,
             SUM(wallet_refunded_cents) AS total_refunded
      FROM trainer_bookings
      WHERE user_id = ${userId} AND finance_state != 'none'
      GROUP BY finance_state
    `);
    const bookingSummary = (bkSummary?.rows ?? bkSummary ?? []).map((r: any) => ({
      financeState:   r.finance_state,
      count:          Number(r.cnt),
      totalHold:      Number(r.total_hold   ?? 0),
      totalDebited:   Number(r.total_debited  ?? 0),
      totalRefunded:  Number(r.total_refunded ?? 0),
    }));

    return res.json({
      ok: true,
      userId,
      wallet: {
        walletId:              walletRow.wallet_id,
        cashCents:             Number(walletRow.cash_wallet_balance_cents),
        egiftCents:            Number(walletRow.egift_balance_cents),
        promoCents:            Number(walletRow.promo_balance_cents),
        referralCents:         Number(walletRow.referral_balance_cents),
        pendingCents:          Number(walletRow.pending_balance_cents),
        lifetimeEarnedCents:   Number(walletRow.lifetime_earned_cents),
        lifetimeRedeemedCents: Number(walletRow.lifetime_redeemed_cents),
        loyaltyTier:           walletRow.loyalty_tier,
        isActive:              walletRow.is_active,
        createdAt:             walletRow.created_at,
        updatedAt:             walletRow.updated_at,
      },
      bookingSummary,
      ledger,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[Admin] user-audit error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate user wallet audit' });
  }
});

// ─── Admin: Wallet Lifecycle Proof Pass ───────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/proof-pass
//
// Runs a full system audit of the wallet hold/release/debit/refund lifecycle:
//   Step 1 — Reconciliation: detect + heal accepted bookings with hold_active
//   Step 2 — Finance-state distribution across all bookings with wallet activity
//   Step 3 — Balance integrity: check for negative balances in any bucket
//   Step 4 — Pending consistency: compare pending_balance_cents vs ledger sum
//   Step 5 — Idempotency coverage: check that every debit/release/refund has a key
//   Step 6 — Summary verdict: PASS | WARN | FAIL
//
// Requires admin role. Safe to run in production — read-heavy, no synthetic mutations.
router.post('/admin/wallet/proof-pass', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    const isAdmin = !!(adminUser?.customClaims as any)?.admin;
    if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const steps: Record<string, any> = {};
    const issues: string[] = [];

    // ── Step 1: Reconciliation ────────────────────────────────────────────────
    const { runWalletReconciliation } = await import('../jobs/wallet-reconciliation');
    const reconReport = await runWalletReconciliation();
    steps.reconciliation = reconReport;
    if (reconReport.failed > 0) {
      issues.push(`${reconReport.failed} booking(s) could not be healed — manual intervention required`);
    }
    if (reconReport.healed > 0) {
      issues.push(`${reconReport.healed} booking(s) were drifted and have now been healed`);
    }

    // ── Step 2: Finance-state distribution (booking_requests + trainer_bookings) ─
    const distRows: any = await db.execute(sql`
      SELECT finance_state, 'booking' AS source, COUNT(*) AS cnt, SUM(wallet_hold_cents) AS total_hold_cents
      FROM booking_requests
      WHERE wallet_hold_cents > 0 OR wallet_debited_cents > 0 OR wallet_refunded_cents > 0
      GROUP BY finance_state
      UNION ALL
      SELECT finance_state, 'academy' AS source, COUNT(*) AS cnt, SUM(wallet_hold_cents) AS total_hold_cents
      FROM trainer_bookings
      WHERE wallet_hold_cents > 0 OR wallet_debited_cents > 0 OR wallet_refunded_cents > 0
      GROUP BY finance_state
      ORDER BY cnt DESC
    `);
    steps.financeStateDistribution = (distRows?.rows ?? distRows ?? []).map((r: any) => ({
      financeState:    r.finance_state,
      source:          r.source,
      count:           Number(r.cnt),
      totalHoldCents:  Number(r.total_hold_cents),
    }));

    // ── Step 3: Balance integrity — no bucket should go negative ─────────────
    const negRows: any = await db.execute(sql`
      SELECT user_id, wallet_id,
             cash_wallet_balance_cents,
             egift_balance_cents,
             promo_balance_cents,
             referral_balance_cents,
             pending_balance_cents
      FROM wallet_accounts
      WHERE cash_wallet_balance_cents < 0
         OR egift_balance_cents       < 0
         OR promo_balance_cents       < 0
         OR referral_balance_cents    < 0
         OR pending_balance_cents     < 0
    `);
    const negativeBalances = (negRows?.rows ?? negRows ?? []).map((r: any) => ({
      userId:              r.user_id,
      walletId:            r.wallet_id,
      cashWalletCents:     Number(r.cash_wallet_balance_cents),
      egiftCents:          Number(r.egift_balance_cents),
      promoCents:          Number(r.promo_balance_cents),
      referralCents:       Number(r.referral_balance_cents),
      pendingCents:        Number(r.pending_balance_cents),
    }));
    steps.negativeBalances = negativeBalances;
    if (negativeBalances.length > 0) {
      issues.push(`CRITICAL: ${negativeBalances.length} wallet(s) have negative bucket balance`);
    }

    // ── Step 4: Pending consistency ───────────────────────────────────────────
    // pending_balance_cents should equal SUM(hold) - SUM(debit) - SUM(release)
    // per user across the ledger.
    const pendingRows: any = await db.execute(sql`
      WITH ledger_pending AS (
        SELECT
          user_id,
          SUM(CASE WHEN event_type = 'hold'    AND direction = 'credit' THEN amount_cents ELSE 0 END) AS held,
          SUM(CASE WHEN event_type = 'debit'   AND direction = 'debit'  THEN amount_cents ELSE 0 END) AS debited,
          SUM(CASE WHEN event_type = 'release' AND direction = 'debit'  THEN amount_cents ELSE 0 END) AS released
        FROM wallet_ledger_entries
        WHERE event_type IN ('hold','debit','release')
        GROUP BY user_id
      )
      SELECT
        w.user_id,
        w.pending_balance_cents              AS wallet_pending,
        COALESCE(lp.held,0)
          - COALESCE(lp.debited,0)
          - COALESCE(lp.released,0)          AS ledger_pending,
        ABS(
          w.pending_balance_cents -
          (COALESCE(lp.held,0)
           - COALESCE(lp.debited,0)
           - COALESCE(lp.released,0))
        )                                    AS drift_cents
      FROM wallet_accounts w
      LEFT JOIN ledger_pending lp ON lp.user_id = w.user_id
      WHERE ABS(
        w.pending_balance_cents -
        (COALESCE(lp.held,0)
         - COALESCE(lp.debited,0)
         - COALESCE(lp.released,0))
      ) > 0
    `);
    const pendingDrift = (pendingRows?.rows ?? pendingRows ?? []).map((r: any) => ({
      userId:         r.user_id,
      walletPending:  Number(r.wallet_pending),
      ledgerPending:  Number(r.ledger_pending),
      driftCents:     Number(r.drift_cents),
    }));
    steps.pendingConsistency = {
      driftingAccounts: pendingDrift.length,
      accounts:         pendingDrift,
    };
    if (pendingDrift.length > 0) {
      issues.push(`${pendingDrift.length} wallet(s) have pending_balance drift vs ledger`);
    }

    // ── Step 5: Idempotency coverage (booking_requests + trainer_bookings) ───
    const covRows: any = await db.execute(sql`
      SELECT
        SUM(debited_missing)  AS debited_missing_key,
        SUM(released_missing) AS released_missing_key,
        SUM(refunded_missing) AS refunded_missing_key,
        SUM(hold_missing)     AS hold_missing_key
      FROM (
        SELECT
          COUNT(*) FILTER (WHERE finance_state = 'debited'    AND (wallet_debit_key   IS NULL OR wallet_debit_key   = '')) AS debited_missing,
          COUNT(*) FILTER (WHERE finance_state = 'released'   AND (wallet_release_key IS NULL OR wallet_release_key = '')) AS released_missing,
          COUNT(*) FILTER (WHERE finance_state = 'refunded'   AND (wallet_refund_key  IS NULL OR wallet_refund_key  = '')) AS refunded_missing,
          COUNT(*) FILTER (WHERE finance_state = 'hold_active' AND (wallet_hold_key   IS NULL OR wallet_hold_key    = '')) AS hold_missing
        FROM booking_requests WHERE wallet_hold_cents > 0 OR wallet_debited_cents > 0 OR wallet_refunded_cents > 0
        UNION ALL
        SELECT
          COUNT(*) FILTER (WHERE finance_state = 'debited'    AND (wallet_debit_key   IS NULL OR wallet_debit_key   = '')) AS debited_missing,
          COUNT(*) FILTER (WHERE finance_state = 'released'   AND (wallet_release_key IS NULL OR wallet_release_key = '')) AS released_missing,
          COUNT(*) FILTER (WHERE finance_state = 'refunded'   AND (wallet_refund_key  IS NULL OR wallet_refund_key  = '')) AS refunded_missing,
          COUNT(*) FILTER (WHERE finance_state = 'hold_active' AND (wallet_hold_key   IS NULL OR wallet_hold_key    = '')) AS hold_missing
        FROM trainer_bookings WHERE wallet_hold_cents > 0 OR wallet_debited_cents > 0 OR wallet_refunded_cents > 0
      ) AS combined
    `);
    const cov: any = (covRows?.rows ?? covRows ?? [])[0] ?? {};
    const idempCoverage = {
      debitedMissingKey:   Number(cov.debited_missing_key  ?? 0),
      releasedMissingKey:  Number(cov.released_missing_key ?? 0),
      refundedMissingKey:  Number(cov.refunded_missing_key ?? 0),
      holdMissingKey:      Number(cov.hold_missing_key     ?? 0),
    };
    steps.idempotencyCoverage = idempCoverage;
    const missingKeys = Object.values(idempCoverage).reduce((a, b) => a + b, 0);
    if (missingKeys > 0) {
      issues.push(`${missingKeys} booking operation(s) are missing idempotency keys`);
    }

    // ── Step 6: Verdict ───────────────────────────────────────────────────────
    const hasCritical = negativeBalances.length > 0 || reconReport.failed > 0;
    const hasWarnings = issues.length > 0;
    const verdict: 'PASS' | 'WARN' | 'FAIL' =
      hasCritical ? 'FAIL' : hasWarnings ? 'WARN' : 'PASS';

    const durationMs = Date.now() - t0;
    logger.info('[ProofPass] Wallet lifecycle proof pass complete', {
      verdict, issueCount: issues.length, durationMs,
    });

    const fullResult = {
      ok: true,
      verdict,
      issues,
      durationMs,
      generatedAt: new Date().toISOString(),
      steps,
    };

    // Persist to wallet_reconciliation_runs (fire-and-forget)
    const runId = `pp-${nanoid(12)}`;
    db.insert(walletReconciliationRuns).values({
      runId,
      runType:     'proof_pass',
      status:      'completed',
      verdict,
      startedAt:   new Date(t0),
      completedAt: new Date(),
      durationMs,
      drifted:     reconReport.drifted,
      healed:      reconReport.healed,
      failedCount: reconReport.failed,
      triggeredBy: uid,
      summaryJson: fullResult as any,
    }).catch((e: any) =>
      logger.error('[ProofPass] Failed to persist run', { error: e.message }),
    );

    return res.json(fullResult);
  } catch (err: any) {
    logger.error('[ProofPass] error', { error: err.message });
    return res.status(500).json({ error: 'Proof pass failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/wallet-preview
// Server-driven checkout preview for any division.
// Returns the exact wallet amounts the server will apply — no frontend math.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/wallet-preview', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const subtotalCents = parseInt(req.query.subtotalCents as string, 10);
    const divisionCode  = (req.query.divisionCode as string) || 'general';

    if (!subtotalCents || isNaN(subtotalCents) || subtotalCents <= 0) {
      return res.status(400).json({ error: 'subtotalCents must be a positive integer' });
    }

    const VALID_DIVISIONS = ['station_k9000', 'petsitter', 'walkers', 'academy', 'pettrek', 'general'];
    if (!VALID_DIVISIONS.includes(divisionCode)) {
      return res.status(400).json({ error: `Invalid divisionCode: ${divisionCode}` });
    }

    const { walletService } = await import('../services/WalletService');
    const preview = await walletService.previewRedemption({
      userId: uid,
      subtotalCents,
      divisionCode: divisionCode as any,
    });

    return res.json({
      subtotalCents,
      divisionCode,
      walletAvailableCents:     preview.walletAvailableCents,
      walletAppliedCents:       preview.applicableCents,
      cashDueCents:             preview.cashDueCents,
      pendingWalletImpactCents: preview.applicableCents,
      capRule:                  preview.capPercent === 100 ? '100_percent' : '50_percent',
      cappedByPolicy:           preview.cappedByPolicy,
      cappedByBalance:          preview.cappedByBalance,
      pendingBalanceCents:      preview.pendingBalanceCents,
      breakdown:                preview.breakdown,
    });
  } catch (err: any) {
    logger.error('[WalletPreview] error', { error: err.message });
    return res.status(500).json({ error: 'Preview failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/reconciliation-history
// Returns paginated history of all reconciliation and proof-pass runs.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/reconciliation-history', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const runType = req.query.runType as string | undefined;

    const rows: any = await db.execute(sql`
      SELECT id, run_id, run_type, status, verdict,
             started_at, completed_at, duration_ms,
             drifted, healed, failed_count, triggered_by, created_at
      FROM wallet_reconciliation_runs
      WHERE (${runType ? sql`run_type = ${runType}` : sql`1=1`})
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countRow: any = await db.execute(sql`
      SELECT COUNT(*) AS total FROM wallet_reconciliation_runs
      WHERE (${runType ? sql`run_type = ${runType}` : sql`1=1`})
    `);

    const runs = (rows?.rows ?? rows ?? []).map((r: any) => ({
      id:          r.id,
      runId:       r.run_id,
      runType:     r.run_type,
      status:      r.status,
      verdict:     r.verdict,
      startedAt:   r.started_at,
      completedAt: r.completed_at,
      durationMs:  r.duration_ms,
      drifted:     Number(r.drifted),
      healed:      Number(r.healed),
      failedCount: Number(r.failed_count),
      triggeredBy: r.triggered_by,
      createdAt:   r.created_at,
    }));

    const total = Number((countRow?.rows ?? countRow ?? [])[0]?.total ?? 0);
    return res.json({ runs, total, limit, offset });
  } catch (err: any) {
    logger.error('[ReconciliationHistory] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch reconciliation history' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/adjustments
// Admin adjustment audit — ledger entries of type admin_credit / admin_debit / reversal.
// Filters: staffId, userId, from, to, divisionCode
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/adjustments', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { staffId, userId, from, to, divisionCode } = req.query as Record<string, string>;
    const limit  = Math.min(Number(req.query.limit  ?? 100), 500);
    const offset = Number(req.query.offset ?? 0);

    const rows: any = await db.execute(sql`
      SELECT
        e.id,
        e.entry_id,
        e.user_id,
        e.wallet_id,
        e.event_type,
        e.direction,
        e.amount_cents,
        e.currency,
        e.bucket,
        e.division_code,
        e.source_type,
        e.idempotency_key,
        e.booking_id,
        e.created_by,
        e.ip_address,
        e.metadata,
        e.created_at
      FROM wallet_ledger_entries e
      WHERE e.event_type IN ('admin_credit', 'admin_debit', 'reversal')
        AND (${staffId   ? sql`e.created_by    = ${staffId}`     : sql`1=1`})
        AND (${userId    ? sql`e.user_id        = ${userId}`     : sql`1=1`})
        AND (${from      ? sql`e.created_at    >= ${new Date(from)}` : sql`1=1`})
        AND (${to        ? sql`e.created_at    <= ${new Date(to)}`   : sql`1=1`})
        AND (${divisionCode ? sql`e.division_code = ${divisionCode}` : sql`1=1`})
      ORDER BY e.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countRow: any = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM wallet_ledger_entries e
      WHERE e.event_type IN ('admin_credit', 'admin_debit', 'reversal')
        AND (${staffId   ? sql`e.created_by    = ${staffId}`     : sql`1=1`})
        AND (${userId    ? sql`e.user_id        = ${userId}`     : sql`1=1`})
        AND (${from      ? sql`e.created_at    >= ${new Date(from)}` : sql`1=1`})
        AND (${to        ? sql`e.created_at    <= ${new Date(to)}`   : sql`1=1`})
        AND (${divisionCode ? sql`e.division_code = ${divisionCode}` : sql`1=1`})
    `);

    const entries = (rows?.rows ?? rows ?? []).map((r: any) => ({
      id:             r.id,
      entryId:        r.entry_id,
      userId:         r.user_id,
      walletId:       r.wallet_id,
      eventType:      r.event_type,
      direction:      r.direction,
      amountCents:    Number(r.amount_cents),
      currency:       r.currency,
      bucket:         r.bucket,
      divisionCode:   r.division_code,
      sourceType:     r.source_type,
      idempotencyKey: r.idempotency_key,
      bookingId:      r.booking_id,
      createdBy:      r.created_by,
      ipAddress:      r.ip_address,
      metadata:       r.metadata,
      createdAt:      r.created_at,
    }));

    const total = Number((countRow?.rows ?? countRow ?? [])[0]?.total ?? 0);
    return res.json({ entries, total, limit, offset });
  } catch (err: any) {
    logger.error('[Adjustments] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch adjustments' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/export.csv
// Streams wallet_ledger_entries as CSV. Filters: from, to, divisionCode,
// eventType, sourceType, userId. No body mutation — read-only.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/export.csv', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { from, to, divisionCode, eventType, sourceType, userId } = req.query as Record<string, string>;

    const rows: any = await db.execute(sql`
      SELECT
        created_at,
        user_id,
        wallet_id,
        division_code,
        source_type,
        event_type,
        direction,
        amount_cents,
        currency,
        bucket,
        idempotency_key,
        booking_id,
        created_by,
        metadata
      FROM wallet_ledger_entries
      WHERE (${from         ? sql`created_at    >= ${new Date(from)}` : sql`1=1`})
        AND (${to           ? sql`created_at    <= ${new Date(to)}`   : sql`1=1`})
        AND (${divisionCode ? sql`division_code  = ${divisionCode}`   : sql`1=1`})
        AND (${eventType    ? sql`event_type     = ${eventType}`      : sql`1=1`})
        AND (${sourceType   ? sql`source_type    = ${sourceType}`     : sql`1=1`})
        AND (${userId       ? sql`user_id        = ${userId}`         : sql`1=1`})
      ORDER BY created_at DESC
      LIMIT 50000
    `);

    const data = rows?.rows ?? rows ?? [];

    const CSV_HEADERS = [
      'created_at', 'user_id', 'wallet_id', 'division_code', 'source_type',
      'event_type', 'direction', 'amount_cents', 'currency', 'bucket',
      'idempotency_key', 'booking_id', 'created_by', 'metadata_json',
    ].join(',');

    function csvEscape(v: any): string {
      if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    const lines = [
      CSV_HEADERS,
      ...data.map((r: any) => [
        csvEscape(r.created_at),
        csvEscape(r.user_id),
        csvEscape(r.wallet_id),
        csvEscape(r.division_code),
        csvEscape(r.source_type),
        csvEscape(r.event_type),
        csvEscape(r.direction),
        csvEscape(r.amount_cents),
        csvEscape(r.currency),
        csvEscape(r.bucket),
        csvEscape(r.idempotency_key),
        csvEscape(r.booking_id),
        csvEscape(r.created_by),
        csvEscape(r.metadata),
      ].join(',')),
    ];

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wallet-ledger-${dateStr}.csv"`);
    res.send('\uFEFF' + lines.join('\r\n')); // BOM for Excel
  } catch (err: any) {
    logger.error('[WalletExport] error', { error: err.message });
    return res.status(500).json({ error: 'Export failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/bookings-export.csv
// Booking-level wallet lifecycle export — finance_state + hold/debit/refund
// amounts for every booking across walkers, sitters, and academy.
// Filters: financeState, source (booking | academy), from, to, userId
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/bookings-export.csv', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { financeState, source, from, to, userId } = req.query as Record<string, string>;

    // UNION booking_requests (walkers + sitters) with trainer_bookings (academy)
    const rows: any = await db.execute(sql`
      SELECT
        request_id          AS booking_id,
        'booking'           AS source_type,
        service_type        AS division_code,
        owner_id            AS customer_id,
        provider_id,
        status,
        finance_state,
        wallet_hold_cents,
        wallet_debited_cents,
        wallet_refunded_cents,
        wallet_hold_key,
        wallet_debit_key,
        wallet_release_key,
        wallet_refund_key,
        total_cents,
        currency,
        created_at
      FROM booking_requests
      WHERE (${financeState ? sql`finance_state = ${financeState}` : sql`1=1`})
        AND (${source ? sql`'booking' = ${source}` : sql`1=1`})
        AND (${from   ? sql`created_at >= ${new Date(from)}` : sql`1=1`})
        AND (${to     ? sql`created_at <= ${new Date(to)}`   : sql`1=1`})
        AND (${userId ? sql`owner_id   =  ${userId}`         : sql`1=1`})

      UNION ALL

      SELECT
        booking_id          AS booking_id,
        'academy'           AS source_type,
        'academy'           AS division_code,
        user_id             AS customer_id,
        trainer_user_id     AS provider_id,
        booking_status      AS status,
        finance_state,
        wallet_hold_cents,
        wallet_debited_cents,
        wallet_refunded_cents,
        wallet_hold_key,
        wallet_debit_key,
        wallet_release_key,
        wallet_refund_key,
        ROUND((total_amount * 100)::numeric) AS total_cents,
        COALESCE(currency, 'ILS') AS currency,
        created_at
      FROM trainer_bookings
      WHERE (${financeState ? sql`finance_state = ${financeState}` : sql`1=1`})
        AND (${source ? sql`'academy' = ${source}` : sql`1=1`})
        AND (${from   ? sql`created_at >= ${new Date(from)}` : sql`1=1`})
        AND (${to     ? sql`created_at <= ${new Date(to)}`   : sql`1=1`})
        AND (${userId ? sql`user_id    =  ${userId}`         : sql`1=1`})

      ORDER BY created_at DESC
      LIMIT 50000
    `);

    const data = rows?.rows ?? rows ?? [];

    const CSV_HEADERS = [
      'booking_id', 'source_type', 'division_code', 'customer_id', 'provider_id',
      'status', 'finance_state',
      'wallet_hold_cents', 'wallet_debited_cents', 'wallet_refunded_cents',
      'wallet_hold_key', 'wallet_debit_key', 'wallet_release_key', 'wallet_refund_key',
      'total_cents', 'currency', 'created_at',
    ].join(',');

    function csvEscape(v: any): string {
      if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    const lines = [
      CSV_HEADERS,
      ...data.map((r: any) => [
        csvEscape(r.booking_id),
        csvEscape(r.source_type),
        csvEscape(r.division_code),
        csvEscape(r.customer_id),
        csvEscape(r.provider_id),
        csvEscape(r.status),
        csvEscape(r.finance_state),
        csvEscape(r.wallet_hold_cents),
        csvEscape(r.wallet_debited_cents),
        csvEscape(r.wallet_refunded_cents),
        csvEscape(r.wallet_hold_key),
        csvEscape(r.wallet_debit_key),
        csvEscape(r.wallet_release_key),
        csvEscape(r.wallet_refund_key),
        csvEscape(r.total_cents),
        csvEscape(r.currency),
        csvEscape(r.created_at),
      ].join(',')),
    ];

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wallet-bookings-finance-${dateStr}.csv"`);
    res.send('\uFEFF' + lines.join('\r\n')); // BOM for Excel
  } catch (err: any) {
    logger.error('[BookingsFinanceExport] error', { error: err.message });
    return res.status(500).json({ error: 'Export failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/release
// Admin: release a stuck hold for a booking (finance_state must be hold_active).
// Supports both booking_requests and trainer_bookings.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/release', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { bookingId, reason } = req.body as { bookingId: string; reason: string };
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    if (!reason?.trim()) return res.status(400).json({ error: 'reason required' });

    // Look up booking — try booking_requests then trainer_bookings
    let booking: any = null;
    let sourceTable: 'booking_requests' | 'trainer_bookings' = 'booking_requests';

    const brRows: any = await db.execute(sql`
      SELECT request_id AS booking_id, owner_id AS user_id, service_type AS division_code,
             finance_state, wallet_hold_cents
      FROM booking_requests WHERE request_id = ${bookingId} LIMIT 1
    `);
    booking = (brRows?.rows ?? brRows ?? [])[0] ?? null;
    if (!booking) {
      const tbRows: any = await db.execute(sql`
        SELECT booking_id, user_id, 'academy' AS division_code,
               finance_state, wallet_hold_cents
        FROM trainer_bookings WHERE booking_id = ${bookingId} LIMIT 1
      `);
      booking = (tbRows?.rows ?? tbRows ?? [])[0] ?? null;
      if (booking) sourceTable = 'trainer_bookings';
    }

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.finance_state !== 'hold_active') {
      return res.status(422).json({
        error: `Cannot release: finance_state is '${booking.finance_state}', expected 'hold_active'`,
      });
    }

    const holdCents = Number(booking.wallet_hold_cents);
    if (holdCents <= 0) return res.status(422).json({ error: 'No hold amount to release' });

    const { walletService } = await import('../services/WalletService');
    const result = await walletService.releaseBookingHold({
      userId:               booking.user_id,
      amountCents:          holdCents,
      bookingId,
      divisionCode:         booking.division_code ?? 'general',
      ipAddress:            req.ip,
      idempotencyKeySuffix: `admin:${uid}`,
      metadata:             { adminId: uid, reason, actorSource: 'admin_release' },
    });

    // Update booking record
    const releaseKey = result.txnId;
    if (sourceTable === 'booking_requests') {
      await db.execute(sql`
        UPDATE booking_requests
        SET finance_state = 'released', wallet_release_key = ${releaseKey}, updated_at = NOW()
        WHERE request_id = ${bookingId}
      `);
    } else {
      await db.execute(sql`
        UPDATE trainer_bookings
        SET finance_state = 'released', wallet_release_key = ${releaseKey}, updated_at = NOW()
        WHERE booking_id = ${bookingId}
      `);
    }

    logger.info('[AdminWallet][Release] Hold released', {
      bookingId, userId: booking.user_id, holdCents, txnId: result.txnId,
      idempotent: result.idempotent, adminUid: uid, reason,
    });

    return res.json({ ok: true, txnId: result.txnId, idempotent: result.idempotent, releasedCents: holdCents });
  } catch (err: any) {
    logger.error('[AdminWallet][Release] error', { error: err.message });
    return res.status(500).json({ error: 'Release failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/refund
// Admin: refund a debited booking (finance_state must be debited).
// Supports partial refunds. Supports both booking tables.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/refund', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { bookingId, amountCents, reason } = req.body as {
      bookingId: string; amountCents?: number; reason: string;
    };
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    if (!reason?.trim()) return res.status(400).json({ error: 'reason required' });

    // Look up booking
    let booking: any = null;
    let sourceTable: 'booking_requests' | 'trainer_bookings' = 'booking_requests';

    const brRows: any = await db.execute(sql`
      SELECT request_id AS booking_id, owner_id AS user_id, service_type AS division_code,
             finance_state, wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents
      FROM booking_requests WHERE request_id = ${bookingId} LIMIT 1
    `);
    booking = (brRows?.rows ?? brRows ?? [])[0] ?? null;
    if (!booking) {
      const tbRows: any = await db.execute(sql`
        SELECT booking_id, user_id, 'academy' AS division_code,
               finance_state, wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents
        FROM trainer_bookings WHERE booking_id = ${bookingId} LIMIT 1
      `);
      booking = (tbRows?.rows ?? tbRows ?? [])[0] ?? null;
      if (booking) sourceTable = 'trainer_bookings';
    }

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.finance_state !== 'debited') {
      return res.status(422).json({
        error: `Cannot refund: finance_state is '${booking.finance_state}', expected 'debited'`,
      });
    }

    const debitedCents = Number(booking.wallet_debited_cents);
    const alreadyRefunded = Number(booking.wallet_refunded_cents ?? 0);
    const maxRefundable = debitedCents - alreadyRefunded;
    const refundCents = amountCents != null ? Math.min(amountCents, maxRefundable) : maxRefundable;

    if (refundCents <= 0) return res.status(422).json({ error: 'Nothing left to refund' });

    // Timestamp-based key allows multiple partial refunds; each is a distinct ledger entry
    const idempotencyKey = `wallet:booking:refund:admin:${bookingId}:${Date.now()}`;
    const { refundToWallet } = await import('../services/WalletLedger');
    const result = await refundToWallet({
      userId:         booking.user_id,
      amountCents:    refundCents,
      divisionCode:   booking.division_code ?? 'general',
      sourceType:     'booking',
      sourceId:       bookingId,
      idempotencyKey,
      reason:         reason ?? 'admin_refund',
      ipAddress:      req.ip,
      metadata:       { adminId: uid, reason, actorSource: 'admin_refund' },
    });

    const newRefunded = alreadyRefunded + refundCents;
    const newState = newRefunded >= debitedCents ? 'refunded' : 'debited';

    if (sourceTable === 'booking_requests') {
      await db.execute(sql`
        UPDATE booking_requests
        SET finance_state = ${newState},
            wallet_refunded_cents = ${newRefunded},
            wallet_refund_key = ${result.txnId},
            updated_at = NOW()
        WHERE request_id = ${bookingId}
      `);
    } else {
      await db.execute(sql`
        UPDATE trainer_bookings
        SET finance_state = ${newState},
            wallet_refunded_cents = ${newRefunded},
            wallet_refund_key = ${result.txnId},
            updated_at = NOW()
        WHERE booking_id = ${bookingId}
      `);
    }

    logger.info('[AdminWallet][Refund] Refund issued', {
      bookingId, userId: booking.user_id, refundCents, newState,
      txnId: result.txnId, adminUid: uid, reason,
    });

    return res.json({ ok: true, txnId: result.txnId, refundedCents: refundCents, newFinanceState: newState });
  } catch (err: any) {
    logger.error('[AdminWallet][Refund] error', { error: err.message });
    return res.status(500).json({ error: 'Refund failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/adjust
// Admin: manually credit or debit a user's cash wallet (no booking required).
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/adjust', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { userId, amountCents, reason, type } = req.body as {
      userId: string; amountCents: number; reason: string; type: 'credit' | 'debit';
    };
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!amountCents || amountCents <= 0) return res.status(400).json({ error: 'amountCents must be > 0' });
    if (!reason?.trim()) return res.status(400).json({ error: 'reason required' });
    if (type !== 'credit' && type !== 'debit') return res.status(400).json({ error: "type must be 'credit' or 'debit'" });

    const { walletService } = await import('../services/WalletService');
    const wallet = await walletService.getOrCreateWallet(userId);
    const idempotencyKey = `wallet:admin:adjust:${type}:${userId}:${Date.now()}`;

    const { adminAdjustWallet } = await import('../services/WalletLedger');
    const result = await adminAdjustWallet({
      userId,
      walletId:       wallet.walletId,
      amountCents,
      type,
      reason,
      adminId:        uid,
      idempotencyKey,
      ipAddress:      req.ip,
    });

    logger.info('[AdminWallet][Adjust] Adjustment applied', {
      userId, amountCents, type, txnId: result.txnId, adminUid: uid, reason,
    });

    return res.json({ ok: true, txnId: result.txnId, adjustedCents: amountCents, type });
  } catch (err: any) {
    logger.error('[AdminWallet][Adjust] error', { error: err.message });
    return res.status(500).json({ error: 'Adjustment failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Support action helper — wallet snapshot after action
// ──────────────────────────────────────────────────────────────────────────────
async function fetchSupportWalletSnapshot(userId: string) {
  const rows: any = await db.execute(sql`
    SELECT cash_wallet_balance_cents, egift_balance_cents, promo_balance_cents,
           referral_balance_cents, pending_balance_cents, loyalty_points_balance
    FROM wallet_accounts WHERE user_id = ${userId} LIMIT 1
  `);
  const r = (rows?.rows ?? rows ?? [])[0];
  if (!r) return null;
  return {
    cashCents:     Number(r.cash_wallet_balance_cents ?? 0),
    egiftCents:    Number(r.egift_balance_cents ?? 0),
    promoCents:    Number(r.promo_balance_cents ?? 0),
    referralCents: Number(r.referral_balance_cents ?? 0),
    pendingCents:  Number(r.pending_balance_cents ?? 0),
    loyaltyPoints: Number(r.loyalty_points_balance ?? 0),
  };
}

// Support action booking lookup — returns booking row + source table
async function fetchSupportBooking(bookingId: string, bookingType: 'marketplace' | 'academy') {
  if (bookingType === 'marketplace') {
    const rows: any = await db.execute(sql`
      SELECT request_id AS booking_id, owner_id AS user_id,
             COALESCE(service_type, 'general') AS division_code,
             finance_state, wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents
      FROM booking_requests WHERE request_id = ${bookingId} LIMIT 1
    `);
    const row = (rows?.rows ?? rows ?? [])[0] ?? null;
    return row ? { booking: row, sourceTable: 'booking_requests' as const } : null;
  } else {
    const rows: any = await db.execute(sql`
      SELECT booking_id, user_id, 'academy' AS division_code,
             finance_state, wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents
      FROM trainer_bookings WHERE booking_id = ${bookingId} LIMIT 1
    `);
    const row = (rows?.rows ?? rows ?? [])[0] ?? null;
    return row ? { booking: row, sourceTable: 'trainer_bookings' as const } : null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/support/release-hold
// Support: force-release a stuck hold. Requires hold_active + hold > 0.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/support/release-hold', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { bookingId, bookingType, reason } = req.body as {
      bookingId: string; bookingType: 'marketplace' | 'academy'; reason: string;
    };
    if (!bookingId?.trim()) return res.status(400).json({ error: 'bookingId required' });
    if (bookingType !== 'marketplace' && bookingType !== 'academy') {
      return res.status(400).json({ error: 'bookingType must be "marketplace" or "academy"' });
    }
    if (!reason?.trim() || reason.trim().length < 5) {
      return res.status(400).json({ error: 'reason must be at least 5 characters' });
    }

    const found = await fetchSupportBooking(bookingId.trim(), bookingType);
    if (!found) return res.status(404).json({ error: 'Booking not found' });
    const { booking, sourceTable } = found;

    if (booking.finance_state !== 'hold_active') {
      return res.status(422).json({
        error: `Cannot release: finance_state is '${booking.finance_state}', expected 'hold_active'`,
      });
    }
    const holdCents = Number(booking.wallet_hold_cents);
    if (holdCents <= 0) return res.status(422).json({ error: 'No hold amount to release' });

    const { walletService } = await import('../services/WalletService');
    const result = await walletService.releaseBookingHold({
      userId:               booking.user_id,
      amountCents:          holdCents,
      bookingId:            booking.booking_id,
      divisionCode:         booking.division_code ?? 'general',
      ipAddress:            req.ip,
      idempotencyKeySuffix: `support:${bookingType}`,
      metadata:             {
        adminId: uid, reason,
        source: 'support_action', supportAction: 'release_hold', bookingType,
        actorSource: 'admin_release',
      },
    });

    if (sourceTable === 'booking_requests') {
      await db.execute(sql`
        UPDATE booking_requests
        SET finance_state = 'released', wallet_release_key = ${result.txnId}, updated_at = NOW()
        WHERE request_id = ${booking.booking_id}
      `);
    } else {
      await db.execute(sql`
        UPDATE trainer_bookings
        SET finance_state = 'released', wallet_release_key = ${result.txnId}, updated_at = NOW()
        WHERE booking_id = ${booking.booking_id}
      `);
    }

    logger.info('[Support][ReleaseHold] Hold released', {
      bookingId, bookingType, holdCents, txnId: result.txnId,
      idempotent: result.idempotent, adminUid: uid,
    });

    const walletSnapshot = await fetchSupportWalletSnapshot(booking.user_id);
    return res.json({ ok: true, releasedCents: holdCents, txnId: result.txnId, idempotent: result.idempotent, walletSnapshot });
  } catch (err: any) {
    logger.error('[Support][ReleaseHold] error', { error: err.message });
    return res.status(500).json({ error: 'Release failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/support/issue-refund
// Support: refund a debited booking, OR degrade to release if still hold_active.
// amountCents = 0 means full refundable amount.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/support/issue-refund', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { bookingId, bookingType, amountCents: rawAmount, reason } = req.body as {
      bookingId: string; bookingType: 'marketplace' | 'academy'; amountCents?: number; reason: string;
    };
    if (!bookingId?.trim()) return res.status(400).json({ error: 'bookingId required' });
    if (bookingType !== 'marketplace' && bookingType !== 'academy') {
      return res.status(400).json({ error: 'bookingType must be "marketplace" or "academy"' });
    }
    if (!reason?.trim() || reason.trim().length < 5) {
      return res.status(400).json({ error: 'reason must be at least 5 characters' });
    }
    if (rawAmount != null && rawAmount < 0) {
      return res.status(400).json({ error: 'amountCents must be >= 0' });
    }

    const found = await fetchSupportBooking(bookingId.trim(), bookingType);
    if (!found) return res.status(404).json({ error: 'Booking not found' });
    const { booking, sourceTable } = found;

    const supportMeta = {
      adminId: uid, reason,
      source: 'support_action', supportAction: 'issue_refund', bookingType,
    };

    // ── Smart degrade: hold_active → treat as release ───────────────────────
    if (booking.finance_state === 'hold_active') {
      const holdCents = Number(booking.wallet_hold_cents);
      if (holdCents <= 0) return res.status(422).json({ error: 'No hold amount to release' });

      const { walletService } = await import('../services/WalletService');
      const result = await walletService.releaseBookingHold({
        userId:               booking.user_id,
        amountCents:          holdCents,
        bookingId:            booking.booking_id,
        divisionCode:         booking.division_code ?? 'general',
        ipAddress:            req.ip,
        idempotencyKeySuffix: `support:${bookingType}:refund-as-release`,
        metadata:             { ...supportMeta, actorSource: 'admin_release', degradedToRelease: true },
      });

      if (sourceTable === 'booking_requests') {
        await db.execute(sql`
          UPDATE booking_requests
          SET finance_state = 'released', wallet_release_key = ${result.txnId}, updated_at = NOW()
          WHERE request_id = ${booking.booking_id}
        `);
      } else {
        await db.execute(sql`
          UPDATE trainer_bookings
          SET finance_state = 'released', wallet_release_key = ${result.txnId}, updated_at = NOW()
          WHERE booking_id = ${booking.booking_id}
        `);
      }

      logger.info('[Support][IssueRefund] Degraded to release (hold_active)', {
        bookingId, bookingType, holdCents, txnId: result.txnId, adminUid: uid,
      });

      const walletSnapshot = await fetchSupportWalletSnapshot(booking.user_id);
      return res.json({
        ok: true, actionTaken: 'release',
        amountCents: holdCents, txnId: result.txnId,
        idempotent: result.idempotent, walletSnapshot,
      });
    }

    // ── Standard refund path: finance_state must be debited ─────────────────
    if (booking.finance_state !== 'debited') {
      return res.status(422).json({
        error: `Cannot refund: finance_state is '${booking.finance_state}'. Expected 'debited' or 'hold_active'.`,
      });
    }

    const debitedCents  = Number(booking.wallet_debited_cents);
    const alreadyRefunded = Number(booking.wallet_refunded_cents ?? 0);
    const maxRefundable = debitedCents - alreadyRefunded;
    if (maxRefundable <= 0) return res.status(422).json({ error: 'Nothing left to refund' });

    const refundCents = (rawAmount && rawAmount > 0)
      ? Math.min(rawAmount, maxRefundable)
      : maxRefundable;

    const idempotencyKey = `wallet:support:refund:${bookingType}:${booking.booking_id}:${refundCents}`;
    const { refundToWallet } = await import('../services/WalletLedger');
    const result = await refundToWallet({
      userId:         booking.user_id,
      amountCents:    refundCents,
      divisionCode:   booking.division_code ?? 'general',
      sourceType:     'booking',
      sourceId:       booking.booking_id,
      idempotencyKey,
      reason:         reason ?? 'support_refund',
      ipAddress:      req.ip,
      metadata:       { ...supportMeta, actorSource: 'admin_refund' },
    });

    const newRefunded = alreadyRefunded + refundCents;
    const newState = newRefunded >= debitedCents ? 'refunded' : 'debited';

    if (sourceTable === 'booking_requests') {
      await db.execute(sql`
        UPDATE booking_requests
        SET finance_state = ${newState},
            wallet_refunded_cents = ${newRefunded},
            wallet_refund_key = ${result.txnId},
            updated_at = NOW()
        WHERE request_id = ${booking.booking_id}
      `);
    } else {
      await db.execute(sql`
        UPDATE trainer_bookings
        SET finance_state = ${newState},
            wallet_refunded_cents = ${newRefunded},
            wallet_refund_key = ${result.txnId},
            updated_at = NOW()
        WHERE booking_id = ${booking.booking_id}
      `);
    }

    logger.info('[Support][IssueRefund] Refund issued', {
      bookingId, bookingType, refundCents, newState, txnId: result.txnId, adminUid: uid,
    });

    const walletSnapshot = await fetchSupportWalletSnapshot(booking.user_id);
    return res.json({
      ok: true, actionTaken: 'refund',
      amountCents: refundCents, txnId: result.txnId, walletSnapshot,
    });
  } catch (err: any) {
    logger.error('[Support][IssueRefund] error', { error: err.message });
    return res.status(500).json({ error: 'Refund failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/support/credit
// Support: grant manual wallet credit. amountCents 1..50000.
// Idempotent per user + amount + day (ILS day window).
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/support/credit', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { userId, amountCents, reason } = req.body as {
      userId: string; amountCents: number; reason: string;
    };
    if (!userId?.trim()) return res.status(400).json({ error: 'userId required' });
    if (!amountCents || amountCents <= 0) return res.status(400).json({ error: 'amountCents must be > 0' });
    if (amountCents > 50000) return res.status(400).json({ error: 'amountCents must be <= 50000 (₪500)' });
    if (!reason?.trim() || reason.trim().length < 5) {
      return res.status(400).json({ error: 'reason must be at least 5 characters' });
    }

    const { walletService } = await import('../services/WalletService');
    const wallet = await walletService.getOrCreateWallet(userId.trim());

    const daystamp = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).replace(/-/g, '');
    const idempotencyKey = `wallet:support:credit:${userId}:${amountCents}:${daystamp}`;

    const { adminAdjustWallet } = await import('../services/WalletLedger');
    const result = await adminAdjustWallet({
      userId:         userId.trim(),
      walletId:       wallet.walletId,
      amountCents,
      type:           'credit',
      reason,
      adminId:        uid,
      idempotencyKey,
      ipAddress:      req.ip,
    });

    // Tag the ledger entry metadata retroactively via a no-op is not needed —
    // queryActionHistory picks it up via event_type = 'admin_credit'.
    // For audit bundle visibility, log the support_action context here:
    logger.info('[Support][Credit] Manual credit granted', {
      userId, amountCents, txnId: result.txnId, adminUid: uid,
      source: 'support_action', supportAction: 'manual_credit',
    });

    const walletSnapshot = await fetchSupportWalletSnapshot(userId.trim());
    return res.json({ ok: true, creditedCents: amountCents, txnId: result.txnId, walletSnapshot });
  } catch (err: any) {
    logger.error('[Support][Credit] error', { error: err.message });
    return res.status(500).json({ error: 'Credit failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/finance-today
// Returns today's revenue and pending holds by division (last 24h ledger debits).
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/finance-today', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const revenueRows: any = await db.execute(sql`
      SELECT COALESCE(division_code, 'general') AS division_code,
             SUM(amount_cents) AS revenue_cents,
             COUNT(*) AS txn_count
      FROM wallet_ledger_entries
      WHERE event_type = 'debit'
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY division_code
      ORDER BY revenue_cents DESC
    `);
    const revenue = (revenueRows?.rows ?? revenueRows ?? []).map((r: any) => ({
      divisionCode: r.division_code,
      revenueCents: Number(r.revenue_cents),
      txnCount:     Number(r.txn_count),
    }));

    const holdRows: any = await db.execute(sql`
      SELECT COALESCE(
        CASE
          WHEN s.service_type = 'walking' THEN 'walkers'
          WHEN s.service_type = 'sitting' THEN 'petsitter'
          WHEN s.service_type = 'training' THEN 'academy'
          ELSE 'general'
        END, 'general'
      ) AS division_code,
      COUNT(*) AS booking_count,
      SUM(s.wallet_hold_cents) AS hold_cents
      FROM (
        SELECT service_type, wallet_hold_cents
        FROM booking_requests
        WHERE finance_state = 'hold_active'
        UNION ALL
        SELECT 'training' AS service_type, wallet_hold_cents
        FROM trainer_bookings
        WHERE finance_state = 'hold_active'
      ) s
      GROUP BY division_code
    `);
    const holds = (holdRows?.rows ?? holdRows ?? []).map((r: any) => ({
      divisionCode:  r.division_code,
      bookingCount:  Number(r.booking_count),
      holdCents:     Number(r.hold_cents),
    }));

    const totalRevenueCents = revenue.reduce((s: number, r: any) => s + r.revenueCents, 0);
    const totalHoldCents    = holds.reduce((s: number, r: any)   => s + r.holdCents,    0);

    // ── Overrides Today (ledger-derived, admin-tagged rows only) ────────────────
    // Start of calendar day in Asia/Jerusalem (matches UI label "00:00 IL → now")
    const overrideRows: any = await db.execute(sql`
      SELECT COUNT(*) AS override_count,
             COALESCE(SUM(amount_cents), 0) AS override_cents
      FROM wallet_ledger_entries
      WHERE created_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem')
        AND metadata->>'adminId' IS NOT NULL
        AND metadata->>'adminId' != ''
    `);
    const overrideRow = (overrideRows?.rows ?? overrideRows ?? [])[0] ?? {};
    const overridesToday = {
      count:      Number(overrideRow.override_count ?? 0),
      totalCents: Number(overrideRow.override_cents ?? 0),
    };

    // ── Refunds Today (booking-derived: marketplace + academy) ─────────────────
    const refundRows: any = await db.execute(sql`
      SELECT COUNT(*) AS refund_count,
             COALESCE(SUM(wallet_refunded_cents), 0) AS refund_cents
      FROM (
        SELECT wallet_refunded_cents
        FROM booking_requests
        WHERE wallet_refunded_cents > 0
          AND updated_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem')
        UNION ALL
        SELECT wallet_refunded_cents
        FROM trainer_bookings
        WHERE wallet_refunded_cents > 0
          AND updated_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem')
      ) r
    `);
    const refundRow = (refundRows?.rows ?? refundRows ?? [])[0] ?? {};
    const refundsToday = {
      count:      Number(refundRow.refund_count ?? 0),
      totalCents: Number(refundRow.refund_cents ?? 0),
    };

    return res.json({
      ok: true,
      revenue,
      holds,
      totalRevenueCents,
      totalHoldCents,
      overridesToday,
      refundsToday,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[AdminWallet][FinanceToday] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch finance today', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/reconciliation-history/export.csv
// Exports reconciliation run history as CSV.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/reconciliation-history/export.csv', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const rows: any = await db.execute(sql`
      SELECT run_id, run_type, status, verdict,
             started_at, completed_at, duration_ms,
             drifted, healed, failed_count,
             triggered_by, created_at
      FROM wallet_reconciliation_runs
      ORDER BY started_at DESC
      LIMIT 10000
    `);
    const data = rows?.rows ?? rows ?? [];

    function csvEscape(v: any): string {
      if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }

    const CSV_HEADERS = [
      'run_id', 'run_type', 'status', 'verdict',
      'started_at', 'completed_at', 'duration_ms',
      'drifted', 'healed', 'failed_count', 'triggered_by',
    ].join(',');

    const lines = [
      CSV_HEADERS,
      ...data.map((r: any) => [
        csvEscape(r.run_id),
        csvEscape(r.run_type),
        csvEscape(r.status),
        csvEscape(r.verdict),
        csvEscape(r.started_at),
        csvEscape(r.completed_at),
        csvEscape(r.duration_ms),
        csvEscape(r.drifted),
        csvEscape(r.healed),
        csvEscape(r.failed_count),
        csvEscape(r.triggered_by),
      ].join(',')),
    ];

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-history-${dateStr}.csv"`);
    res.send('\uFEFF' + lines.join('\r\n'));
  } catch (err: any) {
    logger.error('[ReconciliationExport] error', { error: err.message });
    return res.status(500).json({ error: 'Export failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/academy/:id/force-confirm
// Admin override: force-confirm an academy booking.
// Debits from hold if finance_state = hold_active. Mandatory reason + audit trail.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/academy/:id/force-confirm', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const bookingId = req.params.id;
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) return res.status(400).json({ error: 'reason required' });

    const rows: any = await db.execute(sql`
      SELECT booking_id, user_id, trainer_user_id, finance_state, booking_status,
             wallet_hold_cents, wallet_debited_cents
      FROM trainer_bookings WHERE booking_id = ${bookingId} LIMIT 1
    `);
    const booking = (rows?.rows ?? rows ?? [])[0] ?? null;
    if (!booking) return res.status(404).json({ error: 'Academy booking not found' });

    if (booking.booking_status === 'confirmed' || booking.booking_status === 'completed') {
      return res.status(422).json({ error: `Booking already in status: ${booking.booking_status}` });
    }
    if (booking.booking_status === 'cancelled') {
      return res.status(422).json({ error: 'Cannot confirm a cancelled booking' });
    }

    const walletUpdates: Record<string, unknown> = {};
    let txnId: string | null = null;

    if (booking.finance_state === 'hold_active' && Number(booking.wallet_hold_cents) > 0) {
      const { walletService } = await import('../services/WalletService');
      const debitResult = await walletService.debitBookingFromHold({
        userId:               booking.user_id,
        amountCents:          Number(booking.wallet_hold_cents),
        bookingId,
        divisionCode:         'academy',
        ipAddress:            req.ip,
        idempotencyKeySuffix: `admin:${uid}`,
        metadata:             { adminId: uid, reason, actorSource: 'admin_override' },
      });
      walletUpdates.finance_state   = 'debited';
      walletUpdates.wallet_debit_key = debitResult.txnId;
      walletUpdates.wallet_debited_cents = Number(booking.wallet_hold_cents);
      txnId = debitResult.txnId;
      logger.info('[AdminWallet][ForceConfirm] Wallet debited', { bookingId, txnId, adminUid: uid });
    }

    await db.execute(sql`
      UPDATE trainer_bookings
      SET booking_status = 'confirmed',
          confirmed_at   = NOW(),
          payment_status = 'completed',
          finance_state  = ${walletUpdates.finance_state ?? booking.finance_state},
          wallet_debit_key     = ${walletUpdates.wallet_debit_key ?? booking.wallet_debit_key ?? null},
          wallet_debited_cents = ${walletUpdates.wallet_debited_cents ?? booking.wallet_debited_cents ?? 0},
          updated_at     = NOW()
      WHERE booking_id = ${bookingId}
    `);

    logger.info('[AdminWallet][ForceConfirm] Academy booking force-confirmed', {
      bookingId, adminUid: uid, reason,
      financeState: walletUpdates.finance_state ?? booking.finance_state,
    });

    // 2.7C/D — fire-and-forget SMS (same wording as trainer self-confirm)
    dispatchAcademySms({
      bookingId,
      amountCents:    Number(booking.wallet_hold_cents),
      event:          'confirmed',
      trainerUserId:  booking.trainer_user_id,
      customerUserId: booking.user_id,
    });

    return res.json({
      ok: true,
      bookingId,
      action: 'force-confirm',
      txnId,
      actorUid: uid,
      actorSource: 'admin_override',
      reason,
      confirmedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[AdminWallet][ForceConfirm] error', { error: err.message });
    return res.status(500).json({ error: 'Force confirm failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/academy/:id/force-cancel
// Admin override: force-cancel an academy booking.
// Releases hold if hold_active, refunds if debited. Mandatory reason + audit.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/academy/:id/force-cancel', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const bookingId = req.params.id;
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) return res.status(400).json({ error: 'reason required' });

    const rows: any = await db.execute(sql`
      SELECT booking_id, user_id, trainer_user_id, finance_state, booking_status,
             wallet_hold_cents, wallet_debited_cents
      FROM trainer_bookings WHERE booking_id = ${bookingId} LIMIT 1
    `);
    const booking = (rows?.rows ?? rows ?? [])[0] ?? null;
    if (!booking) return res.status(404).json({ error: 'Academy booking not found' });

    if (booking.booking_status === 'cancelled') {
      return res.status(422).json({ error: 'Booking is already cancelled' });
    }

    const walletUpdates: Record<string, unknown> = {};
    let action: 'released' | 'refunded' | 'cancelled' = 'cancelled';
    let txnId: string | null = null;

    const { walletService } = await import('../services/WalletService');

    if (booking.finance_state === 'hold_active' && Number(booking.wallet_hold_cents) > 0) {
      const releaseResult = await walletService.releaseBookingHold({
        userId:               booking.user_id,
        amountCents:          Number(booking.wallet_hold_cents),
        bookingId,
        divisionCode:         'academy',
        ipAddress:            req.ip,
        idempotencyKeySuffix: `admin-cancel:${uid}`,
        metadata:             { adminId: uid, reason, actorSource: 'admin_override' },
      });
      walletUpdates.finance_state   = 'released';
      walletUpdates.wallet_release_key = releaseResult.txnId;
      txnId  = releaseResult.txnId;
      action = 'released';
      logger.info('[AdminWallet][ForceCancel] Hold released', { bookingId, txnId, adminUid: uid });
    } else if (booking.finance_state === 'debited' && Number(booking.wallet_debited_cents) > 0) {
      const refundResult = await walletService.refundBookingWallet({
        userId:               booking.user_id,
        amountCents:          Number(booking.wallet_debited_cents),
        bookingId,
        divisionCode:         'academy',
        ipAddress:            req.ip,
        idempotencyKeySuffix: `admin-cancel:${uid}:${Date.now()}`,
        metadata:             { adminId: uid, reason, actorSource: 'admin_override' },
        reason:               reason,
      });
      walletUpdates.finance_state        = 'refunded';
      walletUpdates.wallet_refund_key    = refundResult.txnId;
      walletUpdates.wallet_refunded_cents = Number(booking.wallet_debited_cents);
      txnId  = refundResult.txnId;
      action = 'refunded';
      logger.info('[AdminWallet][ForceCancel] Wallet refunded', { bookingId, txnId, adminUid: uid });
    }

    await db.execute(sql`
      UPDATE trainer_bookings
      SET booking_status = 'cancelled',
          cancelled_at   = NOW(),
          cancelled_by   = 'admin',
          cancellation_reason = ${reason},
          finance_state  = ${walletUpdates.finance_state ?? booking.finance_state},
          wallet_release_key    = ${walletUpdates.wallet_release_key    ?? null},
          wallet_refund_key     = ${walletUpdates.wallet_refund_key     ?? null},
          wallet_refunded_cents = ${walletUpdates.wallet_refunded_cents ?? booking.wallet_refunded_cents ?? 0},
          updated_at     = NOW()
      WHERE booking_id = ${bookingId}
    `);

    logger.info('[AdminWallet][ForceCancel] Academy booking force-cancelled', {
      bookingId, adminUid: uid, reason, action,
    });

    // 2.7C/D — fire-and-forget SMS (same wording as trainer self-cancel)
    const cancelSmsEvent = action === 'refunded' ? 'cancelled_refund' : 'cancelled_release';
    dispatchAcademySms({
      bookingId,
      amountCents:    action === 'refunded'
                        ? Number(booking.wallet_debited_cents)
                        : Number(booking.wallet_hold_cents),
      event:          cancelSmsEvent,
      trainerUserId:  booking.trainer_user_id,
      customerUserId: booking.user_id,
    });

    return res.json({
      ok: true,
      bookingId,
      action: `force-cancel:${action}`,
      txnId,
      actorUid: uid,
      actorSource: 'admin_override',
      reason,
      cancelledAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[AdminWallet][ForceCancel] error', { error: err.message });
    return res.status(500).json({ error: 'Force cancel failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Admin Action History — shared query helper
// Captures all admin-initiated wallet operations by filtering on:
//   1. event_type IN ('admin_credit','admin_debit')   — adjust credit/debit
//   2. metadata->>'adminId' IS NOT NULL               — release/refund/debit-from-hold
// ──────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
// stableStringify — deterministic JSON for SHA-256 signing
// Sorts object keys alphabetically, preserves array order, handles primitives.
// ──────────────────────────────────────────────────────────────────────────────
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const sorted = Object.keys(value as object)
    .sort()
    .map(k => JSON.stringify(k) + ':' + stableStringify((value as any)[k]))
    .join(',');
  return '{' + sorted + '}';
}

async function queryActionHistory(filters: {
  divisionCode?: string;
  adminUid?: string;
  userId?: string;
  bookingId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Array<{
  txnId: string;
  adminUid: string | null;
  userId: string;
  bookingId: string | null;
  divisionCode: string | null;
  source: string;
  amountCents: number;
  balanceAfterCents: number | null;
  reason: string | null;
  createdAt: string;
  reversed: boolean;
  reversedByTxnId: string | null;
}>> {
  const conditions: any[] = [];

  // Only admin-originated rows
  conditions.push(sql`(
    e.event_type IN ('admin_credit', 'admin_debit')
    OR (e.metadata->>'adminId' IS NOT NULL AND e.metadata->>'adminId' != '')
  )`);

  if (filters.divisionCode) conditions.push(sql`e.division_code = ${filters.divisionCode}`);
  if (filters.adminUid)    conditions.push(sql`(e.metadata->>'adminId' = ${filters.adminUid} OR e.created_by = ${filters.adminUid})`);
  if (filters.userId)      conditions.push(sql`e.user_id = ${filters.userId}`);
  if (filters.bookingId)   conditions.push(sql`e.booking_id = ${filters.bookingId}`);
  if (filters.from)        conditions.push(sql`e.created_at >= ${new Date(filters.from)}`);
  if (filters.to) {
    const toDate = new Date(filters.to);
    toDate.setDate(toDate.getDate() + 1);
    conditions.push(sql`e.created_at < ${toDate}`);
  }

  const whereClause = conditions.reduce((acc, cond, i) =>
    i === 0 ? cond : sql`${acc} AND ${cond}`, conditions[0]);

  const lim = filters.limit ?? 200;

  const rows: any = await db.execute(sql`
    SELECT
      e.entry_id                                          AS txn_id,
      COALESCE(e.metadata->>'adminId', e.created_by)     AS admin_uid,
      e.user_id,
      e.booking_id,
      e.division_code,
      COALESCE(e.metadata->>'actorSource', e.event_type) AS source,
      e.amount_cents,
      e.balance_after_cents,
      e.metadata->>'reason'                              AS reason,
      e.created_at,
      CASE WHEN r.original_txn_id IS NOT NULL THEN true ELSE false END AS reversed,
      r.reversed_by_txn_id
    FROM wallet_ledger_entries e
    LEFT JOIN admin_action_reversals r ON r.original_txn_id = e.entry_id
    WHERE ${whereClause}
      AND e.direction = 'credit'
    ORDER BY e.created_at DESC
    LIMIT ${lim}
  `);

  return (rows?.rows ?? rows ?? []).map((r: any) => ({
    txnId:             r.txn_id,
    adminUid:          r.admin_uid          ?? null,
    userId:            r.user_id,
    bookingId:         r.booking_id         ?? null,
    divisionCode:      r.division_code      ?? null,
    source:            r.source             ?? 'unknown',
    amountCents:       Number(r.amount_cents),
    balanceAfterCents: r.balance_after_cents != null ? Number(r.balance_after_cents) : null,
    reason:            r.reason             ?? null,
    createdAt:         r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    reversed:          r.reversed === true || r.reversed === 'true',
    reversedByTxnId:   r.reversed_by_txn_id ?? null,
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/action-history
// Returns admin wallet override history (JSON, paginated up to 200 rows).
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/action-history', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { divisionCode, adminUid, bookingId, from, to } = req.query as Record<string, string | undefined>;

    const rows = await queryActionHistory({ divisionCode, adminUid, bookingId, from, to });

    return res.json({ rows, total: rows.length });
  } catch (err: any) {
    logger.error('[AdminWallet][ActionHistory] error', { error: err.message });
    return res.status(500).json({ error: 'Action history query failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/action-history/export
// Returns CSV download of admin wallet override history.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/action-history/export', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { divisionCode, adminUid, bookingId, from, to } = req.query as Record<string, string | undefined>;

    // Probe with limit+1 to detect overflow before returning a partial file
    const EXPORT_LIMIT = 5000;
    const rows = await queryActionHistory({ divisionCode, adminUid, bookingId, from, to, limit: EXPORT_LIMIT + 1 });
    if (rows.length > EXPORT_LIMIT) {
      return res.status(400).json({
        error: 'Date range too wide for one export. Narrow the range.',
        rowsMatched: `>${EXPORT_LIMIT}`,
      });
    }

    const escape = (v: string | null | undefined): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    // 12 canonical audit columns — order is contractual, do not reorder
    const header = [
      'txnId', 'adminUid', 'userId', 'bookingId', 'divisionCode',
      'source', 'amountCents', 'amountILS', 'balanceAfterCents', 'balanceAfterILS',
      'reason', 'createdAt',
    ];
    const csvRows = rows.map(r => [
      r.txnId,
      r.adminUid,
      r.userId,
      r.bookingId,
      r.divisionCode,
      r.source,
      r.amountCents,
      (r.amountCents / 100).toFixed(2),
      r.balanceAfterCents ?? '',
      r.balanceAfterCents != null ? (r.balanceAfterCents / 100).toFixed(2) : '',
      r.reason,
      r.createdAt,
    ].map(v => escape(v == null ? null : String(v))).join(','));

    // B2: immutable, timestamped filename — safe to attach to tickets
    const ts        = new Date().toISOString().replace(/[:\-]/g, '').replace(/\..+/, '') + 'Z';
    const fromLabel = from ?? 'all';
    const toLabel   = to   ?? 'all';
    const rangeSlug = (from || to) ? `${fromLabel}_to_${toLabel}` : 'all';
    const filename  = `petwash-wallet-action-audit-${rangeSlug}-${ts}.csv`;

    // UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF';
    const csv = bom + [header.join(','), ...csvRows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err: any) {
    logger.error('[AdminWallet][ActionHistoryExport] error', { error: err.message });
    return res.status(500).json({ error: 'Export failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/audit-bundle/:subjectType/:subjectId
// Downloads a tamper-evident signed JSON bundle for a booking or user wallet.
// subjectType = "booking" | "user"
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/audit-bundle/:subjectType/:subjectId', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { subjectType, subjectId } = req.params as { subjectType: string; subjectId: string };
    if (!['booking', 'user'].includes(subjectType)) {
      return res.status(400).json({ error: 'Invalid subjectType — must be "booking" or "user"' });
    }

    const generatedAt = new Date().toISOString();

    // ── BOOKING BUNDLE ──────────────────────────────────────────────────────
    if (subjectType === 'booking') {
      // 1. Ledger entries for this booking
      const ledgerRaw: any = await db.execute(sql`
        SELECT
          entry_id, user_id, booking_id, division_code, direction,
          amount_cents, balance_after_cents, event_type, metadata,
          created_at
        FROM wallet_ledger_entries
        WHERE booking_id = ${subjectId}
        ORDER BY created_at ASC, entry_id ASC
      `);
      const ledgerEntries = (ledgerRaw?.rows ?? ledgerRaw ?? []).map((r: any) => ({
        entryId:           r.entry_id,
        userId:            r.user_id,
        bookingId:         r.booking_id,
        divisionCode:      r.division_code ?? null,
        direction:         r.direction,
        amountCents:       Number(r.amount_cents),
        balanceAfterCents: r.balance_after_cents != null ? Number(r.balance_after_cents) : null,
        eventType:         r.event_type,
        metadata:          r.metadata ?? {},
        createdAt:         r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      }));

      // 2. Booking snapshot — check booking_requests first, then trainer_bookings
      let bookingSnapshot: any = null;
      const brRaw: any = await db.execute(sql`
        SELECT
          request_id, owner_id, provider_id,
          booking_status, finance_state,
          wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents,
          wallet_hold_key, wallet_debit_key, wallet_release_key, wallet_refund_key,
          created_at, updated_at
        FROM booking_requests
        WHERE request_id = ${subjectId}
        LIMIT 1
      `);
      const brRow = (brRaw?.rows ?? brRaw ?? [])[0];
      if (brRow) {
        bookingSnapshot = {
          bookingId:          brRow.request_id,
          sourceTable:        'booking_requests',
          userId:             brRow.owner_id,
          providerId:         brRow.provider_id ?? null,
          status:             brRow.booking_status ?? null,
          financeState:       brRow.finance_state,
          walletHoldCents:    Number(brRow.wallet_hold_cents ?? 0),
          walletDebitedCents: Number(brRow.wallet_debited_cents ?? 0),
          walletRefundedCents:Number(brRow.wallet_refunded_cents ?? 0),
          walletHoldKey:      brRow.wallet_hold_key ?? null,
          walletDebitKey:     brRow.wallet_debit_key ?? null,
          walletReleaseKey:   brRow.wallet_release_key ?? null,
          walletRefundKey:    brRow.wallet_refund_key ?? null,
          createdAt:          brRow.created_at instanceof Date ? brRow.created_at.toISOString() : String(brRow.created_at),
          updatedAt:          brRow.updated_at instanceof Date ? brRow.updated_at.toISOString() : String(brRow.updated_at),
        };
      } else {
        const tbRaw: any = await db.execute(sql`
          SELECT
            booking_id, user_id, trainer_user_id,
            booking_status, finance_state,
            wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents,
            wallet_hold_key, wallet_debit_key, wallet_release_key, wallet_refund_key,
            created_at, updated_at
          FROM trainer_bookings
          WHERE booking_id = ${subjectId}
          LIMIT 1
        `);
        const tbRow = (tbRaw?.rows ?? tbRaw ?? [])[0];
        if (tbRow) {
          bookingSnapshot = {
            bookingId:          tbRow.booking_id,
            sourceTable:        'trainer_bookings',
            userId:             tbRow.user_id,
            providerId:         tbRow.trainer_user_id ?? null,
            status:             tbRow.booking_status ?? null,
            financeState:       tbRow.finance_state,
            walletHoldCents:    Number(tbRow.wallet_hold_cents ?? 0),
            walletDebitedCents: Number(tbRow.wallet_debited_cents ?? 0),
            walletRefundedCents:Number(tbRow.wallet_refunded_cents ?? 0),
            walletHoldKey:      tbRow.wallet_hold_key ?? null,
            walletDebitKey:     tbRow.wallet_debit_key ?? null,
            walletReleaseKey:   tbRow.wallet_release_key ?? null,
            walletRefundKey:    tbRow.wallet_refund_key ?? null,
            createdAt:          tbRow.created_at instanceof Date ? tbRow.created_at.toISOString() : String(tbRow.created_at),
            updatedAt:          tbRow.updated_at instanceof Date ? tbRow.updated_at.toISOString() : String(tbRow.updated_at),
          };
        }
      }

      if (!bookingSnapshot && ledgerEntries.length === 0) {
        return res.status(404).json({ error: 'Booking not found in booking_requests or trainer_bookings' });
      }

      // 3. Action history for this booking (ASC for bundle — chronological read)
      const actionHistoryRows = (await queryActionHistory({ bookingId: subjectId, limit: 5000 }))
        .reverse(); // queryActionHistory returns DESC; reverse to ASC for the bundle

      // 4. Signature
      const signatureInput = stableStringify({ ledgerEntries, bookingSnapshot, actionHistoryRows, generatedAt });
      const signature = 'sha256:' + createHash('sha256').update(signatureInput).digest('hex');

      const bundle = {
        bundleVersion:    '1',
        subjectType:      'booking',
        subjectId,
        generatedAt,
        generatedBy:      uid,
        ledgerEntries,
        bookingSnapshot,
        actionHistoryRows,
        signature,
      };

      const filename = `audit-bundle-booking-${subjectId}-${generatedAt.replace(/[:.]/g, '-')}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(bundle);
    }

    // ── USER BUNDLE ─────────────────────────────────────────────────────────
    if (subjectType === 'user') {
      // 1. Ledger entries for this user (capped at 2000)
      const CAP = 2000;
      const ledgerRaw: any = await db.execute(sql`
        SELECT
          entry_id, user_id, booking_id, division_code, direction,
          amount_cents, balance_after_cents, event_type, metadata,
          created_at
        FROM wallet_ledger_entries
        WHERE user_id = ${subjectId}
        ORDER BY created_at ASC, entry_id ASC
        LIMIT ${CAP + 1}
      `);
      const rawRows = (ledgerRaw?.rows ?? ledgerRaw ?? []);
      const capped = rawRows.length > CAP;
      const ledgerEntries = rawRows.slice(0, CAP).map((r: any) => ({
        entryId:           r.entry_id,
        userId:            r.user_id,
        bookingId:         r.booking_id ?? null,
        divisionCode:      r.division_code ?? null,
        direction:         r.direction,
        amountCents:       Number(r.amount_cents),
        balanceAfterCents: r.balance_after_cents != null ? Number(r.balance_after_cents) : null,
        eventType:         r.event_type,
        metadata:          r.metadata ?? {},
        createdAt:         r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      }));

      // 2. Wallet account snapshot
      const waRaw: any = await db.execute(sql`
        SELECT
          cash_wallet_balance_cents, egift_balance_cents, promo_balance_cents,
          referral_balance_cents, loyalty_points_balance, pending_balance_cents,
          lifetime_earned_cents, lifetime_redeemed_cents, updated_at
        FROM wallet_accounts
        WHERE user_id = ${subjectId}
        LIMIT 1
      `);
      const waRow = (waRaw?.rows ?? waRaw ?? [])[0];
      if (!waRow) {
        return res.status(404).json({ error: 'Wallet account not found for user' });
      }

      // 3. Booking finance summary (both tables)
      const bfRaw: any = await db.execute(sql`
        SELECT
          SUM(CASE WHEN finance_state = 'hold_active' THEN 1 ELSE 0 END)  AS hold_active_count,
          SUM(CASE WHEN finance_state = 'debited'     THEN 1 ELSE 0 END)  AS debited_count,
          SUM(CASE WHEN finance_state = 'refunded'    THEN 1 ELSE 0 END)  AS refunded_count,
          SUM(CASE WHEN finance_state = 'released'    THEN 1 ELSE 0 END)  AS released_count,
          COALESCE(SUM(wallet_hold_cents), 0)                             AS total_held_cents,
          COALESCE(SUM(wallet_debited_cents), 0)                          AS total_debited_cents,
          COALESCE(SUM(wallet_refunded_cents), 0)                         AS total_refunded_cents
        FROM (
          SELECT finance_state, wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents
          FROM booking_requests WHERE owner_id = ${subjectId}
          UNION ALL
          SELECT finance_state, wallet_hold_cents, wallet_debited_cents, wallet_refunded_cents
          FROM trainer_bookings WHERE user_id = ${subjectId}
        ) combined
      `);
      const bfRow = (bfRaw?.rows ?? bfRaw ?? [])[0] ?? {};

      const bookingSnapshot = {
        userId: subjectId,
        ...(capped ? { ledgerNote: `Ledger capped at ${CAP} rows (oldest first). Full history requires DB export.` } : {}),
        walletAccount: {
          cashWalletBalanceCents:   Number(waRow.cash_wallet_balance_cents ?? 0),
          egiftBalanceCents:        Number(waRow.egift_balance_cents ?? 0),
          promoBalanceCents:        Number(waRow.promo_balance_cents ?? 0),
          referralBalanceCents:     Number(waRow.referral_balance_cents ?? 0),
          loyaltyPointsBalance:     Number(waRow.loyalty_points_balance ?? 0),
          pendingBalanceCents:      Number(waRow.pending_balance_cents ?? 0),
          lifetimeEarnedCents:      Number(waRow.lifetime_earned_cents ?? 0),
          lifetimeRedeemedCents:    Number(waRow.lifetime_redeemed_cents ?? 0),
          updatedAt:                waRow.updated_at instanceof Date ? waRow.updated_at.toISOString() : String(waRow.updated_at),
        },
        bookingFinanceSummary: {
          holdActiveCount:    Number(bfRow.hold_active_count ?? 0),
          debitedCount:       Number(bfRow.debited_count ?? 0),
          refundedCount:      Number(bfRow.refunded_count ?? 0),
          releasedCount:      Number(bfRow.released_count ?? 0),
          totalHeldCents:     Number(bfRow.total_held_cents ?? 0),
          totalDebitedCents:  Number(bfRow.total_debited_cents ?? 0),
          totalRefundedCents: Number(bfRow.total_refunded_cents ?? 0),
        },
      };

      // 4. Action history for this user
      const actionHistoryRows = (await queryActionHistory({ userId: subjectId, limit: 5000 }))
        .reverse();

      // 5. Signature
      const signatureInput = stableStringify({ ledgerEntries, bookingSnapshot, actionHistoryRows, generatedAt });
      const signature = 'sha256:' + createHash('sha256').update(signatureInput).digest('hex');

      const bundle = {
        bundleVersion:    '1',
        subjectType:      'user',
        subjectId,
        generatedAt,
        generatedBy:      uid,
        ledgerEntries,
        bookingSnapshot,
        actionHistoryRows,
        signature,
      };

      const filename = `audit-bundle-user-${subjectId}-${generatedAt.replace(/[:.]/g, '-')}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(bundle);
    }
  } catch (err: any) {
    logger.error('[AdminWallet][AuditBundle] error', { error: err.message });
    return res.status(500).json({ error: 'Audit bundle generation failed', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/anomalies
// Returns up to 50 active wallet/booking anomalies for the admin banner zone.
// Four signal types: negative_balance, stale_hold, refund_exceeds_hold, double_debit
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/anomalies', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const anomalies: Array<{
      code: string;
      severity: 'critical' | 'warning';
      userId: string | null;
      bookingId: string | null;
      detail: string;
      detectedAt: string;
    }> = [];

    // ── Signal 1: Negative balance ───────────────────────────────────────────
    const negRows: any = await db.execute(sql`
      SELECT user_id,
             cash_wallet_balance_cents,
             pending_balance_cents,
             updated_at
      FROM wallet_accounts
      WHERE cash_wallet_balance_cents < 0
         OR pending_balance_cents < 0
      LIMIT 50
    `);
    for (const r of (negRows?.rows ?? negRows ?? [])) {
      anomalies.push({
        code: 'negative_balance',
        severity: 'critical',
        userId: r.user_id,
        bookingId: null,
        detail: `available=${r.cash_wallet_balance_cents} agorot, pending=${r.pending_balance_cents} agorot`,
        detectedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      });
    }

    // ── Signal 2: Stale holds > 48h ─────────────────────────────────────────
    const staleRows: any = await db.execute(sql`
      SELECT id::text AS booking_id,
             owner_id AS user_id,
             wallet_hold_cents,
             created_at,
             'marketplace' AS source
      FROM booking_requests
      WHERE finance_state = 'hold_active'
        AND created_at < NOW() - INTERVAL '48 hours'
      UNION ALL
      SELECT id::text AS booking_id,
             user_id,
             wallet_hold_cents,
             created_at,
             'academy' AS source
      FROM trainer_bookings
      WHERE finance_state = 'hold_active'
        AND created_at < NOW() - INTERVAL '48 hours'
      LIMIT 50
    `);
    for (const r of (staleRows?.rows ?? staleRows ?? [])) {
      anomalies.push({
        code: 'stale_hold',
        severity: 'warning',
        userId: r.user_id,
        bookingId: r.booking_id,
        detail: `${r.source} hold of ${r.wallet_hold_cents} agorot active since ${new Date(r.created_at).toISOString()}`,
        detectedAt: new Date(r.created_at).toISOString(),
      });
    }

    // ── Signal 3: Refund exceeds hold ────────────────────────────────────────
    const refundExceedsRows: any = await db.execute(sql`
      SELECT id::text AS booking_id,
             owner_id AS user_id,
             wallet_hold_cents,
             wallet_refunded_cents,
             updated_at,
             'marketplace' AS source
      FROM booking_requests
      WHERE wallet_refunded_cents > wallet_hold_cents
        AND wallet_hold_cents > 0
      UNION ALL
      SELECT id::text AS booking_id,
             user_id,
             wallet_hold_cents,
             wallet_refunded_cents,
             updated_at,
             'academy' AS source
      FROM trainer_bookings
      WHERE wallet_refunded_cents > wallet_hold_cents
        AND wallet_hold_cents > 0
      LIMIT 50
    `);
    for (const r of (refundExceedsRows?.rows ?? refundExceedsRows ?? [])) {
      anomalies.push({
        code: 'refund_exceeds_hold',
        severity: 'critical',
        userId: r.user_id,
        bookingId: r.booking_id,
        detail: `${r.source}: refunded=${r.wallet_refunded_cents} > hold=${r.wallet_hold_cents} agorot`,
        detectedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      });
    }

    // ── Signal 4: Double debit for same booking ──────────────────────────────
    const doubleDebitRows: any = await db.execute(sql`
      SELECT booking_id,
             MIN(user_id) AS user_id,
             COUNT(*) AS debit_count,
             MIN(created_at) AS first_debit_at
      FROM wallet_ledger_entries
      WHERE event_type = 'debit'
        AND booking_id IS NOT NULL
        AND booking_id != ''
      GROUP BY booking_id
      HAVING COUNT(*) > 1
      LIMIT 50
    `);
    for (const r of (doubleDebitRows?.rows ?? doubleDebitRows ?? [])) {
      anomalies.push({
        code: 'double_debit',
        severity: 'critical',
        userId: r.user_id,
        bookingId: r.booking_id,
        detail: `${r.debit_count} debit rows for booking (expected 1)`,
        detectedAt: r.first_debit_at ? new Date(r.first_debit_at).toISOString() : new Date().toISOString(),
      });
    }

    // ── Sort: critical first, then detectedAt DESC, then slice to 50 ─────────
    anomalies.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });
    const result = anomalies.slice(0, 50);

    return res.json({ ok: true, anomalies: result, total: result.length, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    logger.error('[AdminWallet][Anomalies] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch anomalies', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/reverse-action
// Reverses a single admin-originated ledger entry (admin_credit or admin_debit).
// Guards: adminId must exist in metadata, within 24h, not already reversed.
// Issues the inverse adjustment, inserts admin_action_reversals row.
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/reverse-action', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const schema = z.object({
      txnId:  z.string().min(1),
      reason: z.string().min(5, 'Reason must be at least 5 characters'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });

    const { txnId, reason } = parsed.data;

    // ── 1. Fetch the original ledger entry ────────────────────────────────────
    const [original] = await db
      .select()
      .from(walletLedgerEntries)
      .where(eq(walletLedgerEntries.entryId, txnId))
      .limit(1);

    if (!original) return res.status(404).json({ error: 'Transaction not found', txnId });

    // ── 2. Must be admin-originated ───────────────────────────────────────────
    const meta = (original.metadata as any) ?? {};
    if (!meta.adminId) {
      return res.status(422).json({ error: 'Transaction was not admin-originated and cannot be reversed' });
    }

    // ── 3. Must be reversible event type ─────────────────────────────────────
    const reversibleTypes = ['admin_credit', 'admin_debit'];
    if (!reversibleTypes.includes(original.eventType)) {
      return res.status(422).json({ error: `Event type '${original.eventType}' is not reversible. Only admin_credit and admin_debit can be reversed.` });
    }

    // ── 4. Must be within 24h ─────────────────────────────────────────────────
    const ageMs = Date.now() - new Date(original.createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      return res.status(422).json({ error: 'Cannot reverse — action is older than 24 hours', createdAt: original.createdAt });
    }

    // ── 5. Must not already be reversed ──────────────────────────────────────
    const [existingReversal] = await db
      .select()
      .from(adminActionReversals)
      .where(eq(adminActionReversals.originalTxnId, txnId))
      .limit(1);

    if (existingReversal) {
      return res.status(409).json({
        error: 'This action has already been reversed',
        reversedByTxnId: existingReversal.reversedByTxnId,
        reversedAt: existingReversal.createdAt,
      });
    }

    // ── 6. Determine inverse type and wallet ──────────────────────────────────
    const inverseType = original.eventType === 'admin_credit' ? 'debit' : 'credit';

    const walletRow: any = await db.execute(sql`
      SELECT wallet_id FROM wallet_accounts WHERE user_id = ${original.userId} LIMIT 1
    `);
    const walletId = (walletRow?.rows ?? walletRow ?? [])[0]?.wallet_id;
    if (!walletId) return res.status(404).json({ error: 'Wallet not found for user', userId: original.userId });

    // ── 7. Issue inverse adjustment ───────────────────────────────────────────
    const { adminAdjustWallet } = await import('../services/WalletLedger');
    const idempKey = `wallet:admin:reversal:${txnId}`;
    const { txnId: reversalTxnId } = await adminAdjustWallet({
      userId:         original.userId,
      walletId,
      amountCents:    original.amountCents,
      type:           inverseType,
      reason:         `REVERSAL of ${txnId}: ${reason}`,
      adminId:        uid,
      idempotencyKey: idempKey,
      reversalOf:     txnId,
    });

    // ── 8. Write audit row ────────────────────────────────────────────────────
    const now = new Date();
    await db.insert(adminActionReversals).values({
      originalTxnId:   txnId,
      reversedByTxnId: reversalTxnId,
      adminUid:        uid,
      actionType:      original.eventType,
      status:          'completed',
      createdAt:       now,
      completedAt:     now,
      metadata:        { reason, originalAdminId: meta.adminId, originalAmountCents: original.amountCents } as any,
    });

    // ── 9. Wallet snapshot ────────────────────────────────────────────────────
    const snapRow: any = await db.execute(sql`
      SELECT cash_wallet_balance_cents,
             egift_wallet_balance_cents,
             promo_wallet_balance_cents,
             referral_wallet_balance_cents,
             pending_balance_cents,
             points_balance
      FROM wallet_accounts WHERE user_id = ${original.userId} LIMIT 1
    `);
    const snap = (snapRow?.rows ?? snapRow ?? [])[0] ?? {};
    const walletSnapshot = {
      cashCents:     Number(snap.cash_wallet_balance_cents  ?? 0),
      egiftCents:    Number(snap.egift_wallet_balance_cents ?? 0),
      promoCents:    Number(snap.promo_wallet_balance_cents ?? 0),
      referralCents: Number(snap.referral_wallet_balance_cents ?? 0),
      pendingCents:  Number(snap.pending_balance_cents      ?? 0),
      points:        Number(snap.points_balance             ?? 0),
    };

    logger.info('[AdminWallet][ReverseAction] completed', {
      originalTxnId: txnId,
      reversalTxnId,
      adminUid: uid,
      inverseType,
      amountCents: original.amountCents,
    });

    return res.json({
      ok: true,
      originalTxnId: txnId,
      reversalTxnId,
      inverseType,
      amountCents: original.amountCents,
      userId: original.userId,
      walletSnapshot,
    });
  } catch (err: any) {
    // Handle unique constraint violation (double-reverse race)
    if (err.code === '23505' || (err.message ?? '').includes('unique')) {
      return res.status(409).json({ error: 'This action has already been reversed (concurrent attempt)' });
    }
    // Insufficient balance on debit reversal
    if ((err.message ?? '').includes('Insufficient cash balance')) {
      return res.status(422).json({ error: 'Cannot reverse credit — user has insufficient balance for the matching debit', detail: err.message });
    }
    logger.error('[AdminWallet][ReverseAction] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to reverse action', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/exception-summary
// Finance exception summary — aggregated counts and top offenders.
// Reuses exact signal SQL from the anomaly endpoint (48h stale → 72h threshold here).
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/exception-summary', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    // Collect (userId, issueType) pairs for top-offender aggregation
    const offenderMap = new Map<string, { stale: number; refundExceedsHold: number; negBal: number; doubleDebit: number }>();
    const bumpOffender = (userId: string | null, field: 'stale' | 'refundExceedsHold' | 'negBal' | 'doubleDebit') => {
      if (!userId) return;
      if (!offenderMap.has(userId)) offenderMap.set(userId, { stale: 0, refundExceedsHold: 0, negBal: 0, doubleDebit: 0 });
      offenderMap.get(userId)![field]++;
    };

    // ── Signal 1: Negative balances ──────────────────────────────────────────
    const negRows: any = await db.execute(sql`
      SELECT user_id,
             cash_wallet_balance_cents,
             pending_balance_cents
      FROM wallet_accounts
      WHERE cash_wallet_balance_cents < 0
         OR pending_balance_cents < 0
    `);
    const negList = negRows?.rows ?? negRows ?? [];
    for (const r of negList) bumpOffender(r.user_id, 'negBal');

    // ── Signal 2: Stale holds > 72h (stricter threshold than banner's 48h) ───
    const staleRows: any = await db.execute(sql`
      SELECT id::text AS booking_id,
             owner_id AS user_id,
             wallet_hold_cents
      FROM booking_requests
      WHERE finance_state = 'hold_active'
        AND created_at < NOW() - INTERVAL '72 hours'
      UNION ALL
      SELECT id::text AS booking_id,
             user_id,
             wallet_hold_cents
      FROM trainer_bookings
      WHERE finance_state = 'hold_active'
        AND created_at < NOW() - INTERVAL '72 hours'
    `);
    const staleList = staleRows?.rows ?? staleRows ?? [];
    for (const r of staleList) bumpOffender(r.user_id, 'stale');
    const staleTotalCents = staleList.reduce((acc: number, r: any) => acc + Number(r.wallet_hold_cents ?? 0), 0);

    // ── Signal 3: Refund exceeds hold ─────────────────────────────────────────
    const refundRows: any = await db.execute(sql`
      SELECT id::text AS booking_id,
             owner_id AS user_id,
             wallet_hold_cents,
             wallet_refunded_cents
      FROM booking_requests
      WHERE wallet_refunded_cents > wallet_hold_cents
        AND wallet_hold_cents > 0
      UNION ALL
      SELECT id::text AS booking_id,
             user_id,
             wallet_hold_cents,
             wallet_refunded_cents
      FROM trainer_bookings
      WHERE wallet_refunded_cents > wallet_hold_cents
        AND wallet_hold_cents > 0
    `);
    const refundList = refundRows?.rows ?? refundRows ?? [];
    for (const r of refundList) bumpOffender(r.user_id, 'refundExceedsHold');
    const refundExcessCents = refundList.reduce((acc: number, r: any) => acc + Math.max(0, Number(r.wallet_refunded_cents ?? 0) - Number(r.wallet_hold_cents ?? 0)), 0);

    // ── Signal 4: Double debit ───────────────────────────────────────────────
    const doubleRows: any = await db.execute(sql`
      SELECT booking_id,
             MIN(user_id) AS user_id,
             COUNT(*) AS debit_count
      FROM wallet_ledger_entries
      WHERE event_type = 'debit'
        AND booking_id IS NOT NULL
        AND booking_id != ''
      GROUP BY booking_id
      HAVING COUNT(*) > 1
    `);
    const doubleList = doubleRows?.rows ?? doubleRows ?? [];
    for (const r of doubleList) bumpOffender(r.user_id, 'doubleDebit');

    // ── Unresolved anomalies count (all 4 signals combined) ─────────────────
    const unresolvedCount = negList.length + staleList.length + refundList.length + doubleList.length;

    // ── Top offenders ────────────────────────────────────────────────────────
    const topOffenders = Array.from(offenderMap.entries())
      .map(([userId, counts]) => {
        const issueCount = counts.stale + counts.refundExceedsHold + counts.negBal + counts.doubleDebit;
        const parts: string[] = [];
        if (counts.stale > 0)              parts.push(`${counts.stale} stale hold${counts.stale > 1 ? 's' : ''}`);
        if (counts.refundExceedsHold > 0)  parts.push(`${counts.refundExceedsHold} refund${counts.refundExceedsHold > 1 ? 's' : ''} exceed hold`);
        if (counts.negBal > 0)             parts.push(`${counts.negBal} negative balance${counts.negBal > 1 ? 's' : ''}`);
        if (counts.doubleDebit > 0)        parts.push(`${counts.doubleDebit} double debit${counts.doubleDebit > 1 ? 's' : ''}`);
        return { userId, issueCount, description: parts.join(', ') };
      })
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 5);

    return res.json({
      ok: true,
      asOf: new Date().toISOString(),
      staleHoldsOver72h:  { count: staleList.length,  totalCents: staleTotalCents },
      refundExceedsHold:  { count: refundList.length,  totalCents: refundExcessCents },
      negativeBalances:   { count: negList.length },
      unresolvedAnomalies: { count: unresolvedCount },
      topOffenders,
    });
  } catch (err: any) {
    logger.error('[AdminWallet][ExceptionSummary] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch exception summary', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2.9A — PROVIDER PAYOUT LEDGER
// net_cents = gross_cents - floor(gross_cents * commission_rate_bps / 10000)
// No wallet_accounts mutations — read-only accounting layer.
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/provider/wallet/payout-ledger
// Provider sees their own entries only (Firebase UID gate).
// ──────────────────────────────────────────────────────────────────────────────
router.get('/provider/wallet/payout-ledger', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const statusFilter = req.query.status as string | undefined;
    const divisionFilter = req.query.divisionCode as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;

    const conditions: any[] = [sql`provider_uid = ${uid}`];
    if (statusFilter)   conditions.push(sql`status = ${statusFilter}`);
    if (divisionFilter) conditions.push(sql`division_code = ${divisionFilter}`);

    const whereClause = conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} AND ${c}`, conditions[0]);

    const rows: any = await db.execute(sql`
      SELECT
        id, provider_uid, division_code, booking_id,
        gross_cents, commission_rate_bps, net_cents,
        status, payout_batch_id, created_at, paid_at, metadata
      FROM provider_payout_entries
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const totalRow: any = await db.execute(sql`
      SELECT
        COUNT(*)                            AS total_count,
        COALESCE(SUM(gross_cents),  0)      AS total_gross,
        COALESCE(SUM(net_cents),    0)      AS total_net,
        COALESCE(SUM(CASE WHEN status = 'earned' THEN net_cents ELSE 0 END), 0)  AS earned_cents,
        COALESCE(SUM(CASE WHEN status = 'held'   THEN net_cents ELSE 0 END), 0)  AS held_cents,
        COALESCE(SUM(CASE WHEN status = 'paid'   THEN net_cents ELSE 0 END), 0)  AS paid_cents
      FROM provider_payout_entries
      WHERE ${whereClause}
    `);
    const totals = (totalRow?.rows ?? totalRow ?? [])[0] ?? {};

    const entries = (rows?.rows ?? rows ?? []).map((r: any) => ({
      id:                r.id,
      providerUid:       r.provider_uid,
      divisionCode:      r.division_code,
      bookingId:         r.booking_id         ?? null,
      grossCents:        Number(r.gross_cents),
      commissionRateBps: Number(r.commission_rate_bps),
      netCents:          Number(r.net_cents),
      status:            r.status,
      payoutBatchId:     r.payout_batch_id    ?? null,
      createdAt:         r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      paidAt:            r.paid_at ? (r.paid_at instanceof Date ? r.paid_at.toISOString() : String(r.paid_at)) : null,
      metadata:          r.metadata ?? {},
    }));

    return res.json({
      entries,
      totals: {
        count:        Number(totals.total_count ?? 0),
        grossCents:   Number(totals.total_gross  ?? 0),
        netCents:     Number(totals.total_net    ?? 0),
        earnedCents:  Number(totals.earned_cents ?? 0),
        heldCents:    Number(totals.held_cents   ?? 0),
        paidCents:    Number(totals.paid_cents   ?? 0),
      },
      pagination: { limit, offset },
    });
  } catch (err: any) {
    logger.error('[Payout][ProviderLedger] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch payout ledger', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3.0B — PROVIDER REMITTANCE STATEMENT
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /provider/wallet/payout-statement ─────────────────────────────────
// Provider sees their own paid entries for a given batchId (or all paid).
// Groups by booking, returns gross/commission/net totals.
router.get('/provider/wallet/payout-statement', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { batchId } = req.query as Record<string, string>;

    const conditions: any[] = [sql`provider_uid = ${uid}`, sql`status = 'paid'`];
    if (batchId) conditions.push(sql`payout_batch_id = ${batchId}`);
    const whereClause = conditions.reduce((a, c, i) => i === 0 ? c : sql`${a} AND ${c}`, conditions[0]);

    const rows: any = await db.execute(sql`
      SELECT id, division_code, booking_id,
             gross_cents, commission_rate_bps, net_cents,
             payout_batch_id, paid_at, created_at
      FROM provider_payout_entries
      WHERE ${whereClause}
      ORDER BY payout_batch_id DESC, created_at ASC
    `);
    const entries = (rows?.rows ?? rows ?? []).map((r: any) => ({
      id:                Number(r.id),
      divisionCode:      r.division_code,
      bookingId:         r.booking_id         ?? null,
      grossCents:        Number(r.gross_cents),
      commissionRateBps: Number(r.commission_rate_bps),
      netCents:          Number(r.net_cents),
      commissionCents:   Number(r.gross_cents) - Number(r.net_cents),
      payoutBatchId:     r.payout_batch_id    ?? null,
      paidAt:            r.paid_at            ?? null,
      createdAt:         r.created_at,
    }));

    // Group by batch, then by booking within batch
    const byBatch: Record<string, { batchId: string; paidAt: string | null; entries: any[]; grossCents: number; netCents: number; commissionCents: number }> = {};
    for (const e of entries) {
      const key = e.payoutBatchId ?? 'unbatched';
      if (!byBatch[key]) byBatch[key] = { batchId: key, paidAt: e.paidAt, entries: [], grossCents: 0, netCents: 0, commissionCents: 0 };
      byBatch[key].entries.push(e);
      byBatch[key].grossCents      += e.grossCents;
      byBatch[key].netCents        += e.netCents;
      byBatch[key].commissionCents += e.commissionCents;
    }

    const totals = {
      entryCount:      entries.length,
      grossCents:      entries.reduce((s, e) => s + e.grossCents, 0),
      netCents:        entries.reduce((s, e) => s + e.netCents, 0),
      commissionCents: entries.reduce((s, e) => s + e.commissionCents, 0),
    };

    // Batch list for selector
    const batchList: any = await db.execute(sql`
      SELECT DISTINCT payout_batch_id, MAX(paid_at) AS paid_at
      FROM provider_payout_entries
      WHERE provider_uid=${uid} AND status='paid' AND payout_batch_id IS NOT NULL
      GROUP BY payout_batch_id ORDER BY MAX(paid_at) DESC
    `);
    const batches = (batchList?.rows ?? batchList ?? []).map((r: any) => ({ batchId: r.payout_batch_id, paidAt: r.paid_at }));

    return res.json({ ok: true, providerUid: uid, batchId: batchId ?? null, entries, byBatch: Object.values(byBatch), totals, batches });
  } catch (err: any) {
    logger.error('[3.0B][PayoutStatement] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch payout statement', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/prestige-pass/admin/wallet/payout-ledger
// Admin view — filterable by userId, divisionCode, status, batchId, from/to.
// ──────────────────────────────────────────────────────────────────────────────
router.get('/admin/wallet/payout-ledger', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const { userId, divisionCode, status, batchId, from, to } = req.query as Record<string, string>;
    const limit  = Math.min(Number(req.query.limit) || 200, 1000);
    const offset = Number(req.query.offset) || 0;

    const conditions: any[] = [];
    if (userId)       conditions.push(sql`provider_uid = ${userId}`);
    if (divisionCode) conditions.push(sql`division_code = ${divisionCode}`);
    if (status)       conditions.push(sql`status = ${status}`);
    if (batchId)      conditions.push(sql`payout_batch_id = ${batchId}`);
    if (from)         conditions.push(sql`created_at >= ${new Date(from)}`);
    if (to) {
      const toDate = new Date(to); toDate.setDate(toDate.getDate() + 1);
      conditions.push(sql`created_at < ${toDate}`);
    }

    const whereClause = conditions.length
      ? conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} AND ${c}`, conditions[0])
      : sql`1=1`;

    const rows: any = await db.execute(sql`
      SELECT
        id, provider_uid, division_code, booking_id,
        gross_cents, commission_rate_bps, net_cents,
        status, payout_batch_id, created_at, paid_at, metadata
      FROM provider_payout_entries
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const totalRow: any = await db.execute(sql`
      SELECT
        COUNT(*)                            AS total_count,
        COALESCE(SUM(gross_cents),  0)      AS total_gross,
        COALESCE(SUM(net_cents),    0)      AS total_net,
        COALESCE(SUM(CASE WHEN status = 'earned'      THEN net_cents ELSE 0 END), 0) AS earned_cents,
        COALESCE(SUM(CASE WHEN status = 'held'        THEN net_cents ELSE 0 END), 0) AS held_cents,
        COALESCE(SUM(CASE WHEN status = 'paid'        THEN net_cents ELSE 0 END), 0) AS paid_cents,
        COALESCE(SUM(CASE WHEN status = 'clawed_back' THEN net_cents ELSE 0 END), 0) AS clawed_back_cents
      FROM provider_payout_entries
      WHERE ${whereClause}
    `);
    const totals = (totalRow?.rows ?? totalRow ?? [])[0] ?? {};

    const entries = (rows?.rows ?? rows ?? []).map((r: any) => ({
      id:                r.id,
      providerUid:       r.provider_uid,
      divisionCode:      r.division_code,
      bookingId:         r.booking_id         ?? null,
      grossCents:        Number(r.gross_cents),
      commissionRateBps: Number(r.commission_rate_bps),
      netCents:          Number(r.net_cents),
      status:            r.status,
      payoutBatchId:     r.payout_batch_id    ?? null,
      createdAt:         r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      paidAt:            r.paid_at ? (r.paid_at instanceof Date ? r.paid_at.toISOString() : String(r.paid_at)) : null,
      metadata:          r.metadata ?? {},
    }));

    return res.json({
      entries,
      totals: {
        count:           Number(totals.total_count      ?? 0),
        grossCents:      Number(totals.total_gross       ?? 0),
        netCents:        Number(totals.total_net         ?? 0),
        earnedCents:     Number(totals.earned_cents      ?? 0),
        heldCents:       Number(totals.held_cents        ?? 0),
        paidCents:       Number(totals.paid_cents        ?? 0),
        clawedBackCents: Number(totals.clawed_back_cents ?? 0),
      },
      pagination: { limit, offset },
    });
  } catch (err: any) {
    logger.error('[Payout][AdminLedger] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch admin payout ledger', detail: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/prestige-pass/admin/wallet/payout-entries/mark-paid
// Bulk transition earned/held → paid. Generates one payout_batch_id per call.
// Idempotent: rows already paid are skipped (not double-counted).
// Body: { entryIds: number[] } OR { providerUid: string } (marks all earned/held)
// ──────────────────────────────────────────────────────────────────────────────
router.post('/admin/wallet/payout-entries/mark-paid', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid || (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
    if (!(adminUser?.customClaims as any)?.admin) return res.status(403).json({ error: 'Admin access required' });

    const schema = z.object({
      entryIds:    z.array(z.number().int().positive()).optional(),
      providerUid: z.string().optional(),
      divisionCode:z.string().optional(),
      note:        z.string().optional(),
    }).refine(d => d.entryIds?.length || d.providerUid, {
      message: 'Provide either entryIds array or providerUid',
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });

    const { entryIds, providerUid, divisionCode, note } = parsed.data;
    const batchId = `batch_${nanoid(16)}`;
    const now = new Date();

    let updatedIds: number[] = [];
    let skippedIds: number[] = [];

    if (entryIds && entryIds.length > 0) {
      // Explicit ID list
      const existing: any = await db.execute(sql`
        SELECT id, status FROM provider_payout_entries
        WHERE id = ANY(${sql`ARRAY[${sql.join(entryIds.map(id => sql`${id}`), sql`, `)}]::int[]`})
      `);
      const rows = existing?.rows ?? existing ?? [];
      const payable = rows.filter((r: any) => r.status === 'earned' || r.status === 'held').map((r: any) => Number(r.id));
      skippedIds  = rows.filter((r: any) => r.status === 'paid').map((r: any) => Number(r.id));

      if (payable.length > 0) {
        await db.execute(sql`
          UPDATE provider_payout_entries
          SET status = 'paid', payout_batch_id = ${batchId}, paid_at = ${now},
              metadata = metadata || ${JSON.stringify({ markedPaidBy: uid, note: note ?? null, batchId })}::jsonb
          WHERE id = ANY(${sql`ARRAY[${sql.join(payable.map(id => sql`${id}`), sql`, `)}]::int[]`})
            AND status IN ('earned', 'held')
        `);
        updatedIds = payable;
      }
    } else if (providerUid) {
      // All earned/held for a provider (+ optional division filter)
      const conditions: any[] = [sql`provider_uid = ${providerUid}`, sql`status IN ('earned', 'held')`];
      if (divisionCode) conditions.push(sql`division_code = ${divisionCode}`);
      const whereClause = conditions.reduce((a, c, i) => i === 0 ? c : sql`${a} AND ${c}`, conditions[0]);

      const idRows: any = await db.execute(sql`SELECT id FROM provider_payout_entries WHERE ${whereClause}`);
      updatedIds = (idRows?.rows ?? idRows ?? []).map((r: any) => Number(r.id));

      if (updatedIds.length > 0) {
        await db.execute(sql`
          UPDATE provider_payout_entries
          SET status = 'paid', payout_batch_id = ${batchId}, paid_at = ${now},
              metadata = metadata || ${JSON.stringify({ markedPaidBy: uid, note: note ?? null, batchId })}::jsonb
          WHERE ${whereClause}
        `);
      }
    }

    // Totals for the batch
    let batchTotals = { grossCents: 0, netCents: 0, count: 0 };
    if (updatedIds.length > 0) {
      const totRow: any = await db.execute(sql`
        SELECT COUNT(*) AS cnt, COALESCE(SUM(gross_cents),0) AS gross, COALESCE(SUM(net_cents),0) AS net
        FROM provider_payout_entries WHERE payout_batch_id = ${batchId}
      `);
      const t = (totRow?.rows ?? totRow ?? [])[0] ?? {};
      batchTotals = { count: Number(t.cnt ?? 0), grossCents: Number(t.gross ?? 0), netCents: Number(t.net ?? 0) };
    }

    logger.info('[Payout][MarkPaid] batch completed', { batchId, adminUid: uid, updatedCount: updatedIds.length, skippedCount: skippedIds.length });

    return res.json({
      ok: true,
      batchId,
      updatedIds,
      skippedIds,
      batchTotals,
    });
  } catch (err: any) {
    logger.error('[Payout][MarkPaid] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to mark entries as paid', detail: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2.9B — Settlement Dashboard
//
// collected      = SUM debits on event_type IN (redeem_kiosk, redeem_online, hold_capture)
//                  from wallet_ledger_entries in the period
// pendingHolds   = SUM amount_cents from wallet_holds WHERE status='active'
//                  (period-scoped by created_at; no division_code on holds table)
// providerPayable= SUM net_cents from provider_payout_entries WHERE status IN ('earned','held')
//                  (period-scoped by created_at)
// vatLiability   = FLOOR(collected * 0.18)   (consistent with franchise.ts / accounting.ts)
// margin         = collected - providerPayable - vatLiability
// marginPct      = margin / collected * 100   (0 when collected = 0)
// ─────────────────────────────────────────────────────────────────────────────

// ── Phase 3.0G: Finance role helper ───────────────────────────────────────
// Roles: 'read' < 'write' < 'admin' (admin ⊃ write ⊃ read)
// All existing `isAdmin` gates are preserved; this adds granular finance gates.
const FINANCE_ROLE_RANK: Record<string, number> = { read: 1, write: 2, admin: 3 };

async function getFinanceRole(userUid: string): Promise<string | null> {
  const row: any = await db.execute(sql`
    SELECT role FROM finance_roles WHERE user_uid = ${userUid} LIMIT 1
  `);
  return (row?.rows ?? row ?? [])[0]?.role ?? null;
}

async function requireFinanceRole(
  req: Request, res: Response, minRole: 'read' | 'write' | 'admin'
): Promise<string | null> {
  const session = (req as any).session;
  if (!session?.user?.isAdmin) { res.status(403).json({ error: 'Admin only' }); return null; }
  const uid       = session.user.uid ?? session.user.id ?? '';
  const storedRole = await getFinanceRole(uid);
  // Bootstrapping: admins with no explicit role default to 'admin' so existing workflows are unaffected
  const effectiveRole = storedRole ?? 'admin';
  if ((FINANCE_ROLE_RANK[effectiveRole] ?? 0) < FINANCE_ROLE_RANK[minRole]) {
    res.status(403).json({
      error: `Finance role '${minRole}' or higher required`,
      yourRole: effectiveRole,
      minRole,
    });
    return null;
  }
  return effectiveRole;
}

// ── Finance activity audit helper (3.1D) ─────────────────────────────────
async function recordFinanceAction(
  actorUid:   string,
  action:     string,
  entityType: string,
  entityId:   string,
  before?:    Record<string, any> | null,
  after?:     Record<string, any> | null,
  ip?:        string,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, before_snap, after_snap, ip)
      VALUES (
        ${actorUid},
        ${action},
        ${entityType},
        ${entityId},
        ${before  ? JSON.stringify(before)  : null},
        ${after   ? JSON.stringify(after)   : null},
        ${ip      ?? null}
      )
    `);
  } catch (err: any) {
    logger.error('[FinanceAudit][Record] error', { error: err.message, action, entityType, entityId });
  }
}

const VAT_RATE = 0.18;
const COLLECTED_EVENTS = `('redeem_kiosk','redeem_online','hold_capture')`;

// GET /api/prestige-pass/admin/wallet/settlement-summary
router.get('/admin/wallet/settlement-summary', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const from         = req.query.from         as string | undefined; // ISO date string
    const to           = req.query.to           as string | undefined;
    const divisionCode = req.query.divisionCode as string | undefined;

    // Build date clauses
    const fromClause = from ? `AND wle.created_at >= '${from}'::timestamptz` : '';
    const toClause   = to   ? `AND wle.created_at <  '${to}'::timestamptz + INTERVAL '1 day'` : '';
    const divClause  = divisionCode ? `AND wle.division_code = '${divisionCode}'` : '';

    const fromHoldClause = from ? `AND wh.created_at >= '${from}'::timestamptz` : '';
    const toHoldClause   = to   ? `AND wh.created_at <  '${to}'::timestamptz + INTERVAL '1 day'` : '';

    const fromPayClause = from ? `AND ppe.created_at >= '${from}'::timestamptz` : '';
    const toPayClause   = to   ? `AND ppe.created_at <  '${to}'::timestamptz + INTERVAL '1 day'` : '';
    const divPayClause  = divisionCode ? `AND ppe.division_code = '${divisionCode}'` : '';

    // ── 1. Collected (wallet debits for services) ──────────────────────────────
    const collectedRow: any = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(amount_cents), 0) AS collected
      FROM wallet_ledger_entries wle
      WHERE wle.direction = 'debit'
        AND wle.event_type IN ${COLLECTED_EVENTS}
        ${fromClause} ${toClause} ${divClause}
    `));
    const collected = Number((collectedRow?.rows ?? collectedRow ?? [])[0]?.collected ?? 0);

    // ── 2. Pending holds (active holds created in period) ────────────────────
    const holdsRow: any = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(wh.amount_cents), 0) AS pending_holds
      FROM wallet_holds wh
      WHERE wh.status = 'active'
        ${fromHoldClause} ${toHoldClause}
    `));
    const pendingHolds = Number((holdsRow?.rows ?? holdsRow ?? [])[0]?.pending_holds ?? 0);

    // ── 3. Provider payable (earned + held payout entries in period) ──────────
    const payableRow: any = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(ppe.net_cents), 0) AS payable
      FROM provider_payout_entries ppe
      WHERE ppe.status IN ('earned', 'held')
        ${fromPayClause} ${toPayClause} ${divPayClause}
    `));
    const providerPayable = Number((payableRow?.rows ?? payableRow ?? [])[0]?.payable ?? 0);

    // ── 4. Derived metrics ────────────────────────────────────────────────────
    const vatLiability   = Math.floor(collected * VAT_RATE);
    const margin         = collected - providerPayable - vatLiability;
    const marginPct      = collected > 0 ? (margin / collected) * 100 : 0;

    // ── 5. By-division breakdown ───────────────────────────────────────────────
    const byDivisionRaw: any = await db.execute(sql.raw(`
      SELECT
        COALESCE(wle.division_code, 'unknown')            AS division_code,
        COALESCE(SUM(wle.amount_cents), 0)               AS collected
      FROM wallet_ledger_entries wle
      WHERE wle.direction = 'debit'
        AND wle.event_type IN ${COLLECTED_EVENTS}
        ${fromClause} ${toClause}
      GROUP BY wle.division_code
      ORDER BY collected DESC
    `));

    const payableByDivRaw: any = await db.execute(sql.raw(`
      SELECT
        COALESCE(ppe.division_code, 'unknown')            AS division_code,
        COALESCE(SUM(ppe.net_cents), 0)                  AS payable
      FROM provider_payout_entries ppe
      WHERE ppe.status IN ('earned', 'held')
        ${fromPayClause} ${toPayClause}
      GROUP BY ppe.division_code
    `));

    const divRows   = byDivisionRaw?.rows   ?? byDivisionRaw   ?? [];
    const payDivMap = new Map<string, number>();
    for (const pr of (payableByDivRaw?.rows ?? payableByDivRaw ?? [])) {
      payDivMap.set(pr.division_code, Number(pr.payable ?? 0));
    }

    const byDivision = divRows.map((row: any) => {
      const divCollected   = Number(row.collected ?? 0);
      const divPayable     = payDivMap.get(row.division_code) ?? 0;
      const divVat         = Math.floor(divCollected * VAT_RATE);
      const divMargin      = divCollected - divPayable - divVat;
      const divMarginPct   = divCollected > 0 ? (divMargin / divCollected) * 100 : 0;
      return {
        divisionCode:     row.division_code,
        collected:        divCollected,
        providerPayable:  divPayable,
        vatLiability:     divVat,
        margin:           divMargin,
        marginPct:        parseFloat(divMarginPct.toFixed(2)),
      };
    });

    return res.json({
      ok: true,
      period: { from: from ?? null, to: to ?? null, divisionCode: divisionCode ?? null },
      summary: {
        collected,
        pendingHolds,
        providerPayable,
        vatLiability,
        margin,
        marginPct: parseFloat(marginPct.toFixed(2)),
      },
      byDivision,
    });
  } catch (err: any) {
    logger.error('[Settlement] summary error', { error: err.message });
    return res.status(500).json({ error: 'Settlement summary failed', detail: err.message });
  }
});

// GET /api/prestige-pass/admin/wallet/settlement-summary/export
// Returns CSV with same query logic — one header row + summary row + per-division rows
router.get('/admin/wallet/settlement-summary/export', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const from         = req.query.from         as string | undefined;
    const to           = req.query.to           as string | undefined;
    const divisionCode = req.query.divisionCode as string | undefined;

    // Reuse the summary endpoint logic by making an internal call
    // Build same queries inline
    const fromClause = from ? `AND wle.created_at >= '${from}'::timestamptz` : '';
    const toClause   = to   ? `AND wle.created_at <  '${to}'::timestamptz + INTERVAL '1 day'` : '';
    const divClause  = divisionCode ? `AND wle.division_code = '${divisionCode}'` : '';
    const fromPayClause = from ? `AND ppe.created_at >= '${from}'::timestamptz` : '';
    const toPayClause   = to   ? `AND ppe.created_at <  '${to}'::timestamptz + INTERVAL '1 day'` : '';

    const collectedRow: any = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(amount_cents), 0) AS collected
      FROM wallet_ledger_entries wle
      WHERE wle.direction = 'debit' AND wle.event_type IN ${COLLECTED_EVENTS}
        ${fromClause} ${toClause} ${divClause}
    `));
    const collected = Number((collectedRow?.rows ?? collectedRow ?? [])[0]?.collected ?? 0);

    const holdsRow: any = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(amount_cents), 0) AS pending_holds
      FROM wallet_holds WHERE status = 'active'
      ${from ? `AND created_at >= '${from}'::timestamptz` : ''}
      ${to   ? `AND created_at <  '${to}'::timestamptz + INTERVAL '1 day'` : ''}
    `));
    const pendingHolds = Number((holdsRow?.rows ?? holdsRow ?? [])[0]?.pending_holds ?? 0);

    const payableRow: any = await db.execute(sql.raw(`
      SELECT COALESCE(SUM(net_cents), 0) AS payable
      FROM provider_payout_entries ppe
      WHERE ppe.status IN ('earned','held')
        ${fromPayClause} ${toPayClause}
        ${divisionCode ? `AND ppe.division_code = '${divisionCode}'` : ''}
    `));
    const providerPayable = Number((payableRow?.rows ?? payableRow ?? [])[0]?.payable ?? 0);

    const vatLiability = Math.floor(collected * VAT_RATE);
    const margin       = collected - providerPayable - vatLiability;
    const marginPct    = collected > 0 ? (margin / collected) * 100 : 0;

    const byDivisionRaw: any = await db.execute(sql.raw(`
      SELECT COALESCE(wle.division_code, 'unknown') AS division_code,
             COALESCE(SUM(wle.amount_cents), 0)    AS collected
      FROM wallet_ledger_entries wle
      WHERE wle.direction = 'debit' AND wle.event_type IN ${COLLECTED_EVENTS}
        ${fromClause} ${toClause}
      GROUP BY wle.division_code ORDER BY collected DESC
    `));

    const payableByDivRaw: any = await db.execute(sql.raw(`
      SELECT COALESCE(ppe.division_code, 'unknown') AS division_code,
             COALESCE(SUM(ppe.net_cents), 0)       AS payable
      FROM provider_payout_entries ppe
      WHERE ppe.status IN ('earned','held')
        ${fromPayClause} ${toPayClause}
      GROUP BY ppe.division_code
    `));

    const divRows   = byDivisionRaw?.rows ?? byDivisionRaw ?? [];
    const payDivMap = new Map<string, number>();
    for (const pr of (payableByDivRaw?.rows ?? payableByDivRaw ?? [])) {
      payDivMap.set(pr.division_code, Number(pr.payable ?? 0));
    }

    const fmtILS = (cents: number) => (cents / 100).toFixed(2);

    const lines: string[] = [
      'PetWash Settlement Summary Export',
      `Period:,"${from ?? 'all'} – ${to ?? 'all'}"`,
      `Division Filter:,"${divisionCode ?? 'all'}"`,
      `Generated:,"${new Date().toISOString()}"`,
      '',
      'SUMMARY',
      'Metric,Amount (ILS)',
      `Collected (gross revenue),${fmtILS(collected)}`,
      `Pending Holds (active),${fmtILS(pendingHolds)}`,
      `Provider Payable (earned+held),${fmtILS(providerPayable)}`,
      `VAT Liability (18%),${fmtILS(vatLiability)}`,
      `Platform Margin,${fmtILS(margin)}`,
      `Margin %,${marginPct.toFixed(2)}%`,
      '',
      'BY DIVISION',
      'Division,Collected (ILS),Provider Payable (ILS),VAT Liability (ILS),Margin (ILS),Margin %',
    ];

    for (const row of divRows) {
      const divCollected  = Number(row.collected ?? 0);
      const divPayable    = payDivMap.get(row.division_code) ?? 0;
      const divVat        = Math.floor(divCollected * VAT_RATE);
      const divMargin     = divCollected - divPayable - divVat;
      const divMarginPct  = divCollected > 0 ? (divMargin / divCollected) * 100 : 0;
      lines.push(
        `"${row.division_code}",${fmtILS(divCollected)},${fmtILS(divPayable)},${fmtILS(divVat)},${fmtILS(divMargin)},${divMarginPct.toFixed(2)}%`
      );
    }

    const csv = lines.join('\n');
    const filename = `settlement_${from ?? 'all'}_${to ?? 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('\uFEFF' + csv); // BOM for Hebrew Excel compatibility
  } catch (err: any) {
    logger.error('[Settlement] export error', { error: err.message });
    return res.status(500).json({ error: 'Settlement export failed', detail: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2.9C — Dispute Case Workflow
//
// Rules (locked):
//   • case_ref = `DSP-${nanoid(10)}`, server-generated only
//   • notes is append-only JSONB array [{authorUid, authorName, text, createdAt}]
//   • resolved_at is set ONLY by the resolve endpoint
//   • 2.9C1: no money movement; resolve records intent only
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/prestige-pass/admin/wallet/disputes  — open a new case
router.post('/admin/wallet/disputes', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const uid = session.user.uid as string;

    const schema = z.object({
      bookingId:           z.string().optional(),
      complainantUid:      z.string().min(1),
      complainantType:     z.enum(['customer', 'provider']).default('customer'),
      divisionCode:        z.string().optional(),
      amountDisputedCents: z.number().int().min(0).default(0),
      openingNote:         z.string().min(1),
      metadata:            z.record(z.any()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    const { bookingId, complainantUid, complainantType, divisionCode, amountDisputedCents, openingNote, metadata } = parsed.data;

    const { nanoid } = await import('nanoid');
    const caseRef = `DSP-${nanoid(10)}`;
    const now     = new Date().toISOString();
    const firstNote = JSON.stringify([{ authorUid: uid, authorName: 'Admin', text: openingNote, createdAt: now }]);

    const inserted: any = await db.execute(sql`
      INSERT INTO dispute_cases
        (case_ref, booking_id, complainant_uid, complainant_type, division_code,
         amount_disputed_cents, status, notes, metadata, opened_at, updated_at)
      VALUES (
        ${caseRef},
        ${bookingId ?? null},
        ${complainantUid},
        ${complainantType},
        ${divisionCode ?? null},
        ${amountDisputedCents},
        'open',
        ${firstNote}::jsonb,
        ${JSON.stringify(metadata ?? {})}::jsonb,
        NOW(),
        NOW()
      )
      RETURNING *
    `);
    const row = (inserted?.rows ?? inserted ?? [])[0];
    logger.info('[Dispute][Open]', { caseRef, openedBy: uid, complainantUid });
    return res.status(201).json({ ok: true, dispute: row });
  } catch (err: any) {
    logger.error('[Dispute][Open] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to open dispute', detail: err.message });
  }
});

// GET /api/prestige-pass/admin/wallet/disputes  — list with filters
// ?status= &divisionCode= &assignedAdminUid= &bookingId= &complainantUid= &limit= &offset=
router.get('/admin/wallet/disputes', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const status           = req.query.status           as string | undefined;
    const divisionCode     = req.query.divisionCode     as string | undefined;
    const assignedAdminUid = req.query.assignedAdminUid as string | undefined;
    const bookingId        = req.query.bookingId        as string | undefined;
    const complainantUid   = req.query.complainantUid   as string | undefined;
    const limit            = Math.min(Number(req.query.limit  ?? 50), 200);
    const offset           = Math.max(Number(req.query.offset ?? 0),  0);

    const conditions: string[] = [];
    if (status)           conditions.push(`status = '${status}'`);
    if (divisionCode)     conditions.push(`division_code = '${divisionCode}'`);
    if (assignedAdminUid) conditions.push(`assigned_admin_uid = '${assignedAdminUid}'`);
    if (bookingId)        conditions.push(`booking_id = '${bookingId}'`);
    if (complainantUid)   conditions.push(`complainant_uid = '${complainantUid}'`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows: any = await db.execute(sql.raw(`
      SELECT * FROM dispute_cases
      ${where}
      ORDER BY opened_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `));

    const totalRow: any = await db.execute(sql.raw(`
      SELECT COUNT(*) AS cnt FROM dispute_cases ${where}
    `));
    const total = Number((totalRow?.rows ?? totalRow ?? [])[0]?.cnt ?? 0);

    return res.json({
      ok: true,
      total,
      limit,
      offset,
      disputes: rows?.rows ?? rows ?? [],
    });
  } catch (err: any) {
    logger.error('[Dispute][List] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to list disputes', detail: err.message });
  }
});

// PATCH /api/prestige-pass/admin/wallet/disputes/:caseRef
// Allows: status change (NOT resolved), assignment, note append
router.patch('/admin/wallet/disputes/:caseRef', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const uid      = session.user.uid as string;
    const { caseRef } = req.params;

    const schema = z.object({
      status:           z.enum(['open', 'investigating', 'escalated']).optional(),
      assignedAdminUid: z.string().optional().nullable(),
      note:             z.string().min(1).optional(),
      authorName:       z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    const { status, assignedAdminUid, note, authorName } = parsed.data;

    // Fetch existing case first
    const existing: any = await db.execute(sql.raw(
      `SELECT * FROM dispute_cases WHERE case_ref = '${caseRef}' LIMIT 1`
    ));
    const row = (existing?.rows ?? existing ?? [])[0];
    if (!row) return res.status(404).json({ error: 'Dispute not found', caseRef });
    if (row.status === 'resolved' || row.status === 'dismissed') {
      return res.status(400).json({ error: `Cannot patch a ${row.status} dispute. Use the resolve endpoint.` });
    }

    const setParts: string[] = [`updated_at = NOW()`];
    if (status)                              setParts.push(`status = '${status}'`);
    if (assignedAdminUid !== undefined)      setParts.push(`assigned_admin_uid = ${assignedAdminUid ? `'${assignedAdminUid}'` : 'NULL'}`);
    if (note) {
      const newNote = { authorUid: uid, authorName: authorName ?? 'Admin', text: note, createdAt: new Date().toISOString() };
      setParts.push(`notes = notes || '${JSON.stringify([newNote])}'::jsonb`);
    }

    const updated: any = await db.execute(sql.raw(`
      UPDATE dispute_cases SET ${setParts.join(', ')}
      WHERE case_ref = '${caseRef}'
      RETURNING *
    `));
    const updatedRow = (updated?.rows ?? updated ?? [])[0];
    logger.info('[Dispute][Patch]', { caseRef, byAdmin: uid, status, assignedAdminUid, hasNote: !!note });
    return res.json({ ok: true, dispute: updatedRow });
  } catch (err: any) {
    logger.error('[Dispute][Patch] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update dispute', detail: err.message });
  }
});

// POST /api/prestige-pass/admin/wallet/disputes/:caseRef/resolve
// The ONLY path to set resolved_at.  2.9C1: records intent, no money movement.
router.post('/admin/wallet/disputes/:caseRef/resolve', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const uid      = session.user.uid as string;
    const { caseRef } = req.params;

    const schema = z.object({
      resolutionType:  z.enum(['full_refund', 'partial_refund', 'no_action', 'goodwill_credit', 'dismissed']),
      resolutionCents: z.number().int().min(0).default(0),
      note:            z.string().min(1),
      authorName:      z.string().optional(),
      finalStatus:     z.enum(['resolved', 'dismissed']).default('resolved'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    const { resolutionType, resolutionCents, note, authorName, finalStatus } = parsed.data;

    // Guard: can't resolve something already closed
    const existing: any = await db.execute(sql.raw(
      `SELECT * FROM dispute_cases WHERE case_ref = '${caseRef}' LIMIT 1`
    ));
    const row = (existing?.rows ?? existing ?? [])[0];
    if (!row) return res.status(404).json({ error: 'Dispute not found', caseRef });
    if (row.status === 'resolved' || row.status === 'dismissed') {
      return res.status(400).json({ error: `Dispute already ${row.status}`, caseRef });
    }

    const resolutionNote = {
      authorUid:  uid,
      authorName: authorName ?? 'Admin',
      text:       `[RESOLVE: ${resolutionType}] ${note}`,
      createdAt:  new Date().toISOString(),
    };

    const updated: any = await db.execute(sql.raw(`
      UPDATE dispute_cases SET
        status           = '${finalStatus}',
        resolution_type  = '${resolutionType}',
        resolution_cents = ${resolutionCents},
        resolved_at      = NOW(),
        updated_at       = NOW(),
        notes            = notes || '${JSON.stringify([resolutionNote])}'::jsonb
      WHERE case_ref = '${caseRef}'
      RETURNING *
    `));
    const updatedRow = (updated?.rows ?? updated ?? [])[0];
    logger.info('[Dispute][Resolve]', { caseRef, byAdmin: uid, resolutionType, resolutionCents, finalStatus });
    return res.json({ ok: true, dispute: updatedRow });
  } catch (err: any) {
    logger.error('[Dispute][Resolve] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to resolve dispute', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3.0C — DISPUTE TO FINANCIAL ACTIONS BRIDGE
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /admin/wallet/disputes/:caseRef/apply-resolution ─────────────────
// Routes resolved dispute to a financial outcome.
// refund   → submits to refund approvals flow (2.9D). Leaves audit trail.
// clawback → creates a new negative payout_entry (does NOT mutate original row).
// none     → records decision with no financial action.
// Rules: original payout entries are NEVER mutated. Every resolution creates new records.
router.post('/admin/wallet/disputes/:caseRef/apply-resolution', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';
    const { caseRef } = req.params;

    const schema = z.object({
      action:             z.enum(['refund', 'clawback', 'none']),
      linkedPayoutBatchId:z.string().optional(),
      // refund fields
      refundAmountCents:  z.number().int().positive().optional(),
      refundBookingId:    z.string().optional(),
      refundNote:         z.string().optional(),
      // clawback fields
      clawbackCents:      z.number().int().positive().optional(),
      clawbackProviderUid:z.string().optional(),
      clawbackDivision:   z.string().optional(),
      clawbackNote:       z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const { action, linkedPayoutBatchId, refundAmountCents, refundBookingId, refundNote, clawbackCents, clawbackProviderUid, clawbackDivision, clawbackNote } = parsed.data;

    // Load the dispute case
    const caseRows: any = await db.execute(sql`
      SELECT * FROM dispute_cases WHERE case_ref=${caseRef} LIMIT 1
    `);
    const dispCase = (caseRows?.rows ?? caseRows ?? [])[0];
    if (!dispCase) return res.status(404).json({ error: 'Dispute case not found', caseRef });

    if (dispCase.resolution_action && dispCase.resolution_action !== 'none') {
      return res.status(409).json({ error: 'Resolution already applied', current: dispCase.resolution_action, caseRef });
    }

    let result: Record<string, any> = { action, caseRef };

    if (action === 'refund') {
      if (!refundAmountCents || !refundBookingId) {
        return res.status(422).json({ error: 'refundAmountCents and refundBookingId are required for refund action' });
      }
      // Route through 2.9D refund approvals
      const refundRes = await fetch(`http://localhost:${process.env.PORT ?? 5000}/api/prestige-pass/admin/wallet/refund-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: req.headers.cookie ?? '' },
        body: JSON.stringify({
          bookingId: refundBookingId,
          amountCents: refundAmountCents,
          reason: `Dispute resolution — ${caseRef}${refundNote ? ' — ' + refundNote : ''}`,
          linkedDisputeCaseRef: caseRef,
        }),
      });
      const refundData = await refundRes.json();
      if (!refundData.ok && !refundData.refundRequestId) {
        return res.status(502).json({ error: 'Refund request failed', detail: refundData });
      }
      result.refundRequestId = refundData.refundRequestId;
      result.refundStatus    = refundData.status;
    } else if (action === 'clawback') {
      if (!clawbackCents || !clawbackProviderUid) {
        return res.status(422).json({ error: 'clawbackCents and clawbackProviderUid are required for clawback action' });
      }
      // Create a new NEGATIVE payout entry (offset). Never touches original row.
      const clawbackId = `clawback_${nanoid(12)}`;
      await db.execute(sql`
        INSERT INTO provider_payout_entries
          (provider_uid, division_code, booking_id, gross_cents, commission_rate_bps, net_cents, status, metadata)
        VALUES (
          ${clawbackProviderUid},
          ${clawbackDivision ?? dispCase.division_code ?? 'unknown'},
          ${dispCase.booking_id ?? null},
          ${-Math.abs(clawbackCents)},
          0,
          ${-Math.abs(clawbackCents)},
          'clawed_back',
          ${JSON.stringify({ disputeCaseRef: caseRef, clawbackId, initiatedBy: adminUid, note: clawbackNote ?? null, linkedPayoutBatchId: linkedPayoutBatchId ?? null })}::jsonb
        )
      `);
      result.clawbackId     = clawbackId;
      result.clawbackCents  = -Math.abs(clawbackCents);
    }

    // Write resolution_action + linked_payout_batch_id back to dispute case
    await db.execute(sql`
      UPDATE dispute_cases
      SET resolution_action       = ${action},
          linked_payout_batch_id  = ${linkedPayoutBatchId ?? null},
          metadata = COALESCE(metadata,'{}')::jsonb || ${JSON.stringify({
            resolutionApplied: { action, adminUid, appliedAt: new Date().toISOString(), linkedPayoutBatchId, ...result }
          })}::jsonb
      WHERE case_ref = ${caseRef}
    `);

    logger.info('[3.0C][ApplyResolution]', { caseRef, action, adminUid, ...result });
    await recordFinanceAction(adminUid, `dispute_resolution_${action}`, 'dispute_case', caseRef,
      { status: dispCase.status, resolution_action: null },
      { resolution_action: action, linkedPayoutBatchId, ...result },
      req.ip);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.error('[3.0C][ApplyResolution] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to apply dispute resolution', detail: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2.9D — Refund Approval Thresholds
//
// Rules (locked):
//   • REFUND_AUTO_APPROVE_LIMIT_CENTS env, default 5000
//   • Always write refund_approvals row first, then branch
//   • auto_approved  → execute immediately (reuses fetchSupportBooking + refundToWallet)
//   • pending        → no wallet mutation; wait for second approver
//   • second approver cannot be the requester (403 self-approve guard)
//   • approve is the ONLY path that executes money movement for pending rows
//   • reject NEVER mutates wallet state
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_APPROVE_LIMIT = () =>
  Number(process.env.REFUND_AUTO_APPROVE_LIMIT_CENTS ?? 5000);

// ── internal helper: execute support refund using existing fetchSupportBooking
// Mirrors support/issue-refund handler logic. Called by both auto-approve and second-approve paths.
async function executeApprovalRefund(opts: {
  bookingId:    string;
  bookingType:  'marketplace' | 'academy';
  amountCents:  number;
  reason:       string;
  adminUid:     string;
  approvalId:   string;
  ip?:          string;
}): Promise<{ ok: boolean; actionTaken: string; amountCents: number; txnId: string }> {
  const { bookingId, bookingType, amountCents, reason, adminUid, approvalId, ip } = opts;

  const found = await fetchSupportBooking(bookingId, bookingType);
  if (!found) throw new Error(`Booking not found: ${bookingId} (${bookingType})`);
  const { booking, sourceTable } = found;

  const supportMeta = {
    adminId: adminUid, reason,
    source: 'refund_approval', approvalId, bookingType,
  };

  // Hold-active: degrade to release
  if (booking.finance_state === 'hold_active') {
    const holdCents = Number(booking.wallet_hold_cents);
    if (holdCents <= 0) throw new Error('No hold amount to release');

    const { walletService } = await import('../services/WalletService');
    const result = await walletService.releaseBookingHold({
      userId:               booking.user_id,
      amountCents:          holdCents,
      bookingId:            booking.booking_id,
      divisionCode:         booking.division_code ?? 'general',
      ipAddress:            ip,
      idempotencyKeySuffix: `approval:${approvalId}:release`,
      metadata:             { ...supportMeta, actorSource: 'admin_release', degradedToRelease: true },
    });

    if (sourceTable === 'booking_requests') {
      await db.execute(sql`
        UPDATE booking_requests
        SET finance_state='released', wallet_release_key=${result.txnId}, updated_at=NOW()
        WHERE request_id=${booking.booking_id}
      `);
    } else {
      await db.execute(sql`
        UPDATE trainer_bookings
        SET finance_state='released', wallet_release_key=${result.txnId}, updated_at=NOW()
        WHERE booking_id=${booking.booking_id}
      `);
    }
    return { ok: true, actionTaken: 'release', amountCents: holdCents, txnId: result.txnId };
  }

  // Standard refund path: finance_state must be debited
  if (booking.finance_state !== 'debited') {
    throw new Error(`Cannot refund: finance_state is '${booking.finance_state}'. Expected 'debited' or 'hold_active'.`);
  }

  const debitedCents    = Number(booking.wallet_debited_cents);
  const alreadyRefunded = Number(booking.wallet_refunded_cents ?? 0);
  const maxRefundable   = debitedCents - alreadyRefunded;
  if (maxRefundable <= 0) throw new Error('Nothing left to refund');

  const refundCents = amountCents > 0 ? Math.min(amountCents, maxRefundable) : maxRefundable;
  const idempotencyKey = `wallet:approval:refund:${bookingType}:${booking.booking_id}:${approvalId}`;
  const { refundToWallet } = await import('../services/WalletLedger');
  const result = await refundToWallet({
    userId:         booking.user_id,
    amountCents:    refundCents,
    divisionCode:   booking.division_code ?? 'general',
    sourceType:     'booking',
    sourceId:       booking.booking_id,
    idempotencyKey,
    reason:         reason ?? 'approval_refund',
    ipAddress:      ip,
    metadata:       { ...supportMeta, actorSource: 'admin_refund' },
  });

  const newRefunded = alreadyRefunded + refundCents;
  const newState    = newRefunded >= debitedCents ? 'refunded' : 'debited';

  if (sourceTable === 'booking_requests') {
    await db.execute(sql`
      UPDATE booking_requests
      SET finance_state=${newState}, wallet_refunded_cents=${newRefunded},
          wallet_refund_key=${result.txnId}, updated_at=NOW()
      WHERE request_id=${booking.booking_id}
    `);
  } else {
    await db.execute(sql`
      UPDATE trainer_bookings
      SET finance_state=${newState}, wallet_refunded_cents=${newRefunded},
          wallet_refund_key=${result.txnId}, updated_at=NOW()
      WHERE booking_id=${booking.booking_id}
    `);
  }

  return { ok: true, actionTaken: 'refund', amountCents: refundCents, txnId: result.txnId };
}

// POST /api/prestige-pass/admin/wallet/refund-requests
// Entry point for all support refunds. Routes through approval threshold.
router.post('/admin/wallet/refund-requests', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const requestedByUid = session.user.uid as string;

    const schema = z.object({
      bookingId:            z.string().min(1),
      bookingType:          z.enum(['marketplace', 'academy']),
      amountCents:          z.number().int().min(0),
      reason:               z.string().min(5),
      linkedDisputeCaseRef: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    const { bookingId, bookingType, amountCents, reason, linkedDisputeCaseRef } = parsed.data;

    const { nanoid } = await import('nanoid');
    const refundRequestId = `RRA-${nanoid(12)}`;
    const limit           = AUTO_APPROVE_LIMIT();
    const autoApprove     = amountCents <= limit;

    // ── 1. Always write the row first ─────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO refund_approvals
        (refund_request_id, requested_by_uid, amount_cents, reason, status,
         booking_id, booking_type, linked_dispute_case_ref, created_at)
      VALUES (
        ${refundRequestId}, ${requestedByUid}, ${amountCents}, ${reason},
        ${autoApprove ? 'auto_approved' : 'pending'},
        ${bookingId}, ${bookingType},
        ${linkedDisputeCaseRef ?? null},
        NOW()
      )
    `);

    // ── 2. Branch: auto-approve executes immediately ──────────────────────────
    if (autoApprove) {
      try {
        const refundResult = await executeApprovalRefund({
          bookingId, bookingType, amountCents, reason,
          adminUid: requestedByUid, approvalId: refundRequestId, ip: req.ip,
        });

        await db.execute(sql`
          UPDATE refund_approvals
          SET status='auto_approved', reviewed_by_uid=${requestedByUid}, reviewed_at=NOW()
          WHERE refund_request_id=${refundRequestId}
        `);

        logger.info('[RefundApproval][AutoApproved]', { refundRequestId, amountCents, bookingId, actionTaken: refundResult.actionTaken });
        return res.status(201).json({
          ok: true,
          autoApproved: true,
          status:       'auto_approved',
          approvalId:   refundRequestId,
          limitCents:   limit,
          refund:       refundResult,
        });
      } catch (execErr: any) {
        await db.execute(sql`
          UPDATE refund_approvals SET status='failed', reviewed_at=NOW()
          WHERE refund_request_id=${refundRequestId}
        `);
        logger.error('[RefundApproval][AutoApprove][ExecFail]', { refundRequestId, error: execErr.message });
        return res.status(502).json({ error: 'Auto-approve execution failed', detail: execErr.message, approvalId: refundRequestId });
      }
    }

    // ── 3. Over threshold — leave pending ────────────────────────────────────
    logger.info('[RefundApproval][Pending]', { refundRequestId, amountCents, limit, bookingId });
    return res.status(201).json({
      ok:           true,
      autoApproved: false,
      status:       'pending',
      approvalId:   refundRequestId,
      limitCents:   limit,
      message:      `Amount ₪${(amountCents / 100).toFixed(2)} exceeds auto-approve threshold ₪${(limit / 100).toFixed(2)}. Pending second approver.`,
    });
  } catch (err: any) {
    logger.error('[RefundApproval][Create] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to create refund request', detail: err.message });
  }
});

// GET /api/prestige-pass/admin/wallet/refund-requests/pending
// Returns all pending rows for the approval queue UI
router.get('/admin/wallet/refund-requests/pending', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const rows: any = await db.execute(sql`
      SELECT * FROM refund_approvals
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `);
    const list = rows?.rows ?? rows ?? [];

    return res.json({ ok: true, pending: list, count: list.length });
  } catch (err: any) {
    logger.error('[RefundApproval][Pending] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch pending approvals', detail: err.message });
  }
});

// POST /api/prestige-pass/admin/wallet/refund-requests/:id/approve
// Second-approver path. Executes money movement. Cannot be the original requester.
router.post('/admin/wallet/refund-requests/:id/approve', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const reviewerUid     = session.user.uid as string;
    const refundRequestId = req.params.id;

    const existing: any = await db.execute(sql`
      SELECT * FROM refund_approvals WHERE refund_request_id = ${refundRequestId} LIMIT 1
    `);
    const row = (existing?.rows ?? existing ?? [])[0];
    if (!row) return res.status(404).json({ error: 'Refund request not found', refundRequestId });
    if (row.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve a ${row.status} request`, refundRequestId });
    }

    // Self-approve guard (locked rule)
    if (row.requested_by_uid === reviewerUid) {
      return res.status(403).json({ error: 'Second approver cannot be the original requester', refundRequestId });
    }

    // Execute wallet refund using the same internal helper
    let refundResult: any;
    try {
      refundResult = await executeApprovalRefund({
        bookingId:   row.booking_id   ?? '',
        bookingType: (row.booking_type ?? 'marketplace') as 'marketplace' | 'academy',
        amountCents: row.amount_cents,
        reason:      row.reason,
        adminUid:    reviewerUid,
        approvalId:  refundRequestId,
        ip:          req.ip,
      });
    } catch (execErr: any) {
      logger.error('[RefundApproval][Approve][ExecFail]', { refundRequestId, error: execErr.message });
      return res.status(502).json({ error: 'Refund execution failed', detail: execErr.message });
    }

    await db.execute(sql`
      UPDATE refund_approvals
      SET status='approved', reviewed_by_uid=${reviewerUid}, reviewed_at=NOW()
      WHERE refund_request_id=${refundRequestId}
    `);

    logger.info('[RefundApproval][Approved]', { refundRequestId, reviewerUid, amountCents: row.amount_cents });
    return res.json({ ok: true, status: 'approved', refundRequestId, refund: refundResult });
  } catch (err: any) {
    logger.error('[RefundApproval][Approve] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to approve refund request', detail: err.message });
  }
});

// POST /api/prestige-pass/admin/wallet/refund-requests/:id/reject
// Reject a pending refund. NEVER mutates wallet state.
router.post('/admin/wallet/refund-requests/:id/reject', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const reviewerUid     = session.user.uid as string;
    const refundRequestId = req.params.id;

    const schema = z.object({ rejectReason: z.string().min(1).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });

    const existing: any = await db.execute(sql`
      SELECT * FROM refund_approvals WHERE refund_request_id = ${refundRequestId} LIMIT 1
    `);
    const row = (existing?.rows ?? existing ?? [])[0];
    if (!row) return res.status(404).json({ error: 'Refund request not found', refundRequestId });
    if (row.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject a ${row.status} request`, refundRequestId });
    }

    // Reject — ZERO wallet mutations
    await db.execute(sql`
      UPDATE refund_approvals
      SET status='rejected', reviewed_by_uid=${reviewerUid}, reviewed_at=NOW()
      WHERE refund_request_id=${refundRequestId}
    `);

    logger.info('[RefundApproval][Rejected]', { refundRequestId, reviewerUid });
    return res.json({ ok: true, status: 'rejected', refundRequestId });
  } catch (err: any) {
    logger.error('[RefundApproval][Reject] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to reject refund request', detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3.0A — PAYOUT BATCH ENGINE
// ═══════════════════════════════════════════════════════════════════════════

// ── POST /admin/wallet/payout-batches/create ─────────────────────────────
// Validates entries → generates batch_id → marks entries paid → writes
// payout_batches row → returns batch summary.
router.post('/admin/wallet/payout-batches/create', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';

    const schema = z.object({
      entryIds: z.array(z.number().int().positive()).min(1, 'At least one entry required'),
      notes:    z.string().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten() });
    const { entryIds, notes } = parsed.data;

    // Load and validate entries
    const existing: any = await db.execute(sql`
      SELECT id, status, provider_uid, net_cents, gross_cents
      FROM provider_payout_entries
      WHERE id = ANY(${sql`ARRAY[${sql.join(entryIds.map(id => sql`${id}`), sql`, `)}]::int[]`})
    `);
    const rows = existing?.rows ?? existing ?? [];

    const notFound  = entryIds.filter(id => !rows.find((r: any) => Number(r.id) === id));
    if (notFound.length > 0) return res.status(404).json({ error: 'Entry IDs not found', notFound });

    const eligible  = rows.filter((r: any) => r.status === 'earned' || r.status === 'held');
    const skipped   = rows.filter((r: any) => r.status === 'paid').map((r: any) => Number(r.id));
    const alreadyPaid = rows.filter((r: any) => r.status !== 'earned' && r.status !== 'held' && r.status !== 'paid');
    if (alreadyPaid.length > 0) {
      return res.status(422).json({ error: 'Some entries are ineligible (not earned/held/paid)', ineligible: alreadyPaid.map((r: any) => ({ id: r.id, status: r.status })) });
    }

    // Idempotency: if all entries already paid under same batch, return that batch
    if (eligible.length === 0 && skipped.length > 0) {
      const existBatch: any = await db.execute(sql`
        SELECT payout_batch_id FROM provider_payout_entries
        WHERE id = ANY(${sql`ARRAY[${sql.join(skipped.map(id => sql`${id}`), sql`, `)}]::int[]`})
          AND payout_batch_id IS NOT NULL LIMIT 1
      `);
      const existBatchId = (existBatch?.rows ?? existBatch ?? [])[0]?.payout_batch_id;
      if (existBatchId) {
        const pb: any = await db.execute(sql`SELECT * FROM payout_batches WHERE batch_id=${existBatchId} LIMIT 1`);
        const pbRow = (pb?.rows ?? pb ?? [])[0];
        return res.json({ ok: true, idempotent: true, batchId: existBatchId, batch: pbRow ?? null, skippedIds: skipped, updatedIds: [] });
      }
    }

    const batchId = `batch_${nanoid(16)}`;
    const now = new Date();

    if (eligible.length > 0) {
      const eligibleIds = eligible.map((r: any) => Number(r.id));
      await db.execute(sql`
        UPDATE provider_payout_entries
        SET status='paid', payout_batch_id=${batchId}, paid_at=${now},
            metadata = COALESCE(metadata,'{}')::jsonb || ${JSON.stringify({ markedPaidBy: adminUid, batchId, notes })}::jsonb
        WHERE id = ANY(${sql`ARRAY[${sql.join(eligibleIds.map(id => sql`${id}`), sql`, `)}]::int[]`})
          AND status IN ('earned','held')
      `);
    }

    // Compute totals
    const totRow: any = await db.execute(sql`
      SELECT COUNT(DISTINCT provider_uid) AS providers,
             COALESCE(SUM(net_cents),0)   AS net,
             COALESCE(SUM(gross_cents),0) AS gross
      FROM provider_payout_entries WHERE payout_batch_id=${batchId}
    `);
    const t = (totRow?.rows ?? totRow ?? [])[0] ?? {};
    const totalProviders = Number(t.providers ?? 0);
    const totalNetCents  = Number(t.net ?? 0);

    // Guard: net batch total must not be negative (clawback entries must be balanced separately)
    if (totalNetCents < 0) {
      return res.status(422).json({
        error: 'Net batch total cannot be negative — split or review clawback entries before creating a batch',
        totalNetCents,
        batchId,
      });
    }

    // Write payout_batches row
    const pbInsert: any = await db.execute(sql`
      INSERT INTO payout_batches (batch_id, created_by_uid, status, total_providers, total_net_cents, notes)
      VALUES (${batchId}, ${adminUid}, 'completed', ${totalProviders}, ${totalNetCents}, ${notes})
      ON CONFLICT (batch_id) DO UPDATE
        SET total_providers=${totalProviders}, total_net_cents=${totalNetCents}, status='completed'
      RETURNING *
    `);
    const batchRow = (pbInsert?.rows ?? pbInsert ?? [])[0];

    logger.info('[PayoutBatch][Created]', { batchId, adminUid, totalProviders, totalNetCents, entryCount: eligible.length });
    await recordFinanceAction(adminUid, 'payout_batch_create', 'payout_batch', batchId,
      null,
      { totalProviders, totalNetCents, entryCount: eligible.length, notes },
      req.ip);
    return res.json({
      ok: true,
      idempotent: false,
      batchId,
      batch: {
        batchId:        batchRow?.batch_id,
        status:         batchRow?.status,
        totalProviders: batchRow?.total_providers,
        totalNetCents:  batchRow?.total_net_cents,
        notes:          batchRow?.notes,
        createdAt:      batchRow?.created_at,
        createdByUid:   batchRow?.created_by_uid,
      },
      updatedIds: eligible.map((r: any) => Number(r.id)),
      skippedIds: skipped,
    });
  } catch (err: any) {
    logger.error('[PayoutBatch][Create] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to create payout batch', detail: err.message });
  }
});

// ── GET /admin/wallet/payout-batches ─────────────────────────────────────
router.get('/admin/wallet/payout-batches', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const rows: any = await db.execute(sql`
      SELECT pb.*,
             COUNT(ppe.id)                AS entry_count,
             COALESCE(SUM(ppe.gross_cents),0) AS gross_cents_sum
      FROM payout_batches pb
      LEFT JOIN provider_payout_entries ppe ON ppe.payout_batch_id = pb.batch_id
      GROUP BY pb.id
      ORDER BY pb.created_at DESC
      LIMIT 50
    `);
    const batches = (rows?.rows ?? rows ?? []).map((r: any) => ({
      id:             r.id,
      batchId:        r.batch_id,
      createdByUid:   r.created_by_uid,
      createdAt:      r.created_at,
      status:         r.status,
      totalProviders: r.total_providers,
      totalNetCents:  r.total_net_cents,
      grossCentsSum:  Number(r.gross_cents_sum ?? 0),
      entryCount:     Number(r.entry_count ?? 0),
      notes:          r.notes,
    }));
    return res.json({ ok: true, batches, total: batches.length });
  } catch (err: any) {
    logger.error('[PayoutBatch][List] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to list payout batches', detail: err.message });
  }
});

// ── GET /admin/wallet/payout-batches/:batchId ────────────────────────────
router.get('/admin/wallet/payout-batches/:batchId', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { batchId } = req.params;

    const batchRow: any = await db.execute(sql`
      SELECT * FROM payout_batches WHERE batch_id=${batchId} LIMIT 1
    `);
    const batch = (batchRow?.rows ?? batchRow ?? [])[0];

    const entriesRaw: any = await db.execute(sql`
      SELECT id, provider_uid, division_code, booking_id,
             gross_cents, commission_rate_bps, net_cents,
             status, paid_at, created_at
      FROM provider_payout_entries
      WHERE payout_batch_id=${batchId}
      ORDER BY provider_uid, created_at
    `);
    const entries = (entriesRaw?.rows ?? entriesRaw ?? []).map((r: any) => ({
      id:                 Number(r.id),
      providerUid:        r.provider_uid,
      divisionCode:       r.division_code,
      bookingId:          r.booking_id,
      grossCents:         Number(r.gross_cents ?? 0),
      commissionRateBps:  Number(r.commission_rate_bps ?? 0),
      netCents:           Number(r.net_cents ?? 0),
      status:             r.status,
      paidAt:             r.paid_at,
      createdAt:          r.created_at,
    }));

    // Group by provider
    const byProvider: Record<string, { providerUid: string; entries: any[]; grossCents: number; netCents: number }> = {};
    for (const e of entries) {
      if (!byProvider[e.providerUid]) byProvider[e.providerUid] = { providerUid: e.providerUid, entries: [], grossCents: 0, netCents: 0 };
      byProvider[e.providerUid].entries.push(e);
      byProvider[e.providerUid].grossCents += e.grossCents;
      byProvider[e.providerUid].netCents   += e.netCents;
    }

    const totals = {
      entryCount:     entries.length,
      grossCents:     entries.reduce((s, e) => s + e.grossCents, 0),
      netCents:       entries.reduce((s, e) => s + e.netCents, 0),
      providerCount:  Object.keys(byProvider).length,
    };

    return res.json({
      ok: true,
      batch: batch ? {
        batchId:        batch.batch_id,
        status:         batch.status,
        createdByUid:   batch.created_by_uid,
        createdAt:      batch.created_at,
        totalProviders: batch.total_providers,
        totalNetCents:  batch.total_net_cents,
        notes:          batch.notes,
      } : null,
      entries,
      byProvider: Object.values(byProvider),
      totals,
    });
  } catch (err: any) {
    logger.error('[PayoutBatch][Detail] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch payout batch', detail: err.message });
  }
});

// ── Payout export format serializers ─────────────────────────────────────

type PayoutEntry = {
  provider_uid:        string;
  division_code:       string;
  booking_id:          string;
  gross_cents:         number;
  commission_rate_bps: number;
  net_cents:           number;
  clawback_reason?:    string;
};

const EXPORT_FORMATS = ['csv', 'tranzilla', 'hapoalim', 'mizrahi', 'iban_csv', 'quickbooks_iif'] as const;
type ExportFormat = typeof EXPORT_FORMATS[number];

function serializePayoutEntries(entries: PayoutEntry[], batchId: string, format: ExportFormat): { body: string; contentType: string; filename: string } {
  const dateStr  = new Date().toISOString().slice(0, 10);
  const esc      = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const ils      = (cents: number) => (Number(cents) / 100).toFixed(2);

  if (format === 'tranzilla') {
    // Tranzilla: pipe-delimited, no header, UTF-8 BOM, ILS amounts
    const BOM = '\uFEFF';
    const rows = entries.map(r => [
      r.provider_uid,
      r.division_code ?? '',
      r.booking_id    ?? '',
      ils(r.gross_cents),
      ils(Number(r.gross_cents) - Number(r.net_cents)),
      ils(r.net_cents),
      'ILS',
      dateStr,
    ].join('|'));
    return { body: BOM + rows.join('\r\n'), contentType: 'text/plain; charset=utf-8', filename: `tranzilla-${batchId}-${dateStr}.txt` };
  }

  if (format === 'hapoalim') {
    // Bank Hapoalim: UTF-8 BOM CSV, Hebrew column names
    const BOM = '\uFEFF';
    const header = 'מספר_ספק,קוד_חטיבה,מזהה_הזמנה,ברוטו_ש"ח,עמלה_ש"ח,נטו_ש"ח,מטבע,תאריך';
    const rows = entries.map(r => [
      esc(r.provider_uid),
      esc(r.division_code ?? ''),
      esc(r.booking_id    ?? ''),
      ils(r.gross_cents),
      ils(Number(r.gross_cents) - Number(r.net_cents)),
      ils(r.net_cents),
      'ILS',
      dateStr,
    ].join(','));
    return { body: BOM + [header, ...rows].join('\r\n'), contentType: 'text/csv; charset=utf-8', filename: `hapoalim-${batchId}-${dateStr}.csv` };
  }

  if (format === 'mizrahi') {
    // Bank Mizrahi-Tefahot: semicolon-delimited, English headers, no BOM
    const header = 'ProviderID;DivisionCode;BookingRef;GrossAmount;CommissionAmount;NetAmount;Currency;Date';
    const rows = entries.map(r => [
      r.provider_uid,
      r.division_code ?? '',
      r.booking_id    ?? '',
      ils(r.gross_cents),
      ils(Number(r.gross_cents) - Number(r.net_cents)),
      ils(r.net_cents),
      'ILS',
      dateStr,
    ].join(';'));
    return { body: [header, ...rows].join('\r\n'), contentType: 'text/csv; charset=utf-8', filename: `mizrahi-${batchId}-${dateStr}.csv` };
  }

  if (format === 'iban_csv') {
    // SEPA-compatible IBAN CSV (international providers — provider_uid used as Name/Reference)
    const BOM = '\uFEFF';
    const header = 'Name,Reference,Amount,Currency,PaymentDate,RemittanceInfo';
    const rows = entries.map(r => [
      esc(r.provider_uid),
      esc(r.booking_id ?? ''),
      ils(r.net_cents),
      'ILS',
      dateStr,
      esc(`Batch ${batchId} | Gross ${ils(r.gross_cents)} | Comm ${ils(Number(r.gross_cents) - Number(r.net_cents))}`),
    ].join(','));
    return { body: BOM + [header, ...rows].join('\r\n'), contentType: 'text/csv; charset=utf-8', filename: `iban-${batchId}-${dateStr}.csv` };
  }

  if (format === 'quickbooks_iif') {
    // QuickBooks IIF (tab-delimited transaction blocks)
    const lines: string[] = [
      '!TRNS\tACCNT\tDATE\tAMOUNT\tNAME\tMEMO\tCLEAR',
      '!SPL\tACCNT\tDATE\tAMOUNT\tNAME\tMEMO',
      '!ENDTRNS',
    ];
    for (const r of entries) {
      const netIls  = (Number(r.net_cents)  / 100).toFixed(2);
      const commIls = ((Number(r.gross_cents) - Number(r.net_cents)) / 100).toFixed(2);
      lines.push(`TRNS\tAccounts Payable\t${dateStr}\t-${netIls}\t${r.provider_uid}\tBatch ${batchId} / Booking ${r.booking_id ?? ''}\tN`);
      lines.push(`SPL\tPayout Commission\t${dateStr}\t${commIls}\t${r.provider_uid}\tCommission`);
      lines.push('ENDTRNS');
    }
    return { body: lines.join('\r\n'), contentType: 'text/plain; charset=utf-8', filename: `qbooks-${batchId}-${dateStr}.iif` };
  }

  // Default: BOM CSV (backward-compatible)
  const BOM = '\uFEFF';
  const header = 'provider_uid,division_code,booking_id,gross_ils,commission_ils,net_ils';
  const rows = entries.map(r => [
    esc(r.provider_uid),
    esc(r.division_code ?? ''),
    esc(r.booking_id    ?? ''),
    ils(r.gross_cents),
    ils(Number(r.gross_cents) - Number(r.net_cents)),
    ils(r.net_cents),
  ].join(','));
  return { body: BOM + [header, ...rows].join('\r\n'), contentType: 'text/csv; charset=utf-8', filename: `payout-batch-${batchId}.csv` };
}

// ── GET /admin/wallet/payout-batches/:batchId/export ─────────────────────
// Multi-format: ?format=csv|tranzilla|hapoalim|mizrahi|iban_csv|quickbooks_iif (default: csv)
router.get('/admin/wallet/payout-batches/:batchId/export', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { batchId } = req.params;
    const format: ExportFormat = EXPORT_FORMATS.includes(req.query.format as any)
      ? (req.query.format as ExportFormat)
      : 'csv';

    const entriesRaw: any = await db.execute(sql`
      SELECT provider_uid, division_code, booking_id,
             gross_cents, commission_rate_bps, net_cents, clawback_reason
      FROM provider_payout_entries
      WHERE payout_batch_id=${batchId}
      ORDER BY provider_uid, booking_id
    `);
    const entries: PayoutEntry[] = entriesRaw?.rows ?? entriesRaw ?? [];

    if (entries.length === 0) {
      return res.status(404).json({ error: 'Batch not found or has no entries', batchId });
    }

    const { body, contentType, filename } = serializePayoutEntries(entries, batchId, format);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Format', format);
    return res.send(body);
  } catch (err: any) {
    logger.error('[PayoutBatch][Export] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to export payout batch', detail: err.message });
  }
});

// ── GET /admin/wallet/payout-batches/:batchId/provider-export ─────────────
// Grouped multi-provider export — one section per provider, CSV with batch header.
router.get('/admin/wallet/payout-batches/:batchId/provider-export', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { batchId } = req.params;

    const entriesRaw: any = await db.execute(sql`
      SELECT provider_uid, division_code, booking_id,
             gross_cents, commission_rate_bps, net_cents, paid_at
      FROM provider_payout_entries
      WHERE payout_batch_id=${batchId}
      ORDER BY provider_uid, booking_id
    `);
    const entries = entriesRaw?.rows ?? entriesRaw ?? [];
    if (entries.length === 0) return res.status(404).json({ error: 'Batch not found or empty', batchId });

    // Group by provider
    const byProvider: Record<string, any[]> = {};
    for (const r of entries) {
      if (!byProvider[r.provider_uid]) byProvider[r.provider_uid] = [];
      byProvider[r.provider_uid].push(r);
    }

    const BOM = '\uFEFF';
    const batchHeader = `# Payout Batch: ${batchId}\r\n# Generated: ${new Date().toISOString()}\r\n`;
    const entryHeader = 'provider_uid,division_code,booking_id,gross_ils,commission_ils,net_ils,paid_at';
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const sections: string[] = [];
    for (const [provUid, provEntries] of Object.entries(byProvider)) {
      const rows = provEntries.map((r: any) => {
        const gross = Number(r.gross_cents ?? 0) / 100;
        const net   = Number(r.net_cents   ?? 0) / 100;
        const comm  = parseFloat((gross - net).toFixed(2));
        return [esc(provUid), esc(r.division_code ?? ''), esc(r.booking_id ?? ''), gross.toFixed(2), comm.toFixed(2), net.toFixed(2), esc(r.paid_at ? String(r.paid_at) : '')].join(',');
      });
      const subtotal = provEntries.reduce((s: number, r: any) => s + Number(r.net_cents ?? 0), 0) / 100;
      sections.push([entryHeader, ...rows, `# Subtotal net for ${provUid}: ${subtotal.toFixed(2)} ILS`].join('\r\n'));
    }

    const csv = BOM + batchHeader + sections.join('\r\n\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="provider-export-${batchId}.csv"`);
    return res.send(csv);
  } catch (err: any) {
    logger.error('[3.0B][ProviderExport] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to export provider batch', detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2.9E — DAILY FINANCE CLOSE
// ═══════════════════════════════════════════════════════════════════════════

// ── Helper: build division snapshots for a given calendar date ────────────
async function buildDivisionSnapshots(dateIso: string): Promise<Record<string, any>> {
  const fromClause = `AND wle.created_at >= '${dateIso}'::date AT TIME ZONE 'Asia/Jerusalem'`;
  const toClause   = `AND wle.created_at <  ('${dateIso}'::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Jerusalem'`;
  const fromPayClause = `AND ppe.created_at >= '${dateIso}'::date AT TIME ZONE 'Asia/Jerusalem'`;
  const toPayClause   = `AND ppe.created_at <  ('${dateIso}'::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Jerusalem'`;

  const DIVS = ['walkers', 'petsitter', 'academy', 'station_k9000'];
  const snapshots: Record<string, any> = {};

  const collectedRaw: any = await db.execute(sql.raw(`
    SELECT COALESCE(wle.division_code, 'unknown') AS div,
           COALESCE(SUM(amount_cents), 0)         AS collected
    FROM wallet_ledger_entries wle
    WHERE wle.direction = 'debit'
      AND wle.event_type IN ${COLLECTED_EVENTS}
      ${fromClause} ${toClause}
    GROUP BY wle.division_code
  `));
  const payableRaw: any = await db.execute(sql.raw(`
    SELECT COALESCE(ppe.division_code, 'unknown') AS div,
           COALESCE(SUM(ppe.net_cents), 0)        AS payable
    FROM provider_payout_entries ppe
    WHERE ppe.status IN ('earned', 'held')
      ${fromPayClause} ${toPayClause}
    GROUP BY ppe.division_code
  `));
  const holdsRaw: any = await db.execute(sql.raw(`
    SELECT COALESCE(wle.division_code, 'unknown') AS div,
           COALESCE(SUM(wh.amount_cents), 0)      AS holds
    FROM wallet_holds wh
    LEFT JOIN wallet_ledger_entries wle ON wle.booking_id = wh.booking_id
    WHERE wh.status = 'active'
      AND wh.created_at >= '${dateIso}'::date AT TIME ZONE 'Asia/Jerusalem'
      AND wh.created_at <  ('${dateIso}'::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Jerusalem'
    GROUP BY wle.division_code
  `));

  const collMap = new Map<string, number>();
  for (const r of (collectedRaw?.rows ?? collectedRaw ?? [])) collMap.set(r.div, Number(r.collected ?? 0));
  const payMap  = new Map<string, number>();
  for (const r of (payableRaw?.rows  ?? payableRaw  ?? [])) payMap.set(r.div, Number(r.payable ?? 0));
  const holdMap = new Map<string, number>();
  for (const r of (holdsRaw?.rows    ?? holdsRaw    ?? [])) holdMap.set(r.div, Number(r.holds ?? 0));

  for (const div of DIVS) {
    const collected = collMap.get(div) ?? 0;
    const payable   = payMap.get(div)  ?? 0;
    const holds     = holdMap.get(div) ?? 0;
    const vatLiab   = Math.floor(collected * VAT_RATE);
    const margin    = collected - payable - vatLiab;
    snapshots[div]  = {
      collectedCents:       collected,
      providerPayableCents: payable,
      pendingHoldsCents:    holds,
      marginCents:          margin,
      marginPct:            collected > 0 ? parseFloat(((margin / collected) * 100).toFixed(2)) : 0,
    };
  }
  return snapshots;
}

// ── Helper: build live checklist for a given date ─────────────────────────
async function buildChecklist(dateIso: string): Promise<Record<string, { ok: boolean; count: number }>> {
  // 1. Open anomalies (negative balance + stale hold + refund_exceeds_hold + double_debit)
  const negBalRow: any = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM user_wallets WHERE available_cents < 0
  `);
  const negBal = Number((negBalRow?.rows ?? negBalRow ?? [])[0]?.cnt ?? 0);

  const staleRow: any = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM wallet_holds
    WHERE status = 'active' AND created_at < NOW() - INTERVAL '48 hours'
  `);
  const stale = Number((staleRow?.rows ?? staleRow ?? [])[0]?.cnt ?? 0);

  const refExceedsRow: any = await db.execute(sql`
    SELECT COUNT(*) AS cnt
    FROM wallet_ledger_entries wle
    WHERE wle.event_type = 'refund'
      AND ABS(wle.amount_cents) > COALESCE((
        SELECT wh.amount_cents FROM wallet_holds wh
        WHERE wh.booking_id = wle.booking_id LIMIT 1
      ), 0)
  `);
  const refExceeds = Number((refExceedsRow?.rows ?? refExceedsRow ?? [])[0]?.cnt ?? 0);

  const openAnomalies = negBal + stale + refExceeds;

  // 2. Stale holds > 72h (stricter close gate)
  const staleHoldsRow: any = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM wallet_holds
    WHERE status = 'active' AND created_at < NOW() - INTERVAL '72 hours'
  `);
  const staleHolds72 = Number((staleHoldsRow?.rows ?? staleHoldsRow ?? [])[0]?.cnt ?? 0);

  // 3. Pending disputes
  const disputeRow: any = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM dispute_cases WHERE status NOT IN ('resolved', 'closed')
  `);
  const pendingDisputes = Number((disputeRow?.rows ?? disputeRow ?? [])[0]?.cnt ?? 0);

  // 4. Pending refund approvals
  const approvalRow: any = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM refund_approvals WHERE status = 'pending'
  `);
  const pendingApprovals = Number((approvalRow?.rows ?? approvalRow ?? [])[0]?.cnt ?? 0);

  return {
    noOpenAnomalies:          { ok: openAnomalies   === 0, count: openAnomalies },
    noStaleHolds:             { ok: staleHolds72    === 0, count: staleHolds72 },
    noPendingDisputes:        { ok: pendingDisputes  === 0, count: pendingDisputes },
    noPendingRefundApprovals: { ok: pendingApprovals === 0, count: pendingApprovals },
  };
}

// ── GET /admin/wallet/finance-close/history ───────────────────────────────
router.get('/admin/wallet/finance-close/history', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const rows: any = await db.execute(sql`
      SELECT id, close_date, status, closed_by_uid, closed_at,
             vat_liability_cents, exception_count, notes, created_at
      FROM finance_close_records
      ORDER BY close_date DESC
      LIMIT 30
    `);
    const records = (rows?.rows ?? rows ?? []).map((r: any) => ({
      id:                r.id,
      closeDate:         r.close_date,
      status:            r.status,
      closedByUid:       r.closed_by_uid,
      closedAt:          r.closed_at,
      vatLiabilityCents: r.vat_liability_cents,
      exceptionCount:    r.exception_count,
      notes:             r.notes,
      createdAt:         r.created_at,
    }));
    return res.json({ ok: true, records, total: records.length });
  } catch (err: any) {
    logger.error('[FinanceClose][History] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch finance close history', detail: err.message });
  }
});

// ── GET /admin/wallet/finance-close/month-export ──────────────────────────
// Phase 3.0F: Month-end finance pack. ?month=YYYY-MM
// Aggregates all closed days + payout batches + disputes for the calendar month.
router.get('/admin/wallet/finance-close/month-export', async (req: Request, res: Response) => {
  try {
    const { createHash } = await import('crypto');
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const monthParam = (req.query.month as string) ?? '';
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return res.status(400).json({ error: 'month query param must be YYYY-MM', example: '2026-03' });
    }

    const [yr, mo] = monthParam.split('-').map(Number);
    // First and last day of the month
    const firstDay = `${monthParam}-01`;
    const lastDay  = new Date(yr, mo, 0).getDate(); // last day in month
    const lastDayStr = `${monthParam}-${String(lastDay).padStart(2, '0')}`;

    // ── 1. Daily close records for the month ──────────────────────────────
    const closeRows: any = await db.execute(sql`
      SELECT close_date, status, closed_by_uid, closed_at,
             vat_liability_cents, exception_count, notes, division_snapshots
      FROM finance_close_records
      WHERE close_date >= ${firstDay}::date AND close_date <= ${lastDayStr}::date
      ORDER BY close_date
    `);
    const closedDays = (closeRows?.rows ?? closeRows ?? []).map((r: any) => ({
      closeDate:         String(r.close_date).slice(0, 10),
      status:            r.status,
      closedByUid:       r.closed_by_uid,
      closedAt:          r.closed_at,
      vatLiabilityCents: r.vat_liability_cents,
      exceptionCount:    r.exception_count,
      notes:             r.notes,
      divisionSnapshots: r.division_snapshots,
    }));

    const totalDays    = lastDay;
    const daysClosed   = closedDays.filter((d: any) => d.status === 'closed').length;
    const daysOpen     = totalDays - daysClosed;
    const totalVatCents = closedDays.reduce((s: number, d: any) => s + (d.vatLiabilityCents ?? 0), 0);

    // Aggregate division totals across closed days
    const divisionTotals: Record<string, number> = {};
    for (const day of closedDays) {
      if (!day.divisionSnapshots) continue;
      for (const [div, snap] of Object.entries(day.divisionSnapshots as Record<string, any>)) {
        divisionTotals[div] = (divisionTotals[div] ?? 0) + (snap.collectedCents ?? 0);
      }
    }

    // ── 2. Payout batches for the month ───────────────────────────────────
    const monthStart = `${monthParam}-01T00:00:00.000Z`;
    const monthEnd   = `${lastDayStr}T23:59:59.999Z`;
    const batchRows: any = await db.execute(sql`
      SELECT pb.batch_id, pb.status, pb.total_providers, pb.total_net_cents, pb.created_at, pb.created_by_uid,
             COALESCE(SUM(ppe.gross_cents), 0)::bigint AS total_gross_cents,
             COUNT(ppe.id)::int                        AS entry_count
      FROM payout_batches pb
      LEFT JOIN provider_payout_entries ppe ON ppe.payout_batch_id = pb.batch_id
      WHERE pb.created_at >= ${monthStart} AND pb.created_at <= ${monthEnd}
      GROUP BY pb.id
      ORDER BY pb.created_at
    `);
    const payoutBatches = (batchRows?.rows ?? batchRows ?? []).map((r: any) => ({
      batchId:         r.batch_id,
      status:          r.status,
      totalGrossCents: Number(r.total_gross_cents),
      totalNetCents:   r.total_net_cents,
      commissionCents: Number(r.total_gross_cents) - r.total_net_cents,
      providerCount:   r.total_providers,
      entryCount:      r.entry_count,
      createdAt:       r.created_at,
      createdByUid:    r.created_by_uid,
    }));

    const totalPayoutNetCents   = payoutBatches.reduce((s: number, b: any) => s + (b.totalNetCents ?? 0), 0);
    const totalPayoutGrossCents = payoutBatches.reduce((s: number, b: any) => s + (b.totalGrossCents ?? 0), 0);

    // ── 3. Dispute resolution summary for the month ───────────────────────
    const dispRows: any = await db.execute(sql`
      SELECT resolution_action, COUNT(*) AS cnt
      FROM dispute_cases
      WHERE created_at >= ${monthStart} AND created_at <= ${monthEnd}
      GROUP BY resolution_action
    `);
    const disputesByResolution: Record<string, number> = {};
    for (const r of (dispRows?.rows ?? dispRows ?? [])) {
      disputesByResolution[r.resolution_action ?? 'none'] = Number(r.cnt);
    }

    // ── 4. Refund summary for the month ───────────────────────────────────
    const refundRows: any = await db.execute(sql`
      SELECT status, COUNT(*) AS cnt, COALESCE(SUM(amount_cents), 0)::bigint AS total_cents
      FROM refund_approvals
      WHERE created_at >= ${monthStart} AND created_at <= ${monthEnd}
      GROUP BY status
    `);
    const refundSummary: Record<string, { count: number; totalCents: number }> = {};
    for (const r of (refundRows?.rows ?? refundRows ?? [])) {
      refundSummary[r.status] = { count: Number(r.cnt), totalCents: Number(r.total_cents) };
    }

    // ── Assemble bundle ────────────────────────────────────────────────────
    const bundle = {
      meta: {
        exportedAt:  new Date().toISOString(),
        month:       monthParam,
        totalDays,
        daysClosed,
        daysOpen,
        totalVatLiabilityCents: totalVatCents,
      },
      dailyCloseRecords:    closedDays,
      divisionTotals,
      payoutBatches,
      payoutSummary: {
        batchCount:          payoutBatches.length,
        totalGrossCents:     totalPayoutGrossCents,
        totalNetCents:       totalPayoutNetCents,
        totalCommissionCents: totalPayoutGrossCents - totalPayoutNetCents,
      },
      disputesByResolution,
      refundSummary,
    };

    const bundleJson = JSON.stringify(bundle);
    const sha256     = createHash('sha256').update(bundleJson).digest('hex');

    res.setHeader('Content-Disposition', `attachment; filename="petwash-finance-month-${monthParam}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Bundle-SHA256', sha256);

    logger.info('[FinanceClose][MonthExport]', { month: monthParam, daysClosed, sha256: sha256.slice(0, 16) });
    return res.json({ ...bundle, _sha256: sha256 });
  } catch (err: any) {
    logger.error('[FinanceClose][MonthExport] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to export month-end finance pack', detail: err.message });
  }
});

// ── GET /admin/wallet/finance-close/:date ─────────────────────────────────
router.get('/admin/wallet/finance-close/:date', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const dateParam = req.params.date; // e.g. "2026-03-22"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD', date: dateParam });
    }

    // Fetch existing record
    const existing: any = await db.execute(sql`
      SELECT * FROM finance_close_records WHERE close_date = ${dateParam}::date LIMIT 1
    `);
    const existingRow = (existing?.rows ?? existing ?? [])[0];

    const checklist = await buildChecklist(dateParam);

    if (existingRow) {
      return res.json({
        ok: true,
        record: {
          id:                existingRow.id,
          closeDate:         existingRow.close_date,
          status:            existingRow.status,
          closedByUid:       existingRow.closed_by_uid,
          closedAt:          existingRow.closed_at,
          divisionSnapshots: existingRow.division_snapshots,
          vatLiabilityCents: existingRow.vat_liability_cents,
          exceptionCount:    existingRow.exception_count,
          notes:             existingRow.notes,
        },
        checklist,
      });
    }

    // Scaffold live view for today
    const divisionSnapshots = await buildDivisionSnapshots(dateParam);
    const totalCollected = Object.values(divisionSnapshots).reduce((s: number, d: any) => s + (d.collectedCents ?? 0), 0);
    const vatLiabilityCents = Math.floor(totalCollected * VAT_RATE);
    const exceptionCount = Object.values(checklist).filter((c: any) => !c.ok).length;

    return res.json({
      ok: true,
      record: {
        closeDate:         dateParam,
        status:            'open',
        closedByUid:       null,
        closedAt:          null,
        divisionSnapshots,
        vatLiabilityCents,
        exceptionCount,
        notes:             '',
      },
      checklist,
    });
  } catch (err: any) {
    logger.error('[FinanceClose][Get] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch finance close record', detail: err.message });
  }
});

// ── POST /admin/wallet/finance-close/:date/close ──────────────────────────
router.post('/admin/wallet/finance-close/:date/close', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'admin');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';

    const dateParam = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD', date: dateParam });
    }

    const { notes = '' } = req.body as { notes?: string };

    // Idempotency: if already closed, return existing row unchanged
    const existing: any = await db.execute(sql`
      SELECT * FROM finance_close_records WHERE close_date = ${dateParam}::date LIMIT 1
    `);
    const existingRow = (existing?.rows ?? existing ?? [])[0];
    if (existingRow?.status === 'closed') {
      logger.info('[FinanceClose][Idempotent] already closed', { date: dateParam, closedByUid: existingRow.closed_by_uid });
      return res.json({
        ok: true,
        idempotent: true,
        record: {
          id:                existingRow.id,
          closeDate:         existingRow.close_date,
          status:            existingRow.status,
          closedByUid:       existingRow.closed_by_uid,
          closedAt:          existingRow.closed_at,
          divisionSnapshots: existingRow.division_snapshots,
          vatLiabilityCents: existingRow.vat_liability_cents,
          exceptionCount:    existingRow.exception_count,
          notes:             existingRow.notes,
        },
      });
    }

    // ── Checklist enforcement ─────────────────────────────────────────────
    const checklist = await buildChecklist(dateParam);
    const blocked   = Object.entries(checklist).filter(([, v]) => !v.ok);
    if (blocked.length > 0) {
      logger.warn('[FinanceClose][Blocked]', { date: dateParam, blocked: blocked.map(([k, v]) => `${k}:${(v as any).count}`) });
      return res.status(422).json({
        ok: false,
        error:    'Finance close blocked — checklist not clear',
        blocked:  Object.fromEntries(blocked),
        checklist,
      });
    }

    // ── Build immutable snapshot ──────────────────────────────────────────
    const divisionSnapshots = await buildDivisionSnapshots(dateParam);
    const totalCollected    = Object.values(divisionSnapshots).reduce((s: number, d: any) => s + (d.collectedCents ?? 0), 0);
    const vatLiabilityCents = Math.floor(totalCollected * VAT_RATE);
    const exceptionCount    = 0; // all checks passed

    // ── Upsert close record ───────────────────────────────────────────────
    const upserted: any = await db.execute(sql`
      INSERT INTO finance_close_records
        (close_date, closed_by_uid, closed_at, division_snapshots, vat_liability_cents, exception_count, notes, status)
      VALUES (
        ${dateParam}::date,
        ${adminUid},
        NOW(),
        ${JSON.stringify(divisionSnapshots)}::jsonb,
        ${vatLiabilityCents},
        ${exceptionCount},
        ${notes},
        'closed'
      )
      ON CONFLICT (close_date) DO UPDATE
        SET closed_by_uid      = EXCLUDED.closed_by_uid,
            closed_at          = EXCLUDED.closed_at,
            division_snapshots = EXCLUDED.division_snapshots,
            vat_liability_cents = EXCLUDED.vat_liability_cents,
            exception_count    = EXCLUDED.exception_count,
            notes              = EXCLUDED.notes,
            status             = 'closed'
      RETURNING *
    `);
    const row = (upserted?.rows ?? upserted ?? [])[0];

    logger.info('[FinanceClose][Closed]', { date: dateParam, adminUid, vatLiabilityCents });
    await recordFinanceAction(adminUid, 'finance_day_close', 'finance_close', dateParam,
      existingRow ? { status: existingRow.status } : null,
      { status: 'closed', vatLiabilityCents, exceptionCount },
      req.ip);
    return res.json({
      ok: true,
      idempotent: false,
      record: {
        id:                row.id,
        closeDate:         row.close_date,
        status:            row.status,
        closedByUid:       row.closed_by_uid,
        closedAt:          row.closed_at,
        divisionSnapshots: row.division_snapshots,
        vatLiabilityCents: row.vat_liability_cents,
        exceptionCount:    row.exception_count,
        notes:             row.notes,
      },
    });
  } catch (err: any) {
    logger.error('[FinanceClose][Close] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to close finance day', detail: err.message });
  }
});

// ── GET /admin/wallet/finance-close/:date/export ──────────────────────────
// Phase 3.0E: Deterministic daily audit pack — one JSON bundle per close date.
// Contains 5 sections + SHA-256 of the bundle for integrity verification.
router.get('/admin/wallet/finance-close/:date/export', async (req: Request, res: Response) => {
  try {
    const { createHash } = await import('crypto');
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const dateParam = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD', date: dateParam });
    }

    const dayStart = `${dateParam}T00:00:00.000Z`;
    const dayEnd   = `${dateParam}T23:59:59.999Z`;

    // ── 1. Settlement Summary (reuse buildDivisionSnapshots) ──────────────
    const divisionSnapshots = await buildDivisionSnapshots(dateParam);
    const totalCollectedCents = Object.values(divisionSnapshots)
      .reduce((s: number, d: any) => s + (d.collectedCents ?? 0), 0);
    const vatCents = Math.floor(totalCollectedCents * VAT_RATE);

    // ── 2. Payout Batches created on this date ────────────────────────────
    const batchRows: any = await db.execute(sql`
      SELECT pb.batch_id, pb.status, pb.total_providers, pb.total_net_cents, pb.created_at, pb.created_by_uid,
             COALESCE(SUM(ppe.gross_cents), 0)::bigint AS total_gross_cents,
             COUNT(ppe.id)::int                               AS entry_count
      FROM payout_batches pb
      LEFT JOIN provider_payout_entries ppe ON ppe.payout_batch_id = pb.batch_id
      WHERE pb.created_at >= ${dayStart} AND pb.created_at <= ${dayEnd}
      GROUP BY pb.id
      ORDER BY pb.created_at
    `);
    const payoutBatches = (batchRows?.rows ?? batchRows ?? []).map((r: any) => ({
      batchId:         r.batch_id,
      status:          r.status,
      totalGrossCents: Number(r.total_gross_cents),
      totalNetCents:   r.total_net_cents,
      commissionCents: Number(r.total_gross_cents) - r.total_net_cents,
      providerCount:   r.total_providers,
      entryCount:      r.entry_count,
      createdAt:       r.created_at,
      createdByUid:    r.created_by_uid,
    }));

    // ── 3. Action History (all ledger entries for the day) ─────────────────
    const ledgerRows: any = await db.execute(sql`
      SELECT user_id, entry_type, amount_cents, currency, description, booking_id, division, created_at
      FROM wallet_ledger_entries
      WHERE created_at >= ${dayStart} AND created_at <= ${dayEnd}
      ORDER BY created_at
    `);
    const actionHistory = (ledgerRows?.rows ?? ledgerRows ?? []).map((r: any) => ({
      userId:      r.user_id,
      entryType:   r.entry_type,
      amountCents: r.amount_cents,
      currency:    r.currency,
      description: r.description,
      bookingId:   r.booking_id,
      division:    r.division,
      createdAt:   r.created_at,
    }));

    // ── 4. Anomaly Log ────────────────────────────────────────────────────
    const negRows: any  = await db.execute(sql`
      SELECT user_id, cash_wallet_balance_cents, pending_balance_cents
      FROM wallet_accounts
      WHERE cash_wallet_balance_cents < 0 OR pending_balance_cents < 0
    `);
    const staleRows: any = await db.execute(sql`
      SELECT user_id, booking_id, amount_cents, created_at
      FROM wallet_ledger_entries
      WHERE entry_type='hold' AND reversed=false
        AND created_at < NOW() - INTERVAL '72 hours'
      ORDER BY created_at
    `);
    const anomalyLog = {
      negativeBalances: (negRows?.rows ?? negRows ?? []).map((r: any) => ({
        userId:           r.user_id,
        cashBalanceCents: r.cash_wallet_balance_cents,
        pendingCents:     r.pending_balance_cents,
      })),
      staleHoldsOver72h: (staleRows?.rows ?? staleRows ?? []).map((r: any) => ({
        userId:      r.user_id,
        bookingId:   r.booking_id,
        amountCents: r.amount_cents,
        heldSince:   r.created_at,
      })),
    };

    // ── 5. Dispute Summary ────────────────────────────────────────────────
    const disputeRows: any = await db.execute(sql`
      SELECT case_ref, status, resolution_action, complaint_type, division, linked_booking_id, created_at, linked_payout_batch_id
      FROM dispute_cases
      WHERE created_at >= ${dayStart} AND created_at <= ${dayEnd}
      ORDER BY created_at
    `);
    const disputeSummary = (disputeRows?.rows ?? disputeRows ?? []).map((r: any) => ({
      caseRef:            r.case_ref,
      status:             r.status,
      resolutionAction:   r.resolution_action,
      complaintType:      r.complaint_type,
      division:           r.division,
      linkedBookingId:    r.linked_booking_id,
      linkedPayoutBatch:  r.linked_payout_batch_id,
      createdAt:          r.created_at,
    }));

    // ── Finance close record ───────────────────────────────────────────────
    const closeRec: any = await db.execute(sql`
      SELECT * FROM finance_close_records WHERE close_date = ${dateParam}::date LIMIT 1
    `);
    const closeRow = (closeRec?.rows ?? closeRec ?? [])[0];

    // ── Assemble bundle ───────────────────────────────────────────────────
    const bundle = {
      meta: {
        exportedAt:     new Date().toISOString(),
        date:           dateParam,
        closeStatus:    closeRow?.status ?? 'open',
        closedByUid:    closeRow?.closed_by_uid ?? null,
        closedAt:       closeRow?.closed_at ?? null,
        vatLiabilityCents: vatCents,
        totalCollectedCents,
      },
      settlementSummary: {
        divisions:          divisionSnapshots,
        totalCollectedCents,
        vatLiabilityCents:  vatCents,
      },
      payoutBatches,
      actionHistory,
      anomalyLog,
      disputeSummary,
    };

    // ── SHA-256 integrity hash ─────────────────────────────────────────────
    const bundleJson = JSON.stringify(bundle);
    const sha256     = createHash('sha256').update(bundleJson).digest('hex');

    res.setHeader('Content-Disposition', `attachment; filename="petwash-finance-${dateParam}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Bundle-SHA256', sha256);

    logger.info('[FinanceClose][Export]', { date: dateParam, sha256: sha256.slice(0, 16) });
    return res.json({ ...bundle, _sha256: sha256 });
  } catch (err: any) {
    logger.error('[FinanceClose][Export] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to export finance bundle', detail: err.message });
  }
});

// ── Phase 3.0G: Finance Role Management Endpoints ─────────────────────────

// ── Phase 3.1B: Provider Clawback History ────────────────────────────────

// GET /provider/wallet/clawback-history — provider-facing clawback entries grouped by month
router.get('/provider/wallet/clawback-history', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const providerUid = session?.user?.uid ?? session?.user?.id;
    if (!providerUid) return res.status(401).json({ error: 'Authentication required' });

    const raw: any = await db.execute(sql`
      SELECT id, booking_id, division_code, gross_cents, net_cents,
             commission_rate_bps, clawback_reason, payout_batch_id, created_at
      FROM provider_payout_entries
      WHERE provider_uid = ${providerUid}
        AND net_cents < 0
      ORDER BY created_at DESC
    `);
    const entries = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id:              r.id,
      bookingId:       r.booking_id,
      divisionCode:    r.division_code,
      grossCents:      Number(r.gross_cents),
      netCents:        Number(r.net_cents),
      clawbackCents:   Math.abs(Number(r.net_cents)),
      clawbackReason:  r.clawback_reason ?? null,
      batchId:         r.payout_batch_id ?? null,
      createdAt:       r.created_at,
      month:           String(r.created_at).slice(0, 7),
    }));

    // Group by month for display
    const byMonth: Record<string, { month: string; count: number; totalClawbackCents: number; entries: any[] }> = {};
    for (const e of entries) {
      if (!byMonth[e.month]) byMonth[e.month] = { month: e.month, count: 0, totalClawbackCents: 0, entries: [] };
      byMonth[e.month].count++;
      byMonth[e.month].totalClawbackCents += e.clawbackCents;
      byMonth[e.month].entries.push(e);
    }

    return res.json({
      ok: true,
      total: entries.length,
      totalClawbackCents: entries.reduce((s, e) => s + e.clawbackCents, 0),
      byMonth: Object.values(byMonth),
    });
  } catch (err: any) {
    logger.error('[Clawback][ProviderHistory] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch clawback history', detail: err.message });
  }
});

// GET /admin/wallet/clawback-summary — admin view: all clawbacks, totals per provider
router.get('/admin/wallet/clawback-summary', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { from, to, divisionCode } = req.query as Record<string, string>;
    const conditions: any[] = [sql`net_cents < 0`];
    if (from)         conditions.push(sql`created_at >= ${from}::timestamptz`);
    if (to)           conditions.push(sql`created_at <= ${to}::timestamptz`);
    if (divisionCode) conditions.push(sql`division_code = ${divisionCode}`);

    const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    const raw: any = await db.execute(sql`
      SELECT id, provider_uid, booking_id, division_code,
             gross_cents, net_cents, clawback_reason, payout_batch_id, created_at
      FROM provider_payout_entries
      ${whereClause}
      ORDER BY provider_uid, created_at DESC
    `);
    const entries = raw?.rows ?? raw ?? [];

    // Aggregate per provider
    const providerMap: Record<string, { providerUid: string; count: number; totalClawbackCents: number }> = {};
    for (const r of entries) {
      const uid = r.provider_uid;
      if (!providerMap[uid]) providerMap[uid] = { providerUid: uid, count: 0, totalClawbackCents: 0 };
      providerMap[uid].count++;
      providerMap[uid].totalClawbackCents += Math.abs(Number(r.net_cents));
    }

    return res.json({
      ok: true,
      total: entries.length,
      totalClawbackCents: entries.reduce((s: number, r: any) => s + Math.abs(Number(r.net_cents)), 0),
      byProvider: Object.values(providerMap).sort((a, b) => b.totalClawbackCents - a.totalClawbackCents),
      entries: entries.map((r: any) => ({
        id: r.id, providerUid: r.provider_uid, bookingId: r.booking_id,
        divisionCode: r.division_code, clawbackCents: Math.abs(Number(r.net_cents)),
        clawbackReason: r.clawback_reason ?? null, batchId: r.payout_batch_id ?? null, createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    logger.error('[Clawback][AdminSummary] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch clawback summary', detail: err.message });
  }
});

// ── Phase 3.1C: Automated Remittance Emails ──────────────────────────────

// POST /admin/wallet/payout-batches/:batchId/send-remittances — idempotent per provider per batch
router.post('/admin/wallet/payout-batches/:batchId/send-remittances', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';
    const { batchId } = req.params;

    // Load all entries for the batch
    const entriesRaw: any = await db.execute(sql`
      SELECT provider_uid, SUM(gross_cents) AS gross, SUM(net_cents) AS net,
             COUNT(*) AS entry_count, string_agg(booking_id, ', ') AS bookings
      FROM provider_payout_entries
      WHERE payout_batch_id = ${batchId}
      GROUP BY provider_uid
    `);
    const providers = entriesRaw?.rows ?? entriesRaw ?? [];
    if (providers.length === 0) {
      return res.status(404).json({ error: 'Batch not found or has no entries', batchId });
    }

    const sentList: string[] = [];
    const failedList: string[] = [];
    const skippedList: string[] = [];

    for (const prov of providers) {
      const providerUid = prov.provider_uid;

      // Idempotency: skip if already sent successfully
      const existing: any = await db.execute(sql`
        SELECT status FROM remittance_email_log
        WHERE batch_id = ${batchId} AND provider_uid = ${providerUid}
      `);
      const existingRow = (existing?.rows ?? existing ?? [])[0];
      if (existingRow?.status === 'sent') { skippedList.push(providerUid); continue; }

      // Look up provider email from users table, fallback to provider_applications
      let providerEmail: string | null = null;
      try {
        const userRow: any = await db.execute(sql`SELECT email FROM users WHERE id = ${providerUid} LIMIT 1`);
        providerEmail = (userRow?.rows ?? userRow ?? [])[0]?.email ?? null;
        if (!providerEmail) {
          const appRow: any = await db.execute(sql`SELECT email FROM provider_applications WHERE user_id = ${providerUid} ORDER BY id DESC LIMIT 1`);
          providerEmail = (appRow?.rows ?? appRow ?? [])[0]?.email ?? null;
        }
      } catch (_) {}

      if (!providerEmail) {
        await db.execute(sql`
          INSERT INTO remittance_email_log (batch_id, provider_uid, status, error_detail)
          VALUES (${batchId}, ${providerUid}, 'failed', 'No email address found for provider')
          ON CONFLICT (batch_id, provider_uid) DO UPDATE
            SET status = 'failed', error_detail = 'No email address found for provider', sent_at = NULL
        `);
        failedList.push(providerUid);
        continue;
      }

      const grossIls = (Number(prov.gross) / 100).toFixed(2);
      const netIls   = (Number(prov.net)   / 100).toFixed(2);
      const commIls  = ((Number(prov.gross) - Number(prov.net)) / 100).toFixed(2);

      const subject = `PetWash™ — Remittance Statement | Batch ${batchId}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a1a2e;padding:24px 32px">
            <h1 style="color:#C5A55A;margin:0;font-size:20px">PetWash™ Provider Remittance</h1>
          </div>
          <div style="padding:24px 32px;background:#fff">
            <p style="color:#555;font-size:14px">Dear Provider,</p>
            <p style="color:#555;font-size:14px">Your payment has been processed for batch <strong>${batchId}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
              <tr style="background:#f8f8f8"><td style="padding:10px 14px;color:#888">Batch ID</td><td style="padding:10px 14px;font-family:monospace">${batchId}</td></tr>
              <tr><td style="padding:10px 14px;color:#888">Bookings</td><td style="padding:10px 14px;font-family:monospace">${prov.entry_count}</td></tr>
              <tr style="background:#f8f8f8"><td style="padding:10px 14px;color:#888">Gross Amount</td><td style="padding:10px 14px;font-weight:bold">₪${grossIls}</td></tr>
              <tr><td style="padding:10px 14px;color:#888">Commission</td><td style="padding:10px 14px;color:#e55">₪${commIls}</td></tr>
              <tr style="background:#f0f9f0"><td style="padding:10px 14px;color:#2a7a2a;font-weight:bold">Net Payment</td><td style="padding:10px 14px;color:#2a7a2a;font-weight:bold;font-size:16px">₪${netIls}</td></tr>
            </table>
            <p style="color:#888;font-size:12px">This is an automated remittance statement. For questions contact finance@petwash.co.il</p>
          </div>
        </div>
      `;

      let sendOk = false;
      let errorDetail: string | null = null;
      try {
        sendOk = await EmailService.send({ to: providerEmail, subject, html });
      } catch (emailErr: any) {
        errorDetail = emailErr.message ?? 'Email send error';
      }

      const status = sendOk ? 'sent' : 'failed';
      const sentAt = sendOk ? new Date() : null;
      if (!errorDetail && !sendOk) errorDetail = 'EmailService returned false';

      await db.execute(sql`
        INSERT INTO remittance_email_log (batch_id, provider_uid, status, sent_at, error_detail)
        VALUES (${batchId}, ${providerUid}, ${status}, ${sentAt}, ${errorDetail})
        ON CONFLICT (batch_id, provider_uid) DO UPDATE
          SET status = ${status}, sent_at = ${sentAt}, error_detail = ${errorDetail}
      `);

      if (sendOk) sentList.push(providerUid);
      else failedList.push(providerUid);
    }

    logger.info('[Remittance][Send]', { batchId, sent: sentList.length, failed: failedList.length, skipped: skippedList.length, adminUid });
    await recordFinanceAction(adminUid, 'remittance_send', 'payout_batch', batchId, null,
      { sent: sentList.length, failed: failedList.length, skipped: skippedList.length }, req.ip);

    return res.json({
      ok: true, batchId,
      sent: sentList.length, failed: failedList.length, skipped: skippedList.length,
      sentProviders: sentList, failedProviders: failedList, skippedProviders: skippedList,
    });
  } catch (err: any) {
    logger.error('[Remittance][Send] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to send remittances', detail: err.message });
  }
});

// GET /admin/wallet/payout-batches/:batchId/remittance-log — delivery status per provider
router.get('/admin/wallet/payout-batches/:batchId/remittance-log', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { batchId } = req.params;

    const raw: any = await db.execute(sql`
      SELECT id, batch_id, provider_uid, status, sent_at, error_detail, created_at
      FROM remittance_email_log
      WHERE batch_id = ${batchId}
      ORDER BY created_at DESC
    `);
    const entries = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id:          r.id,
      batchId:     r.batch_id,
      providerUid: r.provider_uid,
      status:      r.status,
      sentAt:      r.sent_at,
      errorDetail: r.error_detail ?? null,
      createdAt:   r.created_at,
    }));

    const summary = {
      total:   entries.length,
      sent:    entries.filter((e: any) => e.status === 'sent').length,
      failed:  entries.filter((e: any) => e.status === 'failed').length,
      pending: entries.filter((e: any) => e.status === 'pending').length,
    };

    return res.json({ ok: true, batchId, summary, entries });
  } catch (err: any) {
    logger.error('[Remittance][Log] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch remittance log', detail: err.message });
  }
});

// ── Phase 3.2A: Bank Reconciliation ──────────────────────────────────────

// POST /admin/wallet/payout-batches/:batchId/reconcile — CSV upload, match against entries
// CSV columns: provider_uid (required), bank_ref (optional), amount_ils (optional for validation)
router.post('/admin/wallet/payout-batches/:batchId/reconcile',
  csvUpload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const session = (req as any).session;
      if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
      const financeRole = await requireFinanceRole(req, res, 'write');
      if (!financeRole) return;

      const adminUid  = session.user.uid ?? session.user.id ?? 'unknown';
      const { batchId } = req.params;
      const file = (req as any).file as Express.Multer.File | undefined;

      if (!file) return res.status(400).json({ error: 'No CSV file uploaded. Send as multipart/form-data with field name "file".' });

      // Parse CSV buffer — simple line-by-line, no external parser needed
      const text = file.buffer.toString('utf-8').trim();
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

      const header = lines[0].split(',').map((h: string) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
      const getCol = (row: string[], name: string) => {
        const idx = header.indexOf(name);
        return idx >= 0 ? (row[idx] ?? '').trim() : '';
      };

      // Load all entries for this batch keyed by provider_uid
      const entriesRaw: any = await db.execute(sql`
        SELECT id, provider_uid, net_cents, settled_at, bank_ref
        FROM provider_payout_entries
        WHERE payout_batch_id = ${batchId}
      `);
      const entries: any[] = entriesRaw?.rows ?? entriesRaw ?? [];
      if (entries.length === 0) return res.status(404).json({ error: 'Batch not found or has no entries', batchId });

      // Aggregate by provider_uid (batch may have multiple entries per provider)
      const providerMap: Record<string, any> = {};
      for (const e of entries) {
        const uid = e.provider_uid;
        if (!providerMap[uid]) providerMap[uid] = { providerUid: uid, totalNetCents: 0, ids: [] };
        providerMap[uid].totalNetCents += Number(e.net_cents ?? 0);
        providerMap[uid].ids.push(e.id);
      }

      const rawRows: any[] = [];
      const matched: string[]   = [];
      const unmatched: string[] = [];
      const alreadySettled: string[] = [];
      const amountMismatch: string[] = [];

      // Track exceptions to create after we know the upload_id
      const pendingExceptions: Array<{ providerUid: string | null; rawRow: any; reason: string }> = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        const providerUid = getCol(row, 'provider_uid');
        const bankRef     = getCol(row, 'bank_ref');
        const amountIls   = parseFloat(getCol(row, 'amount_ils') || '0');
        const rowObj = { providerUid, bankRef, amountIls, line: i + 1 };
        rawRows.push(rowObj);

        if (!providerUid) {
          unmatched.push(`line:${i + 1}:no_provider_uid`);
          pendingExceptions.push({ providerUid: null, rawRow: rowObj, reason: 'no_provider_uid' });
          continue;
        }

        const provData = providerMap[providerUid];
        if (!provData) {
          unmatched.push(providerUid);
          pendingExceptions.push({ providerUid, rawRow: rowObj, reason: 'provider_not_in_batch' });
          continue;
        }

        // Check amount tolerance (±1 ILS) if amount_ils provided in CSV
        if (amountIls > 0) {
          const expectedIls = provData.totalNetCents / 100;
          if (Math.abs(amountIls - expectedIls) > 1.0) {
            amountMismatch.push(providerUid);
            rawRows[rawRows.length - 1].mismatch = { expected: expectedIls, got: amountIls };
            pendingExceptions.push({ providerUid, rawRow: { ...rowObj, expectedIls }, reason: 'amount_mismatch' });
            continue;
          }
        }

        // Check if already settled
        const firstEntry = entries.find((e: any) => e.provider_uid === providerUid);
        if (firstEntry?.settled_at) { alreadySettled.push(providerUid); continue; }

        // Mark all entries for this provider as settled
        const settledAt = new Date();
        await db.execute(sql`
          UPDATE provider_payout_entries
          SET settled_at = ${settledAt}, bank_ref = ${bankRef || null}, status = 'settled'
          WHERE payout_batch_id = ${batchId} AND provider_uid = ${providerUid}
        `);
        matched.push(providerUid);
        rawRows[rawRows.length - 1].settled = true;
      }

      // Write reconciliation record and retrieve its id for exception foreign keys
      const uploadRes: any = await db.execute(sql`
        INSERT INTO bank_reconciliation_uploads
          (batch_id, uploaded_by, file_name, matched_count, unmatched_count, status, raw_rows)
        VALUES
          (${batchId}, ${adminUid}, ${file.originalname}, ${matched.length},
           ${unmatched.length + amountMismatch.length},
           'completed', ${JSON.stringify(rawRows)})
        RETURNING id
      `);
      const uploadId = (uploadRes?.rows ?? uploadRes ?? [])[0]?.id ?? null;

      // Create exceptions for all non-matched rows (3.3A)
      if (uploadId && pendingExceptions.length > 0) {
        for (const ex of pendingExceptions) {
          await db.execute(sql`
            INSERT INTO bank_reconciliation_exceptions
              (upload_id, batch_id, provider_uid, raw_row, detected_reason, status)
            VALUES
              (${uploadId}, ${batchId}, ${ex.providerUid},
               ${JSON.stringify(ex.rawRow)}, ${ex.reason}, 'open')
          `);
        }
      }

      const exceptionCount = pendingExceptions.length;
      logger.info('[Reconciliation][Upload]', { batchId, matched: matched.length, unmatched: unmatched.length, amountMismatch: amountMismatch.length, exceptions: exceptionCount, adminUid });
      await recordFinanceAction(adminUid, 'bank_reconciliation', 'payout_batch', batchId, null,
        { matched: matched.length, unmatched: unmatched.length, amountMismatch: amountMismatch.length, exceptions: exceptionCount, fileName: file.originalname }, req.ip);

      // Fire alert if there are open exceptions
      if (exceptionCount > 0) {
        await db.execute(sql`
          INSERT INTO finance_alerts (alert_type, severity, entity_type, entity_id, detail)
          VALUES ('reconciliation_exceptions', ${exceptionCount >= 5 ? 'critical' : 'warning'},
                  'payout_batch', ${batchId},
                  ${JSON.stringify({ batchId, exceptions: exceptionCount, unmatched: unmatched.length, amountMismatch: amountMismatch.length })})
        `);
      }

      return res.json({
        ok: true, batchId,
        matched:        matched.length,
        unmatched:      unmatched.length,
        amountMismatch: amountMismatch.length,
        alreadySettled: alreadySettled.length,
        exceptions:     exceptionCount,
        matchedProviders:       matched,
        unmatchedProviders:     unmatched,
        amountMismatchProviders: amountMismatch,
        alreadySettledProviders: alreadySettled,
        fileName: file.originalname,
        totalRows: lines.length - 1,
        uploadId,
      });
    } catch (err: any) {
      logger.error('[Reconciliation][Upload] error', { error: err.message });
      return res.status(500).json({ error: 'Reconciliation failed', detail: err.message });
    }
  }
);

// GET /admin/wallet/payout-batches/:batchId/reconciliation — fetch all reconciliation uploads + settlement state
router.get('/admin/wallet/payout-batches/:batchId/reconciliation', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { batchId } = req.params;

    const uploadsRaw: any = await db.execute(sql`
      SELECT id, uploaded_by, file_name, matched_count, unmatched_count, status, created_at
      FROM bank_reconciliation_uploads
      WHERE batch_id = ${batchId}
      ORDER BY created_at DESC
    `);
    const uploads = uploadsRaw?.rows ?? uploadsRaw ?? [];

    // Settlement summary for this batch
    const summaryRaw: any = await db.execute(sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE settled_at IS NOT NULL) AS settled,
        COUNT(*) FILTER (WHERE settled_at IS NULL)     AS unsettled,
        COUNT(DISTINCT provider_uid)                   AS providers,
        COALESCE(SUM(net_cents) FILTER (WHERE settled_at IS NOT NULL), 0) AS settled_net_cents,
        COALESCE(SUM(net_cents) FILTER (WHERE settled_at IS NULL), 0)     AS unsettled_net_cents
      FROM provider_payout_entries
      WHERE payout_batch_id = ${batchId}
    `);
    const summary = (summaryRaw?.rows ?? summaryRaw ?? [])[0] ?? {};

    // Per-provider settlement list
    const provRaw: any = await db.execute(sql`
      SELECT provider_uid,
             COALESCE(SUM(net_cents), 0) AS net_cents,
             MAX(settled_at)             AS settled_at,
             MAX(bank_ref)               AS bank_ref
      FROM provider_payout_entries
      WHERE payout_batch_id = ${batchId}
      GROUP BY provider_uid
      ORDER BY provider_uid
    `);
    const providers = (provRaw?.rows ?? provRaw ?? []).map((r: any) => ({
      providerUid: r.provider_uid,
      netCents:    Number(r.net_cents),
      settledAt:   r.settled_at ?? null,
      bankRef:     r.bank_ref ?? null,
      settled:     !!r.settled_at,
    }));

    return res.json({
      ok: true, batchId,
      uploads: uploads.map((u: any) => ({
        id: u.id, uploadedBy: u.uploaded_by, fileName: u.file_name,
        matchedCount: u.matched_count, unmatchedCount: u.unmatched_count,
        status: u.status, createdAt: u.created_at,
      })),
      summary: {
        total:              Number(summary.total ?? 0),
        settled:            Number(summary.settled ?? 0),
        unsettled:          Number(summary.unsettled ?? 0),
        providers:          Number(summary.providers ?? 0),
        settledNetCents:    Number(summary.settled_net_cents ?? 0),
        unsettledNetCents:  Number(summary.unsettled_net_cents ?? 0),
      },
      providers,
    });
  } catch (err: any) {
    logger.error('[Reconciliation][Get] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch reconciliation data', detail: err.message });
  }
});

// ── Phase 3.2B: Remittance Resend & Failure Recovery ─────────────────────

// POST /admin/wallet/payout-batches/:batchId/resend-remittance/:providerUid — single provider retry
router.post('/admin/wallet/payout-batches/:batchId/resend-remittance/:providerUid', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';
    const { batchId, providerUid } = req.params;

    // Load remittance log entry — create pending if doesn't exist
    const existing: any = await db.execute(sql`
      SELECT id, status, retry_count FROM remittance_email_log
      WHERE batch_id = ${batchId} AND provider_uid = ${providerUid}
    `);
    const existingRow = (existing?.rows ?? existing ?? [])[0];
    if (existingRow?.status === 'sent') {
      return res.status(409).json({ error: 'Already sent successfully. Use force=true to resend.', status: 'sent' });
    }

    // Load batch entries for this provider
    const entriesRaw: any = await db.execute(sql`
      SELECT SUM(gross_cents) AS gross, SUM(net_cents) AS net, COUNT(*) AS entry_count
      FROM provider_payout_entries
      WHERE payout_batch_id = ${batchId} AND provider_uid = ${providerUid}
    `);
    const provData = (entriesRaw?.rows ?? entriesRaw ?? [])[0];
    if (!provData || Number(provData.entry_count ?? 0) === 0) {
      return res.status(404).json({ error: 'No entries found for this provider in this batch', batchId, providerUid });
    }

    // Look up provider email
    let providerEmail: string | null = null;
    try {
      const userRow: any = await db.execute(sql`SELECT email FROM users WHERE id = ${providerUid} LIMIT 1`);
      providerEmail = (userRow?.rows ?? userRow ?? [])[0]?.email ?? null;
      if (!providerEmail) {
        const appRow: any = await db.execute(sql`SELECT email FROM provider_applications WHERE user_id = ${providerUid} ORDER BY id DESC LIMIT 1`);
        providerEmail = (appRow?.rows ?? appRow ?? [])[0]?.email ?? null;
      }
    } catch (_) {}

    if (!providerEmail) {
      const newRetry = (existingRow?.retry_count ?? 0) + 1;
      await db.execute(sql`
        INSERT INTO remittance_email_log (batch_id, provider_uid, status, error_detail, retry_count, last_retry_at)
        VALUES (${batchId}, ${providerUid}, 'failed', 'No email address found for provider', ${newRetry}, NOW())
        ON CONFLICT (batch_id, provider_uid) DO UPDATE
          SET status = 'failed', error_detail = 'No email address found for provider',
              retry_count = remittance_email_log.retry_count + 1, last_retry_at = NOW()
      `);
      return res.status(422).json({ ok: false, error: 'No email address found for provider', providerUid });
    }

    const grossIls = (Number(provData.gross) / 100).toFixed(2);
    const netIls   = (Number(provData.net)   / 100).toFixed(2);
    const commIls  = ((Number(provData.gross) - Number(provData.net)) / 100).toFixed(2);

    const subject = `PetWash™ — Remittance Statement | Batch ${batchId}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a1a2e;padding:24px 32px">
          <h1 style="color:#C5A55A;margin:0;font-size:20px">PetWash™ Provider Remittance</h1>
        </div>
        <div style="padding:24px 32px;background:#fff">
          <p style="color:#555;font-size:14px">Dear Provider,</p>
          <p style="color:#555;font-size:14px">Your payment has been processed for batch <strong>${batchId}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr style="background:#f8f8f8"><td style="padding:10px 14px;color:#888">Batch ID</td><td style="padding:10px 14px;font-family:monospace">${batchId}</td></tr>
            <tr><td style="padding:10px 14px;color:#888">Bookings</td><td style="padding:10px 14px;font-family:monospace">${provData.entry_count}</td></tr>
            <tr style="background:#f8f8f8"><td style="padding:10px 14px;color:#888">Gross Amount</td><td style="padding:10px 14px;font-weight:bold">₪${grossIls}</td></tr>
            <tr><td style="padding:10px 14px;color:#888">Commission</td><td style="padding:10px 14px;color:#e55">₪${commIls}</td></tr>
            <tr style="background:#f0f9f0"><td style="padding:10px 14px;color:#2a7a2a;font-weight:bold">Net Payment</td><td style="padding:10px 14px;color:#2a7a2a;font-weight:bold;font-size:16px">₪${netIls}</td></tr>
          </table>
          <p style="color:#888;font-size:12px;margin-top:8px;padding:6px 0;border-top:1px solid #eee">Resent by admin — for questions contact finance@petwash.co.il</p>
        </div>
      </div>
    `;

    let sendOk = false;
    let errorDetail: string | null = null;
    try { sendOk = await EmailService.send({ to: providerEmail, subject, html }); }
    catch (e: any) { errorDetail = e.message ?? 'Email send error'; }
    if (!errorDetail && !sendOk) errorDetail = 'EmailService returned false';

    const newRetry = (existingRow?.retry_count ?? 0) + 1;
    const status = sendOk ? 'sent' : 'failed';
    await db.execute(sql`
      INSERT INTO remittance_email_log (batch_id, provider_uid, status, sent_at, error_detail, retry_count, last_retry_at)
      VALUES (${batchId}, ${providerUid}, ${status}, ${sendOk ? new Date() : null}, ${errorDetail}, ${newRetry}, NOW())
      ON CONFLICT (batch_id, provider_uid) DO UPDATE
        SET status = ${status}, sent_at = ${sendOk ? new Date() : null}, error_detail = ${errorDetail},
            retry_count = remittance_email_log.retry_count + 1, last_retry_at = NOW()
    `);

    logger.info('[Remittance][Resend]', { batchId, providerUid, status, adminUid });
    await recordFinanceAction(adminUid, 'remittance_resend', 'payout_batch', batchId, null,
      { providerUid, status, retryCount: newRetry }, req.ip);

    return res.json({ ok: sendOk, batchId, providerUid, status, to: providerEmail, retryCount: newRetry, error: errorDetail });
  } catch (err: any) {
    logger.error('[Remittance][Resend] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to resend remittance', detail: err.message });
  }
});

// POST /admin/wallet/payout-batches/:batchId/retry-failed — bulk retry all failed providers
router.post('/admin/wallet/payout-batches/:batchId/retry-failed', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';
    const { batchId } = req.params;

    // Load all failed entries for this batch
    const failedRaw: any = await db.execute(sql`
      SELECT provider_uid, retry_count FROM remittance_email_log
      WHERE batch_id = ${batchId} AND status = 'failed'
    `);
    const failedProviders: any[] = failedRaw?.rows ?? failedRaw ?? [];
    if (failedProviders.length === 0) {
      return res.json({ ok: true, message: 'No failed remittances found for this batch', retried: 0 });
    }

    const results: Array<{ providerUid: string; status: string; error?: string }> = [];

    for (const fp of failedProviders) {
      const providerUid = fp.provider_uid;

      // Load batch entries for this provider
      const entRaw: any = await db.execute(sql`
        SELECT SUM(gross_cents) AS gross, SUM(net_cents) AS net, COUNT(*) AS entry_count
        FROM provider_payout_entries
        WHERE payout_batch_id = ${batchId} AND provider_uid = ${providerUid}
      `);
      const provData = (entRaw?.rows ?? entRaw ?? [])[0];

      // Look up email
      let providerEmail: string | null = null;
      try {
        const userRow: any = await db.execute(sql`SELECT email FROM users WHERE id = ${providerUid} LIMIT 1`);
        providerEmail = (userRow?.rows ?? userRow ?? [])[0]?.email ?? null;
        if (!providerEmail) {
          const appRow: any = await db.execute(sql`SELECT email FROM provider_applications WHERE user_id = ${providerUid} ORDER BY id DESC LIMIT 1`);
          providerEmail = (appRow?.rows ?? appRow ?? [])[0]?.email ?? null;
        }
      } catch (_) {}

      if (!providerEmail) {
        await db.execute(sql`
          UPDATE remittance_email_log
          SET retry_count = retry_count + 1, last_retry_at = NOW(),
              error_detail = 'No email address found for provider'
          WHERE batch_id = ${batchId} AND provider_uid = ${providerUid}
        `);
        results.push({ providerUid, status: 'failed', error: 'No email address found' });
        continue;
      }

      const grossIls = (Number(provData?.gross ?? 0) / 100).toFixed(2);
      const netIls   = (Number(provData?.net   ?? 0) / 100).toFixed(2);
      const commIls  = ((Number(provData?.gross ?? 0) - Number(provData?.net ?? 0)) / 100).toFixed(2);
      const subject  = `PetWash™ — Remittance Statement | Batch ${batchId}`;
      const html     = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1a2e;padding:24px 32px"><h1 style="color:#C5A55A;margin:0;font-size:20px">PetWash™ Provider Remittance</h1></div><div style="padding:24px 32px;background:#fff"><p style="color:#555;font-size:14px">Dear Provider, your payment for batch <strong>${batchId}</strong> — Net: <strong>₪${netIls}</strong> (Gross ₪${grossIls} - Commission ₪${commIls}) — has been processed.</p><p style="color:#888;font-size:11px">Resent automatically. Questions? finance@petwash.co.il</p></div></div>`;

      let sendOk = false;
      let errorDetail: string | null = null;
      try { sendOk = await EmailService.send({ to: providerEmail, subject, html }); }
      catch (e: any) { errorDetail = e.message; }
      if (!errorDetail && !sendOk) errorDetail = 'EmailService returned false';

      await db.execute(sql`
        UPDATE remittance_email_log
        SET status = ${sendOk ? 'sent' : 'failed'},
            sent_at = ${sendOk ? new Date() : null},
            error_detail = ${errorDetail},
            retry_count = retry_count + 1,
            last_retry_at = NOW()
        WHERE batch_id = ${batchId} AND provider_uid = ${providerUid}
      `);

      results.push({ providerUid, status: sendOk ? 'sent' : 'failed', error: errorDetail ?? undefined });
    }

    const sentCount   = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    logger.info('[Remittance][RetryFailed]', { batchId, retried: results.length, sent: sentCount, failed: failedCount, adminUid });
    await recordFinanceAction(adminUid, 'remittance_retry_failed', 'payout_batch', batchId, null,
      { retried: results.length, sent: sentCount, failed: failedCount }, req.ip);

    return res.json({ ok: true, batchId, retried: results.length, sent: sentCount, failed: failedCount, results });
  } catch (err: any) {
    logger.error('[Remittance][RetryFailed] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retry failed remittances', detail: err.message });
  }
});

// ── Phase 3.2C: Dispute Escalation Automation ────────────────────────────

// POST /admin/wallet/disputes/:caseRef/escalate — manual escalation (additive, never mutates original)
router.post('/admin/wallet/disputes/:caseRef/escalate', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';
    const { caseRef } = req.params;
    const { note } = req.body as { note?: string };

    // Load the case — must exist and not already be escalated
    const caseRaw: any = await db.execute(sql`
      SELECT id, status, escalated_at, amount_disputed_cents, opened_at
      FROM dispute_cases WHERE case_ref = ${caseRef} LIMIT 1
    `);
    const dc = (caseRaw?.rows ?? caseRaw ?? [])[0];
    if (!dc) return res.status(404).json({ error: 'Dispute case not found', caseRef });
    if (dc.escalated_at) return res.status(409).json({ error: 'Case already escalated', caseRef, escalatedAt: dc.escalated_at });

    const now = new Date();
    await db.execute(sql`
      UPDATE dispute_cases
      SET status = 'escalated', escalated_at = ${now}, escalated_by = ${adminUid},
          escalation_note = ${note ?? 'Manually escalated by admin'}, updated_at = ${now}
      WHERE case_ref = ${caseRef}
    `);

    logger.info('[Dispute][Escalate]', { caseRef, adminUid, note });
    await recordFinanceAction(adminUid, 'dispute_escalation', 'dispute_case', caseRef, null,
      { note: note ?? 'manual', previousStatus: dc.status }, req.ip);

    // Raise a finance alert for critical dispute escalation
    const isHighValue = Number(dc.amount_disputed_cents ?? 0) >= 50000;
    await db.execute(sql`
      INSERT INTO finance_alerts (alert_type, severity, entity_type, entity_id, detail)
      VALUES ('dispute_escalated', ${isHighValue ? 'critical' : 'warning'},
              'dispute_case', ${caseRef},
              ${JSON.stringify({ caseRef, escalatedBy: adminUid, note: note ?? 'manual', isHighValue })})
    `);

    return res.json({ ok: true, caseRef, escalatedAt: now, escalatedBy: adminUid });
  } catch (err: any) {
    logger.error('[Dispute][Escalate] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to escalate dispute', detail: err.message });
  }
});

// POST /admin/wallet/disputes/auto-escalate — scan & auto-escalate SLA-breached cases (called by scheduler)
router.post('/admin/wallet/disputes/auto-escalate', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin && req.headers['x-internal-job'] !== 'petwash-cron') {
      return res.status(403).json({ error: 'Admin or internal cron only' });
    }
    const now = new Date();

    // Find open disputes that have breached SLA and are not yet escalated
    const candidatesRaw: any = await db.execute(sql`
      SELECT case_ref, amount_disputed_cents, opened_at, status
      FROM dispute_cases
      WHERE status IN ('open', 'investigating')
        AND escalated_at IS NULL
        AND (
          (amount_disputed_cents >= 50000 AND opened_at < NOW() - INTERVAL '24 hours') OR
          (amount_disputed_cents <  50000 AND opened_at < NOW() - INTERVAL '72 hours')
        )
    `);
    const candidates: any[] = candidatesRaw?.rows ?? candidatesRaw ?? [];

    const escalated: string[] = [];
    for (const dc of candidates) {
      const slaLabel = Number(dc.amount_disputed_cents) >= 50000 ? '24h' : '72h';
      await db.execute(sql`
        UPDATE dispute_cases
        SET status = 'escalated', escalated_at = ${now}, escalated_by = 'system',
            escalation_note = ${`Auto-escalated: SLA (${slaLabel}) exceeded`}, updated_at = ${now}
        WHERE case_ref = ${dc.case_ref}
      `);
      await db.execute(sql`
        INSERT INTO finance_alerts (alert_type, severity, entity_type, entity_id, detail)
        VALUES ('sla_breach_auto_escalated', 'critical', 'dispute_case', ${dc.case_ref},
                ${JSON.stringify({ caseRef: dc.case_ref, slaLabel, amountCents: dc.amount_disputed_cents, openedAt: dc.opened_at })})
      `);
      escalated.push(dc.case_ref);
    }

    logger.info('[Dispute][AutoEscalate]', { escalated: escalated.length });
    return res.json({ ok: true, escalated: escalated.length, caseRefs: escalated });
  } catch (err: any) {
    logger.error('[Dispute][AutoEscalate] error', { error: err.message });
    return res.status(500).json({ error: 'Auto-escalate failed', detail: err.message });
  }
});

// ── Phase 3.2D: Finance Alerts ────────────────────────────────────────────

// GET /admin/wallet/alerts — all unacknowledged alerts (+ optional filter)
router.get('/admin/wallet/alerts', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const includeAck  = req.query.includeAcknowledged === 'true';
    const severity    = (req.query.severity as string) || null;
    const limit       = Math.min(Number(req.query.limit ?? 50), 200);

    let whereClause = includeAck ? sql`1=1` : sql`acknowledged_at IS NULL`;
    if (severity) {
      whereClause = includeAck
        ? sql`severity = ${severity}`
        : sql`acknowledged_at IS NULL AND severity = ${severity}`;
    }

    const alertsRaw: any = await db.execute(sql`
      SELECT id, alert_type, severity, entity_type, entity_id, detail, acknowledged_at, acknowledged_by, created_at
      FROM finance_alerts
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    const alerts = (alertsRaw?.rows ?? alertsRaw ?? []).map((a: any) => ({
      id: a.id,
      alertType: a.alert_type,
      severity: a.severity,
      entityType: a.entity_type,
      entityId: a.entity_id,
      detail: typeof a.detail === 'string' ? JSON.parse(a.detail) : (a.detail ?? {}),
      acknowledgedAt: a.acknowledged_at,
      acknowledgedBy: a.acknowledged_by,
      createdAt: a.created_at,
    }));

    const countRaw: any = await db.execute(sql`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
             COUNT(*) FILTER (WHERE severity = 'warning')  AS warning,
             COUNT(*) FILTER (WHERE severity = 'info')     AS info
      FROM finance_alerts WHERE acknowledged_at IS NULL
    `);
    const counts = (countRaw?.rows ?? countRaw ?? [])[0] ?? {};

    return res.json({
      ok: true, alerts,
      unacknowledged: {
        total:    Number(counts.total    ?? 0),
        critical: Number(counts.critical ?? 0),
        warning:  Number(counts.warning  ?? 0),
        info:     Number(counts.info     ?? 0),
      },
    });
  } catch (err: any) {
    logger.error('[FinanceAlerts][Get] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch alerts', detail: err.message });
  }
});

// POST /admin/wallet/alerts/:alertId/acknowledge — mark one alert as acknowledged
router.post('/admin/wallet/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';
    const alertId  = Number(req.params.alertId);

    await db.execute(sql`
      UPDATE finance_alerts
      SET acknowledged_at = NOW(), acknowledged_by = ${adminUid}
      WHERE id = ${alertId} AND acknowledged_at IS NULL
    `);
    logger.info('[FinanceAlerts][Ack]', { alertId, adminUid });
    return res.json({ ok: true, alertId });
  } catch (err: any) {
    logger.error('[FinanceAlerts][Ack] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to acknowledge alert', detail: err.message });
  }
});

// POST /admin/wallet/alerts/acknowledge-all — bulk acknowledge all unread
router.post('/admin/wallet/alerts/acknowledge-all', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';

    const result: any = await db.execute(sql`
      UPDATE finance_alerts SET acknowledged_at = NOW(), acknowledged_by = ${adminUid}
      WHERE acknowledged_at IS NULL
    `);
    logger.info('[FinanceAlerts][AckAll]', { adminUid });
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error('[FinanceAlerts][AckAll] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to acknowledge all alerts', detail: err.message });
  }
});

// ── Phase 3.3A: Reconciliation Exception Workflow ─────────────────────────

// GET /admin/wallet/reconciliation-exceptions
router.get('/admin/wallet/reconciliation-exceptions', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { status, batchId, providerUid, assignedAdminUid, from, to } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (status)           conditions.push(sql`status = ${status}`);
    if (batchId)          conditions.push(sql`batch_id = ${batchId}`);
    if (providerUid)      conditions.push(sql`provider_uid = ${providerUid}`);
    if (assignedAdminUid) conditions.push(sql`assigned_admin_uid = ${assignedAdminUid}`);
    if (from)             conditions.push(sql`created_at >= ${from}::timestamptz`);
    if (to)               conditions.push(sql`created_at <= ${to}::timestamptz`);
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const raw: any = await db.execute(sql`
      SELECT * FROM bank_reconciliation_exceptions ${whereClause} ORDER BY created_at DESC
    `);
    const rows = raw?.rows ?? raw ?? [];

    const summary = {
      open: rows.filter((r: any) => r.status === 'open').length,
      matched_manually: rows.filter((r: any) => r.status === 'matched_manually').length,
      ignored: rows.filter((r: any) => r.status === 'ignored').length,
      escalated: rows.filter((r: any) => r.status === 'escalated').length,
      total: rows.length,
    };

    return res.json({ ok: true, exceptions: rows, summary });
  } catch (err: any) {
    logger.error('[ReconExceptions][GET] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch reconciliation exceptions', detail: err.message });
  }
});

// PATCH /admin/wallet/reconciliation-exceptions/:id — assign / ignore / escalate / add note
router.patch('/admin/wallet/reconciliation-exceptions/:id', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';

    const exId = parseInt(req.params.id, 10);
    const { action, assignedAdminUid, note } = req.body as {
      action: 'assign' | 'ignore' | 'escalate' | 'note';
      assignedAdminUid?: string;
      note?: string;
    };

    const existing: any = await db.execute(sql`SELECT * FROM bank_reconciliation_exceptions WHERE id = ${exId} LIMIT 1`);
    const ex = (existing?.rows ?? existing ?? [])[0];
    if (!ex) return res.status(404).json({ error: 'Exception not found' });

    if (action === 'assign') {
      await db.execute(sql`UPDATE bank_reconciliation_exceptions SET assigned_admin_uid = ${assignedAdminUid ?? adminUid} WHERE id = ${exId}`);
    } else if (action === 'ignore') {
      await db.execute(sql`UPDATE bank_reconciliation_exceptions SET status = 'ignored', resolved_at = NOW(), resolution_note = ${note ?? ''} WHERE id = ${exId}`);
    } else if (action === 'escalate') {
      await db.execute(sql`UPDATE bank_reconciliation_exceptions SET status = 'escalated' WHERE id = ${exId}`);
      await db.execute(sql`
        INSERT INTO finance_alerts (alert_type, severity, entity_type, entity_id, detail)
        VALUES ('recon_exception_escalated', 'critical', 'recon_exception', ${String(exId)},
                ${JSON.stringify({ batchId: ex.batch_id, providerUid: ex.provider_uid, reason: ex.detected_reason })})
      `);
    } else if (action === 'note') {
      await db.execute(sql`UPDATE bank_reconciliation_exceptions SET resolution_note = ${note ?? ''} WHERE id = ${exId}`);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await recordFinanceAction(adminUid, 'recon_exception_update', 'recon_exception', String(exId), null,
      { action, note: note ?? null, assignedAdminUid: assignedAdminUid ?? null }, req.ip);

    return res.json({ ok: true, exceptionId: exId, action });
  } catch (err: any) {
    logger.error('[ReconExceptions][PATCH] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update exception', detail: err.message });
  }
});

// POST /admin/wallet/reconciliation-exceptions/:id/match — manual match to payout entry
router.post('/admin/wallet/reconciliation-exceptions/:id/match', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';

    const exId = parseInt(req.params.id, 10);
    const { payoutEntryId, reason } = req.body as { payoutEntryId: number; reason: string };
    if (!payoutEntryId) return res.status(400).json({ error: 'payoutEntryId required' });

    const existing: any = await db.execute(sql`SELECT * FROM bank_reconciliation_exceptions WHERE id = ${exId} LIMIT 1`);
    const ex = (existing?.rows ?? existing ?? [])[0];
    if (!ex) return res.status(404).json({ error: 'Exception not found' });
    if (ex.status === 'matched_manually') return res.status(409).json({ error: 'Already matched' });

    // Settle the target payout entry
    await db.execute(sql`
      UPDATE provider_payout_entries
      SET settled_at = NOW(), status = 'settled'
      WHERE id = ${payoutEntryId}
    `);

    // Close the exception
    await db.execute(sql`
      UPDATE bank_reconciliation_exceptions
      SET status = 'matched_manually',
          matched_payout_entry_id = ${payoutEntryId},
          resolution_note = ${reason ?? ''},
          resolved_at = NOW()
      WHERE id = ${exId}
    `);

    await recordFinanceAction(adminUid, 'recon_exception_manual_match', 'recon_exception', String(exId), null,
      { payoutEntryId, reason }, req.ip);

    return res.json({ ok: true, exceptionId: exId, payoutEntryId, status: 'matched_manually' });
  } catch (err: any) {
    logger.error('[ReconExceptions][Match] error', { error: err.message });
    return res.status(500).json({ error: 'Manual match failed', detail: err.message });
  }
});

// ── Phase 3.3B: Alert Digests & Escalation Ladders ─────────────────────────

// GET /admin/wallet/alerts/delivery-log
router.get('/admin/wallet/alerts/delivery-log', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { alertId, from, to } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (alertId) conditions.push(sql`d.alert_id = ${parseInt(alertId, 10)}`);
    if (from)    conditions.push(sql`d.sent_at >= ${from}::timestamptz`);
    if (to)      conditions.push(sql`d.sent_at <= ${to}::timestamptz`);
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const raw: any = await db.execute(sql`
      SELECT d.*, a.alert_type, a.severity
      FROM finance_alert_deliveries d
      LEFT JOIN finance_alerts a ON a.id = d.alert_id
      ${whereClause}
      ORDER BY d.sent_at DESC LIMIT 200
    `);
    return res.json({ ok: true, deliveries: raw?.rows ?? raw ?? [] });
  } catch (err: any) {
    logger.error('[AlertDelivery][Log] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch delivery log', detail: err.message });
  }
});

// POST /admin/wallet/alerts/:id/escalate-now — manually escalate a critical alert
router.post('/admin/wallet/alerts/:id/escalate-now', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';

    const alertId = parseInt(req.params.id, 10);
    const raw: any = await db.execute(sql`SELECT * FROM finance_alerts WHERE id = ${alertId} LIMIT 1`);
    const alert = (raw?.rows ?? raw ?? [])[0];
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const newLevel = (alert.escalation_level ?? 0) + 1;
    await db.execute(sql`
      UPDATE finance_alerts SET escalation_level = ${newLevel}, escalated_at = NOW() WHERE id = ${alertId}
    `);
    // Record delivery attempt
    await db.execute(sql`
      INSERT INTO finance_alert_deliveries (alert_id, delivery_type, recipient_uid, status)
      VALUES (${alertId}, 'escalation', ${adminUid}, 'sent')
    `);
    await recordFinanceAction(adminUid, 'alert_escalate_now', 'finance_alert', String(alertId), null,
      { newLevel }, req.ip);

    return res.json({ ok: true, alertId, escalationLevel: newLevel });
  } catch (err: any) {
    logger.error('[AlertEscalate][Now] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to escalate alert', detail: err.message });
  }
});

// GET /admin/wallet/alerts/digest-preview — grouped preview of unacknowledged alerts
router.get('/admin/wallet/alerts/digest-preview', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const raw: any = await db.execute(sql`
      SELECT alert_type, severity, COUNT(*) as count
      FROM finance_alerts WHERE acknowledged_at IS NULL
      GROUP BY alert_type, severity
      ORDER BY severity DESC, count DESC
    `);
    const groups = raw?.rows ?? raw ?? [];

    const totalRaw: any = await db.execute(sql`SELECT COUNT(*) as total FROM finance_alerts WHERE acknowledged_at IS NULL`);
    const total = parseInt((totalRaw?.rows ?? totalRaw ?? [])[0]?.total ?? '0', 10);

    return res.json({
      ok: true,
      period: new Date().toISOString().slice(0, 10),
      total,
      groups,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[AlertDigest][Preview] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate digest preview', detail: err.message });
  }
});

// ── Phase 3.2E: Monthly Sign-off Workflow ─────────────────────────────────

// GET /admin/wallet/monthly-signoff?month=YYYY-MM — get sign-off status
router.get('/admin/wallet/monthly-signoff', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

    const rowRaw: any = await db.execute(sql`
      SELECT id, month, signed_off_by, signed_off_at, notes, is_final
      FROM monthly_signoffs WHERE month = ${month} LIMIT 1
    `);
    const row = (rowRaw?.rows ?? rowRaw ?? [])[0];

    if (!row) return res.json({ ok: true, month, signedOff: false, signOff: null });
    return res.json({
      ok: true, month, signedOff: true,
      signOff: {
        id: row.id,
        month: row.month,
        signedOffBy: row.signed_off_by,
        signedOffAt: row.signed_off_at,
        notes: row.notes,
        isFinal: row.is_final,
      },
    });
  } catch (err: any) {
    logger.error('[MonthlySignoff][Get] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch sign-off status', detail: err.message });
  }
});

// POST /admin/wallet/monthly-signoff — irreversible sign-off
router.post('/admin/wallet/monthly-signoff', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';
    const { month, notes } = req.body as { month?: string; notes?: string };

    const targetMonth = month || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
    }

    // Check if already signed off (irreversible)
    const existingRaw: any = await db.execute(sql`
      SELECT id, signed_off_by, signed_off_at FROM monthly_signoffs WHERE month = ${targetMonth} LIMIT 1
    `);
    const existing = (existingRaw?.rows ?? existingRaw ?? [])[0];
    if (existing) {
      return res.status(409).json({
        error: 'Month already signed off — this action is irreversible.',
        month: targetMonth,
        signedOffBy: existing.signed_off_by,
        signedOffAt: existing.signed_off_at,
      });
    }

    const signedOffAt = new Date();
    await db.execute(sql`
      INSERT INTO monthly_signoffs (month, signed_off_by, signed_off_at, notes, is_final)
      VALUES (${targetMonth}, ${adminUid}, ${signedOffAt}, ${notes ?? null}, TRUE)
    `);

    logger.info('[MonthlySignoff][Create]', { month: targetMonth, adminUid });
    await recordFinanceAction(adminUid, 'monthly_signoff', 'month', targetMonth, null,
      { month: targetMonth, notes: notes ?? null }, req.ip);

    // Fire a confirmation alert
    await db.execute(sql`
      INSERT INTO finance_alerts (alert_type, severity, entity_type, entity_id, detail)
      VALUES ('monthly_signoff', 'info', 'month', ${targetMonth},
              ${JSON.stringify({ month: targetMonth, signedOffBy: adminUid })})
    `);

    return res.json({ ok: true, month: targetMonth, signedOffBy: adminUid, signedOffAt, isFinal: true });
  } catch (err: any) {
    logger.error('[MonthlySignoff][Create] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to sign off month', detail: err.message });
  }
});

// ── Phase 3.2F: Close-to-Close Variance Commentary ───────────────────────

// GET /admin/wallet/variance-commentary?month=YYYY-MM — all comments for a month
router.get('/admin/wallet/variance-commentary', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

    const rowsRaw: any = await db.execute(sql`
      SELECT id, month, metric, comment, author_uid, created_at, updated_at
      FROM variance_comments WHERE month = ${month} ORDER BY metric
    `);
    const comments = (rowsRaw?.rows ?? rowsRaw ?? []).map((r: any) => ({
      id: r.id, month: r.month, metric: r.metric, comment: r.comment,
      authorUid: r.author_uid, createdAt: r.created_at, updatedAt: r.updated_at,
    }));
    return res.json({ ok: true, month, comments });
  } catch (err: any) {
    logger.error('[VarianceCommentary][Get] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch commentary', detail: err.message });
  }
});

// POST /admin/wallet/variance-commentary — upsert commentary for a month+metric (mutable)
router.post('/admin/wallet/variance-commentary', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'write');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';
    const { month, metric, comment } = req.body as { month?: string; metric?: string; comment?: string };

    if (!month || !metric || comment === undefined) {
      return res.status(400).json({ error: 'month, metric, and comment are required' });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
    if (comment.length > 2000) return res.status(400).json({ error: 'Comment must be ≤2000 characters' });

    await db.execute(sql`
      INSERT INTO variance_comments (month, metric, comment, author_uid)
      VALUES (${month}, ${metric}, ${comment}, ${adminUid})
      ON CONFLICT (month, metric) DO UPDATE
        SET comment = ${comment}, author_uid = ${adminUid}, updated_at = NOW()
    `);

    logger.info('[VarianceCommentary][Upsert]', { month, metric, adminUid });
    return res.json({ ok: true, month, metric, comment });
  } catch (err: any) {
    logger.error('[VarianceCommentary][Upsert] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to save commentary', detail: err.message });
  }
});

// ── Phase 3.3C: Sign-off Export Pack ─────────────────────────────────────

// GET /admin/wallet/monthly-signoff/:month/export — deterministic JSON pack
router.get('/admin/wallet/monthly-signoff/:month/export', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const month = req.params.month;
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });

    // Sign-off record (must exist)
    const soRaw: any = await db.execute(sql`SELECT * FROM monthly_signoffs WHERE month = ${month} LIMIT 1`);
    const signOff = (soRaw?.rows ?? soRaw ?? [])[0];
    if (!signOff) return res.status(404).json({ error: 'Month not signed off yet. Sign off before exporting.' });

    // Settlement summary
    const settleRaw: any = await db.execute(sql`
      SELECT COUNT(*) AS total_entries,
             SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) AS settled_count,
             SUM(gross_cents) AS total_gross_cents,
             SUM(net_cents) AS total_net_cents
      FROM provider_payout_entries ppe
      JOIN payout_batches pb ON pb.batch_id = ppe.payout_batch_id
      WHERE TO_CHAR(pb.created_at, 'YYYY-MM') = ${month}
    `);
    const settlement = (settleRaw?.rows ?? settleRaw ?? [])[0];

    // Payout batch summary
    const batchRaw: any = await db.execute(sql`
      SELECT COUNT(*) AS batch_count, SUM(total_net_cents) AS total_net_cents,
             SUM(total_providers) AS total_providers
      FROM payout_batches WHERE TO_CHAR(created_at, 'YYYY-MM') = ${month}
    `);
    const batches = (batchRaw?.rows ?? batchRaw ?? [])[0];

    // Reconciliation exceptions summary
    const reconRaw: any = await db.execute(sql`
      SELECT status, COUNT(*) AS count
      FROM bank_reconciliation_exceptions
      WHERE TO_CHAR(created_at, 'YYYY-MM') = ${month}
      GROUP BY status
    `);
    const reconExceptions = (reconRaw?.rows ?? reconRaw ?? []);

    // Dispute SLA summary
    const disputeRaw: any = await db.execute(sql`
      SELECT status, COUNT(*) AS count,
             SUM(amount_disputed_cents) AS total_disputed_cents
      FROM dispute_cases WHERE TO_CHAR(opened_at, 'YYYY-MM') = ${month}
      GROUP BY status
    `);
    const disputes = (disputeRaw?.rows ?? disputeRaw ?? []);

    // Finance alerts summary
    const alertsRaw: any = await db.execute(sql`
      SELECT severity, COUNT(*) AS count,
             SUM(CASE WHEN acknowledged_at IS NOT NULL THEN 1 ELSE 0 END) AS acked
      FROM finance_alerts WHERE TO_CHAR(created_at, 'YYYY-MM') = ${month}
      GROUP BY severity
    `);
    const alerts = (alertsRaw?.rows ?? alertsRaw ?? []);

    // Variance commentary
    const commentRaw: any = await db.execute(sql`SELECT metric, comment, author_uid, updated_at FROM variance_comments WHERE month = ${month}`);
    const commentary = (commentRaw?.rows ?? commentRaw ?? []);

    // Build deterministic pack
    const pack = {
      formatVersion: '1.0',
      exportedAt: new Date().toISOString(),
      month,
      signOff: {
        signedOffBy: signOff.signed_off_by,
        signedOffAt: signOff.signed_off_at,
        notes: signOff.notes,
        isFinal: signOff.is_final,
      },
      settlement: {
        totalEntries: Number(settlement?.total_entries ?? 0),
        settledCount: Number(settlement?.settled_count ?? 0),
        totalGrossCents: Number(settlement?.total_gross_cents ?? 0),
        totalNetCents: Number(settlement?.total_net_cents ?? 0),
      },
      batches: {
        batchCount: Number(batches?.batch_count ?? 0),
        totalNetCents: Number(batches?.total_net_cents ?? 0),
        totalProviders: Number(batches?.total_providers ?? 0),
      },
      reconExceptions: reconExceptions.map((r: any) => ({ status: r.status, count: Number(r.count) })),
      disputes: disputes.map((r: any) => ({ status: r.status, count: Number(r.count), totalDisputedCents: Number(r.total_disputed_cents ?? 0) })),
      alerts: alerts.map((r: any) => ({ severity: r.severity, count: Number(r.count), acknowledged: Number(r.acked ?? 0) })),
      commentary: commentary.map((r: any) => ({ metric: r.metric, comment: r.comment, authorUid: r.author_uid, updatedAt: r.updated_at })),
    };

    // Compute deterministic SHA-256 manifest
    const crypto = await import('crypto');
    const packJson = JSON.stringify(pack, Object.keys(pack).sort());
    const hash = crypto.createHash('sha256').update(packJson).digest('hex');

    const finalPack = { ...pack, manifest: { sha256: hash, algorithm: 'sha256' } };

    res.setHeader('Content-Disposition', `attachment; filename="signoff-pack-${month}.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.json(finalPack);
  } catch (err: any) {
    logger.error('[SignoffExport] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate sign-off pack', detail: err.message });
  }
});

// ── Phase 3.3D: Provider Settlement Self-Service ──────────────────────────

// GET /provider/wallet/settlement-status — provider-facing payout lifecycle
router.get('/provider/wallet/settlement-status', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const providerUid = session?.user?.uid ?? session?.user?.id;
    if (!providerUid) return res.status(401).json({ error: 'Not authenticated' });

    const entriesRaw: any = await db.execute(sql`
      SELECT ppe.id, ppe.payout_batch_id, ppe.gross_cents, ppe.net_cents,
             ppe.commission_rate_bps, ppe.status, ppe.settled_at, ppe.bank_ref,
             pb.status AS batch_status, pb.created_at AS batch_created_at,
             pb.notes AS batch_notes
      FROM provider_payout_entries ppe
      JOIN payout_batches pb ON pb.batch_id = ppe.payout_batch_id
      WHERE ppe.provider_uid = ${providerUid}
      ORDER BY ppe.id DESC
      LIMIT 100
    `);
    const entries: any[] = entriesRaw?.rows ?? entriesRaw ?? [];

    const remitRaw: any = await db.execute(sql`
      SELECT rel.batch_id, rel.status, rel.sent_at, rel.retry_count
      FROM remittance_email_log rel
      JOIN payout_batches pb ON pb.batch_id = rel.batch_id
      WHERE rel.provider_uid = ${providerUid}
      ORDER BY rel.sent_at DESC NULLS LAST
      LIMIT 50
    `);
    const remittances: any[] = remitRaw?.rows ?? remitRaw ?? [];

    const summary = {
      totalEntries: entries.length,
      settledCount: entries.filter((e: any) => e.status === 'settled').length,
      pendingCount: entries.filter((e: any) => e.status !== 'settled').length,
      totalNetCents: entries.reduce((s: number, e: any) => s + Number(e.net_cents ?? 0), 0),
      settledNetCents: entries.filter((e: any) => e.status === 'settled').reduce((s: number, e: any) => s + Number(e.net_cents ?? 0), 0),
    };

    return res.json({ ok: true, summary, entries, remittances });
  } catch (err: any) {
    logger.error('[ProviderSettlement][Status] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch settlement status', detail: err.message });
  }
});

// GET /provider/wallet/remittance-log — provider-scoped remittance history
router.get('/provider/wallet/remittance-log', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const providerUid = session?.user?.uid ?? session?.user?.id;
    if (!providerUid) return res.status(401).json({ error: 'Not authenticated' });

    const raw: any = await db.execute(sql`
      SELECT batch_id, status, sent_at, retry_count, last_retry_at, error_detail
      FROM remittance_email_log
      WHERE provider_uid = ${providerUid}
      ORDER BY sent_at DESC NULLS LAST
    `);
    return res.json({ ok: true, log: raw?.rows ?? raw ?? [] });
  } catch (err: any) {
    logger.error('[ProviderSettlement][RemittanceLog] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch remittance log', detail: err.message });
  }
});

// GET /provider/wallet/payout-batch/:batchId — provider-specific batch detail
router.get('/provider/wallet/payout-batch/:batchId', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const providerUid = session?.user?.uid ?? session?.user?.id;
    if (!providerUid) return res.status(401).json({ error: 'Not authenticated' });

    const batchId = req.params.batchId;
    const batchRaw: any = await db.execute(sql`
      SELECT batch_id, status, notes, created_at, total_net_cents, total_providers
      FROM payout_batches WHERE batch_id = ${batchId} LIMIT 1
    `);
    const batch = (batchRaw?.rows ?? batchRaw ?? [])[0];
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const entryRaw: any = await db.execute(sql`
      SELECT id, gross_cents, net_cents, commission_rate_bps, status, settled_at, bank_ref, clawback_reason
      FROM provider_payout_entries
      WHERE payout_batch_id = ${batchId} AND provider_uid = ${providerUid}
    `);
    const entries: any[] = entryRaw?.rows ?? entryRaw ?? [];
    if (entries.length === 0) return res.status(403).json({ error: 'No entries for this provider in this batch' });

    const remitRaw: any = await db.execute(sql`
      SELECT status, sent_at, retry_count FROM remittance_email_log
      WHERE batch_id = ${batchId} AND provider_uid = ${providerUid} LIMIT 1
    `);
    const remittance = (remitRaw?.rows ?? remitRaw ?? [])[0] ?? null;

    return res.json({ ok: true, batch, entries, remittance });
  } catch (err: any) {
    logger.error('[ProviderSettlement][BatchDetail] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch batch detail', detail: err.message });
  }
});

// ── Phase 3.3E: Monthly Board Pack ────────────────────────────────────────

// GET /admin/wallet/board-pack?month=YYYY-MM
router.get('/admin/wallet/board-pack', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });

    // Financial totals
    const finRaw: any = await db.execute(sql`
      SELECT
        SUM(ppe.gross_cents) AS gross_cents,
        SUM(ppe.net_cents) AS net_cents,
        SUM(ppe.gross_cents - ppe.net_cents) AS commission_cents,
        COUNT(DISTINCT ppe.provider_uid) AS provider_count,
        COUNT(*) AS entry_count
      FROM provider_payout_entries ppe
      JOIN payout_batches pb ON pb.batch_id = ppe.payout_batch_id
      WHERE TO_CHAR(pb.created_at, 'YYYY-MM') = ${month}
    `);
    const fin = (finRaw?.rows ?? finRaw ?? [])[0] ?? {};

    // VAT estimate (18%)
    const grossCents = Number(fin.gross_cents ?? 0);
    const netCents   = Number(fin.net_cents ?? 0);
    const commCents  = Number(fin.commission_cents ?? 0);
    const vatCents   = Math.round(grossCents * 0.18 / 1.18);

    // Remittance counts
    const remitRaw: any = await db.execute(sql`
      SELECT status, COUNT(*) AS count FROM remittance_email_log rel
      JOIN payout_batches pb ON pb.batch_id = rel.batch_id
      WHERE TO_CHAR(pb.created_at, 'YYYY-MM') = ${month}
      GROUP BY status
    `);
    const remittances = (remitRaw?.rows ?? remitRaw ?? []);

    // Reconciliation exceptions
    const reconRaw: any = await db.execute(sql`
      SELECT status, COUNT(*) AS count
      FROM bank_reconciliation_exceptions
      WHERE TO_CHAR(created_at, 'YYYY-MM') = ${month}
      GROUP BY status
    `);
    const reconExceptions = (reconRaw?.rows ?? reconRaw ?? []);
    const openExceptions = reconExceptions.find((r: any) => r.status === 'open');

    // Dispute SLA compliance
    const disputeRaw: any = await db.execute(sql`
      SELECT case_ref, amount_disputed_cents, opened_at, resolved_at, status
      FROM dispute_cases WHERE TO_CHAR(opened_at, 'YYYY-MM') = ${month}
    `);
    const disputeRows: any[] = disputeRaw?.rows ?? disputeRaw ?? [];
    const totalDisputes = disputeRows.length;
    const resolvedDisputes = disputeRows.filter((d: any) => ['resolved', 'closed'].includes(d.status)).length;
    const slaMetCount = disputeRows.filter((d: any) => {
      const secs = (new Date(d.resolved_at ?? new Date()).getTime() - new Date(d.opened_at).getTime()) / 1000;
      const threshold = Number(d.amount_disputed_cents) >= 50000 ? 24 * 3600 : 72 * 3600;
      return d.resolved_at && secs <= threshold;
    }).length;
    const slaCompliancePct = resolvedDisputes > 0 ? Math.round((slaMetCount / resolvedDisputes) * 100) : 100;

    // Variance — top movers vs prior month
    const priorMonth = (() => {
      const [y, m] = month.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();
    const priorRaw: any = await db.execute(sql`
      SELECT SUM(ppe.gross_cents) AS gross_cents, SUM(ppe.net_cents) AS net_cents
      FROM provider_payout_entries ppe
      JOIN payout_batches pb ON pb.batch_id = ppe.payout_batch_id
      WHERE TO_CHAR(pb.created_at, 'YYYY-MM') = ${priorMonth}
    `);
    const prior = (priorRaw?.rows ?? priorRaw ?? [])[0] ?? {};
    const priorGross = Number(prior.gross_cents ?? 0);
    const grossChangePct = priorGross > 0 ? Math.round(((grossCents - priorGross) / priorGross) * 100) : null;

    // Commentary rollup
    const commentRaw: any = await db.execute(sql`SELECT metric, comment FROM variance_comments WHERE month = ${month}`);
    const commentary: any[] = commentRaw?.rows ?? commentRaw ?? [];

    // Sign-off state
    const soRaw: any = await db.execute(sql`SELECT * FROM monthly_signoffs WHERE month = ${month} LIMIT 1`);
    const signOff = (soRaw?.rows ?? soRaw ?? [])[0] ?? null;

    // Key risks
    const risks: string[] = [];
    if (Number(openExceptions?.count ?? 0) > 0) risks.push(`${openExceptions.count} open reconciliation exception(s) require review`);
    if (slaCompliancePct < 80) risks.push(`Dispute SLA compliance at ${slaCompliancePct}% — below 80% threshold`);
    if (grossChangePct !== null && grossChangePct < -15) risks.push(`Gross payout down ${Math.abs(grossChangePct)}% vs prior month`);
    if (!signOff) risks.push('Month not yet signed off');

    return res.json({
      ok: true, month,
      financials: {
        grossCents, netCents, commissionCents: commCents, vatCents,
        netMarginPct: grossCents > 0 ? Math.round((commCents / grossCents) * 100) : 0,
      },
      providerCount: Number(fin.provider_count ?? 0),
      entryCount: Number(fin.entry_count ?? 0),
      remittances,
      reconExceptions,
      disputes: { total: totalDisputes, resolved: resolvedDisputes, slaCompliancePct },
      varianceVsPrior: { priorMonth, grossChangePct },
      commentary,
      signOff: signOff ? {
        signedOffBy: signOff.signed_off_by,
        signedOffAt: signOff.signed_off_at,
        isFinal: signOff.is_final,
      } : null,
      risks,
    });
  } catch (err: any) {
    logger.error('[BoardPack] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate board pack', detail: err.message });
  }
});

// ── Phase 3.3F: Cross-Check Integrity Jobs ────────────────────────────────

// POST /admin/wallet/integrity/run — trigger all integrity jobs immediately
router.post('/admin/wallet/integrity/run', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';

    const results: any[] = [];
    const runJob = async (jobName: string, checkFn: () => Promise<{ findings: any[]; summary: string }>) => {
      const startRaw: any = await db.execute(sql`
        INSERT INTO integrity_job_runs (job_name, started_at, status) VALUES (${jobName}, NOW(), 'running') RETURNING id
      `);
      const runId = (startRaw?.rows ?? startRaw ?? [])[0]?.id;
      try {
        const { findings, summary } = await checkFn();
        const status = findings.length === 0 ? 'passed' : 'failed';
        await db.execute(sql`
          UPDATE integrity_job_runs SET status = ${status}, completed_at = NOW(),
            findings_count = ${findings.length}, summary = ${JSON.stringify({ summary, findings: findings.slice(0, 20) })}
          WHERE id = ${runId}
        `);
        if (findings.length > 0) {
          await db.execute(sql`
            INSERT INTO finance_alerts (alert_type, severity, entity_type, entity_id, detail)
            VALUES ('integrity_check_failed', 'critical', 'integrity_job', ${jobName},
                    ${JSON.stringify({ jobName, findingsCount: findings.length, summary })})
          `);
        }
        results.push({ jobName, status, findingsCount: findings.length, summary });
      } catch (err: any) {
        await db.execute(sql`UPDATE integrity_job_runs SET status = 'error', completed_at = NOW() WHERE id = ${runId}`);
        results.push({ jobName, status: 'error', error: err.message });
      }
    };

    // Job 1: Batch vs payout entry totals
    await runJob('batch_vs_entries', async () => {
      const raw: any = await db.execute(sql`
        SELECT pb.batch_id, pb.total_net_cents AS declared_net,
               COALESCE(SUM(ppe.net_cents), 0) AS actual_net
        FROM payout_batches pb
        LEFT JOIN provider_payout_entries ppe ON ppe.payout_batch_id = pb.batch_id
        GROUP BY pb.batch_id, pb.total_net_cents
        HAVING ABS(pb.total_net_cents - COALESCE(SUM(ppe.net_cents), 0)) > 1
      `);
      const rows: any[] = raw?.rows ?? raw ?? [];
      return { findings: rows, summary: rows.length > 0 ? `${rows.length} batches with totals mismatch` : 'All batch totals match' };
    });

    // Job 2: Completed batches with missing remittance coverage
    await runJob('remittance_coverage', async () => {
      const raw: any = await db.execute(sql`
        SELECT pb.batch_id FROM payout_batches pb
        WHERE pb.status IN ('exported', 'completed')
          AND NOT EXISTS (SELECT 1 FROM remittance_email_log rel WHERE rel.batch_id = pb.batch_id)
      `);
      const rows: any[] = raw?.rows ?? raw ?? [];
      return { findings: rows, summary: rows.length > 0 ? `${rows.length} completed batches missing remittance log` : 'All completed batches have remittance coverage' };
    });

    // Job 3: Settled entries without reconciliation proof
    await runJob('settled_without_reconciliation', async () => {
      const raw: any = await db.execute(sql`
        SELECT ppe.id, ppe.payout_batch_id, ppe.provider_uid, ppe.settled_at
        FROM provider_payout_entries ppe
        WHERE ppe.status = 'settled'
          AND ppe.settled_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM bank_reconciliation_uploads bru
            WHERE bru.batch_id = ppe.payout_batch_id
              AND bru.status = 'completed'
          )
          AND NOT EXISTS (
            SELECT 1 FROM bank_reconciliation_exceptions bre
            WHERE bre.matched_payout_entry_id = ppe.id
              AND bre.status = 'matched_manually'
          )
        LIMIT 50
      `);
      const rows: any[] = raw?.rows ?? raw ?? [];
      return { findings: rows, summary: rows.length > 0 ? `${rows.length} settled entries without reconciliation proof` : 'All settled entries have reconciliation proof' };
    });

    // Job 4: Signed months with open critical exceptions
    await runJob('signoff_open_exceptions', async () => {
      const raw: any = await db.execute(sql`
        SELECT ms.month, COUNT(bre.id) AS open_exceptions
        FROM monthly_signoffs ms
        JOIN payout_batches pb ON TO_CHAR(pb.created_at, 'YYYY-MM') = ms.month
        JOIN bank_reconciliation_exceptions bre ON bre.batch_id = pb.batch_id
        WHERE bre.status IN ('open', 'escalated')
        GROUP BY ms.month HAVING COUNT(bre.id) > 0
      `);
      const rows: any[] = raw?.rows ?? raw ?? [];
      return { findings: rows, summary: rows.length > 0 ? `${rows.length} signed months with open reconciliation exceptions` : 'No signed months have open exceptions' };
    });

    // Job 5: Close-to-close continuity (last 2 daily closes)
    await runJob('close_continuity', async () => {
      const raw: any = await db.execute(sql`
        SELECT close_date, collected_ils, settled_ils
        FROM finance_close_records
        ORDER BY close_date DESC LIMIT 2
      `);
      const rows: any[] = raw?.rows ?? raw ?? [];
      if (rows.length < 2) return { findings: [], summary: 'Insufficient close records for continuity check' };
      const [latest, prior] = rows;
      const diff = Math.abs(Number(latest.collected_ils) - Number(prior.collected_ils));
      const pct = Number(prior.collected_ils) > 0 ? (diff / Number(prior.collected_ils)) * 100 : 0;
      const findings = pct > 30 ? [{ latest: latest.close_date, prior: prior.close_date, changePct: Math.round(pct) }] : [];
      return { findings, summary: findings.length > 0 ? `Close-to-close variance >30%: ${Math.round(pct)}%` : 'Close-to-close continuity OK' };
    });

    await recordFinanceAction(adminUid, 'integrity_jobs_run', 'system', 'all', null, { results }, req.ip);

    return res.json({ ok: true, ranAt: new Date().toISOString(), jobs: results });
  } catch (err: any) {
    logger.error('[IntegrityJobs] error', { error: err.message });
    return res.status(500).json({ error: 'Integrity check failed', detail: err.message });
  }
});

// GET /admin/wallet/integrity/history — last run per job
router.get('/admin/wallet/integrity/history', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const raw: any = await db.execute(sql`
      SELECT DISTINCT ON (job_name) job_name, id, started_at, completed_at, status, findings_count, summary
      FROM integrity_job_runs
      ORDER BY job_name, started_at DESC
    `);
    return res.json({ ok: true, history: raw?.rows ?? raw ?? [] });
  } catch (err: any) {
    logger.error('[IntegrityHistory] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch integrity history', detail: err.message });
  }
});

// ── Phase 3.3G: Permission Capabilities ──────────────────────────────────

// GET /admin/wallet/capabilities — list capabilities for a given finance role
router.get('/admin/wallet/capabilities', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const { roleName } = req.query as Record<string, string>;

    const raw: any = roleName
      ? await db.execute(sql`SELECT capability FROM finance_role_capabilities WHERE role_name = ${roleName}`)
      : await db.execute(sql`SELECT role_name, capability FROM finance_role_capabilities ORDER BY role_name, capability`);

    const rows: any[] = raw?.rows ?? raw ?? [];
    if (roleName) {
      return res.json({ ok: true, roleName, capabilities: rows.map((r: any) => r.capability) });
    }

    // Group by role
    const byRole: Record<string, string[]> = {};
    for (const r of rows) {
      if (!byRole[r.role_name]) byRole[r.role_name] = [];
      byRole[r.role_name].push(r.capability);
    }
    return res.json({ ok: true, roleCapabilities: byRole });
  } catch (err: any) {
    logger.error('[Capabilities][GET] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch capabilities', detail: err.message });
  }
});

// POST /admin/wallet/capabilities — grant or revoke a capability for a role (finance_admin only)
router.post('/admin/wallet/capabilities', async (req: Request, res: Response) => {
  try {
    const financeRole = await requireFinanceRole(req, res, 'admin');
    if (!financeRole) return;
    const session  = (req as any).session;
    const adminUid = session.user.uid ?? session.user.id ?? 'unknown';

    const { roleName, capability, action } = req.body as { roleName: string; capability: string; action: 'grant' | 'revoke' };
    if (!roleName || !capability || !action) return res.status(400).json({ error: 'roleName, capability, and action required' });
    if (!['grant', 'revoke'].includes(action)) return res.status(400).json({ error: 'action must be grant or revoke' });
    if (!['finance_read', 'finance_write', 'finance_admin'].includes(roleName)) {
      return res.status(400).json({ error: 'Invalid roleName' });
    }

    if (action === 'grant') {
      await db.execute(sql`INSERT INTO finance_role_capabilities (role_name, capability) VALUES (${roleName}, ${capability}) ON CONFLICT DO NOTHING`);
    } else {
      await db.execute(sql`DELETE FROM finance_role_capabilities WHERE role_name = ${roleName} AND capability = ${capability}`);
    }

    await recordFinanceAction(adminUid, `capability_${action}`, 'finance_role', roleName, null, { capability }, req.ip);
    return res.json({ ok: true, roleName, capability, action });
  } catch (err: any) {
    logger.error('[Capabilities][POST] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update capability', detail: err.message });
  }
});

// ── Phase 3.1F: Dispute SLA Report ───────────────────────────────────────

// GET /admin/wallet/dispute-sla-report — per-dispute SLA metrics
// SLA: high-value (amount_disputed_cents >= 50000) = 24h; standard = 72h
router.get('/admin/wallet/dispute-sla-report', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { from, to, divisionCode, status: statusFilter } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (from)         conditions.push(sql`opened_at >= ${from}::timestamptz`);
    if (to)           conditions.push(sql`opened_at <= ${to}::timestamptz`);
    if (divisionCode) conditions.push(sql`division_code = ${divisionCode}`);
    if (statusFilter) conditions.push(sql`status = ${statusFilter}`);

    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const raw: any = await db.execute(sql`
      SELECT case_ref, division_code, status, amount_disputed_cents,
             opened_at, resolved_at,
             EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - opened_at)) AS duration_secs
      FROM dispute_cases
      ${whereClause}
      ORDER BY opened_at DESC
      LIMIT 200
    `);
    const rows = raw?.rows ?? raw ?? [];

    const HIGH_VALUE_THRESHOLD = 50000; // 500 ILS in cents
    const SLA_HIGH_SECS  = 24 * 3600;  // 24h
    const SLA_STD_SECS   = 72 * 3600;  // 72h

    const cases = rows.map((r: any) => {
      const durSecs    = Number(r.duration_secs ?? 0);
      const isHighVal  = Number(r.amount_disputed_cents ?? 0) >= HIGH_VALUE_THRESHOLD;
      const slaSecs    = isHighVal ? SLA_HIGH_SECS : SLA_STD_SECS;
      const isResolved = ['resolved', 'closed'].includes(r.status);
      const slaMet     = durSecs <= slaSecs;
      return {
        caseRef:             r.case_ref,
        divisionCode:        r.division_code,
        status:              r.status,
        amountDisputedCents: Number(r.amount_disputed_cents ?? 0),
        openedAt:            r.opened_at,
        resolvedAt:          r.resolved_at ?? null,
        durationHours:       Math.round(durSecs / 3600 * 10) / 10,
        slaHours:            slaSecs / 3600,
        isHighValue:         isHighVal,
        isResolved,
        slaMet,
        slaBreached:         !slaMet,
      };
    });

    const met     = cases.filter((c: any) => c.slaMet).length;
    const breached = cases.filter((c: any) => c.slaBreached).length;
    const compliancePct = cases.length > 0 ? Math.round((met / cases.length) * 1000) / 10 : 100;

    return res.json({
      ok: true,
      total: cases.length,
      met, breached, compliancePct,
      avgDurationHours: cases.length > 0 ? Math.round(cases.reduce((s: number, c: any) => s + c.durationHours, 0) / cases.length * 10) / 10 : 0,
      cases,
    });
  } catch (err: any) {
    logger.error('[SLA][Report] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate SLA report', detail: err.message });
  }
});

// ── Phase 3.1E: Monthly Variance Analysis ─────────────────────────────────

// GET /admin/wallet/variance-analysis?month=YYYY-MM
router.get('/admin/wallet/variance-analysis', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const monthParam = String(req.query.month ?? '').trim();
    // Default to current month
    const now    = new Date();
    const target = monthParam
      ? new Date(`${monthParam}-01T00:00:00Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() - 1, 1));

    const fmtMonth = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const curMonth  = fmtMonth(target);
    const prevMonth = fmtMonth(prevTarget);

    const payoutStats: any = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)                    AS entry_count,
        COALESCE(SUM(gross_cents),0) AS gross,
        COALESCE(SUM(net_cents),0)   AS net,
        COUNT(DISTINCT provider_uid) AS provider_count
      FROM provider_payout_entries
      WHERE TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') IN (${curMonth}, ${prevMonth})
      GROUP BY 1
    `);
    const payoutRows = payoutStats?.rows ?? payoutStats ?? [];
    const payoutMap: Record<string, any> = {};
    for (const r of payoutRows) payoutMap[r.month] = r;

    const disputeStats: any = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', opened_at), 'YYYY-MM') AS month,
        COUNT(*)                              AS total_disputes,
        COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved_disputes,
        COALESCE(SUM(amount_disputed_cents),0) AS disputed_cents,
        COALESCE(SUM(resolution_cents) FILTER (WHERE status IN ('resolved','closed')), 0) AS resolved_cents
      FROM dispute_cases
      WHERE TO_CHAR(DATE_TRUNC('month', opened_at), 'YYYY-MM') IN (${curMonth}, ${prevMonth})
      GROUP BY 1
    `);
    const disputeRows = disputeStats?.rows ?? disputeStats ?? [];
    const disputeMap: Record<string, any> = {};
    for (const r of disputeRows) disputeMap[r.month] = r;

    function pct(cur: number, prev: number) {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 1000) / 10;
    }

    const cur  = payoutMap[curMonth]  ?? {};
    const prev = payoutMap[prevMonth] ?? {};
    const dcur  = disputeMap[curMonth]  ?? {};
    const dprev = disputeMap[prevMonth] ?? {};

    const curGross    = Number(cur.gross  ?? 0);
    const prevGross   = Number(prev.gross ?? 0);
    const curNet      = Number(cur.net    ?? 0);
    const prevNet     = Number(prev.net   ?? 0);
    const curComm     = curGross - curNet;
    const prevComm    = prevGross - prevNet;

    return res.json({
      ok: true,
      currentMonth: curMonth,
      previousMonth: prevMonth,
      metrics: {
        grossPayoutCents:       { current: curGross,                    previous: prevGross,                    changePct: pct(curGross, prevGross) },
        netPayoutCents:         { current: curNet,                      previous: prevNet,                      changePct: pct(curNet, prevNet) },
        commissionCents:        { current: curComm,                     previous: prevComm,                     changePct: pct(curComm, prevComm) },
        entryCount:             { current: Number(cur.entry_count  ?? 0), previous: Number(prev.entry_count  ?? 0), changePct: pct(Number(cur.entry_count ?? 0), Number(prev.entry_count ?? 0)) },
        providerCount:          { current: Number(cur.provider_count ?? 0), previous: Number(prev.provider_count ?? 0), changePct: pct(Number(cur.provider_count ?? 0), Number(prev.provider_count ?? 0)) },
        disputeCount:           { current: Number(dcur.total_disputes ?? 0), previous: Number(dprev.total_disputes ?? 0), changePct: pct(Number(dcur.total_disputes ?? 0), Number(dprev.total_disputes ?? 0)) },
        resolvedDisputeCount:   { current: Number(dcur.resolved_disputes ?? 0), previous: Number(dprev.resolved_disputes ?? 0), changePct: pct(Number(dcur.resolved_disputes ?? 0), Number(dprev.resolved_disputes ?? 0)) },
        disputedCents:          { current: Number(dcur.disputed_cents ?? 0), previous: Number(dprev.disputed_cents ?? 0), changePct: pct(Number(dcur.disputed_cents ?? 0), Number(dprev.disputed_cents ?? 0)) },
      },
    });
  } catch (err: any) {
    logger.error('[Variance][Analysis] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate variance analysis', detail: err.message });
  }
});

// ── Phase 3.1D: GET /admin/wallet/finance-audit ──────────────────────────
// Finance activity timeline — filterable by actor, action, entityType, date range
router.get('/admin/wallet/finance-audit', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { actor, action, entityType, from, to, page } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const pageSize = 50;
    const offset   = (pageNum - 1) * pageSize;

    // Build WHERE clauses
    const conditions: any[] = [];
    if (actor)      conditions.push(sql`actor_uid   ILIKE ${'%' + actor      + '%'}`);
    if (action)     conditions.push(sql`action      ILIKE ${'%' + action     + '%'}`);
    if (entityType) conditions.push(sql`entity_type ILIKE ${'%' + entityType + '%'}`);
    if (from)       conditions.push(sql`created_at >= ${from}::timestamptz`);
    if (to)         conditions.push(sql`created_at <= ${to}::timestamptz`);

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    const raw: any = await db.execute(sql`
      SELECT id, actor_uid, action, entity_type, entity_id,
             before_snap, after_snap, ip, created_at
      FROM finance_audit_log
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const countRaw: any = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM finance_audit_log ${whereClause}
    `);
    const total = Number((countRaw?.rows ?? countRaw ?? [])[0]?.total ?? 0);

    const events = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id:         r.id,
      actorUid:   r.actor_uid,
      action:     r.action,
      entityType: r.entity_type,
      entityId:   r.entity_id,
      before:     r.before_snap,
      after:      r.after_snap,
      ip:         r.ip,
      createdAt:  r.created_at,
    }));

    return res.json({ ok: true, events, total, page: pageNum, pageSize, pages: Math.ceil(total / pageSize) });
  } catch (err: any) {
    logger.error('[FinanceAudit][List] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch finance audit log', detail: err.message });
  }
});

// GET /admin/wallet/finance-roles — list all assigned roles
router.get('/admin/wallet/finance-roles', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const rows: any = await db.execute(sql`
      SELECT user_uid, role, granted_by, created_at, updated_at
      FROM finance_roles
      ORDER BY role DESC, created_at
    `);
    const FORMAT_ACCESS: Record<string, string[]> = {
      read:  ['csv', 'iban_csv'],
      write: ['csv', 'tranzilla', 'hapoalim', 'mizrahi', 'iban_csv', 'quickbooks_iif'],
      admin: ['csv', 'tranzilla', 'hapoalim', 'mizrahi', 'iban_csv', 'quickbooks_iif'],
    };
    const roles = (rows?.rows ?? rows ?? []).map((r: any) => ({
      userUid:        r.user_uid,
      role:           r.role,
      grantedBy:      r.granted_by,
      createdAt:      r.created_at,
      updatedAt:      r.updated_at,
      allowedFormats: FORMAT_ACCESS[r.role] ?? FORMAT_ACCESS['read'],
    }));
    return res.json({ ok: true, roles, total: roles.length, formatsByRole: FORMAT_ACCESS });
  } catch (err: any) {
    logger.error('[FinanceRoles][List] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to list finance roles', detail: err.message });
  }
});

// POST /admin/wallet/finance-roles/:uid — assign or update role (audited)
router.post('/admin/wallet/finance-roles/:uid', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const grantorUid = session.user.uid ?? session.user.id ?? 'unknown';
    const { uid }    = req.params;

    const schema = z.object({ role: z.enum(['read', 'write', 'admin']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'role must be read|write|admin' });
    const { role } = parsed.data;

    // Read current role so we can record grant vs. update
    const existingRaw: any = await db.execute(sql`SELECT role FROM finance_roles WHERE user_uid=${uid}`);
    const existingRows = existingRaw?.rows ?? existingRaw ?? [];
    const oldRole: string | null = existingRows[0]?.role ?? null;
    const auditAction = oldRole ? 'update' : 'grant';

    await db.execute(sql`
      INSERT INTO finance_roles (user_uid, role, granted_by)
      VALUES (${uid}, ${role}, ${grantorUid})
      ON CONFLICT (user_uid) DO UPDATE
        SET role       = EXCLUDED.role,
            granted_by = EXCLUDED.granted_by,
            updated_at = NOW()
    `);

    // Write role audit log
    await db.execute(sql`
      INSERT INTO role_audit_log (grantor_uid, target_uid, action, old_role, new_role)
      VALUES (${grantorUid}, ${uid}, ${auditAction}, ${oldRole}, ${role})
    `);

    logger.info('[FinanceRoles][Assign]', { uid, role, grantorUid, action: auditAction, oldRole });
    return res.json({ ok: true, userUid: uid, role, action: auditAction });
  } catch (err: any) {
    logger.error('[FinanceRoles][Assign] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to assign finance role', detail: err.message });
  }
});

// DELETE /admin/wallet/finance-roles/:uid — remove finance role (audited)
router.delete('/admin/wallet/finance-roles/:uid', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const grantorUid = session.user.uid ?? session.user.id ?? 'unknown';
    const { uid } = req.params;

    // Read current role before deletion so we can audit it
    const existingRaw: any = await db.execute(sql`SELECT role FROM finance_roles WHERE user_uid=${uid}`);
    const existingRows = existingRaw?.rows ?? existingRaw ?? [];
    const oldRole: string | null = existingRows[0]?.role ?? null;
    if (!oldRole) return res.status(404).json({ error: 'No finance role found for this UID' });

    await db.execute(sql`DELETE FROM finance_roles WHERE user_uid = ${uid}`);

    // Write role audit log
    await db.execute(sql`
      INSERT INTO role_audit_log (grantor_uid, target_uid, action, old_role, new_role)
      VALUES (${grantorUid}, ${uid}, 'revoke', ${oldRole}, NULL)
    `);

    logger.info('[FinanceRoles][Delete]', { uid, oldRole, grantorUid });
    return res.json({ ok: true, userUid: uid, deleted: true });
  } catch (err: any) {
    logger.error('[FinanceRoles][Delete] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to remove finance role', detail: err.message });
  }
});

// GET /admin/wallet/finance-roles/audit — role change history (last 200 events)
router.get('/admin/wallet/finance-roles/audit', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const raw: any = await db.execute(sql`
      SELECT id, grantor_uid, target_uid, action, old_role, new_role, created_at
      FROM role_audit_log
      ORDER BY created_at DESC
      LIMIT 200
    `);
    const events = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id:         r.id,
      grantorUid: r.grantor_uid,
      targetUid:  r.target_uid,
      action:     r.action,
      oldRole:    r.old_role,
      newRole:    r.new_role,
      createdAt:  r.created_at,
    }));
    return res.json({ ok: true, events, total: events.length });
  } catch (err: any) {
    logger.error('[FinanceRoles][Audit] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch role audit log', detail: err.message });
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3.4A — CASH FORECASTING
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/wallet/cash-forecast?horizon=7|14|30
router.get('/admin/wallet/cash-forecast', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const horizon = Math.min(Math.max(parseInt((req.query.horizon as string) || '14', 10), 7), 30);

    // Pending payout entries (earned but not batched)
    const pendingEntries: any = await db.execute(sql`
      SELECT COALESCE(SUM(net_cents),0) AS total
      FROM provider_payout_entries
      WHERE status = 'earned'
    `);
    const pendingPayoutsCents = Number((pendingEntries?.rows ?? pendingEntries)?.[0]?.total ?? 0);

    // Open payout batches (created/exported)
    const openBatches: any = await db.execute(sql`
      SELECT COALESCE(SUM(pb.net_total_cents),0) AS total
      FROM payout_batches pb
      WHERE pb.status IN ('created','exported')
    `);
    const batchedPayoutsCents = Number((openBatches?.rows ?? openBatches)?.[0]?.total ?? 0);

    // Pending refund approvals
    const refundPending: any = await db.execute(sql`
      SELECT COALESCE(SUM(amount_cents),0) AS total
      FROM refund_approvals
      WHERE status IN ('pending','approved')
    `);
    const pendingRefundsCents = Number((refundPending?.rows ?? refundPending)?.[0]?.total ?? 0);

    // Average daily VAT from recent close records (last 30 days)
    const vatAvg: any = await db.execute(sql`
      SELECT COALESCE(AVG(vat_liability_cents),0) AS avg_daily
      FROM finance_close_records
      WHERE close_date >= NOW() - INTERVAL '30 days'
    `);
    const avgDailyVatCents = Number((vatAvg?.rows ?? vatAvg)?.[0]?.avg_daily ?? 0);

    // Average daily gross from recent close records
    const grossAvg: any = await db.execute(sql`
      SELECT COALESCE(AVG(gross_collected_cents),0) AS avg_daily,
             COALESCE(AVG(net_after_refunds_cents),0) AS avg_net
      FROM finance_close_records
      WHERE close_date >= NOW() - INTERVAL '30 days'
    `);
    const avgRows = (grossAvg?.rows ?? grossAvg)?.[0];
    const avgDailyGrossCents = Number(avgRows?.avg_daily ?? 0);
    const avgDailyNetCents   = Number(avgRows?.avg_net   ?? 0);

    // Build per-day forecast
    const byDay: Array<{ date: string; payoutsCents: number; refundsCents: number; vatCents: number; netCashNeedCents: number }> = [];
    const now = new Date();
    const payoutDaysLeft = Math.max(1, horizon);
    const payoutsPerDay = Math.round((pendingPayoutsCents + batchedPayoutsCents) / payoutDaysLeft);
    const refundsPerDay = Math.round(pendingRefundsCents / payoutDaysLeft);

    for (let d = 0; d < horizon; d++) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() + d + 1);
      const dateStr = dt.toISOString().slice(0, 10);
      // Spread pending payouts/refunds evenly; use avg daily for VAT
      const payC = payoutsPerDay;
      const refC = refundsPerDay;
      const vatC = Math.round(avgDailyVatCents);
      byDay.push({ date: dateStr, payoutsCents: payC, refundsCents: refC, vatCents: vatC, netCashNeedCents: payC + refC + vatC });
    }

    const totals = {
      expectedPayoutsCents:    pendingPayoutsCents + batchedPayoutsCents,
      expectedRefundsCents:    pendingRefundsCents,
      expectedVatCents:        Math.round(avgDailyVatCents * horizon),
      expectedNetCashNeedCents: (pendingPayoutsCents + batchedPayoutsCents) + pendingRefundsCents + Math.round(avgDailyVatCents * horizon),
    };

    const assumptions = [
      `VAT projected from ${avgDailyVatCents > 0 ? 'recent closed-day averages' : 'no recent close data — defaulting to zero'}`,
      'Pending payout entries distributed evenly across forecast horizon',
      'Refund approvals assumed to clear within the forecast window',
      `Gross collection trend: avg ${Math.round(avgDailyGrossCents / 100)} ILS/day over last 30 days`,
    ];

    return res.json({ ok: true, horizonDays: horizon, generatedAt: new Date().toISOString(), totals, byDay, assumptions });
  } catch (err: any) {
    logger.error('[CashForecast] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate forecast', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3.4B — PAYOUT SCHEDULING AUTOMATION
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/wallet/payout-schedules
router.get('/admin/wallet/payout-schedules', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const raw: any = await db.execute(sql`
      SELECT ps.*, COUNT(psr.id)::int AS run_count
      FROM payout_schedules ps
      LEFT JOIN payout_schedule_runs psr ON psr.schedule_id = ps.id
      GROUP BY ps.id
      ORDER BY ps.created_at DESC
    `);
    const schedules = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id: r.id, divisionCode: r.division_code, cadence: r.cadence,
      dayOfWeek: r.day_of_week, dayOfMonth: r.day_of_month, enabled: r.enabled,
      minBatchNetCents: r.min_batch_net_cents, notes: r.notes,
      lastRunAt: r.last_run_at, createdByUid: r.created_by_uid, createdAt: r.created_at,
      runCount: r.run_count,
    }));
    return res.json({ ok: true, schedules, total: schedules.length });
  } catch (err: any) {
    logger.error('[PayoutSchedules][List] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to list schedules', detail: err.message });
  }
});

// POST /admin/wallet/payout-schedules
router.post('/admin/wallet/payout-schedules', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    const { divisionCode, cadence, dayOfWeek, dayOfMonth, enabled = true, minBatchNetCents = 0, notes = '' } = req.body;
    if (!cadence || !['daily','weekly','fortnightly','monthly'].includes(cadence)) {
      return res.status(400).json({ error: 'Invalid cadence. Must be daily|weekly|fortnightly|monthly' });
    }
    const raw: any = await db.execute(sql`
      INSERT INTO payout_schedules (division_code, cadence, day_of_week, day_of_month, enabled, min_batch_net_cents, notes, created_by_uid)
      VALUES (${divisionCode ?? null}, ${cadence}, ${dayOfWeek ?? null}, ${dayOfMonth ?? null},
              ${enabled}, ${minBatchNetCents}, ${notes}, ${adminUid})
      RETURNING *
    `);
    const s = (raw?.rows ?? raw)?.[0];
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, new_value)
      VALUES (${adminUid}, 'payout_schedule_created', 'payout_schedule', ${String(s?.id)}, ${JSON.stringify({ cadence, divisionCode })}::jsonb)
    `);
    return res.status(201).json({ ok: true, schedule: s });
  } catch (err: any) {
    logger.error('[PayoutSchedules][Create] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to create schedule', detail: err.message });
  }
});

// PATCH /admin/wallet/payout-schedules/:id
router.patch('/admin/wallet/payout-schedules/:id', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    const { id } = req.params;
    const { divisionCode, cadence, dayOfWeek, dayOfMonth, enabled, minBatchNetCents, notes } = req.body;
    const sets: string[] = [];
    const vals: any[] = [];
    if (divisionCode !== undefined) { sets.push(`division_code = $${vals.length+1}`); vals.push(divisionCode); }
    if (cadence        !== undefined) { sets.push(`cadence = $${vals.length+1}`);        vals.push(cadence); }
    if (dayOfWeek      !== undefined) { sets.push(`day_of_week = $${vals.length+1}`);    vals.push(dayOfWeek); }
    if (dayOfMonth     !== undefined) { sets.push(`day_of_month = $${vals.length+1}`);   vals.push(dayOfMonth); }
    if (enabled        !== undefined) { sets.push(`enabled = $${vals.length+1}`);        vals.push(enabled); }
    if (minBatchNetCents !== undefined) { sets.push(`min_batch_net_cents = $${vals.length+1}`); vals.push(minBatchNetCents); }
    if (notes          !== undefined) { sets.push(`notes = $${vals.length+1}`);          vals.push(notes); }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(parseInt(id, 10));
    const raw: any = await db.execute(sql.raw(`UPDATE payout_schedules SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals));
    const s = (raw?.rows ?? raw)?.[0];
    if (!s) return res.status(404).json({ error: 'Schedule not found' });
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, new_value)
      VALUES (${adminUid}, 'payout_schedule_updated', 'payout_schedule', ${id}, ${JSON.stringify(req.body)}::jsonb)
    `);
    return res.json({ ok: true, schedule: s });
  } catch (err: any) {
    logger.error('[PayoutSchedules][Update] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update schedule', detail: err.message });
  }
});

// POST /admin/wallet/payout-schedules/:id/run-now
router.post('/admin/wallet/payout-schedules/:id/run-now', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    const scheduleId = parseInt(req.params.id, 10);

    const schRaw: any = await db.execute(sql`SELECT * FROM payout_schedules WHERE id = ${scheduleId}`);
    const schedule = (schRaw?.rows ?? schRaw)?.[0];
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    // Find eligible payout entries
    const condition = schedule.division_code
      ? sql`status = 'earned' AND division_code = ${schedule.division_code}`
      : sql`status = 'earned'`;
    const entriesRaw: any = await db.execute(sql`
      SELECT COALESCE(SUM(net_cents),0) AS net_total, COUNT(*)::int AS entry_count
      FROM provider_payout_entries
      WHERE ${condition}
    `);
    const netTotal    = Number((entriesRaw?.rows ?? entriesRaw)?.[0]?.net_total  ?? 0);
    const entryCount  = Number((entriesRaw?.rows ?? entriesRaw)?.[0]?.entry_count ?? 0);

    if (netTotal < (schedule.min_batch_net_cents || 0) || entryCount === 0) {
      await db.execute(sql`
        INSERT INTO payout_schedule_runs (schedule_id, result, summary)
        VALUES (${scheduleId}, 'skipped', ${JSON.stringify({ reason: 'Below min threshold or no entries', netTotal, entryCount })}::jsonb)
      `);
      return res.json({ ok: true, result: 'skipped', reason: 'Below min threshold or no entries', netTotal, entryCount });
    }

    // Create batch
    const batchId = `AUTO-${scheduleId}-${Date.now()}`;
    const divFilter = schedule.division_code ? ` AND division_code = '${schedule.division_code}'` : '';
    await db.execute(sql.raw(`
      INSERT INTO payout_batches (batch_id, status, gross_total_cents, commission_total_cents, net_total_cents, entry_count, created_by_uid, notes)
      SELECT '${batchId}', 'created',
        SUM(gross_cents), SUM(gross_cents - net_cents), SUM(net_cents), COUNT(*),
        '${adminUid}', 'Auto-created by schedule ${scheduleId}'
      FROM provider_payout_entries WHERE status = 'earned'${divFilter}
    `));
    await db.execute(sql.raw(`
      UPDATE provider_payout_entries SET status='batched', payout_batch_id='${batchId}'
      WHERE status='earned'${divFilter}
    `));
    await db.execute(sql`
      UPDATE payout_schedules SET last_run_at = NOW() WHERE id = ${scheduleId}
    `);
    await db.execute(sql`
      INSERT INTO payout_schedule_runs (schedule_id, result, batch_id, summary)
      VALUES (${scheduleId}, 'created', ${batchId}, ${JSON.stringify({ netTotal, entryCount })}::jsonb)
    `);
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, new_value)
      VALUES (${adminUid}, 'payout_schedule_run_now', 'payout_schedule', ${String(scheduleId)}, ${JSON.stringify({ batchId, netTotal, entryCount })}::jsonb)
    `);
    return res.json({ ok: true, result: 'created', batchId, netTotal, entryCount });
  } catch (err: any) {
    logger.error('[PayoutSchedules][RunNow] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to run schedule', detail: err.message });
  }
});

// GET /admin/wallet/payout-schedules/runs
router.get('/admin/wallet/payout-schedules/runs', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const scheduleId = req.query.scheduleId ? parseInt(req.query.scheduleId as string, 10) : null;
    const raw: any = await db.execute(sql`
      SELECT psr.*, ps.cadence, ps.division_code
      FROM payout_schedule_runs psr
      LEFT JOIN payout_schedules ps ON ps.id = psr.schedule_id
      WHERE (${scheduleId}::int IS NULL OR psr.schedule_id = ${scheduleId})
      ORDER BY psr.ran_at DESC
      LIMIT 100
    `);
    const runs = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id: r.id, scheduleId: r.schedule_id, ranAt: r.ran_at, result: r.result,
      batchId: r.batch_id, summary: r.summary, cadence: r.cadence, divisionCode: r.division_code,
    }));
    return res.json({ ok: true, runs, total: runs.length });
  } catch (err: any) {
    logger.error('[PayoutSchedules][Runs] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch runs', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3.4C — DISPUTE SLA AUTO-ROUTING
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/wallet/dispute-routing-rules
router.get('/admin/wallet/dispute-routing-rules', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const raw: any = await db.execute(sql`SELECT * FROM dispute_routing_rules ORDER BY priority ASC, id ASC`);
    const rules = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id: r.id, divisionCode: r.division_code, minAmountCents: r.min_amount_cents,
      maxAmountCents: r.max_amount_cents, assignToUid: r.assign_to_uid,
      queueName: r.queue_name, priority: r.priority, enabled: r.enabled,
    }));
    return res.json({ ok: true, rules, total: rules.length });
  } catch (err: any) {
    logger.error('[DisputeRouting][Rules] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch routing rules', detail: err.message });
  }
});

// POST /admin/wallet/dispute-routing-rules
router.post('/admin/wallet/dispute-routing-rules', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    const { divisionCode, minAmountCents = 0, maxAmountCents, assignToUid, queueName, priority = 100, enabled = true } = req.body;
    if (!queueName && !assignToUid) return res.status(400).json({ error: 'Must specify queueName or assignToUid' });
    const raw: any = await db.execute(sql`
      INSERT INTO dispute_routing_rules (division_code, min_amount_cents, max_amount_cents, assign_to_uid, queue_name, priority, enabled)
      VALUES (${divisionCode ?? null}, ${minAmountCents}, ${maxAmountCents ?? null}, ${assignToUid ?? null}, ${queueName ?? null}, ${priority}, ${enabled})
      RETURNING *
    `);
    const rule = (raw?.rows ?? raw)?.[0];
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, new_value)
      VALUES (${adminUid}, 'dispute_routing_rule_created', 'dispute_routing_rule', ${String(rule?.id)}, ${JSON.stringify(req.body)}::jsonb)
    `);
    return res.status(201).json({ ok: true, rule });
  } catch (err: any) {
    logger.error('[DisputeRouting][CreateRule] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to create rule', detail: err.message });
  }
});

// PATCH /admin/wallet/dispute-routing-rules/:id
router.patch('/admin/wallet/dispute-routing-rules/:id', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    const { id } = req.params;
    const { divisionCode, minAmountCents, maxAmountCents, assignToUid, queueName, priority, enabled } = req.body;
    const sets: string[] = []; const vals: any[] = [];
    if (divisionCode    !== undefined) { sets.push(`division_code = $${vals.length+1}`);     vals.push(divisionCode); }
    if (minAmountCents  !== undefined) { sets.push(`min_amount_cents = $${vals.length+1}`);  vals.push(minAmountCents); }
    if (maxAmountCents  !== undefined) { sets.push(`max_amount_cents = $${vals.length+1}`);  vals.push(maxAmountCents); }
    if (assignToUid     !== undefined) { sets.push(`assign_to_uid = $${vals.length+1}`);     vals.push(assignToUid); }
    if (queueName       !== undefined) { sets.push(`queue_name = $${vals.length+1}`);        vals.push(queueName); }
    if (priority        !== undefined) { sets.push(`priority = $${vals.length+1}`);          vals.push(priority); }
    if (enabled         !== undefined) { sets.push(`enabled = $${vals.length+1}`);           vals.push(enabled); }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(parseInt(id, 10));
    const raw: any = await db.execute(sql.raw(`UPDATE dispute_routing_rules SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals));
    const rule = (raw?.rows ?? raw)?.[0];
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, new_value)
      VALUES (${adminUid}, 'dispute_routing_rule_updated', 'dispute_routing_rule', ${id}, ${JSON.stringify(req.body)}::jsonb)
    `);
    return res.json({ ok: true, rule });
  } catch (err: any) {
    logger.error('[DisputeRouting][UpdateRule] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update rule', detail: err.message });
  }
});

// POST /admin/wallet/disputes/:caseRef/route
router.post('/admin/wallet/disputes/:caseRef/route', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    const { caseRef } = req.params;
    const { overrideQueue, overrideUid, reason } = req.body;

    const caseRaw: any = await db.execute(sql`
      SELECT * FROM dispute_cases WHERE case_ref = ${caseRef}
    `);
    const dc = (caseRaw?.rows ?? caseRaw)?.[0];
    if (!dc) return res.status(404).json({ error: 'Dispute case not found' });

    let routedQueue = overrideQueue ?? null;
    let routedToUid = overrideUid  ?? null;
    let routingReason = reason ?? 'Manual route';

    if (!overrideQueue && !overrideUid) {
      // Auto-route: find best matching rule
      const rulesRaw: any = await db.execute(sql`
        SELECT * FROM dispute_routing_rules WHERE enabled = true ORDER BY priority ASC
      `);
      const rules = (rulesRaw?.rows ?? rulesRaw ?? []);
      const amt = dc.amount_disputed_cents || 0;
      const div = dc.division_code;
      for (const rule of rules) {
        const divMatch = !rule.division_code || rule.division_code === div;
        const minMatch = amt >= (rule.min_amount_cents || 0);
        const maxMatch = !rule.max_amount_cents || amt <= rule.max_amount_cents;
        if (divMatch && minMatch && maxMatch) {
          routedQueue   = rule.queue_name;
          routedToUid   = rule.assign_to_uid;
          routingReason = `Auto-routed by rule #${rule.id} (priority ${rule.priority})`;
          break;
        }
      }
      if (!routedQueue && !routedToUid) {
        // Unroutable — fire alert
        await db.execute(sql`
          INSERT INTO finance_alerts (alert_type, severity, message, metadata)
          VALUES ('dispute_unroutable', 'warning',
            ${`Dispute ${caseRef} could not be auto-routed — no matching rule`},
            ${JSON.stringify({ caseRef, amountCents: amt, divisionCode: div })}::jsonb)
        `);
        return res.status(422).json({ ok: false, error: 'No routing rule matched', caseRef });
      }
    }

    await db.execute(sql`
      UPDATE dispute_cases
      SET routed_queue = ${routedQueue}, routed_to_uid = ${routedToUid},
          routing_reason = ${routingReason}, last_routed_at = NOW()
      WHERE case_ref = ${caseRef}
    `);
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, new_value)
      VALUES (${adminUid}, 'dispute_routed', 'dispute_case', ${caseRef},
              ${JSON.stringify({ routedQueue, routedToUid, routingReason })}::jsonb)
    `);
    return res.json({ ok: true, caseRef, routedQueue, routedToUid, routingReason });
  } catch (err: any) {
    logger.error('[DisputeRouting][Route] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to route dispute', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3.4D — FINANCE CONTROL CENTER
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/wallet/control-center
router.get('/admin/wallet/control-center', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const [forecastRaw, batchRaw, refundRaw, reconRaw, alertRaw, closeRaw]: any[] = await Promise.all([
      // Cash needed next 7 days: pending payout entries + pending refunds
      db.execute(sql`
        SELECT COALESCE(SUM(net_cents),0) AS payout_pending,
               (SELECT COALESCE(SUM(amount_cents),0) FROM refund_approvals WHERE status IN ('pending','approved')) AS refund_pending
        FROM provider_payout_entries WHERE status = 'earned'
      `),
      // Open batch count
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM payout_batches WHERE status IN ('created','exported')`),
      // Pending refund approvals
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM refund_approvals WHERE status = 'pending'`),
      // Open recon exceptions
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM bank_reconciliation_exceptions WHERE status = 'open'`),
      // Critical unacknowledged alerts
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM finance_alerts WHERE severity = 'critical' AND acknowledged_at IS NULL`),
      // Today close status
      db.execute(sql`SELECT * FROM finance_close_records WHERE close_date = CURRENT_DATE LIMIT 1`),
    ]);

    const fr  = (forecastRaw?.rows ?? forecastRaw)?.[0];
    const payoutPending  = Number(fr?.payout_pending  ?? 0);
    const refundPending2 = Number(fr?.refund_pending  ?? 0);
    const cashNeeded7d   = payoutPending + refundPending2;

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      widgets: {
        cashForecast: {
          label: 'Cash Needed (Immediate)',
          valueCents: cashNeeded7d,
          status: cashNeeded7d > 500_000_00 ? 'critical' : cashNeeded7d > 100_000_00 ? 'warning' : 'ok',
          link: 'forecast',
        },
        openPayoutBatches: {
          label: 'Open Payout Batches',
          count: Number((batchRaw?.rows ?? batchRaw)?.[0]?.cnt ?? 0),
          status: Number((batchRaw?.rows ?? batchRaw)?.[0]?.cnt ?? 0) > 5 ? 'warning' : 'ok',
          link: 'batches',
        },
        pendingRefundApprovals: {
          label: 'Pending Refund Approvals',
          count: Number((refundRaw?.rows ?? refundRaw)?.[0]?.cnt ?? 0),
          status: Number((refundRaw?.rows ?? refundRaw)?.[0]?.cnt ?? 0) > 10 ? 'warning' : 'ok',
          link: 'approvals',
        },
        staleReconExceptions: {
          label: 'Open Recon Exceptions',
          count: Number((reconRaw?.rows ?? reconRaw)?.[0]?.cnt ?? 0),
          status: Number((reconRaw?.rows ?? reconRaw)?.[0]?.cnt ?? 0) > 0 ? 'warning' : 'ok',
          link: 'recon-exceptions',
        },
        criticalAlerts: {
          label: 'Critical Alerts Unacknowledged',
          count: Number((alertRaw?.rows ?? alertRaw)?.[0]?.cnt ?? 0),
          status: Number((alertRaw?.rows ?? alertRaw)?.[0]?.cnt ?? 0) > 0 ? 'critical' : 'ok',
          link: 'fin-activity',
        },
        closeStatusToday: {
          label: 'Today Close Status',
          status: (closeRaw?.rows ?? closeRaw)?.[0] ? 'closed' : 'open',
          closedAt: (closeRaw?.rows ?? closeRaw)?.[0]?.closed_at ?? null,
          link: 'history',
        },
      },
    });
  } catch (err: any) {
    logger.error('[ControlCenter] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to load control center', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3.4E — EXECUTIVE KPI SNAPSHOTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/wallet/executive-kpis?period=daily|weekly|monthly
router.get('/admin/wallet/executive-kpis', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const period = (req.query.period as string) || 'daily';
    if (!['daily','weekly','monthly'].includes(period)) return res.status(400).json({ error: 'Invalid period' });

    // Date range
    let fromDate: string;
    const now = new Date();
    if (period === 'daily') {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      fromDate = d.toISOString().slice(0, 10);
    } else if (period === 'weekly') {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      fromDate = d.toISOString().slice(0, 10);
    }

    const [collectRaw, disputeRaw, reconRaw, signoffRaw, alertRaw]: any[] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(SUM(gross_collected_cents),0) AS gross,
          COALESCE(SUM(net_after_refunds_cents),0) AS net,
          COALESCE(SUM(vat_liability_cents),0) AS vat,
          COALESCE(SUM(total_commission_cents),0) AS commission,
          COALESCE(SUM(payout_total_cents),0) AS payouts,
          COALESCE(SUM(refund_total_cents),0) AS refunds,
          COUNT(*) AS close_days
        FROM finance_close_records
        WHERE close_date >= ${fromDate}
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at >= ${fromDate}) AS resolved,
          COUNT(*) FILTER (WHERE status NOT IN ('resolved','dismissed')) AS open,
          COUNT(*) FILTER (WHERE resolved_at >= ${fromDate}
            AND EXTRACT(EPOCH FROM (resolved_at - opened_at))/3600 > 48) AS sla_breach
        FROM dispute_cases
        WHERE opened_at >= ${fromDate} OR (resolved_at IS NOT NULL AND resolved_at >= ${fromDate})
      `),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM bank_reconciliation_exceptions WHERE status = 'open'`),
      db.execute(sql`
        SELECT * FROM monthly_signoffs WHERE month_key >= LEFT(${fromDate}, 7)
        ORDER BY month_key DESC LIMIT 1
      `),
      db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE severity = 'critical' AND acknowledged_at IS NULL) AS critical_unacked
        FROM finance_alerts WHERE created_at >= ${fromDate}
      `),
    ]);

    const cr  = (collectRaw?.rows ?? collectRaw)?.[0] ?? {};
    const dr  = (disputeRaw?.rows ?? disputeRaw)?.[0] ?? {};
    const gross      = Number(cr.gross ?? 0);
    const net        = Number(cr.net   ?? 0);
    const vat        = Number(cr.vat   ?? 0);
    const commission = Number(cr.commission ?? 0);
    const payouts    = Number(cr.payouts    ?? 0);
    const refunds    = Number(cr.refunds    ?? 0);
    const resolved   = Number(dr.resolved   ?? 0);
    const open       = Number(dr.open       ?? 0);
    const slaBreach  = Number(dr.sla_breach ?? 0);
    const totalDisp  = resolved + open;
    const dispBreachRate = totalDisp > 0 ? Math.round((slaBreach / totalDisp) * 100) : 0;
    const refundRate     = gross > 0 ? ((refunds / gross) * 100).toFixed(2) : '0.00';
    const margin         = gross > 0 ? (((gross - payouts - refunds) / gross) * 100).toFixed(2) : '0.00';
    const reconCount     = Number((reconRaw?.rows ?? reconRaw)?.[0]?.cnt ?? 0);
    const signoff        = (signoffRaw?.rows ?? signoffRaw)?.[0];
    const criticalUnacked = Number((alertRaw?.rows ?? alertRaw)?.[0]?.critical_unacked ?? 0);

    const risks: string[] = [];
    if (dispBreachRate > 10) risks.push(`Dispute SLA breach rate ${dispBreachRate}% exceeds 10% threshold`);
    if (reconCount > 5)      risks.push(`${reconCount} open reconciliation exceptions require attention`);
    if (criticalUnacked > 0) risks.push(`${criticalUnacked} critical finance alerts unacknowledged`);
    if (Number(refundRate) > 5) risks.push(`Refund rate ${refundRate}% is above 5% target`);

    const kpi = {
      period,
      fromDate,
      grossCents: gross, netCents: net, vatCents: vat, commissionCents: commission,
      payoutsCents: payouts, refundsCents: refunds,
      refundRatePct: refundRate, marginPct: margin,
      closeDays: Number(cr.close_days ?? 0),
      disputeResolved: resolved, disputeOpen: open, disputeBreachRatePct: dispBreachRate,
      reconExceptionsOpen: reconCount,
      signoffStatus: signoff ? `Signed off ${signoff.month_key}` : 'Pending',
      criticalAlertsUnacked: criticalUnacked,
      topRisks: risks,
      topImprovement: margin > '15' ? 'Margin healthy — focus on dispute SLA' : 'Margin below target — review commission structure',
    };

    // Cache snapshot
    const snapshotDate = period === 'daily' ? fromDate : period === 'weekly' ? `${fromDate}-W` : fromDate.slice(0,7);
    await db.execute(sql`
      INSERT INTO executive_kpi_snapshots (snapshot_date, snapshot_type, kpi_json)
      VALUES (${snapshotDate}, ${period}, ${JSON.stringify(kpi)}::jsonb)
      ON CONFLICT DO NOTHING
    `).catch(() => {});

    return res.json({ ok: true, kpi });
  } catch (err: any) {
    logger.error('[ExecutiveKPIs] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate executive KPIs', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3.4F — RETENTION & ARCHIVE POLICY
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/wallet/archive-policies
router.get('/admin/wallet/archive-policies', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const raw: any = await db.execute(sql`SELECT * FROM finance_archive_policies ORDER BY entity_type ASC`);
    const policies = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id: r.id, entityType: r.entity_type, retentionDays: r.retention_days,
      archiveAfterDays: r.archive_after_days, enabled: r.enabled, notes: r.notes,
    }));
    return res.json({ ok: true, policies, total: policies.length });
  } catch (err: any) {
    logger.error('[ArchivePolicies][List] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to list archive policies', detail: err.message });
  }
});

// POST /admin/wallet/archive-policies
router.post('/admin/wallet/archive-policies', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    const { entityType, retentionDays, archiveAfterDays, enabled = true, notes = '' } = req.body;
    if (!entityType || !retentionDays || !archiveAfterDays) return res.status(400).json({ error: 'entityType, retentionDays, archiveAfterDays required' });
    const raw: any = await db.execute(sql`
      INSERT INTO finance_archive_policies (entity_type, retention_days, archive_after_days, enabled, notes)
      VALUES (${entityType}, ${retentionDays}, ${archiveAfterDays}, ${enabled}, ${notes})
      RETURNING *
    `);
    const policy = (raw?.rows ?? raw)?.[0];
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, new_value)
      VALUES (${adminUid}, 'archive_policy_created', 'finance_archive_policy', ${String(policy?.id)}, ${JSON.stringify(req.body)}::jsonb)
    `);
    return res.status(201).json({ ok: true, policy });
  } catch (err: any) {
    logger.error('[ArchivePolicies][Create] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to create archive policy', detail: err.message });
  }
});

// PATCH /admin/wallet/archive-policies/:id
router.patch('/admin/wallet/archive-policies/:id', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    const { id } = req.params;
    const { retentionDays, archiveAfterDays, enabled, notes } = req.body;
    const sets: string[] = []; const vals: any[] = [];
    if (retentionDays    !== undefined) { sets.push(`retention_days = $${vals.length+1}`);     vals.push(retentionDays); }
    if (archiveAfterDays !== undefined) { sets.push(`archive_after_days = $${vals.length+1}`); vals.push(archiveAfterDays); }
    if (enabled          !== undefined) { sets.push(`enabled = $${vals.length+1}`);            vals.push(enabled); }
    if (notes            !== undefined) { sets.push(`notes = $${vals.length+1}`);              vals.push(notes); }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(parseInt(id, 10));
    const raw: any = await db.execute(sql.raw(`UPDATE finance_archive_policies SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals));
    const policy = (raw?.rows ?? raw)?.[0];
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, new_value)
      VALUES (${adminUid}, 'archive_policy_updated', 'finance_archive_policy', ${id}, ${JSON.stringify(req.body)}::jsonb)
    `);
    return res.json({ ok: true, policy });
  } catch (err: any) {
    logger.error('[ArchivePolicies][Update] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update archive policy', detail: err.message });
  }
});

// GET /admin/wallet/archive-runs
router.get('/admin/wallet/archive-runs', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const raw: any = await db.execute(sql`
      SELECT * FROM finance_archive_runs ORDER BY ran_at DESC LIMIT 100
    `);
    const runs = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id: r.id, entityType: r.entity_type, ranAt: r.ran_at,
      movedCount: r.moved_count, status: r.status, summary: r.summary,
    }));
    return res.json({ ok: true, runs, total: runs.length });
  } catch (err: any) {
    logger.error('[ArchiveRuns][List] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to list archive runs', detail: err.message });
  }
});

// POST /admin/wallet/archive-runs/dry-run
router.post('/admin/wallet/archive-runs/dry-run', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;

    const policiesRaw: any = await db.execute(sql`SELECT * FROM finance_archive_policies WHERE enabled = true`);
    const policies = (policiesRaw?.rows ?? policiesRaw ?? []);
    const dryRunResults: any[] = [];

    for (const p of policies) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - p.archive_after_days);
      const cutoffStr = cutoff.toISOString();
      let countResult: any;
      try {
        if (p.entity_type === 'finance_alert_deliveries') {
          countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM finance_alert_deliveries WHERE sent_at < ${cutoffStr}`);
        } else if (p.entity_type === 'integrity_job_runs') {
          countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM integrity_job_runs WHERE started_at < ${cutoffStr}`);
        } else if (p.entity_type === 'payout_schedule_runs') {
          countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM payout_schedule_runs WHERE ran_at < ${cutoffStr}`);
        } else if (p.entity_type === 'cash_forecast_snapshots') {
          countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM cash_forecast_snapshots WHERE generated_at < ${cutoffStr}`);
        } else {
          countResult = null;
        }
        const eligible = countResult ? Number((countResult?.rows ?? countResult)?.[0]?.cnt ?? 0) : 0;
        dryRunResults.push({ entityType: p.entity_type, eligible, archiveAfterDays: p.archive_after_days, cutoff: cutoffStr });
      } catch {
        dryRunResults.push({ entityType: p.entity_type, eligible: 0, error: 'table not found' });
      }
    }

    const runRaw: any = await db.execute(sql`
      INSERT INTO finance_archive_runs (entity_type, status, moved_count, summary)
      VALUES ('_dry_run_all', 'dry_run', 0, ${JSON.stringify({ results: dryRunResults, initiatedBy: adminUid })}::jsonb)
      RETURNING id
    `);
    return res.json({ ok: true, dryRun: true, results: dryRunResults, runId: (runRaw?.rows ?? runRaw)?.[0]?.id });
  } catch (err: any) {
    logger.error('[ArchiveRuns][DryRun] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to run archive dry-run', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3.4G — DISASTER RECOVERY & REPLAY PROCEDURES
// ══════════════════════════════════════════════════════════════════════════════

const SAFE_REPLAY_TYPES = ['rebuild_payout_batch_totals','rebuild_remittance_status','rebuild_close_snapshots','recheck_reconciliation_links'];

async function runReplay(replayType: string, dryRun: boolean, initiatedBy: string, runId: number) {
  const findings: any[] = [];
  let appliedCount = 0;

  try {
    if (replayType === 'rebuild_payout_batch_totals') {
      // Verify batch totals match sum of member entries
      const batchesRaw: any = await db.execute(sql`
        SELECT pb.batch_id, pb.net_total_cents AS stored_net,
               COALESCE(SUM(ppe.net_cents),0) AS computed_net
        FROM payout_batches pb
        LEFT JOIN provider_payout_entries ppe ON ppe.payout_batch_id = pb.batch_id
        GROUP BY pb.batch_id, pb.net_total_cents
        HAVING pb.net_total_cents != COALESCE(SUM(ppe.net_cents),0)
      `);
      const mismatches = (batchesRaw?.rows ?? batchesRaw ?? []);
      for (const m of mismatches) {
        findings.push({ batchId: m.batch_id, storedNet: m.stored_net, computedNet: m.computed_net });
        if (!dryRun) {
          await db.execute(sql`
            UPDATE payout_batches SET net_total_cents = ${Number(m.computed_net)}
            WHERE batch_id = ${m.batch_id}
          `);
          appliedCount++;
        }
      }
    } else if (replayType === 'rebuild_remittance_status') {
      // Find completed batches with no remittance log
      const raw: any = await db.execute(sql`
        SELECT pb.batch_id FROM payout_batches pb
        WHERE pb.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM remittance_log rl WHERE rl.batch_id = pb.batch_id)
      `);
      const gaps = (raw?.rows ?? raw ?? []);
      for (const g of gaps) {
        findings.push({ batchId: g.batch_id, issue: 'completed_batch_no_remittance' });
      }
    } else if (replayType === 'rebuild_close_snapshots') {
      // Find days with close records that have zero gross despite non-zero payout entries
      const raw: any = await db.execute(sql`
        SELECT fcr.close_date, fcr.gross_collected_cents FROM finance_close_records fcr
        WHERE fcr.gross_collected_cents = 0
        ORDER BY fcr.close_date DESC LIMIT 30
      `);
      const suspects = (raw?.rows ?? raw ?? []);
      for (const s of suspects) {
        findings.push({ closeDate: s.close_date, issue: 'zero_gross_close_record' });
      }
    } else if (replayType === 'recheck_reconciliation_links') {
      // Find settled payout entries with no reconciliation proof or manual match
      const raw: any = await db.execute(sql`
        SELECT ppe.id, ppe.payout_batch_id FROM provider_payout_entries ppe
        WHERE ppe.status = 'settled'
          AND NOT EXISTS (
            SELECT 1 FROM bank_reconciliation_exceptions bre
            WHERE bre.matched_payout_entry_id = ppe.id AND bre.status = 'matched_manually'
          )
          AND NOT EXISTS (
            SELECT 1 FROM payout_batches pb
            JOIN bank_reconciliation_uploads bru ON bru.batch_id = pb.batch_id
            WHERE pb.batch_id = ppe.payout_batch_id AND bru.status = 'completed'
          )
        LIMIT 50
      `);
      const gaps = (raw?.rows ?? raw ?? []);
      for (const g of gaps) {
        findings.push({ payoutEntryId: g.id, batchId: g.payout_batch_id, issue: 'settled_without_reconciliation_proof' });
      }
    }

    await db.execute(sql`
      UPDATE finance_replay_runs
      SET completed_at = NOW(), status = 'completed', findings_json = ${JSON.stringify({ findings })}::jsonb,
          applied_count = ${appliedCount}
      WHERE id = ${runId}
    `);
    await db.execute(sql`
      INSERT INTO finance_audit_log (actor_uid, action, entity_type, entity_id, new_value)
      VALUES (${initiatedBy}, ${dryRun ? 'replay_dry_run_completed' : 'replay_executed'},
              'finance_replay_run', ${String(runId)},
              ${JSON.stringify({ replayType, findings: findings.length, appliedCount, dryRun })}::jsonb)
    `);
  } catch (err: any) {
    await db.execute(sql`
      UPDATE finance_replay_runs SET completed_at = NOW(), status = 'failed' WHERE id = ${runId}
    `).catch(() => {});
    logger.error('[Replay] background error', { error: err.message, runId });
  }
}

// POST /admin/wallet/replay/dry-run
router.post('/admin/wallet/replay/dry-run', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    const { replayType } = req.body;
    if (!SAFE_REPLAY_TYPES.includes(replayType)) {
      return res.status(400).json({ error: 'Unknown replay type', validTypes: SAFE_REPLAY_TYPES });
    }
    const raw: any = await db.execute(sql`
      INSERT INTO finance_replay_runs (replay_type, dry_run, initiated_by, status)
      VALUES (${replayType}, true, ${adminUid}, 'running')
      RETURNING id
    `);
    const runId = (raw?.rows ?? raw)?.[0]?.id;
    // Fire and forget — runs async
    runReplay(replayType, true, adminUid, runId);
    return res.status(202).json({ ok: true, runId, replayType, dryRun: true, status: 'running' });
  } catch (err: any) {
    logger.error('[Replay][DryRun] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to start replay dry-run', detail: err.message });
  }
});

// POST /admin/wallet/replay/execute
router.post('/admin/wallet/replay/execute', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const adminUid = session.user.uid;
    // finance_admin only
    const roleRaw: any = await db.execute(sql`SELECT role FROM finance_user_roles WHERE uid = ${adminUid} LIMIT 1`);
    const role = (roleRaw?.rows ?? roleRaw)?.[0]?.role;
    if (role !== 'finance_admin') return res.status(403).json({ error: 'finance_admin role required for replay execute' });

    const { replayType } = req.body;
    if (!SAFE_REPLAY_TYPES.includes(replayType)) {
      return res.status(400).json({ error: 'Unknown replay type', validTypes: SAFE_REPLAY_TYPES });
    }
    const raw: any = await db.execute(sql`
      INSERT INTO finance_replay_runs (replay_type, dry_run, initiated_by, status)
      VALUES (${replayType}, false, ${adminUid}, 'running')
      RETURNING id
    `);
    const runId = (raw?.rows ?? raw)?.[0]?.id;
    runReplay(replayType, false, adminUid, runId);
    return res.status(202).json({ ok: true, runId, replayType, dryRun: false, status: 'running' });
  } catch (err: any) {
    logger.error('[Replay][Execute] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to start replay execute', detail: err.message });
  }
});

// GET /admin/wallet/replay-runs
router.get('/admin/wallet/replay-runs', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    if (!session?.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    const raw: any = await db.execute(sql`
      SELECT * FROM finance_replay_runs ORDER BY started_at DESC LIMIT 50
    `);
    const runs = (raw?.rows ?? raw ?? []).map((r: any) => ({
      id: r.id, replayType: r.replay_type, startedAt: r.started_at, completedAt: r.completed_at,
      status: r.status, dryRun: r.dry_run, findingsJson: r.findings_json,
      appliedCount: r.applied_count, initiatedBy: r.initiated_by,
    }));
    return res.json({ ok: true, runs, total: runs.length });
  } catch (err: any) {
    logger.error('[Replay][Runs] error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch replay runs', detail: err.message });
  }
});

export default router;
