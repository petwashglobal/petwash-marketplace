import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export interface FAQItem {
  id: string;
  question: string;
  questionHe: string;
  answer: string;
  answerHe: string;
}

type Platform = 'sitter' | 'walker' | 'driver' | 'groomer' | 'trainer';

const platformFAQs: Record<Platform, FAQItem[]> = {
  sitter: [
    {
      id: 'sitter-1',
      question: 'How does pet sitting work with PetWash™?',
      questionHe: 'איך עובד שמרטוף חיות מחמד עם PetWash™?',
      answer: 'Our verified pet sitters offer two options: your pet can stay at their home, or they can come to your home while you\'re away. All sitters pass background checks, are insured, and follow our 7-star care standards. You\'ll receive daily photo updates and can message your sitter anytime.',
      answerHe: 'השמרטפים המאומתים שלנו מציעים שתי אפשרויות: חיית המחמד שלך יכולה להישאר בבית שלהם, או שהם יכולים לבוא לבית שלך בזמן שאתה בחופשה. כל השמרטפים עוברים בדיקות רקע, מבוטחים ועומדים בתקני הטיפול 7 כוכבים שלנו. תקבל עדכוני תמונות יומיים ותוכל לשלוח הודעות לשמרטף בכל עת.'
    },
    {
      id: 'sitter-2',
      question: 'What\'s included in the pet sitting service?',
      questionHe: 'מה כלול בשירות שמרטוף?',
      answer: 'Every stay includes feeding according to your schedule, fresh water, walks and playtime, bedtime routines, and daily photo updates. House sitting also includes plant watering, mail collection, and keeping your home secure and lived-in.',
      answerHe: 'כל שהייה כוללת האכלה לפי הלוח זמנים שלך, מים טריים, טיולים ומשחקים, שגרות שינה, ועדכוני תמונות יומיים. שמירה על הבית כוללת גם השקיית צמחים, איסוף דואר ושמירה על הבית מאוכלס ומאובטח.'
    },
    {
      id: 'sitter-3',
      question: 'How are sitters verified?',
      questionHe: 'איך מאמתים את השמרטפים?',
      answer: 'All PetWash™ sitters undergo ID verification, criminal background checks, reference checks, and a video interview. We verify their home environment and require proof of pet care experience. Only top-rated sitters earn our 7-star badge.',
      answerHe: 'כל שמרטפי PetWash™ עוברים אימות זהות, בדיקות רקע פלילי, בדיקות המלצות וראיון וידאו. אנחנו מאמתים את סביבת הבית שלהם ודורשים הוכחה לניסיון בטיפול בחיות מחמד. רק שמרטפים מדורגים גבוה מקבלים את התג 7 כוכבים שלנו.'
    },
    {
      id: 'sitter-4',
      question: 'What if there\'s an emergency?',
      questionHe: 'מה קורה אם יש מצב חירום?',
      answer: 'All sitters have access to our 24/7 emergency support line and are trained in pet first aid. We provide vet clinic contacts and your pet\'s medical history is shared with the sitter. Insurance covers vet emergencies during the stay.',
      answerHe: 'לכל השמרטפים יש גישה לקו החירום שלנו 24/7 והם מאומנים בעזרה ראשונה לחיות מחמד. אנחנו מספקים פרטי קשר של מרפאות וטרינריות וההיסטוריה הרפואית של חיית המחמד שלך משותפת עם השמרטף. הביטוח מכסה מצבי חירום וטרינריים במהלך השהייה.'
    },
    {
      id: 'sitter-5',
      question: 'How do I pay and what\'s the cancellation policy?',
      questionHe: 'איך משלמים ומה מדיניות הביטולים?',
      answer: 'Payment is held securely until your booking is complete. You can cancel for free up to 48 hours before the start date. Cancellations within 48 hours may be charged 50%. The sitter receives payment 72 hours after the stay ends.',
      answerHe: 'התשלום מוחזק בצורה מאובטחת עד שההזמנה שלך מסתיימת. אתה יכול לבטל בחינם עד 48 שעות לפני תאריך ההתחלה. ביטולים תוך 48 שעות עשויים להיות מחויבים ב-50%. השמרטף מקבל תשלום 72 שעות לאחר סיום השהייה.'
    },
  ],
  walker: [
    {
      id: 'walker-1',
      question: 'How does dog walking work?',
      questionHe: 'איך עובד שירות הטיולים?',
      answer: 'Book a one-time walk or set up recurring walks. Our walkers pick up your dog, take them on a 30 or 60-minute adventure, and return them home safely. You\'ll receive a GPS route map and photos after each walk.',
      answerHe: 'הזמן טיול חד-פעמי או הגדר טיולים קבועים. המטיילים שלנו אוספים את הכלב, לוקחים אותו להרפתקה של 30 או 60 דקות, ומחזירים אותו הביתה בשלום. תקבל מפת מסלול GPS ותמונות לאחר כל טיול.'
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
      answer: 'You can provide a key, lockbox code, or smart lock access. All walkers are background-checked and insured. We recommend a secure key handoff at your first booking.',
      answerHe: 'אתה יכול לספק מפתח, קוד לכספת או גישה למנעול חכם. כל המטיילים עברו בדיקת רקע ומבוטחים. אנחנו ממליצים על מסירת מפתח מאובטחת בהזמנה הראשונה שלך.'
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
      answer: 'All drivers complete our pet handling certification, including secure loading, calming techniques, and emergency procedures. Vehicles are inspected for safety and cleanliness.',
      answerHe: 'כל הנהגים מסיימים את הסמכת הטיפול בחיות מחמד שלנו, כולל העמסה מאובטחת, טכניקות הרגעה ונהלי חירום. הרכבים נבדקים לבטיחות וניקיון.'
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
      answer: 'Yes! Many groomers bring a fully-equipped mobile salon to your home. It\'s perfect for anxious pets or busy schedules. The grooming van has all professional equipment including warm water, dryers, and grooming tables.',
      answerHe: 'כן! מטפחים רבים מביאים סלון נייד מאובזר במלואו לבית שלך. זה מושלם לחיות מחמד חרדות או לוחות זמנים עמוסים. הוואן לטיפוח כולל את כל הציוד המקצועי כולל מים חמים, מייבשים ושולחנות טיפוח.'
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
      answer: 'All PetWash™ trainers use positive reinforcement methods only. We focus on reward-based training that builds trust and communication between you and your dog. No aversive tools or punishment-based techniques.',
      answerHe: 'כל מאלפי PetWash™ משתמשים רק בשיטות חיזוק חיובי. אנחנו מתמקדים באימון מבוסס תגמול שבונה אמון ותקשורת בינך לבין הכלב שלך. ללא כלים אברסיביים או טכניקות מבוססות ענישה.'
    },
    {
      id: 'trainer-2',
      question: 'What\'s the difference between private and group sessions?',
      questionHe: 'מה ההבדל בין אימונים פרטיים לקבוצתיים?',
      answer: 'Private sessions focus on your specific goals - behavior issues, obedience, or trick training. Group classes are great for socialization and basic commands, typically 4-6 dogs per class with structured curriculum.',
      answerHe: 'אימונים פרטיים מתמקדים במטרות הספציפיות שלך - בעיות התנהגות, ציות או אימון טריקים. שיעורים קבוצתיים מצוינים לסוציאליזציה ופקודות בסיסיות, בדרך כלל 4-6 כלבים לכיתה עם תוכנית לימודים מובנית.'
    },
    {
      id: 'trainer-3',
      question: 'How long until I see results?',
      questionHe: 'כמה זמן עד שרואים תוצאות?',
      answer: 'Basic behaviors can improve within 2-3 sessions with consistent practice at home. More complex behavioral issues may take 6-8 weeks. Your trainer will set realistic expectations and provide homework between sessions.',
      answerHe: 'התנהגויות בסיסיות יכולות להשתפר תוך 2-3 אימונים עם תרגול עקבי בבית. בעיות התנהגות מורכבות יותר עשויות לקחת 6-8 שבועות. המאלף שלך יקבע ציפיות ריאליסטיות ויספק שיעורי בית בין האימונים.'
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

  if (faqs.length === 0) return null;

  return (
    <section className={`${className}`}>
      <h2 className="text-xl font-medium text-gray-900 mb-6">
        {isHebrew ? 'שאלות נפוצות' : 'Frequently Asked Questions'}
      </h2>
      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq) => (
          <AccordionItem 
            key={faq.id} 
            value={faq.id}
            className="border border-gray-100 rounded-2xl px-5 data-[state=open]:border-gray-200 data-[state=open]:bg-gray-50/50"
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
