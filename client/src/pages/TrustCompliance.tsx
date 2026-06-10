import { Layout } from '@/components/Layout';
import { useEffect, useState, type ReactNode } from 'react';
import { type Language } from '@/lib/i18n';
import { useSEO, pageSEO } from '@/lib/seo';
import {
  ShieldCheck,
  Cpu,
  BadgeCheck,
  ClipboardCheck,
  FlaskConical,
  Droplets,
  Sparkles,
  Award,
  Heart,
} from 'lucide-react';

interface TrustComplianceProps {
  language: Language;
  onLanguageChange?: (language: Language) => void;
}

// LTR-safe wrapper for standard codes / numbers inside an RTL layout.
const Ltr = ({ children }: { children: ReactNode }) => (
  <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{children}</span>
);

export default function TrustCompliance({ language, onLanguageChange }: TrustComplianceProps) {
  useSEO(pageSEO.trust);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(language);
  const en = currentLanguage === 'en';

  const handleLanguageChange = (newLanguage: Language) => {
    setCurrentLanguage(newLanguage);
    onLanguageChange?.(newLanguage);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Certifications belong to the K9000 equipment / consumables — described as
  // independently assessed / declared, never as company certifications of PetWash.
  const partnerCerts = [
    {
      icon: ShieldCheck,
      titleEn: 'Electrical safety',
      titleHe: 'בטיחות חשמלית',
      descEn: "The machinery's electrical equipment was independently assessed for compliance by STRADIA Pty Ltd.",
      descHe: 'הציוד החשמלי של המכונה נבחן באופן עצמאי לעמידה בתקן על ידי STRADIA Pty Ltd.',
      std: 'EN 60204-1:2018',
    },
    {
      icon: Cpu,
      titleEn: 'Electromagnetic compatibility',
      titleHe: 'תאימות אלקטרומגנטית',
      descEn: 'Immunity verified across seven test regimes by a laboratory accredited to ISO/IEC 17025 by A2LA.',
      descHe: 'חסינות נבדקה בשבעה מבחנים במעבדה המוסמכת לתקן ISO/IEC 17025 על ידי A2LA.',
      std: 'EN IEC 61000-6-1:2019',
    },
    {
      icon: BadgeCheck,
      titleEn: 'CE & regulatory marking',
      titleHe: 'סימון CE ורגולציה',
      descEn: 'Declared to the applicable EU directives and carrying Australian Regulatory Compliance Marking (RCM).',
      descHe: 'מוצהר לעמידה בדירקטיבות האיחוד האירופי הרלוונטיות ונושא סימון רגולטורי אוסטרלי (RCM).',
      std: 'CE · RCM',
    },
    {
      icon: ClipboardCheck,
      titleEn: 'Independent risk assessment',
      titleHe: 'הערכת סיכונים עצמאית',
      descEn: 'Product risk assessment performed through IAPMO, a NATA-accredited laboratory; assembly strength to ATS 5200.101.',
      descHe: 'הערכת סיכוני מוצר בוצעה דרך IAPMO, מעבדה בהסמכת NATA; חוזק הרכבה לפי ATS 5200.101.',
      std: 'IAPMO · ATS 5200.101',
    },
    {
      icon: FlaskConical,
      titleEn: 'Government-approved consumables',
      titleHe: 'תכשירים בתקן ממשלתי',
      descEn: 'Wash and conditioning products manufactured under Australian Government APVMA-approved Good Manufacturing Practice.',
      descHe: 'מוצרי שטיפה וטיפוח המיוצרים בתקן ייצור נאות (GMP) המאושר על ידי ה‑APVMA של ממשלת אוסטרליה.',
      std: 'APVMA GMP · Licence 1104',
    },
    {
      icon: Droplets,
      titleEn: 'Water-safe plumbing',
      titleHe: 'אינסטלציה בטוחה למים',
      descEn: 'High-hazard backflow prevention (RPZ or registered air-gap) protects the potable supply; trade-waste handled to the local authority.',
      descHe: 'מניעת זרימה חוזרת ברמת סיכון גבוה (RPZ או מרווח אוויר רשום) מגנה על מי השתייה; שפכים מטופלים מול הרשות המקומית.',
      std: 'AS 2845.1',
    },
  ];

  const ownerPoints = [
    {
      titleEn: 'Warm and controlled',
      titleHe: 'חמים ומבוקר',
      descEn: 'Wash temperature is regulated at the gun.',
      descHe: 'טמפרטורת השטיפה מווסתת באקדח השטיפה.',
    },
    {
      titleEn: 'Clean between every dog',
      titleHe: 'נקי בין כל כלב',
      descEn: 'A three-stage hair filtration system captures hair throughout the cycle.',
      descHe: 'מערכת סינון שיער תלת‑שלבית לוכדת שיער לאורך כל המחזור.',
    },
    {
      titleEn: 'Pet-formulated products',
      titleHe: 'מוצרים ייעודיים לחיות מחמד',
      descEn: 'Shampoos and conditioners made for dogs, each with a published safety data sheet.',
      descHe: 'שמפו ומרכך המיועדים לכלבים, לכל אחד גיליון בטיחות (SDS) מפורסם.',
    },
    {
      titleEn: 'Quiet and efficient',
      titleHe: 'שקט ויעיל',
      descEn: 'Independently measured at 66 dB(A) at 4 m,* using roughly 40–60 litres and about 0.76 kWh per wash.',
      descHe: 'נמדד באופן עצמאי ב‑66 dB(A) במרחק 4 מ׳,* בשימוש של כ‑40–60 ליטר וכ‑0.76 קוט״ש לשטיפה.',
    },
  ];

  const stats = [
    { n: '66 dB(A)', lEn: 'Measured at 4 m*', lHe: 'נמדד ב‑4 מ׳*' },
    { n: '40–60 L', lEn: 'Water per wash', lHe: 'מים לשטיפה' },
    { n: '~0.76 kWh', lEn: 'Per wash cycle', lHe: 'למחזור שטיפה' },
    { n: '3-stage', lEn: 'Hair filtration', lHe: 'סינון שיער' },
  ];

  const trustStrip = ['EN 60204-1', 'EN IEC 61000-6-1', 'CE · RCM', 'APVMA GMP', 'AS 2845.1'];

  return (
    <Layout language={currentLanguage} onLanguageChange={handleLanguageChange}>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Hero */}
        <div className="luxury-services-hero luxury-animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="luxury-services-hero-content">
              <div className="luxury-badge luxury-badge-gold">
                <ShieldCheck className="h-5 w-5" />
                <span>{en ? 'Trust & Compliance' : 'אמון ותאימות'}</span>
              </div>

              <h1 className="luxury-heading-xl mt-8">
                {en ? 'Engineered to standards. Operated with care.' : 'מהונדס לפי תקנים. מופעל בקפידה.'}
              </h1>

              <p className="luxury-services-subtitle">
                {en
                  ? "Every ⁦Pet Wash™⁩ station runs on dog-wash equipment independently assessed and tested to international electrical-safety and electromagnetic-compatibility standards — and uses wash products manufactured under government-approved practice."
                  : 'כל עמדת ⁦Pet Wash™⁩ מבוססת על ציוד שטיפה לכלבים שנבחן ונבדק באופן עצמאי לפי תקני בטיחות חשמלית ותאימות אלקטרומגנטית בינלאומיים — ומשתמשת במוצרי שטיפה המיוצרים בתקן ייצור מאושר.'}
              </p>
            </div>
          </div>
        </div>

        {/* Section 1 — partners, councils & operators */}
        <div className="luxury-section">
          <div className="luxury-container">
            <div className="text-center mb-12">
              <div className="luxury-badge luxury-badge-gold mb-8 inline-flex">
                <Award className="h-5 w-5" />
                <span>{en ? 'Independently assessed & tested' : 'נבחן ונבדק באופן עצמאי'}</span>
              </div>
              <h2 className="luxury-heading-lg mb-6">
                {en ? 'For partners, councils & operators' : 'לשותפים, רשויות ומפעילים'}
              </h2>
              <p className="luxury-text-body max-w-3xl mx-auto">
                {en
                  ? 'The equipment and consumables behind every station are backed by independent assessment and accredited testing. Full certificates are available to partners on request.'
                  : 'הציוד והתכשירים שמאחורי כל עמדה נתמכים בהערכה עצמאית ובבדיקות במעבדות מוסמכות. תעודות מלאות זמינות לשותפים לפי בקשה.'}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {partnerCerts.map((c, i) => (
                <div key={i} className="luxury-glass-card luxury-shadow-lg p-8 luxury-hover-lift">
                  <c.icon className="h-8 w-8 text-black mb-4" strokeWidth={1.5} />
                  <h3 className="luxury-heading-sm mb-3">{en ? c.titleEn : c.titleHe}</h3>
                  <p className="luxury-text-body mb-4">{en ? c.descEn : c.descHe}</p>
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    <Ltr>{c.std}</Ltr>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2 — pet owners */}
        <div className="luxury-section luxury-bg-soft">
          <div className="luxury-container">
            <div className="text-center mb-12">
              <div className="luxury-badge luxury-badge-success mb-8 inline-flex">
                <Heart className="h-5 w-5" />
                <span>{en ? 'For pet owners' : 'לבעלי חיות מחמד'}</span>
              </div>
              <h2 className="luxury-heading-lg mb-6">
                {en ? 'A clean, gentle, considered wash' : 'שטיפה נקייה, עדינה ומחושבת'}
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
              {ownerPoints.map((p, i) => (
                <div key={i} className="luxury-glass-card p-8 luxury-hover-lift">
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="h-5 w-5 text-black shrink-0" strokeWidth={1.5} />
                    <h3 className="luxury-heading-sm">{en ? p.titleEn : p.titleHe}</h3>
                  </div>
                  <p className="luxury-text-body">{en ? p.descEn : p.descHe}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {stats.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl font-bold text-black mb-2">
                    <Ltr>{s.n}</Ltr>
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    {en ? s.lEn : s.lHe}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="luxury-section">
          <div className="luxury-container">
            <div className="flex flex-wrap items-center justify-center gap-3 max-w-4xl mx-auto">
              {trustStrip.map((chip, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700"
                >
                  <BadgeCheck className="h-4 w-4 text-black" strokeWidth={1.5} />
                  <Ltr>{chip}</Ltr>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Required legal disclaimer — keeps the page truthful. Do not remove. */}
        <div className="luxury-section luxury-bg-soft">
          <div className="luxury-container">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-xs leading-relaxed text-gray-500">
                {en
                  ? 'Certifications referenced relate to the ⁦K9000™⁩ / TRU-BLU dog-wash equipment (manufactured by Tru Blu Dog Wash Pty Ltd) and to consumable products manufactured under APVMA-approved Good Manufacturing Practice. They are equipment and product certifications operated by ⁦Pet Wash™⁩, not company certifications of ⁦Pet Wash™⁩. *Noise independently measured by an EPA-registered tester in 2009 on the original K9000 unit; presented as a measured figure, not a current certified rating. Full certificates available on request: '
                  : 'התעודות הנזכרות מתייחסות לציוד שטיפת הכלבים ⁦K9000™⁩ / TRU-BLU (מתוצרת Tru Blu Dog Wash Pty Ltd) ולתכשירים המיוצרים בתקן ייצור נאות המאושר על ידי ה‑APVMA. אלו תעודות של ציוד ומוצרים המופעלים על ידי ⁦Pet Wash™⁩, ואינן תעודות חברה של ⁦Pet Wash™⁩. *מדידת הרעש בוצעה באופן עצמאי על ידי בודק מוסמך EPA בשנת 2009 על יחידת K9000 המקורית; מוצגת כערך שנמדד, לא כדירוג מוסמך עדכני. תעודות מלאות זמינות לפי בקשה: '}
                <a href="mailto:support@petwash.co.il" className="text-gray-700 underline hover:text-black">
                  <Ltr>support@petwash.co.il</Ltr>
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
