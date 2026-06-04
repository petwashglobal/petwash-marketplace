/**
 * ProfileV2 — member account hub, white/ink "premium infrastructure" direction.
 *
 * Visual direction per the Role-Separation SDD §1: stage-white, ink-black,
 * one restrained accent (ink), generous spacing, typography-first. NO gold,
 * NO gradients, no childish iconography.
 *
 * Ships behind VITE_PROFILE_V2_ENABLED; legacy MyAccount stays the default AND
 * the deep-edit target. This is a polished account HUB that routes into the
 * existing detailed flows — it does NOT reimplement the 4,409-line editor.
 * No fake data: empty fields aren't shown; "verified" badges render only when
 * the verification API confirms them. Mobile-first, RTL day-one, 44pt+ targets.
 */
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import {
  ChevronRight, ChevronLeft, BadgeCheck, PawPrint, MapPin, Wallet, Gem,
  ShieldCheck, Bell, Globe, LifeBuoy, LogOut, Pencil,
} from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';

interface UserProfile {
  displayName: string; email: string; phone: string; city: string; photoURL: string;
}
interface WalletSummary { totalCreditsValueCents: number; loyaltyPointsBalance: number; loyaltyTier: string; }
interface VerifyStatus { emailVerified?: boolean; phoneVerified?: boolean; }

const tierLabels: Record<string, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum',
  diamond: 'Diamond', emerald: 'Emerald', royal: 'Royal',
};
// White/ink tokens (SDD §1 — no gold, no gradients)
const C = {
  bg: '#ffffff', surface: '#ffffff', tile: '#fafafa',
  ink: '#0a0a0a', sub: 'rgba(10,10,10,.55)', faint: 'rgba(10,10,10,.40)',
  line: 'rgba(10,10,10,.10)', line2: 'rgba(10,10,10,.14)',
  shadow: '0 1px 2px rgba(10,10,10,.05), 0 1px 1px rgba(10,10,10,.03)',
};
function t(he: boolean, en: string, hebrew: string) { return he ? hebrew : en; }

