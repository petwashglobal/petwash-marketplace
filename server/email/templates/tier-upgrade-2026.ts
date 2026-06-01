import { PETWASH_LOGO_BASE64 } from './logo-base64';
import { SUPPORT_EMAIL } from '../../../shared/support-contact';
import { BRAND_NAME, LEGAL_NAME_HE, LEGAL_NAME_EN, COMPANY_TAX_ID } from '../brand-identity';

// ============================================================
// PetWash™ — Loyalty Tier Upgrade Email 2026
// Triggered when customer crosses a points threshold
// 7 tiers: Bronze → Silver → Gold → Platinum → Diamond → Elite → Prestige
// This is a HIGH-VALUE retention moment — make it feel special!
// Brand: Black · Gold · White | NO PURPLE | Bilingual HE+EN
// ============================================================

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'elite' | 'prestige';

export interface TierConfig {
    nameEn: string;
    nameHe: string;
    color: string;        // Tier accent color
  icon: string;         // Tier emoji icon
  glowColor: string;    // Subtle glow for header
  benefitsEn: string[];
    benefitsHe: string[];
    nextTierEn?: string;
    nextTierHe?: string;
    pointsToNext?: number;
}

export const TIER_CONFIGS: Record<LoyaltyTier, TierConfig> = {
    bronze: {
          nameEn: 'Bronze', nameHe: 'ברונזה',
          color: '#cd7f32', glowColor: 'rgba(205,127,50,0.15)', icon: '🥉',
          benefitsEn: ['5% discount on all bookings', 'Priority booking windows', 'Birthday surprise'],
          benefitsHe: ['הנחה של 5% על כל הזמנה', 'חלון הזמנה מועדף', 'הפתעת יום הולדת'],
          nextTierEn: 'Silver', nextTierHe: 'כסף', pointsToNext: 500,
    },
    silver: {
          nameEn: 'Silver', nameHe: 'כסף',
          color: '#9ca3af', glowColor: 'rgba(156,163,175,0.15)', icon: '🥈',
          benefitsEn: ['8% discount on all bookings', 'Free shampoo upgrade', 'Skip the queue — priority booking', 'Monthly wash credit'],
          benefitsHe: ['הנחה של 8% על כל הזמנה', 'שדרוג שמפו חינם', 'קפיצת תור — הזמנה מועדפת', 'קרדיט שטיפה חודשי'],
          nextTierEn: 'Gold', nextTierHe: 'זהב', pointsToNext: 1000,
    },
    gold: {
          nameEn: 'Gold', nameHe: 'זהב',
          color: '#C9A96E', glowColor: 'rgba(201,169,110,0.2)', icon: '🥇',
          benefitsEn: ['12% discount on all bookings', 'Free grooming add-ons', 'Dedicated account manager', '2x loyalty points on K9000'],
          benefitsHe: ['הנחה של 12% על כל הזמנה', 'תוספות טיפוח חינם', 'מנהל לקוח ייעודי', 'פי 2 נקודות ב-K9000'],
          nextTierEn: 'Platinum', nextTierHe: 'פלטינה', pointsToNext: 2500,
    },
    platinum: {
          nameEn: 'Platinum', nameHe: 'פלטינה',
          color: '#e5e7eb', glowColor: 'rgba(229,231,235,0.2)', icon: '💎',
          benefitsEn: ['15% discount on all bookings', 'Free monthly grooming session', '3x loyalty points on all services', 'Priority same-day service', 'eGift card on anniversary'],
          benefitsHe: ['הנחה של 15% על כל הזמנה', 'טיפול גריידינג חודשי חינם', 'פי 3 נקודות על כל שירות', 'שירות ביום אותו — עדיפות', 'כרטיס מתנה ביום השנה'],
          nextTierEn: 'Diamond', nextTierHe: 'יהלום', pointsToNext: 5000,
    },
    diamond: {
          nameEn: 'Diamond', nameHe: 'יהלום',
          color: '#818cf8', glowColor: 'rgba(129,140,248,0.2)', icon: '✨',
          benefitsEn: ['18% discount on all bookings', 'Monthly home visit grooming', '5x loyalty points', 'White-glove concierge booking', 'Quarterly gift hamper'],
          benefitsHe: ['הנחה של 18% על כל הזמנה', 'טיפול גריידינג ביתי חודשי', 'פי 5 נקודות', 'הזמנה קונסיירז', 'סל מתנה רבעוני'],
          nextTierEn: 'Elite', nextTierHe: 'עילית', pointsToNext: 10000,
    },
    elite: {
          nameEn: 'Elite', nameHe: 'עילית',
          color: '#f59e0b', glowColor: 'rgba(245,158,11,0.2)', icon: '👑',
          benefitsEn: ['20% discount on all services', 'Unlimited complimentary add-ons', '10x loyalty points', 'Personal pet wellness advisor', 'Annual luxury hamper', 'VIP event invitations'],
          benefitsHe: ['הנחה של 20% על כל השירותים', 'תוספות חינמיות ללא הגבלה', 'פי 10 נקודות', 'יועץ בריאות חיות אישי', 'סל יוקרה שנתי', 'הזמנות לאירועי VIP'],
          nextTierEn: 'Prestige', nextTierHe: 'פרסטיג\'', pointsToNext: 25000,
    },
    prestige: {
          nameEn: 'Prestige', nameHe: 'פרסטיג\'',
          color: '#C9A96E', glowColor: 'rgba(201,169,110,0.3)', icon: '🌟',
          benefitsEn: ['25% lifetime discount', 'Dedicated senior account manager', 'All services complimentary once/month', 'Exclusive franchise partner events', 'Annual 5-star pet spa retreat', 'Name on our Wall of Honor'],
          benefitsHe: ['הנחה לכל החיים של 25%', 'מנהל לקוח בכיר ייעודי', 'כל השירותים חינמיים פעם בחודש', 'אירועים בלעדיים לשותפי זכיינות', 'ריטריט ספא לחיות 5 כוכבים שנתי', 'שמכם על לוח הכבוד שלנו'],
    },
};

