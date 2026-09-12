/**
 * Wallet pass live sync (2026-09-12).
 *
 * The member's Apple / Google Wallet pass carries a "STORED CREDIT" figure.
 * Before this service only `POST /api/pass/redeem` pushed a fresh figure (and
 * only to Google); nothing pushed to Apple at all. A top-up, an eGift, a
 * refund, a dispute credit or a K9000 wash paid from the wallet therefore
 * left the pass on the phone showing a stale balance until the member
 * happened to re-open it.
 *
 * ONE entry point, called fire-and-forget after every committed wallet
 * mutation:
 *
 *     schedulePassSync(userId, 'k9000_debit')
 *
 * plus `sweepStalePasses()` (cron, every 2 min) that catches every writer that
 * did not call it — raw SQL in disputes / policy engine, and future code: any
 * ACTIVE pass whose live wallet balance differs from the figure last pushed
 * to the phone is re-synced.
 *
 * What a sync does, in order:
 *   1. write the live balance + updated_at on petwash_pass_accounts — so the
 *      Apple `passesUpdatedSince` poll and the next manual open serve the
 *      right figure even when no push can be sent;
 *   2. Google: upsert the pass object (only when the issuer is configured);
 *   3. Apple: silent APNs push to every registered device (only when the
 *      APNs key is configured) — this is what makes the iPhone refresh the
 *      pass on its own.
 *
 * Truth contract: the result NEVER claims a push it did not achieve. A missing
 * credential is reported as `skipped` with a reason, never as success.
 */

import http2 from 'http2';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { appleWalletDeviceRegistrations, petwashPassAccounts, walletAccounts } from '@shared/schema';
import { logger } from '../lib/logger';
import { isGoogleWalletConfigured, pushUpdate } from './GoogleWalletService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PassSyncReason =
  | 'credit_added'
  | 'redemption_confirmed'
  | 'redemption_refunded'
  | 'admin_injection'
  | 'booking_debit'
  | 'booking_refund'
  | 'k9000_debit'
  | 'k9000_compensation'
  | 'egift_purchase'
  | 'egift_redeem'
  | 'sweep'
  | 'manual';

export interface PassRow {
  passId: string;
  userId: string;
  ownerName: string;
  primaryPetName: string | null;
  tier: string;
  availableCreditIls: string;
  validUntil: Date | null;
  status: string;
  qrTokenVersion: number;
  appleSerialNumber: string | null;
}

export interface LiveBalance {
  /** Cash + eGift + promo, in ILS with two decimals — the figure the pass shows. */
  availableCreditIls: string;
  loyaltyTier: string | null;
}

export interface ApplePushResult {
  attempted: number;
  pushed: number;
  skipped: number;
  failed: number;
  reason?: 'APNS_NOT_CONFIGURED' | 'NO_DEVICES' | 'INTERNAL_ERROR';
}

export interface PassSyncResult {
  userId: string;
  reason: PassSyncReason;
  status: 'no_pass' | 'unchanged' | 'synced';
  balanceBefore?: string;
  balanceAfter?: string;
  google?: 'pushed' | 'skipped' | 'failed';
  apple?: ApplePushResult;
}

export interface PassSyncDeps {
  loadPass: (userId: string) => Promise<PassRow | null>;
  liveBalance: (userId: string) => Promise<LiveBalance>;
  savePassBalance: (userId: string, availableCreditIls: string) => Promise<void>;
  googleConfigured: () => boolean;
  pushGoogle: (pass: PassRow, availableCreditIls: string) => Promise<void>;
  pushApple: (serialNumber: string) => Promise<ApplePushResult>;
}

// ─── Live balance (single source for the pass figure) ────────────────────────

/** The one formula for what the pass shows. pass-universal serves the same figure. */
export function passBalanceIlsFromCents(row: {
  cashWalletBalanceCents?: number | null;
  egiftBalanceCents?: number | null;
  promoBalanceCents?: number | null;
}): string {
  const cents = (row.cashWalletBalanceCents ?? 0) + (row.egiftBalanceCents ?? 0) + (row.promoBalanceCents ?? 0);
  return (cents / 100).toFixed(2);
}

