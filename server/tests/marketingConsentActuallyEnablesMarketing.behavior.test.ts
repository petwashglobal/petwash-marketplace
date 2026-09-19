import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { applyMarketingConsent, allowsMarketingEmail } from '@shared/marketingConsentSync';

/**
 * 2026-09-19: the marketing consent checkbox was decorative.
 *
 *   signup + profile wrote  users.marketingConsent
 *   emailService reads      users.communicationPreferences.email.marketing
 *
 * emailService only consults marketingConsent in its LEGACY branch, which is
 * reached when communicationPreferences is absent. shared/schema.ts gives that
 * column a NON-NULL jsonb default with "marketing": false on every channel, so
 * every row has it from creation and the legacy branch is unreachable.
 *
 * Nothing in the codebase ever set email.marketing to true except the
 * unsubscribe-management path. So a customer could tick "yes, send me offers",
 * the row recorded marketingConsent=true, and every marketing email to them was
 * blocked anyway — permanently. On a platform whose problem is that sales do
 * not happen, we had switched off our own ability to email customers.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const R = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('ticking the marketing box actually permits a marketing email', () => {
  it('consent turns the flag the mailer reads ON', () => {
    const prefs = applyMarketingConsent(null, true);
    expect(allowsMarketingEmail(prefs)).toBe(true);
    expect(prefs.sms?.marketing).toBe(true);
    expect(prefs.push?.marketing).toBe(true);
  });

  it('declining turns it OFF', () => {
    expect(allowsMarketingEmail(applyMarketingConsent(null, false))).toBe(false);
  });

  it('it starts from the schema default and flips only marketing', () => {
    const schemaDefault = {
      email: { marketing: false, transactional: true, reminders: true },
      sms: { marketing: false, transactional: true, reminders: true },
    };
    const after = applyMarketingConsent(schemaDefault, true);
    expect(after.email?.marketing).toBe(true);
    // a customer who declines offers must still get receipts and reminders
    expect(after.email?.transactional).toBe(true);
    expect(after.email?.reminders).toBe(true);
  });

  it('withdrawing consent never silently disables receipts', () => {
    const after = applyMarketingConsent(
      { email: { marketing: true, transactional: true, reminders: true } },
      false,
    );
    expect(after.email?.marketing).toBe(false);
    expect(after.email?.transactional).toBe(true);
    expect(after.email?.reminders).toBe(true);
  });

  it('unrelated keys on the object survive', () => {
    const after = applyMarketingConsent({ email: { marketing: false }, locale: 'he' } as any, true);
    expect((after as any).locale).toBe('he');
  });

  it('both consent write paths set the flag the mailer reads', () => {
    expect(R('server/routes/user-profile.ts')).toContain('applyMarketingConsent');
    expect(R('server/routes.ts')).toContain('applyMarketingConsent');
  });

  it('the gate emailService uses is still the one we are setting', () => {
    // if this ever changes, the sync above is pointing at the wrong field
    expect(R('server/emailService.ts')).toContain("userPrefs?.email?.marketing === true");
  });
});
