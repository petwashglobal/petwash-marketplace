/**
 * Franchise — public marketing page for PetWash franchise program.
 *
 * Owner direction 2026-05-24: the previous version of this page carried
 * invented numbers and empty testimonial/location arrays that read as fake.
 * Under Israeli consumer-protection + Israeli franchise-disclosure law,
 * publishing made-up financial projections on a public page is at best
 * misleading and at worst illegal. Killed completely.
 *
 * This new version is luxury, honest, no invented numbers, no fake
 * testimonials. The brand pillar (skill §0) drives every word:
 *   Easy > Safe > Clean > Premium > Modern > Trusted > Eco-conscious.
 *
 * Hard rules followed:
 *   - NO revenue projections.
 *   - NO claimed average financial return.
 *   - NO empty-array testimonial / location arrays.
 *   - NO "X stations sold" / "Y partners onboarded" stats.
 *   - NO greenwashing / activist tone (skill §0.4).
 *   - Eco appears ONLY as a supporting proof bullet, never headline.
 *   - Real CTA: "Request information" routes to a Google Form / email
 *     and explicitly says investment terms shared on application.
 */

import { useState, type ComponentType } from 'react';
import { useLocation } from 'wouter';
import { type Language } from '@/lib/i18n';
import { Layout } from '@/components/Layout';
import { useSEO, pageSEO } from '@/lib/seo';
import {
  Crown, Building2, Wrench, Shield, MapPin, GraduationCap,
  Sparkles, CheckCircle2, Mail, FileText, ArrowRight, Phone,
} from 'lucide-react';

interface FranchiseProps {
  language: Language;
  onLanguageChange?: (language: Language) => void;
}

