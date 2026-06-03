/**
 * DashboardV2 — luxury member dashboard (brand-guide standard).
 *
 * Elevated dark+gold member home. Ships behind VITE_DASHBOARD_V2_ENABLED;
 * the legacy Dashboard remains the default until the flag is flipped.
 *
 * Data: reuses the SAME real hooks as the legacy Dashboard — wallet summary,
 * loyalty points, tier, unread count, pet/activity summary. NO fake data:
 * empty states render guidance, and the "nearest station" block is an honest
 * CTA to /stations (no fabricated live bay status — that needs a real locator).
 *
 * Tokens come from the petwash-ui-ux brand guide (§2): black canvas, gold as the
 * single accent, warm-white type, Inter, card radii + gold glow. Mobile-first,
 * RTL day-one (Hebrew/Arabic), 44pt+ tap targets.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import {
  Bell, Menu, Sparkles, PawPrint, Scissors, Gift, Gem,
  MapPin, Plus, Droplets, QrCode, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useWhoami } from '@/auth/useWhoami';
import { useLanguage } from '@/lib/languageStore';

interface WalletSummary {
  totalCreditsValueCents: number;
  loyaltyPointsBalance: number;
  loyaltyTier: string;
  tierPointsThisYear: number;
}
interface ActivitySummary {
  pets: Array<{ id: number; name: string; species: string; breed: string; photoUrl: string | null }>;
  recentTransactions: Array<{ id: number; type: string; amountCents: number | null; description: string | null; createdAt: string }>;
}

const tierLabels: Record<string, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum',
  diamond: 'Diamond', emerald: 'Emerald', royal: 'Royal',
};

// Brand tokens (petwash-ui-ux §2)
const C = {
  ink: '#0a0a0a', s1: 'rgba(255,255,255,.045)', s2: 'rgba(255,255,255,.08)',
  line: 'rgba(255,255,255,.10)', line2: 'rgba(244,212,138,.22)',
  gold: '#d8ad55', gold2: '#f4d48a', white: '#fffaf0', muted: 'rgba(255,250,240,.58)',
  glow: '0 0 0 1px rgba(216,173,85,.45), 0 10px 30px rgba(216,173,85,.16)',
};

function t(he: boolean, en: string, hebrew: string) { return he ? hebrew : en; }

function greetingFor(lang: string): string {
  const h = new Date().getHours();
  const sets: Record<string, [string, string, string]> = {
    he: ['בוקר טוב', 'צהריים טובים', 'ערב טוב'],
    ar: ['صباح الخير', 'مساء الخير', 'مساء الخير'],
    en: ['Good morning', 'Good afternoon', 'Good evening'],
  };
  const s = sets[lang] || sets.en;
  return h < 12 ? s[0] : h < 17 ? s[1] : s[2];
}

export default function DashboardV2() {
  const { user: firebaseUser, loading } = useFirebaseAuth();
  const { role: serverRole, isLoading: whoamiLoading } = useWhoami();
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const he = language === 'he';
  const rtl = language === 'he' || language === 'ar';
  const Fwd = rtl ? ArrowLeft : ArrowRight;

  // Providers belong on /provider-os, never the member dashboard.
  useEffect(() => {
    if (!whoamiLoading && serverRole === 'provider') setLocation('/provider-os');
  }, [whoamiLoading, serverRole, setLocation]);

  const { data: profileData } = useQuery({ queryKey: ['/api/simple-auth/me'], enabled: !!firebaseUser });
  const { data: walletData } = useQuery<{ success: boolean; wallet: WalletSummary }>({ queryKey: ['/api/credit-wallet/summary'], enabled: !!firebaseUser });
  const { data: unreadData } = useQuery<{ count: number }>({ queryKey: ['/api/messages/unread/count'], enabled: !!firebaseUser });
  const { data: activityData } = useQuery<ActivitySummary>({ queryKey: ['/api/user/activity/summary'], enabled: !!firebaseUser });

  if (!whoamiLoading && serverRole === 'provider') return null;

  const wallet = walletData?.wallet || null;
  const userProfile = (profileData as any)?.user;
  const userName = userProfile?.firstName || firebaseUser?.displayName?.split(' ')[0] || '';
  const unreadCount = unreadData?.count || 0;
  const tierKey = (wallet?.loyaltyTier || 'bronze').toLowerCase();
  const tierLabel = tierLabels[tierKey] || 'Bronze';
  const points = wallet?.loyaltyPointsBalance ?? 0;
  const balance = wallet ? (wallet.totalCreditsValueCents / 100).toFixed(0) : '0';
  const pets = activityData?.pets || [];
  const tx = activityData?.recentTransactions || [];

  const page: React.CSSProperties = {
    minHeight: '100dvh', background: 'radial-gradient(120% 60% at 50% -10%, #15140f 0%, #000 60%)',
    color: C.white, fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    direction: rtl ? 'rtl' : 'ltr',
    paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
  };
  const shell: React.CSSProperties = { maxWidth: 480, margin: '0 auto', padding: '14px 18px 0' };
  const card: React.CSSProperties = { background: C.s1, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 };
  const cap: React.CSSProperties = { fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.gold, fontWeight: 600 };
  const pill = (filled: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 9999,
    fontSize: 12, fontWeight: filled ? 700 : 600, cursor: 'pointer', border: filled ? 'none' : `1px solid ${C.line2}`,
    background: filled ? C.gold : 'transparent', color: filled ? '#1a1407' : C.gold2, textDecoration: 'none',
  });
  const iconBtn: React.CSSProperties = { width: 44, height: 44, borderRadius: '50%', background: C.s1, border: `1px solid ${C.line}`, display: 'grid', placeItems: 'center', position: 'relative', color: C.white };

  if (loading) {
    return (
      <div style={{ ...page, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${C.line}`, borderTopColor: C.gold, animation: 'pwspin 0.8s linear infinite' }} />
        <style>{`@keyframes pwspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={shell}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 2px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#1c1a12,#000)', border: `1.5px solid ${C.gold}`, display: 'grid', placeItems: 'center', color: C.gold2, fontWeight: 600 }}>
              {(userName || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{greetingFor(language)}{userName ? `, ${userName}` : ''}</div>
              <div style={{ fontSize: 11, color: C.gold, letterSpacing: '.05em', textTransform: 'uppercase' }}>{tierLabel} {t(he, 'Member', 'חבר')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <Link href="/account" aria-label={t(he, 'Notifications', 'התראות')} style={iconBtn}>
              <Bell size={19} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 9, insetInlineEnd: 9, width: 7, height: 7, borderRadius: '50%', background: C.gold, boxShadow: `0 0 0 2px ${C.ink}` }} />}
            </Link>
            <Link href="/my-account" aria-label={t(he, 'Menu', 'תפריט')} style={iconBtn}><Menu size={19} /></Link>
          </div>
        </div>

        {/* privilege card */}
        <div style={{ position: 'relative', borderRadius: 16, padding: 18, background: `linear-gradient(${rtl ? 225 : 135}deg, rgba(216,173,85,.14), rgba(255,255,255,.02))`, border: `1px solid ${C.line2}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div>
              <div style={cap}>PetWash Privilege</div>
              <div style={{ fontSize: 21, fontWeight: 600, marginTop: 6 }}>{tierLabel} · <span style={{ color: C.gold2 }}>{t(he, 'Member', 'חבר')}</span></div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10, maxWidth: 230 }}>{t(he, 'Keep washing to climb tiers and unlock rewards.', 'המשיכו לשטוף כדי לעלות מסלולים ולפתוח הטבות.')}</div>
            </div>
            <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, rgba(244,212,138,.2), rgba(255,255,255,.04))', border: `1px solid ${C.line2}`, display: 'grid', placeItems: 'center' }}>
                <div><div style={{ fontSize: 18, fontWeight: 600, color: C.gold2 }}>{points}</div><div style={{ fontSize: 9, color: C.muted }}>{t(he, 'pts', 'נק׳')}</div></div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}`, position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted }}>{t(he, 'Wallet balance', 'יתרת ארנק')}</div>
              <div style={{ fontSize: 26, fontWeight: 600 }}><bdi>₪{balance}</bdi></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href="/privilege" style={pill(false)}><QrCode size={14} /> {t(he, 'Scan', 'סריקה')}</Link>
              <Link href="/my-wallet" style={pill(true)}><Plus size={14} /> {t(he, 'Top up', 'טעינה')}</Link>
            </div>
          </div>
        </div>

        {/* primary next-best-action */}
        <Link href="/stations" style={{ margin: '16px 0 6px', width: '100%', height: 58, borderRadius: 14, background: `linear-gradient(${rtl ? 225 : 135}deg, ${C.gold2}, ${C.gold})`, color: '#1a1407', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: C.glow, textDecoration: 'none' }}>
          <Droplets size={20} /> {t(he, 'Start a wash', 'התחילו שטיפה')}
        </Link>
        <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {t(he, 'Find your nearest K9000 station', 'מצאו את עמדת ה־K9000 הקרובה')} <Fwd size={13} />
        </div>

        {/* quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, margin: '4px 0 20px' }}>
          {[
            { href: '/booking', icon: Scissors, label: t(he, 'Book grooming', 'טיפוח') },
            { href: '/pets', icon: PawPrint, label: t(he, 'My pets', 'החיות שלי') },
            { href: '/buy-gift-card', icon: Gift, label: t(he, 'e-Gift', 'שובר מתנה') },
            { href: '/refer', icon: Gem, label: t(he, 'Refer & earn', 'הזמינו חברים') },
          ].map((q) => (
            <Link key={q.href} href={q.href} style={{ background: C.s1, border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 6px', textAlign: 'center', textDecoration: 'none', color: C.white }}>
              <q.icon size={21} color={C.gold2} style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.2 }}>{q.label}</div>
            </Link>
          ))}
        </div>

        {/* Ask Maya */}
        <Link href="/live-chat" style={{ display: 'flex', alignItems: 'center', gap: 12, background: `linear-gradient(${rtl ? 225 : 135}deg, rgba(255,255,255,.05), rgba(216,173,85,.06))`, border: `1px solid ${C.line2}`, borderRadius: 14, padding: '13px 14px', textDecoration: 'none', color: C.white }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #f4d48a, #7a5c1d)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Sparkles size={18} color="#1a1407" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t(he, 'Ask Maya', 'שאלו את מאיה')}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{t(he, 'Booking, stations, your wallet — answers in seconds.', 'הזמנות, עמדות, הארנק שלכם — תשובות תוך שניות.')}</div>
          </div>
          <span style={pill(false)}>{t(he, 'Chat', 'צ׳אט')}</span>
        </Link>

        {/* pets */}
        <SectionHead he={he} title={t(he, 'Your pets', 'החיות שלי')} href="/pets" cta={t(he, 'Manage', 'ניהול')} />
        {pets.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '22px 14px' }}>
            <PawPrint size={28} color={C.gold2} />
            <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>{t(he, 'Add your first pet', 'הוסיפו את החיה הראשונה')}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>{t(he, 'Save their size & coat so every wash is pre-set. Takes 30 seconds.', 'שמרו את הגודל והפרווה כדי שכל שטיפה תהיה מותאמת מראש. לוקח 30 שניות.')}</div>
            <Link href="/pets" style={pill(false)}><Plus size={14} /> {t(he, 'Add a pet', 'הוספת חיה')}</Link>
          </div>
        ) : (
          <div style={{ ...card, display: 'flex', gap: 12, overflowX: 'auto' }}>
            {pets.slice(0, 6).map((p) => (
              <Link key={p.id} href="/pets" style={{ textAlign: 'center', textDecoration: 'none', color: C.white, flex: '0 0 auto', width: 64 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: C.s2, border: `1px solid ${C.line2}`, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
                  {p.photoUrl ? <img src={p.photoUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PawPrint size={22} color={C.gold2} />}
                </div>
                <div style={{ fontSize: 11, marginTop: 5, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              </Link>
            ))}
          </div>
        )}

        {/* nearest station — honest CTA, no fabricated live status */}
        <SectionHead he={he} title={t(he, 'Stations near you', 'עמדות בקרבתכם')} href="/stations" cta={t(he, 'Map', 'מפה')} />
        <Link href="/stations" style={{ ...card, display: 'flex', alignItems: 'center', gap: 13, textDecoration: 'none', color: C.white }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.s2, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><MapPin size={20} color={C.gold2} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t(he, 'Find a station', 'מצאו עמדה')}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{t(he, 'See nearby K9000 stations, hours and availability.', 'ראו עמדות K9000 קרובות, שעות וזמינות.')}</div>
          </div>
          <Fwd size={16} color={C.gold2} />
        </Link>

        {/* recent activity */}
        <SectionHead he={he} title={t(he, 'Recent activity', 'פעילות אחרונה')} />
        {tx.length === 0 ? (
          <div style={{ ...card, padding: 18 }}>
            <div style={{ fontSize: 12, color: C.muted }}>{t(he, 'Your washes, rewards and receipts will appear here after your first visit.', 'השטיפות, ההטבות והקבלות שלכם יופיעו כאן אחרי הביקור הראשון.')}</div>
          </div>
        ) : (
          <div style={card}>
            {tx.slice(0, 5).map((r, i) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                <div style={{ fontSize: 13 }}>{r.description || r.type}</div>
                <div style={{ fontSize: 13, color: C.gold2, fontWeight: 600 }}><bdi>{r.amountCents != null ? `₪${(r.amountCents / 100).toFixed(0)}` : ''}</bdi></div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: C.muted, marginTop: 24, lineHeight: 1.7 }}>
          {t(he, "Need a hand? We're here 24/7", 'צריכים עזרה? אנחנו כאן 24/7')}<br />
          <bdi>support@petwash.co.il</bdi>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ he, title, href, cta }: { he: boolean; title: string; href?: string; cta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 2px 10px' }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>
      {href && cta && <Link href={href} style={{ fontSize: 12, color: '#f4d48a', textDecoration: 'none' }}>{cta}</Link>}
    </div>
  );
}
