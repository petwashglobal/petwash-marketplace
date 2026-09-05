/**
 * False-success / silent-failure sweep — regression pin (2026-09-05).
 *
 * CEO-mandated sweep: find every mutation handler that announces
 * {success:true} to the caller regardless of whether the underlying
 * write actually happened, and every client screen that fabricates a
 * fake success/reference ID when the server didn't return a real one.
 *
 * This is a source-inspection pin (no live DB / Firestore / Sheets
 * needed) in the same style as roleBodyEscalationSweep.regression.test.ts —
 * it freezes the fixed shape so a future edit can't silently reintroduce
 * the lie. It does not prove the endpoints work end-to-end against a
 * live backend; it proves the specific defect pattern is gone from source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('false-success sweep — server/routes/franchise.ts /inquiry', () => {
  const src = read('server/routes/franchise.ts');

  it('does not swallow a Firestore write failure inside its own try/catch', () => {
    // The old bug: `try { await inquiriesRef.add(...) } catch { logger.warn(...) }`
    // followed unconditionally by `res.json({ success: true, ... })` — a lead
    // could be lost while the caller was told it went through. The write must
    // now be able to throw out to the route's outer catch.
    const inquiryHandler = src.slice(
      src.indexOf(`router.post('/inquiry'`),
      src.indexOf(`router.get('/dashboard/stats'`),
    );
    expect(inquiryHandler).toContain('await inquiriesRef.add(inquiryData);');
    // There must be no nested try/catch around the Firestore write inside
    // this handler that swallows the error before the outer catch sees it.
    const addCallIndex = inquiryHandler.indexOf('await inquiriesRef.add(inquiryData);');
    const before = inquiryHandler.slice(0, addCallIndex);
    const lastTryBeforeAdd = before.lastIndexOf('try {');
    const lastCatchBeforeAdd = before.lastIndexOf('} catch');
    // If there's an unclosed try opened after the outer one, a catch would
    // appear AFTER the try but BEFORE the add() call — that's the bug shape.
    expect(lastCatchBeforeAdd < lastTryBeforeAdd || lastTryBeforeAdd === before.indexOf('try {')).toBe(true);
  });
});

describe('false-success sweep — server/routes.ts /api/contact', () => {
  const src = read('server/routes.ts');
  const handler = src.slice(
    src.indexOf(`app.post('/api/contact'`),
    src.indexOf(`app.post('/api/admin/test/add-wash'`),
  );

  it('fails the request when the only record of the message (the support-team email) fails to send', () => {
    expect(handler).toContain('if (supportEmailSent) {');
    // Must return a non-2xx + success:false when the support email fails,
    // not just log a warning and fall through to res.json({success:true}).
    const elseBranch = handler.slice(handler.indexOf('} else {', handler.indexOf('if (supportEmailSent) {')));
    expect(elseBranch).toMatch(/res\.status\(5\d\d\)\.json\(\{\s*success:\s*false/);
  });
});

describe('false-success sweep — server/routes/globalForms.ts write-result checks', () => {
  const src = read('server/routes/globalForms.ts');

  const cases: Array<{ route: string; nextRoute: string; check: string }> = [
    { route: `router.post('/contact'`, nextRoute: `router.post('/feedback'`, check: 'contactLogged' },
    { route: `router.post('/feedback'`, nextRoute: `router.post('/newsletter'`, check: 'feedbackLogged' },
    { route: `router.post('/newsletter'`, nextRoute: `router.post('/franchise-inquiry'`, check: 'newsletterLogged' },
    { route: `router.post('/franchise-inquiry'`, nextRoute: `router.post('/k9000/quick-booking'`, check: 'franchiseLogged' },
    { route: `router.post('/k9000/quick-booking'`, nextRoute: `router.post('/hr-application'`, check: 'bookingLogged' },
    { route: `router.post('/club-registration'`, nextRoute: `router.post('/provider-registration'`, check: 'clubLogged' },
    { route: `router.post('/quick-booking'`, nextRoute: `router.post('/legal-agreement'`, check: 'quickBookingLogged' },
    { route: `router.post('/legal-agreement'`, nextRoute: `router.get('/health'`, check: 'legalLogged' },
  ];

  for (const { route, nextRoute, check } of cases) {
    it(`${route} checks the Sheets write result (${check}) before answering success`, () => {
      const start = src.indexOf(route);
      expect(start).toBeGreaterThan(-1);
      const end = src.indexOf(nextRoute, start);
      expect(end).toBeGreaterThan(start);
      const body = src.slice(start, end);
      expect(body).toContain(check);
      expect(body).toContain('FORM_PERSIST_UNAVAILABLE');
    });
  }
});

describe('false-success sweep — client/src/pages/forms/*.tsx no fabricated success IDs', () => {
  const forms: Array<{ file: string; field: string; fakePattern: RegExp }> = [
    { file: 'client/src/pages/forms/CustomerOnboardingForm.tsx', field: 'petId', fakePattern: /'PET-OK'/ },
    { file: 'client/src/pages/forms/HRApplicationForm.tsx', field: 'applicationId', fakePattern: /'HR-OK'/ },
    { file: 'client/src/pages/forms/RefundForm.tsx', field: 'requestId', fakePattern: /'REF-OK'/ },
    { file: 'client/src/pages/forms/SalesLeadForm.tsx', field: 'leadId', fakePattern: /'LEAD-OK'/ },
    { file: 'client/src/pages/forms/QuickBookingForm.tsx', field: 'bookingRef', fakePattern: /`BK-\$\{Date\.now/ },
    { file: 'client/src/pages/forms/LegalAgreementForm.tsx', field: 'signatureId', fakePattern: /`SIG-\$\{Date\.now/ },
    // Precedent fix from 2026-08-24 — must stay fixed.
    { file: 'client/src/pages/forms/ProviderRegistrationForm.tsx', field: 'applicationId', fakePattern: /'PRV-OK'/ },
  ];

  for (const { file, field, fakePattern } of forms) {
    it(`${file} does not fall back to a fabricated ${field} when the server omits it`, () => {
      const src = read(file);
      // The fabricated-ID fallback pattern must be gone...
      expect(src).not.toMatch(fakePattern);
      // ...and replaced with an honest guard that bails out when the real
      // field is missing from the response body.
      expect(src).toMatch(new RegExp(`if \\(!body\\?\\.${field}\\)`));
    });
  }
});

/**
 * Review addition 2026-09-06. Removing the swallow so the route answers 500
 * instead of a false success is the right fix — but on its own it still LOSES
 * the lead: the submitter sees an error and a single log line is the only
 * record that a partner tried to reach us.
 *
 * The codebase already has the right tool for lost business data — sendAlert,
 * used the same way when a sitter settlement fails (sitter-suite.ts). Wired it
 * into the franchise-inquiry catch so someone can follow up, and pinned the
 * PII property: the alert carries MASKED contact details only. An alert
 * channel is not a side door for raw email/phone.
 */
