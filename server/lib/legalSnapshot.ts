/**
 * Legal snapshot evidence resolver (2026-09-12).
 *
 * legal_acceptances rows were written with snapshot_hash = NULL whenever the
 * caller did not pass the exact text (every caller). A consent row that
 * cannot say WHAT was accepted is weak evidence. This resolver gives every
 * row a real hash + public URL from the registry:
 *
 *   providerDeclaration → SHA-256 of the declaration body in the member's
 *                         language (shared/providerProtectionDeclarations.ts,
 *                         shipped in the server image);
 *   staticClientPage    → the pinned SHA-256 of the page source at the
 *                         registry's current version
 *                         (shared/lib/legalDocumentTextHashes.ts — CI fails
 *                         when the page changes without a version bump);
 *   consentSnapshot     → no text on this side; URL only when a page exists.
 */

import crypto from 'crypto';
import { getLegalDocument } from '@shared/lib/legalDocumentRegistry';
import { LEGAL_DOCUMENT_TEXT_HASHES, legalDocumentPublicUrl } from '@shared/lib/legalDocumentTextHashes';
import { PROVIDER_DECLARATION_BY_KEY } from '@shared/providerProtectionDeclarations';

export interface LegalSnapshotEvidence {
  snapshotHash: string | null;
  snapshotUrl: string | null;
  /** How the hash was obtained — recorded in metadata so an auditor knows what it hashes. */
  hashSource: 'declaration_body' | 'page_source_pin' | 'none';
}

export function resolveLegalSnapshot(documentKey: string, language: string): LegalSnapshotEvidence {
  const doc = getLegalDocument(documentKey);
  const snapshotUrl = legalDocumentPublicUrl(documentKey);
  if (!doc) return { snapshotHash: null, snapshotUrl, hashSource: 'none' };

  if (doc.textSource.kind === 'providerDeclaration') {
    const decl = PROVIDER_DECLARATION_BY_KEY[doc.textSource.registryKey];
    if (decl) {
      const body = language === 'he' && decl.bodyHe ? decl.bodyHe : decl.bodyEn;
      const text = `${decl.key}\n${decl.version}\n${body}`;
      return { snapshotHash: crypto.createHash('sha256').update(text).digest('hex'), snapshotUrl, hashSource: 'declaration_body' };
    }
  }

  if (doc.textSource.kind === 'staticClientPage') {
    const pin = LEGAL_DOCUMENT_TEXT_HASHES[documentKey];
    if (pin && pin.version === doc.currentVersion) {
      return { snapshotHash: pin.sha256, snapshotUrl, hashSource: 'page_source_pin' };
    }
  }

  return { snapshotHash: null, snapshotUrl, hashSource: 'none' };
}
