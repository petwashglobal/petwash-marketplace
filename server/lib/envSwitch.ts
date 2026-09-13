/**
 * One parser for security/money env switches (2026-09-13).
 *
 * Found: PROVIDER_DECLARATIONS_ENFORCE was read as `(v || 'on') === 'on'`, so an
 * operator setting it to "true" or "1" TURNED THE GATE OFF. Same shape for
 * RECONFIRMATION_ENFORCE. And webhook secrets were checked for presence only, so
 * the deploy script's literal 'nayax-placeholder-not-active' — readable in this
 * public workflow file — counted as a real signing key.
 */

/** Enforcing switch: ON unless explicitly off/false/0/no. Unset → `defaultOn`. */
export function enforceSwitch(value: string | undefined, defaultOn: boolean): boolean {
  const v = (value ?? '').trim().toLowerCase();
  if (v === '') return defaultOn;
  if (['off', 'false', '0', 'no', 'disabled', 'shadow'].includes(v)) return false;
  if (['on', 'true', '1', 'yes', 'enabled', 'enforce'].includes(v)) return true;
  return defaultOn;
}

/** A secret usable for signing: present, non-blank, not a deploy placeholder. */
export function isRealSecret(value: string | undefined): boolean {
  return !!value && value.trim() !== '' && !/placeholder/i.test(value);
}
