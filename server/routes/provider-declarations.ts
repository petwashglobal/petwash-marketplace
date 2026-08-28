/**
 * /api/provider-declarations — Provider Protection Book signing surface (Phase 1).
 *
 * GET  /status        → required-vs-signed declaration list for the authed provider
 * GET  /:key          → the full text of one declaration doc (to read before signing)
 * POST /:key/start    → create a DocuSeal signing session for one declaration
 *
 * DARK by default (both fail-safe):
 *   - reviewedByCounsel === false on a doc → start returns 409 PENDING_COUNSEL
 *     (we will NOT send draft legal text for a binding signature).
 *   - DOCUSEAL_API_KEY unset → start returns 503 DOCUSEAL_NOT_CONFIGURED.
 *
 * No money mutation here. Completion is recorded by the existing DocuSeal webhook
 * (/api/esign/webhook), which flips the signing_sessions row to `completed`.
 */
import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../customAuth';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { signingSessions, providers } from '@shared/schema';
import { docuSealService } from '../services/DocuSealService';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';
import {
  PROVIDER_DECLARATION_BY_KEY,
} from '@shared/providerProtectionDeclarations';
import { recordLegalAcceptance } from '../services/LegalAcceptanceService';
import {
  LEGAL_DOCUMENTS,
  getLegalDocument,
  type LegalDocumentDefinition,
} from '@shared/lib/legalDocumentRegistry';

/**
 * Provider-declaration registryKey → canonical documentKey lookup,
 * derived from the ONE registry (shared/lib/legalDocumentRegistry.ts).
 * Never hand-maintained. If a new provider declaration is added in
 * providerProtectionDeclarations.ts, add its canonical mapping in the
 * registry — this table updates automatically.
 */
const CANONICAL_DOC_FOR_REGISTRY_KEY: Map<string, LegalDocumentDefinition> = new Map(
  LEGAL_DOCUMENTS
    .filter((d): d is LegalDocumentDefinition & { textSource: { kind: 'providerDeclaration'; registryKey: string } } =>
      d.textSource.kind === 'providerDeclaration')
    .map((d) => [d.textSource.registryKey, d]),
);
import {
  getProviderDeclarationStatus,
  declarationDocType,
} from '../services/providerDeclarationGate';

const router = Router();

/** Required-vs-signed status for the onboarding UI. */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const providerUid = req.user!.uid;
    const status = await getProviderDeclarationStatus(providerUid);
    res.json({ success: true, ...status });
  } catch (error: any) {
    logger.error('[ProviderDeclarations] status error', error);
    res.status(500).json({ success: false, error: 'Failed to load declaration status' });
  }
});

/** Full text of one declaration document (read before signing). */
router.get('/:key', requireAuth, async (req, res) => {
  const doc = PROVIDER_DECLARATION_BY_KEY[req.params.key];
  if (!doc) {
    return res.status(404).json({ success: false, error: 'Unknown declaration key' });
  }
  res.json({
    success: true,
    declaration: {
      key: doc.key,
      version: doc.version,
      category: doc.category,
      requiredFor: doc.requiredFor,
      titleEn: doc.titleEn,
      titleHe: doc.titleHe,
      bodyEn: doc.bodyEn,
      bodyHe: doc.bodyHe,
      reviewedByCounsel: doc.reviewedByCounsel,
    },
  });
});

/**
 * Start a signing session for one declaration. Creates a DocuSeal submission and
 * persists a signing_sessions row whose documentType encodes the declaration
 * key+version, so the existing webhook + status reader pick it up.
 */
