/**
 * MyJobPassport — the JobPassport client surface.
 *
 * Route: /jobs/by-booking/:source/:bookingId (via GET
 * /api/jobs/by-booking/:source/:bookingId — see
 * server/routes/job-passport.ts).
 *
 * Until this file existed, the JobPassport composer + 3 test files were
 * unreachable from the app — the CEO called this out on 2026-08-27.
 * READ-ONLY. Renders the actor-scoped envelope (customer / provider /
 * staff), shows allowed actions from the server (§23: client never
 * invents them), surfaces money legs, verification method, and audit
 * refs. Same green-marble palette as PetPassport + FiscalPassport.
 */
import { useMemo } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { PetWashLogo } from '@/components/brand/PetWashLogo';
import {
  ArrowLeft, Loader2, ShieldCheck, MapPin, CalendarClock, User, Dog,
  CreditCard, Fingerprint, RefreshCw,
} from 'lucide-react';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const MARBLE = '#FAFAF7';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

interface AllowedAction {
  code: string;
  enabled: boolean;
  requiresVerification: boolean;
  verificationMethod?: string;
  label: string;
  hint?: string;
}

interface JobPassport {
  jobRef: string;
  correlationId: string;
  platform: string;
  serviceType: string;
  customer: { userId: string; displayName?: string };
  fulfiller: {
    kind: string;
    displayName?: string;
    providerPublicId?: string;
    verifiedBadge?: boolean;
    serviceApproved?: boolean;
    suspended?: boolean;
  };
  pets: Array<{ petId: string; displayName: string; breed?: string; careNotesSnapshotStale?: boolean }>;
  location: { type: string; display: string; lat?: number; lng?: number };
  schedule: { startsAt: string; endsAt?: string; timezone: string };
  booking: { canonicalId: string; source: string; sourceId: string; status: string };
  fulfillment: { state: string; startedAt?: string; completedAt?: string };
  money: {
    state: string; currency: string; totalCents: number;
    amountPaidCents: number; amountDueCents: number;
    providerExpectedCents?: number; providerAvailableCents?: number; providerPaidCents?: number;
    legs: Array<{ kind: string; amountCents: number; currency: string; label: string }>;
  };
  verification: { startMethod: string; completionMethod: string; handoffState: string; handoffExpiresAt?: string };
  allowedActions: AllowedAction[];
  auditRefs: Array<{ eventType: string; timestamp: string; actorKind: string; actorUidTail?: string }>;
  composedAt: string;
}

interface JobPassportEnvelope {
  passport: JobPassport;
  viewFor: {
    actor: { kind: string; uid: string };
    showsProviderMoney: boolean;
    showsLiveTracking: boolean;
  };
}

