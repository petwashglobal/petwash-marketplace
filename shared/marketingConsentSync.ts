/**
 * Keep the marketing CHECKBOX and the flag the mailer actually reads in step.
 *
 * THE BUG (2026-09-19). Two stores describe the same thing:
 *
 *   users.marketingConsent              — what signup and the profile write
 *   users.communicationPreferences      — what emailService actually reads
 *       .email.marketing
 *
 * emailService only consults marketingConsent in its LEGACY branch, reached
 * when communicationPreferences is absent (server/emailService.ts, `hasNewPrefs`).
 * But shared/schema.ts gives communication_preferences a NON-NULL jsonb DEFAULT
 * with "marketing": false on every channel — so every row has it from creation,
 * `hasNewPrefs` is always true, and the legacy branch is unreachable.
 *
 * Nothing in the codebase ever set email.marketing to true except the
 * unsubscribe-management path (storage.updateChannelSuppression with
 * suppress=false). So a customer could tick "yes, send me offers" at signup,
 * the row recorded marketingConsent=true, and every marketing email to them was
 * still blocked. Forever. The checkbox was decorative.
 *
 * This builds the preferences object that MATCHES a given consent decision, so
 * the two can never drift again. Transactional and reminder traffic is left
 * exactly as it was — this function only ever moves the `marketing` flags.
 */

export interface ChannelPrefs {
  marketing?: boolean;
  transactional?: boolean;
  reminders?: boolean;
}

export interface CommunicationPreferences {
  email?: ChannelPrefs;
  sms?: ChannelPrefs;
  whatsapp?: ChannelPrefs;
  push?: ChannelPrefs;
  [k: string]: unknown;
}

const CHANNELS = ['email', 'sms', 'whatsapp', 'push'] as const;

/**
 * Return communicationPreferences with every channel's `marketing` flag set to
 * `consent`, preserving whatever else was there.
 *
 * Deliberately does NOT touch transactional/reminders: a customer declining
 * offers must still receive their receipt and their booking reminder.
 */
export function applyMarketingConsent(
  existing: CommunicationPreferences | null | undefined,
  consent: boolean,
): CommunicationPreferences {
  const base: CommunicationPreferences = { ...(existing ?? {}) };
  for (const ch of CHANNELS) {
    const current = (base[ch] as ChannelPrefs | undefined) ?? {};
    base[ch] = {
      transactional: current.transactional ?? true,
      reminders: current.reminders ?? true,
      ...current,
      marketing: consent,
    };
  }
  return base;
}

/** True when this preferences object would allow a marketing email. */
export function allowsMarketingEmail(prefs: CommunicationPreferences | null | undefined): boolean {
  return (prefs?.email as ChannelPrefs | undefined)?.marketing === true;
}
