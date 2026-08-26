/**
 * LegalAcceptanceService — the ONE writer that every legal acceptance path
 * on the platform goes through. Created 2026-08-25 as the canonical
 * evidence ledger for Israeli-Privacy-Law + CPA §14ג compliance.
 *
 * Before this, only signing_sessions (provider declarations) and
 * biometric_consents wrote per-user evidence. ~30 customer-facing legal
 * pages (ToS / Privacy / Cancellation / Emergency Vet / Wallet & eGift
 * Terms / etc.) were passive-display only — no proof any specific user
 * ever accepted them.
 *
 * Every writer + reader lives here so the legal-recovery lane can
 * expand one page at a time without adding a new persistence pattern.
 */
import { pool } from '../db';
import { logger } from '../lib/logger';
import crypto from 'crypto';

export interface RecordLegalAcceptanceInput {
  userId: string;                    // Firebase UID
  documentKey: string;               // 'customer_tos' | 'privacy_policy' | 'cancellation_refund_14g' | ...
  docVersion: string;                // '2026-01-15' or semver
  language: string;                  // 'he' | 'en' | 'ar' | ...
  ipAddress?: string | null;         // caller should pass req.ip (see PR #2158 — never raw XFF)
  userAgent?: string | null;         // caller should pass req.get('user-agent')
  deviceFingerprint?: string | null;
  snapshotText?: string;             // exact text as shown; hashed for evidence
  snapshotUrl?: string | null;       // GCS URL if a PDF was archived
  source?: 'client' | 'admin_backfill' | 'docuseal' | 'migration';
  actorRole?: 'self' | 'admin' | 'system';
  metadata?: Record<string, unknown>;
}

export interface LegalAcceptanceRow {
  id: number;
  userId: string;
  documentKey: string;
  docVersion: string;
  language: string;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  snapshotHash: string | null;
  snapshotUrl: string | null;
  source: string;
  actorRole: string | null;
}

/**
 * Structured result of a canonical ledger write. Never a raw DB error;
 * `errorCode` is a stable machine-readable classification the caller
 * uses to decide policy (SHADOW / AUTHORITATIVE — see file header).
 *
 * CEO 2026-08-26 correction pass #2 §1: this function used to swallow
 * DB failures and return `null`, which meant `.catch()` in callers
 * NEVER fired for a normal DB error. Callers now MUST branch on
 * `result.ok` — a mistaken `.catch()`-only pattern is now visibly
 * wrong at the type level.
 */
export type LegalAcceptanceWriteError =
  | 'MISSING_FIELDS'
  | 'DB_INSERT_FAILED'
  | 'DB_READBACK_FAILED';

export type LegalAcceptanceWriteResult =
  | { ok: true;  row: LegalAcceptanceRow;   alreadyAccepted: boolean }
  | { ok: false; errorCode: LegalAcceptanceWriteError; message: string };

/**
 * A caller either treats this write as SHADOW (best-effort; failure
 * feeds the observability signal but the primary flow proceeds) or
 * AUTHORITATIVE (failure is fatal; the primary flow must not claim
 * acceptance). One function; two policies at the call site — never
 * ambiguous.
 *
 * Idempotent: same (userId, documentKey, docVersion) → single row.
 * A NEW docVersion accumulates as its own row (version history
 * preserved). Re-submitting the same version returns alreadyAccepted=true
 * with the ORIGINAL row (does NOT bump acceptedAt) — the legally
 * meaningful moment is the first acceptance.
 *
 * Observability (CEO §2): failed writes emit a
 * LEGAL_ACCEPTANCE_SHADOW_MISSING signal via emitShadowFailure() so a
 * dashboard / alert / reconciliation queue can see divergence rather
 * than just a console warning. Signal never contains snapshotText.
 */
