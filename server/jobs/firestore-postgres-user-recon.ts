/**
 * Firestore ↔ Postgres user / prestige-pass reconciliation — DETECT-ONLY.
 *
 * The Octopus "main brain" reads Postgres. Identity lives in Firebase Auth +
 * Firestore (`users/{uid}`, `prestige_passes/{uid}`), and the Postgres user row
 * is created LAZILY on first authenticated request — so a user who authed but
 * never triggered the bridge is invisible to the brain, and Firestore-only
 * prestige passes have no Postgres mirror. This nightly job surfaces that drift.
 *
 * Why it's safe:
 *   - Firestore .count() AGGREGATIONS only (no full-collection reads → ~1 read
 *     per 1000 docs; negligible cost) + two Postgres COUNT(*) selects.
 *   - Writes NOTHING to any money/identity table. On drift it raises ONE
 *     deduped admin alert (admin_alerts) — never auto-heals.
 *   - Fully wrapped in try/catch; a Firestore/DB hiccup never throws.
 *
 * Schedule: nightly 03:30 Asia/Jerusalem (just after the wallet drift detector).
 * Manual proof pass: runFirestorePgUserRecon('manual').
 */
import cron from 'node-cron';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../lib/logger';
import { createOrUpdateAlert } from '../services/AlertEngine';

const LABEL = '[FirestorePgUserRecon]';

/** Drift beyond this many rows raises an alert; a much larger gap escalates. */
const WARN_THRESHOLD = 5;
const CRITICAL_THRESHOLD = 50;

export async function runFirestorePgUserRecon(trigger: 'cron' | 'manual' = 'cron') {
  try {
    const { getFirestore } = await import('../lib/firebase-admin');
    const fs = getFirestore();

    const [fsUsersSnap, fsPassSnap] = await Promise.all([
      fs.collection('users').count().get(),
      fs.collection('prestige_passes').count().get(),
    ]);
    const fsUsers = fsUsersSnap.data().count;
    const fsPasses = fsPassSnap.data().count;

    const [ur] = (await db.execute(sql`SELECT COUNT(*)::int AS c FROM users`)).rows as any[];
    const [wr] = (await db.execute(sql`SELECT COUNT(*)::int AS c FROM wallet_accounts`)).rows as any[];
    const pgUsers = Number(ur?.c ?? 0);
    const pgWallets = Number(wr?.c ?? 0);

    // Firebase can legitimately lead Postgres (lazy bridge), so only a POSITIVE
    // gap (Firestore > Postgres) is drift worth flagging.
    const userDrift = fsUsers - pgUsers;
    const passDrift = fsPasses - pgWallets;

    logger.info(`${LABEL} counts`, { fsUsers, pgUsers, userDrift, fsPasses, pgWallets, passDrift, trigger });

    if (userDrift > WARN_THRESHOLD || passDrift > WARN_THRESHOLD) {
      const big = userDrift > CRITICAL_THRESHOLD || passDrift > CRITICAL_THRESHOLD;
      await createOrUpdateAlert({
        dedupeKey: 'firestore_pg_user_drift',
        category: 'support',
        severity: big ? 'critical' : 'warning',
        title: 'Firestore↔Postgres user/pass drift',
        message:
          `Firebase users=${fsUsers} vs Postgres users=${pgUsers} (drift ${userDrift}); ` +
          `prestige passes=${fsPasses} vs wallet_accounts=${pgWallets} (drift ${passDrift}). ` +
          `Users authed via Firebase but not synced to the Octopus brain (Postgres), and/or ` +
          `Firestore-only prestige passes without a Postgres mirror. Detect-only — no auto-heal.`,
        source: 'firestore_pg_recon',
        metadata: { fsUsers, pgUsers, userDrift, fsPasses, pgWallets, passDrift },
      }).catch(() => { /* alert best-effort */ });
    }

    return { fsUsers, pgUsers, userDrift, fsPasses, pgWallets, passDrift };
  } catch (err) {
    logger.warn(`${LABEL} failed (non-blocking)`, { err: String(err) });
    return null;
  }
}

export function startFirestorePgUserRecon() {
  cron.schedule('30 3 * * *', () => { void runFirestorePgUserRecon('cron'); }, { timezone: 'Asia/Jerusalem' });
  logger.info(`${LABEL} scheduled nightly 03:30 Asia/Jerusalem`);
}
