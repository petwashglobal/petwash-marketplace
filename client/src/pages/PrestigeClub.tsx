import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { Link } from 'wouter';
import { Shield, Lock, Wallet, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import '@/styles/luxury-system-2025.css';

type Lang = 'he' | 'en';

const dict: Record<Lang, Record<string, string>> = {
  he: {
    brandSub: "Prestige Club",
    nav_about: "על המועדון",
    nav_benefits: "מה מקבלים",
    nav_tiers: "דרגות",
    nav_moments: "Prestige Moments",
    nav_payments: "תשלום מאובטח",
    join_free: "בקשת הצטרפות 18+",
    hero_kicker: "מועדון פרימיום למשפחות חיות מחמד",
    hero_kicker2: "רשימת עניין מאושרת",
    hero_title: "PetWash Prestige Club",
    hero_lead: "יותר מרחיצה. Prestige הוא שער חברות למבוגרים 18+ בלבד: מגישים עניין, מאמתים מובייל ואימייל, ורק לאחר אישור מופעלים חשבון, Wallet והטבות.",
    cta_open_app: "בקשת הצטרפות ל-Prestige",
    cta_gift: "שליחת מתנה דיגיטלית",
    cta_services: "לשירותי פלטפורמה",
    micro_secure: "אבטחה ברמת תעשייה",
    micro_receipts: "תיעוד עסקאות וקבלות דיגיטליות",
    micro_wallet: "ארנק דיגיטלי והטבות",
    about_title: "למה Prestige קיים",
    about_sub: "זה לא מועדון קופונים. זה סטנדרט חווייתי למשפחות שמעדיפות איכות, עיצוב, אמינות ומערכת דיגיטלית אחת שמחברת שירותים ועסקאות.",
    f1_title: "מזהה חבר מאובטח",
    f1_desc: "חברות, יתרות והטבות נשמרות בצורה מאובטחת ונגישות בכל מכשיר.",
    f2_title: "היסטוריית פעילות",
    f2_desc: "כל פעולה נרשמת: טעינות, מימושים, מתנות, עסקאות ושירותים.",
    f3_title: "מימוש מהיר",
    f3_desc: "הטבה או קרדיט ניתנים למימוש באמצעות QR, בקיוסק או בעמדות בהתאם לשירות.",
    f4_title: "חוויית יוקרה נקיה",
    f4_desc: "טיפוגרפיה מדויקת, צבעים כמו תכשיט, ומבנה תוכן שמסביר באמת למה להצטרף.",
    benefits_title: "מה מקבלים כחברים",
    benefits_sub: "Prestige מרכז הטבות שמתאימות לעולם חיות המחמד: ארנק דיגיטלי, מתנות, קדימות, תגמולים, והצעות שמרגישות כמו קולקציה ולא מבצע זמני.",
    b1_title: "ארנק דיגיטלי",
    b1_desc: "טעינה מראש, קרדיט, מעקב ושקיפות. כל היתרות מוצגות בצורה ברורה.",
    b2_title: "מתנות דיגיטליות",
    b2_desc: "כרטיס מתנה יוקרתי עם שם מקבל. שליחה מיידית ומימוש פשוט.",
    b3_title: "דרגות ויתרונות",
    b3_desc: "ככל שמשתמשים יותר, נפתחים יתרונות: הטבות, הצעות, קדימות ואקסקלוסיביות.",
    b4_title: "התראות חכמות",
    b4_desc: "הודעות על הטבות, מימושים, תזכורות, ומבצעים ממוקדים לפי סטטוס.",
    tiers_title: "The Prestige Collection",
    tiers_sub: "רמות שנראות כמו חברות תעופה וכרטיסים יוקרתיים. לחצו על כל דרגה כדי לראות פירוט מלא, הטבות ומה נפתח.",
    t_pearl_hint: "התחלה אלגנטית",
    t_pearl_1: "בקשת עניין 18+",
    t_pearl_2: "ארנק ומעקב",
    t_pearl_3: "מתנות דיגיטליות",
    t_sig_hint: "סטנדרט גבוה",
    t_sig_1: "קדימות בהזמנות",
    t_sig_2: "הצעות ממוקדות",
    t_sig_3: "צבירה מהירה",
    t_elite_hint: "Champagne Diamond",
    t_elite_1: "בונוסים על טעינה",
    t_elite_2: "הטבות יום הולדת",
    t_elite_3: "הצעות בלעדיות",
    t_priv_hint: "Emerald Stone",
    t_priv_1: "הצעות פרימיום",
    t_priv_2: "קדימות גבוהה",
    t_priv_3: "הפתעות milestone",
    t_black_hint: "Onyx + Gold",
    t_black_1: "תמיכה VIP",
    t_black_2: "הצעות נדירות",
    t_black_3: "גישה ראשונה (אופציונלי)",
    progress_title: "סטטוס והתקדמות",
    progress_sub: "כמו בחברות תעופה: רואים איפה אתם נמצאים, ומה חסר לדרגה הבאה. כל נתון אמיתי מגיע מחשבון מאומת בלבד.",
    progress_wallet_title: "הארנק שלכם",
    progress_wallet_desc: "יתרה, טעינות, מימושים, ומתנות שנכנסו לחשבון.",
    progress_balance: "יתרה",
    progress_next: "דרגה הבאה",
    progress_activity_title: "Activity",
    progress_activity_desc: "כל פעולה עם חותמת זמן, כמו חשבון בנק פרטי.",
    act1: "טעינה לארנק",
    act2: "מימוש בעמדה",
    act3: "מתנה התקבלה",
    ass1: "תיעוד עסקה",
    ass2: "התראות בזמן אמת",
    ass3: "אימות חשבון (אופציונלי)",
    moments_title: "PetWash Prestige Moments",
    moments_sub: "כאן מוצגים רק נכסי מותג מאושרים: חיות מחמד, ניקיון, עיצוב נקי ותחושה של מותג יוקרה. אין תמונות דמו או הבטחות שלא אושרו.",
    mom1: "Pure white, calm light, premium care",
    mom2: "Black and gold, jewel accents, membership feel",
    pay_title: "תשלום מאובטח ומימוש",
    pay_sub: "תשלום בכרטיס, טעינת ארנק, ומימוש דרך QR בעמדה או בקיוסק, עם תיעוד מסודר.",
    pay_a1: "הצפנה",
    pay_a2: "ניהול הרשאות",
    pay_a3: "מעקב וחשבוניות",
    how_title: "איך זה עובד בפועל",
    how_sub: "תהליך ברור, קצר, בלי בלגן.",
    how1_t: "1. מצטרפים",
    how1_d: "פותחים חשבון חבר, מקבלים מזהה דיגיטלי.",
    how2_t: "2. טוענים או קונים",
    how2_d: "טעינה לארנק או רכישת מתנה דיגיטלית.",
    how3_t: "3. משתמשים",
    how3_d: "מזמינים שירותים או מממשים בעמדה בהתאם לתהליך שלכם.",
    how4_t: "4. צוברים",
    how4_d: "סטטוס ויתרונות נפתחים ככל שמתקדמים.",
    legal_title: "אישור ושקיפות",
    legal_p1: "בקשת הצטרפות אינה אישור חברות ואינה מנפיקה כרטיס Wallet. חברות, הטבות ויתרות מופעלות רק לאחר אימות ואישור לפי מדיניות Pet Wash Ltd.",
    legal_p2: "פרטי ביטוח, כיסוי K9000, תנאים מסחריים ומידע פנימי מוצגים לציבור רק בנוסח שאושר לפרסום. פרמיות, עלויות, מסמכי חברה ומידע סודי אינם מוצגים באתר.",
    contact_title: "לינקים מהירים",
    metal_name: "ניר הדד",
    metal_sub: "חבר פעיל · Gold tier · מאז 2024",
    metal_balance: "יתרה",
    metal_washes: "שטיפות",
    modal_h3: "תיאור",
    modal_h3_2: "תוכן מומלץ",
    modal_copy: "כאן מייצרים תחושת יוקרה: הסבר קצר, נקי, עם הבטחה ברורה. ללא מילים זולות. ללא אייקונים ילדותיים.",
    modal_hint: "טיפ: שימו תמונת רקע אמיתית ברמה גבוהה. הימנעו ממלאי זול. עדיף מעט תמונות אבל מושלם.",
  },
  en: {
    brandSub: "Prestige Club",
    nav_about: "About the club",
    nav_benefits: "Benefits",
    nav_tiers: "Tiers",
    nav_moments: "Prestige Moments",
    nav_payments: "Secure payment",
    join_free: "Apply 18+",
    hero_kicker: "A premium club for pet families",
    hero_kicker2: "Approved interest list",
    hero_title: "PetWash Prestige Club",
    hero_lead: "More than a wash. Prestige is an adult-only 18+ membership gateway: apply for interest, verify mobile and email, then activate account, Wallet and benefits only after approval.",
    cta_open_app: "Apply for Prestige",
    cta_gift: "Send a digital gift",
    cta_services: "Platform services",
    micro_secure: "Industry-grade security",
    micro_receipts: "Digital transaction records & receipts",
    micro_wallet: "Digital wallet & rewards",
    about_title: "Why Prestige exists",
    about_sub: "Not a coupon club. A standard of experience for families who prefer quality, design, reliability, and one digital system that connects services and transactions.",
    f1_title: "Secure member ID",
    f1_desc: "Memberships, balances, and perks stored securely and accessible from any device.",
    f2_title: "Activity history",
    f2_desc: "Every action logged: top-ups, redemptions, gifts, transactions, and services.",
    f3_title: "Quick redemption",
    f3_desc: "Perks or credit redeemable via QR, kiosk, or at stations depending on the service.",
    f4_title: "Clean luxury experience",
    f4_desc: "Precise typography, jewel-like colors, and content that truly explains why to join.",
    benefits_title: "What members get",
    benefits_sub: "Prestige unifies pet-world perks: digital wallet, gifts, priority, rewards, and offers that feel like a collection, not a temporary sale.",
    b1_title: "Digital wallet",
    b1_desc: "Pre-load, credit, track, and transparency. All balances shown clearly.",
    b2_title: "Digital gifts",
    b2_desc: "Luxury gift cards with recipient name. Instant delivery and simple redemption.",
    b3_title: "Tiers & advantages",
    b3_desc: "The more you use, the more unlocks: perks, offers, priority, and exclusivity.",
    b4_title: "Smart notifications",
    b4_desc: "Alerts for perks, redemptions, reminders, and status-targeted promotions.",
    tiers_title: "The Prestige Collection",
    tiers_sub: "Tiers that feel like airline memberships and luxury cards. Click each tier for full details, perks, and unlocks.",
    t_pearl_hint: "Elegant beginning",
    t_pearl_1: "18+ interest application",
    t_pearl_2: "Wallet & tracking",
    t_pearl_3: "Digital gifts",
    t_sig_hint: "High standard",
    t_sig_1: "Booking priority",
    t_sig_2: "Targeted offers",
    t_sig_3: "Faster accumulation",
    t_elite_hint: "Champagne Diamond",
    t_elite_1: "Top-up bonuses",
    t_elite_2: "Birthday perks",
    t_elite_3: "Exclusive offers",
    t_priv_hint: "Emerald Stone",
    t_priv_1: "Premium offers",
    t_priv_2: "High priority",
    t_priv_3: "Milestone surprises",
    t_black_hint: "Onyx + Gold",
    t_black_1: "VIP support",
    t_black_2: "Rare offers",
    t_black_3: "First access (optional)",
    progress_title: "Status & progress",
    progress_sub: "Like airlines: see where you are and what's left for the next tier. Real status is shown only from a verified member account.",
    progress_wallet_title: "Your wallet",
    progress_wallet_desc: "Balance, top-ups, redemptions, and gifts received.",
    progress_balance: "Balance",
    progress_next: "Next tier",
    progress_activity_title: "Activity",
    progress_activity_desc: "Every action time-stamped, like a private bank account.",
    act1: "Wallet top-up",
    act2: "Station redemption",
    act3: "Gift received",
    ass1: "Transaction records",
    ass2: "Real-time alerts",
    ass3: "Account verification (optional)",
    moments_title: "PetWash Prestige Moments",
    moments_sub: "Only approved brand assets belong here: pets, cleanliness, clean design, and a luxury brand feel. No demo imagery or unapproved promises.",
    mom1: "Pure white, calm light, premium care",
    mom2: "Black and gold, jewel accents, membership feel",
    pay_title: "Secure payment & redemption",
    pay_sub: "Card payment, wallet top-up, and QR redemption at stations or kiosks, with organized records.",
    pay_a1: "Encryption",
    pay_a2: "Access management",
    pay_a3: "Tracking & invoices",
    how_title: "How it works",
    how_sub: "Clear, short process. No hassle.",
    how1_t: "1. Join",
    how1_d: "Open a member account, receive a digital ID.",
    how2_t: "2. Load or buy",
    how2_d: "Top up your wallet or purchase a digital gift.",
    how3_t: "3. Use",
    how3_d: "Book services or redeem at stations according to your process.",
    how4_t: "4. Accumulate",
    how4_d: "Status and advantages unlock as you progress.",
    legal_title: "Approval & transparency",
    legal_p1: "Submitting interest is not membership approval and does not issue a Wallet pass. Membership, benefits and balances activate only after Pet Wash Ltd verification and approval.",
    legal_p2: "Insurance, K9000 coverage, commercial terms and internal company information appear publicly only in approved wording. Premiums, costs, company documents and confidential details are never shown on public pages.",
    contact_title: "Quick links",
    metal_name: "Nir Hadad",
    metal_sub: "Active member · Gold tier · Since 2024",
    metal_balance: "Balance",
    metal_washes: "Washes",
    modal_h3: "Description",
    modal_h3_2: "Suggested UI content",
    modal_copy: "Create a luxury feel here: short, clean explanation with a clear promise. No cheap words. No childish icons.",
    modal_hint: "Tip: Use real high-quality background images. Avoid cheap stock. Better few images but perfect.",
  },
};

interface TierData {
  id: string;
  name: { he: string; en: string };
  gem: string;
  plateClass: string;
  hint: string;
  items: string[];
  desc: { he: string; en: string };
  bullets: { he: string[]; en: string[] };
}

const TIERS: TierData[] = [
  {
    id: 'pearl',
    name: { he: 'Pearl', en: 'Pearl' },
    gem: 'gold',
    plateClass: 'pc-platePearl',
    hint: 't_pearl_hint',
    items: ['t_pearl_1', 't_pearl_2', 't_pearl_3'],
    desc: { he: 'דרגת כניסה אלגנטית לאחר בקשת עניין, אימות ואישור. גישה בסיסית לארנק דיגיטלי, מתנות ומעקב נפתחת רק לחבר מאושר.', en: 'Elegant entry tier after interest, verification and approval. Basic wallet, gifts and tracking open only for an approved member.' },
    bullets: { he: ['בקשת עניין 18+', 'גישה לארנק דיגיטלי לאחר אישור', 'מתנות דיגיטליות', 'היסטוריית פעילות'], en: ['18+ interest application', 'Digital wallet access after approval', 'Digital gifts', 'Activity history'] },
  },
  {
    id: 'signature',
    name: { he: 'Signature', en: 'Signature' },
    gem: 'platinum',
    plateClass: 'pc-platePlatinum',
    hint: 't_sig_hint',
    items: ['t_sig_1', 't_sig_2', 't_sig_3'],
    desc: { he: 'חברי Signature נהנים מקדימות בהזמנות והצעות מותאמות.', en: 'Signature members enjoy booking priority and tailored offers.' },
    bullets: { he: ['קדימות בהזמנות', 'הצעות ממוקדות', 'צבירה מהירה יותר', 'התראות מותאמות'], en: ['Booking priority', 'Targeted offers', 'Faster accumulation', 'Tailored notifications'] },
  },
  {
    id: 'elite',
    name: { he: 'Elite', en: 'Elite' },
    gem: 'diamond',
    plateClass: 'pc-plateDiamond',
    hint: 't_elite_hint',
    items: ['t_elite_1', 't_elite_2', 't_elite_3'],
    desc: { he: 'חברי Elite מקבלים בונוסים על כל טעינה, הטבות יום הולדת והצעות בלעדיות.', en: 'Elite members get top-up bonuses, birthday perks, and exclusive offers.' },
    bullets: { he: ['בונוסים על טעינה', 'הטבות יום הולדת', 'הצעות בלעדיות', 'צבירה כפולה (אופציונלי)'], en: ['Top-up bonuses', 'Birthday perks', 'Exclusive offers', 'Double accumulation (optional)'] },
  },
  {
    id: 'privilege',
    name: { he: 'Privilege', en: 'Privilege' },
    gem: 'emerald',
    plateClass: 'pc-plateEmerald',
    hint: 't_priv_hint',
    items: ['t_priv_1', 't_priv_2', 't_priv_3'],
    desc: { he: 'למשפחות קבועות. יותר הטבות, יותר אקסקלוסיביות.', en: 'For consistent families. More advantages and exclusivity.' },
    bullets: { he: ['הצעות פרימיום', 'קדימות גבוהה', 'הפתעות milestone', 'הטבות שותפים (אופציונלי)'], en: ['Premium offers', 'Higher priority', 'Milestone surprises', 'Partner perks (optional)'] },
  },
  {
    id: 'black',
    name: { he: 'Black Reserve', en: 'Black Reserve' },
    gem: 'gold',
    plateClass: 'pc-plateOnyx',
    hint: 't_black_hint',
    items: ['t_black_1', 't_black_2', 't_black_3'],
    desc: { he: 'דרגת יוקרה עליונה. מיועדת למספר מוגבל של חברים.', en: 'Top prestige tier. Reserved for a limited set of members.' },
    bullets: { he: ['תמיכה VIP', 'הצעות נדירות', 'אירועים פרטיים (אופציונלי)', 'גישה ראשונה להשקות (אופציונלי)'], en: ['VIP support', 'Rare offers', 'Private events (optional)', 'First access (optional)'] },
  },
];

const TIER_CYCLE = [
  { label: 'CHAMPAGNE DIAMOND', badge: 'Elite', color: '#B89A4D' },
  { label: 'EMERALD STONE', badge: 'Privilege', color: '#0F5E4A' },
  { label: 'SAPPHIRE CRYSTAL', badge: 'Signature', color: '#0E2F5A' },
  { label: 'PLATINUM', badge: 'Signature', color: '#C9C9C9' },
  { label: 'ONYX + GOLD', badge: 'Black Reserve', color: '#C6A75E' },
];

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`pc-reveal ${visible ? 'pc-on' : ''} ${className}`}>
      {children}
    </div>
  );
}

