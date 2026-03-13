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
import { db as firestoreDb } from '../lib/firebase-admin';
import { db } from '../db';
import { walletAccounts, creditTransactions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { EmailService } from '../emailService';
import { buildPrestigePassLuxuryEmail } from '../email/templates/prestige-pass-luxury-2026';
import { buildWalletUrls } from '../lib/walletPassToken';
import QRCode from 'qrcode';

const router = Router();

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
    const userId  = session?.user?.uid;
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

    return res.json({
      ok: true,
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
        cashWalletCents:      passData.cashWalletCents || 0,
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
// DEDUCTION ORDER ENGINE (spec-compliant, pure function)
// Order: promo → gift/egift → package_wash → cash_wallet → card_fallback
// Supports partial multi-source deduction across all balance types.
// ─────────────────────────────────────────────────────────
interface DeductionBreakdown {
  promo:        number;   // promo credits used (cents)
  gift:         number;   // egift balance used (cents)
  package:      number;   // package wash units used (count)
  wallet:       number;   // cash wallet used (cents)
  cardFallback: number;   // remaining shortfall requiring card (cents)
  totalCovered: number;   // total cents covered by wallet sources
  ok:           boolean;  // fully covered without card
  shortfall:    number;   // cents still unpaid
  washDeducted: boolean;  // true if a wash unit was consumed (kiosk free-wash)
}

function computeDeductionOrder(
  balances: {
    promoBalanceCents:   number;
    egiftBalanceCents:   number;
    washPackageCredits:  number;
    cashWalletCents:     number;
  },
  amountCents: number,
  isKioskFreeWash: boolean,
): DeductionBreakdown {
  // Special path: free kiosk wash from package (amount = 0 + wash credit available)
  if (isKioskFreeWash && balances.washPackageCredits > 0) {
    return {
      promo: 0, gift: 0, package: 1, wallet: 0,
      cardFallback: 0, totalCovered: 0,
      ok: true, shortfall: 0, washDeducted: true,
    };
  }

  let remaining = amountCents;

  // 1. Promo credits (expires first)
  const promoUse = Math.min(balances.promoBalanceCents, remaining);
  remaining -= promoUse;

  // 2. eGift balance
  const giftUse = Math.min(balances.egiftBalanceCents, remaining);
  remaining -= giftUse;

  // 3. Package wash (1 unit = wash value; skip for non-wash online services)
  const packageUse = 0; // package wash units used as monetary value only for kiosk path
  // remaining unchanged (package units are discrete, not converted to cents here)

  // 4. Cash wallet
  const walletUse = Math.min(balances.cashWalletCents, remaining);
  remaining -= walletUse;

  const cardFallback = Math.max(0, remaining);
  const totalCovered = promoUse + giftUse + walletUse;

  return {
    promo:        promoUse,
    gift:         giftUse,
    package:      packageUse,
    wallet:       walletUse,
    cardFallback,
    totalCovered,
    ok:           cardFallback === 0,
    shortfall:    cardFallback,
    washDeducted: false,
  };
}

// Apply computed deduction to DB/Firestore atomically
async function applyDeductionToStorage(
  userId: string,
  breakdown: DeductionBreakdown,
  wallet: typeof walletAccounts.$inferSelect | undefined,
  passRef: any,
  passData: { cashWalletCents: number },
): Promise<void> {
  const dbUpdates: Partial<typeof walletAccounts.$inferSelect> = {};

  if (breakdown.washDeducted && (wallet?.washPackageCredits ?? 0) > 0) {
    dbUpdates.washPackageCredits = (wallet!.washPackageCredits - 1);
  }
  if (breakdown.promo > 0 && wallet) {
    dbUpdates.promoBalanceCents = Math.max(0, (wallet.promoBalanceCents ?? 0) - breakdown.promo);
  }
  if (breakdown.gift > 0 && wallet) {
    dbUpdates.egiftBalanceCents = Math.max(0, (wallet.egiftBalanceCents ?? 0) - breakdown.gift);
  }

  if (Object.keys(dbUpdates).length > 0) {
    await db.update(walletAccounts).set(dbUpdates).where(eq(walletAccounts.userId, userId));
  }

  if (breakdown.wallet > 0) {
    const newCash = Math.max(0, (passData.cashWalletCents ?? 0) - breakdown.wallet);
    await passRef.update({ cashWalletCents: newCash });
  }
}

// Backwards-compatible wrapper for the kiosk path
async function applySmartRedemption(
  userId: string,
  amountCents: number,
  walletId: string,
): Promise<{ source: string; deductedCents: number; washDeducted: boolean; breakdown: DeductionBreakdown }> {
  const passRef  = firestoreDb.collection('prestige_passes').doc(userId);
  const passDoc  = await passRef.get();
  const passData = passDoc.exists ? passDoc.data()! : { cashWalletCents: 0 };

  const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);

  const isKioskFreeWash = amountCents === 0 && (wallet?.washPackageCredits ?? 0) > 0;

  const breakdown = computeDeductionOrder(
    {
      promoBalanceCents:  wallet?.promoBalanceCents  ?? 0,
      egiftBalanceCents:  wallet?.egiftBalanceCents  ?? 0,
      washPackageCredits: wallet?.washPackageCredits ?? 0,
      cashWalletCents:    passData.cashWalletCents   ?? 0,
    },
    amountCents,
    isKioskFreeWash,
  );

  if (breakdown.cardFallback >= amountCents && !breakdown.washDeducted) {
    return { source: 'card_required', deductedCents: 0, washDeducted: false, breakdown };
  }

  await applyDeductionToStorage(userId, breakdown, wallet, passRef, passData as { cashWalletCents: number });

  const source = breakdown.washDeducted
    ? 'package_wash'
    : breakdown.totalCovered < amountCents
      ? 'partial_mixed'
      : breakdown.promo > 0 && breakdown.gift === 0 && breakdown.wallet === 0
        ? 'promo_credit'
        : breakdown.gift > 0 && breakdown.promo === 0 && breakdown.wallet === 0
          ? 'egift'
          : breakdown.wallet > 0 && breakdown.promo === 0 && breakdown.gift === 0
            ? 'cash_wallet'
            : 'mixed';

  return {
    source,
    deductedCents: breakdown.totalCovered,
    washDeducted:  breakdown.washDeducted,
    breakdown,
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

    // 2. Anti-replay check in Firestore
    const tokenRef = firestoreDb.collection('prestige_qr_tokens').doc(jti);
    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists || tokenDoc.data()?.used === true) {
      logger.warn('[PrestigePass] Replay attack blocked', { jti, userId });
      return res.status(409).json({ ok: false, error: 'Token already used (anti-replay)' });
    }

    // 3. Bay validation
    const requestedBay = bay || payload.bay;
    const effectiveBay = requestedBay === 'any'
      ? (stationId?.includes('L') ? 'left' : 'right')
      : requestedBay;

    // 4. Mark token as used (atomic)
    await tokenRef.update({
      used:      true,
      usedAt:    new Date().toISOString(),
      stationId: stationId || null,
      bay:       effectiveBay,
    });

    // 5. Apply smart redemption
    const result = await applySmartRedemption(userId, amountCents, walletId);

    // 6. Log to credit transactions ledger
    if (result.deductedCents > 0 || result.washDeducted) {
      const txnId = `TXN-PREST-${Date.now().toString(36).toUpperCase()}`;
      await db.insert(creditTransactions).values({
        transactionId:  txnId,
        walletId,
        creditType:     result.source === 'package_wash' ? 'wash_package'
                        : result.source === 'egift'      ? 'egift'
                        : result.source === 'promo_credit' ? 'promo_credit'
                        : 'referral_credit',
        transactionType: 'redeem',
        amountCents:     result.deductedCents > 0 ? -result.deductedCents : null,
        amountUnits:     result.washDeducted ? -1 : null,
        metadata: {
          jti, stationId, bay: effectiveBay,
          redemptionSource: result.source,
        } as any,
      });
    }

    logger.info('[PrestigePass] Token redeemed', {
      jti, userId, stationId, bay: effectiveBay,
      source: result.source, deducted: result.deductedCents,
    });

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
    return res.status(500).json({ ok: false, error: 'Internal error' });
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
    const balance = ((passData.cashWalletCents || 0) + (wallet?.egiftBalanceCents || 0)) / 100;
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

    // Return JSON for now — actual .pkpass requires Apple cert signing
    // When APPLE_PASS_CERT_P12 env var is set, the pass will be signed and returned as .pkpass
    const certAvailable = !!process.env.APPLE_PASS_CERT_P12;

    if (certAvailable) {
      // TODO: Sign with Apple certificate and return as application/vnd.apple.pkpass
      return res.status(501).json({ ok: false, error: 'Apple Wallet cert not yet configured — contact PetWash support' });
    }

    res.json({ ok: true, passJson, certRequired: true, message: 'Pass structure ready — activate with Apple certificate' });
  } catch (err) {
    logger.error('[PrestigePass] /apple-wallet error:', err);
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

    const passRef = firestoreDb.collection('prestige_passes').doc(userId);
    const passDoc = await passRef.get();
    const current = passDoc.exists ? (passDoc.data()!.cashWalletCents || 0) : 0;
    const newBalance = current + amountCents;

    if (passDoc.exists) {
      await passRef.update({ cashWalletCents: newBalance });
    } else {
      await passRef.set({ userId, cashWalletCents: newBalance, issuedAt: new Date().toISOString() });
    }

    logger.info('[PrestigePass] Top-up applied', { userId, amountCents, source, newBalance });

    return res.json({
      ok:             true,
      cashWalletCents: newBalance,
      added:          amountCents,
    });
  } catch (err) {
    logger.error('[PrestigePass] /topup error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

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
}): string {
  const { firstName, tierDisplay, cardNumber, appBaseUrl, cashWalletCents, freeWashesRemaining } = opts;
  const cashDisplay = (cashWalletCents / 100).toFixed(2);
  const walletUrl = `${appBaseUrl}/prestige-pass`;
  const googleWalletUrl = `${appBaseUrl}/api/prestige-pass/google-wallet`;
  const appleWalletUrl  = `${appBaseUrl}/api/prestige-pass/apple-wallet`;
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
          <td style="padding-left:0;padding-left:0;">
            <a href="${googleWalletUrl}" target="_blank" style="display:inline-block;text-decoration:none;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="background:#000000;border:1px solid #444;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-left:0;">
                          <!-- Google G logo approximation in text (safe for email clients) -->
                          <span style="font-size:18px;font-weight:900;color:#4285F4;font-family:Arial;">G</span><span style="font-size:18px;font-weight:900;color:#EA4335;">o</span><span style="font-size:18px;font-weight:900;color:#FBBC05;">o</span><span style="font-size:18px;font-weight:900;color:#4285F4;">g</span><span style="font-size:18px;font-weight:900;color:#34A853;">l</span><span style="font-size:18px;font-weight:900;color:#EA4335;">e</span>
                        </td>
                        <td style="padding-right:12px;border-right:1px solid #333;"></td>
                        <td style="padding-right:0;padding-right:12px;">
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
                        <td style="padding-left:0;">
                          <span style="font-size:22px;color:#ffffff;font-family:'Apple Color Emoji',Arial;">&#63743;</span>
                        </td>
                        <td style="padding-right:12px;border-right:1px solid #333;"></td>
                        <td style="padding-right:0;padding-right:12px;">
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

    const passData = (await passRef.get()).data()!;
    const recipientEmail = email || session?.user?.email;

    // Send wallet email with both wallet buttons
    if (recipientEmail) {
      const appBaseUrl = process.env.APP_BASE_URL || 'https://petwash.co.il';
      const html = buildPrestigeWalletEmail({
        firstName:           firstName || session?.user?.displayName?.split(' ')[0] || 'לקוח יקר',
        tierDisplay,
        cardNumber:          passCardNumber,
        appBaseUrl,
        cashWalletCents:     passData.cashWalletCents || 0,
        freeWashesRemaining: passData.freeWashesRemaining || 0,
      });

      const sent = await EmailService.send({
        to:      recipientEmail,
        subject: `הפאס הפרסטיז שלך מוכן — ${tierDisplay} 🐾`,
        html,
      });

      if (sent) {
        await passRef.update({ emailSentAt: new Date().toISOString() });
        logger.info('[PrestigePass] Wallet email sent', { userId, recipientEmail, tier: tierKey });
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
    const passData = passDoc.exists ? passDoc.data()! : { cashWalletCents: 0, tier: 'new' };

    const tier = wallet?.loyaltyTier || passData.tier || 'new';

    return res.json({
      userId,
      tier,
      balances: {
        promo:         wallet?.promoBalanceCents    ?? 0,
        gift:          wallet?.egiftBalanceCents    ?? 0,
        wallet:        passData.cashWalletCents     ?? 0,
        washes:        wallet?.washPackageCredits   ?? 0,
        loyaltyPoints: wallet?.loyaltyPointsBalance ?? 0,
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

    // Load wallet + pass balances
    const passRef  = firestoreDb.collection('prestige_passes').doc(userId);
    const passDoc  = await passRef.get();
    const passData = passDoc.exists ? passDoc.data()! : { cashWalletCents: 0 };

    const [wallet] = await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .limit(1);

    const balanceSnapshot = {
      promoBalanceCents:  wallet?.promoBalanceCents  ?? 0,
      egiftBalanceCents:  wallet?.egiftBalanceCents  ?? 0,
      washPackageCredits: wallet?.washPackageCredits ?? 0,
      cashWalletCents:    passData.cashWalletCents   ?? 0,
    };

    const totalAvailable =
      balanceSnapshot.promoBalanceCents +
      balanceSnapshot.egiftBalanceCents +
      balanceSnapshot.cashWalletCents;

    if (totalAvailable < amountGross) {
      return res.status(402).json({
        ok:         false,
        error:      'Insufficient balance',
        available:  totalAvailable,
        required:   amountGross,
        shortfall:  amountGross - totalAvailable,
      });
    }

    // Compute deduction breakdown (online path — no free-wash shortcut)
    const breakdown = computeDeductionOrder(balanceSnapshot, amountGross, false);

    if (!breakdown.ok) {
      return res.status(402).json({
        ok:        false,
        error:     'Insufficient balance',
        shortfall: breakdown.shortfall,
      });
    }

    // Apply deductions to DB + Firestore
    await applyDeductionToStorage(userId, breakdown, wallet, passRef, passData as { cashWalletCents: number });

    // Record in credit transactions ledger
    const walletId = wallet?.walletId || `WALLET-${userId.slice(0, 8)}`;
    const txnId    = `TXN-ONL-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    await db.insert(creditTransactions).values({
      transactionId:  txnId,
      walletId,
      creditType:     'online_redeem',
      transactionType: 'redeem',
      amountCents:    -amountGross,
      amountUnits:    null,
      metadata: {
        bookingId,
        serviceType,
        amountGross,
        breakdown: {
          promo:  breakdown.promo,
          gift:   breakdown.gift,
          wallet: breakdown.wallet,
          cardFallback: breakdown.cardFallback,
        },
      } as any,
    });

    logger.info('[PrestigePass] Online redemption completed', {
      userId, bookingId, serviceType, amountGross,
      promo: breakdown.promo, gift: breakdown.gift, wallet: breakdown.wallet,
    });

    return res.json({
      ok:              true,
      bookingConfirmed: true,
      txnId,
      amountGross,
      deductionBreakdown: {
        promo:        breakdown.promo,
        gift:         breakdown.gift,
        wallet:       breakdown.wallet,
        cardFallback: breakdown.cardFallback,
        totalCovered: breakdown.totalCovered,
      },
    });
  } catch (err) {
    logger.error('[PrestigePass] /redeem-online error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /resend-wallet-email — resend to logged-in user
// ─────────────────────────────────────────────────────────
router.post('/resend-wallet-email', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const userId  = session?.user?.uid;
    const email   = session?.user?.email;
    if (!userId || !email) return res.status(401).json({ ok: false, error: 'Auth required' });

    const passRef = firestoreDb.collection('prestige_passes').doc(userId);
    const passDoc = await passRef.get();
    if (!passDoc.exists) return res.status(404).json({ ok: false, error: 'No Prestige Pass found' });

    const pass       = passDoc.data()!;
    const tierKey    = pass.tier || 'new';
    const tierDisplay = TIER_DISPLAY[tierKey]?.en || 'Prestige Pearl';
    const appBaseUrl  = process.env.APP_BASE_URL || 'https://petwash.co.il';

    const html = buildPrestigeWalletEmail({
      firstName:           session?.user?.displayName?.split(' ')[0] || 'לקוח יקר',
      tierDisplay,
      cardNumber:          pass.cardNumber || userId.slice(-8).toUpperCase(),
      appBaseUrl,
      cashWalletCents:     pass.cashWalletCents || 0,
      freeWashesRemaining: pass.freeWashesRemaining || 0,
    });

    const sent = await EmailService.send({
      to:      email,
      subject: `הפאס הפרסטיז שלך — ${tierDisplay} 🐾`,
      html,
    });

    if (sent) {
      await passRef.update({ emailSentAt: new Date().toISOString() });
    }

    return res.json({ ok: true, emailSent: sent });
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
    const { appleWalletUrl, googleWalletUrl } = buildWalletUrls('prestige-demo-nir', BASE_URL);

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

    const sent = await EmailService.send({ to: d.email, subject, html });
    logger.info('[PrestigePass] Luxury demo email sent', { to: d.email, tier: d.tier, sent });

    return res.json({
      ok: true,
      sent,
      to: d.email,
      tier: d.tier,
      walletPassConfigured: !!(appleWalletUrl && googleWalletUrl),
    });
  } catch (err) {
    logger.error('[PrestigePass] /send-luxury-demo error:', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
