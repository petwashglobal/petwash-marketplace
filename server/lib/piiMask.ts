/**
 * PII masking helpers for operator logs / diagnostics (CEO 2026-08-16 SUMIT
 * lane rule: "No secrets. No full mobile. No full email unless explicit
 * secure operator mode.").
 *
 * Every helper is defensive — if the input is empty/undefined it returns
 * "—" so downstream logs don't leak an accidental "undefined" or the
 * literal string.
 */

/** Show only "abc…xyz" (first 3 + last 3) for opaque identifiers. */
export function maskUid(uid: string | null | undefined): string {
  if (!uid) return '—';
  if (uid.length <= 6) return `${uid[0]}…`;
  return `${uid.slice(0, 3)}…${uid.slice(-3)}`;
}

/** Show only first initial of each name part. "John Middle Doe" → "J.M.D." */
export function maskName(name: string | null | undefined): string {
  if (!name) return '—';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0]?.toUpperCase() ?? ''}.`)
    .join('') || '—';
}

/** Show only first char + domain first char. "alice@example.co.il" → "a…@e…". */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '—';
  const [local, domain] = email.split('@');
  const localHead = local.slice(0, 1);
  const domainHead = domain.slice(0, 1);
  return `${localHead}…@${domainHead}…`;
}

/** Show only country prefix + last 2 digits. "+972501234567" → "+972•••67". */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.length <= 4) return '•••';
  const head = digits.startsWith('+') ? digits.slice(0, 4) : digits.slice(0, 3);
  return `${head}•••${digits.slice(-2)}`;
}
