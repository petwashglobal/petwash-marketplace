/**
 * campaignTemplates.ts — the single source of truth for CAMPAIGN copy
 * (push + SMS + email), keyed by campaign, bilingual (Hebrew-first), premium.
 *
 * Why this exists: push copy was invented inline at every call site, SMS had only
 * a generic `marketing_offer` line, and the email bulk sender was disabled — so
 * there was nowhere for the CEO's beautiful campaign copy to live. This mirrors
 * the SMS registry pattern (server/services/smsTemplates.ts): a new campaign is
 * "add a row", and renderCampaign() interpolates + returns ready-to-send strings.
 *
 * Variables are {{var}} placeholders: {{firstName}} {{code}} {{discount}}
 * {{expiry}} {{link}}. Copy is short + premium (CEO §8): 3–5 word push titles,
 * one line under, one clear CTA, emojis used sparingly. Codes delivered here are
 * the recipient's OWN unique per-user code (un-spreadable) — see CouponService.
 *
 * SCOPE: campaign coupons apply to K9000 wash / packages / owned shop ONLY, never
 * JV provider services (protects the 15% commission). The copy reflects that.
 */

export type CampaignKey =
  | 'birthday'
  | 'new_year'
  | 'black_friday'
  | 'cyber_monday'
  | 'comeback'
  | 'first_time'
  | 'vip'
  | 'summer'
  | 'valentines'
  | 'christmas'
  | 'anniversary'
  | 'back_to_school'
  | 'premium_launch'
  | 'seasonal';

type Lang = 'he' | 'en';

interface ChannelCopy {
  /** Push title — keep 3–5 words. */
  titleHe: string; titleEn: string;
  /** Push body — one short line. */
  bodyHe: string; bodyEn: string;
  /** CTA button label. */
  ctaHe: string; ctaEn: string;
  /** SMS (single line, carries {{link}} + opt-out appended by sender). */
  smsHe: string; smsEn: string;
  /** Email subject. */
  subjectHe: string; subjectEn: string;
}

export interface CampaignTemplate extends ChannelCopy {
  emoji: string;
}

