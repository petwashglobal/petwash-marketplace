import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Home, Footprints, CalendarDays, MessageCircle, User } from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useWhoami } from '@/auth/useWhoami';
import { useLanguage } from '@/lib/languageStore';
import { useAccountNavigation } from '@/hooks/useAccountNavigation';

const GOLD = '#C5A55A';
const GRAY = '#9CA3AF';

interface NavItem {
  path: string;
  labelHe: string;
  labelEn: string;
  Icon: React.ElementType;
}

const CUSTOMER_NAV: NavItem[] = [
  { path: '/home',               labelHe: 'בית',       labelEn: 'Home',      Icon: Home },
  { path: '/paw-finder',         labelHe: 'מציאת חיות', labelEn: 'PawFinder', Icon: Footprints },
  { path: '/bookings',           labelHe: 'הזמנות',    labelEn: 'Bookings',  Icon: CalendarDays },
  { path: '/booking-chat/inbox', labelHe: 'הודעות',    labelEn: 'Messages',  Icon: MessageCircle },
  { path: '/my-account',         labelHe: 'חשבון',     labelEn: 'Account',   Icon: User },
];

const PROVIDER_NAV: NavItem[] = [
  { path: '/provider-os',                   labelHe: 'בית',    labelEn: 'Home',     Icon: Home },
  { path: '/provider-os/bookings',          labelHe: 'הזמנות', labelEn: 'Bookings', Icon: CalendarDays },
  { path: '/provider-os/inbox',             labelHe: 'הודעות', labelEn: 'Messages', Icon: MessageCircle },
  { path: '/my-account',                    labelHe: 'חשבון',  labelEn: 'Account',  Icon: User },
];

const HIDDEN_PREFIXES = [
  '/signin', '/sign-in', '/login', '/signup', '/sign-up', '/register',
  '/admin', '/internal', '/blocked', '/access-pending', '/provider/pending', '/provider/rejected',
];

export function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const { user, loading } = useFirebaseAuth();
  const { role, isLoading: roleLoading } = useWhoami();
  const { language } = useLanguage();
  const { resolveAccountRoute } = useAccountNavigation();
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const isRTL = language === 'he' || language === 'ar';

  if (loading || roleLoading || !user) return null;

  /**
   * The Account tab must route by role — CEO / admin / provider / franchise
   * should NEVER land on /my-account. Use the same resolver the gold profile
   * icon uses (P0 audit, Bug 1 + Bonus). Falls back to '/home' on any error.
   */
  const handleAccountTap = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isResolvingAccount) return;
    setIsResolvingAccount(true);
    try {
      const route = await resolveAccountRoute();
      setLocation(route);
    } catch {
      setLocation('/home');
    } finally {
      setIsResolvingAccount(false);
    }
  };

  const isHidden = HIDDEN_PREFIXES.some(p => location.startsWith(p));
  if (isHidden) return null;

  const isProvider = role === 'provider';
  const NAV_ITEMS = isProvider ? PROVIDER_NAV : CUSTOMER_NAV;

  return (
    <nav
      aria-label={isRTL ? 'ניווט ראשי' : 'Main navigation'}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className="flex items-stretch h-14">
        {NAV_ITEMS.map(({ path, labelHe, labelEn, Icon }) => {
          const pawFinderAliases = ['/find-pet', '/lost-pet', '/paw-finder'];
          const isActive = location === path
            || location.startsWith(path + '/')
            || (path === '/paw-finder' && pawFinderAliases.some(a => location === a || location.startsWith(a + '/')));
          const label = isRTL ? labelHe : labelEn;
          const color = isActive ? GOLD : GRAY;

          // Account tab: resolve by role instead of hard-routing to /my-account
          // (a CEO / admin / provider should never land on the customer page).
          const isAccountTab = path === '/my-account';
          const inner = (
            <button
              type="button"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              aria-busy={isAccountTab && isResolvingAccount ? true : undefined}
              onClick={isAccountTab ? handleAccountTap : undefined}
              className="flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors"
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.8}
                style={{ color }}
              />
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color }}
              >
                {label}
              </span>
            </button>
          );

          return (
            <li key={path} className="flex-1">
              {isAccountTab ? inner : <Link href={path}>{inner}</Link>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
