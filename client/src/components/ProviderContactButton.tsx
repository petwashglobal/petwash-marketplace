import { useState } from 'react';
import { Phone } from 'lucide-react';
import { ContactParty } from './ContactParty';
import { getApiUrl } from '@/lib/apiConfig';

/**
 * ProviderContactButton — lets a customer reach their assigned provider from a
 * booking, WITHOUT the provider's phone ever being shipped in the bookings list.
 *
 * On tap it fetches the privacy-gated endpoint
 * (GET /api/booking-requests/:requestId/provider-contact), which returns the
 * provider's phone/email only when the caller owns the booking AND it is active
 * (accepted → completed). The number therefore reaches the browser only at the
 * moment there's a live reason for it, and only for the right person. On success
 * it swaps itself for the shared <ContactParty> Call/Text/Email control.
 *
 * Canonical (booking_requests) bookings only — other engines return 404 here and
 * the button degrades to a quiet "unavailable" state rather than erroring.
 */
export function ProviderContactButton({
  requestId,
  providerName,
  language = 'he',
}: {
  requestId: string;
  providerName?: string | null;
  language?: 'he' | 'en' | string;
}) {
  const he = language === 'he';
  const [state, setState] = useState<'idle' | 'loading' | 'shown' | 'error' | 'unavailable'>('idle');
  const [contact, setContact] = useState<{ phone?: string | null; email?: string | null } | null>(null);

  const load = async () => {
    setState('loading');
    try {
      const res = await fetch(getApiUrl(`/api/booking-requests/${requestId}/provider-contact`), {
        credentials: 'include',
      });
      if (res.status === 409) { setState('unavailable'); return; }
      if (!res.ok) { setState(res.status === 404 ? 'unavailable' : 'error'); return; }
      const data = await res.json();
      if (!data?.phone && !data?.email) { setState('unavailable'); return; }
      setContact({ phone: data.phone, email: data.email });
      setState('shown');
    } catch {
      setState('error');
    }
  };

  if (state === 'shown' && contact) {
    return (
      <ContactParty
        phone={contact.phone}
        email={contact.email}
        who={providerName || (he ? 'המטפל' : 'provider')}
        smsBody={he ? 'שלום, בנוגע להזמנה שלי ב-⁧PetWash⁩' : 'Hi, regarding my PetWash booking'}
      />
    );
  }

  const label =
    state === 'loading' ? (he ? 'טוען…' : 'Loading…')
    : state === 'unavailable' ? (he ? 'זמין לאחר אישור' : 'Available once confirmed')
    : state === 'error' ? (he ? 'נסו שוב' : 'Try again')
    : (he ? 'צור קשר עם המטפל' : 'Contact provider');

  return (
    <button
      type="button"
      onClick={load}
      disabled={state === 'loading' || state === 'unavailable'}
      data-testid="contact-provider-button"
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 disabled:opacity-60"
    >
      <Phone className="w-3.5 h-3.5" aria-hidden />
      {label}
    </button>
  );
}

export default ProviderContactButton;
