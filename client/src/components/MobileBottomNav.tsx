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

/**
 * Paths that represent an "account home" for the role-aware Account tab.
 * Post-PR-NAV-1 the Account tab no longer routes only to /my-account — it
 * resolves via useAccountNavigation.resolveAccountRoute() which can return
 * /admin/dashboard, /franchise/dashboard, /provider-os, or any role-specific
 * dashboard (e.g. /pet-wash-ltd/executive/ceo). The active-state must match.
 *
 * NOTE: prefixes that are also another visible tab path (e.g. /provider-os
 * is the Provider Home tab) are intentionally excluded here so we don't
 * double-light Home + Account on the same page. Admin paths are hidden by
 * HIDDEN_PREFIXES anyway, but listed for completeness.
 */
const ACCOUNT_HOME_PREFIXES = [
  '/my-account',
  '/franchise/dashboard',
  '/franchise',
  '/admin/dashboard',
  '/pet-wash-ltd',
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
      // PR-W53: --pw-z-sticky (canonical scale). Floating widgets live
      // at --pw-z-floating, which is higher, so the FAB stack always
      // sits above this bar.
      className="fixed bottom-0 left-0 right-0 pw-z-sticky md:hidden"
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        // iPhone safe-area: pad below the home-indicator so tap targets aren't
        // occluded. max() guards browsers that report 0 (Android, desktop) so
        // we still get the existing 14-row height with no extra blank strip.
        paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
      }}
    >
      <ul className="flex items-stretch h-14">
        {NAV_ITEMS.map(({ path, labelHe, labelEn, Icon }) => {
          // Account tab: resolve by role instead of hard-routing to /my-account
          // (a CEO / admin / provider should never land on the customer page).
          const isAccountTab = path === '/my-account';

          const pawFinderAliases = ['/find-pet', '/lost-pet', '/paw-finder'];
          // Active state — for the Account tab we match ANY role-aware account
          // destination so the gold highlight follows the user wherever the
          // role resolver lands them, not just /my-account.
          const isActive = isAccountTab
            ? ACCOUNT_HOME_PREFIXES.some(p => location === p || location.startsWith(p + '/'))
            : (
                location === path
                || location.startsWith(path + '/')
                || (path === '/paw-finder' && pawFinderAliases.some(a => location === a || location.startsWith(a + '/')))
              );
          const label = isRTL ? labelHe : labelEn;
          const color = isActive ? GOLD : GRAY;
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
