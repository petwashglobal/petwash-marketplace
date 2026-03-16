/**
 * PetWash™ Universal Pass Distribution — 2026
 *
 * Routes:
 *   GET  /api/pass/:passId           — UA-detect → redirect to Apple / Google / chooser
 *   GET  /api/wallet/apple/v1/devices/:did/registrations/:ptid/:serial — Apple device reg list
 *   POST /api/wallet/apple/v1/devices/:did/registrations/:ptid/:serial — Apple register device
 *   DELETE /api/wallet/apple/v1/devices/:did/registrations/:ptid/:serial — Apple unregister
 *   GET  /api/wallet/apple/v1/passes/:ptid/:serial  — Apple serve updated pass
 *   POST /api/wallet/apple/v1/log   — Apple log endpoint
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { petwashPassAccounts, appleWalletDeviceRegistrations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { generateAppleWalletPass, isAppleWalletConfigured } from '../services/AppleWalletService';
import { buildSaveUrl, isGoogleWalletConfigured } from '../services/GoogleWalletService';
import { createHmac, randomBytes } from 'crypto';

const router = Router();

const PASS_SIGNING_SECRET = process.env.PRESTIGE_QR_SECRET || 'dev-only-insecure-prestige-qr-secret-do-not-use-in-prod';
const BASE_URL = process.env.BASE_URL || 'https://petwash.co.il';

function isIOS(ua: string): boolean {
  return /iphone|ipad|ipod|macintosh.*safari/i.test(ua) && !/android/i.test(ua);
}
function isAndroid(ua: string): boolean {
  return /android/i.test(ua);
}

function generateShortLivedQrToken(passId: string, userId: string, qrTokenVersion: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    passId,
    userId,
    tokenVersion: qrTokenVersion,
    nonce: randomBytes(16).toString('hex'),
    issuedAt: now,
    expiresAt: now + 45,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = createHmac('sha256', PASS_SIGNING_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// ─────────────────────────────────────────────────────────
// GET /api/pass/:passId — Universal distribution link
// Detects user-agent and redirects to the right wallet,
// or shows an HTML chooser page for desktop.
// ─────────────────────────────────────────────────────────
router.get('/:passId', async (req: Request, res: Response) => {
  try {
    const { passId } = req.params;
    const ua = req.headers['user-agent'] || '';

    const [pass] = await db
      .select()
      .from(petwashPassAccounts)
      .where(eq(petwashPassAccounts.passId, passId))
      .limit(1);

    if (!pass || pass.status !== 'ACTIVE') {
      return res.status(404).send('<h2>Pass not found or inactive</h2>');
    }

    const qrToken = generateShortLivedQrToken(pass.passId, pass.userId, pass.qrTokenVersion);

    if (isIOS(ua)) {
      if (isAppleWalletConfigured()) {
        return res.redirect(307, `/api/wallet/apple/pass/${encodeURIComponent(pass.passId)}`);
      }
    }

    if (isAndroid(ua)) {
      if (isGoogleWalletConfigured()) {
        const saveUrl = buildSaveUrl({
          passId:             pass.passId,
          userId:             pass.userId,
          ownerName:          pass.ownerName,
          primaryPetName:     pass.primaryPetName ?? undefined,
          tier:               pass.tier,
          availableCreditIls: Number(pass.availableCreditIls),
          validUntil:         pass.validUntil?.toISOString().split('T')[0] ?? undefined,
          qrToken,
        });
        if (saveUrl) return res.redirect(307, saveUrl);
      }
    }

    const appleUrl  = `/api/wallet/apple/pass/${encodeURIComponent(pass.passId)}`;
    const googleUrl = isGoogleWalletConfigured()
      ? buildSaveUrl({ passId: pass.passId, userId: pass.userId, ownerName: pass.ownerName, primaryPetName: pass.primaryPetName ?? undefined, tier: pass.tier, availableCreditIls: Number(pass.availableCreditIls), qrToken })
      : null;

    const isHe = (req.headers['accept-language'] || '').startsWith('he');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!DOCTYPE html>
<html lang="${isHe ? 'he' : 'en'}" dir="${isHe ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>PetWash™ Pass</title>
<style>
  body { margin:0; background:#fff; font-family:'Helvetica Neue',Arial,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .card { max-width:400px; width:90%; text-align:center; padding:40px 24px; }
  .brand { font-size:11px; letter-spacing:6px; color:#C6A35B; text-transform:uppercase; margin-bottom:16px; }
  h1 { font-size:20px; color:#111; margin:0 0 6px; }
  p { color:#888; font-size:14px; margin:0 0 32px; }
  .btn { display:block; padding:16px 24px; border-radius:14px; text-decoration:none; font-size:15px; font-weight:600; margin-bottom:14px; }
  .apple { background:#000; color:#fff; }
  .google { background:#1a73e8; color:#fff; }
  .disabled { background:#f5f5f5; color:#bbb; cursor:not-allowed; }
  .id { font-size:11px; color:#ddd; margin-top:24px; letter-spacing:2px; }
</style>
</head>
<body>
<div class="card">
  <div class="brand">P E T W A S H ™</div>
  <h1>${isHe ? 'הפאס הפרסטיז שלך' : 'Your Prestige Pass'}</h1>
  <p>${pass.ownerName}${pass.primaryPetName ? ' · ' + pass.primaryPetName + ' 🐾' : ''}</p>
  ${isAppleWalletConfigured()
    ? `<a class="btn apple" href="${appleUrl}">${isHe ? 'הוסף ל‑Apple Wallet' : 'Add to Apple Wallet'}</a>`
    : `<div class="btn disabled">${isHe ? 'Apple Wallet — בקרוב' : 'Apple Wallet — Coming Soon'}</div>`
  }
  ${googleUrl
    ? `<a class="btn google" href="${googleUrl}">${isHe ? 'הוסף ל‑Google Wallet' : 'Add to Google Wallet'}</a>`
    : `<div class="btn disabled">${isHe ? 'Google Wallet — בקרוב' : 'Google Wallet — Coming Soon'}</div>`
  }
  <div class="id">${pass.passId}</div>
</div>
</body>
</html>`);
  } catch (err) {
    logger.error('[PassUniversal] Error serving universal pass', { err });
    return res.status(500).send('Internal error');
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/wallet/apple/pass/:passId — Serve .pkpass file
// ─────────────────────────────────────────────────────────
router.get('/apple/pass/:passId', async (req: Request, res: Response) => {
  try {
    const { passId } = req.params;

    if (!isAppleWalletConfigured()) {
      return res.status(503).json({ ok: false, error: 'Apple Wallet certificates not configured' });
    }

    const [pass] = await db
      .select()
      .from(petwashPassAccounts)
      .where(eq(petwashPassAccounts.passId, passId))
      .limit(1);

    if (!pass || pass.status !== 'ACTIVE') {
      return res.status(404).json({ ok: false, error: 'Pass not found' });
    }

    const qrToken = generateShortLivedQrToken(pass.passId, pass.userId, pass.qrTokenVersion);

    const pkpassBuffer = await generateAppleWalletPass({
      passId:             pass.passId,
      userId:             pass.userId,
      ownerName:          pass.ownerName,
      primaryPetName:     pass.primaryPetName ?? undefined,
      tier:               pass.tier,
      availableCreditIls: Number(pass.availableCreditIls),
      validUntil:         pass.validUntil?.toISOString().split('T')[0] ?? undefined,
      qrToken,
    });

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${pass.passId}.pkpass"`);
    res.setHeader('Last-Modified', new Date().toUTCString());
    return res.send(pkpassBuffer);
  } catch (err) {
    logger.error('[PassUniversal] Apple pass generation error', { err });
    return res.status(500).json({ ok: false, error: 'Pass generation failed' });
  }
});

// ─────────────────────────────────────────────────────────
// Apple Wallet Update Web Service
// Apple calls these endpoints when the device wants updates.
// Reference: https://developer.apple.com/documentation/walletpasses/adding_a_web_service_to_update_passes
// ─────────────────────────────────────────────────────────

// POST /api/wallet/apple/v1/devices/:did/registrations/:ptid/:serial
// Apple device registers to receive push updates for a pass
router.post('/apple/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', async (req: Request, res: Response) => {
  try {
    const { deviceId, serialNumber } = req.params;
    const pushToken = req.body?.pushToken;
    if (!pushToken) return res.status(400).send();

    await db.insert(appleWalletDeviceRegistrations)
      .values({
        deviceLibraryIdentifier: deviceId,
        pushToken,
        passTypeIdentifier:      req.params.passTypeId,
        serialNumber,
      })
      .onConflictDoUpdate({
        target: [appleWalletDeviceRegistrations.deviceLibraryIdentifier, appleWalletDeviceRegistrations.serialNumber],
        set:    { pushToken },
      });

    logger.info('[AppleWallet] Device registered', { deviceId, serialNumber });
    return res.status(201).send();
  } catch (err) {
    logger.error('[AppleWallet] Device registration error', { err });
    return res.status(500).send();
  }
});

// DELETE /api/wallet/apple/v1/devices/:did/registrations/:ptid/:serial
router.delete('/apple/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', async (req: Request, res: Response) => {
  try {
    const { deviceId, serialNumber } = req.params;
    await db.delete(appleWalletDeviceRegistrations)
      .where(
        and(
          eq(appleWalletDeviceRegistrations.deviceLibraryIdentifier, deviceId),
          eq(appleWalletDeviceRegistrations.serialNumber, serialNumber),
        ),
      );
    logger.info('[AppleWallet] Device unregistered', { deviceId, serialNumber });
    return res.status(200).send();
  } catch (err) {
    logger.error('[AppleWallet] Device unregister error', { err });
    return res.status(500).send();
  }
});

// GET /api/wallet/apple/v1/devices/:did/registrations/:ptid
// Apple fetches list of serials that changed since a timestamp
router.get('/apple/v1/devices/:deviceId/registrations/:passTypeId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const regs = await db
      .select({ serialNumber: appleWalletDeviceRegistrations.serialNumber })
      .from(appleWalletDeviceRegistrations)
      .where(eq(appleWalletDeviceRegistrations.deviceLibraryIdentifier, deviceId));

    if (!regs.length) return res.status(204).send();

    return res.json({
      serialNumbers:  regs.map(r => r.serialNumber),
      lastUpdated:    new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[AppleWallet] Device registration list error', { err });
    return res.status(500).send();
  }
});

// GET /api/wallet/apple/v1/passes/:ptid/:serial — Serve latest pass to Apple
router.get('/apple/v1/passes/:passTypeId/:serialNumber', async (req: Request, res: Response) => {
  try {
    const { serialNumber } = req.params;

    if (!isAppleWalletConfigured()) return res.status(503).send();

    const [pass] = await db
      .select()
      .from(petwashPassAccounts)
      .where(eq(petwashPassAccounts.passId, serialNumber))
      .limit(1);

    if (!pass) return res.status(404).send();

    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince) {
      const lastUpdated = pass.updatedAt || pass.createdAt;
      if (new Date(ifModifiedSince) >= new Date(lastUpdated)) {
        return res.status(304).send();
      }
    }

    const qrToken = generateShortLivedQrToken(pass.passId, pass.userId, pass.qrTokenVersion);
    const pkpassBuffer = await generateAppleWalletPass({
      passId:             pass.passId,
      userId:             pass.userId,
      ownerName:          pass.ownerName,
      primaryPetName:     pass.primaryPetName ?? undefined,
      tier:               pass.tier,
      availableCreditIls: Number(pass.availableCreditIls),
      validUntil:         pass.validUntil?.toISOString().split('T')[0] ?? undefined,
      qrToken,
    });

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Last-Modified', new Date().toUTCString());
    return res.send(pkpassBuffer);
  } catch (err) {
    logger.error('[AppleWallet] Pass update serve error', { err });
    return res.status(500).send();
  }
});

// POST /api/wallet/apple/v1/log — Apple logs errors from device
router.post('/apple/v1/log', (req: Request, res: Response) => {
  const logs = req.body?.logs || [];
  logs.forEach((entry: string) => logger.warn('[AppleWallet] Device log:', { entry }));
  return res.status(200).send();
});

export default router;
