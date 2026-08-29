/**
 * FlavorBottomNav — the PERSISTENT bottom tab bars for the two native apps.
 *
 * CEO spec (2026-06-23 "NOT WEBSITE WRAPPERS") — each app has its own tabs:
 *   Prestige (customer): Home · Book · Shop · Wallet · Account  + elevated center QR/Card
 *   Provider (work):     Jobs · Calendar · Earnings · Compliance · Account + elevated center Home
 *
 * Visual pattern = the approved 2026-06-24 mockup (white bar, gold active state,
 * elevated round center button, safe-area padding). These bars were previously
 * inline in PrestigeHome/ProviderHome and only visible on the home screens —
 * extracting them here makes the tabs persist across every non-immersive screen,
 * which is what "a real app, not a website" requires.
 *
 * Rendered by MobileBottomNav when the bundle runs as a native app flavor
 * (or when previewing /prestige/* · /provider/* surfaces on the web).
 */
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Home as HomeIcon, CalendarDays, ShoppingBag, Wallet as WalletIcon, User,
  QrCode, Briefcase, DollarSign, ShieldCheck,
} from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { getApiUrl } from '@/lib/apiConfig';

const GOLD = '#D4AF37';
const GRAY = '#9ca3af';

function TabBtn({ icon: Icon, label, active, badge, onClick }: {
  icon: any; label: string; active?: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center gap-0.5 relative min-w-0">
      <span className="relative">
        <Icon className="w-5 h-5" style={{ color: active ? GOLD : GRAY }} />
        {badge ? (
          <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span className="text-[9.5px] leading-none truncate max-w-full" style={{ color: active ? GOLD : GRAY }}>{label}</span>
    </button>
  );
}

function BarShell({ children, center }: { children: React.ReactNode; center: React.ReactNode }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md mx-auto relative flex items-stretch justify-between h-16 px-1">
        {children}
        {center}
      </div>
    </nav>
  );
}

/** Customer (Prestige) tabs: Home · Book · Shop | QR | Wallet · Account */
export function PrestigeTabsBar() {
  const [path, navigate] = useLocation();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const is = (p: string) => path === p || path.startsWith(p + '/');

  return (
    <BarShell
      center={
        <button
          onClick={() => navigate('/prestige-pass')}
          className="absolute left-1/2 -translate-x-1/2 -top-5 w-16 h-16 rounded-full flex flex-col items-center justify-center text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #c79a2e)` }}
          aria-label={isHe ? 'מימוש QR / כרטיס' : 'QR / Card redeem'}
        >
          <QrCode className="w-6 h-6" />
          <span className="text-[8.5px] mt-0.5">QR / Card</span>
        </button>
      }
    >
      {/* CEO AUTH MASTER §16 (2026-08-29) — Home tab points to the
          canonical customer destination /pet-parent/home. Prestige
          here is app-flavor branding, not identity. Active-state
          matches the legacy /prestige/home alias too during the
          transition so a bookmarked link still highlights the tab. */}
      <TabBtn icon={HomeIcon} label={isHe ? 'בית' : 'Home'} active={is('/pet-parent/home') || is('/prestige/home')} onClick={() => navigate('/pet-parent/home')} />
      <TabBtn icon={CalendarDays} label={isHe ? 'הזמנות' : 'Book'} active={is('/bookings') || is('/my-bookings')} onClick={() => navigate('/bookings')} />
      <TabBtn icon={ShoppingBag} label={isHe ? 'חנות' : 'Shop'} active={is('/shop')} onClick={() => navigate('/shop')} />
      <div className="w-14 shrink-0" />
      <TabBtn icon={WalletIcon} label={isHe ? 'ארנק' : 'Wallet'} active={is('/my-wallet')} onClick={() => navigate('/my-wallet')} />
      <TabBtn icon={User} label={isHe ? 'חשבון' : 'Account'} active={is('/my-account')} onClick={() => navigate('/my-account')} />
    </BarShell>
  );
}

/** Provider (work) tabs: Jobs · Calendar | Home | Earnings · Compliance · Account */
export function ProviderTabsBar() {
  const [path, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const is = (p: string) => path === p || path.startsWith(p + '/');

  // New-request badge on Jobs — same live counter the provider home reads.
  const { data: countsRes } = useQuery<any>({
    queryKey: ['/api/provider-dashboard/v2/booking-counts'],
    queryFn: (): Promise<any> => fetch(getApiUrl('/api/provider-dashboard/v2/booking-counts'), { credentials: 'include' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    enabled: !!user,
    staleTime: 30_000,
  });
  const newRequests = Number(countsRes?.counts?.new_request ?? countsRes?.new_request ?? countsRes?.newRequests ?? 0);

  return (
    <BarShell
      center={
        <button
          onClick={() => navigate('/provider/home')}
          className="absolute left-1/2 -translate-x-1/2 -top-5 w-16 h-16 rounded-full flex flex-col items-center justify-center text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0e7a54, #0c6b48)' }}
          aria-label={isHe ? 'בית' : 'Home'}
        >
          <HomeIcon className="w-6 h-6" />
          <span className="text-[8.5px] mt-0.5">{isHe ? 'בית' : 'Home'}</span>
        </button>
      }
    >
      <TabBtn icon={Briefcase} label={isHe ? 'עבודות' : 'Jobs'} badge={newRequests} active={is('/provider/jobs') || path.includes('m=jobs')} onClick={() => navigate('/provider-os?m=jobs')} />
      <TabBtn icon={CalendarDays} label={isHe ? 'יומן' : 'Calendar'} active={path.includes('m=calendar')} onClick={() => navigate('/provider-os?m=calendar')} />
      <div className="w-14 shrink-0" />
      <TabBtn icon={DollarSign} label={isHe ? 'הכנסות' : 'Earnings'} active={is('/provider/earnings') || is('/provider/payouts')} onClick={() => navigate('/provider/earnings')} />
      <TabBtn icon={ShieldCheck} label={isHe ? 'ציות' : 'Compliance'} active={is('/provider-compliance')} onClick={() => navigate('/provider-compliance')} />
      <TabBtn icon={User} label={isHe ? 'חשבון' : 'Account'} active={is('/provider/account') || path.includes('m=profile')} onClick={() => navigate('/provider/account')} />
    </BarShell>
  );
}
