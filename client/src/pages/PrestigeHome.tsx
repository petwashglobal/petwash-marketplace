/**
 * PrestigeHome — the luxury CUSTOMER (Prestige) app home.
 *
 * Built to the CEO's 2026-06-24 design: pure white + black + bright metallic gold
 * (#D4AF37), real PetWash logo as the top-center crown, a dark-emerald/gold
 * membership card with a live QR, a stats strip, a quick-actions grid, care tip,
 * pets, rewards, recommended, and an elevated center "QR / Card" redeem button.
 *
 * RULES honoured:
 *   - No fake data: every number reads from a real endpoint; missing data renders
 *     as 0 / — / an honest empty state (never invented).
 *   - Currency is ₪ (Israel), VAT-inclusive amounts as stored.
 *   - The K9000 wash is REDEEM-by-QR (not bookable): "Book Wash" + the center
 *     QR/Card button open the redeem/stations flow, not a booking engine.
 *   - Dark rollout: routed at /prestige/home; does not replace the entry yet.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { PetWashLogo } from '@/components/brand/PetWashLogo';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest } from '@/lib/queryClient';
import {
  Bell, MessageCircle, Crown, Copy, Check, Sun, ChevronRight, QrCode,
  CalendarDays, ShoppingBag, Wallet as WalletIcon,
  Droplets, Dog, Footprints, Gift, CreditCard, GraduationCap, PawPrint, Mountain,
  Star, Award, Receipt,
} from 'lucide-react';

const GOLD = '#D4AF37';

function ils(cents: number | null | undefined): string {
  const n = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return `₪${(n / 100).toLocaleString('en-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PrestigeSummary {
  displayName?: string;
  tier?: string;
  memberId?: string;
  washCredits?: number;
  pointsBalance?: number;
  cashCents?: number;
  giftCents?: number;
  giftCount?: number;
  rewardsCount?: number;
  nextBooking?: { date?: string; time?: string } | null;
}

/** Defensive: the real endpoints return slightly different field names across
 *  versions — read every plausible key so the UI shows real data, not blanks. */
