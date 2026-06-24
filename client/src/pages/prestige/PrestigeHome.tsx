/**
 * PrestigeHome — the logged-in luxury home of the Prestige (customer) app
 * (CEO-approved mockup, 2026-06-24). Renders INSIDE PrestigeShell, which provides
 * the centred official logo header + the 5-tab bottom nav.
 *
 * Brand: pearl background, emerald/black member card with champagne-gold framing,
 * full-colour service tiles (gold as accent, not flat buttons), Hebrew-first/RTL.
 *
 * K9000 model (CEO): the station is NOT bookable. The member shows their QR to the
 * Nayax reader at the station; the system live-verifies and a free bay (of two)
 * starts a ~5–7 min wash. So the wash action is "redeem", not "book". Booking is
 * only for sitter / walk / trainer.
 *
 * Live data: wallet/points/tier via /api/credit-wallet/summary, pets via
 * /api/user/activity/summary. No fabricated numbers — fields without an endpoint
 * yet render a neutral placeholder. The secure redeemable pass lives at
 * /prestige/pass (centre Card tab); this hero QR encodes the member identifier.
 */

import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode, Wallet, Star, CalendarHeart, Scan, Sun, Gift,
  Home as HomeIcon, Footprints, ShoppingBag, Package, GraduationCap, PawPrint, MapPin,
} from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useWhoami } from '@/auth/useWhoami';
import { useLanguage } from '@/lib/languageStore';

const INK = '#0B0B0B';
const EMERALD = '#006B4F';
const TEAL = '#0E8C86';
const GOLD = '#C9A24A';
const GOLD_DEEP = '#9B7426';
const GOLD_SOFT = '#E9CE84';
const ROSE = '#C16A82';
const MUTED = '#6B7280';
const GOLD_HAIR = 'rgba(201,162,74,0.30)';

interface WalletSummary {
  totalCreditsValueCents: number;
  loyaltyPointsBalance: number;
  loyaltyTier: string;
  tierPointsThisYear: number;
  washCreditCount?: number;
}
interface ActivitySummary {
  pets: Array<{ id: number; name: string; species: string; breed: string; photoUrl: string | null }>;
}

const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum',
  diamond: 'Diamond', emerald: 'Emerald', royal: 'Royal',
};

const COPY = {
  he: {
    tier: (t: string) => `PRESTIGE ${t.toUpperCase()}`,
    hi: 'שלום',
    qr: 'הצג לקורא ה‑QR בעמדה',
    qrSub: 'מימוש מיידי ומאומת',
    redeemStrip: 'מגיעים, סורקים בעמדה ומתחילים',
    noBooking: 'ללא הזמנה',
    bays: '2 עמדות · רחצה ~5–7 דק׳',
    washCredits: 'קרדיט רחצה', walletL: 'ארנק', points: 'נקודות', nextBooking: 'הזמנה',
    quickTitle: 'פעולות מהירות',
    redeemWash: 'מימוש רחצה', stations: 'תחנות', petSitter: 'Pet Sitter', walk: 'Walk My Pet', shop: 'חנות',
    sendGift: 'שליחת מתנה', buyPackage: 'רכישת חבילה', topUp: 'טעינת ארנק', academy: 'Academy',
    safetyTitle: 'טיפ בטיחות להיום',
    safetyBody: 'בימים חמים מומלץ לטייל בבוקר או בערב ולבדוק שחום המדרכה נעים לכפות.',
    petsTitle: 'החיות שלי', viewAll: 'הצג הכל',
    rewards: 'נקודות Prestige', myRewards: 'ההטבות שלי', none: '—',
  },
  en: {
    tier: (t: string) => `PRESTIGE ${t.toUpperCase()}`,
    hi: 'Hello',
    qr: 'Show to the reader at the station',
    qrSub: 'Instant, verified redemption',
    redeemStrip: 'Walk up, scan at the bay, start',
    noBooking: 'no booking',
    bays: '2 bays · wash ~5–7 min',
    washCredits: 'Wash credits', walletL: 'Wallet', points: 'Points', nextBooking: 'Booking',
    quickTitle: 'Quick actions',
    redeemWash: 'Redeem wash', stations: 'Stations', petSitter: 'Pet Sitter', walk: 'Walk My Pet', shop: 'Shop',
    sendGift: 'Send a gift', buyPackage: 'Buy package', topUp: 'Top up wallet', academy: 'Academy',
    safetyTitle: "Today's care tip",
    safetyBody: 'On hot days, walk in the morning or evening and check the pavement is cool for paws.',
    petsTitle: 'My pets', viewAll: 'View all',
    rewards: 'Prestige points', myRewards: 'My rewards', none: '—',
  },
} as const;

