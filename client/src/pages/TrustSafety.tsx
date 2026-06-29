import { Layout } from '@/components/Layout';
import { useEffect, useState } from 'react';
import { type Language } from '@/lib/i18n';
import { useSEO } from '@/lib/seo';
import {
  ShieldCheck,
  Ban,
  AlertTriangle,
  Clock,
  MessageSquareWarning,
  CreditCard,
  UserX,
  Link2Off,
  Mail,
  Phone,
  Lock,
} from 'lucide-react';

interface TrustSafetyProps {
  language: Language;
  onLanguageChange?: (language: Language) => void;
}

const GOLD = '#D4AF37';

export default function TrustSafety({ language }: TrustSafetyProps) {
  useSEO({
    title: 'Trust & Safety — Pet Wash™',
    description:
      'How Pet Wash™ protects you from scams, phishing and payment fraud. What we will never ask for, the warning signs, and how to report.',
  });
  const [lang, setLang] = useState<Language>(language);
  useEffect(() => setLang(language), [language]);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const he = lang === 'he';
  const dir = he ? 'rtl' : 'ltr';

  const neverAsk = he
    ? ['סיסמה', 'קוד OTP', 'קוד אימות ב-SMS', 'סיסמת בנק', 'קוד PIN מלא של כרטיס אשראי', 'ביטוי שחזור לארנק', 'מפתח ארנק קריפטו פרטי', 'גישה מרחוק למכשיר']
    : ['Your password', 'An OTP code', 'An SMS verification code', 'Your banking password', 'A full credit-card PIN', 'A wallet recovery phrase', 'A private crypto wallet key', 'Remote access to your device'];

  const neverRequire = he
    ? ['כרטיסי מתנה (gift cards)', 'מטבעות קריפטו', 'העברה בנקאית מחוץ לפלטפורמה למשתמש אחר', 'תשלום דרך קישורים אקראיים', 'אימות זהות באתרי צד-שלישי לא קשורים']
    : ['Gift cards', 'Cryptocurrency', 'A bank transfer outside Pet Wash™ to another user', 'Payment through random links', 'Identity verification on unrelated third-party websites'];

  const staySafe = he
    ? ['שמרו הזמנות ותשלומים בתוך Pet Wash™', 'אל תלחצו על קישורים חשודים', 'אל תשלחו כסף מחוץ לתשלום המאושר', 'דווחו מיד על התנהגות חריגה']
    : ['Keep bookings and payments inside Pet Wash™', 'Do not click suspicious links', 'Do not send money outside the approved checkout', 'Report unusual behaviour immediately'];

  const categories = [
    {
      icon: Clock,
      t: he ? 'לחץ ודחיפות' : 'Pressure & urgency',
      d: he
        ? '״שלם עכשיו או ההזמנה תבוטל״, ״אני צריך/ה את זה מיד״, ״העוזר/ת שלי ישלם/תשלם לך״.'
        : '“Pay now or your booking will be cancelled.” “I need this immediately.” “My assistant will pay you.”',
    },
    {
      icon: MessageSquareWarning,
      t: he ? 'תקשורת מחוץ לפלטפורמה' : 'Off-platform communication',
      d: he
        ? 'בקשות לעבור ל-WhatsApp, Telegram, SMS, אימייל פרטי, אתר חיצוני או הודעה ברשת חברתית.'
        : 'Requests to move to WhatsApp, Telegram, SMS, private email, an external website or a social-media DM.',
    },
    {
      icon: CreditCard,
      t: he ? 'ניצול תשלומים' : 'Payment abuse',
      d: he
        ? 'תשלום-יתר, החזר לחשבון אחר, העברה בנקאית מחוץ ל-Pet Wash™, gift cards, קריפטו, ״תשלום עתידי״, ״לא יכול/ה לשלם דרך הפלטפורמה״.'
        : 'Overpayment, refund to a different account, bank transfer outside Pet Wash™, gift cards, crypto, “future payment”, “I cannot pay through the platform”.',
    },
    {
      icon: UserX,
      t: he ? 'גניבת זהות' : 'Identity theft',
      d: he
        ? 'בקשה לתעודת זהות, פרטי כניסה לבנק, קוד אימות, סלפי מחוץ לתהליך הרשמי, או דרכון/רישיון דרך הצ׳אט.'
        : 'Requests for your ID, bank login, a verification code, a selfie outside the official process, or a passport/licence through chat.',
    },
    {
      icon: Link2Off,
      t: he ? 'קישורים מזויפים' : 'Fake links',
      d: he
        ? 'קישורים שמחקים את Pet Wash™ עם שגיאות כתיב (petvvash, petwash-payment, petwashwallet) או קודי QR מזויפים לתשלום.'
        : 'Links that imitate Pet Wash™ with misspellings (petvvash, petwash-payment, petwashwallet) or fake QR payment links.',
    },
  ];

  return (
    <Layout>
      <div dir={dir} style={{ background: '#fff', color: '#0a0a0a', minHeight: '100dvh' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(24px,5vw,56px) clamp(16px,4vw,32px)' }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(28px,5vw,48px)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 20, background: 'rgba(212,175,55,.12)', marginBottom: 18 }}>
              <ShieldCheck style={{ width: 34, height: 34, color: GOLD }} />
            </div>
            <h1 style={{ fontSize: 'clamp(28px,5vw,44px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
              {he ? 'אמון ובטיחות' : 'Trust & Safety'}
            </h1>
            <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: '#555', lineHeight: 1.6, maxWidth: 620, margin: '0 auto' }}>
              {he
                ? 'אנו מגנים על החברים, נותני השירות, התשלומים והזהות שלכם מפני הונאות, התחזות ופישינג. הנה מה שחשוב לדעת.'
                : 'We protect our members, providers, payments and identity from fraud, impersonation and phishing. Here is what matters most.'}
            </p>
          </div>

          {/* Never ask / Never require — two luxe panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(16px,3vw,24px)', marginBottom: 'clamp(24px,4vw,40px)' }}>
            <Panel
              icon={<Lock style={{ width: 22, height: 22, color: GOLD }} />}
              title={he ? 'Pet Wash™ לעולם לא תבקש' : 'Pet Wash™ will never ask for'}
              items={neverAsk}
              he={he}
            />
            <Panel
              icon={<Ban style={{ width: 22, height: 22, color: GOLD }} />}
              title={he ? 'Pet Wash™ לעולם לא תדרוש' : 'Pet Wash™ will never require'}
              items={neverRequire}
              he={he}
            />
          </div>

          {/* Stay safe strip */}
          <div style={{ background: '#0a0a0a', color: '#fff', borderRadius: 18, padding: 'clamp(20px,4vw,32px)', marginBottom: 'clamp(28px,5vw,48px)' }}>
            <h2 style={{ fontSize: 'clamp(18px,2.4vw,24px)', fontWeight: 700, margin: '0 0 16px', color: GOLD }}>
              {he ? 'איך להישאר בטוחים' : 'How to stay safe'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12 }}>
              {staySafe.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: 18, height: 18, color: GOLD, flexShrink: 0, marginTop: 2 }} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scam warning categories */}
          <h2 style={{ fontSize: 'clamp(20px,3vw,30px)', fontWeight: 800, textAlign: 'center', margin: '0 0 8px' }}>
            {he ? 'סימני אזהרה להונאה' : 'Scam warning signs'}
          </h2>
          <p style={{ textAlign: 'center', color: '#666', margin: '0 0 clamp(20px,4vw,32px)' }}>
            {he ? 'אם נתקלתם באחד מאלה — עצרו ודווחו.' : 'If you see any of these — stop and report.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 'clamp(14px,2.5vw,20px)', marginBottom: 'clamp(28px,5vw,48px)' }}>
            {categories.map(({ icon: Icon, t, d }, i) => (
              <div key={i} style={{ border: '1px solid #eee', borderRadius: 16, padding: 'clamp(18px,3vw,24px)', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'inline-flex', width: 40, height: 40, borderRadius: 12, background: 'rgba(212,175,55,.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 20, height: 20, color: GOLD }} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{t}</h3>
                </div>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>

          {/* Report CTA */}
          <div style={{ border: `1.5px solid ${GOLD}`, borderRadius: 18, padding: 'clamp(22px,4vw,32px)', textAlign: 'center', background: 'rgba(212,175,55,.05)' }}>
            <AlertTriangle style={{ width: 30, height: 30, color: GOLD, margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: 'clamp(19px,2.6vw,26px)', fontWeight: 800, margin: '0 0 8px' }}>
              {he ? 'ראיתם משהו חשוד?' : 'Saw something suspicious?'}
            </h2>
            <p style={{ color: '#555', margin: '0 0 18px', fontSize: 15 }}>
              {he ? 'דווחו לנו מיד — אנחנו כאן בשבילכם.' : 'Report it to us right away — we are here for you.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              <a href="mailto:Support@PetWash.co.il" style={ctaStyle()}>
                <Mail style={{ width: 18, height: 18 }} /> Support@PetWash.co.il
              </a>
              <a href="tel:+972549833355" style={ctaStyle(true)} dir="ltr">
                <Phone style={{ width: 18, height: 18 }} /> +972 54 983 3355
              </a>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}

function Panel({ icon, title, items, he }: { icon: React.ReactNode; title: string; items: string[]; he: boolean }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 16, padding: 'clamp(18px,3vw,24px)', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {icon}
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5, color: '#333' }}>
            <Ban style={{ width: 16, height: 16, color: '#c0392b', flexShrink: 0, marginTop: 2 }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ctaStyle(filled = false): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
    padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 15,
    minHeight: 48, boxSizing: 'border-box',
    background: filled ? GOLD : '#0a0a0a', color: filled ? '#0a0a0a' : '#fff',
  };
}
