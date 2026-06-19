/**
 * integrationHealth.ts — LIVE integration fault-detector ("the guard").
 *
 * configHealth.ts answers "is the env var PRESENT?". This module answers the
 * harder question: "does the integration actually WORK right now?" — by doing
 * real, bounded probes (a DB ping, a Firebase token sign, a Twilio SID format
 * check, a Redis reachability check, …) and returning a red/green report.
 *
 * Why this exists: the platform had multiple SILENT failures — Firebase Hosting
 * stripping the session cookie, a malformed TWILIO_ACCOUNT_SID 503'ing all SMS,
 * OTP codes lost when REDIS_URL is unset (per-instance memory on Cloud Run),
 * SendGrid blackouts, Google Maps quietly billing. None surfaced anywhere. This
 * gives ops/CEO one screen that lights up the broken thing instead of guessing.
 *
 * ABSOLUTE RULE (same as configHealth): NEVER read, return, or log a secret
 * VALUE. Format checks (e.g. "does the SID start with AC", "does the key start
 * with SG.") return only a boolean — never the value or any fragment of it.
 *
 * Every probe is wrapped in a timeout so the endpoint can never hang on a dead
 * downstream. Admin-gated at the route layer.
 */

import { logger } from './logger';

export type ProbeState = 'ok' | 'warn' | 'down' | 'unknown';

export interface ProbeResult {
  key: string;
  /** Human label, safe for an admin screen. */
  label: string;
  state: ProbeState;
  /** Safe explanation — never contains a secret value. */
  detail: string;
}

export interface IntegrationHealthReport {
  generatedAt: string;
  nodeEnv: string;
  /** Worst state across all probes — 'down' if any critical probe is down. */
  overall: ProbeState;
  downCount: number;
  warnCount: number;
  probes: ProbeResult[];
}

const isPresent = (name: string): boolean => {
  const v = process.env[name];
  return typeof v === 'string' && v.length > 0;
};