function fmtCents(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}
function fmtWhen(iso: string, isHe: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(isHe ? 'he-IL' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function MyJobPassport() {
  const { source, bookingId } = useParams<{ source: string; bookingId: string }>();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ ok: boolean } & JobPassportEnvelope>({
    queryKey: [`/api/jobs/by-booking/${source}/${bookingId}`],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/jobs/by-booking/${source}/${bookingId}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    retry: false,
  });

  const env = data as JobPassportEnvelope | undefined;
  const p = env?.passport;
  const viewFor = env?.viewFor;

  const nonRefundLegs = useMemo(
    () => (p?.money.legs ?? []).filter((l) => l.kind !== 'REFUND'),
    [p?.money.legs],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: MARBLE }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GREEN }} />
      </div>
    );
  }
  if (isError || !p) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: MARBLE }}>
        <ShieldCheck className="w-8 h-8" style={{ color: GREEN }} />
        <h2 className="mt-3 text-lg font-bold" style={{ color: INK }}>
          {tr('Job not found', 'העבודה לא נמצאה')}
        </h2>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>
          {tr(
            "This job isn't linked to your account, or it may have been removed.",
            'העבודה אינה משוייכת לחשבון שלכם או שהוסרה.',
          )}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 rounded-full px-5 py-2 text-sm font-semibold"
          style={{ background: GREEN, color: GOLD }}
        >
          {tr('Back to home', 'חזרה לדף הבית')}
        </button>
      </div>
    );
  }

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen" style={{ background: MARBLE }}>
      <div className="mx-auto w-full max-w-[480px] px-5 pt-5 pb-16">

        {/* Header */}
        <div dir="ltr" className="flex items-center justify-between mb-4">
          <button
            onClick={() => history.length > 1 ? history.back() : navigate('/')}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: GREEN }}
          >
            <ArrowLeft className="w-4 h-4" />
            {tr('Back', 'חזרה')}
          </button>
          <PetWashLogo size={30} />
        </div>

        {/* Hero */}
        <div className="rounded-[22px] p-5 shadow-lg" style={{ background: GREEN }}>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: GOLD }}>
            <span>{tr('PetWash™ · Job Passport', 'PetWash™ · דרכון עבודה')}</span>
            <span dir="ltr">{p.jobRef}</span>
          </div>
          <div className="mt-3" style={{ textAlign: isHe ? 'right' : 'left' }}>
            <div className="text-[15px]" style={{ color: 'rgba(255,255,255,0.85)' }}>{p.platform.replace('_', ' ')} · {p.serviceType}</div>
            <div className="mt-0.5 text-[20px] font-extrabold" style={{ color: GOLD }}>
              {p.booking.status}
              {p.fulfillment.state !== 'NOT_STARTED' && ` · ${p.fulfillment.state}`}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip icon={<CalendarClock className="w-3 h-3" />} label={fmtWhen(p.schedule.startsAt, isHe)} />
              {p.location?.display && (
                <Chip icon={<MapPin className="w-3 h-3" />} label={p.location.display} />
              )}
            </div>
          </div>
        </div>

        {/* Allowed actions — server-owned, client never invents (§23) */}
        {p.allowedActions.length > 0 && (
          <div className="mt-4 rounded-[22px] bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-3" style={{ color: GREEN }}>
              {tr('What you can do now', 'מה אפשר לעשות עכשיו')}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {p.allowedActions.map((a) => (
                <div
                  key={a.code}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{
                    background: a.enabled ? '#F7F3E7' : MARBLE,
                    border: `1px solid ${BORDER}`,
                    opacity: a.enabled ? 1 : 0.7,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold" style={{ color: INK }}>{a.label}</div>
                    {a.hint && <div className="text-[11px]" style={{ color: MUTED }}>{a.hint}</div>}
                  </div>
                  {a.requiresVerification && (
                    <span
                      className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                      style={{ background: 'rgba(6,59,34,0.08)', color: GREEN, border: `1px solid ${GREEN}` }}
                      title={a.verificationMethod}
                    >
                      <Fingerprint className="inline w-3 h-3 mr-1" />
                      {a.verificationMethod || tr('Verify', 'אימות')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fulfiller */}
        <div className="mt-4 rounded-[22px] bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4" style={{ color: GREEN }} />
            <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
              {tr('Fulfiller', 'ספק / מבצע')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-bold" style={{ color: INK }}>
                {p.fulfiller.displayName || p.fulfiller.kind}
              </div>
              <div className="text-[11px]" style={{ color: MUTED }}>
                {p.fulfiller.kind}
                {p.fulfiller.providerPublicId ? ` · ${p.fulfiller.providerPublicId}` : ''}
              </div>
            </div>
            {p.fulfiller.verifiedBadge && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5"
                style={{ background: '#E7F1EA', color: GREEN, border: `1px solid ${GREEN}` }}
              >
                <ShieldCheck className="w-3 h-3" />
                {tr('Verified', 'מאומת')}
              </span>
            )}
            {p.fulfiller.suspended && (
              <span
                className="inline-flex items-center text-[11px] font-semibold rounded-full px-2 py-0.5"
                style={{ background: '#FEECEC', color: '#8A0A0A', border: '1px solid #8A0A0A' }}
              >
                {tr('Suspended', 'מושהה')}
              </span>
            )}
          </div>
        </div>

        {/* Pets */}
        {p.pets.length > 0 && (
          <div className="mt-4 rounded-[22px] bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Dog className="w-4 h-4" style={{ color: GREEN }} />
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
                {tr('Pets', 'חיות מחמד')}
              </span>
            </div>
            <ul className="space-y-1.5">
              {p.pets.map((pet) => (
                <li key={pet.petId} className="flex items-center justify-between text-sm">
                  <span style={{ color: INK }} className="font-semibold">
                    {pet.displayName}
                    {pet.breed && <span style={{ color: MUTED }} className="font-normal"> · {pet.breed}</span>}
                  </span>
                  {pet.careNotesSnapshotStale && (
                    <span className="text-[10px] font-semibold" style={{ color: '#8A5A00' }}>
                      {tr('Care notes updated since booking', 'הוראות טיפול עודכנו מאז ההזמנה')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Money — §19 discipline: money.state distinct from booking / fulfillment */}
        <div className="mt-4 rounded-[22px] bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4" style={{ color: GREEN }} />
            <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
              {tr('Money', 'כסף')}
            </span>
          </div>
          <Kv k={tr('State', 'סטטוס')} v={p.money.state} />
          <Kv k={tr('Total', 'סה״כ')} v={fmtCents(p.money.totalCents)} bold />
          <Kv k={tr('Paid', 'שולם')} v={fmtCents(p.money.amountPaidCents)} />
          {p.money.amountDueCents > 0 && (
            <Kv k={tr('Due', 'יתרה לתשלום')} v={fmtCents(p.money.amountDueCents)} bold />
          )}
          {viewFor?.showsProviderMoney && (
            <>
              {p.money.providerExpectedCents !== undefined && (
                <Kv k={tr('Provider expected', 'תשלום צפוי לספק')} v={fmtCents(p.money.providerExpectedCents)} />
              )}
              {p.money.providerAvailableCents !== undefined && (
                <Kv k={tr('Provider available', 'זמין לספק')} v={fmtCents(p.money.providerAvailableCents)} />
              )}
              {p.money.providerPaidCents !== undefined && (
                <Kv k={tr('Provider paid', 'שולם לספק')} v={fmtCents(p.money.providerPaidCents)} />
              )}
            </>
          )}
          {nonRefundLegs.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>{tr('Payment legs', 'רגלי תשלום')}</div>
              {nonRefundLegs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between text-[13px]">
                  <span style={{ color: INK }}>{leg.label}</span>
                  <span dir="ltr" className="font-semibold" style={{ color: INK }}>{fmtCents(leg.amountCents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verification */}
        <div className="mt-4 rounded-[22px] bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Fingerprint className="w-4 h-4" style={{ color: GREEN }} />
            <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
              {tr('Verification', 'אימות')}
            </span>
          </div>
          <Kv k={tr('Start method', 'שיטת התחלה')} v={p.verification.startMethod} />
          <Kv k={tr('Completion method', 'שיטת סיום')} v={p.verification.completionMethod} />
          <Kv k={tr('Handoff', 'העברת שרביט')} v={p.verification.handoffState} />
          {p.verification.handoffExpiresAt && (
            <Kv k={tr('Handoff expires', 'תוקף העברה')} v={fmtWhen(p.verification.handoffExpiresAt, isHe)} />
          )}
        </div>

        {/* Audit refs */}
        {p.auditRefs.length > 0 && (
          <div className="mt-4 rounded-[22px] bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-3" style={{ color: GREEN }}>
              {tr('Recent events', 'אירועים אחרונים')}
            </div>
            <ul className="space-y-1.5">
              {p.auditRefs.slice(0, 8).map((e, i) => (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span style={{ color: INK }} className="font-semibold">{e.eventType}</span>
                  <span style={{ color: MUTED }}>{fmtWhen(e.timestamp, isHe)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* §33 cross-link — Job → Transaction. Only surfaces for
            booking-type sources that also carry a fiscal transaction. */}
        {p.booking?.source && p.booking?.sourceId && (
          <button
            type="button"
            onClick={() => navigate(`/account/transactions/${p.booking.source}/${encodeURIComponent(p.booking.sourceId)}`)}
            className="mt-4 w-full inline-flex items-center justify-between rounded-[16px] bg-white px-4 py-3 text-start"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" style={{ color: GREEN }} />
              <span className="text-sm font-bold" style={{ color: INK }}>
                {tr('View transaction / receipt', 'צפייה בקבלה / עסקה')}
              </span>
            </span>
            <span style={{ color: MUTED }}>›</span>
          </button>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-[11px]" style={{ color: MUTED }}>
          <span dir="ltr" className="font-mono">{p.correlationId}</span>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: GREEN }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {tr('Refresh', 'רענון')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: 'rgba(214,181,109,0.18)', color: GOLD, border: `1px solid ${GOLD}` }}
    >
      {icon}{label}
    </span>
  );
}

function Kv({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: BORDER }}>
      <span className="text-[12px]" style={{ color: MUTED }}>{k}</span>
      <span
        className={`text-[13px] ${bold ? 'font-extrabold' : 'font-semibold'}`}
        style={{ color: INK }}
        dir="auto"
      >
        {v}
      </span>
    </div>
  );
}
