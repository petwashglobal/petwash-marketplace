/**
 * Global Special Days Promotion System
 *
 * Automatic promotions for international holidays:
 * - Black Friday
 * - Cyber Monday
 * - Valentine's Day
 * - Mother's Day
 * - Father's Day
 * - Family Day
 * - Pet Appreciation Week
 * - And more...
 *
 * Smart discounts that DON'T stack with other promotions (to prevent abuse)
 */
import { logger } from '../lib/logger';
/**
 * 2025 Global Special Days Calendar
 */
export const SPECIAL_DAYS_2025 = [
    // January
    {
        id: 'new-year-2025',
        name: 'New Year Celebration',
        nameHe: 'חגיגת השנה החדשה',
        nameAr: 'احتفال رأس السنة',
        date: new Date('2025-01-01'),
        discountPercent: 10,
        description: 'Start the year fresh! 10% off all pet wash services',
        descriptionHe: 'התחילו את השנה נקיים! 10% הנחה על כל שירותי הרחצה',
        descriptionAr: 'ابدأ العام نظيفًا! خصم 10٪ على جميع خدمات غسيل الحيوانات',
        emoji: '🎉',
        color: '#10b981',
        global: true,
    },
    // February
    {
        id: 'valentines-day-2025',
        name: "Valentine's Day",
        nameHe: 'יום האהבה',
        nameAr: 'عيد الحب',
        date: new Date('2025-02-14'),
        discountPercent: 15,
        description: 'Love your pet! 15% off - pamper your furry valentine',
        descriptionHe: 'אהבו את חיית המחמד שלכם! 15% הנחה - פנקו את הוולנטיין הפרוותי שלכם',
        descriptionAr: 'أحب حيوانك الأليف! خصم 15٪ - دلل حبيبك الفروي',
        emoji: '💝',
        color: '#ec4899',
        global: true,
    },
    // March
    {
        id: 'mothers-day-uk-2025',
        name: "Mother's Day (UK)",
        nameHe: 'יום האם (בריטניה)',
        nameAr: 'عيد الأم (المملكة المتحدة)',
        date: new Date('2025-03-30'),
        discountPercent: 12,
        description: "Mom's best friend deserves the best! 12% off",
        descriptionHe: 'החבר הטוב ביותר של אמא מגיע לה הטוב ביותר! 12% הנחה',
        descriptionAr: 'أفضل صديق لأمي يستحق الأفضل! خصم 12٪',
        emoji: '🌸',
        color: '#f472b6',
        global: false,
        countries: ['GB', 'IE'],
    },
    // April
    {
        id: 'earth-day-2025',
        name: 'Earth Day',
        nameHe: 'יום כדור הארץ',
        nameAr: 'يوم الأرض',
        date: new Date('2025-04-22'),
        discountPercent: 10,
        description: 'Eco-friendly wash! 10% off - save water, save the planet',
        descriptionHe: 'רחצה ידידותית לסביבה! 10% הנחה - חסכו במים, הצילו את כדור הארץ',
        descriptionAr: 'غسيل صديق للبيئة! خصم 10٪ - وفر الماء، أنقذ الكوكب',
        emoji: '🌍',
        color: '#10b981',
        global: true,
    },
    // May
    {
        id: 'mothers-day-us-2025',
        name: "Mother's Day (USA/Canada)",
        nameHe: 'יום האם (ארה"ב/קנדה)',
        nameAr: 'عيد الأم (الولايات المتحدة / كندا)',
        date: new Date('2025-05-11'),
        discountPercent: 12,
        description: "Treat mom's furry companion! 12% off",
        descriptionHe: 'פנקו את בן הלוויה הפרוותי של אמא! 12% הנחה',
        descriptionAr: 'دلل رفيق أمي الفروي! خصم 12٪',
        emoji: '🌸',
        color: '#f472b6',
        global: false,
        countries: ['US', 'CA', 'AU'],
    },
    // June
    {
        id: 'fathers-day-2025',
        name: "Father's Day",
        nameHe: 'יום האב',
        nameAr: 'عيد الأب',
        date: new Date('2025-06-15'),
        discountPercent: 12,
        description: "Dad's best buddy deserves a spa day! 12% off",
        descriptionHe: 'החבר הכי טוב של אבא מגיע לו יום ספא! 12% הנחה',
        descriptionAr: 'أفضل صديق لأبي يستحق يوم سبا! خصم 12٪',
        emoji: '👔',
        color: '#3b82f6',
        global: true,
    },
    // July
    {
        id: 'independence-day-us-2025',
        name: 'Independence Day (USA)',
        nameHe: 'יום העצמאות האמריקאי',
        nameAr: 'عيد الاستقلال (الولايات المتحدة)',
        date: new Date('2025-07-04'),
        discountPercent: 15,
        description: 'Celebrate freedom with a fresh pup! 15% off',
        descriptionHe: 'חגגו חופש עם כלב נקי! 15% הנחה',
        descriptionAr: 'احتفل بالحرية مع كلب نظيف! خصم 15٪',
        emoji: '🇺🇸',
        color: '#ef4444',
        global: false,
        countries: ['US'],
    },
    // August
    {
        id: 'international-dog-day-2025',
        name: 'International Dog Day',
        nameHe: 'יום הכלב הבינלאומי',
        nameAr: 'اليوم العالمي للكلب',
        date: new Date('2025-08-26'),
        discountPercent: 20,
        description: '🐕 Biggest sale of the year! 20% off all services',
        descriptionHe: '🐕 המבצע הגדול של השנה! 20% הנחה על כל השירותים',
        descriptionAr: '🐕 أكبر تخفيض في السنة! خصم 20٪ على جميع الخدمات',
        emoji: '🐕',
        color: '#f59e0b',
        global: true,
    },
    // September
    {
        id: 'family-day-2025',
        name: 'International Family Day',
        nameHe: 'יום המשפחה הבינלאומי',
        nameAr: 'اليوم العالمي للأسرة',
        date: new Date('2025-09-15'),
        discountPercent: 10,
        description: 'Family includes furry members! 10% off',
        descriptionHe: 'המשפחה כוללת גם חברים פרוותיים! 10% הנחה',
        descriptionAr: 'العائلة تشمل الأعضاء الفرويين! خصم 10٪',
        emoji: '👨‍👩‍👧‍👦',
        color: '#8b5cf6',
        global: true,
    },
    // November
    {
        id: 'black-friday-2025',
        name: 'Black Friday',
        nameHe: 'בלאק פריידי',
        nameAr: 'الجمعة السوداء',
        date: new Date('2025-11-28'),
        discountPercent: 25,
        description: '💥 BLACK FRIDAY! 25% off - biggest discount ever!',
        descriptionHe: '💥 בלאק פריידי! 25% הנחה - ההנחה הכי גדולה אי פעם!',
        descriptionAr: '💥 الجمعة السوداء! خصم 25٪ - أكبر خصم على الإطلاق!',
        emoji: '💥',
        color: '#000000',
        global: true,
    },
    {
        id: 'cyber-monday-2025',
        name: 'Cyber Monday',
        nameHe: 'סייבר מאנדי',
        nameAr: 'الاثنين الإلكتروني',
        date: new Date('2025-12-01'),
        discountPercent: 20,
        description: '🖥️ CYBER MONDAY! 20% off online bookings only',
        descriptionHe: '🖥️ סייבר מאנדי! 20% הנחה להזמנות אונליין בלבד',
        descriptionAr: '🖥️ الاثنين الإلكتروني! خصم 20٪ على الحجوزات عبر الإنترنت فقط',
        emoji: '🖥️',
        color: '#3b82f6',
        global: true,
    },
    // December
    {
        id: 'christmas-2025',
        name: 'Christmas',
        nameHe: 'חג המולד',
        nameAr: 'عيد الميلاد',
        date: new Date('2025-12-25'),
        discountPercent: 15,
        description: '🎄 Merry Christmas! 15% off - gift your pet a spa day',
        descriptionHe: '🎄 חג מולד שמח! 15% הנחה - תנו לחיית המחמד שלכם יום ספא במתנה',
        descriptionAr: '🎄 عيد ميلاد سعيد! خصم 15٪ - امنح حيوانك الأليف يوم سبا',
        emoji: '🎄',
        color: '#ef4444',
        global: true,
    },
];
/**
 * Get active promotion for today
 */