router.post('/:key/start', requireAuth, async (req, res) => {
  try {
    const providerUid = req.user!.uid;
    const key = req.params.key;
    const doc = PROVIDER_DECLARATION_BY_KEY[key];
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Unknown declaration key' });
    }

    // Gate 1: do not send draft legal text for binding signature.
    if (!doc.reviewedByCounsel) {
      return res.status(409).json({
        success: false,
        error: 'This declaration is pending legal (counsel) approval and cannot be signed yet.',
        code: 'PENDING_COUNSEL',
      });
    }

    // Gate 2: signing engine must be configured.
    if (!process.env.DOCUSEAL_API_KEY) {
      logger.warn('[ProviderDeclarations] DocuSeal not configured — DOCUSEAL_API_KEY missing');
      return res.status(503).json({
        success: false,
        error: 'Contract signing not yet configured',
        code: 'DOCUSEAL_NOT_CONFIGURED',
      });
    }

    // Each declaration maps to a DocuSeal template slug. Convention:
    // petwash-provider-decl-<key>, overridable via DOCUSEAL_PROVIDER_DECL_TEMPLATE_PREFIX.
    const prefix = process.env.DOCUSEAL_PROVIDER_DECL_TEMPLATE_PREFIX || 'petwash-provider-decl';
    const templateSlug = `${prefix}-${key}`;

    // Derive the signer from authenticated identity (email) + provider profile
    // (name) — never trust a client-supplied identity for a legal signature.
    const signerEmail = req.user!.email;
    if (!signerEmail) {
      return res.status(400).json({ success: false, error: 'No verified email on account; cannot sign.' });
    }
    const [provider] = await db
      .select({ businessName: providers.businessName })
      .from(providers)
      .where(eq(providers.userId, providerUid))
      .limit(1);
    const signerName =
      (typeof req.body?.signerName === 'string' && req.body.signerName.trim()) ||
      provider?.businessName ||
      signerEmail.split('@')[0];

    const language = (typeof req.body?.language === 'string' && req.body.language) || 'he';

    const submission = await docuSealService.createSubmission({
      templateSlug,
      signerEmail,
      signerName,
      language,
      sendEmail: false,
      expiresIn: 30,
      metadata: {
        userId: providerUid,
        documentType: declarationDocType(doc.key, doc.version),
        declarationKey: doc.key,
        declarationVersion: doc.version,
        platform: 'PetWash',
      },
    });

    const signingUrl = docuSealService.getSigningUrl(submission, language);
    const embedCode = docuSealService.getEmbedCode(submission, language);

    const [session] = await db
      .insert(signingSessions)
      .values({
        userId: providerUid,
        submissionId: submission.id,
        templateSlug,
        documentType: declarationDocType(doc.key, doc.version),
        documentName: `PetWash™ ${doc.titleEn}`,
        language,
        status: submission.status,
        signerEmail,
        signerName,
        signingUrl,
        embedCode,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
      .returning();

    await logAuditEvent({
      actorUserId: providerUid,
      actorRole: 'provider',
      actionType: 'PROVIDER_DECLARATION_SIGN_STARTED',
      targetType: 'provider_declaration',
      targetId: `${doc.key}:${doc.version}`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { submissionId: submission.id, templateSlug },
    });

    logger.info('[ProviderDeclarations] signing session started', {
      providerUid,
      declarationKey: doc.key,
      submissionId: submission.id,
    });

    res.json({
      success: true,
      sessionId: session.id,
      submissionId: submission.id,
      signingUrl,
      embedCode,
      status: submission.status,
      declarationKey: doc.key,
      declarationVersion: doc.version,
    });
  } catch (error: any) {
    logger.error('[ProviderDeclarations] start error', error);
    res.status(500).json({ success: false, error: 'Failed to start signing' });
  }
});

/**
 * FREE in-app acceptance of a self-attestation declaration (2026-07-25).
 *
 * The Provider Protection Book declarations are self-attestations ("I declare X
 * is true"), not counter-signed contracts — they do not need a DocuSeal e-sign
 * SaaS. This endpoint records the provider's active acceptance directly as a
 * COMPLETED signing_sessions row in the exact format the gate reads
 * (documentType = provider_declaration:<key>:<version>), so the whole
 * declaration/payout gate works with NO external dependency and NO cost.
 *
 * Safety is preserved identically to /start:
 *   • reviewedByCounsel === false → 409 PENDING_COUNSEL. We NEVER record a
 *     binding acceptance of legal text still marked draft / pending counsel
 *     sign-off. (Every declaration is draft today, so this is inert until the
 *     document's own status is advanced to final — a deliberate act, per the
 *     "not binding until approved" header on each doc.)
 *   • The provider must actively affirm (accepted:true) and type their full name.
 *   • We hash the EXACT accepted text (+version) into certificateUrl so a later
 *     wording bump is provably distinct and re-signature is required.
 *   • submissionId is deterministic per (key,version,provider) → idempotent.
 */
router.post('/:key/accept', requireAuth, async (req, res) => {
  try {
    const providerUid = req.user!.uid;
    const key = req.params.key;
    const doc = PROVIDER_DECLARATION_BY_KEY[key];
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Unknown declaration key' });
    }

    // Same safety gate as /start — do not bind draft legal text.
    if (!doc.reviewedByCounsel) {
      return res.status(409).json({
        success: false,
        error: 'This declaration is pending legal (counsel) approval and cannot be signed yet.',
        code: 'PENDING_COUNSEL',
      });
    }

    const accepted = req.body?.accepted === true;
    const signerName = typeof req.body?.signerName === 'string' ? req.body.signerName.trim() : '';
    if (!accepted || signerName.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'You must read and confirm the declaration and enter your full legal name.',
        code: 'AFFIRMATION_REQUIRED',
      });
    }
    const signerEmail = req.user!.email;
    if (!signerEmail) {
      return res.status(400).json({ success: false, error: 'No verified email on account; cannot sign.' });
    }

    // Integrity: a hash of the exact text + version the provider accepted.
    const contentHash = crypto
      .createHash('sha256')
      .update(`${doc.key}:${doc.version}:${doc.bodyEn}:${doc.bodyHe}`)
      .digest('hex');
    const submissionId = `inapp:${doc.key}:${doc.version}:${providerUid}`;
    const now = new Date();
    const language = (typeof req.body?.language === 'string' && req.body.language) || 'he';

    await db
      .insert(signingSessions)
      .values({
        userId: providerUid,
        submissionId,
        templateSlug: `inapp-provider-decl-${doc.key}`,
        documentType: declarationDocType(doc.key, doc.version),
        documentName: `PetWash™ ${doc.titleEn}`,
        language,
        status: 'completed',
        signerEmail,
        signerName,
        signedAt: now,
        completedAt: now,
        certificateUrl: `inapp-attestation:sha256:${contentHash}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
      .onConflictDoNothing({ target: signingSessions.submissionId });

    await logAuditEvent({
      actorUserId: providerUid,
      actorRole: 'provider',
      actionType: 'PROVIDER_DECLARATION_ACCEPTED_INAPP',
      targetType: 'provider_declaration',
      targetId: `${doc.key}:${doc.version}`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { contentHash, signerName },
    });

    // ── CANONICAL LEDGER DUAL-WRITE (CEO 2026-08-26 §3, §5, §12) ─────
    // Best-effort SHADOW write today (fire-and-forget). Legacy
    // signing_sessions stays authoritative for the onboarding gate;
    // reconciliation cron (design note pending) will pair rows and
    // flag mismatches before this becomes DUAL-WRITE-RECONCILED.
    //
    // Language + evidence correctness (§3): the acceptance row's
    // snapshotText hashes the SAME language body the provider actually
    // read on screen. Requested language wins; when unavailable we
    // fall back to Hebrew (the platform default) AND record the
    // actual language used in metadata so the reconciliation audit
    // can flag mismatches.
    //
    // Version correctness (§4): docVersion comes from the ONE registry,
    // not from `doc.version`, so a registry bump is the ONE place a
    // new version starts landing in canonical rows.
    const canonicalDoc = CANONICAL_DOC_FOR_REGISTRY_KEY.get(doc.key);
    if (canonicalDoc) {
      const requestedLang = (['he', 'en', 'ar', 'ru', 'fr', 'es'] as const).includes(language as any)
        ? language as ('he' | 'en' | 'ar' | 'ru' | 'fr' | 'es')
        : 'he';
      // Pick the ACTUAL displayed body for the requested language.
      // Provider declarations today only exist in he/en; fall back to
      // Hebrew for any other request and record what we actually used.
      const actualLang: 'he' | 'en' =
        (requestedLang === 'en' && doc.bodyEn) ? 'en'
        : 'he';
      const displayedTitle = actualLang === 'en' ? doc.titleEn : doc.titleHe;
      const displayedBody  = actualLang === 'en' ? doc.bodyEn  : doc.bodyHe;

      // SHADOW policy (CEO §1): legacy signing_sessions is authoritative
      // for the onboarding gate; this write is best-effort. Structured
      // result — `.catch()` is NOT enough because the service catches
      // its own DB errors and returns { ok:false } — branch on ok.
      recordLegalAcceptance({
        userId: providerUid,
        documentKey: canonicalDoc.key,
        docVersion: canonicalDoc.currentVersion,
        language: actualLang,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        snapshotText: `${displayedTitle} — v${canonicalDoc.currentVersion}\n\n${displayedBody}`,
        source: 'client',
        actorRole: 'self',
        metadata: {
          registryKey: doc.key,
          signerName,
          legacyContentHash: contentHash,
          submissionId,
          requestedLanguage: requestedLang,
          actualLanguage: actualLang,
          migrationStatus: canonicalDoc.migrationStatus,
        },
      }).then((r) => {
        if (!r.ok) {
          // emitShadowFailure already fired inside the service; this
          // extra breadcrumb records the LEGACY authority that DID
          // land so a reconciliation query can pair it up.
          logger.warn('[ProviderDeclarations] canonical shadow write failed — legacy authority stands', {
            providerUid, registryKey: doc.key, canonicalKey: canonicalDoc.key,
            errorCode: r.errorCode, signingSessionId: submissionId,
          });
        }
      }).catch((err: any) => {
        // Unexpected synchronous throw (should be impossible given
        // the service's contract). Log so the emitShadowFailure
        // signal is never the only breadcrumb.
        logger.error('[ProviderDeclarations] canonical shadow write threw unexpectedly', {
          providerUid, key: doc.key, err: err?.message,
        });
      });
    } else {
      logger.warn('[ProviderDeclarations] no canonical registry entry for declaration — canonical ledger skipped', {
        key: doc.key,
      });
    }

    logger.info('[ProviderDeclarations] in-app acceptance recorded', {
      providerUid, declarationKey: doc.key, declarationVersion: doc.version,
    });

    res.json({
      success: true,
      declarationKey: doc.key,
      declarationVersion: doc.version,
      signedAt: now.toISOString(),
      method: 'in_app_attestation',
    });
  } catch (error: any) {
    logger.error('[ProviderDeclarations] accept error', error);
    res.status(500).json({ success: false, error: 'Failed to record acceptance' });
  }
});

export default router;