export const CAMPAIGN_TEMPLATES: Record<CampaignKey, CampaignTemplate> = {
  birthday: {
    emoji: '🎂',
    titleHe: 'יום הולדת שמח! 🎂', titleEn: 'Happy Birthday! 🎂',
    bodyHe: 'מתנה מיוחדת מחכה לך ולחבר הפרוותי. הקוד שלך: {{code}}', bodyEn: 'A special gift is waiting for you and your furry friend. Your code: {{code}}',
    ctaHe: 'למימוש המתנה', ctaEn: 'Claim your gift',
    smsHe: 'יום הולדת שמח מ-PetWash! 🎂 מתנה אישית מחכה לך: {{link}}', smsEn: 'Happy Birthday from PetWash! 🎂 A personal gift is waiting: {{link}}',
    subjectHe: 'מתנת יום ההולדת שלך מחכה 🎁', subjectEn: 'Your birthday gift is waiting 🎁',
  },
  new_year: {
    emoji: '✨',
    titleHe: 'שנה טובה! ✨', titleEn: 'Happy New Year! ✨',
    bodyHe: 'שנה חדשה, יותר כיף לחיה שלך. הקוד שלך: {{code}}', bodyEn: 'A fresh year, more tail wags. Your code: {{code}}',
    ctaHe: 'לקבלת ההטבה', ctaEn: 'Claim offer',
    smsHe: 'שנה טובה מ-PetWash! ✨ פתחו את השנה עם הטבה: {{link}}', smsEn: 'Happy New Year from PetWash! ✨ Start the year with a treat: {{link}}',
    subjectHe: 'הטבת השנה החדשה שלך ✨', subjectEn: 'Your New Year offer ✨',
  },
  black_friday: {
    emoji: '🖤',
    titleHe: 'בלאק פריידיי כאן 🖤', titleEn: 'Black Friday is here 🖤',
    bodyHe: 'המבצע הכי גדול שלנו לשנה. הקוד האישי שלך: {{code}}', bodyEn: 'Our biggest deal of the year. Your exclusive code: {{code}}',
    ctaHe: 'למימוש המבצע', ctaEn: 'Claim offer',
    smsHe: 'בלאק פריידיי ב-PetWash 🖤 הקוד האישי שלך, להיום בלבד: {{link}}', smsEn: 'Black Friday at PetWash 🖤 your code, today only: {{link}}',
    subjectHe: 'המבצע הגדול של השנה — להיום בלבד 🖤', subjectEn: 'Biggest deal of the year — today only 🖤',
  },
  cyber_monday: {
    emoji: '💻',
    titleHe: 'סייבר מאנדיי 💻', titleEn: 'Cyber Monday 💻',
    bodyHe: 'חיסכון אונליין בלעדי לחברי PetWash. הקוד שלך: {{code}}', bodyEn: 'Exclusive online savings for PetWash members. Your code: {{code}}',
    ctaHe: 'למימוש', ctaEn: 'Claim now',
    smsHe: 'סייבר מאנדיי ב-PetWash 💻 ההטבה נגמרת בחצות: {{link}}', smsEn: 'Cyber Monday at PetWash 💻 offer ends at midnight: {{link}}',
    subjectHe: 'סייבר מאנדיי — נגמר בחצות 💻', subjectEn: 'Cyber Monday — ends at midnight 💻',
  },
  comeback: {
    emoji: '💙',
    titleHe: 'התגעגענו אליכם 🐾', titleEn: 'We miss your pup 🐾',
    bodyHe: 'עבר זמן מאז הביקור האחרון. הטבת חזרה מחכה: {{code}}', bodyEn: "It's been a while. A welcome-back reward is waiting: {{code}}",
    ctaHe: 'לחזרה עם הטבה', ctaEn: 'Come back today',
    smsHe: 'התגעגענו! 🐾 הטבת חזרה אישית מחכה לך ב-PetWash: {{link}}', smsEn: 'We miss you! 🐾 A welcome-back reward is waiting at PetWash: {{link}}',
    subjectHe: 'התגעגענו אליכם — הטבת חזרה 🐾', subjectEn: 'We miss you — a welcome-back gift 🐾',
  },
  first_time: {
    emoji: '🎁',
    titleHe: 'ברוכים הבאים ל-PetWash 🎁', titleEn: 'Welcome to PetWash 🎁',
    bodyHe: 'הטבה לשטיפה הראשונה שלך. הקוד שלך: {{code}}', bodyEn: 'A treat for your first wash. Your code: {{code}}',
    ctaHe: 'להתחלה', ctaEn: 'Get started',
    smsHe: 'ברוכים הבאים ל-PetWash! 🎁 הטבה לשטיפה הראשונה: {{link}}', smsEn: 'Welcome to PetWash! 🎁 A gift for your first wash: {{link}}',
    subjectHe: 'הטבת הצטרפות לשטיפה הראשונה 🎁', subjectEn: 'Your welcome gift — first wash 🎁',
  },
  vip: {
    emoji: '⭐',
    titleHe: 'גישת VIP נפתחה ⭐', titleEn: 'VIP access unlocked ⭐',
    bodyHe: 'הטבות בלעדיות לחברי הפרסטיג׳. הקוד שלך: {{code}}', bodyEn: 'Exclusive member benefits, just for you. Your code: {{code}}',
    ctaHe: 'להטבות שלי', ctaEn: 'View benefits',
    smsHe: 'גישת VIP ב-PetWash ⭐ הטבות בלעדיות מחכות: {{link}}', smsEn: 'VIP access at PetWash ⭐ exclusive benefits await: {{link}}',
    subjectHe: 'גישת VIP נפתחה עבורך ⭐', subjectEn: 'VIP access unlocked ⭐',
  },
  summer: {
    emoji: '🌴',
    titleHe: 'הקיץ הגיע 🌴', titleEn: 'Summer has arrived 🌴',
    bodyHe: 'שמרו על החיה רעננה. הטבה עונתית: {{code}}', bodyEn: 'Keep your pet fresh all season. Seasonal offer: {{code}}',
    ctaHe: 'להטבה', ctaEn: 'View offer',
    smsHe: 'הקיץ כאן ב-PetWash 🌴 הטבה עונתית מחכה: {{link}}', smsEn: 'Summer is here at PetWash 🌴 a seasonal offer awaits: {{link}}',
    subjectHe: 'הטבת הקיץ שלך 🌴', subjectEn: 'Your summer offer 🌴',
  },
  valentines: {
    emoji: '❤️',
    titleHe: 'יום אהבת החיה ❤️', titleEn: 'Love your pet day ❤️',
    bodyHe: 'פנקו את החבר הכי טוב. הטבה מיוחדת: {{code}}', bodyEn: 'Show your best friend some love. Special reward: {{code}}',
    ctaHe: 'לפינוק', ctaEn: 'Treat them',
    smsHe: 'יום אהבת החיה ❤️ הטבה מיוחדת ב-PetWash: {{link}}', smsEn: 'Love your pet day ❤️ a special reward at PetWash: {{link}}',
    subjectHe: 'פינוק אהבה לחיה שלך ❤️', subjectEn: 'A little love for your pet ❤️',
  },
  christmas: {
    emoji: '🎄',
    titleHe: 'חג שמח 🎄', titleEn: 'Merry Christmas 🎄',
    bodyHe: 'פינוק חגיגי לחבר הפרוותי. הקוד שלך: {{code}}', bodyEn: 'Give your pet the holiday treatment. Your code: {{code}}',
    ctaHe: 'להטבה החגיגית', ctaEn: 'Claim festive reward',
    smsHe: 'חג שמח מ-PetWash 🎄 הטבה חגיגית מחכה: {{link}}', smsEn: 'Merry Christmas from PetWash 🎄 a festive reward awaits: {{link}}',
    subjectHe: 'הטבת החג שלך 🎄', subjectEn: 'Your holiday reward 🎄',
  },
  anniversary: {
    emoji: '🎉',
    titleHe: 'אנחנו חוגגים! 🎉', titleEn: "We're celebrating! 🎉",
    bodyHe: 'תודה שאתם חלק מהמסע. הפתעה מחכה: {{code}}', bodyEn: 'Thank you for being part of the journey. A surprise awaits: {{code}}',
    ctaHe: 'להפתעה', ctaEn: 'See surprise',
    smsHe: 'אנחנו חוגגים ב-PetWash! 🎉 הפתעה מחכה לך: {{link}}', smsEn: "We're celebrating at PetWash! 🎉 a surprise is waiting: {{link}}",
    subjectHe: 'הפתעת יום השנה מחכה 🎉', subjectEn: 'An anniversary surprise awaits 🎉',
  },
  back_to_school: {
    emoji: '📚',
    titleHe: 'חזרה לשגרה 📚', titleEn: 'Back to routine 📚',
    bodyHe: 'נשמור על השגרה של החיה. הטבה לחזרה: {{code}}', bodyEn: "Keep your pet's routine on track. Back-to-routine offer: {{code}}",
    ctaHe: 'להטבה', ctaEn: 'View offer',
    smsHe: 'חזרה לשגרה עם PetWash 📚 הטבה מחכה: {{link}}', smsEn: 'Back to routine with PetWash 📚 an offer awaits: {{link}}',
    subjectHe: 'הטבת חזרה לשגרה 📚', subjectEn: 'Your back-to-routine offer 📚',
  },
  premium_launch: {
    emoji: '🐾',
    titleHe: 'משהו גדול הגיע 🐾', titleEn: 'Something big has arrived 🐾',
    bodyHe: 'חוויית PetWash חדשה. הטבת השקה אישית: {{code}}', bodyEn: 'A new PetWash experience. Your launch reward: {{code}}',
    ctaHe: 'לגילוי', ctaEn: 'Explore now',
    smsHe: 'משהו גדול הגיע ל-PetWash 🐾 הטבת השקה מחכה: {{link}}', smsEn: 'Something big arrived at PetWash 🐾 a launch reward awaits: {{link}}',
    subjectHe: 'משהו גדול הגיע — הטבת השקה 🐾', subjectEn: 'Something big has arrived — launch reward 🐾',
  },
  seasonal: {
    emoji: '🐾',
    titleHe: 'הטבה מיוחדת ל-PetWash 🐾', titleEn: 'A special PetWash offer 🐾',
    bodyHe: 'הטבה לזמן מוגבל מחכה לך. הקוד שלך: {{code}}', bodyEn: 'A limited-time offer is waiting for you. Your code: {{code}}',
    ctaHe: 'למימוש', ctaEn: 'Claim offer',
    smsHe: 'הטבה מיוחדת לחברי PetWash 🐾 למימוש: {{link}}', smsEn: 'A special offer for PetWash members 🐾 claim: {{link}}',
    subjectHe: 'הטבה מיוחדת מחכה לך 🐾', subjectEn: 'A special offer is waiting 🐾',
  },
};

