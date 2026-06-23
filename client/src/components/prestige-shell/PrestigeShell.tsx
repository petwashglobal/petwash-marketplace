/**
 * PrestigeShell — the app-native chrome for the Prestige (customer/loyalty) app.
 *
 * App-structure rebuild, Stage 0 (SDD §5.3). This is a THIN wrapper, not new
 * screens: it owns the Prestige header (real PetWash logo, top-center) and the
 * 5-tab bottom navigation the CEO specified — Home, Book, Shop, Wallet, Account —
 * and renders the existing member surfaces inside `children`.
 *
 * DARK BY DEFAULT: this component is only mounted behind
 * `VITE_APP_STRUCTURE_V2_ENABLED` in App.tsx. With the flag off it never renders,
 * so the live apps are untouched. Wiring the member surfaces into the outlet and
 * flipping the customer-app entry happen in Stage 1.
 *
 * Brand rules honored: pure-white background, black text, metallic-gold accents,
 * the REAL logo asset only (/brand/petwash-logo-official.png) top-center, never
 * recreated. Hebrew-first / RTL via useLanguage. Mobile-first: 100dvh, safe-area
 * insets, bottom nav hidden on desktop.
 */

import { useLocation, Link } from 'wouter';
import { Home, CalendarPlus, ShoppingBag, Wallet, User } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

const GOLD = '#D4AF37';
const GRAY = '#9CA3AF';

interface PrestigeNavItem {
  path: string;
  labelHe: string;
  labelEn: string;
  Icon: React.ElementType;
}

/** CEO-specified Prestige bottom tabs: Home, Book, Shop, Wallet, Account. */
const PRESTIGE_NAV: PrestigeNavItem[] = [
  { path: '/prestige',          labelHe: 'בית',   labelEn: 'Home',    Icon: Home },
  { path: '/prestige/book',     labelHe: 'הזמנה', labelEn: 'Book',    Icon: CalendarPlus },
  { path: '/prestige/shop',     labelHe: 'חנות',  labelEn: 'Shop',    Icon: ShoppingBag },
  { path: '/prestige/wallet',   labelHe: 'ארנק',  labelEn: 'Wallet',  Icon: Wallet },
  { path: '/prestige/account',  labelHe: 'חשבון', labelEn: 'Account', Icon: User },
];

export function PrestigeShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { language } = useLanguage();
  const isRTL = language === 'he' || language === 'ar';

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="flex flex-col bg-white text-black"
      style={{ minHeight: '100dvh' }}
    >
      {/* Header — real PetWash logo, top-center (logo rule: never recreate). */}
      <header
        className="sticky top-0 z-30 flex items-center justify-center bg-white"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid #F1F1F1',
        }}
      >
        <img
          src="/brand/petwash-logo-official.png"
          alt="PetWash"
          className="h-8 w-auto object-contain"
          draggable={false}
        />
      </header>

      {/* Member surface outlet. Stage 1 wires the existing member screens here. */}
      <main className="flex-1" style={{ paddingBottom: '4rem' }}>
        {children}
      </main>

      {/* Prestige bottom navigation. */}
      <nav
        aria-label={isRTL ? 'ניווט ראשי' : 'Main navigation'}
        dir={isRTL ? 'rtl' : 'ltr'}
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid #E5E7EB',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        <ul className="flex items-stretch h-14">
          {PRESTIGE_NAV.map(({ path, labelHe, labelEn, Icon }) => {
            const isActive = location === path || location.startsWith(`${path}/`);
            const label = isRTL ? labelHe : labelEn;
            const color = isActive ? GOLD : GRAY;
            return (
              <li key={path} className="flex-1">
                <Link href={path}>
                  <button
                    type="button"
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    className="flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors"
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} style={{ color }} />
                    <span className="text-[10px] font-medium leading-none" style={{ color }}>
                      {label}
                    </span>
                  </button>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default PrestigeShell;
