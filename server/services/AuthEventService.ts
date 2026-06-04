/**
 * AuthEventService — new-login alert & recent-login security system
 *
 * Responsibilities:
 *   1. Parse user-agent → device / browser / OS
 *   2. Resolve approximate location (city, country) from IP via ipapi.co
 *   3. Compare against the user's previous login history to detect:
 *        - new device, new browser, new location, new country, new city
 *        - high-risk IPs (Tor exit nodes, known VPN/datacenter ranges)
 *   4. Compute a risk score (0–100)
 *   5. Persist the auth_events row (no raw IP, no tokens, no passwords)
 *   6. Send a branded SendGrid alert email when the login looks new/risky
 */

import crypto from 'crypto';
import { db } from '../db';
import { loginSecurityEvents, type InsertLoginSecurityEvent } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { isPublicIP } from '../utils/ipValidation';
import { safeIPUrl } from '../lib/safeOutboundUrl';
import { sendNewLoginAlert } from '../email/new-login-alert';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginContext {
  userId: string;
  email?: string | null;
  ip: string;
  userAgent: string;
}

export interface ParsedUA {
  device: string;    // mobile | desktop | tablet | unknown
  browser: string;
  os: string;
  userAgentHash: string;
}

export interface GeoLocation {
  country: string;
  city: string;
}

export interface RiskAssessment {
  riskScore: number;
  riskFlags: string[];
  isNewDevice: boolean;
  isNewBrowser: boolean;
  isNewLocation: boolean;
  isHighRiskIp: boolean;
  eventType: 'login_success' | 'new_device_login' | 'new_browser_login' | 'new_location_login' | 'high_risk_login';
}

// ─── User-agent parsing (built-in, no external dependency) ───────────────────

/**
 * Minimal UA parser that covers modern browsers without requiring ua-parser-js.
 * Only extracts the three fields we store: device type, browser name, OS name.
 */
