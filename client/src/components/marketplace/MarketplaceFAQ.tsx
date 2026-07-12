import { useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export interface FAQItem {
  id: string;
  question: string;
  questionHe: string;
  answer: string;
  answerHe: string;
}

type Platform = 'sitter' | 'walker' | 'driver' | 'groomer' | 'trainer';

// LEGAL-SCRUBBED 2026-07-12: removed "insured / insurance covers …" (PetWash is
// NOT an insurance company — see the Provider & Host Services Agreement §14 and
// the Protection-not-Insurance notice), softened unverifiable claims ("criminal
// background checks", "video interview", "certification", "7-star badge") to what
// is actually true today (identity verification + review), and generalised the
// specific cancellation/payout numbers to point at the canonical policy. Keep it
// truthful — run petwash-marketing-legal over any new copy before adding it.
const platformFAQs: Record<Platform, FAQItem[]> = {
  sitter: [
    {
      id: 'sitter-1',
      question: 'How does pet sitting work with ⁦PetWash™⁩?',
      questionHe: 'איך עובד שמרטוף חיות מחמד עם ⁦PetWash™⁩?',
      answer: 'Our pet sitters offer two options: your pet can stay at their home, or they can come to your home while you\'re away. Sitters are identity-verified and reviewed before they can offer care, and follow our care standards. You\'ll receive photo updates and can message your sitter anytime.',
      answerHe: 'השמרטפים שלנו מציעים שתי אפשרויות: חיית המחמד שלך יכולה להישאר בבית שלהם, או שהם יכולים לבוא לבית שלך בזמן שאתה בחופשה. השמרטפים עוברים אימות זהות ובדיקה לפני שהם יכולים להציע טיפול, ופועלים לפי תקני הטיפול שלנו. תקבל עדכוני תמונות ותוכל לשלוח הודעות לשמרטף בכל עת.'
    },
    {
      id: 'sitter-2',
      question: 'What\'s included in the pet sitting service?',
      questionHe: 'מה כלול בשירות שמרטוף?',
      answer: 'Every stay includes feeding according to your schedule, fresh water, walks and playtime, bedtime routines, and photo updates. House sitting also includes plant watering, mail collection, and keeping your home secure and lived-in.',
      answerHe: 'כל שהייה כוללת האכלה לפי הלוח זמנים שלך, מים טריים, טיולים ומשחקים, שגרות שינה, ועדכוני תמונות. שמירה על הבית כוללת גם השקיית צמחים, איסוף דואר ושמירה על הבית מאוכלס ומאובטח.'
    },
    {
      id: 'sitter-3',
      question: 'How are sitters verified?',
      questionHe: 'איך מאמתים את השמרטפים?',
      answer: 'All ⁦PetWash™⁩ sitters undergo identity verification and a review of their references and pet-care experience before they can offer care. Top-rated sitters stand out through their reviews and ratings.',
      answerHe: 'כל שמרטפי ⁦PetWash™⁩ עוברים אימות זהות ובדיקת המלצות וניסיון בטיפול בחיות מחמד לפני שהם יכולים להציע טיפול. שמרטפים מדורגים גבוה בולטים לפי הביקורות והדירוגים שלהם.'
    },
    {
      id: 'sitter-4',
      question: 'What if there\'s an emergency?',
      questionHe: 'מה קורה אם יש מצב חירום?',
      answer: 'Sitters have access to our support line and vet-clinic contacts, and your pet\'s medical history is shared with the sitter. In an emergency you approve any vet treatment, and we help coordinate care.',
      answerHe: 'לשמרטפים יש גישה לקו התמיכה שלנו ולפרטי מרפאות וטרינריות, וההיסטוריה הרפואית של חיית המחמד שלך משותפת עם השמרטף. במצב חירום אתם מאשרים כל טיפול וטרינרי, ואנחנו מסייעים בתיאום הטיפול.'
    },
    {
      id: 'sitter-5',
      question: 'How do I pay and what\'s the cancellation policy?',
      questionHe: 'איך משלמים ומה מדיניות הביטולים?',
      answer: 'Payment is held securely (in escrow) until your booking is complete. Free cancellation is available within the window shown at booking — see our Cancellation & Refund Policy for the exact terms. The sitter is paid after the stay ends.',
      answerHe: 'התשלום מוחזק בנאמנות עד להשלמת ההזמנה. ביטול חינם זמין בחלון הזמן המוצג בעת ההזמנה — ראו את מדיניות הביטולים וההחזרים לתנאים המדויקים. השמרטף מקבל תשלום לאחר סיום השהייה.'
    },
  ],
  walker: [
    {
      id: 'walker-1',
      question: 'How does dog walking work?',
      questionHe: 'איך עובד שירות הטיולים?',
      answer: 'Book a one-time walk or set up recurring walks. Our walkers pick up your dog, take them on a 30 or 60-minute adventure, and return them home safely. You\'ll receive a route map and photos after each walk.',
      answerHe: 'הזמן טיול חד-פעמי או הגדר טיולים קבועים. המטיילים שלנו אוספים את הכלב, לוקחים אותו להרפתקה של 30 או 60 דקות, ומחזירים אותו הביתה בשלום. תקבל מפת מסלול ותמונות לאחר כל טיול.'
    },
    {
      id: 'walker-2',
      question: 'What\'s the difference between group and private walks?',
      questionHe: 'מה ההבדל בין טיול קבוצתי לפרטי?',
      answer: 'Group walks include up to 4 dogs and are great for social pups. Private walks are one-on-one attention, perfect for dogs who need extra care, training reinforcement, or prefer solo adventures.',
      answerHe: 'טיולים קבוצתיים כוללים עד 4 כלבים ומתאימים לכלבים חברותיים. טיולים פרטיים הם תשומת לב אחד-על-אחד, מושלמים לכלבים שצריכים טיפול נוסף, חיזוק אימון או מעדיפים הרפתקאות בודדות.'
    },
    {
      id: 'walker-3',
      question: 'How do walkers access my home?',
      questionHe: 'איך המטיילים נכנסים לבית שלי?',
      answer: 'You can provide a key, lockbox code, or smart lock access. All walkers are identity-verified. We recommend a secure key handoff at your first booking.',
      answerHe: 'אתה יכול לספק מפתח, קוד לכספת או גישה למנעול חכם. כל המטיילים עוברים אימות זהות. אנחנו ממליצים על מסירת מפתח מאובטחת בהזמנה הראשונה שלך.'
    },
    {
      id: 'walker-4',
      question: 'What if my dog has special needs?',
      questionHe: 'מה אם לכלב שלי יש צרכים מיוחדים?',
      answer: 'Share any special requirements in your booking notes. Many walkers specialize in senior dogs, puppies, reactive dogs, or dogs with medical needs. You can filter for walkers with specific experience.',
      answerHe: 'שתף כל דרישה מיוחדת בהערות ההזמנה שלך. מטיילים רבים מתמחים בכלבים מבוגרים, גורים, כלבים ריאקטיביים או כלבים עם צרכים רפואיים. אתה יכול לסנן מטיילים עם ניסיון ספציפי.'
    },
  ],
  driver: [
    {
      id: 'driver-1',
      question: 'What pet transport services do you offer?',
      questionHe: 'אילו שירותי הסעת חיות מחמד אתם מציעים?',
      answer: 'We offer vet visits, groomer trips, airport transfers, and any point-to-point transport. Our climate-controlled vehicles are designed for pet safety and comfort. Carriers and crates are available.',
      answerHe: 'אנחנו מציעים ביקורי וטרינר, נסיעות למספרה, הסעות לשדה תעופה וכל הסעה מנקודה לנקודה. הרכבים שלנו בעלי בקרת אקלים מתוכננים לבטיחות ונוחות חיות מחמד. כלובי נשיאה זמינים.'
    },
    {
      id: 'driver-2',
      question: 'How is pricing calculated?',
      questionHe: 'איך מחושבים המחירים?',
      answer: 'Pricing is based on distance plus a base fee. Multiple pets travel together at a discount. Premium services like same-day booking or specific timing windows have additional fees.',
      answerHe: 'המחיר מבוסס על מרחק בתוספת דמי בסיס. מספר חיות מחמד נוסעות יחד בהנחה. שירותים פרימיום כמו הזמנה באותו יום או חלונות זמן ספציפיים כוללים תוספת תשלום.'
    },
    {
      id: 'driver-3',
      question: 'Are drivers trained for pet safety?',
      questionHe: 'האם הנהגים מאומנים לבטיחות חיות מחמד?',
      answer: 'All drivers follow our safe pet-handling guidelines, including secure loading, calming techniques, and emergency procedures. Vehicles are checked for safety and cleanliness.',
      answerHe: 'כל הנהגים פועלים לפי הנחיות הטיפול הבטוח בחיות מחמד שלנו, כולל העמסה מאובטחת, טכניקות הרגעה ונהלי חירום. הרכבים נבדקים לבטיחות וניקיון.'
    },
  ],
  groomer: [
    {
      id: 'groomer-1',
      question: 'What grooming services are available?',
      questionHe: 'אילו שירותי טיפוח זמינים?',
      answer: 'Services include bath and blow-dry, haircuts and styling, nail trimming, ear cleaning, teeth brushing, and de-shedding treatments. Specialty services like creative grooming and spa packages are also available.',
      answerHe: 'השירותים כוללים רחצה וייבוש, תספורות ועיצוב, גזירת ציפורניים, ניקוי אוזניים, צחצוח שיניים וטיפולים נגד נשירה. שירותים מיוחדים כמו טיפוח יצירתי וחבילות ספא זמינים גם כן.'
    },
    {
      id: 'groomer-2',
      question: 'Do you offer mobile grooming?',
      questionHe: 'האם אתם מציעים טיפוח נייד?',
      answer: 'Yes! Many groomers bring a fully-equipped mobile salon to your home. It\'s perfect for anxious pets or busy schedules. The grooming van has professional equipment including warm water, dryers, and grooming tables.',
      answerHe: 'כן! מטפחים רבים מביאים סלון נייד מאובזר במלואו לבית שלך. זה מושלם לחיות מחמד חרדות או לוחות זמנים עמוסים. הוואן לטיפוח כולל ציוד מקצועי כולל מים חמים, מייבשים ושולחנות טיפוח.'
    },
    {
      id: 'groomer-3',
      question: 'How do I prepare my pet for grooming?',
      questionHe: 'איך מכינים את חיית המחמד לטיפוח?',
      answer: 'A short walk before the appointment helps calm your pet. Bring any reference photos for the style you want. Let us know about any skin sensitivities, matting, or behavioral concerns.',
      answerHe: 'טיול קצר לפני התור עוזר להרגיע את חיית המחמד שלך. הביאו תמונות התייחסות לסגנון שאתם רוצים. ספרו לנו על רגישויות עור, התסבכויות או חששות התנהגותיים.'
    },
  ],
  trainer: [
    {
      id: 'trainer-1',
      question: 'What training methods do you use?',
      questionHe: 'באילו שיטות אימון אתם משתמשים?',
      answer: 'Our trainers focus on positive-reinforcement methods — reward-based training that builds trust and communication between you and your dog, without aversive tools or punishment-based techniques.',
      answerHe: 'המאלפים שלנו מתמקדים בשיטות חיזוק חיובי — אימון מבוסס תגמול שבונה אמון ותקשורת בינך לבין הכלב שלך, ללא כלים אברסיביים או טכניקות מבוססות ענישה.'
    },
    {
      id: 'trainer-2',
      question: 'What\'s the difference between private and group sessions?',
      questionHe: 'מה ההבדל בין אימונים פרטיים לקבוצתיים?',
      answer: 'Private sessions focus on your specific goals - behavior issues, obedience, or trick training. Group classes are great for socialization and basic commands, typically 4-6 dogs per class with a structured curriculum.',
      answerHe: 'אימונים פרטיים מתמקדים במטרות הספציפיות שלך - בעיות התנהגות, ציות או אימון טריקים. שיעורים קבוצתיים מצוינים לסוציאליזציה ופקודות בסיסיות, בדרך כלל 4-6 כלבים לכיתה עם תוכנית לימודים מובנית.'
    },
    {
      id: 'trainer-3',
      question: 'How long until I see results?',
      questionHe: 'כמה זמן עד שרואים תוצאות?',
      answer: 'It varies by dog and goal. Basic behaviors often improve within a few sessions with consistent practice at home; more complex issues can take several weeks. Your trainer will set realistic expectations and provide homework between sessions.',
      answerHe: 'זה משתנה מכלב לכלב ולפי המטרה. התנהגויות בסיסיות משתפרות לרוב תוך כמה אימונים עם תרגול עקבי בבית; בעיות מורכבות יותר עשויות לקחת מספר שבועות. המאלף שלך יקבע ציפיות ריאליסטיות ויספק שיעורי בית בין האימונים.'
    },
  ],
};

interface MarketplaceFAQProps {
  platform: Platform;
  language?: 'en' | 'he';
  className?: string;
}

export function MarketplaceFAQ({ platform, language = 'en', className = '' }: MarketplaceFAQProps) {
  const isHebrew = language === 'he';
  const faqs = platformFAQs[platform] || [];

  // AEO/GEO — mirror the visible Q&A 1:1 into FAQPage JSON-LD so answer engines
  // (ChatGPT / Perplexity / Google AI Overviews) can cite them. Own <script>
  // (not the shared injectStructuredData block) so it composes with any existing
  // page structured data; removed on unmount so it never leaks to the next route.
  // Emitted in Hebrew (Israel is Hebrew-first search).
  useEffect(() => {
    if (faqs.length === 0) return;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.questionHe,
        acceptedAnswer: { '@type': 'Answer', text: f.answerHe },
      })),
    };
    const id = 'faq-jsonld';
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [platform, faqs]);

  if (faqs.length === 0) return null;

  return (
    <section className={`${className}`} dir={isHebrew ? 'rtl' : 'ltr'}>
      <h2 className="text-xl font-medium text-gray-900 mb-6">
        {isHebrew ? 'שאלות נפוצות' : 'Frequently Asked Questions'}
      </h2>
      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq) => (
          <AccordionItem
            key={faq.id}
            value={faq.id}
            className="border border-gray-100 rounded-2xl px-5 data-[state=open]:border-gray-200 data-[state=open]:bg-white/50"
          >
            <AccordionTrigger className="text-left text-gray-900 hover:no-underline py-4 text-base">
              {isHebrew ? faq.questionHe : faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-gray-600 pb-4 leading-relaxed">
              {isHebrew ? faq.answerHe : faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function getFAQsForPlatform(platform: Platform): FAQItem[] {
  return platformFAQs[platform] || [];
}

export default MarketplaceFAQ;