export interface TierUpgradeParams {
    language: 'en' | 'he';
    firstName: string;
    newTier: LoyaltyTier;
    previousTier?: LoyaltyTier;
    totalPoints: number;
    dashboardUrl: string;
    bookNowUrl: string;
}

export function buildTierUpgradeEmail(p: TierUpgradeParams): string {
    const isHe = p.language === 'he';
    const dir = isHe ? 'rtl' : 'ltr';
    const year = new Date().getFullYear();
    const tc = TIER_CONFIGS[p.newTier];

  const t = {
        preheader: isHe
          ? `מזל טוב ${p.firstName}! עלית לדרגת ${tc.nameHe} ב-Pet Wash™`
                : `Congratulations ${p.firstName}! You've reached ${tc.nameEn} tier at Pet Wash™`,
        headline: isHe ? `ברוכים הבאים לדרגת ${tc.nameHe}!` : `Welcome to ${tc.nameEn}!`,
        sub: isHe
          ? `${p.firstName}, עברת לדרגה חדשה`
                : `${p.firstName}, you've leveled up`,
        yourPoints: isHe ? `${p.totalPoints.toLocaleString()} נקודות` : `${p.totalPoints.toLocaleString()} points`,
        benefitsTitle: isHe ? 'ההטבות החדשות שלך' : 'Your New Benefits',
        nextTitle: isHe ? 'הדרגה הבאה' : 'Next Level',
        nextSub: isHe
          ? (tc.nextTierHe ? `עוד ${(tc.pointsToNext || 0).toLocaleString()} נקודות לדרגת ${tc.nextTierHe}` : 'הגעת לדרגה הגבוהה ביותר! 🏆')
                : (tc.nextTierEn ? `${(tc.pointsToNext || 0).toLocaleString()} more points to reach ${tc.nextTierEn}` : 'You\'ve reached the highest tier! 🏆'),
        dashBtn: isHe ? 'צפה בהטבות' : 'View My Benefits',
        bookBtn: isHe ? 'הזמן עכשיו' : 'Book Now',
        footer1: isHe ? 'שאלות? אנחנו כאן בשבילך' : 'Questions? We\'re here for you',
  };

  const benefits = isHe ? tc.benefitsHe : tc.benefitsEn;

  return `<!DOCTYPE html>
  <html dir="${dir}" lang="${p.language}">
  <head>
    <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>${t.headline}</title>
          <style>
              @media only screen and (max-width:600px){ .pw-wrap{width:100%!important;} }
                </style>
                </head>
                <body style="margin:0;padding:0;background:#f5f5f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                <span style="display:none;max-height:0;overflow:hidden;">${t.preheader}</span>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f0;">
                <tr><td align="center" style="padding:32px 16px;">
                <table class="pw-wrap" width="600" cellpadding="0" cellspacing="0" border="0"
                  style="background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.12);">

                    <!-- CELEBRATION HEADER -->
                      <tr>
                          <td style="background:linear-gradient(160deg,#0a0a0a 0%,#111 50%,#0a0a0a 100%);
                                padding:48px 40px 36px;text-align:center;
                                      box-shadow:inset 0 0 60px ${tc.glowColor};">
                                            <img src="${PETWASH_LOGO_BASE64}" alt="${BRAND_NAME}" width="120"
                                                    style="display:block;margin:0 auto 24px;width:120px;height:auto;" />
                                                          <div style="font-size:52px;margin-bottom:12px;line-height:1;">${tc.icon}</div>
                                                                <h1 style="margin:0;font-size:28px;font-weight:300;letter-spacing:2px;color:${tc.color};">
                                                                        ${t.headline}
                                                                              </h1>
                                                                                    <p style="margin:10px 0 0;font-size:15px;color:#999;">${t.sub}</p>
                                                                                          <div style="margin:20px auto 0;display:inline-block;padding:10px 24px;
                                                                                                  border:1px solid ${tc.color};opacity:.8;">
                                                                                                          <span style="font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${tc.color};">
                                                                                                                    ${isHe ? tc.nameHe : tc.nameEn}
                                                                                                                            </span>
                                                                                                                                  </div>
                                                                                                                                        <p style="margin:12px 0 0;font-size:13px;color:#666;">${t.yourPoints}</p>
                                                                                                                                            </td>
                                                                                                                                              </tr>
                                                                                                                                              
                                                                                                                                                <!-- BENEFITS -->
                                                                                                                                                  <tr>
                                                                                                                                                      <td style="padding:32px 40px 24px;">
                                                                                                                                                            <h2 style="margin:0 0 20px;font-size:13px;font-weight:700;color:${tc.color};
                                                                                                                                                                    letter-spacing:3px;text-transform:uppercase;text-align:center;">${t.benefitsTitle}</h2>
                                                                                                                                                                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                                                                                                                                                  ${benefits.map((b, i) => `
                                                                                                                                                                                          <tr>
                                                                                                                                                                                                    <td style="padding:10px 0;${i < benefits.length - 1 ? 'border-bottom:1px solid #f5f2ea;' : ''}">
                                                                                                                                                                                                                <span style="color:${tc.color};font-weight:700;margin-${isHe ? 'left' : 'right'}:10px;">✓</span>
                                                                                                                                                                                                                            <span style="font-size:14px;color:#1a1a1a;">${b}</span>
                                                                                                                                                                                                                                      </td>
                                                                                                                                                                                                                                              </tr>`).join('')}
                                                                                                                                                                                                                                                    </table>
                                                                                                                                                                                                                                                        </td>
                                                                                                                                                                                                                                                          </tr>
                                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                                            <!-- NEXT TIER TEASER -->
                                                                                                                                                                                                                                                              ${tc.nextTierEn || tc.nextTierHe ? `
                                                                                                                                                                                                                                                                <tr>
                                                                                                                                                                                                                                                                    <td style="padding:0 40px 24px;">
                                                                                                                                                                                                                                                                          <div style="background:#0a0a0a;padding:20px 24px;text-align:center;">
                                                                                                                                                                                                                                                                                  <p style="margin:0 0 4px;font-size:11px;color:#555;font-weight:700;
                                                                                                                                                                                                                                                                                            letter-spacing:2px;text-transform:uppercase;">${t.nextTitle}</p>
                                                                                                                                                                                                                                                                                                    <p style="margin:0;font-size:14px;color:#888;">${t.nextSub}</p>
                                                                                                                                                                                                                                                                                                          </div>
                                                                                                                                                                                                                                                                                                              </td>
                                                                                                                                                                                                                                                                                                                </tr>` : ''}
                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                  <!-- CTA BUTTONS -->
                                                                                                                                                                                                                                                                                                                    <tr>
                                                                                                                                                                                                                                                                                                                        <td style="padding:8px 40px 32px;text-align:center;">
                                                                                                                                                                                                                                                                                                                              <a href="${p.dashboardUrl}" style="display:inline-block;background:${tc.color};color:#fff;
                                                                                                                                                                                                                                                                                                                                      text-decoration:none;padding:14px 32px;font-size:12px;font-weight:700;
                                                                                                                                                                                                                                                                                                                                              letter-spacing:2px;text-transform:uppercase;margin:0 8px 8px;">
                                                                                                                                                                                                                                                                                                                                                      ${t.dashBtn}
                                                                                                                                                                                                                                                                                                                                                            </a>
                                                                                                                                                                                                                                                                                                                                                                  <a href="${p.bookNowUrl}" style="display:inline-block;background:#1a1a1a;color:#C9A96E;
                                                                                                                                                                                                                                                                                                                                                                          text-decoration:none;padding:14px 32px;font-size:12px;font-weight:700;
                                                                                                                                                                                                                                                                                                                                                                                  letter-spacing:2px;text-transform:uppercase;margin:0 8px 8px;">
                                                                                                                                                                                                                                                                                                                                                                                          ${t.bookBtn}
                                                                                                                                                                                                                                                                                                                                                                                                </a>
                                                                                                                                                                                                                                                                                                                                                                                                    </td>
                                                                                                                                                                                                                                                                                                                                                                                                      </tr>
                                                                                                                                                                                                                                                                                                                                                                                                      
                                                                                                                                                                                                                                                                                                                                                                                                        <!-- FOOTER -->
                                                                                                                                                                                                                                                                                                                                                                                                          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#e8e4d8,transparent);"></td></tr>
                                                                                                                                                                                                                                                                                                                                                                                                            <tr>
                                                                                                                                                                                                                                                                                                                                                                                                                <td style="background:#0a0a0a;padding:20px 40px;text-align:center;">
                                                                                                                                                                                                                                                                                                                                                                                                                      <p style="margin:0 0 4px;color:#666;font-size:12px;">
                                                                                                                                                                                                                                                                                                                                                                                                                              ${t.footer1}: <a href="mailto:${SUPPORT_EMAIL}" style="color:#C9A96E;text-decoration:none;">${SUPPORT_EMAIL}</a>
                                                                                                                                                                                                                                                                                                                                                                                                                                    </p>
                                                                                                                                                                                                                                                                                                                                                                                                                                          <p style="margin:0;color:#444;font-size:11px;">${BRAND_NAME} | ${LEGAL_NAME_HE} | ${LEGAL_NAME_EN} | ח.פ. ${COMPANY_TAX_ID} | © ${year}</p>
                                                                                                                                                                                                                                                                                                                                                                                                                                              </td>
                                                                                                                                                                                                                                                                                                                                                                                                                                                </tr>
                                                                                                                                                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                                                                                                                                                </table>
                                                                                                                                                                                                                                                                                                                                                                                                                                                </td></tr>
                                                                                                                                                                                                                                                                                                                                                                                                                                                </table>
                                                                                                                                                                                                                                                                                                                                                                                                                                                </body>
                                                                                                                                                                                                                                                                                                                                                                                                                                                </html>`;
}