/** Deep-link a push/SMS/email lands on: opens the customer offer screen and
 *  carries the user's own code so it can be auto-applied (Phase 3 wires the tap). */
export function campaignDeepLink(key: CampaignKey, code: string): string {
  const c = encodeURIComponent(code);
  return `/prestige/home?campaign=${key}&code=${c}`;
}

function interpolate(s: string, vars: Record<string, string | number | undefined>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

export interface RenderedCampaign {
  push: { title: string; body: string; cta: string; data: { campaign: CampaignKey; code: string; deepLink: string } };
  sms: string;
  email: { subject: string; headline: string; body: string; cta: string };
  deepLink: string;
}

/**
 * Render a campaign for one recipient + channel set. Pass the recipient's OWN
 * unique code (from CouponService.issueToUser) so the delivered code is
 * un-spreadable. `link` defaults to the campaign deep-link if not supplied.
 */
export function renderCampaign(
  key: CampaignKey,
  lang: Lang,
  vars: { firstName?: string; code: string; discount?: string | number; expiry?: string; link?: string },
): RenderedCampaign {
  const t = CAMPAIGN_TEMPLATES[key] ?? CAMPAIGN_TEMPLATES.seasonal;
  const he = lang === 'he';
  const deepLink = vars.link ?? campaignDeepLink(key, vars.code);
  const v = { ...vars, link: deepLink };
  return {
    push: {
      title: interpolate(he ? t.titleHe : t.titleEn, v),
      body: interpolate(he ? t.bodyHe : t.bodyEn, v),
      cta: he ? t.ctaHe : t.ctaEn,
      data: { campaign: key, code: vars.code, deepLink },
    },
    sms: interpolate(he ? t.smsHe : t.smsEn, v),
    email: {
      subject: interpolate(he ? t.subjectHe : t.subjectEn, v),
      headline: interpolate(he ? t.titleHe : t.titleEn, v),
      body: interpolate(he ? t.bodyHe : t.bodyEn, v),
      cta: he ? t.ctaHe : t.ctaEn,
    },
    deepLink,
  };
}
