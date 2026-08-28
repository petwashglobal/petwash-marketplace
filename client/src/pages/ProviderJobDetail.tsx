/**
 * ProviderJobDetail — the per-job work screen for the Provider app.
 *
 * CEO 2026-06-23 spec §8 required screens 15–18: Job Details · Start Job ·
 * Complete Job · Care Notes / Photos. Until now the home's "Start"/"Details"
 * buttons dumped the provider on the jobs LIST (a dead tap) — this screen
 * closes that gap using ONLY existing backend rails:
 *
 *   GET  /api/booking-requests/:requestId                     (detail, provider-authorized,
 *                                                              customer location masked pre-acceptance)
 *   POST /api/provider-dashboard/v2/bookings/:id/:action      (accept | decline | start | complete)
 *   POST /api/booking-requests/:requestId/photo-update        (care note photo, in_progress only)
 *
 * Same luxury language as ProviderHome: white + black + gold #D4AF37,
 * metallic-green primary actions, EN/HE RTL. No fake data — every field is
 * the real booking row; absent fields render as honest dashes.
 */
import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { getApiUrl } from '@/lib/apiConfig';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { bookingStatusLabel } from '@shared/lib/bookingStatusLabels';
import {
  ArrowLeft, ArrowRight, MapPin, Clock, PawPrint, MessageCircle, Camera,
  CheckCircle2, XCircle, Play, Flag, ChevronRight, ShieldCheck, Loader2,
} from 'lucide-react';

const GOLD = '#D4AF37';
const GREEN = '#0e7a54';