// Copy lives inline (English + Hebrew). i18n.ts entries can be added later
// for ru/fr/es/ar — kept local while we lock down wording.
const COPY = {
  en: {
    eyebrow: 'PetWash™ Franchise Program',
    h1: 'Modern urban pet-care infrastructure.',
    h1b: 'Built city by city.',
    intro:
      'PetWash brings premium self-service dog wash stations and a connected pet-care platform to dense urban neighborhoods. We are accepting expressions of interest from operators, real-estate partners, and municipalities for our 2026–2027 deployments.',
    ctaPrimary: 'Request the information pack',
    ctaSecondary: 'Speak with the franchise team',
    pillsTitle: 'What you get',
    pills: [
      { icon: Building2, title: 'Premium dual-bay station', body: 'Engineered, certified, and installed by PetWash. Includes warranty, spare parts pipeline, and live operational monitoring.' },
      { icon: Wrench, title: 'Software + payments layer', body: 'Customer app, booking, loyalty, e-gift, Nayax-based card terminal, and the K9000 station controller — all maintained centrally by PetWash.' },
      { icon: Shield, title: 'Brand + support', body: 'Brand kit, signage, training, station deployment runbook, and a real support desk. You operate locally; PetWash maintains the system.' },
      { icon: Sparkles, title: 'Consumables supply', body: 'Australian-made shampoo, conditioner, and tea-tree oil supplied through the PetWash supplier channel. No sourcing required.' },
    ],
    fiveTruthsTitle: 'Five truths that drive PetWash',
    fiveTruths: [
      { title: 'Human convenience', body: 'Older customers, apartment residents, families, renters, and anyone who cannot safely wash a dog at home.' },
      { title: 'Pet safety and comfort', body: 'A calm, controlled, clean, pet-safe experience. Soft water, gentle products, trained operators.' },
      { title: 'Premium lifestyle', body: 'Modern, restrained, design-led. Every customer surface must feel calm, premium, clear, and trustworthy.' },
      { title: 'Urban infrastructure value', body: 'Helps cities, councils, commercial centers, and residential towers offer a cleaner organized pet-care service.' },
      { title: 'Environmental + ecological value', body: 'Controlled washing instead of random home or street washing. Less dog hair in shared plumbing. Pet-safe, pet-formulated products. Cleaner shared apartment living.' },
    ],
    processTitle: 'How a deployment happens',
    process: [
      { step: '01', title: 'Expression of interest', body: 'You submit a short application — capital range, target city, real-estate access, timeline.' },
      { step: '02', title: 'Site + commercial review', body: 'PetWash team reviews the proposed location, foot-traffic, infrastructure, and economics with you. Investment terms and the full information pack are shared at this step.' },
      { step: '03', title: 'Agreement + commitment', body: 'NDA, partner agreement, site survey, training plan, supply/support responsibilities, insurance evidence, and operational hand-off.' },
      { step: '04', title: 'Deployment + opening', body: 'Station fabrication, installation, software activation, soft launch. Ongoing support from the PetWash team.' },
    ],
    eligibilityTitle: 'Who this is for',
    eligibility: [
      'Operators with capital + commitment to a multi-year program.',
      'Real-estate partners with access to high-traffic urban sites (residential complexes, shopping centers, transit-adjacent retail).',
      'Municipalities and city councils interested in offering pet-care amenity infrastructure.',
      'Commercial-center owners adding modern resident services.',
    ],
    notForTitle: 'Not a fit if you want',
    notFor: [
      'Quick-flip / short-hold investments. PetWash deployments are multi-year.',
      'A box-only deal with zero local responsibility. Approved operators are hands-on.',
      'A side-hustle. The station + software + supply + brand layer is a real operating business.',
    ],
    citiesTitle: 'Cities accepting interest',
    citiesBody:
      'Israel-first deployment focus. We are reviewing site proposals in:',
    cities: ['Tel Aviv', 'Ramat Gan', 'Givatayim', 'Herzliya', 'Haifa', 'Jerusalem', 'Beer Sheva', 'Netanya', 'Rishon LeZion', 'Petah Tikva'],
    citiesFooter: 'Other cities considered case by case. Any non-Israel activity requires separate legal/accountant/owner review.',
    legalTitle: 'Important — what we do NOT publish on this page',
    legal: [
      'We do not publish revenue projections, average-customer assumptions, or return claims on a public page.',
      'Every commercial figure is shared during the site-review step with NDA — that is the responsible way to discuss franchise economics.',
      'Earlier versions of this page included hardcoded finance assumptions. That has been removed; we do not present invented data as fact.',
    ],
    contactTitle: 'Talk to the franchise team',
    contactBody:
      'Send a short note. Include the target city, your relationship to the location (operator / real estate / municipality), and your timeline. We respond within five business days.',
    contactEmail: 'franchise@petwash.co.il',
  },
  he: {
    eyebrow: 'תכנית הזיכיון של PetWash™',
    h1: 'תשתית עירונית מודרנית לטיפוח חיות מחמד.',
    h1b: 'נבנית עיר אחר עיר.',
    intro:
      'PetWash מביאה תחנות רחצה פרימיום לשירות עצמי ופלטפורמת טיפוח מקושרת לשכונות עירוניות צפופות. אנו מקבלים פניות מבעלי עניין — מפעילים, שותפי נדל"ן ורשויות מקומיות — לפריסות 2026–2027.',
    ctaPrimary: 'בקש את חבילת המידע',
    ctaSecondary: 'דבר עם צוות הזיכיון',
    pillsTitle: 'מה אתה מקבל',
    pills: [
      { icon: Building2, title: 'תחנת רחצה דו-תאית פרימיום', body: 'מהונדסת, מאושרת ומותקנת על-ידי PetWash. כולל אחריות, צינור חלפים, וניטור תפעולי חי.' },
      { icon: Wrench, title: 'תוכנה + תשלומים', body: 'אפליקציית לקוח, הזמנות, נאמנות, גיפט, מסוף Nayax, ובקר תחנת K9000 — תחזוקה מרוכזת ב-PetWash.' },
      { icon: Shield, title: 'מותג + תמיכה', body: 'ערכת מותג, שילוט, הדרכה, רוֹנְבּוּקוֹת פריסה, ודלפק תמיכה אמיתי. אתה מפעיל מקומית; PetWash מתחזק את המערכת.' },
      { icon: Sparkles, title: 'אספקת מתכלים', body: 'שמפו מתוצרת אוסטרליה, מרכך, ושמן עץ התה דרך ערוץ הספקים של PetWash. אין צורך בגיוס ספקים.' },
    ],
    fiveTruthsTitle: 'חמש האמיתות שמניעות את PetWash',
    fiveTruths: [
      { title: 'נוחות אנושית', body: 'לקוחות מבוגרים, דיירי דירות, משפחות, שוכרים, וכל מי שאינו יכול לרחוץ כלב בבית בצורה בטוחה.' },
      { title: 'בטיחות ונוחות החיה', body: 'חוויה רגועה, נקייה, מבוקרת ובטוחה. מים רכים, מוצרים עדינים, מפעילים מיומנים.' },
      { title: 'אורח חיים פרימיום', body: 'מודרני, מאופק ומובל-עיצוב. כל ממשק לקוח חייב להרגיש רגוע, יוקרתי, ברור ואמין.' },
      { title: 'ערך תשתית עירונית', body: 'מסייע לערים, רשויות, מרכזים מסחריים ומגדלי מגורים להציע שירות מסודר ונקי לבעלי חיות מחמד.' },
      { title: 'ערך סביבתי ואקולוגי', body: 'רחצה מבוקרת במקום רחצת רחוב או בית מאולתרת. פחות שיער כלבים באינסטלציה משותפת. מוצרים ייעודיים לחיות מחמד. סביבה משותפת נקייה יותר.' },
    ],
    processTitle: 'איך פריסה מתבצעת',
    process: [
      { step: '01', title: 'הבעת עניין', body: 'אתה ממלא טופס קצר — טווח הון, עיר יעד, גישה לנדל"ן, לוח זמנים.' },
      { step: '02', title: 'סקירת אתר ועסקה', body: 'צוות PetWash סוקר את המיקום המוצע, תנועת קהל, תשתית, וכלכלה. תנאי ההשקעה וחבילת המידע המלאה משותפים בשלב זה.' },
      { step: '03', title: 'הסכם והתחייבות', body: 'הסכם זיכיון סטנדרטי, סקר אתר, תכנית הדרכה, מעבר תפעולי.' },
      { step: '04', title: 'פריסה ופתיחה', body: 'ייצור תחנה, התקנה, הפעלת תוכנה, השקה רכה. תמיכה שוטפת מצוות PetWash.' },
    ],
    eligibilityTitle: 'למי זה מתאים',
    eligibility: [
      'מפעילים עם הון ומחויבות לתכנית רב-שנתית.',
      'שותפי נדל"ן עם גישה לאתרים עירוניים עתירי תנועה (מתחמי מגורים, מרכזים מסחריים, מסחר סמוך לתחבורה).',
      'רשויות מקומיות וועדות עיריות המעוניינות בשירות תשתיתי לטיפוח חיות מחמד.',
      'בעלי מרכזים מסחריים שמוסיפים שירותים מודרניים לדיירים.',
    ],
    notForTitle: 'לא מתאים אם אתה רוצה',
    notFor: [
      'השקעה למכירה מהירה / החזקה קצרה. פריסות PetWash הן רב-שנתיות.',
      'זיכיון "בקופסה" בלי מעורבות מקומית. מפעילים מעורבים בפועל.',
      'הכנסה צדדית. השילוב של תחנה + תוכנה + אספקה + מותג הוא עסק תפעולי אמיתי.',
    ],
    citiesTitle: 'ערים שמקבלות פניות',
    citiesBody: 'התמקדות בפריסה בישראל. אנו סוקרים הצעות אתר ב:',
    cities: ['תל אביב', 'רמת גן', 'גבעתיים', 'הרצליה', 'חיפה', 'ירושלים', 'באר שבע', 'נתניה', 'ראשון לציון', 'פתח תקווה'],
    citiesFooter: 'ערים נוספות נשקלות לפי מקרה. התרחבות בינלאומית מ-2027 ואילך.',
    legalTitle: 'חשוב — מה אנחנו לא מפרסמים בעמוד זה',
    legal: [
      'אנו לא מפרסמים תחזיות הכנסה, הנחות לקוחות ממוצעים או טענות תשואה בעמוד ציבורי.',
      'כל נתון מסחרי משותף בשלב סקירת האתר תחת NDA — זו הדרך האחראית לדון בכלכלת זיכיון.',
      'גרסאות קודמות של עמוד זה כללו הנחות פיננסיות קבועות. הוסר; אנו לא מציגים נתונים בדויים כעובדה.',
    ],
    contactTitle: 'דבר עם צוות הזיכיון',
    contactBody: 'שלח הודעה קצרה. כלול עיר יעד, יחסך למיקום (מפעיל / נדל"ן / רשות), ולוח הזמנים שלך. נחזיר בתוך חמישה ימי עסקים.',
    contactEmail: 'franchise@petwash.co.il',
  },
} as const;

