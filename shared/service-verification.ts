/**
 * Pure (DB-free, isomorphic) service-handoff verification + conduct logic.
 *
 * Confirms the RIGHT person at a booking handoff (Uber-style code, or a
 * friendly last-4-of-mobile fallback) and defines the jurisdiction-aware
 * conduct acknowledgment a provider accepts at check-in. The tamper-evident
 * (hash-chained) ledger lives server-side (serviceVerificationCrypto.ts).
 */

export type VerificationMethod = 'code' | 'last4_mobile' | 'manual_admin';
export const VERIFICATION_CODE_LENGTH = 6;
export const MAX_VERIFICATION_ATTEMPTS = 5;

/** A 6-digit numeric code (string form, leading zeros allowed). */
export function isCodeFormatValid(code: string): boolean {
  return new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`).test((code ?? '').trim());
}

/** Last 4 digits of a phone number (digits only). */
export function last4(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.slice(-4);
}

/** Friendly fallback: does the entered last-4 match the registered mobile? */
export function verifyLast4(input: string, registeredPhone: string | null | undefined): boolean {
  const want = last4(registeredPhone);
  const got = (input ?? '').replace(/\D/g, '').slice(-4);
  return want.length === 4 && got === want;
}

export function canAttempt(attemptsSoFar: number): boolean {
  return attemptsSoFar < MAX_VERIFICATION_ATTEMPTS;
}

// ── Jurisdiction (governing law = country where the service is performed) ──────
export interface Jurisdiction { code: string; name: string; lawRef: string; }
export const JURISDICTIONS: Record<string, Jurisdiction> = {
  IL: { code: 'IL', name: 'Israel', lawRef: 'the laws of the State of Israel (incl. the Penal Law 5737-1977)' },
  GR: { code: 'GR', name: 'Greece', lawRef: 'the laws of the Hellenic Republic (Greece)' },
};
export function resolveJurisdiction(countryCode?: string): Jurisdiction {
  return JURISDICTIONS[(countryCode ?? 'IL').toUpperCase()] ?? JURISDICTIONS.IL;
}

/**
 * Provider conduct acknowledgment shown + accepted at check-in. Friendly but
 * firm; theft/damage carries criminal liability under the governing country's law.
 */
export function conductAcknowledgmentText(countryCode?: string): string {
  const j = resolveJurisdiction(countryCode);
  return [
    'Before you start, please confirm you will care for this home and pet like your own:',
    '• Keep the home safe, clean and tidy — leave it as you found it.',
    '• Turn off lights and air-conditioning, close taps, and lock up when you leave.',
    '• Water the plants and follow any care notes only if the owner asked.',
    '• Enter only the permitted areas. Keep keys, codes and the address private.',
    `• Never take anything that is not yours. Theft or wilful damage is a crime: the police will be involved and you may face criminal charges and personal liability under ${j.lawRef}.`,
    'I have read and I accept these responsibilities.',
  ].join('\n');
}

/** Current acknowledgment version (bump when the text changes; stored with evidence). */
export const CONDUCT_ACK_VERSION = '1.0';
