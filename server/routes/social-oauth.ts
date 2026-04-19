import { Router, type Request, type Response } from 'express';
import { adminAuth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import crypto from 'crypto';

const router = Router();

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
const COOKIE_SECRET: string = process.env.COOKIE_SECRET ?? (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[social-oauth] COOKIE_SECRET env var must be set in production');
  }
  // Dev/staging: generate a per-process ephemeral secret so it is never a
  // guessable constant. Sessions won't survive server restarts in dev — that
  // is acceptable. Set COOKIE_SECRET in your .env to make them persistent.
  const ephemeral = crypto.randomBytes(32).toString('hex');
  logger.warn('[social-oauth] COOKIE_SECRET not set — using ephemeral per-process key (dev only). Set COOKIE_SECRET in .env for persistent sessions.');
  return ephemeral;
})();

const pendingTokens = new Map<string, { customToken: string; provider: string; isNew: boolean; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingTokens) {
    if (value.expiresAt < now) pendingTokens.delete(key);
  }
}, 60000);

const getRedirectUri = (provider: string) => {
  const baseUrl = process.env.APP_BASE_URL || 'https://petwash.co.il';
  return `${baseUrl}/api/auth/social/${provider}/callback`;
};

function generateState(provider: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${provider}:${nonce}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  return `${payload}:${hmac}`;
}

function validateState(state: string, provider: string): boolean {
  const parts = state.split(':');
  if (parts.length !== 4) return false;
  const [stateProvider, nonce, timestamp, hmac] = parts;
  if (stateProvider !== provider) return false;
  const age = Date.now() - parseInt(timestamp);
  if (age > 600000) return false;
  const expectedHmac = crypto.createHmac('sha256', COOKIE_SECRET).update(`${stateProvider}:${nonce}:${timestamp}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
}

router.get('/tiktok/status', (_req: Request, res: Response) => {
  res.json({ available: !!(TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET), provider: 'tiktok' });
});

router.get('/instagram/status', (_req: Request, res: Response) => {
  res.json({ available: !!(INSTAGRAM_CLIENT_ID && INSTAGRAM_CLIENT_SECRET), provider: 'instagram' });
});

router.get('/token-exchange', (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing exchange code' });
  }

  const pending = pendingTokens.get(code);
  if (!pending) {
    return res.status(404).json({ error: 'Invalid or expired code' });
  }

  if (pending.expiresAt < Date.now()) {
    pendingTokens.delete(code);
    return res.status(410).json({ error: 'Code expired' });
  }

  pendingTokens.delete(code);
  res.json({ customToken: pending.customToken, provider: pending.provider, isNew: pending.isNew });
});

router.get('/tiktok/authorize', (_req: Request, res: Response) => {
  if (!TIKTOK_CLIENT_KEY) {
    return res.status(503).json({ error: 'TikTok sign-in not configured' });
  }

  const state = generateState('tiktok');
  const scope = 'user.info.basic';
  const redirectUri = encodeURIComponent(getRedirectUri('tiktok'));

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${TIKTOK_CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}`;

  res.json({ authUrl });
});

router.get('/tiktok/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state || !TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      return res.redirect('/signin?error=tiktok_auth_failed');
    }

    if (!validateState(decodeURIComponent(state as string), 'tiktok')) {
      logger.warn('[TikTok OAuth] Invalid state parameter - possible CSRF');
      return res.redirect('/signin?error=tiktok_csrf_invalid');
    }

    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri('tiktok'),
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      logger.error('[TikTok OAuth] Token exchange failed', { tokenData });
      return res.redirect('/signin?error=tiktok_token_failed');
    }

    const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();
    const tiktokUser = userData.data?.user;

    if (!tiktokUser?.open_id) {
      logger.error('[TikTok OAuth] Failed to get user info', { userData });
      return res.redirect('/signin?error=tiktok_user_failed');
    }

    const uid = `tiktok:${tiktokUser.open_id}`;
    let isNew = false;

    try {
      await adminAuth.getUser(uid);
    } catch {
      isNew = true;
      await adminAuth.createUser({
        uid,
        displayName: tiktokUser.display_name || 'TikTok User',
        photoURL: tiktokUser.avatar_url,
      });

      await adminAuth.setCustomUserClaims(uid, {
        accountType: 'pet_parent',
        role: 'public',
        authProvider: 'tiktok',
        loyaltyTier: 'bronze',
        loyaltyMember: true,
        program: 'PetWash Privilege',
      });
    }

    // ── PostgreSQL user bootstrap (wallet + loyalty + users row) ─────────────
    // TikTok does not return an email — ensureUserInPostgres now accepts null.
    // This must run for both new AND returning users (idempotent ON CONFLICT guards).
    try {
      const { authService } = await import('../services/AuthService');
      const nameParts = (tiktokUser.display_name || '').split(' ');
      await authService.ensureUserInPostgres(uid, undefined, {
        firstName: nameParts[0] || 'TikTok',
        lastName: nameParts.slice(1).join(' ') || 'User',
        profileImageUrl: tiktokUser.avatar_url || undefined,
        language: 'he',
        country: 'IL',
      });
    } catch (pgErr: any) {
      logger.warn('[TikTok OAuth] PostgreSQL bootstrap failed (non-blocking)', { uid, error: pgErr.message });
    }

    const customToken = await adminAuth.createCustomToken(uid);
    const exchangeCode = crypto.randomBytes(32).toString('hex');
    pendingTokens.set(exchangeCode, {
      customToken,
      provider: 'tiktok',
      isNew,
      expiresAt: Date.now() + 120000,
    });

    logger.info('[TikTok OAuth] Successful auth', { uid, displayName: tiktokUser.display_name });

    res.redirect(`/signin?oauthCode=${exchangeCode}&provider=tiktok`);
  } catch (error: any) {
    logger.error('[TikTok OAuth] Callback error', error);
    res.redirect('/signin?error=tiktok_auth_error');
  }
});