export default function Franchise({ language, onLanguageChange }: FranchiseProps) {
  useSEO(pageSEO.franchise);
  const [, setLocation] = useLocation();
  const he = language === 'he';
  const c = he ? COPY.he : COPY.en;
  const [submitted, setSubmitted] = useState(false);

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen bg-white text-slate-900" dir={he ? 'rtl' : 'ltr'}>
        <style>{styles()}</style>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="fr-hero">
          <div className="fr-frame">
            <button type="button" className="fr-back" onClick={() => setLocation('/')}>
              ← {he ? 'חזרה' : 'Back'}
            </button>
            <div className="fr-eyebrow">
              <Crown size={14} aria-hidden /> {c.eyebrow}
            </div>
            <h1 className="fr-h1">
              {c.h1}<br />
              <span className="fr-gold">{c.h1b}</span>
            </h1>
            <p className="fr-intro">{c.intro}</p>
            <div className="fr-ctaRow">
              <a className="fr-cta fr-cta--primary" href={`mailto:${c.contactEmail}?subject=${encodeURIComponent('PetWash Franchise — Information Pack Request')}`}>
                <FileText size={18} aria-hidden /> {c.ctaPrimary}
              </a>
              <a className="fr-cta fr-cta--secondary" href={`mailto:${c.contactEmail}?subject=${encodeURIComponent('PetWash Franchise — Talk')}`}>
                <Phone size={18} aria-hidden /> {c.ctaSecondary}
              </a>
            </div>
          </div>
        </section>

        {/* ── What you get ─────────────────────────────────────────────────── */}
        <section className="fr-section">
          <div className="fr-frame">
            <h2 className="fr-h2">{c.pillsTitle}</h2>
            <div className="fr-pills">
              {c.pills.map(({ icon: Icon, title, body }) => (
                <div key={title} className="fr-pill">
                  <Icon className="fr-pillIcon" aria-hidden />
                  <div className="fr-pillTitle">{title}</div>
                  <p className="fr-pillBody">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Five truths (brand pillar) ───────────────────────────────────── */}
        <section className="fr-section fr-section--alt">
          <div className="fr-frame">
            <h2 className="fr-h2">{c.fiveTruthsTitle}</h2>
            <ol className="fr-truths">
              {c.fiveTruths.map((t, i) => (
                <li key={t.title} className="fr-truth">
                  <span className="fr-truthNum">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <div className="fr-truthTitle">{t.title}</div>
                    <p className="fr-truthBody">{t.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Process ──────────────────────────────────────────────────────── */}
        <section className="fr-section">
          <div className="fr-frame">
            <h2 className="fr-h2">{c.processTitle}</h2>
            <div className="fr-steps">
              {c.process.map((p) => (
                <div key={p.step} className="fr-step">
                  <span className="fr-stepNum">{p.step}</span>
                  <div className="fr-stepTitle">{p.title}</div>
                  <p className="fr-stepBody">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Eligibility + not-for ────────────────────────────────────────── */}
        <section className="fr-section fr-section--alt">
          <div className="fr-frame fr-twoCol">
            <div>
              <h2 className="fr-h2">{c.eligibilityTitle}</h2>
              <ul className="fr-list">
                {c.eligibility.map((row) => (
                  <li key={row}><CheckCircle2 className="fr-check" aria-hidden /> {row}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="fr-h2 fr-h2--muted">{c.notForTitle}</h2>
              <ul className="fr-list fr-list--muted">
                {c.notFor.map((row) => (
                  <li key={row}>— {row}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Cities ───────────────────────────────────────────────────────── */}
        <section className="fr-section">
          <div className="fr-frame">
            <h2 className="fr-h2"><MapPin size={20} aria-hidden /> {c.citiesTitle}</h2>
            <p className="fr-pillBody fr-mb16">{c.citiesBody}</p>
            <ul className="fr-cities">
              {c.cities.map((city) => (
                <li key={city} className="fr-cityChip">{city}</li>
              ))}
            </ul>
            <p className="fr-pillBody fr-mt16 fr-muted">{c.citiesFooter}</p>
          </div>
        </section>

        {/* ── Legal disclosure ─────────────────────────────────────────────── */}
        <section className="fr-section fr-section--alt">
          <div className="fr-frame fr-legal">
            <h2 className="fr-h2"><Shield size={20} aria-hidden /> {c.legalTitle}</h2>
            <ul className="fr-list">
              {c.legal.map((row) => (
                <li key={row}>— {row}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        <section className="fr-section">
          <div className="fr-frame fr-contact">
            <h2 className="fr-h2">{c.contactTitle}</h2>
            <p className="fr-pillBody">{c.contactBody}</p>
            <div className="fr-ctaRow">
              <a className="fr-cta fr-cta--primary" href={`mailto:${c.contactEmail}?subject=${encodeURIComponent('PetWash Franchise — Application')}&body=${encodeURIComponent('City:\n\nRole (operator / real estate / municipality):\n\nTimeline:\n\nCapital range (NIS):\n\nReal-estate access:\n\nBrief background:')}`}>
                <Mail size={18} aria-hidden /> {c.contactEmail}
              </a>
            </div>
            {submitted && <div className="fr-toast">Thank you — we'll be in touch.</div>}
            <button type="button" className="fr-tinyLink" onClick={() => setSubmitted(false)}>
              <ArrowRight size={12} aria-hidden /> petwash.co.il/franchise
            </button>
          </div>
        </section>
      </div>
    </Layout>
  );
}

function styles() {
  return `
    .fr-hero{ background:linear-gradient(180deg,#fff 0,#fafaf9 100%); padding:64px 0 88px; }
    .fr-frame{ max-width:1200px; margin:0 auto; padding:0 clamp(20px,4vw,40px); }
    .fr-back{ background:none; border:0; color:#64748b; font-weight:600; padding:8px 0; cursor:pointer; margin-bottom:24px }
    .fr-eyebrow{ display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#9d6f23; padding:8px 14px; border:1px solid #e7d4a0; border-radius:999px; background:linear-gradient(180deg,#fffdf6,#fdf5dc) }
    .fr-h1{ font-family:"Playfair Display",Georgia,serif; font-size:clamp(38px,5.5vw,72px); line-height:1.04; letter-spacing:-.025em; margin:24px 0 18px; color:#0b1220; font-weight:600 }
    .fr-gold{ background:linear-gradient(120deg,#d8ad55,#9d6f23 60%,#6e4a1a); -webkit-background-clip:text; background-clip:text; color:transparent }
    .fr-intro{ font-size:clamp(16px,1.4vw,18px); line-height:1.65; color:#475569; max-width:760px; margin:0 0 32px }
    .fr-ctaRow{ display:flex; flex-wrap:wrap; gap:12px }
    .fr-cta{ display:inline-flex; align-items:center; gap:10px; padding:14px 22px; border-radius:14px; font-weight:800; font-size:14.5px; text-decoration:none; min-height:54px; transition:transform .15s ease, box-shadow .15s ease }
    .fr-cta--primary{ background:#0b1220; color:#fff; box-shadow:0 12px 30px rgba(11,18,32,.2) }
    .fr-cta--primary:hover{ transform:translateY(-1px); box-shadow:0 18px 44px rgba(11,18,32,.28) }
    .fr-cta--secondary{ background:#fff; color:#0b1220; border:1px solid #e2e8f0 }
    .fr-cta--secondary:hover{ border-color:#9d6f23 }

    .fr-section{ padding:72px 0 }
    .fr-section--alt{ background:#fafaf9 }
    .fr-h2{ font-family:"Playfair Display",Georgia,serif; font-size:clamp(26px,3vw,40px); margin:0 0 28px; color:#0b1220; font-weight:600; display:flex; align-items:center; gap:10px }
    .fr-h2--muted{ color:#475569 }

    .fr-pills{ display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:18px }
    .fr-pill{ padding:24px; border:1px solid #e7e5e0; border-radius:16px; background:#fff }
    .fr-pillIcon{ width:28px; height:28px; color:#9d6f23; margin-bottom:14px }
    .fr-pillTitle{ font-weight:800; font-size:16px; color:#0b1220; margin-bottom:8px }
    .fr-pillBody{ color:#475569; font-size:14.5px; line-height:1.6; margin:0 }

    .fr-truths{ list-style:none; padding:0; margin:0; display:grid; gap:16px }
    .fr-truth{ display:grid; grid-template-columns:auto 1fr; gap:18px; padding:20px 24px; background:#fff; border:1px solid #e7e5e0; border-radius:14px; align-items:start }
    .fr-truthNum{ font-family:"Playfair Display",Georgia,serif; font-size:30px; color:#9d6f23; min-width:50px }
    .fr-truthTitle{ font-weight:800; font-size:16px; color:#0b1220; margin-bottom:4px }
    .fr-truthBody{ color:#475569; font-size:14.5px; line-height:1.6; margin:0 }

    .fr-steps{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px }
    .fr-step{ padding:24px; border:1px solid #e7e5e0; border-radius:16px; background:#fff }
    .fr-stepNum{ font-family:"Playfair Display",Georgia,serif; font-size:28px; color:#9d6f23; display:block; margin-bottom:10px }
    .fr-stepTitle{ font-weight:800; font-size:15.5px; color:#0b1220; margin-bottom:6px }
    .fr-stepBody{ color:#475569; font-size:14px; line-height:1.55; margin:0 }

    .fr-twoCol{ display:grid; grid-template-columns:1fr 1fr; gap:36px }
    @media(max-width:760px){ .fr-twoCol{ grid-template-columns:1fr } }
    .fr-list{ list-style:none; padding:0; margin:0; display:grid; gap:10px }
    .fr-list li{ color:#0b1220; font-size:15px; line-height:1.6; display:flex; gap:10px; align-items:flex-start }
    .fr-list--muted li{ color:#64748b }
    .fr-check{ width:18px; height:18px; color:#15803d; flex:0 0 auto; margin-top:2px }

    .fr-cities{ list-style:none; padding:0; margin:0; display:flex; flex-wrap:wrap; gap:8px }
    .fr-cityChip{ padding:8px 14px; border:1px solid #e2e8f0; border-radius:999px; background:#fff; font-size:13.5px; font-weight:700; color:#0b1220 }
    .fr-mt16{ margin-top:16px } .fr-mb16{ margin-bottom:16px } .fr-muted{ color:#64748b }

    .fr-legal{ padding:32px; border:1px solid #f0e6d2; border-radius:18px; background:#fffdf6 }
    .fr-contact{ text-align:center; padding:48px 24px; border:1px solid #e7e5e0; border-radius:20px; background:#fff }
    .fr-contact .fr-ctaRow{ justify-content:center }
    .fr-toast{ margin-top:16px; padding:10px 14px; border-radius:10px; background:#d1fae5; color:#065f46; font-weight:700; display:inline-block }
    .fr-tinyLink{ display:inline-flex; align-items:center; gap:4px; margin-top:18px; background:none; border:0; color:#64748b; font-size:12px; cursor:default }
  `;
}