function normalizeSummary(me: any, sum: any): PrestigeSummary {
  const g = (...keys: [any, string][]) => {
    for (const [obj, k] of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  };
  return {
    displayName: g([me, 'displayName'], [me, 'name'], [me, 'firstName']),
    tier: g([me, 'tier'], [me, 'loyaltyTier'], [sum, 'tier']) ?? 'Member',
    memberId: g([me, 'memberId'], [me, 'passId'], [me, 'passNumber'], [sum, 'memberId']),
    washCredits: Number(g([sum, 'washCredits'], [sum, 'washPackageCredits'], [me, 'washCredits']) ?? 0),
    pointsBalance: Number(g([sum, 'pointsBalance'], [sum, 'loyaltyPointsBalance'], [me, 'points'], [me, 'pointsBalance']) ?? 0),
    cashCents: Number(g([sum, 'cashCents'], [sum, 'cashWalletBalanceCents'], [sum, 'walletBalanceCents']) ?? 0),
    giftCents: Number(g([sum, 'giftCents'], [sum, 'egiftBalanceCents'], [sum, 'giftBalanceCents']) ?? 0),
    giftCount: Number(g([sum, 'giftCount'], [sum, 'giftCardCount']) ?? 0),
    rewardsCount: Number(g([sum, 'rewardsCount'], [sum, 'rewards']) ?? 0),
    nextBooking: g([sum, 'nextBooking'], [me, 'nextBooking']) ?? null,
  };
}

export default function PrestigeHome() {
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Phase 3: a campaign push/SMS/email deep-links here as
  // /prestige/home?campaign=<key>&code=<theUserCode>. Surface a premium banner
  // and stash the code so the next checkout/redeem auto-applies it.
  const [offer, setOffer] = useState<{ campaign: string; code: string } | null>(null);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const code = p.get('code');
      const campaign = p.get('campaign') || 'offer';
      if (code) {
        setOffer({ campaign, code });
        localStorage.setItem('pw_pending_coupon', code); // checkout/redeem reads this
      }
    } catch { /* noop */ }
  }, []);

  const { data: me } = useQuery({
    queryKey: ['/api/prestige-pass/me'],
    queryFn: async () => {
      // apiRequest attaches the Firebase Bearer token; a raw credentials fetch
      // sends no auth (no pw_session cookie), so these returned empty for every
      // real user and the dashboard showed blank stats/pets.
      try {
        const r = await apiRequest('GET', '/api/prestige-pass/me');
        return r.ok ? await r.json() : {};
      } catch { return {}; }
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // /api/prestige-pass/summary NEVER existed server-side — this polled a
  // silent 404 on every home load since the page shipped (cleanup flagged in
  // the 07-22 audit, removed 2026-07-24). /me carries every balance the
  // normalizer reads; `sum` stays as an always-null fallback slot.
  const sum = null;

  const { data: petsData } = useQuery({
    queryKey: ['/api/pets'],
    queryFn: async () => {
      try {
        const r = await apiRequest('GET', '/api/pets');
        return r.ok ? await r.json() : { pets: [] };
      } catch { return { pets: [] }; }
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Live, short-lived QR token for the membership card (same rail the kiosk reads).
  const { data: qr } = useQuery({
    queryKey: ['/api/prestige-pass/token/generate'],
    queryFn: async () => {
      try {
        const r = await apiRequest('POST', '/api/prestige-pass/token/generate', {});
        return r.ok ? r.json() : {};
      } catch { return {}; }
    },
    enabled: !!user,
    staleTime: 90_000,
    refetchInterval: 110_000,
  });

  // Latest wallet/receipt activity — real ledger events, newest first.
  const { data: hist } = useQuery({
    queryKey: ['/api/prestige-pass/history'],
    queryFn: async () => {
      try {
        const r = await apiRequest('GET', '/api/prestige-pass/history');
        return r.ok ? await r.json() : {};
      } catch { return {}; }
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const s = normalizeSummary(me, sum);
  const lastEvent: any = Array.isArray(hist?.events) && hist.events.length > 0 ? hist.events[0] : null;
  const pets: any[] = Array.isArray(petsData?.pets) ? petsData.pets : Array.isArray(petsData) ? petsData : [];
  const firstName = s.displayName || user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || (isHe ? 'חבר' : 'Member');

  // Personal warmth — a time-aware greeting that changes through the day, so the
  // home feels alive and addressed to *this* member, not a static banner.
  const _hour = new Date().getHours();
  const greeting = isHe
    ? (_hour < 12 ? 'בוקר טוב' : _hour < 18 ? 'צהריים טובים' : 'ערב טוב')
    : (_hour < 12 ? 'Good morning' : _hour < 18 ? 'Good afternoon' : 'Good evening');
  // Pet-aware subline — naming their companion is the single most personal touch.
  const _petNames: string[] = pets.map((p: any) => p?.name).filter(Boolean);
  const petLine =
    _petNames.length === 0
      ? (isHe ? 'מוכנים לפנק חבר חדש? הוסיפו את החיה שלכם 🐾' : 'Ready to pamper someone special? Add your pet 🐾')
      : _petNames.length === 1
        ? (isHe ? `${_petNames[0]} מוכן/ה לפינוק הבא ✨` : `${_petNames[0]} is ready for the next pamper ✨`)
        : (isHe ? `${_petNames.slice(0, 2).join(' ו')} מחכים לפינוק הבא ✨` : `${_petNames.slice(0, 2).join(' & ')} are ready for the next pamper ✨`);

  const qrToken: string | undefined = qr?.token || qr?.qrToken || qr?.value;
  const memberId = s.memberId || '—';

  const copyMemberId = async () => {
    try { await navigator.clipboard.writeText(memberId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const actions: { label: string; labelHe: string; icon: any; to: string; soon?: boolean }[] = [
    { label: 'Book Wash',     labelHe: 'שטיפה',    icon: Droplets,      to: '/stations' },
    { label: 'Pet Sitter',    labelHe: 'Pet Sitter',  icon: Dog,           to: '/sitter-suite' },
    { label: 'Walk My Pet',   labelHe: 'Walk My Pet',   icon: Footprints,    to: '/walk-my-pet' },
    { label: 'PetWash Shop',  labelHe: 'PetWash Shop',     icon: ShoppingBag,   to: '/shop' },
    { label: 'Send a Gift',   labelHe: 'שליחת מתנה', icon: Gift,        to: '/buy-gift-card' },
    { label: 'Buy Package',   labelHe: 'רכישת חבילה', icon: CreditCard, to: '/packages' },
    { label: 'Wallet Top Up', labelHe: 'טעינת ארנק', icon: WalletIcon,  to: '/my-wallet' },
    { label: 'Academy',       labelHe: 'Academy',   icon: GraduationCap, to: '/academy' },
    { label: 'My Pets',       labelHe: 'החיות שלי', icon: PawPrint,     to: '/pets' },
    { label: 'PetTrek',       labelHe: 'PetTrek',  icon: Mountain,      to: '#', soon: true },
  ];

  const stats = [
    { label: isHe ? 'קרדיט שטיפות' : 'Wash Credits', value: String(s.washCredits ?? 0), sub: isHe ? 'זמין' : 'Available', icon: Droplets, color: GOLD },
    { label: isHe ? 'נקודות Prestige' : 'Prestige Points', value: String(s.pointsBalance ?? 0), sub: isHe ? 'הטבות' : 'Benefits', icon: Star, color: GOLD },
    { label: isHe ? 'יתרת ארנק' : 'Wallet', value: ils(s.cashCents), sub: isHe ? 'טעינה' : 'Top up', icon: WalletIcon, color: GOLD },
    { label: isHe ? 'יתרת מתנות' : 'Gift Balance', value: ils(s.giftCents), sub: `${s.giftCount ?? 0} ${isHe ? 'כרטיסים' : 'cards'}`, icon: Gift, color: GOLD },
  ];

  return (
    <div className="min-h-[100dvh] bg-white" dir={isHe ? 'rtl' : 'ltr'} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-md mx-auto pb-28">

        {/* Header: real logo crown */}
        <header className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="w-20" />
            <div className="flex flex-col items-center">
              <PetWashLogo size={44} priority />
              <span className="text-[9px] tracking-[0.3em] text-[#9a8a5c] mt-0.5">PRESTIGE</span>
            </div>
            <div className="w-20 flex items-center justify-end gap-3">
              <button onClick={() => navigate('/notifications')} className="relative text-gray-700" aria-label="Notifications">
                <Bell className="w-5 h-5" />
              </button>
              <button onClick={() => navigate('/inbox')} className="text-gray-700" aria-label="Messages">
                <MessageCircle className="w-5 h-5" />
              </button>
              <button onClick={() => navigate('/my-account')} className="w-8 h-8 rounded-full bg-[#FBF6E7] border border-[#ECDFB4] flex items-center justify-center text-[#9a7d2e] text-xs font-semibold" aria-label="Account">
                {firstName.charAt(0).toUpperCase()}
              </button>
            </div>
          </div>
        </header>

        {/* Phase 3: campaign offer banner — the user's own code, ready to use */}
        {offer && (
          <section className="px-4 pt-1">
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #FFFDF7, #FBF3DA)', border: `1px solid ${GOLD}` }}>
              <Gift className="w-7 h-7 shrink-0" style={{ color: GOLD }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{isHe ? 'הטבה אישית מחכה לך 🎁' : 'A gift is waiting for you 🎁'}</p>
                <p className="text-xs text-gray-600">{isHe ? 'הקוד האישי שלך (לא ניתן לשיתוף):' : 'Your personal code (not shareable):'}</p>
                <button
                  onClick={async () => { try { await navigator.clipboard.writeText(offer.code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500); } catch { /* noop */ } }}
                  className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-[#9a7d2e] bg-white border border-[#ECDFB4] rounded-lg px-2.5 py-1"
                >
                  {offer.code}
                  {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 opacity-60" />}
                </button>
              </div>
              <button onClick={() => setOffer(null)} className="text-gray-400 text-lg leading-none px-1" aria-label="Dismiss">×</button>
            </div>
          </section>
        )}

        {/* Greeting + membership card */}
        <section className="px-4 pt-1">
          <p className="text-xl text-gray-500">{greeting},</p>
          <h1 className="text-3xl font-semibold text-emerald-800 leading-tight">{firstName} 👋</h1>
          <p className="text-sm text-gray-400 mt-1">{petLine}</p>
          <button
            onClick={() => navigate('/prestige-club')}
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#ECDFB4] bg-[#FFFDF7] px-3 py-1.5"
          >
            <Crown className="w-4 h-4" style={{ color: GOLD }} />
            <span className="text-sm font-medium text-[#9a7d2e]">{isHe ? `חבר ${s.tier}` : `Prestige ${s.tier} Member`}</span>
            <ChevronRight className="w-4 h-4 text-[#c9b88a]" />
          </button>

          {/* Membership card — dark emerald + gold, live QR */}
          <div className="mt-4 rounded-3xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(140deg, #0c6b48 0%, #1aa86f 48%, #0e7a54 100%)', border: `1px solid ${GOLD}77` }}>
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <PetWashLogo variant="white" size={24} className="self-start" />
                <span className="text-[9px] tracking-[0.3em] mt-1" style={{ color: GOLD }}>PRESTIGE</span>
              </div>
              <Crown className="w-5 h-5" style={{ color: GOLD }} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="bg-white rounded-xl p-2.5">
                {qrToken ? (
                  <QRCodeSVG value={qrToken} size={104} level="M" includeMargin={false} />
                ) : (
                  <div className="w-[104px] h-[104px] flex items-center justify-center text-gray-300"><QrCode className="w-10 h-10" /></div>
                )}
              </div>
              <div className="text-right flex-1">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: `${GOLD}cc` }}>{isHe ? 'מספר חבר' : 'Member ID'}</p>
                <button onClick={copyMemberId} className="inline-flex items-center gap-1.5 text-white font-mono text-sm mt-0.5">
                  {memberId}
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5 opacity-70" />}
                </button>
                <p className="text-[10px] text-white/50 mt-2">{isHe ? 'הצג/י בעמדה למימוש' : 'Show at the bay to redeem'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="px-4 mt-4">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {stats.map((st) => {
              const Icon = st.icon;
              return (
                <div key={st.label} className="min-w-[112px] flex-1 rounded-2xl border border-gray-100 shadow-sm p-3">
                  <Icon className="w-5 h-5 mb-1" style={{ color: st.color }} />
                  <div className="text-lg font-semibold text-gray-900 leading-none">{st.value}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{st.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: GOLD }}>{st.sub}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Next booking — real data from the summary; hidden when none (the
            quick-actions grid below is the booking entry point). */}
        {s.nextBooking && (s.nextBooking.date || s.nextBooking.time) && (
          <section className="px-4 mt-4">
            <button onClick={() => navigate('/bookings')} className="w-full text-left rounded-2xl border border-[#F0E9D4] bg-[#FFFDF7] p-4 flex items-center gap-3">
              <CalendarDays className="w-6 h-6 shrink-0" style={{ color: GOLD }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{isHe ? 'ההזמנה הבאה שלך' : 'Your Next Booking'}</p>
                <p className="text-xs text-gray-600 mt-0.5 truncate">
                  {[s.nextBooking.date, s.nextBooking.time].filter(Boolean).join(' · ')}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          </section>
        )}

        {/* Quick actions */}
        <section className="px-4 mt-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">{isHe ? 'פעולות מהירות' : 'Quick Actions'}</h2>
          <div className="grid grid-cols-4 gap-y-4 gap-x-2">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  onClick={() => !a.soon && navigate(a.to)}
                  disabled={a.soon}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <span className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${a.soon ? 'border-dashed border-gray-200 bg-gray-50' : 'border-[#F0E9D4] bg-[#FFFDF7] group-active:scale-95'} transition-transform`}>
                    <Icon className="w-6 h-6" style={{ color: a.soon ? '#bbb' : GOLD }} />
                  </span>
                  <span className={`text-[10.5px] text-center leading-tight ${a.soon ? 'text-gray-400' : 'text-gray-700'}`}>
                    {isHe ? a.labelHe : a.label}
                    {a.soon && <span className="block text-[8.5px] text-gray-400">{isHe ? 'בקרוב' : 'Soon'}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Today's care tip (real safety tip — no fabricated weather) */}
        <section className="px-4 mt-5">
          <div className="rounded-2xl border border-[#F0E9D4] bg-[#FFFDF7] p-4 flex items-start gap-3">
            <Sun className="w-6 h-6 shrink-0" style={{ color: GOLD }} />
            <div>
              <p className="text-sm font-semibold text-gray-900">{isHe ? 'טיפ הטיפוח היומי' : "Today's Care Tip"}</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {isHe
                  ? 'בימים חמים — טיילו בבוקר או בערב ובדקו את חום המדרכה לפני שיוצאים.'
                  : 'On hot days, walk your dog in the morning or evening and check the pavement temperature before heading out.'}
              </p>
            </div>
          </div>
        </section>

        {/* Your pets */}
        <section className="px-4 mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">{isHe ? 'החיות שלי' : 'Your Pets'}</h2>
            <button onClick={() => navigate('/pets')} className="text-xs font-medium" style={{ color: GOLD }}>{isHe ? 'הצג הכל' : 'View all'}</button>
          </div>
          {pets.length === 0 ? (
            <button onClick={() => navigate('/pets')} className="w-full rounded-2xl border border-dashed border-gray-200 p-5 text-center">
              <PawPrint className="w-6 h-6 mx-auto mb-1" style={{ color: GOLD }} />
              <p className="text-sm text-gray-600">{isHe ? 'הוסיפו את החיה הראשונה שלכם' : 'Add your first pet'}</p>
            </button>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {pets.slice(0, 6).map((p: any, i: number) => (
                <div key={p.id ?? i} className="min-w-[150px] rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#FBF6E7] border border-[#ECDFB4] flex items-center justify-center overflow-hidden">
                    {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" /> : <Dog className="w-5 h-5 text-[#9a7d2e]" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name ?? '—'}</p>
                    <p className="text-[11px] text-gray-500 truncate">{p.breed ?? p.species ?? ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Rewards & wallet */}
        <section className="px-4 mt-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">{isHe ? 'הטבות וארנק' : 'Rewards & Wallet'}</h2>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => navigate('/loyalty/dashboard')} className="rounded-2xl border border-gray-100 shadow-sm p-3 text-left">
              <Award className="w-5 h-5 mb-1" style={{ color: GOLD }} />
              <div className="text-base font-semibold text-gray-900">{s.pointsBalance ?? 0}</div>
              <div className="text-[10.5px] text-gray-500">{isHe ? 'נקודות' : 'Points'}</div>
            </button>
            <button onClick={() => navigate('/my-wallet')} className="rounded-2xl border border-gray-100 shadow-sm p-3 text-left">
              <WalletIcon className="w-5 h-5 mb-1 text-[#e0607e]" />
              <div className="text-base font-semibold text-gray-900">{ils(s.cashCents)}</div>
              <div className="text-[10.5px] text-gray-500">{isHe ? 'ארנק' : 'Wallet'}</div>
            </button>
            <button onClick={() => navigate('/loyalty/dashboard')} className="rounded-2xl border border-gray-100 shadow-sm p-3 text-left">
              <Gift className="w-5 h-5 mb-1 text-emerald-600" />
              <div className="text-base font-semibold text-gray-900">{s.rewardsCount ?? 0}</div>
              <div className="text-[10.5px] text-gray-500">{isHe ? 'הטבות' : 'Rewards'}</div>
            </button>
          </div>
        </section>

        {/* Recommended */}
        <section className="px-4 mt-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">{isHe ? 'מומלצים עבורך' : 'Recommended For You'}</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { t: isHe ? 'חבילת 5 שטיפות' : '5 Wash Package', s: isHe ? 'חיסכון משתלם' : 'Save more', cta: isHe ? 'רכישה' : 'Buy Now', to: '/packages', icon: Droplets },
              { t: isHe ? 'מתנת שטיפה' : 'Gift a Wash', s: isHe ? 'שתפו דאגה' : 'Share the care', cta: isHe ? 'שליחה' : 'Send Gift', to: '/buy-gift-card', icon: Gift },
              { t: isHe ? 'מוצרי החנות' : 'Shop Bestsellers', s: isHe ? 'הנבחרים' : 'Top picks', cta: isHe ? 'לחנות' : 'Shop Now', to: '/shop', icon: ShoppingBag },
              { t: isHe ? 'קורסי אקדמיה' : 'Academy Courses', s: isHe ? 'למדו וטפחו' : 'Learn. Care.', cta: isHe ? 'גילוי' : 'Explore', to: '/academy', icon: GraduationCap },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <button key={c.t} onClick={() => navigate(c.to)} className="rounded-2xl border border-gray-100 shadow-sm p-3 text-left">
                  <Icon className="w-5 h-5 mb-2" style={{ color: GOLD }} />
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{c.t}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{c.s}</p>
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium mt-2" style={{ color: GOLD }}>{c.cta}<ChevronRight className="w-3 h-3" /></span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Latest activity / receipt — newest real ledger event; honest empty state */}
        <section className="px-4 mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">{isHe ? 'פעילות אחרונה' : 'Latest Activity'}</h2>
            <button onClick={() => navigate('/my-wallet')} className="text-xs font-medium" style={{ color: GOLD }}>{isHe ? 'הצג הכל' : 'View all'}</button>
          </div>
          {lastEvent ? (
            <button
              onClick={() => navigate(lastEvent.transactionId ? `/receipt/${lastEvent.transactionId}` : '/my-wallet')}
              className="w-full text-left rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
            >
              <span className="w-10 h-10 rounded-full bg-[#FBF6E7] border border-[#ECDFB4] flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" style={{ color: GOLD }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {String(lastEvent.description ?? lastEvent.transactionType ?? lastEvent.creditType ?? (isHe ? 'תנועה' : 'Transaction')).replace(/_/g, ' ')}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {lastEvent.createdAt ? new Date(lastEvent.createdAt).toLocaleDateString(isHe ? 'he-IL' : 'en-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </p>
              </div>
              {typeof lastEvent.amountCents === 'number' && (
                <span className={`text-sm font-semibold shrink-0 ${lastEvent.amountCents < 0 ? 'text-gray-900' : 'text-emerald-700'}`}>
                  {lastEvent.amountCents < 0 ? '−' : '+'}{ils(Math.abs(lastEvent.amountCents))}
                </span>
              )}
            </button>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
              {isHe ? 'אין עדיין פעילות — הקבלות והתנועות שלך יופיעו כאן.' : 'No activity yet — your receipts and transactions will appear here.'}
            </div>
          )}
        </section>
      </div>

      {/* Bottom tabs (Home · Book · Shop | QR | Wallet · Account) are the
          PERSISTENT app-shell PrestigeTabsBar rendered by MobileBottomNav —
          extracted from this page so the tabs follow the member on every
          screen (CEO 2026-06-23 spec: a real app, not a one-page nav). */}
    </div>
  );
}
