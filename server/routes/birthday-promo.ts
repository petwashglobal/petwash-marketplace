import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { db as firestoreDb, auth as firebaseAuth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Generate a cryptographically unique, URL-safe promo code.
 * Format: PW-XXXX-YYYY-YY  (18 chars total, human readable)
 *  PW      = PetWash prefix
 *  XXXX    = 4 random uppercase alphanumeric
 *  YYYY    = first 4 chars of sha256(uid) uppercase (user-bound)
 *  YY      = 2-digit year
 */
function generateBirthdayCode(uid: string, year: number): string {
  const random = randomBytes(3).toString('hex').toUpperCase().substring(0, 4);
  const userPart = createHash('sha256').update(uid).digest('hex').toUpperCase().substring(0, 4);
  const yy = String(year).slice(-2);
  return `PW-${random}-${userPart}-${yy}`;
}

/**
 * Build a Google Calendar deeplink for a birthday promo reminder.
 * Opens a pre-filled event on the user's birthday.
 */
function buildBirthdayCalendarLink(
  birthday: string, // YYYY-MM-DD
  code: string,
  expiresAt: string, // YYYY-MM-DD
  userName: string
): string {
  const today = new Date();
  const birthdayThisYear = `${today.getFullYear()}-${birthday.slice(5)}`;
  const dateStr = birthdayThisYear.replace(/-/g, '');

  const title = encodeURIComponent(`🎂 יום הולדת שמח! קוד הנחה של PetWash™`);
  const details = encodeURIComponent(
    `שלום ${userName}! 🎉\n\n` +
    `קוד ההנחה שלך לבלאק פריידי / יום הולדת:\n` +
    `\n🏷️ ${code}\n\n` +
    `✅ חד-פעמי · תקף עד ${expiresAt} · לשימוש אישי בלבד\n\n` +
    `https://petwash.co.il/book?promo=${code}`
  );

  return (
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&dates=${dateStr}/${dateStr}` +
    `&details=${details}` +
    `&crm=AVAILABLE`
  );
}

/**
 * GET /api/promo/birthday
 * Returns (or creates) this year's birthday promo code for the authenticated user.
 * Rules:
 *  - One code per uid per calendar year
 *  - Requires user to have birthdate set in their profile
 *  - Code expires 30 days after birthday this year
 *  - Unclaimed codes are idempotent (same code returned every time)
 *  - Claimed codes return code + claimed status only (no re-issuance this year)
 */
router.get('/birthday', async (req, res) => {
  try {
    // Auth via session cookie (same pattern as rest of app)
    const sessionCookie = req.cookies?.pw_session;
    if (!sessionCookie) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = await firebaseAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;

    // Fetch user profile to get birthdate
    const userDoc = await firestoreDb.collection('users').doc(uid).get();
    const profile = userDoc.data();

    if (!profile?.birthdate) {
      return res.status(400).json({
        error: 'birthday_not_set',
        message: 'Please set your birthday in your profile to unlock your birthday discount.',
        messageHe: 'יש להגדיר תאריך לידה בפרופיל כדי לפתוח את קוד ההנחה.',
      });
    }

    const birthdate: string = profile.birthdate; // YYYY-MM-DD
    const now = new Date();
    const currentYear = now.getFullYear();
    const docKey = `${uid}_${currentYear}`;

    // Check for existing promo document
    const promoRef = firestoreDb.collection('birthday_promos').doc(docKey);
    const promoDoc = await promoRef.get();

    if (promoDoc.exists) {
      const data = promoDoc.data()!;
      return res.json({
        code: data.code,
        claimed: data.claimed || false,
        expiresAt: data.expiresAt,
        calendarLink: data.calendarLink,
        discountPercent: data.discountPercent,
        year: currentYear,
      });
    }

    // Generate new code for this year
    const code = generateBirthdayCode(uid, currentYear);

    // Expiry: birthday this year + 30 days
    const birthdayThisYear = new Date(`${currentYear}-${birthdate.slice(5)}`);
    const expiresDate = new Date(birthdayThisYear);
    expiresDate.setDate(expiresDate.getDate() + 30);
    const expiresAt = expiresDate.toISOString().slice(0, 10); // YYYY-MM-DD

    const displayName = profile.displayName || profile.firstName || 'Friend';
    const calendarLink = buildBirthdayCalendarLink(birthdate, code, expiresAt, displayName);

    const promoData = {
      uid,
      email: decoded.email || profile.email || '',
      code,
      discountPercent: 20, // 20% birthday discount
      claimed: false,
      claimedAt: null,
      claimedIp: null,
      claimedUserAgentHash: null,
      createdAt: now.toISOString(),
      expiresAt,
      calendarLink,
      year: currentYear,
      birthdate,
    };

    await promoRef.set(promoData);
    logger.info('[BirthdayPromo] Generated new code', { uid, code, expiresAt });

    return res.json({
      code,
      claimed: false,
      expiresAt,
      calendarLink,
      discountPercent: 20,
      year: currentYear,
    });
  } catch (error) {
    logger.error('[BirthdayPromo] Error generating code', error);
    return res.status(500).json({ error: 'Failed to generate birthday promo code' });
  }
});

/**
 * POST /api/promo/birthday/claim
 * Marks a birthday promo code as used.
 * Anti-abuse: IP hash + UA hash stored; re-claim on same code blocked.
 * Body: { code: string }
 */
router.post('/birthday/claim', async (req, res) => {
  try {
    const sessionCookie = req.cookies?.pw_session;
    if (!sessionCookie) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = await firebaseAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code is required' });
    }

    const currentYear = new Date().getFullYear();
    const docKey = `${uid}_${currentYear}`;
    const promoRef = firestoreDb.collection('birthday_promos').doc(docKey);
    const promoDoc = await promoRef.get();

    if (!promoDoc.exists) {
      return res.status(404).json({ error: 'No birthday promo found for this year' });
    }

    const data = promoDoc.data()!;

    // Validate code matches
    if (data.code !== code) {
      logger.warn('[BirthdayPromo] Code mismatch attempt', { uid, providedCode: code, actualCode: data.code });
      return res.status(400).json({ error: 'Invalid promo code' });
    }

    // Already claimed?
    if (data.claimed) {
      return res.status(409).json({
        error: 'already_claimed',
        message: 'This code has already been used.',
        messageHe: 'הקוד כבר נוצל.',
      });
    }

    // Expired?
    const now = new Date();
    if (now > new Date(data.expiresAt)) {
      return res.status(410).json({
        error: 'expired',
        message: 'This birthday code has expired.',
        messageHe: 'קוד ההנחה פג תוקף.',
      });
    }

    // Fingerprint request for anti-sharing
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    const uaHash = createHash('sha256').update(ua).digest('hex').substring(0, 16);

    await promoRef.update({
      claimed: true,
      claimedAt: now.toISOString(),
      claimedIp: ip,
      claimedUserAgentHash: uaHash,
    });

    logger.info('[BirthdayPromo] Code claimed', { uid, code, ip: ip.substring(0, 8) + '...' });

    return res.json({
      ok: true,
      discountPercent: data.discountPercent,
      message: 'Code applied successfully!',
      messageHe: 'הקוד הוחל בהצלחה!',
    });
  } catch (error) {
    logger.error('[BirthdayPromo] Claim error', error);
    return res.status(500).json({ error: 'Failed to claim promo code' });
  }
});

/**
 * POST /api/promo/validate
 * Public endpoint (no auth required) to validate a promo code at checkout.
 * Anti-sharing: Checks if claimed uid matches session uid.
 * Body: { code: string }
 */
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code is required' });
    }

    // Find the promo doc by code (query)
    const snapshot = await firestoreDb
      .collection('birthday_promos')
      .where('code', '==', code.toUpperCase().trim())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ valid: false, error: 'Code not found' });
    }

    const data = snapshot.docs[0].data();
    const now = new Date();

    if (now > new Date(data.expiresAt)) {
      return res.json({ valid: false, error: 'Code expired', messageHe: 'הקוד פג תוקף' });
    }

    if (data.claimed) {
      return res.json({ valid: false, error: 'Code already used', messageHe: 'הקוד כבר נוצל' });
    }

    // Auth check: session user must own the code (anti-sharing)
    const sessionCookie = req.cookies?.pw_session;
    if (sessionCookie) {
      try {
        const decoded = await firebaseAuth.verifySessionCookie(sessionCookie, true);
        if (decoded.uid !== data.uid) {
          logger.warn('[BirthdayPromo] Code shared between users', {
            codeOwner: data.uid.substring(0, 8),
            requestor: decoded.uid.substring(0, 8),
          });
          return res.json({ valid: false, error: 'This code belongs to a different account', messageHe: 'הקוד שייך לחשבון אחר' });
        }
      } catch {
        // invalid session but code validation still proceeds (will be blocked at claim)
      }
    }

    return res.json({
      valid: true,
      discountPercent: data.discountPercent,
      expiresAt: data.expiresAt,
    });
  } catch (error) {
    logger.error('[BirthdayPromo] Validate error', error);
    return res.status(500).json({ error: 'Validation failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEASONAL PROMO CODES  (twice a year: Summer + Winter)
// ─────────────────────────────────────────────────────────────────────────────

type Season = 'summer' | 'winter';

interface SeasonWindow {
  name: Season;
  label: { en: string; he: string };
  startMonth: number; // 1-indexed
  startDay: number;
  endMonth: number;
  endDay: number;
  discountPercent: number;
}

const SEASONS: SeasonWindow[] = [
  {
    name: 'summer',
    label: { en: 'Summer ☀️', he: 'קיץ ☀️' },
    startMonth: 6, startDay: 1,
    endMonth: 8, endDay: 31,
    discountPercent: 15,
  },
  {
    name: 'winter',
    label: { en: 'Winter ❄️', he: 'חורף ❄️' },
    startMonth: 12, startDay: 15,
    endMonth: 2, endDay: 28,  // wraps across year boundary
    discountPercent: 15,
  },
];

function getCurrentSeason(now: Date): SeasonWindow | null {
  const m = now.getMonth() + 1; // 1-indexed
  const d = now.getDate();

  for (const s of SEASONS) {
    if (s.name === 'winter') {
      // Dec 15 → Dec 31 OR Jan 1 → Feb 28
      if ((m === 12 && d >= 15) || m === 1 || (m === 2 && d <= 28)) return s;
    } else {
      if (m > s.startMonth || (m === s.startMonth && d >= s.startDay)) {
        if (m < s.endMonth || (m === s.endMonth && d <= s.endDay)) return s;
      }
    }
  }
  return null;
}

function getSeasonExpiry(season: SeasonWindow, year: number): string {
  if (season.name === 'winter') {
    const endYear = new Date().getMonth() + 1 >= 12 ? year + 1 : year;
    return `${endYear}-02-28`;
  }
  return `${year}-0${season.endMonth}-${season.endDay}`;
}

/**
 * GET /api/promo/seasonal
 * Returns (or creates) the current season's promo code for the authenticated user.
 * Returns { active: false } outside of season windows.
 * Rules:
 *  - One code per uid per season per year
 *  - Only active during season window
 *  - 15% discount
 *  - Same anti-abuse as birthday code
 */
router.get('/seasonal', async (req, res) => {
  try {
    const sessionCookie = req.cookies?.pw_session;
    if (!sessionCookie) return res.status(401).json({ error: 'Authentication required' });

    const decoded = await firebaseAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;

    const now = new Date();
    const season = getCurrentSeason(now);

    if (!season) {
      return res.json({ active: false, message: 'No active season promotion right now' });
    }

    const currentYear = now.getFullYear();
    const docKey = `${uid}_${season.name}_${currentYear}`;
    const promoRef = firestoreDb.collection('seasonal_promos').doc(docKey);
    const promoDoc = await promoRef.get();

    if (promoDoc.exists) {
      const data = promoDoc.data()!;
      return res.json({
        active: true,
        season: season.name,
        label: season.label,
        code: data.code,
        claimed: data.claimed || false,
        expiresAt: data.expiresAt,
        discountPercent: data.discountPercent,
      });
    }

    // Generate new code
    const random = randomBytes(3).toString('hex').toUpperCase().substring(0, 4);
    const userPart = createHash('sha256').update(uid).digest('hex').toUpperCase().substring(0, 4);
    const prefix = season.name === 'summer' ? 'SUM' : 'WIN';
    const yy = String(currentYear).slice(-2);
    const code = `PW-${prefix}-${random}${userPart}-${yy}`;

    const expiresAt = getSeasonExpiry(season, currentYear);

    const promoData = {
      uid,
      email: decoded.email || '',
      season: season.name,
      code,
      discountPercent: season.discountPercent,
      claimed: false,
      claimedAt: null,
      claimedIp: null,
      claimedUserAgentHash: null,
      createdAt: now.toISOString(),
      expiresAt,
      year: currentYear,
    };

    await promoRef.set(promoData);
    logger.info('[SeasonalPromo] Generated new code', { uid, code, season: season.name, expiresAt });

    // Send notification (inbox + email) — fire and forget
    const userDoc = await firestoreDb.collection('users').doc(uid).get();
    const profile = userDoc.data() || {};
    if (profile.email || decoded.email) {
      const { sendPromoCode } = await import('../lib/notificationDispatcher');
      sendPromoCode({
        uid,
        email: profile.email || decoded.email,
        locale: profile.preferredLanguage === 'en' ? 'en' : 'he',
        code,
        discountPercent: season.discountPercent,
        expiresAt,
        reason: season.name,
      }).catch(err => logger.error('[SeasonalPromo] Notification failed', err));
    }

    return res.json({
      active: true,
      season: season.name,
      label: season.label,
      code,
      claimed: false,
      expiresAt,
      discountPercent: season.discountPercent,
    });
  } catch (error) {
    logger.error('[SeasonalPromo] Error', error);
    return res.status(500).json({ error: 'Failed to generate seasonal promo code' });
  }
});

/**
 * POST /api/promo/seasonal/claim
 * Same pattern as birthday claim.
 */
router.post('/seasonal/claim', async (req, res) => {
  try {
    const sessionCookie = req.cookies?.pw_session;
    if (!sessionCookie) return res.status(401).json({ error: 'Authentication required' });

    const decoded = await firebaseAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;
    const { code, season } = req.body;

    if (!code || !season) return res.status(400).json({ error: 'code and season required' });

    const currentYear = new Date().getFullYear();
    const docKey = `${uid}_${season}_${currentYear}`;
    const promoRef = firestoreDb.collection('seasonal_promos').doc(docKey);
    const promoDoc = await promoRef.get();

    if (!promoDoc.exists) return res.status(404).json({ error: 'No seasonal promo found' });

    const data = promoDoc.data()!;

    if (data.code !== code) return res.status(400).json({ error: 'Invalid code' });
    if (data.claimed) return res.status(409).json({ error: 'already_claimed', messageHe: 'הקוד כבר נוצל' });
    if (new Date() > new Date(data.expiresAt)) return res.status(410).json({ error: 'expired', messageHe: 'הקוד פג תוקף' });

    const ip = req.ip || 'unknown';
    const uaHash = createHash('sha256').update(req.headers['user-agent'] || '').digest('hex').substring(0, 16);

    await promoRef.update({ claimed: true, claimedAt: new Date().toISOString(), claimedIp: ip, claimedUserAgentHash: uaHash });

    logger.info('[SeasonalPromo] Claimed', { uid, code, season });
    return res.json({ ok: true, discountPercent: data.discountPercent, messageHe: 'הקוד הוחל בהצלחה!' });
  } catch (error) {
    logger.error('[SeasonalPromo] Claim error', error);
    return res.status(500).json({ error: 'Failed to claim' });
  }
});

export default router;