export default function ProfileV2() {
  const { user: firebaseUser, logout } = useFirebaseAuth();
  const { language, setLanguage } = useLanguage() as any;
  const [, setLocation] = useLocation();
  const he = language === 'he';
  const rtl = language === 'he' || language === 'ar';
  const Fwd = rtl ? ChevronLeft : ChevronRight;

  const { data: profile } = useQuery<UserProfile>({ queryKey: ['/api/user/profile'], enabled: !!firebaseUser });
  const { data: walletData } = useQuery<{ success: boolean; wallet: WalletSummary }>({ queryKey: ['/api/credit-wallet/summary'], enabled: !!firebaseUser });
  const { data: verify } = useQuery<VerifyStatus>({ queryKey: ['/api/user/settings/verification-status'], enabled: !!firebaseUser });

  const wallet = walletData?.wallet || null;
  const name = profile?.displayName || firebaseUser?.displayName || t(he, 'Member', 'חבר');
  const tierLabel = tierLabels[(wallet?.loyaltyTier || 'bronze').toLowerCase()] || 'Bronze';
  const balance = wallet ? (wallet.totalCreditsValueCents / 100).toFixed(0) : '0';
  const points = wallet?.loyaltyPointsBalance ?? 0;

  const page: React.CSSProperties = {
    minHeight: '100dvh', background: C.bg, color: C.ink,
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    direction: rtl ? 'rtl' : 'ltr', paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
  };
  const shell: React.CSSProperties = { maxWidth: 480, margin: '0 auto', padding: '14px 18px 0' };
  const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, boxShadow: C.shadow };
  const tile: React.CSSProperties = { width: 38, height: 38, borderRadius: 11, background: C.tile, border: `1px solid ${C.line}`, display: 'grid', placeItems: 'center', flex: '0 0 auto' };
  const verifiedBadge = (ok?: boolean) => ok ? (
    <BadgeCheck size={14} color={C.ink} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginInlineStart: 4 }} />
  ) : null;

  const sections: Array<{ icon: any; label: string; sub: string; href: string }> = [
    { icon: Pencil, label: t(he, 'Personal details', 'פרטים אישיים'), sub: t(he, 'Name, contact, address', 'שם, יצירת קשר, כתובת'), href: '/my-account' },
    { icon: PawPrint, label: t(he, 'My pets', 'החיות שלי'), sub: t(he, 'Profiles & wash presets', 'פרופילים והעדפות שטיפה'), href: '/pets' },
    { icon: MapPin, label: t(he, 'Addresses', 'כתובות'), sub: t(he, 'Home & service locations', 'בית ומיקומי שירות'), href: '/my-account' },
    { icon: Wallet, label: t(he, 'Payment & wallet', 'תשלום וארנק'), sub: t(he, 'Balance, top-ups, receipts', 'יתרה, טעינות, קבלות'), href: '/my-wallet' },
    { icon: Gem, label: t(he, 'Privilege & rewards', 'הטבות ונאמנות'), sub: t(he, 'Tier, points, benefits', 'מסלול, נקודות, הטבות'), href: '/privilege' },
    { icon: ShieldCheck, label: t(he, 'Security & login', 'אבטחה והתחברות'), sub: t(he, 'Passkeys, sessions, devices', 'מפתחות, חיבורים, מכשירים'), href: '/my-account' },
    { icon: Bell, label: t(he, 'Notifications', 'התראות'), sub: t(he, 'Email, SMS, push', 'אימייל, SMS, פוש'), href: '/account' },
  ];

  const rowLink = (i: number): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 12px', textDecoration: 'none', color: C.ink, borderTop: i ? `1px solid ${C.line}` : 'none' });

  return (
    <div style={page}>
      <div style={shell}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px 18px' }}>
          <Link href="/dashboard" aria-label={t(he, 'Back', 'חזרה')} style={{ width: 40, height: 40, borderRadius: '50%', background: C.tile, border: `1px solid ${C.line}`, display: 'grid', placeItems: 'center', color: C.ink }}>
            {rtl ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: '-.01em' }}>{t(he, 'Account', 'החשבון שלי')}</h1>
        </div>

        {/* identity card */}
        <div style={{ ...card, textAlign: 'center', padding: 24 }}>
          <div style={{ width: 78, height: 78, borderRadius: '50%', margin: '0 auto', overflow: 'hidden', background: C.tile, border: `1px solid ${C.line2}`, display: 'grid', placeItems: 'center' }}>
            {profile?.photoURL ? <img src={profile.photoURL} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28, color: C.ink, fontWeight: 600 }}>{name.charAt(0).toUpperCase()}</span>}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 12, letterSpacing: '-.01em' }}>{name}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 12px', borderRadius: 9999, background: C.tile, border: `1px solid ${C.line}`, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: C.sub }}>
            <Gem size={12} strokeWidth={1.8} /> {tierLabel} {t(he, 'Member', 'חבר')}
          </div>
          {(profile?.email || profile?.phone) && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.sub, lineHeight: 1.9 }}>
              {profile?.email && <div><bdi>{profile.email}</bdi>{verifiedBadge(verify?.emailVerified)}</div>}
              {profile?.phone && <div><bdi>{profile.phone}</bdi>{verifiedBadge(verify?.phoneVerified)}</div>}
            </div>
          )}
          <Link href="/my-account" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 18px', borderRadius: 9999, background: C.ink, color: '#fff', fontWeight: 600, fontSize: 12.5, textDecoration: 'none' }}>
            <Pencil size={13} /> {t(he, 'Edit profile', 'עריכת פרופיל')}
          </Link>
        </div>

        {/* mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, margin: '14px 0 4px' }}>
          <Link href="/my-wallet" style={{ ...card, textDecoration: 'none', color: C.ink }}>
            <div style={{ fontSize: 11, color: C.sub }}>{t(he, 'Wallet', 'ארנק')}</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, letterSpacing: '-.01em' }}><bdi>₪{balance}</bdi></div>
          </Link>
          <Link href="/privilege" style={{ ...card, textDecoration: 'none', color: C.ink }}>
            <div style={{ fontSize: 11, color: C.sub }}>{t(he, 'Points', 'נקודות')}</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{points}</div>
          </Link>
        </div>

        {/* sections */}
        <div style={{ ...card, padding: 4, marginTop: 14 }}>
          {sections.map((s, i) => (
            <Link key={s.href + s.label} href={s.href} style={rowLink(i)}>
              <div style={tile}><s.icon size={18} color={C.ink} strokeWidth={1.6} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 11.5, color: C.sub }}>{s.sub}</div>
              </div>
              <Fwd size={18} color={C.faint} />
            </Link>
          ))}
        </div>

        {/* language + support */}
        <div style={{ ...card, padding: 4, marginTop: 14 }}>
          <button onClick={() => setLanguage?.(he ? 'en' : 'he')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 12px', background: 'none', border: 'none', color: C.ink, cursor: 'pointer', textAlign: rtl ? 'right' : 'left' }}>
            <div style={tile}><Globe size={18} color={C.ink} strokeWidth={1.6} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500 }}>{t(he, 'Language', 'שפה')}</div><div style={{ fontSize: 11.5, color: C.sub }}>{he ? 'עברית' : 'English'}</div></div>
            <span style={{ fontSize: 12, color: C.sub }}>{he ? 'English' : 'עברית'}</span>
          </button>
          <Link href="/live-chat" style={{ ...rowLink(1) }}>
            <div style={tile}><LifeBuoy size={18} color={C.ink} strokeWidth={1.6} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500 }}>{t(he, 'Help & support', 'עזרה ותמיכה')}</div><div style={{ fontSize: 11.5, color: C.sub }}>{t(he, "We're here 24/7", 'אנחנו כאן 24/7')}</div></div>
            <Fwd size={18} color={C.faint} />
          </Link>
        </div>

        <button onClick={() => { try { logout?.(); } finally { setLocation('/'); } }} style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 14, background: '#fff', border: `1px solid ${C.line2}`, color: C.ink, fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
          <LogOut size={16} /> {t(he, 'Sign out', 'התנתקות')}
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: C.faint, marginTop: 24, lineHeight: 1.7 }}>
          PetWash™ · <bdi>support@petwash.co.il</bdi>
        </div>
      </div>
    </div>
  );
}