function ils(cents: number | null | undefined): string {
  const n = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return `₪${(n / 100).toLocaleString('en-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined, he: boolean): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(he ? 'he-IL' : 'en-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

// Status labels come from @shared/lib/bookingStatusLabels — canonical
// coverage (14 statuses) shared across the app. The local per-status
// TONE color map below is kept file-local for now because this page's
// pill uses a bespoke inline color style that would need design sign-off
// to swap to the canonical badge palette.
const STATUS_TONE: Record<string, string> = {
  pending:                  '#b45309',
  quote_sent:               '#b45309',
  accepted:                 '#b45309',
  meet_greet_requested:     '#b45309',
  meet_greet_scheduled:     '#b45309',
  meet_greet_completed:     GREEN,
  payment_pending:          '#b45309',
  confirmed:                GREEN,
  in_progress:              '#1d4ed8',
  provider_marked_complete: '#1d4ed8',
  completed:                GREEN,
  reviewed:                 '#6b7280',
  declined:                 '#991b1b',
  cancelled:                '#991b1b',
  disputed:                 '#991b1b',
};

export default function ProviderJobDetail() {
  const params = useParams<{ requestId: string }>();
  const requestId = params.requestId;
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const Back = isHe ? ArrowRight : ArrowLeft;

  const [actionError, setActionError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoSent, setPhotoSent] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/booking-requests', requestId],
    queryFn: async () => {
      // apiRequest attaches Bearer token; raw fetch with cookie-only creds
      // 401'd on push-notif deep links (no session cookie yet) → blank
      // provider job screen.
      const r = await apiRequest('GET', `/api/booking-requests/${requestId}`);
      if (!r.ok) throw new Error(`load_failed_${r.status}`);
      return r.json();
    },
    enabled: !!user && !!requestId,
    staleTime: 15_000,
  });

  const b: any = data?.booking ?? null;
  const status: string = b?.status ?? '';
  const statusLabel = status ? bookingStatusLabel(status, isHe ? 'he' : 'en') : '—';
  const statusTone = STATUS_TONE[status] ?? '#6b7280';

  const actionMut = useMutation({
    mutationFn: async (action: 'accept' | 'decline' | 'start' | 'complete') => {
      // Booking audit CRIT #20 fix: fast-tap on Accept before the /booking fetch
      // resolves posted to /bookings/undefined/accept → 400. Guard here so the
      // mutation surfaces a friendly error instead of hitting the server with a
      // literal 'undefined' id.
      if (!b?.id) {
        throw new Error(isHe ? 'טוען פרטי הזמנה — נסה שוב בעוד רגע' : 'Loading booking — please retry in a moment');
      }
      const r = await apiRequest('POST', `/api/provider-dashboard/v2/bookings/${b.id}/${action}`, {});
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `${action}_failed`);
      return j;
    },
    onSuccess: () => {
      setActionError(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/booking-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/stats'] });
    },
    onError: (e: any) => setActionError(e?.message || 'action_failed'),
  });

  const photoMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest('POST', `/api/booking-requests/${requestId}/photo-update`, { photoUrl, caption });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'photo_failed');
      return j;
    },
    onSuccess: () => { setPhotoSent(true); setCaption(''); setPhotoUrl(''); setTimeout(() => setPhotoSent(false), 2500); refetch(); },
    onError: (e: any) => setActionError(e?.message || 'photo_failed'),
  });

  const busy = actionMut.isPending;
  const petNames: string = Array.isArray(b?.petIds) && b.petIds.length ? `${b.petIds.length}` : String(b?.petCount ?? '—');
  const photos: any[] = Array.isArray(b?.photoUpdates) ? b.photoUpdates : [];

  return (
    <div className="min-h-[100dvh] bg-white" dir={isHe ? 'rtl' : 'ltr'} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-md mx-auto pb-28">

        {/* Header */}
        <header className="px-4 pt-3 pb-2 flex items-center gap-3">
          <button onClick={() => window.history.length > 1 ? window.history.back() : navigate('/provider/home')} aria-label={isHe ? 'חזרה' : 'Back'} className="text-gray-700">
            <Back className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <img src="/brand/petwash-logo-official.png" alt="PetWash" className="h-6 object-contain mx-auto" loading="eager" />
            <span className="text-[9px] tracking-[0.3em] text-[#9a8a5c]">{isHe ? 'פרטי עבודה' : 'JOB DETAILS'}</span>
          </div>
          <div className="w-5" />
        </header>

        {isLoading && (
          <div className="px-4 py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>
        )}

        {!isLoading && !b && (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-600">{isHe ? 'העבודה לא נמצאה או שאינה שלך.' : 'Job not found, or it isn’t yours.'}</p>
            <button onClick={() => navigate('/provider-os?m=jobs')} className="mt-3 text-xs font-medium" style={{ color: GOLD }}>{isHe ? 'לרשימת העבודות' : 'Go to My Jobs'}</button>
          </div>
        )}

        {b && (
          <>
            {/* Status + service card */}
            <section className="px-4 pt-1">
              <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(140deg, #0c6b48 0%, #1aa86f 48%, #0e7a54 100%)', border: `1px solid ${GOLD}77` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white text-lg font-semibold leading-tight">{String(b.serviceType ?? '—').replace(/_/g, ' ')}</p>
                    <p className="text-white/70 text-xs mt-0.5 font-mono">{b.requestId ?? requestId}</p>
                    {/* 2026-08-27 wire-only sweep: link to the composed
                        JobPassport for this booking. Was orphaned in 55c889975. */}
                    <button
                      type="button"
                      onClick={() => navigate(`/jobs/by-booking/booking_requests/${b.requestId ?? requestId}`)}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold underline"
                      style={{ color: GOLD }}
                    >
                      {isHe ? 'צפייה בדרכון העבודה' : 'View Job Passport'}
                    </button>
                  </div>
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-white" style={{ color: statusTone }}>
                    {statusLabel}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-white/90 text-xs">
                  <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" style={{ color: GOLD }} />{fmtDate(b.startDate, isHe)}</div>
                  <div className="flex items-center gap-1.5"><PawPrint className="w-3.5 h-3.5" style={{ color: GOLD }} />{petNames} {isHe ? 'חיות' : 'pets'}</div>
                  {b.endDate && <div className="flex items-center gap-1.5 col-span-2"><Flag className="w-3.5 h-3.5" style={{ color: GOLD }} />{isHe ? 'עד' : 'Until'} {fmtDate(b.endDate, isHe)}</div>}
                </div>
              </div>
            </section>

            {actionError && (
              <section className="px-4 mt-3">
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs p-3">{actionError}</div>
              </section>
            )}

            {/* Primary actions per lifecycle state */}
            <section className="px-4 mt-4 space-y-2">
              {(status === 'pending' || status === 'quote_sent') && (
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => actionMut.mutate('decline')} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium border border-gray-200 rounded-xl py-3 text-gray-700">
                    <XCircle className="w-4 h-4" /> {isHe ? 'דחייה' : 'Decline'}
                  </button>
                  <button disabled={busy} onClick={() => actionMut.mutate('accept')} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl py-3 text-white" style={{ background: GREEN }}>
                    <CheckCircle2 className="w-4 h-4" /> {isHe ? 'אישור העבודה' : 'Accept Job'}
                  </button>
                </div>
              )}
              {status === 'confirmed' && (
                <button disabled={busy} onClick={() => actionMut.mutate('start')} className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl py-3 text-white" style={{ background: GREEN }}>
                  <Play className="w-4 h-4" /> {isHe ? 'התחלת עבודה' : 'Start Job'}
                </button>
              )}
              {status === 'in_progress' && (
                <button disabled={busy} onClick={() => actionMut.mutate('complete')} className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl py-3 text-white" style={{ background: GREEN }}>
                  <CheckCircle2 className="w-4 h-4" /> {isHe ? 'סיום עבודה' : 'Complete Job'}
                </button>
              )}
              {busy && <p className="text-center text-[11px] text-gray-400">{isHe ? 'מעדכן…' : 'Updating…'}</p>}
            </section>

            {/* Customer / location / notes */}
            <section className="px-4 mt-5 space-y-3">
              <div className="rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">{isHe ? 'פרטי ההזמנה' : 'Booking Details'}</p>
                <dl className="text-xs text-gray-600 space-y-1.5">
                  {b.address != null && (
                    <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: GOLD }} />
                      <span>{b.address || (isHe ? 'הכתובת המלאה תיחשף לאחר אישור' : 'Full address is revealed after you accept')}</span>
                    </div>
                  )}
                  {b.ownerMessage && <div><span className="font-medium text-gray-800">{isHe ? 'הודעת הלקוח: ' : 'Customer note: '}</span>{b.ownerMessage}</div>}
                  {b.specialRequirements && <div><span className="font-medium text-gray-800">{isHe ? 'דרישות מיוחדות: ' : 'Special requirements: '}</span>{b.specialRequirements}</div>}
                </dl>
                <button onClick={() => navigate('/inbox')} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: GOLD }}>
                  <MessageCircle className="w-3.5 h-3.5" /> {isHe ? 'שליחת הודעה ללקוח' : 'Message the customer'}
                </button>
              </div>

              {/* Payout line — provider's own money view (display only) */}
              <div className="rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">{isHe ? 'תשלום' : 'Payout'}</p>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>{isHe ? 'התשלום שלך לעבודה זו' : 'Your payout for this job'}</span>
                  <span className="text-base font-semibold text-gray-900">{ils(b.providerPayoutCents)}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{isHe ? 'משולם לאחר השלמת העבודה, בכפוף למסמכי ציות בתוקף.' : 'Paid after completion, subject to valid compliance documents.'}</p>
              </div>

              {/* Care notes / photos — in_progress only (backend enforces it too) */}
              {status === 'in_progress' && (
                <div className="rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-2 inline-flex items-center gap-1.5"><Camera className="w-4 h-4" style={{ color: GOLD }} /> {isHe ? 'עדכון טיפול ללקוח' : 'Care Update to Customer'}</p>
                  <input
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder={isHe ? 'קישור לתמונה (הועלתה מהמצלמה)' : 'Photo URL (from camera upload)'}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 mb-2"
                  />
                  <input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={isHe ? 'כמה מילים על איך הולך…' : 'A few words on how it’s going…'}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2"
                  />
                  <button
                    disabled={!photoUrl || photoMut.isPending}
                    onClick={() => photoMut.mutate()}
                    className="mt-2 w-full text-xs font-medium rounded-lg py-2.5 text-white disabled:opacity-50"
                    style={{ background: GREEN }}
                  >
                    {photoSent ? (isHe ? 'נשלח ✓' : 'Sent ✓') : (isHe ? 'שליחת עדכון' : 'Send Update')}
                  </button>
                </div>
              )}

              {photos.length > 0 && (
                <div className="rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-2">{isHe ? 'עדכונים שנשלחו' : 'Updates Sent'}</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {photos.slice(-6).map((p: any, i: number) => (
                      <div key={i} className="shrink-0 w-20">
                        <img src={p.url} alt={p.caption || 'care update'} className="w-20 h-20 object-cover rounded-xl border border-gray-100" />
                        {p.caption && <p className="text-[9px] text-gray-500 mt-0.5 truncate">{p.caption}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incident report — always one tap away on a live job */}
              <button onClick={() => navigate('/provider/incident')} className="w-full text-left rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: GOLD }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{isHe ? 'דיווח על אירוע' : 'Report an Incident'}</p>
                  <p className="text-[11px] text-gray-500">{isHe ? 'בטיחות קודמת לכל — דווחו על כל בעיה מיד.' : 'Safety first — report any issue immediately.'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