export async function lookupLivePassBalance(userId: string): Promise<LiveBalance> {
  const [wallet] = await db
    .select({
      cashWalletBalanceCents: walletAccounts.cashWalletBalanceCents,
      egiftBalanceCents:      walletAccounts.egiftBalanceCents,
      promoBalanceCents:      walletAccounts.promoBalanceCents,
      loyaltyTier:            walletAccounts.loyaltyTier,
    })
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, userId))
    .limit(1);
  return {
    availableCreditIls: passBalanceIlsFromCents(wallet ?? {}),
    loyaltyTier: wallet?.loyaltyTier ?? null,
  };
}

// ─── Apple: silent APNs push over HTTP/2 (no dependency) ─────────────────────
//
// A Wallet pass update push is an EMPTY JSON body sent to the device's pass
// push token with `apns-topic` = the Pass Type ID. Auth is a token (JWT ES256)
// signed with the .p8 key from the developer account. Apple asks that the
// token be reused for 20–60 min, so it is cached for 50.
//
// Env (same names `server/appleWallet.ts` already documents):
//   APPLE_APNS_KEY      the .p8 contents (PEM)
//   APPLE_APNS_KEY_ID   10-char key id
//   APPLE_TEAM_ID       10-char team id
//   APPLE_PASS_TYPE_ID  pass.com.petwash.…  (the push topic)

let cachedApnsJwt: { token: string; issuedAt: number } | null = null;

export function apnsConfigured(): boolean {
  return !!(process.env.APPLE_APNS_KEY && process.env.APPLE_APNS_KEY_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_PASS_TYPE_ID);
}

export function buildApnsJwt(now = Date.now()): string {
  if (cachedApnsJwt && now - cachedApnsJwt.issuedAt < 50 * 60 * 1000) return cachedApnsJwt.token;
  const key = String(process.env.APPLE_APNS_KEY ?? '').replace(/\\n/g, '\n');
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'ES256', kid: process.env.APPLE_APNS_KEY_ID });
  const claims = b64({ iss: process.env.APPLE_TEAM_ID, iat: Math.floor(now / 1000) });
  const signature = crypto
    .sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  const token = `${header}.${claims}.${signature}`;
  cachedApnsJwt = { token, issuedAt: now };
  return token;
}

function apnsHost(): string {
  return process.env.APNS_HOST || (process.env.NODE_ENV === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com');
}

/** One push to one device. Resolves to the APNs status; 410/400-BadDeviceToken → the token is dead. */
export function sendApnsPassPush(pushToken: string, topic: string, jwt: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const client = http2.connect(apnsHost());
    const done = (fn: () => void) => { try { client.close(); } catch { /* noop */ } fn(); };
    client.on('error', (err) => done(() => reject(err)));
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'authorization': `bearer ${jwt}`,
      'apns-topic': topic,
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    let status = 0;
    let body = '';
    req.setTimeout(8000, () => done(() => reject(new Error('APNS_TIMEOUT'))));
    req.on('response', (headers) => { status = Number(headers[':status'] ?? 0); });
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => done(() => resolve({ status, body })));
    req.on('error', (err) => done(() => reject(err)));
    req.end('{}');
  });
}

