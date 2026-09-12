import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Consent & legal audit 2026-09-12 — the P0s where the system recorded a consent
 * the member never gave, or lost one they did give:
 *  P0-2  clicking an email-verification link stamped Terms acceptance
 *  P0-3  that stamp then blocked the canonical ledger row forever
 *  P0-5  Prestige enrolment consent was client-only and never sent
 *  P0-6  the INSERT hard-coded terms_consent = TRUE
 *  P0-7  privilege_members defaulted marketing/SMS/Terms consent to TRUE
 *  P0-10 verifyConsent found the old acceptance after a withdrawal
 *  P1-22 a welcome screen pre-ticked marketing
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('email verification is proof of an inbox, not a Terms acceptance', () => {
  it('no markEmailVerified call passes acceptTerms', () => {
    const s = R('server/routes/publicAuthRoutes.ts');
    expect(s).not.toContain('acceptTerms: true');
    expect((s.match(/await markEmailVerified\(/g) || []).length).toBeGreaterThanOrEqual(3);
  });
  it('the canonical ledger row is written even when the legacy timestamp already exists', () => {
    const s = R('server/routes/legal-consent.ts');
    expect(s).toContain('const alreadyAccepted = !!u.acceptedTermsAt;');
    expect(s).not.toMatch(/if \(u\.acceptedTermsAt\) \{\s*\/\/ Idempotent[^]*?return res\.json/);
    expect(s.indexOf('recordLegalAcceptance({')).toBeGreaterThan(s.indexOf('const alreadyAccepted'));
    expect(s).toContain('return res.json({ acceptedAt: now.toISOString(), alreadyAccepted });');
  });
});

describe('Prestige enrolment consent is explicit on both ends', () => {
  it('server requires consent === true and binds the real values', () => {
    const s = R('server/routes/prestige-join.ts');
    expect(s).toContain('consent:   z.boolean(),');
    expect(s).toContain("error: 'CONSENT_REQUIRED'");
    expect(s).toContain('terms_consent, terms_consent_at, marketing_consent, sms_consent, status');
    expect(s).toContain("$7, NOW(), $8, $8, 'pending_verification'");
    expect(s).not.toMatch(/VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, TRUE, 'pending_verification'\)/);
  });
  it('the client sends the tick', () => {
    const s = R('client/src/pages/PrestigeEnroll.tsx');
    expect(s).toMatch(/language: w\.language === 'en' \? 'en' : 'he',[\s\S]{0,200}consent,\s*marketingConsent: false,/);
  });
  it('schema + migration make consent opt-in', () => {
    const s = R('shared/schema.ts');
    expect(s).toContain('marketingConsent: boolean("marketing_consent").default(false),');
    expect(s).toContain('smsConsent: boolean("sms_consent").default(false),');
    expect(s).toContain('termsConsent: boolean("terms_consent").default(false),');
    expect(s).toContain('termsConsentAt: timestamp("terms_consent_at", { withTimezone: true }),');
    const m = R('migrations/0153_privilege_members_consent_opt_in.sql');
    expect(m).toContain('ALTER COLUMN marketing_consent SET DEFAULT FALSE');
    expect(m).toContain('ALTER COLUMN terms_consent_at DROP DEFAULT');
  });
});

describe('the latest consent row decides', () => {
  it('verifyConsent orders by acceptedAt desc and checks accepted on that row', () => {
    const s = R('server/services/consentEngine.ts');
    expect(s).toContain('.orderBy(desc(userConsents.acceptedAt))');
    expect(s).toContain('return record?.accepted === true;');
    expect(s).not.toMatch(/eq\(userConsents\.accepted, true\)\s*\)\s*\)\s*\.limit\(1\);\s*return !!record;/);
  });
});

describe('marketing is never pre-ticked', () => {
  it('WelcomeConsent starts with emailCommunication false', () => {
    expect(R('client/src/pages/WelcomeConsent.tsx')).toContain('emailCommunication: false,');
  });
});