export default function PrestigeHome() {
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'he';
  const t = COPY[lang];
  const isRTL = lang === 'he';

  const { data: walletData } = useQuery<{ success: boolean; wallet: WalletSummary }>({
    queryKey: ['/api/credit-wallet/summary'], enabled: !!user,
  });
  const { data: activityData } = useQuery<ActivitySummary>({
    queryKey: ['/api/user/activity/summary'], enabled: !!user,
  });

  const wallet = walletData?.wallet;
  const firstName = (user?.displayName || '').split(' ')[0] || (lang === 'he' ? 'חבר' : 'Member');
  const tierKey = (wallet?.loyaltyTier || 'gold').toLowerCase();
  const tierLabel = TIER_LABELS[tierKey] || 'Gold';
  const points = wallet?.loyaltyPointsBalance;
  const balance = wallet ? Math.round(wallet.totalCreditsValueCents / 100) : undefined;
  const washCredits = wallet?.washCreditCount;
  const pets = activityData?.pets ?? [];
  const memberId = user?.uid || '';
  const go = (path: string) => () => setLocation(path);
  const fmt = (v: number | undefined) => (v === undefined ? t.none : String(v));

  const quickActions = [
    { label: t.redeemWash, Icon: QrCode, tint: '#E6F1EC', color: EMERALD, to: '/prestige/pass' },
    { label: t.stations, Icon: MapPin, tint: '#E9F3F2', color: TEAL, to: '/locations' },
    { label: t.petSitter, Icon: HomeIcon, tint: '#FBEFE2', color: GOLD_DEEP, to: '/prestige/book/sitter' },
    { label: t.walk, Icon: Footprints, tint: '#E9F3F2', color: TEAL, to: '/prestige/book/walk' },
    { label: t.shop, Icon: ShoppingBag, tint: '#F7E7EC', color: ROSE, to: '/prestige/shop' },
    { label: t.sendGift, Icon: Gift, tint: '#F7EFD9', color: GOLD, to: '/prestige/gift' },
    { label: t.buyPackage, Icon: Package, tint: '#E6F1EC', color: EMERALD, to: '/prestige/packages' },
    { label: t.topUp, Icon: Wallet, tint: '#E9F3F2', color: TEAL, to: '/prestige/wallet' },
    { label: t.academy, Icon: GraduationCap, tint: '#EEEAF5', color: '#5B4B8A', to: '/prestige/academy' },
  ];

  const statTile = (Icon: React.ElementType, color: string, value: string, label: string) => (
    <div style={{ background: '#fff', border: `0.5px solid ${GOLD_HAIR}`, borderRadius: 14, padding: '10px 4px', textAlign: 'center' }}>
      <Icon size={18} style={{ color }} aria-hidden />
      <div style={{ fontSize: 15, fontWeight: 500, color: INK, marginTop: 3 }}>{value}</div>
      <div style={{ fontSize: 9, color: MUTED }}>{label}</div>
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ paddingBottom: 8 }}>
      {/* Member card hero */}
      <div style={{ padding: '8px 14px 0' }}>
        <div style={{ borderRadius: 20, padding: 16, background: 'linear-gradient(135deg,#0B0B0B 0%,#083D32 100%)', border: `1px solid ${GOLD_HAIR}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: GOLD_SOFT }}>{t.tier(tierLabel)}</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#fff', marginTop: 3 }}>{t.hi}, {firstName}</div>
              {memberId && <div style={{ fontSize: 10, color: '#BFE3D4', marginTop: 2 }}>ID&nbsp;{memberId.slice(0, 10).toUpperCase()}</div>}
              {pets[0] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {pets[0].photoUrl
                      ? <img src={pets[0].photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <PawPrint size={18} style={{ color: INK }} />}
                  </div>
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontSize: 12, color: '#fff' }}>{pets[0].name}</div>
                    {pets[0].breed && <div style={{ fontSize: 10, color: '#9FC8B8' }}>{pets[0].breed}</div>}
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={go('/prestige/pass')} style={{ textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer' }} aria-label={t.qr}>
              <div style={{ width: 80, height: 80, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${GOLD}` }}>
                {memberId
                  ? <QRCodeSVG value={`petwash:member:${memberId}`} size={64} bgColor="#ffffff" fgColor={INK} level="M" />
                  : <QrCode size={60} style={{ color: INK }} />}
              </div>
              <div style={{ fontSize: 9, color: GOLD_SOFT, marginTop: 5, lineHeight: 1.3 }}>{t.qr}<br />{t.qrSub}</div>
            </button>
          </div>
        </div>
      </div>

      {/* Come-and-redeem strip (K9000 model) */}
      <div style={{ padding: '8px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#EAF3EF', border: '0.5px solid rgba(14,140,134,0.35)', borderRadius: 12, padding: '8px 12px' }}>
          <Scan size={18} style={{ color: TEAL, flexShrink: 0 }} aria-hidden />
          <div style={{ fontSize: 10.5, color: INK, lineHeight: 1.45 }}>
            {t.redeemStrip} — <b style={{ fontWeight: 500 }}>{t.noBooking}</b> · {t.bays}
          </div>
        </div>
      </div>

      {/* Stat tiles (live where available; neutral placeholder otherwise) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, padding: '12px 14px 4px' }}>
        {statTile(QrCode, TEAL, fmt(washCredits), t.washCredits)}
        {statTile(Wallet, EMERALD, balance === undefined ? t.none : `₪${balance}`, t.walletL)}
        {statTile(Star, GOLD, fmt(points), t.points)}
        {statTile(CalendarHeart, '#D89BA7', t.none, t.nextBooking)}
      </div>

      {/* Quick actions */}
      <div style={{ fontSize: 13, fontWeight: 500, color: INK, padding: '12px 18px 2px' }}>{t.quickTitle}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '6px 14px 4px' }}>
        {quickActions.map(({ label, Icon, tint, color, to }) => (
          <button key={label} type="button" onClick={go(to)} style={{ textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{ width: 52, height: 52, margin: '0 auto', borderRadius: 16, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={24} style={{ color }} aria-hidden />
            </div>
            <div style={{ fontSize: 10, color: INK, marginTop: 5 }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Weather / safety tip (advisory copy; no fabricated live temperature) */}
      <div style={{ padding: '12px 14px 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F4EFE6', border: `0.5px solid ${GOLD_HAIR}`, borderRadius: 16, padding: '12px 14px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF3D6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sun size={22} style={{ color: GOLD }} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: INK }}>{t.safetyTitle}</div>
            <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{t.safetyBody}</div>
          </div>
        </div>
      </div>

      {/* Pets strip (live) */}
      {pets.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 4px' }}>
            <button type="button" onClick={go('/prestige/pets')} style={{ fontSize: 11, color: GOLD_DEEP, background: 'none', border: 'none', cursor: 'pointer' }}>{t.viewAll}</button>
            <span style={{ fontSize: 13, fontWeight: 500, color: INK }}>{t.petsTitle}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '0 14px 4px' }}>
            {pets.slice(0, 3).map((p) => (
              <div key={p.id} style={{ background: '#fff', border: `0.5px solid ${GOLD_HAIR}`, borderRadius: 14, padding: 10, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F4EFE6', margin: '0 auto', overflow: 'hidden' }}>
                  {p.photoUrl && <img src={p.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ fontSize: 11, color: INK, marginTop: 5 }}>{p.name}</div>
                {p.breed && <div style={{ fontSize: 9, color: MUTED }}>{p.breed}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rewards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, padding: '12px 14px 16px' }}>
        <button type="button" onClick={go('/prestige/rewards')} style={{ background: 'linear-gradient(135deg,#083D32,#006B4F)', borderRadius: 16, padding: 13, color: '#fff', border: 'none', cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}>
          <Star size={18} style={{ color: GOLD_SOFT }} aria-hidden />
          <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>{fmt(points)}</div>
          <div style={{ fontSize: 10, color: '#BFE3D4' }}>{t.rewards}</div>
        </button>
        <button type="button" onClick={go('/prestige/rewards')} style={{ background: '#fff', border: `0.5px solid ${GOLD_HAIR}`, borderRadius: 16, padding: 13, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}>
          <Gift size={18} style={{ color: ROSE }} aria-hidden />
          <div style={{ fontSize: 14, fontWeight: 500, color: INK, marginTop: 4 }}>{t.myRewards}</div>
          <div style={{ fontSize: 10, color: MUTED }}>{tierLabel}</div>
        </button>
      </div>
    </div>
  );
}
