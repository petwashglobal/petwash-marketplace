import type { SeoFaqItem } from '@/components/SeoFaqSection';

// AEO/GEO — visible FAQ mirrored 1:1 into FAQPage JSON-LD so answer engines can
// lift a factual sentence verbatim. Truthful, legal-safe; price ₪55 incl VAT
// (CEO 2026-07-09). Module-level = stable reference (no effect re-run per render).
export const K9000_FAQ: SeoFaqItem[] = [
  {
    qHe: 'איך עובדת עמדת השטיפה העצמית ⁦K9000⁩?',
    qEn: 'How does the ⁦K9000⁩ self-service wash work?',
    aHe: 'בוחרים תוכנית, מכניסים את הכלב לעמדה, ומשתמשים בשמפו, מים חמים וייבוש — הכל בשירות עצמי, בלי תור.',
    aEn: 'Pick a program, place your dog in the bay, then use shampoo, warm water and drying — all self-service, no queue.',
  },
  {
    qHe: 'כמה עולה שטיפה?',
    qEn: 'How much is a wash?',
    aHe: 'שטיפה עצמית סטנדרטית עולה ₪55 (כולל מע״מ).',
    aEn: 'A standard self-service wash is ₪55 (VAT included).',
  },
  {
    qHe: 'אילו אמצעי תשלום מתקבלים?',
    qEn: 'What payment methods are accepted?',
    aHe: 'תשלום בכרטיס אשראי בעמדה, ולחברי מועדון גם דרך אפליקציית ⁦PetWash™⁩.',
    aEn: 'Credit card at the station, and members can also pay via the ⁦PetWash™⁩ app.',
  },
  {
    qHe: 'האם זה מתאים לכלבים גדולים?',
    qEn: 'Is it suitable for large dogs?',
    aHe: 'כן, עמדת ⁦K9000⁩ מתאימה לכלבים בגדלים שונים.',
    aEn: 'Yes, the ⁦K9000⁩ bay fits dogs of different sizes.',
  },
  {
    qHe: 'איפה אפשר למצוא עמדת ⁦K9000⁩?',
    qEn: 'Where can I find a ⁦K9000⁩ station?',
    aHe: 'העמדה הפעילה נמצאת בפארק יצחק ולד בכפר סבא, ותחנות נוספות נפתחות. ראו את עמוד המיקומים לפרטים עדכניים.',
    aEn: 'The active station is at Isaac Wald Park in Kfar Saba, with more opening. See the Locations page for current details.',
  },
];
