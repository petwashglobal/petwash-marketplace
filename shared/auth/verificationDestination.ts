/**
 * Customer-facing masking for a verification destination.
 *
 * DELIBERATELY DIFFERENT from server/lib/piiMask.ts. Those helpers exist for
 * OPERATOR LOGS and are aggressive on purpose ("alice@example.co.il" → "a…@e…"),
 * because an operator never needs to know which mailbox a code went to.
 *
 * A customer does. The one question this string has to answer is "which of my
 * inboxes should I go and look in?" — so the domain stays readable and the
 * local part keeps its first and last character. That is the standard shape
 * every bank and airline uses, and it leaks materially less than the raw value
 * while still being actionable.
 *
 * THE SERVER IS THE AUTHORITY. The client renders `maskedDestination` exactly
 * as received and never masks a raw value itself — a client that has the raw
 * value has already been over-served.
 */

export function maskEmailForOwner(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•••';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain) return '•••';

  // 1-2 char locals cannot keep both ends without revealing everything.
  if (local.length <= 2) return `${local[0]}••@${domain}`;
  const dots = '•'.repeat(Math.min(Math.max(local.length - 2, 1), 8));
  return `${local[0]}${dots}${local[local.length - 1]}@${domain}`;
}

export function maskPhoneForOwner(phone: string): string {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 4) return '•••';

  // Keep the country/prefix so an Israeli customer can tell a +972 number from
  // a foreign one, and the last 4 so they can match it against their handset.
  const last = digits.slice(-4);
  const head = plus ? `+${digits.slice(0, Math.min(3, digits.length - 4))}` : '';
  return `${head} ••• ${last}`.trim();
}

export type MaskableChannel = 'sms' | 'email' | 'whatsapp' | 'push';

export function maskDestinationForOwner(channel: string, destination: string): string {
  if (!destination) return '•••';
  if (channel === 'email') return maskEmailForOwner(destination);
  if (channel === 'sms' || channel === 'whatsapp') return maskPhoneForOwner(destination);
  return '•••';
}