function parseUserAgent(ua: string): ParsedUA {
  const s = ua || '';

  // Device type — check tablet first (some Android tablets include both "Android" and "Mobile")
  const isTablet = /Tablet|iPad|Android(?!.*Mobile)/i.test(s);
  const isMobile = !isTablet && /Mobile|Android(?!.*Tablet)|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(s);
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  // Browser
  let browser = 'Unknown';
  if (/Edg\//i.test(s))           browser = 'Edge';
  else if (/OPR\//i.test(s))      browser = 'Opera';
  else if (/SamsungBrowser/i.test(s)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
  else if (/Firefox\//i.test(s))  browser = 'Firefox';
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari';
  else if (/MSIE|Trident/i.test(s)) browser = 'IE';
  else if (/curl\//i.test(s))     browser = 'curl';

  // OS
  let os = 'Unknown';
  if (/Windows NT/i.test(s))      os = 'Windows';
  else if (/Mac OS X/i.test(s) && !/iPhone|iPad/i.test(s)) os = 'macOS';
  else if (/iPhone/i.test(s))     os = 'iOS';
  else if (/iPad/i.test(s))       os = 'iPadOS';
  else if (/Android/i.test(s))    os = 'Android';
  else if (/Linux/i.test(s))      os = 'Linux';
  else if (/CrOS/i.test(s))       os = 'ChromeOS';

  // Use full 64-char hash for better collision resistance
  const userAgentHash = crypto.createHash('sha256').update(s).digest('hex');

  return { device, browser, os, userAgentHash };
}

// ─── IP utilities ─────────────────────────────────────────────────────────────

/**
 * Mask the last octet(s) of an IP for safe storage.
 * IPv4: 1.2.3.4 → 1.2.3.xxx
 * IPv6: truncated to first 4 groups + ::xxx
 */
function maskIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes(':')) {
    // IPv6 — keep first 4 groups
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::xxx';
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  return 'unknown';
}

/**
 * Stable HMAC-SHA256 hash of the raw IP using the userId as per-user salt.
 * Allows us to compare "same IP" across logins without storing the raw IP.
 *
 * IP_HASH_SALT must be set in production (env-validation.ts hard-stops if absent).
 * In development a clearly-labelled placeholder is used with a logged warning.
 * Never falls back to a hardcoded value that could be read from source code.
 */
function hashIp(ip: string, userId: string): string {
  const SALT = process.env.IP_HASH_SALT;
  if (!SALT) {
    if (process.env.NODE_ENV === 'production') {
      // env-validation.ts should have already hard-stopped, but guard here too.
      throw new Error('[AuthEventService] FATAL: IP_HASH_SALT is required in production');
    }
    logger.warn('[AuthEventService] IP_HASH_SALT not set — using dev-only placeholder. Set this before going to production.');
  }
  const effectiveSalt = SALT || 'dev-only-ip-hash-salt__not-for-production';
  // Use full 64-char hex output for maximum collision resistance
  return crypto
    .createHmac('sha256', `${effectiveSalt}:${userId}`)
    .update(ip)
    .digest('hex');
}

/**
 * Resolve approximate city/country from a public IP address.
 * Uses the free ipapi.co API (no key needed).
 * Returns fallback values on failure — never throws.
 */
async function resolveGeoLocation(ip: string): Promise<GeoLocation> {
  if (!isPublicIP(ip)) {
    return { country: 'Unknown', city: 'Unknown' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(safeIPUrl('https://ipapi.co', ip, '/json/'), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return { country: 'Unknown', city: 'Unknown' };

    const data = await res.json() as Record<string, any>;
    return {
      country: (data.country_name as string) || 'Unknown',
      city: (data.city as string) || 'Unknown',
    };
  } catch {
    return { country: 'Unknown', city: 'Unknown' };
  }
}

// ─── Risk scoring ─────────────────────────────────────────────────────────────

const HIGH_RISK_IP_PREFIXES = [
  '195.206.', // known Tor relay range (sample)
  '185.220.', // known Tor exit nodes
  '199.87.',  // known VPN/proxy range
];

function isHighRiskIpHeuristic(ip: string): boolean {
  return HIGH_RISK_IP_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

/**
 * Fetch the last N login events for a user (already in DB).
 */
async function getRecentEvents(userId: string, limit = 30) {
  try {
    return await db
      .select()
      .from(loginSecurityEvents)
      .where(eq(loginSecurityEvents.userId, userId))
      .orderBy(desc(loginSecurityEvents.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

/**
 * Compare the new login against historical events to compute risk.
 */
function computeRisk(
  parsed: ParsedUA,
  geo: GeoLocation,
  ipHash: string,
  history: Awaited<ReturnType<typeof getRecentEvents>>,
  ip: string,
): RiskAssessment {
  const flags: string[] = [];
  let score = 0;

  const isFirstLogin = history.length === 0;

  // Collect historical signals
  const seenUAHashes   = new Set(history.map((e) => e.userAgentHash).filter(Boolean));
  const seenBrowsers   = new Set(history.map((e) => e.browser).filter(Boolean));
  const seenCountries  = new Set(history.map((e) => e.country).filter(Boolean));
  const seenCities     = new Set(history.map((e) => e.city).filter(Boolean));
  const seenIpHashes   = new Set(history.map((e) => e.ipHash).filter(Boolean));

  const isNewDevice   = !isFirstLogin && !seenUAHashes.has(parsed.userAgentHash);
  const isNewBrowser  = !isFirstLogin && !seenBrowsers.has(parsed.browser);
  const isNewLocation = !isFirstLogin && (
    !seenCountries.has(geo.country) || !seenCities.has(geo.city)
  );
  const isHighRiskIp  = isHighRiskIpHeuristic(ip);
  const isNewIp       = !isFirstLogin && !seenIpHashes.has(ipHash);

  if (isNewDevice)   { flags.push('NEW_DEVICE');   score += 25; }
  if (isNewBrowser)  { flags.push('NEW_BROWSER');  score += 15; }
  if (!seenCountries.has(geo.country) && !isFirstLogin) {
    flags.push('NEW_COUNTRY'); score += 20;
  }
  if (!seenCities.has(geo.city) && !isFirstLogin) {
    flags.push('NEW_CITY');    score += 10;
  }
  if (isHighRiskIp)  { flags.push('HIGH_RISK_IP'); score += 35; }
  if (isNewIp && !isNewDevice) { flags.push('NEW_IP'); score += 5; }

  score = Math.min(score, 100);

  // Determine primary event type
  let eventType: RiskAssessment['eventType'] = 'login_success';
  if (score >= 35 || isHighRiskIp)   eventType = 'high_risk_login';
  else if (isNewDevice)              eventType = 'new_device_login';
  else if (isNewBrowser)             eventType = 'new_browser_login';
  else if (isNewLocation)            eventType = 'new_location_login';

  return {
    riskScore: score,
    riskFlags: flags,
    isNewDevice,
    isNewBrowser,
    isNewLocation,
    isHighRiskIp,
    eventType,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a login event.
 * Called immediately after every successful sign-in.
 *
 * - Never stores: passwords, tokens, raw cookies, raw user-agent, full IP
 * - Stores: masked IP, IP hash, approximate location, device metadata, risk score
 * - Sends a branded email alert when the login looks new or risky
 */
export async function recordLoginEvent(ctx: LoginContext): Promise<void> {
  try {
    const parsed  = parseUserAgent(ctx.userAgent);
    const geo     = await resolveGeoLocation(ctx.ip);
    const ipHash  = hashIp(ctx.ip, ctx.userId);
    const masked  = maskIp(ctx.ip);
    const history = await getRecentEvents(ctx.userId, 50);
    const risk    = computeRisk(parsed, geo, ipHash, history, ctx.ip);

    const row: InsertLoginSecurityEvent = {
      userId:       ctx.userId,
      email:        ctx.email || null,
      eventType:    risk.eventType,
      maskedIp:     masked,
      ipHash,
      country:      geo.country,
      city:         geo.city,
      device:       parsed.device,
      browser:      parsed.browser,
      os:           parsed.os,
      userAgentHash: parsed.userAgentHash,
      riskScore:    risk.riskScore,
      riskFlags:    risk.riskFlags,
      isNewDevice:  risk.isNewDevice,
      isNewBrowser: risk.isNewBrowser,
      isNewLocation: risk.isNewLocation,
      isHighRiskIp: risk.isHighRiskIp,
    };

    await db.insert(loginSecurityEvents).values(row);

    logger.info('[AuthEventService] Login event recorded', {
      userId: ctx.userId,
      eventType: risk.eventType,
      riskScore: risk.riskScore,
      flags: risk.riskFlags,
    });

    // Send user-facing alert if the login is new/risky
    const shouldAlert =
      risk.isNewDevice ||
      risk.isNewBrowser ||
      risk.isNewLocation ||
      risk.isHighRiskIp;

    if (shouldAlert && ctx.email) {
      // Fire-and-forget — never block the auth flow
      sendNewLoginAlert({
        to: ctx.email,
        timestamp: new Date(),
        city: geo.city,
        country: geo.country,
        device: parsed.device,
        browser: parsed.browser,
        os: parsed.os,
        riskFlags: risk.riskFlags,
      }).catch((err) => {
        logger.warn('[AuthEventService] Failed to send new-login email (non-fatal)', { error: String(err) });
      });
    }
  } catch (err) {
    // Never let this block the sign-in flow
    logger.error('[AuthEventService] Failed to record login event', { error: String(err) });
  }
}

/**
 * Return the last N auth events for a user, safe for client exposure.
 * Strips internal fields — no raw IP, no hashes, no tokens.
 */
export async function getRecentLoginsForUser(userId: string, limit = 20) {
  const rows = await db
    .select()
    .from(loginSecurityEvents)
    .where(eq(loginSecurityEvents.userId, userId))
    .orderBy(desc(loginSecurityEvents.createdAt))
    .limit(Math.min(limit, 50));

  return rows.map((r) => ({
    id:          r.id,
    eventType:   r.eventType,
    maskedIp:    r.maskedIp,
    country:     r.country,
    city:        r.city,
    device:      r.device,
    browser:     r.browser,
    os:          r.os,
    riskScore:   r.riskScore,
    riskFlags:   r.riskFlags as string[],
    isNewDevice: r.isNewDevice,
    isNewBrowser: r.isNewBrowser,
    isNewLocation: r.isNewLocation,
    isHighRiskIp: r.isHighRiskIp,
    createdAt:   r.createdAt,
  }));
}