export async function pushApplePassUpdate(serialNumber: string): Promise<ApplePushResult> {
  try {
    const regs = await db
      .select({ id: appleWalletDeviceRegistrations.id, pushToken: appleWalletDeviceRegistrations.pushToken })
      .from(appleWalletDeviceRegistrations)
      .where(eq(appleWalletDeviceRegistrations.serialNumber, serialNumber));

    if (!regs.length) return { attempted: 0, pushed: 0, skipped: 0, failed: 0, reason: 'NO_DEVICES' };

    if (!apnsConfigured()) {
      logger.warn('[WalletPassSync] APNs not configured — Apple pass will refresh on next manual open', {
        serialNumber, devices: regs.length,
        missing: ['APPLE_APNS_KEY', 'APPLE_APNS_KEY_ID', 'APPLE_TEAM_ID', 'APPLE_PASS_TYPE_ID'].filter((k) => !process.env[k]),
      });
      return { attempted: 0, pushed: 0, skipped: regs.length, failed: 0, reason: 'APNS_NOT_CONFIGURED' };
    }

    const jwt = buildApnsJwt();
    const topic = String(process.env.APPLE_PASS_TYPE_ID);
    let pushed = 0;
    let failed = 0;
    for (const reg of regs) {
      try {
        const { status, body } = await sendApnsPassPush(reg.pushToken, topic, jwt);
        if (status === 200) { pushed += 1; continue; }
        failed += 1;
        const dead = status === 410 || /BadDeviceToken|Unregistered/.test(body);
        logger.warn('[WalletPassSync] APNs rejected pass push', { serialNumber, status, body: body.slice(0, 200), dead });
        if (dead) {
          await db.delete(appleWalletDeviceRegistrations).where(eq(appleWalletDeviceRegistrations.id, reg.id));
        }
      } catch (err) {
        failed += 1;
        logger.warn('[WalletPassSync] APNs push threw', { serialNumber, err: String((err as Error)?.message ?? err) });
      }
    }
    return { attempted: regs.length, pushed, skipped: 0, failed };
  } catch (err) {
    logger.error('[WalletPassSync] Apple push lookup failed', { serialNumber, err });
    return { attempted: 0, pushed: 0, skipped: 0, failed: 0, reason: 'INTERNAL_ERROR' };
  }
}

// ─── Default deps (production wiring) ────────────────────────────────────────

const passRowProjection = {
  passId:             petwashPassAccounts.passId,
  userId:             petwashPassAccounts.userId,
  ownerName:          petwashPassAccounts.ownerName,
  primaryPetName:     petwashPassAccounts.primaryPetName,
  tier:               petwashPassAccounts.tier,
  availableCreditIls: petwashPassAccounts.availableCreditIls,
  validUntil:         petwashPassAccounts.validUntil,
  status:             petwashPassAccounts.status,
  qrTokenVersion:     petwashPassAccounts.qrTokenVersion,
  appleSerialNumber:  petwashPassAccounts.appleSerialNumber,
};

function isMissingPassTable(err: unknown): boolean {
  const m = String((err as Error)?.message ?? err ?? '').toLowerCase();
  return m.includes('petwash_pass_accounts') && m.includes('does not exist');
}

export const defaultPassSyncDeps: PassSyncDeps = {
  loadPass: async (userId) => {
    try {
      const [row] = await db.select(passRowProjection).from(petwashPassAccounts)
        .where(eq(petwashPassAccounts.userId, userId)).limit(1);
      return row ? { ...row, availableCreditIls: String(row.availableCreditIls) } : null;
    } catch (err) {
      if (isMissingPassTable(err)) return null;
      throw err;
    }
  },
  liveBalance: lookupLivePassBalance,
  savePassBalance: async (userId, availableCreditIls) => {
    await db.update(petwashPassAccounts)
      .set({ availableCreditIls, updatedAt: new Date() })
      .where(eq(petwashPassAccounts.userId, userId));
  },
  googleConfigured: isGoogleWalletConfigured,
  pushGoogle: async (pass, availableCreditIls) => {
    await pushUpdate({
      passId:             pass.passId,
      userId:             pass.userId,
      ownerName:          pass.ownerName,
      primaryPetName:     pass.primaryPetName ?? undefined,
      tier:               pass.tier,
      availableCreditIls: Number(availableCreditIls),
      validUntil:         pass.validUntil?.toISOString().split('T')[0],
      qrTokenVersion:     pass.qrTokenVersion,
    });
  },
  pushApple: pushApplePassUpdate,
};

// ─── The sync ─────────────────────────────────────────────────────────────────