/** Bound a probe so a dead downstream cannot hang the report. */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`probe timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// ── Individual probes ──────────────────────────────────────────────────────

async function probeDatabase(): Promise<ProbeResult> {
  const base = { key: 'database', label: 'Database (Neon Postgres)' };
  try {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    await withTimeout(db.execute(sql`SELECT 1`), 4000);
    return { ...base, state: 'ok', detail: 'SELECT 1 succeeded' };
  } catch (err: any) {
    return { ...base, state: 'down', detail: `unreachable: ${err?.message || 'error'}` };
  }
}

async function probeFirebaseAdmin(): Promise<ProbeResult> {
  const base = { key: 'firebase_admin', label: 'Firebase Admin (login token signing)' };
  try {
    const firebaseAdmin = (await import('./firebase-admin')).default;
    const auth = firebaseAdmin.auth();
    // Local signing — proves the service-account private key works.
    await withTimeout(auth.createCustomToken('integration-health-probe'), 5000);
    // Identity-Toolkit network call — proves verifySessionCookie(checkRevoked)
    // and getUser will work (this is the call that broke web + native before).
    let canReadUsers = false;
    try {
      await withTimeout(auth.listUsers(1), 5000);
      canReadUsers = true;
    } catch {
      canReadUsers = false;
    }
    if (canReadUsers) {
      return { ...base, state: 'ok', detail: 'can sign tokens AND read users (Identity Toolkit reachable)' };
    }
    return { ...base, state: 'warn', detail: 'can sign tokens but listUsers failed (session revocation checks may degrade)' };
  } catch (err: any) {
    return { ...base, state: 'down', detail: `cannot sign tokens — login will fail: ${err?.message || 'error'}` };
  }
}

async function probeSessionCookie(): Promise<ProbeResult> {
  const base = { key: 'session_cookie', label: 'Session cookie (Firebase Hosting passthrough)' };
  try {
    const { SESSION_COOKIE_NAME } = await import('./sessionCookies');
    // Firebase Hosting forwards ONLY a cookie named exactly __session to Cloud
    // Run. If the name ever drifts off __session, web login silently 401s again.
    if (SESSION_COOKIE_NAME === '__session') {
      return { ...base, state: 'ok', detail: 'cookie is named __session (survives Firebase Hosting CDN)' };
    }
    return {
      ...base,
      state: 'down',
      detail: `cookie is "${SESSION_COOKIE_NAME}" — Firebase Hosting strips every name except __session, so web login will 401`,
    };
  } catch (err: any) {
    return { ...base, state: 'unknown', detail: `could not read cookie config: ${err?.message || 'error'}` };
  }
}

function probeSms(): ProbeResult {
  const base = { key: 'sms_twilio', label: 'SMS / OTP (Twilio)' };
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const sender = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || !sender) {
    return { ...base, state: 'down', detail: 'not configured (SID / token / sender missing) — phone OTP login disabled' };
  }
  // Format check only — boolean, never echoes the value. A SID that does not
  // start with "AC" 503'd all SMS once; this catches that paste error.
  if (!sid.startsWith('AC')) {
    return { ...base, state: 'down', detail: 'TWILIO_ACCOUNT_SID does not start with "AC" — Twilio client will fail, all OTP 503s' };
  }
  if (String(process.env.SMS_EMERGENCY_DISABLED).toLowerCase() === 'true') {
    return { ...base, state: 'warn', detail: 'configured but SMS_EMERGENCY_DISABLED=true (kill switch ON)' };
  }
  return { ...base, state: 'ok', detail: 'configured; SID format valid' };
}

function probeEmail(): ProbeResult {
  const base = { key: 'email', label: 'Email (SendGrid + Gmail fallback)' };
  const sg = process.env.SENDGRID_API_KEY;
  const gmailFallback = isPresent('GMAIL_CLIENT_ID') && isPresent('GMAIL_REFRESH_TOKEN');
  if (sg && sg.startsWith('SG.')) {
    return { ...base, state: 'ok', detail: `SendGrid key present (valid prefix)${gmailFallback ? ' + Gmail fallback ready' : ''}` };
  }
  if (sg && !sg.startsWith('SG.')) {
    return { ...base, state: 'down', detail: 'SENDGRID_API_KEY does not start with "SG." — email will silently blackout' };
  }
  if (gmailFallback) {
    return { ...base, state: 'warn', detail: 'SendGrid not set; Gmail fallback present (lower deliverability)' };
  }
  return { ...base, state: 'down', detail: 'no email provider configured — eGift codes & receipts will not send' };
}

async function probeRedis(): Promise<ProbeResult> {
  const base = { key: 'redis', label: 'Redis (OTP store + rate limits across instances)' };
  if (!isPresent('REDIS_URL')) {
    // This is the silent phone-login killer on Cloud Run: without Redis, OTP
    // codes live in per-instance memory, so the verify request can land on a
    // different instance and report "wrong code".
    return {
      ...base,
      state: 'warn',
      detail: 'REDIS_URL not set — OTP codes stored per-instance; multi-instance verify can fail ("wrong code")',
    };
  }
  try {
    const mod: any = await import('../services/redis').catch(() => null);
    const client = mod?.redis || mod?.default;
    if (client && typeof client.isConnected === 'function') {
      const connected = await withTimeout(Promise.resolve(client.isConnected()), 2000);
      return connected
        ? { ...base, state: 'ok', detail: 'configured and connected' }
        : { ...base, state: 'down', detail: 'REDIS_URL set but client not connected' };
    }
    return { ...base, state: 'ok', detail: 'REDIS_URL set (connection status not exposed by client)' };
  } catch (err: any) {
    return { ...base, state: 'warn', detail: `REDIS_URL set; status check failed: ${err?.message || 'error'}` };
  }
}

function probeMapsCost(): ProbeResult {
  const base = { key: 'google_maps', label: 'Google Maps / Places (cost meter)' };
  const keyPresent = isPresent('GOOGLE_MAPS_API_KEY') || isPresent('VITE_GOOGLE_MAPS_API_KEY');
  if (!keyPresent) {
    return { ...base, state: 'ok', detail: 'no Maps key — zero Google billing (app uses free OSM)' };
  }
  // GOOGLE_PLACES_LIVE gates the PAID Places autocomplete/details proxy.
  // COST GUARD (2026-06-19): the paid meter is OFF by default in every env;
  // it runs ONLY when GOOGLE_PLACES_LIVE is explicitly "true".
  const placesLive = String(process.env.GOOGLE_PLACES_LIVE).toLowerCase().trim() === 'true';
  if (placesLive) {
    return {
      ...base,
      state: 'warn',
      detail: 'Maps key present AND GOOGLE_PLACES_LIVE="true" — paid Places/Geocoding is ON (cost risk)',
    };
  }
  return { ...base, state: 'ok', detail: 'Maps key present but GOOGLE_PLACES_LIVE not "true" — paid Places disabled (free OSM in use)' };
}

function probeWebhookSecrets(): ProbeResult {
  const base = { key: 'webhook_secrets', label: 'Webhook signing secrets' };
  const missing: string[] = [];
  // Only flag a missing secret when its integration is enabled, so we don't
  // cry wolf about dormant rails.
  if (String(process.env.NAYAX_ENABLED).toLowerCase() === 'true' && !isPresent('NAYAX_WEBHOOK_SECRET')) missing.push('NAYAX_WEBHOOK_SECRET');
  if (String(process.env.SUMIT_ENABLED).toLowerCase() === 'true' && !isPresent('SUMIT_WEBHOOK_SECRET')) missing.push('SUMIT_WEBHOOK_SECRET');
  // Meta/WhatsApp webhook fails OPEN (accepts unsigned) when its secret is
  // unset — that's a security gap whenever the feature is wired at all.
  if (isPresent('META_WHATSAPP_TOKEN') && !isPresent('META_WEBHOOK_SECRET')) missing.push('META_WEBHOOK_SECRET (webhook would accept unsigned)');
  if (missing.length === 0) {
    return { ...base, state: 'ok', detail: 'all enabled webhooks have signing secrets' };
  }
  return { ...base, state: 'warn', detail: `missing signing secret(s): ${missing.join(', ')}` };
}

function probeRecaptcha(): ProbeResult {
  const base = { key: 'recaptcha', label: 'reCAPTCHA / App Check (bot defense)' };
  const site = isPresent('VITE_RECAPTCHA_SITE_KEY');
  const secret = isPresent('RECAPTCHA_SECRET_KEY');
  if (site && secret) return { ...base, state: 'ok', detail: 'site + secret keys present' };
  if (!site && !secret) return { ...base, state: 'warn', detail: 'no reCAPTCHA keys — bot defense degraded (fail-open)' };
  return { ...base, state: 'warn', detail: `incomplete: ${site ? 'secret missing' : 'site key missing'}` };
}

// ── Aggregate ──────────────────────────────────────────────────────────────

export async function buildIntegrationHealthReport(): Promise<IntegrationHealthReport> {
  const settled = await Promise.allSettled<ProbeResult>([
    probeDatabase(),
    probeFirebaseAdmin(),
    probeSessionCookie(),
    Promise.resolve(probeSms()),
    Promise.resolve(probeEmail()),
    probeRedis(),
    Promise.resolve(probeMapsCost()),
    Promise.resolve(probeWebhookSecrets()),
    Promise.resolve(probeRecaptcha()),
  ]);

  const probes: ProbeResult[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { key: `probe_${i}`, label: 'probe', state: 'unknown' as ProbeState, detail: `probe threw: ${r.reason?.message || 'error'}` },
  );

  const downCount = probes.filter((p) => p.state === 'down').length;
  const warnCount = probes.filter((p) => p.state === 'warn').length;
  const overall: ProbeState = downCount > 0 ? 'down' : warnCount > 0 ? 'warn' : 'ok';

  if (downCount > 0) {
    logger.error('[IntegrationHealth] integration(s) DOWN', {
      down: probes.filter((p) => p.state === 'down').map((p) => p.key),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'unknown',
    overall,
    downCount,
    warnCount,
    probes,
  };
}