router.get('/instagram/authorize', (_req: Request, res: Response) => {
  if (!INSTAGRAM_CLIENT_ID) {
    return res.status(503).json({ error: 'Instagram sign-in not configured' });
  }

  const state = generateState('instagram');
  const scope = 'instagram_business_basic';
  const redirectUri = encodeURIComponent(getRedirectUri('instagram'));

  const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${INSTAGRAM_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${encodeURIComponent(state)}`;

  res.json({ authUrl });
});

router.get('/instagram/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state || !INSTAGRAM_CLIENT_ID || !INSTAGRAM_CLIENT_SECRET) {
      return res.redirect('/signin?error=instagram_auth_failed');
    }

    if (!validateState(decodeURIComponent(state as string), 'instagram')) {
      logger.warn('[Instagram OAuth] Invalid state parameter - possible CSRF');
      return res.redirect('/signin?error=instagram_csrf_invalid');
    }

    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: INSTAGRAM_CLIENT_ID,
        client_secret: INSTAGRAM_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri('instagram'),
        code: code as string,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      logger.error('[Instagram OAuth] Token exchange failed', { tokenData });
      return res.redirect('/signin?error=instagram_token_failed');
    }

    const userResponse = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${tokenData.access_token}`);
    const instaUser = await userResponse.json();

    if (!instaUser?.id) {
      logger.error('[Instagram OAuth] Failed to get user info', { instaUser });
      return res.redirect('/signin?error=instagram_user_failed');
    }

    const uid = `instagram:${instaUser.id}`;
    let isNew = false;

    try {
      await adminAuth.getUser(uid);
    } catch {
      isNew = true;
      await adminAuth.createUser({
        uid,
        displayName: instaUser.username || 'Instagram User',
      });

      await adminAuth.setCustomUserClaims(uid, {
        accountType: 'pet_parent',
        role: 'public',
        authProvider: 'instagram',
        loyaltyTier: 'bronze',
        loyaltyMember: true,
        program: 'PetWash Privilege',
      });
    }

    // ── PostgreSQL user bootstrap (wallet + loyalty + users row) ─────────────
    // Instagram does not reliably return an email — ensureUserInPostgres accepts null.
    try {
      const { authService } = await import('../services/AuthService');
      await authService.ensureUserInPostgres(uid, undefined, {
        firstName: instaUser.username || 'Instagram',
        lastName: 'User',
        language: 'he',
        country: 'IL',
      });
    } catch (pgErr: any) {
      logger.warn('[Instagram OAuth] PostgreSQL bootstrap failed (non-blocking)', { uid, error: pgErr.message });
    }

    const customToken = await adminAuth.createCustomToken(uid);
    const exchangeCode = crypto.randomBytes(32).toString('hex');
    pendingTokens.set(exchangeCode, {
      customToken,
      provider: 'instagram',
      isNew,
      expiresAt: Date.now() + 120000,
    });

    logger.info('[Instagram OAuth] Successful auth', { uid, username: instaUser.username });

    res.redirect(`/signin?oauthCode=${exchangeCode}&provider=instagram`);
  } catch (error: any) {
    logger.error('[Instagram OAuth] Callback error', error);
    res.redirect('/signin?error=instagram_auth_error');
  }
});

export default router;