export async function syncPassForUser(
  userId: string,
  reason: PassSyncReason,
  opts: { force?: boolean } = {},
  deps: PassSyncDeps = defaultPassSyncDeps,
): Promise<PassSyncResult> {
  const pass = await deps.loadPass(userId);
  if (!pass || pass.status !== 'ACTIVE') return { userId, reason, status: 'no_pass' };

  const live = await deps.liveBalance(userId);
  const before = Number(pass.availableCreditIls).toFixed(2);
  const after = Number(live.availableCreditIls).toFixed(2);
  if (!opts.force && before === after) return { userId, reason, status: 'unchanged', balanceBefore: before, balanceAfter: after };

  // 1. the row — this alone makes the next open / passesUpdatedSince poll correct
  await deps.savePassBalance(userId, after);

  // 2. Google
  let google: PassSyncResult['google'] = 'skipped';
  if (deps.googleConfigured()) {
    try { await deps.pushGoogle(pass, after); google = 'pushed'; }
    catch (err) { google = 'failed'; logger.warn('[WalletPassSync] Google push failed', { userId, err: String((err as Error)?.message ?? err) }); }
  }

  // 3. Apple
  const apple = await deps.pushApple(pass.appleSerialNumber ?? pass.passId);

  const result: PassSyncResult = { userId, reason, status: 'synced', balanceBefore: before, balanceAfter: after, google, apple };
  logger.info('[WalletPassSync] pass synced', result);
  return result;
}

// ─── Fire-and-forget, debounced per user ─────────────────────────────────────

const pending = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 750;

/**
 * Call after a wallet balance has been COMMITTED. Never throws, never blocks.
 * A burst of writes for one member (hold → debit → ledger) collapses into one
 * push. If the caller is still inside its transaction the debounce almost
 * always outlives the commit; the 2-minute sweep covers the rest.
 */
export function schedulePassSync(userId: string | null | undefined, reason: PassSyncReason): void {
  if (!userId) return;
  if (process.env.WALLET_PASS_SYNC_DISABLED === 'true') return;
  const existing = pending.get(userId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pending.delete(userId);
    syncPassForUser(userId, reason).catch((err) => {
      logger.warn('[WalletPassSync] scheduled sync failed (non-fatal)', { userId, reason, err: String((err as Error)?.message ?? err) });
    });
  }, DEBOUNCE_MS);
  timer.unref?.();
  pending.set(userId, timer);
}

/** Test hook: how many user syncs are waiting on the debounce. */
export function pendingPassSyncCount(): number {
  return pending.size;
}

// ─── Sweep: every writer we did not hook ─────────────────────────────────────

export async function findStalePassUserIds(limit = 200): Promise<string[]> {
  try {
    const rows = await db.execute(sql`
      SELECT p.user_id
        FROM petwash_pass_accounts p
        JOIN wallet_accounts w ON w.user_id = p.user_id
       WHERE p.status = 'ACTIVE'
         AND ROUND((COALESCE(w.cash_wallet_balance_cents, 0)
                  + COALESCE(w.egift_balance_cents, 0)
                  + COALESCE(w.promo_balance_cents, 0)) / 100.0, 2) <> p.available_credit_ils
       LIMIT ${limit}
    `);
    return ((rows as any).rows ?? rows ?? []).map((r: any) => String(r.user_id));
  } catch (err) {
    if (isMissingPassTable(err)) return [];
    throw err;
  }
}

export async function sweepStalePasses(): Promise<{ checked: number; synced: number }> {
  const userIds = await findStalePassUserIds();
  let synced = 0;
  for (const userId of userIds) {
    try {
      const r = await syncPassForUser(userId, 'sweep');
      if (r.status === 'synced') synced += 1;
    } catch (err) {
      logger.warn('[WalletPassSync] sweep sync failed for user (continuing)', { userId, err: String((err as Error)?.message ?? err) });
    }
  }
  if (userIds.length) logger.info('[WalletPassSync] sweep done', { checked: userIds.length, synced });
  return { checked: userIds.length, synced };
}
