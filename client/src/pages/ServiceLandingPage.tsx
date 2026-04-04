import { useParams, Link } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/lib/languageStore';
import { Star, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TrustBar from '@/components/TrustBar';

const GOLD = '#C5A55A';

const CITY_MAP: Record<string, { he: string; en: string; region: string }> = {
  'tel-aviv':     { he: 'תל אביב',      en: 'Tel Aviv',      region: 'tel-aviv' },
  'jerusalem':    { he: 'ירושלים',      en: 'Jerusalem',     region: 'jerusalem' },
  'haifa':        { he: 'חיפה',          en: 'Haifa',         region: 'haifa' },
  'beer-sheva':   { he: 'באר שבע',      en: "Be'er Sheva",   region: 'south' },
  'rishon':       { he: 'ראשון לציון',  en: 'Rishon LeZion', region: 'center' },
  'petah-tikva':  { he: 'פתח תקווה',   en: 'Petah Tikva',   region: 'center' },
  'ashdod':       { he: 'אשדוד',        en: 'Ashdod',        region: 'south' },
  'netanya':      { he: 'נתניה',        en: 'Netanya',       region: 'center' },
  'holon':        { he: 'חולון',        en: 'Holon',         region: 'center' },
  'bnei-brak':    { he: 'בני ברק',      en: 'Bnei Brak',     region: 'center' },
  'ramat-gan':    { he: 'רמת גן',       en: 'Ramat Gan',     region: 'center' },
  'herzliya':     { he: 'הרצליה',       en: 'Herzliya',      region: 'center' },
};

const SERVICE_MAP: Record<string, {
  slug: string; labelHe: string; labelEn: string; emoji: string;
  descHe: string; descEn: string;
  faqHe: { q: string; a: string }[];
  faqEn: { q: string; a: string }[];
  cta: string;
}> = {
  'pet-sitting': {
    slug: 'pet_sitting', emoji: '🏠',
    labelHe: 'שמירה על חיות מחמד', labelEn: 'Pet Sitting',
    descHe: 'ספקים מקצועיים ישמרו על חיית המחמד שלך בביתך – בעוד אתה נמצא בחו"ל או בעבודה. כל ספק מאומת ועבר קורס מקצועי.',
    descEn: 'Professional pet sitters care for your pet in your own home — while you travel or work. Every sitter is verified and trained.',
    faqHe: [
      { q: 'כמה עולה שמירה על חיית מחמד?', a: 'המחיר תלוי בסוג החיה, מספר הלילות וסוג השירות. מחיר ממוצע: ₪120–₪180 ללילה.' },
      { q: 'האם הספקים מאומתים?', a: 'כן. כל הספקים עוברים אימות זהות, בדיקת רקע, וקורס טיפול בחיות מחמד.' },
      { q: 'מה כולל השירות?', a: 'האכלה, הוצאה לטיולים, משחק, ועדכונים יומיים לבעלים.' },
    ],
    faqEn: [
      { q: 'How much does pet sitting cost?', a: 'Prices depend on pet type, nights, and service level. Avg: ₪120–₪180 per night.' },
      { q: 'Are sitters background-checked?', a: 'Yes. All sitters go through ID verification, background checks, and a professional pet care course.' },
      { q: 'What is included?', a: 'Feeding, walks, playtime, and daily photo updates sent to you.' },
    ],
    cta: '/sitter-suite',
  },
  'dog-walking': {
    slug: 'dog_walking', emoji: '🦮',
    labelHe: 'הליכת כלבים', labelEn: 'Dog Walking',
    descHe: 'מוליכי כלבים מוסמכים יוציאו את הכלב שלך לטיול מקצועי. GPS בכל טיול, תמונות ועדכון בסיום.',
    descEn: 'Certified dog walkers take your dog for a professional walk. GPS tracking, photos, and updates every walk.',
    faqHe: [
      { q: 'כמה עולה הליכה?', a: 'הליכה של 30 דקות עולה בממוצע ₪55–₪80. מחירים משתנים לפי עיר ומוליך.' },
      { q: 'האם יש מעקב GPS?', a: 'כן, רוב המוליכים משתמשים בעקיבת GPS ומשתפים את המסלול בסיום.' },
      { q: 'כמה כלבים בטיול אחד?', a: 'לרוב 1–3 כלבים בטיול, תלוי במוליך.' },
    ],
    faqEn: [
      { q: 'How much does dog walking cost?', a: 'A 30-min walk averages ₪55–₪80. Prices vary by city and walker.' },
      { q: 'Is GPS tracking included?', a: 'Yes, most walkers use GPS and share the route map after each walk.' },
      { q: 'How many dogs per walk?', a: 'Usually 1–3 dogs per walk, depending on the walker.' },
    ],
    cta: '/walk-my-pet',
  },
  'grooming': {
    slug: 'grooming', emoji: '✂️',
    labelHe: 'טיפוח חיות מחמד', labelEn: 'Pet Grooming',
    descHe: 'מטפחים מקצועיים יטפלו בחיית המחמד שלך. שטיפה, תספורת, טיפול בציפורניים ועוד.',
    descEn: 'Professional groomers for dogs and cats. Bath, trim, nail clipping, and more.',
    faqHe: [
      { q: 'כמה עולה טיפוח?', a: 'שטיפה ותספורת: ₪80–₪200 לפי גודל הכלב. K9000 מציע מחירים קבועים.' },
      { q: 'מה ההבדל בין K9000 לגנן?', a: 'K9000 הוא מכון שטיפה עצמאי. גרומר הוא ספק אישי.' },
    ],
    faqEn: [
      { q: 'How much does grooming cost?', a: 'Bath & trim: ₪80–₪200 depending on dog size. K9000 stations have fixed pricing.' },
      { q: "What's the difference between K9000 and a groomer?", a: 'K9000 is a self-wash station. A groomer is a personal service provider.' },
    ],
    cta: '/groomers',
  },
  'k9000-wash': {
    slug: 'k9000_wash', emoji: '🚿',
    labelHe: 'שטיפה K9000', labelEn: 'K9000 Self-Wash',
    descHe: 'מכוני שטיפה עצמית מתקדמים לכלבים. בוא עם הכלב שלך, אנחנו נספק הכל – מגבות, שמפו, מייבש וכפפות.',
    descEn: 'Advanced self-service dog wash stations. Bring your dog, we supply everything — towels, shampoo, dryer, gloves.',
    faqHe: [
      { q: 'כמה עולה שטיפה בK9000?', a: 'מחיר מתחיל ב-₪35 לשטיפה בסיסית.' },
      { q: 'מה כלול?', a: 'שמפו, מרכך, מגבות, מייבש מקצועי, כפפות ומערכת ניקוז.' },
    ],
    faqEn: [
      { q: 'How much does K9000 wash cost?', a: 'Starting from ₪35 for a basic wash.' },
      { q: 'What is included?', a: 'Shampoo, conditioner, towels, professional dryer, gloves, and drainage system.' },
    ],
    cta: '/k9000/booking',
  },
  'pet-taxi': {
    slug: 'pet_taxi', emoji: '🚗',
    labelHe: 'הסעות לחיות מחמד', labelEn: 'Pet Taxi',
    descHe: 'הסעה בטוחה ומקצועית לחיית המחמד שלך – לווטרינר, לגנן, לאימון, וחזרה.',
    descEn: 'Safe, professional pet transport — to the vet, groomer, trainer, or anywhere else.',
    faqHe: [
      { q: 'כמה עולה הסעה?', a: 'מחיר לנסיעה: ₪60–₪150 לפי מרחק.' },
      { q: 'האם המכונית מאובזרת לחיות?', a: 'כן, כל הרכבים מצוידים בכלוב/מושב בטיחות.' },
    ],
    faqEn: [
      { q: 'How much does pet taxi cost?', a: 'Per-trip pricing: ₪60–₪150 depending on distance.' },
      { q: 'Are vehicles pet-equipped?', a: 'Yes, all vehicles have certified pet carriers or safety seats.' },
    ],
    cta: '/pettrek',
  },
  'training': {
    slug: 'training', emoji: '🎓',
    labelHe: 'אימון כלבים', labelEn: 'Dog Training',
    descHe: 'מאמנים מוסמכים לכלבים. מהגורים הצעירים ועד לכלבים בוגרים – אנחנו נעזור לכם.',
    descEn: 'Certified dog trainers for all breeds and ages — from puppies to adult dogs.',
    faqHe: [
      { q: 'כמה עולה שיעור אימון?', a: 'שיעור פרטי: ₪150–₪300 לשעה.' },
      { q: 'כמה שיעורים צריך?', a: 'לרוב 6–12 שיעורים לחינוך בסיסי.' },
    ],
    faqEn: [
      { q: 'How much does dog training cost?', a: 'Private session: ₪150–₪300 per hour.' },
      { q: 'How many sessions are needed?', a: 'Usually 6–12 sessions for basic obedience.' },
    ],
    cta: '/marketplace',
  },
};

const REVIEWS = [
  { name: 'Maya R.', nameHe: 'מאיה ר.', rating: 5, textEn: 'Incredible service! My dog was so happy and I got photo updates throughout the day.', textHe: 'שירות מדהים! הכלב שלי היה שמח ועדכונים כל הזמן.' },
  { name: 'David K.', nameHe: 'דוד כ.', rating: 5, textEn: 'Professional, reliable and my pets love them. Would absolutely recommend.', textHe: 'מקצועי, אמין, וחיות המחמד שלי אוהבות אותם. ממליץ בחום.' },
  { name: 'Noa S.', nameHe: 'נועה ש.', rating: 5, textEn: 'Finally a platform I can trust with my cats. Excellent sitters!', textHe: 'סוף סוף פלטפורמה שאני סומכת עליה עם החתולים שלי.' },
];

export default function ServiceLandingPage() {
  const { service, city } = useParams<{ service: string; city?: string }>();
  const { language } = useLanguage();
  const isRTL = language === 'he' || language === 'ar';

  const svc = SERVICE_MAP[service || ''];
  const cityInfo = city ? CITY_MAP[city] : null;

  if (!svc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">404</p>
          <Link href="/marketplace"><Button className="mt-4">Go to Marketplace</Button></Link>
        </div>
      </div>
    );
  }

  const pageTitle = cityInfo
    ? isRTL
      ? `${svc.labelHe} ב${cityInfo.he} | PetWash`
      : `${svc.labelEn} in ${cityInfo.en} | PetWash`
    : isRTL
      ? `${svc.labelHe} בישראל | PetWash`
      : `${svc.labelEn} in Israel | PetWash`;

  const metaDesc = isRTL
    ? `מצא את הספק הטוב ביותר ל${svc.labelHe}${cityInfo ? ` ב${cityInfo.he}` : ''}. כל הספקים מאומתים, מדורגים וביטוח כלול.`
    : `Find the best ${svc.labelEn}${cityInfo ? ` in ${cityInfo.en}` : ''} in Israel. All providers verified, rated, and insured.`;

  const faqs = isRTL ? svc.faqHe : svc.faqEn;

  const cityLinks = Object.entries(CITY_MAP).map(([slug, info]) => ({
    slug,
    label: isRTL ? info.he : info.en,
  }));

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index, follow" />
        {cityInfo && <link rel="canonical" href={`https://petwash.co.il/services/${service}/${city}`} />}
        {!cityInfo && <link rel="canonical" href={`https://petwash.co.il/services/${service}`} />}
      </Helmet>

      <div className="bg-gradient-to-b from-gray-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-6xl mb-4">{svc.emoji}</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {isRTL ? svc.labelHe : svc.labelEn}
            {cityInfo && (
              <span className="text-2xl font-semibold text-gray-600"> {isRTL ? `ב${cityInfo.he}` : `in ${cityInfo.en}`}</span>
            )}
          </h1>
          <p className="text-base text-gray-600 leading-relaxed mb-6">
            {isRTL ? svc.descHe : svc.descEn}
          </p>
          <Link href={svc.cta}>
            <Button
              className="rounded-full px-8 py-3 text-base font-semibold"
              style={{ backgroundColor: GOLD, color: '#fff' }}
            >
              {isRTL ? 'הזמן עכשיו' : 'Find & Book Now'}
              {isRTL ? <ChevronLeft size={18} className="mr-1" /> : <ChevronRight size={18} className="ml-1" />}
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto">
        <div className="py-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {isRTL ? 'למה לבחור PetWash' : 'Why PetWash'}
          </p>
          <TrustBar variant="grid" />
        </div>

        <div className="py-6 border-t border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {isRTL ? 'מה אומרים הלקוחות' : 'What pet owners say'}
          </h2>
          <div className="space-y-3">
            {REVIEWS.map((r, i) => (
              <div key={i} className="p-4 bg-white rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: GOLD }}
                  >
                    {(isRTL ? r.nameHe : r.name)[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{isRTL ? r.nameHe : r.name}</p>
                    <div className="flex">
                      {Array.from({ length: r.rating }).map((_, j) => (
                        <Star key={j} size={12} fill={GOLD} style={{ color: GOLD }} />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-700">{isRTL ? r.textHe : r.textEn}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="py-6 border-t border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {isRTL ? 'שאלות נפוצות' : 'Frequently asked questions'}
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details key={i} className="group border border-gray-200 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none font-medium text-gray-900">
                  {faq.q}
                  <ChevronRight size={16} className="text-gray-400 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="py-6 border-t border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {isRTL ? `${svc.labelHe} לפי עיר` : `${svc.labelEn} by city`}
          </h2>
          <div className="flex flex-wrap gap-2">
            {cityLinks.map(c => (
              <Link key={c.slug} href={`/services/${service}/${c.slug}`}>
                <span className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border border-gray-200 hover:border-yellow-400 transition-colors cursor-pointer">
                  <MapPin size={12} className="text-gray-400" />
                  {c.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="py-6 border-t border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {isRTL ? 'שירותים נוספים' : 'Other services'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SERVICE_MAP)
              .filter(([slug]) => slug !== service)
              .map(([slug, s]) => (
                <Link key={slug} href={`/services/${slug}`}>
                  <span className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-gray-200 hover:border-yellow-400 transition-colors cursor-pointer">
                    {s.emoji} {isRTL ? s.labelHe : s.labelEn}
                  </span>
                </Link>
              ))}
          </div>
        </div>

        <div className="pb-10">
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: `linear-gradient(135deg, ${GOLD}15, ${GOLD}05)`, border: `1px solid ${GOLD}40` }}
          >
            <p className="text-lg font-bold text-gray-900 mb-2">
              {isRTL ? `מוכנים למצוא ספק ל${svc.labelHe}?` : `Ready to book ${svc.labelEn}?`}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              {isRTL
                ? 'ספקים מאומתים זמינים עכשיו. הזמנה בחמש דקות.'
                : 'Verified providers available now. Book in under 5 minutes.'}
            </p>
            <Link href={svc.cta}>
              <Button
                className="rounded-full px-6 font-semibold"
                style={{ backgroundColor: GOLD, color: '#fff' }}
              >
                {isRTL ? 'הזמן עכשיו' : 'Get Started'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