describe('franchise inquiry — a lost lead is alerted, not just logged', () => {
  const SRC = readFileSync(
    resolve(__dirname, '..', 'routes', 'franchise.ts'),
    'utf8',
  );

  it('the catch fires an ops alert', () => {
    expect(SRC).toContain("import { sendAlert } from '../monitoring'");
    expect(SRC).toMatch(/sendAlert\(\{[\s\S]{0,400}?partner lead lost/);
  });

  it('the alert carries MASKED contact details, never raw', () => {
    const alertBlock = SRC.slice(SRC.indexOf('partner lead lost'));
    const details = alertBlock.slice(0, alertBlock.indexOf('});'));
    expect(details).toContain('maskEmail(');
    expect(details).toContain('maskPhone(');
    // The raw fields must not be interpolated straight into the alert.
    expect(details).not.toMatch(/\$\{req\.body\?\.email\}/);
    expect(details).not.toMatch(/\$\{req\.body\?\.phone\}/);
  });

  it('an alert failure cannot mask the original 500', () => {
    // The sendAlert call is wrapped so a monitoring outage never changes the
    // response the submitter gets.
    expect(SRC).toMatch(/catch \{ \/\* alert must never mask the original failure \*\/ \}/);
    expect(SRC).toMatch(/return res\.status\(500\)\.json\(\{ error: 'Failed to process inquiry' \}\)/);
  });
});

