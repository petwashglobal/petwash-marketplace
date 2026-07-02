/**
 * ProviderHome — the luxury PROVIDER app home.
 *
 * Same stunning visual language as the customer PrestigeHome (white + black +
 * metallic gold #D4AF37, metallic-green hero card), but PROVIDER-SCOPED per the
 * locked rule: NO wash, NO Prestige credits, NO Send-a-Gift. Providers serve the
 * three SaaS platforms (PetSitter · Walk My Pet · Academy; PetTrek coming soon).
 *
 * Sections (from the CEO 2026-06-24 design, provider half):
 *   ID card · stats (jobs/rating/completion/this-week ₪) · platform filter ·
 *   provider tools · upcoming JOBS (Start + distance) · monthly earnings ·
 *   document/compliance status · provider bottom nav.
 *
 * No fake data: every figure reads /api/provider-dashboard/v2/*; missing → 0/—.
 * Dark rollout: routed at /provider/home for preview.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { getApiUrl } from '@/lib/apiConfig';
import { queryClient } from '@/lib/queryClient';
import {
  Bell, MessageCircle, Power, ShieldCheck, Star, ChevronRight, TrendingUp,
  Briefcase, CalendarDays, Wallet as WalletIcon, ClipboardList, FileText, User,
  Dog, Footprints, GraduationCap, Mountain, MapPin, Navigation, CheckCircle2,
  DollarSign, LifeBuoy, AlertCircle,
} from 'lucide-react';

const GOLD = '#D4AF37';

/** Earnings/stats endpoints already return ILS (not cents). */
function nis(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `₪${v.toLocaleString('en-IL', { maximumFractionDigits: 0 })}`;
}

