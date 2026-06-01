/**
 * PetWash™ — Pet Birthday Reward Email 2026
 *
 * Triggered: 3 days before pet birthday (cron job)
 * Audience: pet owner (customer)
 * Type: MARKETING — UNSUBSCRIBE REQUIRED (Israeli Spam Law 5768-2008)
 */

import { PETWASH_LOGO_BASE64 } from './logo-base64';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from '@shared/support-contact';

// Brand tokens
const GOLD        = '#B8941F';
const GOLD_HERO   = '#C6A35B';
const BLACK       = '#111111';
const BODY_BG     = '#FFFFFF';
const HEADER_BG   = '#0F0F0F';
const DIVIDER     = '#E8DEC8';
const TEXT_PRI    = '#111111';
const TEXT_SEC    = '#555555';
const TEXT_DIM    = '#888888';
const GOLD_FADE   = '#F5EDD8';
const BUSINESS_HE = 'פט ווש בע"מ';
const BUSINESS_EN = 'Pet Wash Ltd';
const COMPANY_REG = '515895671';

const REWARD_LABELS = {
  free_wash:             { he: 'שטיפה חינמית מתנת יום הולדת', en: 'FREE birthday wash',         icon: '🎁' },
  discount_50:           { he: '50% הנחה לכבוד היום המיוחד', en: '50% birthday discount',   icon: '🎉' },
  discount_30:           { he: '30% הנחה לחגיגת יום הולדת', en: '30% birthday treat',      icon: '🎈' },
  free_grooming_session: { he: 'עיצוב חינם ליום הולדת',  en: 'FREE grooming session',    icon: '✨' },
  loyalty_bonus:         { he: 'בונוס נקודות נאמנות',   en: 'Loyalty points bonus',     icon: '💖' },
} as const;

type RewardType = keyof typeof REWARD_LABELS;

export interface PetBirthdayRewardParams {
  petName: string;
  petSpecies?: 'dog' | 'cat' | 'other';
  petAge?: number;
  ownerName: string;
  ownerEmail: string;
  rewardType: RewardType;
  rewardValueCents?: number;
  couponCode: string;
  couponExpiryDays: number;
  birthdayDate: string;
  loyaltyTier?: string;
  loyaltyPointsBonus?: number;
  unsubscribeUrl: string;
  language?: 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';
}

export function petBirthdayReward(p: PetBirthdayRewardParams): string {
  const lang = p.language ?? 'he';
  const isHe = lang === 'he';
  const petEmoji = p.petSpecies === 'cat' ? '🐱' : p.petSpecies === 'other' ? '🐾' : '🐶';
  const reward = REWARD_LABELS[p.rewardType];
  const birthdayFormatted = new Date(p.birthdayDate).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long' });
  const expiryDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + p.couponExpiryDays);
    return d.toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return `<!DOCTYPE html>
<html lang="${lang}" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${isHe ? `יום הולדת שמח ${p.petName}!` : `Happy Birthday ${p.petName}!`}</title>
</head>
<body style="margin:0;padding:0;background:${BODY_BG}">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="${BODY_BG}">
<tr><td align="center" style="padding:24px 8px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;border:1px solid ${DIVIDER}">

  <!-- HEADER -->
  <tr>
    <td bgcolor="${HEADER_BG}" style="padding:28px 32px;text-align:center;background:${HEADER_BG}">
      <img src="${PETWASH_LOGO_BASE64}" width="120" alt="Pet Wash™" style="display:block;margin:0 auto 16px"/>
      <div style="font-size:52px;margin-bottom:8px">${petEmoji}</div>
      <div style="color:${GOLD_HERO};font-size:24px;font-weight:700;letter-spacing:1px">
        ${isHe ? `יום הולדת שמח, ${p.petName}!` : `Happy Birthday, ${p.petName}!`}
      </div>
      <div style="color:#aaa;font-size:13px;margin-top:6px">${birthdayFormatted}</div>
    </td>
  </tr>

  <!-- GREETING -->
  <tr>
    <td style="padding:24px 32px;border-bottom:1px solid ${DIVIDER};direction:rtl">
      <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:${TEXT_PRI}">
        ${isHe ? `שלום ${p.ownerName}!` : `Hello ${p.ownerName}!`}
      </p>
      <p style="margin:0;font-size:14px;color:${TEXT_SEC};line-height:1.7">
        ${isHe
          ? `היום היום המיוחד של ${p.petName}! הכנסנו מתנה מיוחדת לכבוד היום המיוחד.`
          : `Today is ${p.petName}'s special day! We have a special birthday treat just for them.`}
      </p>
    </td>
  </tr>

  <!-- REWARD CARD -->
  <tr>
    <td style="padding:24px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:${GOLD_FADE};border:2px solid ${GOLD};border-radius:4px">
        <tr>
          <td style="padding:24px;text-align:center">
            <div style="font-size:40px;margin-bottom:12px">${reward.icon}</div>
            <div style="font-size:20px;font-weight:700;color:${BLACK};margin-bottom:8px">
              ${isHe ? reward.he : reward.en}
            </div>
            ${p.rewardValueCents ? `
            <div style="font-size:28px;font-weight:700;color:${GOLD};margin-bottom:12px">
              ₪${(p.rewardValueCents/100).toFixed(0)}
            </div>` : ``}
            <div style="margin:16px 0">
              <div style="font-size:11px;color:${TEXT_DIM};letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">
                ${isHe ? `קוד הטבה` : 'COUPON CODE'}
              </div>
              <div style="background:${HEADER_BG};padding:12px 24px;display:inline-block">
                <span style="font-size:20px;font-weight:700;color:${GOLD_HERO};font-family:monospace;letter-spacing:4px">
                  ${p.couponCode}
                </span>
              </div>
            </div>
            <div style="font-size:12px;color:${TEXT_SEC}">
              ${isHe ? `תקף עד: ${expiryDate}` : `Valid until: ${expiryDate}`}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:24px 32px 28px;text-align:center">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto">
        <tr><td style="background:${BLACK}">
          <a href="https://petwash.co.il/booking?coupon=${p.couponCode}"
             style="display:inline-block;padding:14px 40px;color:${GOLD};font-size:13px;font-weight:700;
                    text-decoration:none;letter-spacing:2px;text-transform:uppercase">
            ${isHe ? 'בקר עכשיו →' : 'BOOK NOW →'}
          </a>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- LEGAL FOOTER -->
  <tr>
    <td bgcolor="${HEADER_BG}" style="padding:20px 32px;text-align:center;background:${HEADER_BG}">
      <p style="margin:0 0 6px;font-size:11px;color:#888;direction:rtl">
        ${BUSINESS_HE} | ${BUSINESS_EN} | ח.פ. ${COMPANY_REG}
      </p>
      <p style="margin:0 0 6px;font-size:11px;color:#666">noreply@petwash.co.il | petwash.co.il</p>
      <p style="margin:0;font-size:10px;color:#555;direction:rtl">
        ${isHe ? `לביטול: <a href="${p.unsubscribeUrl}" style="color:${GOLD}">בטל הרשמה</a>` : `Unsubscribe: <a href="${p.unsubscribeUrl}" style="color:${GOLD}">Click here</a>`}
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
    }
