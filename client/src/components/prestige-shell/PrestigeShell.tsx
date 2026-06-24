/**
 * PrestigeShell — the luxury app-native chrome for the Prestige (customer/loyalty)
 * app (CEO-approved mockup, 2026-06-24).
 *
 * Owns the Prestige header (the REAL official PetWash logo image, top-centre —
 * never a recreated droplet/wordmark) and the 5-tab bottom navigation with an
 * elevated centre Card/QR tab. Member surfaces render inside `children`.
 *
 * DARK BY DEFAULT: mounted only behind VITE_APP_STRUCTURE_V2_ENABLED in App.tsx,
 * so with the flag off the live apps are untouched.
 *
 * Brand: pearl-white background (#FAF8F3), black text, metallic-gold (#C9A24A)
 * hairline accents, emerald (#006B4F) active state. Real logo asset only, centred.
 * Hebrew-first / RTL via useLanguage. Mobile-first: 100dvh, safe-area insets,
 * bottom nav hidden on desktop.
 */

import { useLocation, Link } from 'wouter';
import { Home, CalendarDays, QrCode, Wallet, User } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

const PEARL = '#FAF8F3';
const EMERALD = '#006B4F';
const GRAY = '#9CA3AF';
const GOLD = '#C9A24A';
const GOLD_HAIR = 'rgba(201,162,74,0.30)';

interface PrestigeNavItem {
  path: string;
  labelHe: string;
  labelEn: string;
  Icon: React.ElementType;
  /** Center tab is rendered as an elevated Card/QR action. */
  center?: boolean;
}

/**
 * Prestige bottom tabs (approved mockup): Home · Book · [Card/QR] · Wallet ·
 * Account. The center Card/QR opens the member pass (redeem at K9000 + platforms).
 * Shop lives in the home quick-actions grid rather than the tab bar.
 */
const PRESTIGE_NAV: PrestigeNavItem[] = [
  { path: '/prestige',         labelHe: 'בית',     labelEn: 'Home',    Icon: Home },
  { path: '/prestige/book',    labelHe: 'הזמנה',   labelEn: 'Book',    Icon: CalendarDays },
  { path: '/prestige/pass',    labelHe: 'כרטיס',   labelEn: 'Card',    Icon: QrCode, center: true },
  { path: '/prestige/wallet',  labelHe: 'ארנק',    labelEn: 'Wallet',  Icon: Wallet },
  { path: '/prestige/account', labelHe: 'חשבון',   labelEn: 'Account', Icon: User },
];

export function PrestigeShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { language } = useLanguage();
  const isRTL = language === 'he' || language === 'ar';

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="flex flex-col text-black"
      style={{ minHeight: '100dvh', background: PEARL }}
    >
      {/* Header — real official PetWash logo image, top-centre (never recreated). */}
      <header
        className="sticky top-0 z-30 flex items-center justify-center"
        style={{
          background: PEARL,
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: '0.5rem',
          borderBottom: `1px solid ${GOLD_HAIR}`,
        }}
      >
        <img
          src="/brand/petwash-logo-official.png"
          alt="PetWash"
          className="h-8 w-auto object-contain"
          draggable={false}
        />
      </header>

      {/* Member surface outlet. */}
      <main className="flex-1" style={{ paddingBottom: '4.5rem' }}>
        {children}
      </main>

      {/* Luxury bottom navigation with an elevated centre Card/QR tab. */}
      <nav
        aria-label={isRTL ? 'ניווט ראשי' : 'Main navigation'}
        dir={isRTL ? 'rtl' : 'ltr'}
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          background: '#FFFFFF',
          borderTop: `1px solid ${GOLD_HAIR}`,
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        <ul className="flex items-stretch" style={{ height: '3.5rem' }}>
          {PRESTIGE_NAV.map(({ path, labelHe, labelEn, Icon, center }) => {
            const isActive = location === path || location.startsWith(`${path}/`);
            const label = isRTL ? labelHe : labelEn;
            const color = isActive ? EMERALD : GRAY;
            return (
              <li key={path} className="flex-1">
                <Link href={path}>
                  <button
                    type="button"
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    className="flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors"
                  >
                    {center ? (
                      <>
                        <span
                          className="flex items-center justify-center"
                          style={{
                            width: 46,
                            height: 46,
                            marginTop: -18,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg,#0B0B0B,#083D32)',
                            border: `1.5px solid ${GOLD}`,
                          }}
                        >
                          <Icon size={22} style={{ color: '#E9CE84' }} />
                        </span>
                        <span className="text-[10px] font-medium leading-none" style={{ color: GOLD, marginTop: 2 }}>
                          {label}
                        </span>
                      </>
                    ) : (
                      <>
                        <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} style={{ color }} />
                        <span className="text-[10px] font-medium leading-none" style={{ color }}>
                          {label}
                        </span>
                      </>
                    )}
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
