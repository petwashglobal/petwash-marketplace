/**
 * Consent P0 remainder (2026-09-12).
 *
 *  1. legal_acceptances rows carried snapshot_hash = NULL (no caller passed
 *     the text) — a consent row that cannot say WHAT was accepted.
 *  2. The wallet top-up "implied" an acceptance of wallet_egift_terms on
 *     every successful top-up — fabricated legal evidence.
 *  3. Marketing consent was bundled into the loyalty REQUIRED set.
 *  4. The provider application accepted criminalCheckConsent=false.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import crypto from 'node:crypto';
import { LEGAL_DOCUMENTS, getLegalDocument } from '../../shared/lib/legalDocumentRegistry';
import { LEGAL_DOCUMENT_TEXT_HASHES, LEGAL_DOCUMENT_PUBLIC_PATHS } from '../../shared/lib/legalDocumentTextHashes';
import { resolveLegalSnapshot } from '../lib/legalSnapshot';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('1. every acceptance carries evidence', () => {
  it('every staticClientPage document has a pinned page-source hash that matches the file at its current version', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      if (doc.textSource.kind !== 'staticClientPage') continue;
      const pin = LEGAL_DOCUMENT_TEXT_HASHES[doc.key];
      expect(pin, `${doc.key} has no pinned hash — regenerate shared/lib/legalDocumentTextHashes.ts`).toBeTruthy();
      expect(pin.clientPath).toBe(doc.textSource.clientPath);
      expect(pin.version, `${doc.key}: registry version ${doc.currentVersion} ≠ pinned ${pin.version}`).toBe(doc.currentVersion);
      const actual = crypto.createHash('sha256').update(readFileSync(resolve(__dirname, '..', '..', pin.clientPath))).digest('hex');
      expect(actual, `${doc.key}: ${pin.clientPath} changed — bump currentVersion in legalDocumentRegistry.ts AND regenerate the hash`).toBe(pin.sha256);
    }
  });
  it('every static document has a public page URL', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      if (doc.textSource.kind !== 'staticClientPage') continue;
      expect(LEGAL_DOCUMENT_PUBLIC_PATHS[doc.key], doc.key).toMatch(/^\/legal\//);
      expect(R('client/src/App.tsx')).toContain(`path="${LEGAL_DOCUMENT_PUBLIC_PATHS[doc.key]}"`);
    }
  });
  it('a provider declaration hashes its body in the accepted language', () => {
    const he = resolveLegalSnapshot('provider_independent_status', 'he');
    const en = resolveLegalSnapshot('provider_independent_status', 'en');
    expect(he.hashSource).toBe('declaration_body');
    expect(he.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(en.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(he.snapshotHash).not.toBe(en.snapshotHash);
  });
  it('a static page resolves to the pin + URL; an unknown key to nothing', () => {
    const r = resolveLegalSnapshot('wallet_egift_terms', 'he');
    expect(r.hashSource).toBe('page_source_pin');
    expect(r.snapshotHash).toBe(LEGAL_DOCUMENT_TEXT_HASHES.wallet_egift_terms.sha256);
    expect(r.snapshotUrl).toBe('https://petwash.co.il/legal/wallet-egift-terms');
    expect(resolveLegalSnapshot('does_not_exist', 'he')).toEqual({ snapshotHash: null, snapshotUrl: null, hashSource: 'none' });
    expect(getLegalDocument('marketing_consent')?.textSource.kind).toBe('consentSnapshot');
  });
  it('recordLegalAcceptance uses the resolver and records hashSource in metadata', () => {
    const src = R('server/services/LegalAcceptanceService.ts');
    expect(src).toContain("resolveLegalSnapshot(input.documentKey, input.language)");
    expect(src).toContain("(resolved?.snapshotHash ?? null)");
    expect(src).toContain("hashSource: input.snapshotText ? 'caller_text' : (resolved?.hashSource ?? 'none')");
    expect(src).not.toContain("input.snapshotUrl ?? null,\n        input.source");
  });
});

describe('2. wallet top-up records an acceptance only when the box was ticked', () => {
  const src = R('server/routes/credit-wallet.ts');
  it('schema carries acceptedWalletTerms; the write is conditional; the gate is flag-controlled', () => {
    expect(src).toContain('acceptedWalletTerms: z.boolean().optional()');
    expect(src).toContain("if (acceptedWalletTerms === true) void (async () => {");
    expect(src).toContain("if (consentGateEnabled() && acceptedWalletTerms !== true) {");
    expect(src).toContain("error: 'WALLET_TERMS_REQUIRED'");
    expect(src).not.toContain('A successful wallet top-up implies the customer just re-agreed');
  });
  it('the top-up screen has the tick, links the terms, sends it, and cannot submit without it', () => {
    const c = R('client/src/pages/MyWallet.tsx');
    expect(c).toContain('data-testid="wallet-terms-checkbox"');
    expect(c).toContain('href="/legal/wallet-egift-terms"');
    expect(c).toContain('nayaxTxId: nayaxTxId || undefined, acceptedWalletTerms });');
    expect(c).toContain('disabled={topUpMutation.isPending || !nayaxTxId || !acceptedWalletTerms}');
  });
});

describe('3. marketing is never a required consent', () => {
  it('no ROLE_CONSENTS set includes marketing', () => {
    const src = R('server/services/consentEngine.ts');
    const block = src.slice(src.indexOf('const ROLE_CONSENTS'), src.indexOf('};', src.indexOf('const ROLE_CONSENTS')));
    expect(block).not.toContain('"marketing"');
    expect(block).toContain('loyalty: ["terms", "privacy"]');
  });
});

describe('4. provider application requires background-check consent server-side', () => {
  it('rejects with BACKGROUND_CHECK_CONSENT_REQUIRED before identity hardening', () => {
    const src = R('server/routes/provider-onboarding.ts');
    const gate = src.indexOf("errorCode: 'BACKGROUND_CHECK_CONSENT_REQUIRED'");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(src.indexOf('IDENTITY HARDENING (2026-06-20'));
    expect(src).toContain('if (!backgroundCheckConsent) {');
  });
});