export async function recordLegalAcceptance(
  input: RecordLegalAcceptanceInput,
): Promise<LegalAcceptanceWriteResult> {
  if (!input.userId || !input.documentKey || !input.docVersion || !input.language) {
    logger.warn('[LegalAcceptance] recordLegalAcceptance called with missing required fields', {
      hasUserId: !!input.userId, hasDoc: !!input.documentKey,
      hasVersion: !!input.docVersion, hasLang: !!input.language,
    });
    return { ok: false, errorCode: 'MISSING_FIELDS', message: 'Missing required input fields' };
  }

  const snapshotHash = input.snapshotText
    ? crypto.createHash('sha256').update(input.snapshotText).digest('hex')
    : null;

  try {
    const result = await pool.query(
      `
      INSERT INTO legal_acceptances (
        user_id, document_key, doc_version, language,
        ip_address, user_agent, device_fingerprint,
        snapshot_hash, snapshot_url,
        source, actor_role, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      ON CONFLICT (user_id, document_key, doc_version) DO NOTHING
      RETURNING id, user_id, document_key, doc_version, language,
                accepted_at, ip_address, user_agent, snapshot_hash,
                snapshot_url, source, actor_role
      `,
      [
        input.userId,
        input.documentKey,
        input.docVersion,
        input.language,
        input.ipAddress ?? null,
        input.userAgent ?? null,
        input.deviceFingerprint ?? null,
        snapshotHash,
        input.snapshotUrl ?? null,
        input.source ?? 'client',
        input.actorRole ?? 'self',
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    if (result.rowCount === 0) {
      // Idempotent no-op: return the ORIGINAL row (not overwrite it).
      try {
        const existing = await pool.query(
          `SELECT id, user_id, document_key, doc_version, language,
                  accepted_at, ip_address, user_agent, snapshot_hash,
                  snapshot_url, source, actor_role
             FROM legal_acceptances
            WHERE user_id = $1 AND document_key = $2 AND doc_version = $3
            LIMIT 1`,
          [input.userId, input.documentKey, input.docVersion],
        );
        if (!existing.rows[0]) {
          emitShadowFailure('DB_READBACK_FAILED', input);
          return {
            ok: false, errorCode: 'DB_READBACK_FAILED',
            message: 'ON CONFLICT hit but readback returned no row',
          };
        }
        // Success — the row already existed, meaning a prior write
        // succeeded. Clear any lingering shadow alerts (Lane D §D8).
        void clearLegalShadowAlertsFor(input.userId, input.documentKey, input.docVersion);
        return { ok: true, row: mapRow(existing.rows[0]), alreadyAccepted: true };
      } catch (err: any) {
        emitShadowFailure('DB_READBACK_FAILED', input, err?.message);
        return {
          ok: false, errorCode: 'DB_READBACK_FAILED',
          message: err?.message || 'readback failed',
        };
      }
    }

    logger.info('[LegalAcceptance] Recorded', {
      userId: input.userId, documentKey: input.documentKey, docVersion: input.docVersion,
      language: input.language, source: input.source ?? 'client',
    });
    // Success-side clearance for LEGAL_ACCEPTANCE_SHADOW_MISSING
    // admin alerts (Lane D §D8 gap remediation). emitShadowFailure fires
    // create-if-missing on a failed write and it's dedup-keyed with the
    // errorCode, so a retry that succeeds ONLY clears if we explicitly
    // resolve the previously-open alert here. Otherwise the alert stays
    // 'open' forever even though the condition is gone.
    //
    // Non-fatal: never let the alert clearance break the primary flow.
    // Also non-blocking: fire-and-forget so a slow alert-DB doesn't
    // slow the acceptance response.
    void clearLegalShadowAlertsFor(input.userId, input.documentKey, input.docVersion);
    return { ok: true, row: mapRow(result.rows[0]), alreadyAccepted: false };
  } catch (err: any) {
    emitShadowFailure('DB_INSERT_FAILED', input, err?.message);
    return {
      ok: false, errorCode: 'DB_INSERT_FAILED',
      message: err?.message || 'insert failed',
    };
  }
}

/**
 * Success-side clearance for legal_shadow_missing admin alerts (Lane D §D8).
 * Called after a successful recordLegalAcceptance write. The dedupe-key
 * pattern is:
 *   legal_shadow_missing:<userId>:<documentKey>:<docVersion>:<errorCode>
 * so we resolve every alert whose prefix matches
 *   legal_shadow_missing:<userId>:<documentKey>:<docVersion>:
 * regardless of errorCode — the shadow write succeeded, so ALL prior
 * failure modes for this (user, doc, version) are gone.
 *
 * Uses `resolveClearedByPrefix` from AlertEngine, which correctly
 * resolves any auto-created alert whose dedupeKey starts with the prefix
 * but is NOT in the "currently offending" set — we pass an empty set
 * because for this specific (user, doc, version) tuple nothing is
 * offending any more.
 *
 * Best-effort: never throws, never blocks the primary flow.
 */
async function clearLegalShadowAlertsFor(
  userId: string,
  documentKey: string,
  docVersion: string,
): Promise<void> {
  try {
    const { resolveClearedByPrefix } = await import('./AlertEngine');
    const prefix = `legal_shadow_missing:${userId}:${documentKey}:${docVersion}:`;
    // Empty currentKeys array means "nothing is offending under this
    // prefix any more" — resolveClearedByPrefix will close every open
    // alert matching the prefix.
    const n = await resolveClearedByPrefix(prefix, []);
    if (n > 0) {
      logger.info('[LegalAcceptance] Cleared legal_shadow_missing alerts', {
        prefix, resolvedCount: n,
      });
    }
  } catch (clearErr: any) {
    logger.warn('[LegalAcceptance] Alert clearance failed (non-blocking)', {
      userId, documentKey, docVersion,
      errorMessage: clearErr?.message ?? String(clearErr),
    });
  }
}

/**
 * LEGAL_ACCEPTANCE_SHADOW_MISSING observability signal (CEO §2).
 * Non-PII: never logs snapshotText, never logs raw IP/user-agent (they
 * live on the failed row's audit anyway). Emits at error level so the
 * app's existing log-based alerting picks it up; a future PR can wire
 * this into the admin alerts / reconciliation queue when those APIs
 * settle.
 */
function emitShadowFailure(
  errorCode: LegalAcceptanceWriteError,
  input: RecordLegalAcceptanceInput,
  cause?: string,
): void {
  logger.error('LEGAL_ACCEPTANCE_SHADOW_MISSING', {
    signal: 'LEGAL_ACCEPTANCE_SHADOW_MISSING',
    errorCode,
    documentKey: input.documentKey,
    docVersion: input.docVersion,
    language: input.language,
    source: input.source ?? 'client',
    // userId truncated for log-search safety (still identifiable to
    // admins with full-row access to the audit trail).
    userIdTail: input.userId.slice(-6),
    cause,
  });
  // Admin-alert surface (Lane D §D8). The log line above is the ops
  // trail; this creates a deduplicated, actionable card in the Admin
  // Alerts Center so a shadow write failure is not just something
  // grep can find. Dedup key groups the same (user, document,
  // version, errorCode) — a retry that hits the same wall does NOT
  // spam the queue; a resolved alert stays resolved unless a NEW
  // failure of a different shape appears. Best-effort import so a
  // test env without AlertEngine wired never blocks the primary
  // acceptance flow.
  //
  // Non-PII: title is document + errorCode, message never carries the
  // raw userId (only the tail already logged above).
  void (async () => {
    try {
      const { createOrUpdateAlert } = await import('./AlertEngine');
      await createOrUpdateAlert({
        dedupeKey: `legal_shadow_missing:${input.userId}:${input.documentKey}:${input.docVersion}:${errorCode}`,
        // 'system' is the generic bucket in the alerts schema — no
        // 'compliance' category exists yet. A future PR can add one
        // if legal-shadow-missing gets its own filter chip.
        category: 'system',
        severity: 'warning',
        title: `Legal acceptance shadow missing (${input.documentKey})`,
        message: `Canonical legal_acceptances write failed for ${input.documentKey}@${input.docVersion} (${errorCode}). Legacy surface still holds authority; reconciliation required.`,
        linkedEntityType: 'user',
        linkedEntityId: input.userId,
        source: 'auto_sweep',
        metadata: {
          signal: 'LEGAL_ACCEPTANCE_SHADOW_MISSING',
          errorCode,
          documentKey: input.documentKey,
          docVersion: input.docVersion,
          language: input.language,
          origin: input.source ?? 'client',
          cause: cause ?? null,
        },
      });
    } catch (alertErr: any) {
      // Never let the alert emitter break the primary flow — its
      // own log line is the last-resort breadcrumb.
      logger.warn('[LegalAcceptance] Alert wiring for shadow failure failed', {
        errorMessage: alertErr?.message ?? String(alertErr),
      });
    }
  })();
}

/**
 * Back-compat convenience for callers that only need the row (no
 * shadow/authoritative distinction). Prefer `recordLegalAcceptance`
 * directly at every new call site so the failure policy is visible.
 * @deprecated pass-through — new call sites should branch on
 *             `recordLegalAcceptance(...)`'s structured result.
 */
export async function recordLegalAcceptanceOrNull(
  input: RecordLegalAcceptanceInput,
): Promise<LegalAcceptanceRow | null> {
  const r = await recordLegalAcceptance(input);
  return r.ok ? r.row : null;
}

/**
 * Has this user accepted the given documentKey at the given (or any) version?
 * When docVersion is omitted, checks whether they accepted ANY version.
 */
export async function hasAcceptedLegal(
  userId: string,
  documentKey: string,
  docVersion?: string,
): Promise<boolean> {
  if (!userId || !documentKey) return false;
  try {
    const q = docVersion
      ? await pool.query(
          `SELECT 1 FROM legal_acceptances
            WHERE user_id = $1 AND document_key = $2 AND doc_version = $3
            LIMIT 1`,
          [userId, documentKey, docVersion],
        )
      : await pool.query(
          `SELECT 1 FROM legal_acceptances
            WHERE user_id = $1 AND document_key = $2
            LIMIT 1`,
          [userId, documentKey],
        );
    return (q.rowCount ?? 0) > 0;
  } catch (err: any) {
    logger.warn('[LegalAcceptance] hasAcceptedLegal lookup failed', {
      userId, documentKey, docVersion, error: err?.message,
    });
    // Fail-closed: absence of evidence must never be treated as evidence
    // of acceptance in a legal context.
    return false;
  }
}

/**
 * Full acceptance history for one user (all documents, all versions).
 * Used by admin routes to render the user's legal-evidence timeline.
 */
export async function listUserLegalAcceptances(
  userId: string,
): Promise<LegalAcceptanceRow[]> {
  if (!userId) return [];
  try {
    const q = await pool.query(
      `SELECT id, user_id, document_key, doc_version, language,
              accepted_at, ip_address, user_agent, snapshot_hash,
              snapshot_url, source, actor_role
         FROM legal_acceptances
        WHERE user_id = $1
        ORDER BY accepted_at DESC`,
      [userId],
    );
    return q.rows.map(mapRow);
  } catch (err: any) {
    logger.warn('[LegalAcceptance] listUserLegalAcceptances failed', {
      userId, error: err?.message,
    });
    return [];
  }
}

function mapRow(r: any): LegalAcceptanceRow {
  return {
    id: r.id,
    userId: r.user_id,
    documentKey: r.document_key,
    docVersion: r.doc_version,
    language: r.language,
    acceptedAt: r.accepted_at instanceof Date ? r.accepted_at : new Date(r.accepted_at),
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    snapshotHash: r.snapshot_hash,
    snapshotUrl: r.snapshot_url,
    source: r.source,
    actorRole: r.actor_role,
  };
}
