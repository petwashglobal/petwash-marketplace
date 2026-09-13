/**
 * /adoption/my — the member's Adopt a Pet dashboard: my listings and their
 * status, enquiries received, enquiries sent, and adoption alerts.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { AuthGateCard } from '@/components/AuthGateCard';
import { PetWashIcon } from '@/components/PetWashIcon';
import { useSEO, pageSEO } from '@/lib/seo';
import {
  AdoptionShell, QuietLink, StatusChip, HAIRLINE, PAPER, GOLD,
  adoptionApi, errorText, yesNoLabel, type AdoptionListing,
} from './adoptionUi';

type Tab = 'listings' | 'received' | 'sent' | 'alerts';

interface ReceivedEnquiry {
  id: number; listing_id: number; message_text: string; applicant_phone: string | null;
  home_type: string; has_children: string; has_other_pets: string; status: string; created_at: string; pet_name: string | null;
}
interface SentEnquiry { id: number; listing_id: number; status: string; created_at: string; pet_name: string | null; city: string; owner_phone: string | null }
interface Alert { id: number; title: string; body: string; read: boolean; created_at: string; payload?: { link?: string } }

const HOME: Record<string, [string, string]> = {
  apartment: ['דירה', 'Apartment'], house: ['בית', 'House'], house_with_yard: ['בית עם חצר', 'House with yard'],
  other: ['אחר', 'Other'], unspecified: ['לא צוין', 'Not specified'],
};
const ENQUIRY_STATUS: Record<string, [string, string]> = {
  pending: ['ממתינה לתשובה', 'Awaiting reply'], accepted: ['התקבלה', 'Accepted'],
  declined: ['לא התקדמה', 'Not taken forward'], withdrawn: ['בוטלה', 'Withdrawn'],
};

function useAuthed<T>(key: string, enabled: boolean) {
  return useQuery<T>({ queryKey: [key], enabled, queryFn: () => adoptionApi<T>(key) });
}

function SmallAction({ onClick, children, disabled, testId }: { onClick: () => void; children: React.ReactNode; disabled?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId}
      className="rounded-full px-3.5 py-1.5 text-xs text-black transition-opacity hover:opacity-70 disabled:opacity-40"
      style={{ border: `1px solid ${HAIRLINE}` }}>
      {children}
    </button>
  );
}

export default function AdoptionMyListings() {
  useSEO(pageSEO.adoption);
  const { language } = useLanguage();
  const isHe = language === 'he';
  const L = (he: string, en: string) => (isHe ? he : en);
  const { user, loading } = useFirebaseAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('listings');
  const [busy, setBusy] = useState<string | null>(null);

  const signedIn = !!user;
  const listings = useAuthed<{ rows: AdoptionListing[] }>('/api/adoption/my/listings', signedIn);
  const received = useAuthed<{ rows: ReceivedEnquiry[] }>('/api/adoption/my/enquiries', signedIn);
  const sent = useAuthed<{ rows: SentEnquiry[] }>('/api/adoption/my/enquiries/sent', signedIn);
  const alerts = useAuthed<{ rows: Alert[]; unreadCount: number }>('/api/adoption/my/notifications', signedIn);

  const shell = (children: React.ReactNode) => (
    <AdoptionShell isHe={isHe} title={L('האזור שלי באימוץ', 'My adoption')} back={{ href: '/adoption', label: L('→ לכל החיות לאימוץ', '← All pets for adoption') }}>
      {children}
    </AdoptionShell>
  );

  if (loading) return shell(<div />);
  if (!user) {
    return shell(<AuthGateCard language={language} redirectTo="/adoption/my" message={L('התחברו כדי לראות את המודעות והפניות שלכם.', 'Sign in to see your listings and enquiries.')} />);
  }

  async function act(id: string, run: () => Promise<unknown>, keys: string[]) {
    setBusy(id);
    try {
      await run();
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (err) {
      toast({ variant: 'destructive', title: L('הפעולה נכשלה', 'Action failed'), description: errorText(isHe, err) });
    } finally {
      setBusy(null);
    }
  }

  const setStatus = (id: number, status: string) =>
    act(`status-${id}`, () => adoptionApi(`/api/adoption/my/listings/${id}/status`, { json: { status } }), ['/api/adoption/my/listings', '/api/adoption/my/enquiries']);
  const respond = (id: number, action: 'accept' | 'decline') =>
    act(`enq-${id}`, () => adoptionApi(`/api/adoption/my/enquiries/${id}/${action}`, { json: {} }), ['/api/adoption/my/enquiries', '/api/adoption/my/listings']);

  const tabs: [Tab, string, number?][] = [
    ['listings', L('המודעות שלי', 'My listings')],
    ['received', L('פניות שהתקבלו', 'Enquiries received'), received.data?.rows.filter((r) => r.status === 'pending').length],
    ['sent', L('פניות ששלחתי', 'Enquiries sent')],
    ['alerts', L('התראות', 'Alerts'), alerts.data?.unreadCount],
  ];

  const empty = (text: string) => <p className="py-14 text-sm text-black/55" style={{ textAlign: 'center' }}>{text}</p>;

  return shell(
    <>
      <nav className="mb-6 flex gap-5 overflow-x-auto" style={{ borderBottom: `1px solid ${HAIRLINE}` }} role="tablist">
        {tabs.map(([key, label, count]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} data-testid={`tab-${key}`}
            className="shrink-0 pb-2.5 text-sm transition-opacity"
            style={{ borderBottom: `1px solid ${tab === key ? GOLD : 'transparent'}`, color: tab === key ? '#000' : 'rgba(0,0,0,0.5)' }}>
            {label}{count ? ` · ${count}` : ''}
          </button>
        ))}
      </nav>

      {tab === 'listings' && (
        <div className="space-y-4">
          <div style={{ textAlign: 'center' }} className="pb-2">
            <QuietLink href="/adoption/new" testId="link-new-listing">{L('פרסום חיה נוספת לאימוץ ←', 'List another pet →')}</QuietLink>
          </div>
          {listings.isLoading ? empty(L('טוען…', 'Loading…')) : !listings.data?.rows.length ? empty(L('עדיין לא פרסמתם חיה לאימוץ.', 'You have not listed a pet yet.')) :
            listings.data.rows.map((l) => (
              <article key={l.id} className="flex gap-4 rounded-2xl p-3" style={{ border: `1px solid ${HAIRLINE}` }} data-testid={`my-listing-${l.id}`}>
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl flex items-center justify-center" style={{ background: PAPER }}>
                  {l.primary_media ? <img src={l.primary_media} alt="" className="h-full w-full object-cover" /> : <PetWashIcon name="brand_paw" size={28} label="" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-serif text-lg leading-tight truncate">{l.pet_name}</div>
                    <StatusChip isHe={isHe} status={l.status} />
                  </div>
                  <div className="mt-1 text-xs text-black/55">{l.city}{l.pending_enquiries ? ` · ${L('פניות ממתינות', 'pending enquiries')}: ${l.pending_enquiries}` : ''}</div>
                  {l.status === 'pending_review' && <p className="mt-1 text-xs text-black/55">{L('המודעה בבדיקה ותעלה לאחר אישור.', 'In review — it goes live once approved.')}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(l.status === 'available' || l.status === 'pending' || l.status === 'adopted') && (
                      <Link href={`/adoption/${l.id}`}><span className="rounded-full px-3.5 py-1.5 text-xs text-black cursor-pointer" style={{ border: `1px solid ${GOLD}` }}>{L('צפייה', 'View')}</span></Link>
                    )}
                    {l.status === 'available' && <SmallAction disabled={!!busy} onClick={() => setStatus(l.id, 'pending')} testId={`action-pending-${l.id}`}>{L('בתהליך היכרות', 'Mark pending')}</SmallAction>}
                    {l.status === 'pending' && <SmallAction disabled={!!busy} onClick={() => setStatus(l.id, 'available')}>{L('חזרה לזמין', 'Back to available')}</SmallAction>}
                    {(l.status === 'available' || l.status === 'pending') && <SmallAction disabled={!!busy} onClick={() => setStatus(l.id, 'adopted')} testId={`action-adopted-${l.id}`}>{L('אומץ/ה 🎉', 'Adopted 🎉')}</SmallAction>}
                    <SmallAction disabled={!!busy} onClick={() => setStatus(l.id, 'archived')}>{L('הסרה', 'Remove')}</SmallAction>
                  </div>
                </div>
              </article>
            ))}
        </div>
      )}

      {tab === 'received' && (
        <div className="space-y-4">
          {received.isLoading ? empty(L('טוען…', 'Loading…')) : !received.data?.rows.length ? empty(L('אין פניות עדיין.', 'No enquiries yet.')) :
            received.data.rows.map((e) => (
              <article key={e.id} className="rounded-2xl p-4" style={{ border: `1px solid ${HAIRLINE}` }} data-testid={`received-enquiry-${e.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-serif text-base">{L('פנייה לאימוץ', 'Enquiry for')} {e.pet_name}</div>
                  <span className="text-xs text-black/55">{isHe ? ENQUIRY_STATUS[e.status]?.[0] : ENQUIRY_STATUS[e.status]?.[1]}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-black/75 whitespace-pre-line">{e.message_text}</p>
                <div className="mt-2 text-xs text-black/55">
                  {L('בית', 'Home')}: {isHe ? HOME[e.home_type]?.[0] : HOME[e.home_type]?.[1]} · {L('ילדים', 'Children')}: {yesNoLabel(isHe, e.has_children)} · {L('חיות נוספות', 'Other pets')}: {yesNoLabel(isHe, e.has_other_pets)}
                </div>
                {e.applicant_phone && <div className="mt-2 text-sm" dir="ltr" style={{ textAlign: isHe ? 'right' : 'left' }}><a href={`tel:${e.applicant_phone}`} className="underline">{e.applicant_phone}</a></div>}
                {e.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <SmallAction disabled={!!busy} onClick={() => respond(e.id, 'accept')} testId={`accept-${e.id}`}>{L('אישור ושיתוף הטלפון שלי', 'Accept & share my phone')}</SmallAction>
                    <SmallAction disabled={!!busy} onClick={() => respond(e.id, 'decline')}>{L('לא הפעם', 'Decline')}</SmallAction>
                  </div>
                )}
              </article>
            ))}
        </div>
      )}

      {tab === 'sent' && (
        <div className="space-y-4">
          {sent.isLoading ? empty(L('טוען…', 'Loading…')) : !sent.data?.rows.length ? empty(L('לא שלחתם פניות.', 'You have not sent any enquiries.')) :
            sent.data.rows.map((e) => (
              <article key={e.id} className="rounded-2xl p-4" style={{ border: `1px solid ${HAIRLINE}` }}>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/adoption/${e.listing_id}`}><span className="font-serif text-base cursor-pointer" style={{ borderBottom: `1px solid ${GOLD}` }}>{e.pet_name} · {e.city}</span></Link>
                  <span className="text-xs text-black/55">{isHe ? ENQUIRY_STATUS[e.status]?.[0] : ENQUIRY_STATUS[e.status]?.[1]}</span>
                </div>
                {e.owner_phone && (
                  <p className="mt-2 text-sm">
                    {L('לתיאום היכרות:', 'To arrange a meeting:')} <a href={`tel:${e.owner_phone}`} dir="ltr" className="underline">{e.owner_phone}</a>
                  </p>
                )}
              </article>
            ))}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-3">
          {!!alerts.data?.unreadCount && (
            <div style={{ textAlign: 'center' }}>
              <SmallAction onClick={() => act('read-all', () => adoptionApi('/api/adoption/my/notifications/read-all', { json: {} }), ['/api/adoption/my/notifications'])}>
                {L('סימון הכול כנקרא', 'Mark all read')}
              </SmallAction>
            </div>
          )}
          {alerts.isLoading ? empty(L('טוען…', 'Loading…')) : !alerts.data?.rows.length ? empty(L('אין התראות.', 'No alerts.')) :
            alerts.data.rows.map((n) => (
              <div key={n.id} className="rounded-2xl p-4" style={{ border: `1px solid ${n.read ? HAIRLINE : GOLD}` }}>
                <div className="text-sm font-medium">{n.title}</div>
                <div className="mt-1 text-xs text-black/60">{n.body}</div>
              </div>
            ))}
        </div>
      )}
    </>,
  );
}