export function getTodaysPromotion(userCountry) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const promo of SPECIAL_DAYS_2025) {
        const promoDate = new Date(promo.date);
        promoDate.setHours(0, 0, 0, 0);
        // Check if it's the promotion day
        if (promoDate.getTime() === today.getTime()) {
            // Check if promotion applies to user's country
            if (promo.global) {
                return promo;
            }
            else if (promo.countries && userCountry && promo.countries.includes(userCountry)) {
                return promo;
            }
        }
    }
    return null;
}
/**
 * Get upcoming promotions (next 30 days)
 */
export function getUpcomingPromotions(daysAhead = 30, userCountry) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    return SPECIAL_DAYS_2025.filter(promo => {
        const promoDate = new Date(promo.date);
        promoDate.setHours(0, 0, 0, 0);
        const isInRange = promoDate >= today && promoDate <= futureDate;
        if (!isInRange)
            return false;
        // Check country
        if (promo.global)
            return true;
        return promo.countries && userCountry && promo.countries.includes(userCountry);
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
/**
 * Apply promotion discount to price
 * IMPORTANT: Does NOT stack with other discounts
 */
export function applyPromotionDiscount(basePrice, promotion, existingDiscount = 0) {
    // Don't stack promotions (prevent abuse)
    if (existingDiscount > 0) {
        logger.info(`[Promotions] Existing discount ${existingDiscount}% - NOT stacking with ${promotion.name}`);
        // Use whichever discount is better
        if (promotion.discountPercent > existingDiscount) {
            const discountAmount = basePrice * (promotion.discountPercent / 100);
            const finalPrice = basePrice - discountAmount;
            return {
                finalPrice,
                discountAmount,
                discountPercent: promotion.discountPercent,
                promotionApplied: true,
                reason: `${promotion.name} discount (${promotion.discountPercent}%) is better than existing discount (${existingDiscount}%)`,
            };
        }
        else {
            return {
                finalPrice: basePrice - (basePrice * (existingDiscount / 100)),
                discountAmount: basePrice * (existingDiscount / 100),
                discountPercent: existingDiscount,
                promotionApplied: false,
                reason: `Existing discount (${existingDiscount}%) is better than ${promotion.name} (${promotion.discountPercent}%)`,
            };
        }
    }
    // Apply promotion discount
    const discountAmount = basePrice * (promotion.discountPercent / 100);
    const finalPrice = basePrice - discountAmount;
    logger.info(`[Promotions] Applied ${promotion.name}: ${promotion.discountPercent}% off`);
    return {
        finalPrice,
        discountAmount,
        discountPercent: promotion.discountPercent,
        promotionApplied: true,
    };
}
/**
 * Check if a specific date has a promotion
 */
export function hasPromotionOnDate(date, userCountry) {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    for (const promo of SPECIAL_DAYS_2025) {
        const promoDate = new Date(promo.date);
        promoDate.setHours(0, 0, 0, 0);
        if (promoDate.getTime() === checkDate.getTime()) {
            if (promo.global)
                return true;
            if (promo.countries && userCountry && promo.countries.includes(userCountry))
                return true;
        }
    }
    return false;
}
export default {
    SPECIAL_DAYS_2025,
    getTodaysPromotion,
    getUpcomingPromotions,
    applyPromotionDiscount,
    hasPromotionOnDate,
};