export default function PrestigeClub() {
  const { language: appLang } = useLanguage();
  const isRTL = appLang === 'he' || appLang === 'ar';
  const lang: Lang = (appLang === 'en' || appLang === 'fr' || appLang === 'es' || appLang === 'ru') ? 'en' : 'he';
  const i = useCallback((key: string) => dict[lang]?.[key] ?? dict.he[key] ?? key, [lang]);

  const [tierIdx, setTierIdx] = useState(0);
  const [modalTier, setModalTier] = useState<TierData | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTierIdx((prev) => (prev + 1) % TIER_CYCLE.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalTier(null);
    };
    if (modalTier) {
      document.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [modalTier]);

  const currentCycle = TIER_CYCLE[tierIdx];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Layout language={appLang} onLanguageChange={() => {}}>
      <div className="pc-page" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* SUB-NAV */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          backdropFilter: 'blur(14px)',
          background: 'rgba(248,248,246,.72)',
          borderBottom: '1px solid rgba(11,11,13,.08)',
        }}>
          <div className="pc-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 12,
                background: 'radial-gradient(12px 12px at 30% 30%, rgba(255,255,255,.20), transparent 60%), linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,0)), #0B0B0D',
                border: '1px solid rgba(198,167,94,.35)',
                boxShadow: '0 14px 30px rgba(11,11,13,.18)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: '-60%',
                  background: 'linear-gradient(115deg, transparent 42%, rgba(198,167,94,.35) 50%, transparent 58%)',
                  animation: 'pc-sheen 8s ease-in-out infinite',
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.05 }}>
                <strong style={{ fontSize: 14, letterSpacing: '.1px' }}>PetWash</strong>
                <span style={{ fontSize: 12, color: 'var(--pc-ink3)', fontWeight: 600 }}>{i('brandSub')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--pc-ink2)', fontWeight: 650, fontSize: 13, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href="#about" onClick={(e) => { e.preventDefault(); scrollTo('about'); }} style={{ padding: '10px 12px', borderRadius: 12 }}>{i('nav_about')}</a>
              <a href="#benefits" onClick={(e) => { e.preventDefault(); scrollTo('benefits'); }} style={{ padding: '10px 12px', borderRadius: 12 }}>{i('nav_benefits')}</a>
              <a href="#tiers" onClick={(e) => { e.preventDefault(); scrollTo('tiers'); }} style={{ padding: '10px 12px', borderRadius: 12 }}>{i('nav_tiers')}</a>
              <a href="#moments" onClick={(e) => { e.preventDefault(); scrollTo('moments'); }} style={{ padding: '10px 12px', borderRadius: 12 }}>{i('nav_moments')}</a>
              <a href="#payments" onClick={(e) => { e.preventDefault(); scrollTo('payments'); }} style={{ padding: '10px 12px', borderRadius: 12 }}>{i('nav_payments')}</a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', minWidth: 220 }}>
              <Link href="/prestige/waitlist">
                <Button className="pc-btn pc-btnPrimary">{i('join_free')}</Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="pc-hero">
          <div className="pc-wrap">
            <div className="pc-heroGrid">

              {/* Left: content card */}
              <div className="pc-card">
                <div className="pc-cardPad">
                  <div className="pc-kicker">
                    <span className="pc-pill"><span className="pc-dot" />{i('hero_kicker')}</span>
                    <span className="pc-pill" style={{ background: 'rgba(198,167,94,.06)', borderColor: 'rgba(198,167,94,.22)' }}>{i('hero_kicker2')}</span>
                  </div>
                  <h1 className="pc-h1">{i('hero_title')}</h1>
                  <p className="pc-lead">{i('hero_lead')}</p>

                  <div className="pc-heroActions">
                    <Link href="/prestige/waitlist">
                      <Button className="pc-btn pc-btnPrimary">{i('cta_open_app')}</Button>
                    </Link>
                    <Link href="/egift">
                      <Button className="pc-btn">{i('cta_gift')}</Button>
                    </Link>
                    <Link href="/sitter-suite">
                      <Button className="pc-btn">{i('cta_services')}</Button>
                    </Link>
                  </div>

                  <div className="pc-microRow">
                    <div className="pc-mini">
                      <Shield size={14} />
                      <span>{i('micro_secure')}</span>
                    </div>
                    <div className="pc-mini">
                      <Lock size={14} />
                      <span>{i('micro_receipts')}</span>
                    </div>
                    <div className="pc-mini">
                      <Wallet size={14} />
                      <span>{i('micro_wallet')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: metal membership card */}
              <div className="pc-metalWrap">
                <div className="pc-metalTop">
                  <div className="pc-seal">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(198,167,94,.85)" strokeWidth="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                  </div>
                  <div className="pc-metalBrand">
                    ⁦PetWash™⁩
                    <span>PRESTIGE CLUB</span>
                  </div>
                </div>

                <div className="pc-metalMid">
                  <div className="pc-tierBadge">
                    <span className="pc-tierGem" style={{ background: currentCycle.color }} />
                    <span>{currentCycle.badge}</span>
                  </div>
                  <h2 className="pc-metalName">{i('metal_name')}</h2>
                  <p className="pc-metalSub">{i('metal_sub')}</p>
                </div>

                <div className="pc-metalBottom">
                  <div className="pc-metalStat">
                    <Label>{i('metal_balance')}</Label>
                    <strong>₪ 2,450</strong>
                  </div>
                  <div className="pc-metalStat">
                    <Label>{i('metal_washes')}</Label>
                    <strong>34</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section className="pc-section" id="about">
          <div className="pc-wrap">
            <div className="pc-sectionHead">
              <Reveal><h2 className="pc-h2">{i('about_title')}</h2></Reveal>
              <Reveal><p className="pc-sub">{i('about_sub')}</p></Reveal>
            </div>
            <div className="pc-grid4">
              {[
                { t: 'f1_title', d: 'f1_desc', icon: <Fingerprint size={16} style={{ color: '#C6A75E' }} /> },
                { t: 'f2_title', d: 'f2_desc', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A75E" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg> },
                { t: 'f3_title', d: 'f3_desc', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A75E" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> },
                { t: 'f4_title', d: 'f4_desc', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A75E" strokeWidth="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> },
              ].map((f, idx) => (
                <Reveal key={idx}>
                  <div className="pc-feature">
                    <div className="pc-featureTop">
                      <div className="pc-icon">{f.icon}</div>
                    </div>
                    <div className="pc-ftitle">{i(f.t)}</div>
                    <p className="pc-fdesc">{i(f.d)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="pc-section" id="benefits">
          <div className="pc-wrap">
            <div className="pc-sectionHead">
              <Reveal><h2 className="pc-h2">{i('benefits_title')}</h2></Reveal>
              <Reveal><p className="pc-sub">{i('benefits_sub')}</p></Reveal>
            </div>
            <div className="pc-grid4">
              {[
                { t: 'b1_title', d: 'b1_desc', icon: <Wallet size={16} style={{ color: '#C6A75E' }} /> },
                { t: 'b2_title', d: 'b2_desc', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A75E" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg> },
                { t: 'b3_title', d: 'b3_desc', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A75E" strokeWidth="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> },
                { t: 'b4_title', d: 'b4_desc', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6A75E" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> },
              ].map((b, idx) => (
                <Reveal key={idx}>
                  <div className="pc-feature">
                    <div className="pc-featureTop">
                      <div className="pc-icon">{b.icon}</div>
                    </div>
                    <div className="pc-ftitle">{i(b.t)}</div>
                    <p className="pc-fdesc">{i(b.d)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* TIERS */}
        <section className="pc-section" id="tiers">
          <div className="pc-wrap">
            <div className="pc-sectionHead">
              <Reveal><h2 className="pc-h2">{i('tiers_title')}</h2></Reveal>
              <Reveal><p className="pc-sub">{i('tiers_sub')}</p></Reveal>
            </div>

            <div className="pc-tierRow">
              {TIERS.map((tier) => (
                <Reveal key={tier.id}>
                  <div
                    className="pc-tierCard"
                    role="button"
                    tabIndex={0}
                    onClick={() => setModalTier(tier)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalTier(tier); } }}
                  >
                    <div className={`pc-tierPlate ${tier.plateClass}`} />
                    <div className="pc-tierBody">
                      <h3 className="pc-tierName">{tier.name[lang]}</h3>
                      <div className="pc-tierHint">{i(tier.hint)}</div>
                      <div className="pc-tierList">
                        {tier.items.map((item, idx) => (
                          <div key={idx} className="pc-tItem">
                            <span className="pc-check">✓</span>
                            <span>{i(item)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="pc-hr" />

            {/* Progress card */}
            <Reveal>
              <div className="pc-card">
                <div className="pc-cardPad">
                  <div className="pc-sectionHead" style={{ margin: 0 }}>
                    <h2 className="pc-h2">{i('progress_title')}</h2>
                    <p className="pc-sub">{i('progress_sub')}</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div className="pc-feature">
                      <div className="pc-ftitle">{i('progress_wallet_title')}</div>
                      <p className="pc-fdesc">{i('progress_wallet_desc')}</p>
                      <div className="pc-hr" />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div>
                          <div className="pc-muted">{i('progress_balance')}</div>
                          <div style={{ fontSize: 22, fontWeight: 950 }}>₪ 420</div>
                        </div>
                        <div>
                          <div className="pc-muted">{i('progress_next')}</div>
                          <div style={{ fontSize: 14, fontWeight: 900 }}>Privilege</div>
                        </div>
                      </div>
                    </div>

                    <div className="pc-feature">
                      <div className="pc-ftitle">{i('progress_activity_title')}</div>
                      <p className="pc-fdesc">{i('progress_activity_desc')}</p>
                      <div className="pc-hr" />
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span className="pc-muted">{i('act1')}</span><b>+ ₪200</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span className="pc-muted">{i('act2')}</span><b>- ₪55</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span className="pc-muted">{i('act3')}</span><b>+ ₪150</b>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pc-assuranceRow" style={{ marginTop: 14 }}>
                    <span className="pc-tag"><span className="pc-tagDot" />{i('ass1')}</span>
                    <span className="pc-tag"><span className="pc-tagDot" />{i('ass2')}</span>
                    <span className="pc-tag"><span className="pc-tagDot" />{i('ass3')}</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* MOMENTS */}
        <section className="pc-section" id="moments">
          <div className="pc-wrap">
            <div className="pc-sectionHead">
              <Reveal><h2 className="pc-h2">{i('moments_title')}</h2></Reveal>
              <Reveal><p className="pc-sub">{i('moments_sub')}</p></Reveal>
            </div>
            <div className="pc-gallery">
              <Reveal>
                <div className="pc-ph">
                  <div className="pc-imgBg" />
                  <div className="pc-imgNote">{i('mom1')}</div>
                </div>
              </Reveal>
              <Reveal>
                <div className="pc-ph">
                  <div className="pc-imgBg2" />
                  <div className="pc-imgNote">{i('mom2')}</div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* PAYMENTS */}
        <section className="pc-section" id="payments">
          <div className="pc-wrap">
            <div className="pc-sectionHead">
              <Reveal><h2 className="pc-h2">{i('pay_title')}</h2></Reveal>
              <Reveal><p className="pc-sub">{i('pay_sub')}</p></Reveal>
            </div>

            <Reveal>
              <div className="pc-payStrip" aria-label="Payment methods">
                {['VISA', 'Mastercard', 'AMEX', 'Apple Pay', 'Google Pay', 'QR'].map((pm) => (
                  <div key={pm} className="pc-payLogo"><span>{pm}</span></div>
                ))}
              </div>
            </Reveal>

            <Reveal>
              <div className="pc-assuranceRow">
                <span className="pc-tag"><span className="pc-tagDot" />{i('pay_a1')}</span>
                <span className="pc-tag"><span className="pc-tagDot" />{i('pay_a2')}</span>
                <span className="pc-tag"><span className="pc-tagDot" />{i('pay_a3')}</span>
              </div>
            </Reveal>

            <Reveal>
              <div className="pc-card" style={{ marginTop: 12 }}>
                <div className="pc-cardPad">
                  <div className="pc-sectionHead" style={{ margin: 0 }}>
                    <h2 className="pc-h2">{i('how_title')}</h2>
                    <p className="pc-sub">{i('how_sub')}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
                    {['how1', 'how2', 'how3', 'how4'].map((key) => (
                      <div key={key} className="pc-feature">
                        <div className="pc-ftitle">{i(`${key}_t`)}</div>
                        <p className="pc-fdesc">{i(`${key}_d`)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="pc-footer" id="terms">
          <div className="pc-wrap">
            <div className="pc-footerGrid">
              <div className="pc-footCard">
                <strong>{i('legal_title')}</strong>
                <p>{i('legal_p1')}</p>
                <p>{i('legal_p2')}</p>
              </div>
              <div className="pc-footCard">
                <strong>{i('contact_title')}</strong>
                <p style={{ marginTop: 10 }}>
                  <Link href="/loyalty" className="pc-muted" style={{ display: 'block' }}>/loyalty</Link>
                  <Link href="/egift" className="pc-muted" style={{ display: 'block' }}>/egift</Link>
                  <Link href="/sitter-suite" className="pc-muted" style={{ display: 'block' }}>/sitter-suite</Link>
                  <Link href="/" className="pc-muted" style={{ display: 'block' }}>Homepage</Link>
                </p>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="pc-muted">© {new Date().getFullYear()} PetWash. Prestige Club.</div>
            </div>
          </div>
        </footer>

        {/* TIER MODAL */}
        {modalTier && (
          <div
            className="pc-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Tier details"
            onClick={(e) => { if (e.target === e.currentTarget) setModalTier(null); }}
          >
            <div className="pc-modalPanel">
              <div className="pc-modalTop">
                <strong>{modalTier.name[lang]}</strong>
                <Button className="pc-xBtn" type="button" onClick={() => setModalTier(null)} aria-label="Close">✕</Button>
              </div>
              <div className="pc-modalBody">
                <div className="pc-modalGrid">
                  <div className="pc-modalCard">
                    <h3>{i('modal_h3')}</h3>
                    <p>{modalTier.desc[lang]}</p>
                    <ul className="pc-modalBullets">
                      {modalTier.bullets[lang].map((b, idx) => (
                        <li key={idx}>
                          <span className="pc-check">✓</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pc-modalCard">
                    <h3>{i('modal_h3_2')}</h3>
                    <p>{i('modal_copy')}</p>
                    <div className="pc-hr" />
                    <p className="pc-muted">{i('modal_hint')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
