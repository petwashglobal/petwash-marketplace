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
import { EmailService } from '../emailService';
import { buildPrestigePassLuxuryEmail } from '../email/templates/prestige-pass-luxury-2026';
import { buildPassLinkToken } from '../lib/passTokens';
import { petwashPassAccounts } from '@shared/schema';

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

export default router;
