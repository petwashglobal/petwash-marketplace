import { Phone, MessageSquare, Mail } from 'lucide-react';

/**
 * ContactParty — one consistent "reach the other side of a booking" control.
 *
 * The same booking has two parties; each role contacts the OTHER:
 *   • provider view → contact the client   (POSJobs, provider dashboards)
 *   • customer view → contact the provider (my-bookings — once the API returns
 *     the provider phone, privacy-gated to active bookings)
 *   • admin view    → contact either
 *
 * Before this, contact was scattered and inconsistent: some screens only had a
 * `tel:` call link, none offered a text, and the styling drifted per page. This
 * renders Call / Text / Email from the same component, showing only the channels
 * that actually have a value — so a missing phone or email simply hides that
 * button rather than producing a dead `tel:`/`mailto:` with nothing after it.
 *
 * Deliberately dumb + presentational: it takes already-resolved contact values
 * and never fetches. Whoever renders it is responsible for only passing a phone
 * when the viewer is allowed to see it (privacy stays at the data layer).
 */
export interface ContactPartyProps {
  /** E.164 or local phone. When absent, Call + Text are hidden. */
  phone?: string | null;
  /** When absent, Email is hidden. */
  email?: string | null;
  /** Who you're contacting — used for the aria-labels (e.g. "client", "provider"). */
  who?: string;
  /** Optional prefilled SMS body. */
  smsBody?: string;
  /** Compact (icon-only) for tight rows, or labelled. Default: labelled. */
  variant?: 'labelled' | 'icon';
  className?: string;
}

/** Strip spaces/parens so tel:/sms: hrefs are always dialable. */
function cleanPhone(p: string): string {
  return p.replace(/[^\d+]/g, '');
}

export function ContactParty({
  phone,
  email,
  who = 'contact',
  smsBody,
  variant = 'labelled',
  className = '',
}: ContactPartyProps) {
  const tel = phone ? cleanPhone(phone) : '';
  const hasPhone = tel.length >= 5;
  const hasEmail = !!email && email.includes('@');
  if (!hasPhone && !hasEmail) return null;

  const iconOnly = variant === 'icon';
  const base =
    'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors ' +
    (iconOnly ? 'p-2 justify-center' : 'px-3 py-2 text-xs');

  const smsHref = smsBody
    ? `sms:${tel}${/i(Phone|Pad|Pod)/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(smsBody)}`
    : `sms:${tel}`;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} data-testid="contact-party">
      {hasPhone && (
        <a
          href={`tel:${tel}`}
          aria-label={`Call ${who}`}
          data-testid="contact-call"
          className={`${base} bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25`}
        >
          <Phone className="w-3.5 h-3.5" aria-hidden />
          {!iconOnly && 'Call'}
        </a>
      )}
      {hasPhone && (
        <a
          href={smsHref}
          aria-label={`Text ${who}`}
          data-testid="contact-text"
          className={`${base} bg-blue-500/15 text-blue-700 hover:bg-blue-500/25`}
        >
          <MessageSquare className="w-3.5 h-3.5" aria-hidden />
          {!iconOnly && 'Text'}
        </a>
      )}
      {hasEmail && (
        <a
          href={`mailto:${email}`}
          aria-label={`Email ${who}`}
          data-testid="contact-email"
          className={`${base} bg-[#D4AF37]/15 text-[#B8932F] hover:bg-[#D4AF37]/25`}
        >
          <Mail className="w-3.5 h-3.5" aria-hidden />
          {!iconOnly && 'Email'}
        </a>
      )}
    </div>
  );
}

export default ContactParty;