function fetchJson(url: string) {
  return fetch(getApiUrl(url), { credentials: 'include' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
}

export default function ProviderHome() {
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHe = language === 'he';

  const { data: profileRes } = useQuery({ queryKey: ['/api/provider-profile/me'], queryFn: () => fetchJson('/api/provider-profile/me'), enabled: !!user, staleTime: 60_000 });
  const { data: statsRes } = useQuery({ queryKey: ['/api/provider-dashboard/v2/stats'], queryFn: () => fetchJson('/api/provider-dashboard/v2/stats'), enabled: !!user, staleTime: 60_000 });
  const { data: earnRes } = useQuery({ queryKey: ['/api/provider-dashboard/v2/earnings'], queryFn: () => fetchJson('/api/provider-dashboard/v2/earnings'), enabled: !!user, staleTime: 60_000 });
  const { data: upcomingRes } = useQuery({ queryKey: ['/api/provider-dashboard/v2/upcoming'], queryFn: () => fetchJson('/api/provider-dashboard/v2/upcoming'), enabled: !!user, staleTime: 30_000 });
  const { data: countsRes } = useQuery({ queryKey: ['/api/provider-dashboard/v2/booking-counts'], queryFn: () => fetchJson('/api/provider-dashboard/v2/booking-counts'), enabled: !!user, staleTime: 30_000 });

  const profile: any = profileRes?.provider ?? profileRes ?? {};
  const stats: any = statsRes?.stats ?? statsRes ?? {};
  const earn: any = earnRes?.earnings ?? earnRes ?? {};
  const upcoming: any[] = Array.isArray(upcomingRes?.upcoming) ? upcomingRes.upcoming : Array.isArray(upcomingRes?.bookings) ? upcomingRes.bookings : Array.isArray(upcomingRes) ? upcomingRes : [];
  const newRequests = Number(countsRes?.counts?.new_request ?? countsRes?.new_request ?? countsRes?.newRequests ?? 0);

  // Application status — spec §B: "application status if not approved".
  // Silent when there's no application or it's already approved.
  const { data: appStatusRes } = useQuery({
    queryKey: ['/api/provider-onboarding/my/status'],
    queryFn: () => fetchJson('/api/provider-onboarding/my/status'),
    enabled: !!user,
    staleTime: 120_000,
  });
  const application: any = (appStatusRes as any)?.application ?? null;
  const appStatus: string | null = application?.status ?? null;
  const showApplicationCard = !!appStatus && !['approved', 'approved_as_provider'].includes(appStatus);

  const providerId: number | undefined = stats?.platforms?.[0]?.id ?? profile?.id;
  const name = profile?.businessName || profile?.displayName || user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || (isHe ? 'ספק' : 'Provider');
  const rating = Number(stats?.averageRating ?? profile?.rating ?? 0);
  const [available, setAvailable] = useState<boolean>(stats?.isAvailable ?? true);

  const availabilityMut = useMutation({
    mutationFn: async (next: boolean) => {
      const r = await fetch(getApiUrl('/api/provider-dashboard/availability'), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, isAvailable: next }),
      });
      if (!r.ok) throw new Error('availability_failed');
      return next;
    },
    onSuccess: (next) => { setAvailable(next); queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/stats'] }); },
  });

  const thisMonth = Number(earn?.thisMonthEarnings ?? 0);
  const lastMonth = Number(earn?.lastMonthEarnings ?? 0);
  const thisWeek = Number(earn?.thisWeekEarnings ?? stats?.thisWeekEarnings ?? 0);
  const pending = Number(earn?.pendingPayouts ?? stats?.pendingPayouts ?? 0);
  const monthChange = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const platforms = [
    { id: 'all', label: isHe ? 'הכל' : 'All', icon: Briefcase },
    { id: 'petsitter', label: 'PetSitter', icon: Dog },
    { id: 'walkpet', label: 'Walk My Pet', icon: Footprints },
    { id: 'academy', label: 'Academy', icon: GraduationCap },
    { id: 'pettrek', label: 'PetTrek', icon: Mountain, soon: true },
  ];
  const [activePlatform, setActivePlatform] = useState('all');

  const tools = [
    { label: isHe ? 'עבודות' : 'My Jobs', icon: Briefcase, to: '/provider-os?m=jobs' },
    { label: isHe ? 'יומן' : 'Calendar', icon: CalendarDays, to: '/provider-os?m=calendar' },
    { label: isHe ? 'הכנסות' : 'Earnings', icon: DollarSign, to: '/provider/earnings' },
    { label: isHe ? 'משימות' : 'Tasks', icon: ClipboardList, to: '/provider/tasks' },
    { label: isHe ? 'מסמכים' : 'Documents', icon: FileText, to: '/provider-os?m=documents' },
    { label: isHe ? 'ארנק' : 'Wallet', icon: WalletIcon, to: '/provider-os?m=wallet' },
    { label: isHe ? 'ציות' : 'Compliance', icon: ShieldCheck, to: '/provider-compliance' },
    { label: isHe ? 'פרופיל' : 'Profile', icon: User, to: '/provider-os?m=profile' },
    { label: isHe ? 'דיווח אירוע' : 'Incident', icon: AlertCircle, to: '/provider/incident' },
    { label: isHe ? 'תמיכה' : 'Support', icon: LifeBuoy, to: '/support' },
  ];

  const statTiles = [
    { label: isHe ? 'עבודות פעילות' : 'Active jobs', value: String(stats?.activeBookings ?? 0), icon: Briefcase, color: GOLD },
    { label: isHe ? 'דירוג' : 'Rating', value: rating ? rating.toFixed(1) : '—', icon: Star, color: GOLD },
    { label: isHe ? 'השלמה' : 'Completion', value: `${stats?.completionRate ?? 0}%`, icon: CheckCircle2, color: '#3aa655' },
    { label: isHe ? 'השבוע' : 'This week', value: nis(thisWeek), icon: TrendingUp, color: '#3a7bd5' },
  ];

  const platformLabel = (t?: string) => {
    const s = (t || '').toLowerCase();
    if (s.includes('walk')) return 'Walk My Pet';
    if (s.includes('sit')) return 'Pet Sitter';
    if (s.includes('academy') || s.includes('train')) return 'Academy';
    if (s.includes('trek')) return 'PetTrek';
    return t || (isHe ? 'שירות' : 'Service');
  };
  // Drop any wash from provider upcoming (provider never does wash).
  const jobs = upcoming.filter((j: any) => !String(j.serviceType ?? j.service_type ?? '').toLowerCase().includes('wash')).slice(0, 6);

  return (
    <div className="min-h-[100dvh] bg-white" dir={isHe ? 'rtl' : 'ltr'} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-md mx-auto pb-28">

        {/* Header: real logo crown */}
        <header className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="w-20" />
            <div className="flex flex-col items-center">
              <img src="/brand/petwash-logo-official.png" alt="PetWash" className="h-7 object-contain" loading="eager" />
              <span className="text-[9px] tracking-[0.3em] text-[#9a8a5c] mt-0.5">PROVIDER</span>
            </div>
            <div className="w-20 flex items-center justify-end gap-3">
              <button onClick={() => navigate('/notifications')} className="text-gray-700" aria-label="Notifications"><Bell className="w-5 h-5" /></button>
              <button onClick={() => navigate('/inbox')} className="text-gray-700" aria-label="Messages"><MessageCircle className="w-5 h-5" /></button>
              <button onClick={() => navigate('/provider-os?m=profile')} className="w-8 h-8 rounded-full bg-[#FBF6E7] border border-[#ECDFB4] flex items-center justify-center text-[#9a7d2e] text-xs font-semibold" aria-label="Profile">
                {name.charAt(0).toUpperCase()}
              </button>
            </div>
          </div>
        </header>

        {/* Application status — only while the application is NOT approved */}
        {showApplicationCard && (
          <section className="px-4 pt-1 pb-2">
            <button onClick={() => navigate('/provider-application/status')} className="w-full text-left rounded-2xl border border-[#E7D38f] bg-[#FFFDF7] p-4 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 shrink-0" style={{ color: GOLD }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{isHe ? 'הבקשה שלך בבדיקה' : 'Your application is in review'}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {isHe ? 'סטטוס: ' : 'Status: '}<span className="font-medium">{String(appStatus).replace(/_/g, ' ')}</span>
                  {isHe ? ' · השלימו מסמכים חסרים כדי לזרז את האישור.' : ' · complete any missing documents to speed up approval.'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          </section>
        )}

        {/* Pending job requests — spec §B home item; tap = triage them */}
        {newRequests > 0 && (
          <section className="px-4 pt-1 pb-1">
            <button onClick={() => navigate('/provider-os?m=jobs')} className="w-full text-left rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #FFFDF7, #FBF3DA)', border: `1px solid ${GOLD}` }}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: GOLD }}>{newRequests}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{isHe ? 'בקשות עבודה חדשות ממתינות לך' : 'New job requests waiting for you'}</p>
                <p className="text-[11px] text-gray-600">{isHe ? 'מענה מהיר מעלה את הדירוג שלך.' : 'Fast responses lift your ranking.'}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          </section>
        )}

        {/* Greeting + provider ID card (metallic green) */}
        <section className="px-4 pt-1">
          <p className="text-xl text-gray-500">{isHe ? 'שלום,' : 'Welcome back,'}</p>
          <h1 className="text-3xl font-semibold text-emerald-800 leading-tight">{name} 👋</h1>

          <div className="mt-4 rounded-3xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(140deg, #0c6b48 0%, #1aa86f 48%, #0e7a54 100%)', border: `1px solid ${GOLD}77` }}>
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <img src="/brand/petwash-logo-white.png" alt="PetWash" className="h-6 object-contain self-start" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                <span className="text-[9px] tracking-[0.3em] mt-1" style={{ color: GOLD }}>PROVIDER</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: '#ffffff22', color: '#fff' }}>
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: GOLD }} /> {isHe ? 'מאומת' : 'Verified'}
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-white text-lg font-semibold leading-tight">{name}</p>
                <p className="text-white/70 text-xs mt-0.5">{profile?.providerType || profile?.serviceType || (isHe ? 'ספק שירות' : 'Service Provider')}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <Star className="w-4 h-4" style={{ color: GOLD }} />
                  <span className="text-white text-sm font-medium">{rating ? rating.toFixed(1) : '—'}</span>
                  <span className="text-white/60 text-[11px]">· {stats?.completedBookings ?? 0} {isHe ? 'עבודות' : 'jobs'}</span>
                </div>
              </div>
              <button
                onClick={() => providerId && availabilityMut.mutate(!available)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: available ? '#ffffff' : '#ffffff22', color: available ? '#0e7a54' : '#fff' }}
              >
                <Power className="w-3.5 h-3.5" /> {available ? (isHe ? 'זמין' : 'Available') : (isHe ? 'לא זמין' : 'Offline')}
              </button>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="px-4 mt-4">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {statTiles.map((st) => {
              const Icon = st.icon;
              return (
                <div key={st.label} className="min-w-[112px] flex-1 rounded-2xl border border-gray-100 shadow-sm p-3">
                  <Icon className="w-5 h-5 mb-1" style={{ color: st.color }} />
                  <div className="text-lg font-semibold text-gray-900 leading-none">{st.value}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{st.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Platform filter */}
        <section className="px-4 mt-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {platforms.map((p) => {
              const Icon = p.icon;
              if (p.soon) return (
                <span key={p.id} className="shrink-0 inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 text-gray-400 px-3 py-1 text-xs"><Icon className="w-3.5 h-3.5" />{p.label}<span className="text-[9px]">· {isHe ? 'בקרוב' : 'soon'}</span></span>
              );
              const on = activePlatform === p.id;
              return (
                <button key={p.id} onClick={() => setActivePlatform(p.id)} className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium" style={on ? { background: GOLD, color: '#fff' } : { background: '#fff', color: '#555', border: '1px solid #eee' }}>
                  <Icon className="w-3.5 h-3.5" />{p.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Provider tools */}
        <section className="px-4 mt-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">{isHe ? 'כלים' : 'Quick Tools'}</h2>
          <div className="grid grid-cols-4 gap-y-4 gap-x-2">
            {tools.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.label} onClick={() => navigate(t.to)} className="flex flex-col items-center gap-1.5 group">
                  <span className="w-14 h-14 rounded-2xl flex items-center justify-center border border-[#F0E9D4] bg-[#FFFDF7] group-active:scale-95 transition-transform">
                    <Icon className="w-6 h-6" style={{ color: GOLD }} />
                  </span>
                  <span className="text-[10.5px] text-center leading-tight text-gray-700">{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Provider tip */}
        <section className="px-4 mt-5">
          <div className="rounded-2xl border border-[#F0E9D4] bg-[#FFFDF7] p-4 flex items-start gap-3">
            <TrendingUp className="w-6 h-6 shrink-0" style={{ color: GOLD }} />
            <div>
              <p className="text-sm font-semibold text-gray-900">{isHe ? 'טיפ לדירוג גבוה' : 'Boost your ranking'}</p>
              <p className="text-xs text-gray-600 mt-0.5">{isHe ? 'מענה מהיר לבקשות ושמירה על זמינות מעלים את הדירוג ואת מספר העבודות.' : 'Respond fast to new requests and keep your availability on — it lifts your ranking and job volume.'}</p>
            </div>
          </div>
        </section>

        {/* Upcoming jobs */}
        <section className="px-4 mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">{isHe ? 'העבודות הקרובות שלי' : 'My Upcoming Jobs'}</h2>
            <button onClick={() => navigate('/provider-os?m=jobs')} className="text-xs font-medium" style={{ color: GOLD }}>{isHe ? 'הצג הכל' : 'View all'}</button>
          </div>
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">{isHe ? 'אין עבודות קרובות' : 'No upcoming jobs'}</div>
          ) : (
            <div className="space-y-3">
              {jobs.map((j: any, i: number) => {
                const time = j.time || j.scheduledTime || (j.scheduledAt ? new Date(j.scheduledAt).toLocaleTimeString('en-IL', { hour: '2-digit', minute: '2-digit' }) : '');
                const pet = j.petName || j.pet || '';
                const who = j.customerName || j.customer || '';
                const dist = j.distanceKm ?? j.distance;
                const addr = j.address || j.city || '';
                const reqId = j.requestId || j.request_id || j.id;
                return (
                  <div key={reqId ?? i} className="rounded-2xl border border-gray-100 shadow-sm p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {time && <span className="text-xs font-semibold text-emerald-700">{time}</span>}
                          <span className="text-[10px] rounded-full bg-[#FBF3DA] text-[#9a7d2e] px-2 py-0.5 border border-[#E7D38f]">{platformLabel(j.serviceType ?? j.service_type)}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{[pet, who].filter(Boolean).join(' · ') || (isHe ? 'עבודה' : 'Job')}</p>
                        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          {addr && <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{addr}</span>}
                          {dist != null && <span className="inline-flex items-center gap-0.5"><Navigation className="w-3 h-3" />{Number(dist).toFixed(1)} {isHe ? 'ק״מ' : 'km'}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => navigate(reqId ? `/provider/jobs/${reqId}` : '/provider-os?m=jobs')} className="flex-1 text-center text-xs font-medium border border-gray-200 rounded-lg py-2 text-gray-700">{isHe ? 'פרטים' : 'Details'}</button>
                      <button onClick={() => navigate(reqId ? `/provider/jobs/${reqId}` : '/provider-os?m=jobs')} className="flex-1 text-center text-xs font-medium rounded-lg py-2 text-white" style={{ background: '#0e7a54' }}>{isHe ? 'התחל' : 'Start'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Monthly earnings */}
        <section className="px-4 mt-5">
          <button onClick={() => navigate('/provider/earnings')} className="w-full text-left rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{isHe ? 'סקירת חודש' : 'This Month'}</p>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
            <div className="flex items-end gap-3 mt-1">
              <span className="text-2xl font-semibold text-gray-900">{nis(thisMonth)}</span>
              {monthChange != null && (
                <span className={`text-xs font-medium ${monthChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{monthChange >= 0 ? '+' : ''}{monthChange}% {isHe ? 'מהחודש שעבר' : 'vs last month'}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
              <div><div className="text-[10px] text-gray-400">{isHe ? 'השבוע' : 'This week'}</div><div className="text-sm font-semibold text-gray-900">{nis(thisWeek)}</div></div>
              <div><div className="text-[10px] text-gray-400">{isHe ? 'ממתין' : 'Pending'}</div><div className="text-sm font-semibold text-gray-900">{nis(pending)}</div></div>
              <div><div className="text-[10px] text-gray-400">{isHe ? 'עבודות' : 'Jobs'}</div><div className="text-sm font-semibold text-gray-900">{earn?.completedCount ?? stats?.completedBookings ?? 0}</div></div>
            </div>
          </button>
        </section>

        {/* Document / compliance status */}
        <section className="px-4 mt-5">
          <button onClick={() => navigate('/provider-compliance')} className="w-full text-left rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" style={{ color: GOLD }} />
                <p className="text-sm font-semibold text-gray-900">{isHe ? 'סטטוס מסמכים וציות' : 'Documents & Compliance'}</p>
              </div>
              <span className="text-xs font-medium" style={{ color: GOLD }}>{isHe ? 'הצג' : 'View'}</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{isHe ? 'תעודות, ביטוח אחריות, אישורי מס ורישוי — נדרשים לקבלת תשלומים.' : 'Certificates, liability insurance, tax & licensing — required to receive payouts.'}</p>
          </button>
        </section>
      </div>

      {/* Bottom tabs (Jobs · Calendar | Home | Earnings · Compliance · Account)
          are the PERSISTENT app-shell ProviderTabsBar rendered by
          MobileBottomNav — extracted from this page so the work tabs follow
          the provider on every screen (CEO 2026-06-23 spec tabs). */}
    </div>
  );
}
