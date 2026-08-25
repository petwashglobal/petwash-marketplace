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
 * Idempotent: same (userId, documentKey, docVersion) → single row.
 * Re-submitting the same version returns the existing row unchanged
 * (does NOT bump acceptedAt) so a page refresh doesn't rewrite history.
 * A NEW docVersion accumulates as its own row (version history preserved).
 *
 * NEVER THROWS on evidence-only paths — legal-recovery must not block a
 * user flow if the ledger write fails; the caller decides whether to
 * treat that as a fatal error (e.g. legal signature required to submit).
 */
export async function recordLegalAcceptance(
  input: RecordLegalAcceptanceInput,
): Promise<LegalAcceptanceRow | null> {
  if (!input.userId || !input.documentKey || !input.docVersion || !input.language) {
    logger.warn('[LegalAcceptance] recordLegalAcceptance called with missing required fields', {
      hasUserId: !!input.userId, hasDoc: !!input.documentKey,
      hasVersion: !!input.docVersion, hasLang: !!input.language,
    });
    return null;
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
      // Idempotent no-op: the same (user, doc, version) already exists.
      // Return the existing row so the caller can still confirm.
      const existing = await pool.query(
        `SELECT id, user_id, document_key, doc_version, language,
                accepted_at, ip_address, user_agent, snapshot_hash,
                snapshot_url, source, actor_role
           FROM legal_acceptances
          WHERE user_id = $1 AND document_key = $2 AND doc_version = $3
          LIMIT 1`,
        [input.userId, input.documentKey, input.docVersion],
      );
      return existing.rows[0] ? mapRow(existing.rows[0]) : null;
    }

    logger.info('[LegalAcceptance] Recorded', {
      userId: input.userId, documentKey: input.documentKey, docVersion: input.docVersion,
      language: input.language, source: input.source ?? 'client',
    });
    return mapRow(result.rows[0]);
  } catch (err: any) {
    logger.error('[LegalAcceptance] Insert failed', {
      userId: input.userId, documentKey: input.documentKey,
      docVersion: input.docVersion, error: err?.message,
    });
    return null;
  }
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
