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
import {
  getWalletBalances,
  getOrCreateWallet,
  applyDeduction,
  topUpCashWallet,
  adminManualCredit,
  type DeductionBreakdown,
} from '../services/WalletEngine';

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
async function applySmartRedemption(
  userId: string,
  amountCents: number,
  serviceType: string,
  machineId?: string,
  bayId?: string,
): Promise<{ source: string; deductedCents: number; washDeducted: boolean; breakdown: DeductionBreakdown; txnId: string }> {
  const walletBalances = await getWalletBalances(userId);
  if (!walletBalances) {
    return {
      source: 'no_wallet', deductedCents: 0, washDeducted: false, txnId: '',
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
    return { source: 'card_required', deductedCents: 0, washDeducted: false, txnId: '', breakdown: emptyBreakdown };
  }

  const result = await applyDeduction({
    userId, amountCents, isKioskWash,
    serviceType, machineId, bayId,
    description: `Prestige Pass ${isKioskWash ? 'free wash' : 'kiosk'} — ${machineId || 'terminal'}`,
  });

  const source = result.breakdown.washDeducted
    ? 'package_wash'
    : result.breakdown.totalCovered < amountCents
      ? 'partial_mixed'
      : result.breakdown.promo > 0 && result.breakdown.gift === 0 && result.breakdown.wallet === 0
        ? 'promo_credit'
        : result.breakdown.gift > 0 && result.breakdown.promo === 0 && result.breakdown.wallet === 0
          ? 'egift'
          : result.breakdown.wallet > 0 && result.breakdown.promo === 0 && result.breakdown.gift === 0
            ? 'cash_wallet'
            : 'mixed';

  return {
    source,
    deductedCents: result.breakdown.totalCovered,
    washDeducted:  result.breakdown.washDeducted,
    txnId:         result.txnId,
    breakdown:     result.breakdown,
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

    // 5. Apply smart redemption (WalletEngine writes ledger entry atomically)
    const result = await applySmartRedemption(userId, amountCents, 'k9000', stationId, effectiveBay);

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

    const [activateWallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);
    const recipientEmail = email || session?.user?.email;

    // Send wallet email with both wallet buttons
    if (recipientEmail) {
      const appBaseUrl = process.env.APP_BASE_URL || 'https://petwash.co.il';
      const html = buildPrestigeWalletEmail({
        firstName:           firstName || session?.user?.displayName?.split(' ')[0] || 'לקוח יקר',
        tierDisplay,
        cardNumber:          passCardNumber,
        appBaseUrl,
        cashWalletCents:     activateWallet?.cashWalletBalanceCents || 0,
        freeWashesRemaining: activateWallet?.washPackageCredits || 0,
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
    const tier = wallet?.loyaltyTier || passDoc.data()?.tier || 'new';

    return res.json({
      userId,
      tier,
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

    // Atomic deduction via WalletEngine (PostgreSQL only — no Firestore split)
    const result = await applyDeduction({
      userId,
      amountCents:  amountGross,
      isKioskWash:  false,
      serviceType,
      bookingId,
      description: `Online redemption — ${serviceType}`,
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

    const [resendWallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);

    const html = buildPrestigeWalletEmail({
      firstName:           session?.user?.displayName?.split(' ')[0] || 'לקוח יקר',
      tierDisplay,
      cardNumber:          pass.cardNumber || userId.slice(-8).toUpperCase(),
      appBaseUrl,
      cashWalletCents:     resendWallet?.cashWalletBalanceCents || 0,
      freeWashesRemaining: resendWallet?.washPackageCredits || 0,
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
    const { appleWalletUrl, googleWalletUrl } = buildWalletUrls(userId, BASE_URL);

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

export default router;
