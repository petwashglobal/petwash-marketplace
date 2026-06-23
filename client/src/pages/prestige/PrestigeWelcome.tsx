/**
 * PrestigeWelcome — the SIGNED-OUT entry of the Prestige (customer/loyalty) app.
 *
 * App-structure rebuild, Stage 4 (SDD §6.1 screen #1; CEO-approved mockup v2).
 * This is what the customer app opens to when no one is signed in — a premium
 * member welcome, NOT the marketing Landing page. It replaces the interim
 * re-used SignIn screen from Stage 1.
 *
 * Brand discipline (HARD): pure bright-white background (never black), metallic
 * gold (#D4AF37) accents only, the REAL PetWash logo asset top-center, generous
 * whitespace with NO dead space, Hebrew-first / RTL, and a layout that holds up
 * from small iPhones to large phones (100dvh, safe-area insets, centered column).
 *
 * It is reached only via /prestige/welcome, which mounts behind
 * VITE_APP_STRUCTURE_V2_ENABLED. The CTAs route into the existing auth flow with
 * a redirect back into the Prestige app, so no auth logic is duplicated.
 */

import { useLocation } from 'wouter';
import { QrCode, Droplets, Dog, Footprints, Gift, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

const GOLD = '#D4AF37';
const GOLD_DARK = '#B8932F';
const GOLD_EDGE = '#C49A28';
const GOLD_HAIR = '#F1E4B8';
const INK = '#1A1A1A';
const MUTED = '#6B7280';

const COPY = {
  he: {
    badge: 'PRESTIGE',
    cardTitle: 'כרטיס חבר',
    credits: 'קרדיטים לשטיפה',
    tierLabel: 'דרגה',
    tier: 'Founding',
    title: 'מועדון Prestige',
    subtitle: 'כל הטיפוח של הכלב שלך, במקום אחד — ברמה אחרת.',
    services: { wash: 'שטיפה', boarding: 'בית מלון', walk: 'טיולים', gifts: 'מתנות', shop: 'חנות' },
    signIn: 'התחברות',
    signUp: 'חדשים כאן? פתחו חשבון',
    termsPre: 'בהמשך אתם מאשרים את',
    terms: 'התקנון ומדיניות הפרטיות',
  },
  en: {
    badge: 'PRESTIGE',
    cardTitle: 'Member card',
    credits: 'Wash credits',
    tierLabel: 'Tier',
    tier: 'Founding',
    title: 'The Prestige Club',
    subtitle: 'All of your dog’s care, in one place — on another level.',
    services: { wash: 'Wash', boarding: 'Boarding', walk: 'Walks', gifts: 'Gifts', shop: 'Shop' },
    signIn: 'Sign in',
    signUp: 'New here? Create an account',
    termsPre: 'By continuing you accept the',
    terms: 'Terms & Privacy Policy',
  },
} as const;

export default function PrestigeWelcome() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'he';
  const t = COPY[lang];
  const isRTL = lang === 'he';

  const go = (path: string) => () => setLocation(path);

  const services = [
    { Icon: Droplets, label: t.services.wash },
    { Icon: Dog, label: t.services.boarding },
    { Icon: Footprints, label: t.services.walk },
    { Icon: Gift, label: t.services.gifts },
    { Icon: ShoppingBag, label: t.services.shop },
  ];

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="flex flex-col items-center bg-white"
      style={{
        minHeight: '100dvh',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        paddingInline: '1.25rem',
      }}
    >
      <div className="flex w-full flex-col" style={{ maxWidth: 420, flex: 1 }}>
        {/* Logo — real brand asset, top-center (logo rule: never recreate). */}
        <div className="flex justify-center pt-2 pb-1">
          <img
            src="/brand/petwash-logo-official.png"
            alt="PetWash"
            className="h-9 w-auto object-contain"
            draggable={false}
          />
        </div>

        {/* Member-card hero. */}
        <div className="mt-3" style={{ paddingInline: 2 }}>
          <div
            style={{
              borderRadius: 18,
              padding: 18,
              background: '#FFFFFF',
              border: `1.5px solid ${GOLD}`,
              boxShadow: `inset 0 0 0 1px ${GOLD_HAIR}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 10, letterSpacing: 2, color: GOLD_DARK }}>{t.badge}</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: INK, marginTop: 2 }}>{t.cardTitle}</div>
              </div>
              <div
                className="flex items-center justify-center"
                style={{ width: 46, height: 46, borderRadius: 8, border: `1px solid ${GOLD_HAIR}` }}
              >
                <QrCode size={30} color={INK} aria-hidden />
              </div>
            </div>
            <div style={{ height: 1, background: GOLD_HAIR, margin: '14px 0' }} />
            <div className="flex items-end justify-between">
              <div>
                <div style={{ fontSize: 11, color: '#A98E4F' }}>{t.credits}</div>
                <div style={{ fontSize: 22, fontWeight: 500, color: INK }}>5</div>
              </div>
              <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
                <div style={{ fontSize: 11, color: '#A98E4F' }}>{t.tierLabel}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: GOLD_DARK }}>{t.tier}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Headline. */}
        <div className="text-center" style={{ padding: '18px 6px 2px' }}>
          <div style={{ fontSize: 21, fontWeight: 500, color: INK, lineHeight: 1.4 }}>{t.title}</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginTop: 5 }}>{t.subtitle}</div>
        </div>

        {/* Service breadth strip. */}
        <div className="flex justify-between" style={{ padding: '16px 8px 4px' }}>
          {services.map(({ Icon, label }) => (
            <div key={label} className="flex flex-col items-center" style={{ gap: 6 }}>
              <Icon size={22} color={GOLD} aria-hidden />
              <span style={{ fontSize: 10, color: MUTED }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions — route into the existing auth flow, returning to the app. */}
        <div className="flex flex-col" style={{ gap: 11, paddingTop: 16 }}>
          <button
            type="button"
            onClick={go('/signin?redirect=/prestige')}
            style={{
              width: '100%', background: GOLD, color: INK, border: `1px solid ${GOLD_EDGE}`,
              borderRadius: 13, padding: 14, fontSize: 15, fontWeight: 500,
            }}
          >
            {t.signIn}
          </button>
          <button
            type="button"
            onClick={go('/signup?redirect=/prestige')}
            style={{
              width: '100%', background: '#FFFFFF', color: INK, border: `1px solid ${INK}`,
              borderRadius: 13, padding: 14, fontSize: 15, fontWeight: 500,
            }}
          >
            {t.signUp}
          </button>
          <div className="text-center" style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            {t.termsPre}{' '}
            <button
              type="button"
              onClick={go('/legal')}
              style={{ color: MUTED, textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
            >
              {t.terms}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
