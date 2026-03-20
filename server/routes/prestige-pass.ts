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
import { createHmac, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { db as firestoreDb, auth as firebaseAuth } from '../lib/firebase-admin';
import { db } from '../db';
import { walletAccounts, creditTransactions, walletLedgerEntries } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
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
        cashWalletCents:      wallet?.cashWalletBalanceCents || 0,
        egiftBalanceCents:    wallet?.egiftBalanceCents || 0,
        promoBalanceCents:    wallet?.promoBalanceCents || 0,
        packageWashesLeft:    wallet?.washPackageCredits || 0,
        loyaltyPoints:        wallet?.loyaltyPointsBalance || 0,
        referralBalanceCents: wallet?.referralBalanceCents || 0,
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

export default router;
