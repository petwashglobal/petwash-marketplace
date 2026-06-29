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
    // NOTE: benefits below are deliberately NON-MONETARY (experiences, priority,
    // early access, closed-loop loyalty points on eligible K9000 washes only).
    // NEVER promise % discounts on "all bookings/services", free services,
    // cashback, or lifetime discounts here — discounts are K9000-eligible-only
    // and governed by PetWash terms. See loyalty discount policy.
    bronze: {
          nameEn: 'Member', nameHe: 'חבר',
          color: '#cd7f32', glowColor: 'rgba(205,127,50,0.15)', icon: '🥉',
          benefitsEn: ['Priority booking windows', 'Birthday surprise', 'Member-only updates & early access'],
          benefitsHe: ['חלון הזמנה מועדף', 'הפתעת יום הולדת', 'עדכונים והשקות מוקדמות לחברים'],
          nextTierEn: 'Silver', nextTierHe: 'כסף', pointsToNext: 500,
    },
    silver: {
          nameEn: 'Silver', nameHe: 'כסף',
          color: '#9ca3af', glowColor: 'rgba(156,163,175,0.15)', icon: '🥈',
          benefitsEn: ['Skip-the-queue priority booking', 'Early access to new products & stations', 'Birthday surprise'],
          benefitsHe: ['קפיצת תור — הזמנה מועדפת', 'גישה מוקדמת למוצרים ולתחנות חדשים', 'הפתעת יום הולדת'],
          nextTierEn: 'Gold', nextTierHe: 'זהב', pointsToNext: 1000,
    },
    gold: {
          nameEn: 'Gold', nameHe: 'זהב',
          color: '#C9A96E', glowColor: 'rgba(201,169,110,0.2)', icon: '🥇',
          benefitsEn: ['Dedicated member support', 'Early access to new products & stations', '2× loyalty points on eligible K9000 washes'],
          benefitsHe: ['תמיכת חברים ייעודית', 'גישה מוקדמת למוצרים ולתחנות חדשים', 'פי 2 נקודות נאמנות בשטיפות K9000 זכאיות'],
          nextTierEn: 'Platinum', nextTierHe: 'פלטינה', pointsToNext: 2500,
    },
    platinum: {
          nameEn: 'Platinum', nameHe: 'פלטינה',
          color: '#e5e7eb', glowColor: 'rgba(229,231,235,0.2)', icon: '💎',
          benefitsEn: ['Priority same-day booking', 'Early access to member events', '3× loyalty points on eligible K9000 washes'],
          benefitsHe: ['הזמנה מועדפת באותו יום', 'גישה מוקדמת לאירועי חברים', 'פי 3 נקודות נאמנות בשטיפות K9000 זכאיות'],
          nextTierEn: 'Diamond', nextTierHe: 'יהלום', pointsToNext: 5000,
    },
    diamond: {
          nameEn: 'Diamond', nameHe: 'יהלום',
          color: '#cbd5e1', glowColor: 'rgba(203,213,225,0.2)', icon: '✨',
          benefitsEn: ['White-glove concierge booking', 'Invitations to member experiences', '5× loyalty points on eligible K9000 washes'],
          benefitsHe: ['שירות קונסיירז׳ אישי בהזמנות', 'הזמנות לחוויות חברים', 'פי 5 נקודות נאמנות בשטיפות K9000 זכאיות'],
          nextTierEn: 'Emerald', nextTierHe: 'אמרלד', pointsToNext: 10000,
    },
    emerald: {
          nameEn: 'Emerald', nameHe: 'אמרלד',
          color: '#34d399', glowColor: 'rgba(52,211,153,0.2)', icon: '💚',
          benefitsEn: ['Personal pet-wellness concierge', 'VIP event invitations', 'Early access to everything new'],
          benefitsHe: ['קונסיירז׳ רווחת חיות אישי', 'הזמנות לאירועי VIP', 'גישה מוקדמת לכל מה שחדש'],
          nextTierEn: 'Black Reserve', nextTierHe: 'Black Reserve', pointsToNext: 25000,
    },
    royal: {
          nameEn: 'Black Reserve', nameHe: 'Black Reserve',
          color: '#D4AF37', glowColor: 'rgba(212,175,55,0.3)', icon: '🌟',
          benefitsEn: ['Dedicated senior concierge', 'Exclusive member experiences & events', 'Name on our Wall of Honor'],
          benefitsHe: ['קונסיירז׳ בכיר ייעודי', 'חוויות ואירועים בלעדיים לחברים', 'שמכם על לוח הכבוד שלנו'],
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
        disclaimer: isHe
          ? 'דרגת ה-PetWash Prestige שלך עודכנה. הטבות, תגמולים, גישה מוקדמת וחוויות חברים זמינים בכפוף לזכאות ולתנאי PetWash. תגמולי והנחות שטיפת K9000 חלים רק במקום שבו הם זכאים ובהתאם לתנאי PetWash.'
          : 'Your PetWash Prestige tier has been updated. Your tier may unlock eligible PetWash benefits, rewards, early access, and member experiences. K9000 wash rewards and discounts apply only where eligible and according to PetWash terms.',
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

                                                                                                                                                                                                                                                            <!-- ELIGIBILITY DISCLAIMER (PetWash terms; no blanket discount promises) -->
                                                                                                                                                                                                                                                              <tr>
                                                                                                                                                                                                                                                                  <td style="padding:0 40px 24px;">
                                                                                                                                                                                                                                                                        <p style="margin:0;font-size:11px;line-height:1.6;color:#999;text-align:center;">${t.disclaimer}</p>
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
