import { PETWASH_LOGO_BASE64 } from './logo-base64';
import { TIER_CONFIGS, type LoyaltyTier } from '../../../shared/schema-loyalty';

type AccentKey = 'gold' | 'diamond' | 'emerald' | 'sapphire' | 'platinum';

const TIER_ACCENT_MAP: Record<string, AccentKey> = {
  bronze: 'gold',
  silver: 'platinum',
  gold: 'gold',
  platinum: 'platinum',
  diamond: 'diamond',
  emerald: 'emerald',
  royal: 'sapphire',
};

const ACCENT_COLORS: Record<AccentKey, { gem: string; glow: string }> = {
  gold: { gem: '#C6A75E', glow: 'rgba(198,167,94,.18)' },
  diamond: { gem: '#E8C65A', glow: 'rgba(232,198,90,.18)' },
  emerald: { gem: '#0F5E4A', glow: 'rgba(15,94,74,.18)' },
  sapphire: { gem: '#0E2F5A', glow: 'rgba(14,47,90,.16)' },
  platinum: { gem: '#C9C9C9', glow: 'rgba(201,201,201,.22)' },
};

export type ClubEmailEventKind = 'welcome' | 'tier_upgrade' | 'purchase_reward' | 'club_event';

export interface LuxuryClubEmailParams {
  kind: ClubEmailEventKind;
  recipientName?: string;
  recipientEmail: string;
  language?: 'he' | 'en';

  heroTitle?: string;
  heroSubtitle?: string;
  primaryCtaLabel?: string;
  primaryCtaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;

  tierLabel?: string;
  tier?: LoyaltyTier;

  walletBalanceText?: string;
  memberSinceText?: string;
  pointsEarned?: number;
  newPoints?: number;

  benefits?: { title: string; desc: string }[];
  moments?: { label: string; desc: string }[];

  heroImageUrl?: string;
  jewelImageUrl?: string;

  previousTier?: string;
  newTier?: string;
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/`/g, '&#096;');
}

function getTierDisplayName(tier: string, lang: 'he' | 'en'): string {
  const config = TIER_CONFIGS.find(t => t.id === tier);
  if (!config) return tier;
  return lang === 'he' ? config.nameHe : config.name;
}

function getDefaultContent(kind: ClubEmailEventKind, lang: 'he' | 'en', params: LuxuryClubEmailParams) {
  const tierName = getTierDisplayName(params.tier || 'bronze', lang);
  const newTierName = params.newTier ? getTierDisplayName(params.newTier, lang) : '';
  const prevTierName = params.previousTier ? getTierDisplayName(params.previousTier, lang) : '';

  const defaults: Record<ClubEmailEventKind, Record<'he' | 'en', {
    subject: string; preheader: string; heroTitle: string; heroSubtitle: string;
    ctaLabel: string; benefitsTitle: string; benefitsSubtitle: string;
    momentsTitle: string; momentsSubtitle: string;
    benefits: { title: string; desc: string }[];
    moments: { label: string; desc: string }[];
  }>> = {
    welcome: {
      he: {
        subject: `ברוכים הבאים למועדון Pet Wash™ Privilege`,
        preheader: `החברות שלך פעילה. ארנק דיגיטלי, הטבות ורגעים פרימיום מחכים לך.`,
        heroTitle: `ברוכים הבאים ל-Privilege Club`,
        heroSubtitle: `חברות פרימיום שנבנתה לשקט, איכות ותגמולים חכמים. הארנק הדיגיטלי שלך מוכן.`,
        ctaLabel: `פתח את החברות שלך`,
        benefitsTitle: `מה נפתח לכם כחברים`,
        benefitsSubtitle: `נקי, ברור ומסודר כמו מועדון תעופה פרימיום.`,
        momentsTitle: `Prestige Moments`,
        momentsSubtitle: `הטבות וסטטוס מרגישים טוב רק כשזה מחובר לחוויות אמיתיות.`,
        benefits: [
          { title: 'ארנק דיגיטלי', desc: 'יתרה, טעינות ומעקב ברור.' },
          { title: 'מתנות פרימיום', desc: 'שלחו מתנות דיגיטליות אלגנטיות לכל אירוע.' },
          { title: 'הטבות דרגה', desc: `אתם מתחילים בדרגת ${tierName} — שדרגו ותיהנו מיתרונות בלעדיים.` },
          { title: '100 נקודות מתנה', desc: 'נקודות הצטרפות כבונוס פתיחה.' },
        ],
        moments: [
          { label: 'שטיפה ראשונה', desc: 'כפל נקודות על השטיפה הראשונה שלך.' },
          { label: 'הזמן חבר', desc: 'הזמינו חבר וקבלו שניכם 250 נקודות.' },
        ],
      },
      en: {
        subject: `Welcome to Pet Wash™ Privilege Club`,
        preheader: `Your membership is active. Digital wallet, benefits, and premium moments await.`,
        heroTitle: `Welcome to Privilege Club`,
        heroSubtitle: `A premium membership built for calm, quality, and smart rewards. Your digital wallet is ready.`,
        ctaLabel: `Open your membership`,
        benefitsTitle: `What's unlocked for you`,
        benefitsSubtitle: `Clean, clear, and organized like a premium lounge.`,
        momentsTitle: `Prestige Moments`,
        momentsSubtitle: `Benefits and status feel good only when connected to real experiences.`,
        benefits: [
          { title: 'Digital Wallet', desc: 'Balance, top-ups and clear tracking.' },
          { title: 'Premium Gifting', desc: 'Send elegant digital gifts for any occasion.' },
          { title: 'Tier Privileges', desc: `You start at ${tierName} — upgrade and unlock exclusive advantages.` },
          { title: '100 Welcome Points', desc: 'Joining bonus to get you started.' },
        ],
        moments: [
          { label: 'First Wash', desc: 'Double points on your first wash.' },
          { label: 'Invite a Friend', desc: 'Invite a friend and both earn 250 points.' },
        ],
      },
    },
    tier_upgrade: {
      he: {
        subject: `שדרוג דרגה! עליתם ל-${newTierName} ב-Pet Wash™`,
        preheader: `מזל טוב! הדרגה החדשה שלכם: ${newTierName}. הטבות חדשות ממתינות.`,
        heroTitle: `שדרוג ל-${newTierName}!`,
        heroSubtitle: `עלייתם מ-${prevTierName} ל-${newTierName}. הטבות חדשות וסטטוס גבוה יותר ממתינים לכם.`,
        ctaLabel: `צפו בהטבות החדשות`,
        benefitsTitle: `מה חדש בדרגת ${newTierName}`,
        benefitsSubtitle: `הטבות חדשות שנפתחו עם השדרוג.`,
        momentsTitle: `השלב הבא`,
        momentsSubtitle: `כל דרגה מביאה יתרונות חדשים ורגעים בלתי נשכחים.`,
        benefits: [],
        moments: [
          { label: 'הטבות משודרגות', desc: 'הנחות גדולות יותר, יותר נקודות לכל שטיפה.' },
          { label: 'סטטוס פרימיום', desc: 'תמיכה בעדיפות גבוהה וגישה בלעדית.' },
        ],
      },
      en: {
        subject: `Tier Upgrade! You've reached ${newTierName} at Pet Wash™`,
        preheader: `Congratulations! Your new tier: ${newTierName}. New benefits await.`,
        heroTitle: `Upgraded to ${newTierName}!`,
        heroSubtitle: `You've moved from ${prevTierName} to ${newTierName}. New benefits and higher status await.`,
        ctaLabel: `View new benefits`,
        benefitsTitle: `What's new at ${newTierName}`,
        benefitsSubtitle: `New benefits unlocked with your upgrade.`,
        momentsTitle: `The Next Level`,
        momentsSubtitle: `Every tier brings new advantages and unforgettable moments.`,
        benefits: [],
        moments: [
          { label: 'Enhanced Benefits', desc: 'Bigger discounts, more points per wash.' },
          { label: 'Premium Status', desc: 'Priority support and exclusive access.' },
        ],
      },
    },
    purchase_reward: {
      he: {
        subject: `צברת ${params.pointsEarned || 0} נקודות חדשות ב-Pet Wash™!`,
        preheader: `נקודות נוספו לארנק שלך. בדקו את היתרה המעודכנת.`,
        heroTitle: `+${params.pointsEarned || 0} נקודות!`,
        heroSubtitle: `נקודות חדשות נוספו לחשבון שלך. המשיכו לצבור ושדרגו את הדרגה.`,
        ctaLabel: `צפה בארנק`,
        benefitsTitle: `סיכום רכישה`,
        benefitsSubtitle: `פרטי הנקודות שנצברו.`,
        momentsTitle: `הדרך קדימה`,
        momentsSubtitle: `כל שטיפה מקרבת אתכם לדרגה הבאה.`,
        benefits: [],
        moments: [
          { label: 'נקודות שנצברו', desc: `${params.pointsEarned || 0} נקודות חדשות` },
          { label: 'יתרה עדכנית', desc: `${params.newPoints || 0} נקודות בארנק` },
        ],
      },
      en: {
        subject: `You earned ${params.pointsEarned || 0} new points at Pet Wash™!`,
        preheader: `Points added to your wallet. Check your updated balance.`,
        heroTitle: `+${params.pointsEarned || 0} Points!`,
        heroSubtitle: `New points have been added to your account. Keep earning and upgrade your tier.`,
        ctaLabel: `View wallet`,
        benefitsTitle: `Purchase summary`,
        benefitsSubtitle: `Points earned details.`,
        momentsTitle: `The Road Ahead`,
        momentsSubtitle: `Every wash brings you closer to your next tier.`,
        benefits: [],
        moments: [
          { label: 'Points Earned', desc: `${params.pointsEarned || 0} new points` },
          { label: 'Current Balance', desc: `${params.newPoints || 0} points in wallet` },
        ],
      },
    },
    club_event: {
      he: {
        subject: `אירוע מיוחד ב-Pet Wash™ Privilege Club`,
        preheader: `אירוע בלעדי לחברי המועדון. פרטים בפנים.`,
        heroTitle: `אירוע בלעדי למועדון`,
        heroSubtitle: `הוזמנת לאירוע מיוחד בלעדי לחברי Pet Wash™ Privilege Club.`,
        ctaLabel: `פרטים נוספים`,
        benefitsTitle: `מה מחכה לכם`,
        benefitsSubtitle: `אירוע בלעדי לחברי מועדון.`,
        momentsTitle: `חוויה בלעדית`,
        momentsSubtitle: `רגעים פרימיום שמורים רק לחברי המועדון.`,
        benefits: [],
        moments: [],
      },
      en: {
        subject: `Special Event at Pet Wash™ Privilege Club`,
        preheader: `An exclusive event for club members. Details inside.`,
        heroTitle: `Exclusive Club Event`,
        heroSubtitle: `You're invited to a special event exclusive to Pet Wash™ Privilege Club members.`,
        ctaLabel: `Learn More`,
        benefitsTitle: `What awaits you`,
        benefitsSubtitle: `An exclusive event for club members.`,
        momentsTitle: `Exclusive Experience`,
        momentsSubtitle: `Premium moments reserved only for club members.`,
        benefits: [],
        moments: [],
      },
    },
  };

  return defaults[kind][lang];
}

function getTierBenefitsForUpgrade(tier: string, lang: 'he' | 'en'): { title: string; desc: string }[] {
  const config = TIER_CONFIGS.find(t => t.id === tier);
  if (!config) return [];

  if (lang === 'he') {
    const items: { title: string; desc: string }[] = [];
    if (config.benefits.tierBonusPercent > 0) items.push({ title: `${config.benefits.tierBonusPercent}% הנחה נוספת`, desc: 'על גבי הנחת החבר הבסיסית.' });
    if (config.benefits.pointsMultiplier > 1) items.push({ title: `מכפיל נקודות x${config.benefits.pointsMultiplier}`, desc: 'צברו נקודות מהר יותר על כל שטיפה.' });
    if (config.benefits.freeWashesPerYear > 0) items.push({ title: `${config.benefits.freeWashesPerYear} שטיפות חינם בשנה`, desc: 'מתנה מהמועדון עבורכם.' });
    if (config.benefits.prioritySupport) items.push({ title: 'תמיכה בעדיפות', desc: 'מענה מהיר ומועדף.' });
    if (config.benefits.exclusiveAccess) items.push({ title: 'גישה בלעדית', desc: 'גישה מוקדמת למוצרים ושירותים חדשים.' });
    if (config.benefits.conciergeService) items.push({ title: 'שירות קונסיירז׳', desc: 'שירות אישי ומותאם.' });
    items.push({ title: `${config.benefits.birthdayBonus} נקודות יום הולדת`, desc: 'בונוס מיוחד ביום ההולדת שלך.' });
    return items;
  }

  const items: { title: string; desc: string }[] = [];
  if (config.benefits.tierBonusPercent > 0) items.push({ title: `${config.benefits.tierBonusPercent}% Extra Discount`, desc: 'On top of your base club discount.' });
  if (config.benefits.pointsMultiplier > 1) items.push({ title: `${config.benefits.pointsMultiplier}x Points Multiplier`, desc: 'Earn points faster on every wash.' });
  if (config.benefits.freeWashesPerYear > 0) items.push({ title: `${config.benefits.freeWashesPerYear} Free Washes/Year`, desc: 'A gift from the club for you.' });
  if (config.benefits.prioritySupport) items.push({ title: 'Priority Support', desc: 'Fast and preferred response.' });
  if (config.benefits.exclusiveAccess) items.push({ title: 'Exclusive Access', desc: 'Early access to new products and services.' });
  if (config.benefits.conciergeService) items.push({ title: 'Concierge Service', desc: 'Personal and tailored service.' });
  items.push({ title: `${config.benefits.birthdayBonus} Birthday Points`, desc: 'Special bonus on your birthday.' });
  return items;
}

export function generateLuxuryClubEmail(params: LuxuryClubEmailParams): { subject: string; html: string } {
  const lang = params.language || 'he';
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const defaults = getDefaultContent(params.kind, lang, params);

  const tier = params.tier || 'bronze';
  const accentKey = TIER_ACCENT_MAP[tier] || 'gold';
  const accent = ACCENT_COLORS[accentKey];

  const tierLabel = params.tierLabel || getTierDisplayName(tier, lang);
  const heroTitle = params.heroTitle || defaults.heroTitle;
  const heroSubtitle = params.heroSubtitle || defaults.heroSubtitle;
  const ctaLabel = params.primaryCtaLabel || defaults.ctaLabel;
  const ctaUrl = params.primaryCtaUrl || 'https://petwash.co.il/app/loyalty';
  const secondaryCtaUrl = params.secondaryCtaUrl || '';
  const secondaryCtaLabel = params.secondaryCtaLabel || (lang === 'he' ? 'צפו בהטבות' : 'View benefits');

  let benefits = params.benefits || defaults.benefits;
  if (params.kind === 'tier_upgrade' && benefits.length === 0 && params.newTier) {
    benefits = getTierBenefitsForUpgrade(params.newTier, lang);
  }
  const moments = params.moments || defaults.moments;

  const walletBalanceText = params.walletBalanceText || '';
  const memberSinceText = params.memberSinceText || (lang === 'he' ? 'חבר מועדון מאז 2026' : 'Member since 2026');
  const heroImageUrl = params.heroImageUrl || 'https://petwash.co.il/assets/email/club-hero.jpg';
  const logoUrl = PETWASH_LOGO_BASE64;

  const nameLine = params.recipientName
    ? (lang === 'he' ? `שלום ${escapeHtml(params.recipientName)},` : `Hello ${escapeHtml(params.recipientName)},`)
    : (lang === 'he' ? `שלום,` : `Hello,`);

  const brandName = 'Pet Wash\u2122';
  const programName = 'Privilege Club';
  const supportEmail = 'support@petwash.co.il';
  const unsubscribeUrl = 'https://petwash.co.il/unsubscribe';
  const viewInBrowserUrl = 'https://petwash.co.il/app/loyalty';
  const footerLine1 = lang === 'he'
    ? `${brandName} · ${programName} — כל הזכויות שמורות © ${new Date().getFullYear()}`
    : `${brandName} · ${programName} — All rights reserved © ${new Date().getFullYear()}`;

  const benefitsRows = benefits.slice(0, 6).map((b) => `
    <tr>
      <td style="padding:0 0 14px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td valign="top" width="34" style="padding:0 10px 0 0;">
              <div style="width:26px;height:26px;border-radius:10px;border:1px solid rgba(198,167,94,.35);background:rgba(198,167,94,.10);text-align:center;line-height:26px;font-weight:900;color:${accent.gem};">&#10003;</div>
            </td>
            <td valign="top" style="padding:0;">
              <div style="font-size:14px;line-height:1.35;font-weight:900;color:#0B0B0D;letter-spacing:-.2px;" class="txt">${escapeHtml(b.title)}</div>
              <div style="font-size:13px;line-height:1.65;font-weight:650;color:rgba(11,11,13,.72);padding-top:3px;" class="txt2">${escapeHtml(b.desc)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const momentsRows = moments.slice(0, 3).map((m) => `
    <tr>
      <td style="padding:0 0 10px 0;">
        <div style="font-size:13px;line-height:1.55;font-weight:850;color:rgba(11,11,13,.78);" class="txt2">
          <span style="color:${accent.gem};font-weight:950;">&#10022;</span>
          ${escapeHtml(m.label)}
        </div>
        <div style="font-size:13px;line-height:1.65;font-weight:650;color:rgba(11,11,13,.66);padding-top:2px;" class="txt2">
          ${escapeHtml(m.desc)}
        </div>
      </td>
    </tr>
  `).join('');

  const benefitsTitleText = lang === 'he'
    ? (params.kind === 'tier_upgrade' ? `מה חדש בדרגת ${tierLabel}` : defaults.benefitsTitle)
    : (params.kind === 'tier_upgrade' ? `What's new at ${tierLabel}` : defaults.benefitsTitle);
  const benefitsSubtitleText = defaults.benefitsSubtitle;
  const momentsTitleText = defaults.momentsTitle;
  const momentsSubtitleText = defaults.momentsSubtitle;

  const viewBrowserText = lang === 'he' ? 'צפייה בדפדפן' : 'View in browser';
  const supportText = lang === 'he' ? 'תמיכה' : 'Support';
  const unsubscribeText = lang === 'he' ? 'הסרה מרשימת דיוור' : 'Unsubscribe';

  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(defaults.subject)}</title>
  <style>
    html,body{margin:0!important;padding:0!important;height:100%!important;width:100%!important;}
    table,td{border-collapse:collapse!important;}
    img{border:0;line-height:100%;outline:none;text-decoration:none;}
    a{text-decoration:none;}
    .wrap{width:100%;background:#F8F8F6;}
    .container{width:100%;max-width:640px;margin:0 auto;}
    .px{padding-left:22px;padding-right:22px;}
    .card{background:#FFFFFF;border:1px solid rgba(11,11,13,.10);border-radius:24px;overflow:hidden;}
    .muted{color:rgba(11,11,13,.60);}
    .btnPrimary{background:#0B0B0D;color:#FFFFFF;border:1px solid rgba(11,11,13,.85);border-radius:14px;font-weight:950;font-size:13px;letter-spacing:.2px;display:inline-block;padding:14px 18px;}
    .btnSecondary{background:#FFFFFF;color:#0B0B0D;border:1px solid rgba(11,11,13,.14);border-radius:14px;font-weight:950;font-size:13px;display:inline-block;padding:14px 18px;}
    .pill{display:inline-block;padding:10px 12px;border-radius:999px;border:1px solid rgba(11,11,13,.12);background:rgba(255,255,255,.75);font-weight:850;font-size:12px;color:rgba(11,11,13,.75);white-space:nowrap;}
    .hr{height:1px;background:rgba(11,11,13,.08);line-height:1px;font-size:1px;}
    @media screen and (max-width:600px){
      .px{padding-left:14px!important;padding-right:14px!important;}
      .stack{display:block!important;width:100%!important;}
      .center{text-align:center!important;}
      .btnPrimary,.btnSecondary{width:100%!important;text-align:center!important;box-sizing:border-box!important;}
    }
    @media(prefers-color-scheme:dark){
      .wrap{background:#0B0B0D!important;}
      .card{background:#121217!important;border-color:rgba(255,255,255,.10)!important;}
      .muted{color:rgba(255,255,255,.62)!important;}
      .txt{color:rgba(255,255,255,.92)!important;}
      .txt2{color:rgba(255,255,255,.72)!important;}
      .btnSecondary{background:transparent!important;color:#FFFFFF!important;border-color:rgba(255,255,255,.18)!important;}
      .pill{background:rgba(255,255,255,.06)!important;border-color:rgba(255,255,255,.14)!important;color:rgba(255,255,255,.78)!important;}
      .hr{background:rgba(255,255,255,.10)!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F8F8F6;">
  <div style="display:none;font-size:1px;color:#F8F8F6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(defaults.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wrap" style="background:#F8F8F6;">
    <tr>
      <td align="center" style="padding:18px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="container">
          <tr>
            <td class="px" style="padding:0 22px 12px 22px;font-size:12px;font-weight:700;color:rgba(11,11,13,.55);text-align:center;">
              <a href="${escapeAttr(viewInBrowserUrl)}" style="color:rgba(11,11,13,.55);text-decoration:underline;">${viewBrowserText}</a>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:0 22px 12px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="stack center" valign="middle" style="padding:0;">
                    <img src="${escapeAttr(logoUrl)}" width="120" alt="${escapeAttr(brandName)}" style="display:block;max-width:120px;height:auto;">
                  </td>
                  <td class="stack center" valign="middle" style="padding:0;text-align:${dir === 'rtl' ? 'left' : 'right'};">
                    <span class="pill" style="border-color:${accent.glow};">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:${accent.gem};margin-${dir === 'rtl' ? 'left' : 'right'}:8px;vertical-align:middle;"></span>
                      ${escapeHtml(programName)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:0 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card">
                <tr>
                  <td style="padding:0;">
                    <img src="${escapeAttr(heroImageUrl)}" width="640" alt="" style="width:100%;max-width:640px;height:auto;display:block;">
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:18px 22px 8px 22px;">
                    <div style="font-size:14px;line-height:1.7;font-weight:850;color:rgba(11,11,13,.78);" class="txt2">
                      ${nameLine}
                    </div>
                    <div style="font-size:30px;line-height:1.05;font-weight:950;letter-spacing:-.8px;margin:10px 0 8px 0;color:#0B0B0D;" class="txt">
                      ${escapeHtml(heroTitle)}
                    </div>
                    <div style="font-size:14px;line-height:1.75;font-weight:650;color:rgba(11,11,13,.72);margin:0 0 14px 0;" class="txt2">
                      ${escapeHtml(heroSubtitle)}
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
                      <tr>
                        <td class="stack" style="padding:0 0 10px 0;" align="${dir === 'rtl' ? 'right' : 'left'}">
                          <a href="${escapeAttr(ctaUrl)}" class="btnPrimary" style="color:#FFFFFF;">${escapeHtml(ctaLabel)}</a>
                        </td>
                      </tr>
                      ${secondaryCtaUrl ? `
                      <tr>
                        <td class="stack" style="padding:0 0 2px 0;" align="${dir === 'rtl' ? 'right' : 'left'}">
                          <a href="${escapeAttr(secondaryCtaUrl)}" class="btnSecondary">${escapeHtml(secondaryCtaLabel)}</a>
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
                <tr><td><div class="hr"></div></td></tr>
                <tr>
                  <td class="px" style="padding:18px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:22px;overflow:hidden;">
                      <tr>
                        <td style="background:radial-gradient(520px 340px at 0% 0%,${accent.glow},transparent 60%),radial-gradient(520px 340px at 100% 0%,rgba(14,47,90,.12),transparent 60%),linear-gradient(180deg,rgba(11,11,13,.96),rgba(11,11,13,.90));border:1px solid rgba(198,167,94,.32);border-radius:22px;padding:16px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td valign="top" align="${dir === 'rtl' ? 'right' : 'left'}" style="padding:0;">
                                <div style="font-size:12px;font-weight:950;color:rgba(255,255,255,.92);letter-spacing:.2px;">
                                  ${escapeHtml(brandName)}
                                </div>
                                <div style="font-size:10px;font-weight:950;color:${accent.gem};letter-spacing:2px;padding-top:4px;">
                                  ${escapeHtml(tierLabel.toUpperCase())}
                                </div>
                              </td>
                              <td valign="top" align="${dir === 'rtl' ? 'left' : 'right'}" style="padding:0;">
                                <div style="width:34px;height:34px;border-radius:12px;border:1px solid rgba(198,167,94,.40);background:rgba(255,255,255,.06);text-align:center;line-height:34px;color:${accent.gem};font-weight:950;">&#10022;</div>
                              </td>
                            </tr>
                            <tr><td colspan="2" style="padding:14px 0 0 0;"></td></tr>
                            <tr>
                              <td valign="bottom" align="${dir === 'rtl' ? 'right' : 'left'}" style="padding:0;">
                                <div style="font-size:11px;font-weight:750;color:rgba(255,255,255,.70);">${escapeHtml(memberSinceText)}</div>
                                ${walletBalanceText ? `<div style="font-size:22px;font-weight:950;color:#FFFFFF;letter-spacing:-.5px;padding-top:4px;">${escapeHtml(walletBalanceText)}</div>` : ''}
                              </td>
                              <td valign="bottom" align="${dir === 'rtl' ? 'left' : 'right'}" style="padding:0;">
                                <div style="display:inline-block;padding:10px 12px;border-radius:999px;border:1px solid rgba(198,167,94,.35);background:rgba(198,167,94,.10);color:rgba(255,255,255,.92);font-weight:950;font-size:12px;white-space:nowrap;">
                                  <span style="display:inline-block;width:10px;height:10px;border-radius:99px;background:${accent.gem};margin-${dir === 'rtl' ? 'left' : 'right'}:8px;vertical-align:middle;"></span>
                                  ${escapeHtml(programName)}
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${benefits.length > 0 ? `
                <tr><td><div class="hr"></div></td></tr>
                <tr>
                  <td class="px" style="padding:18px 22px 6px 22px;">
                    <div style="font-size:16px;line-height:1.25;font-weight:950;letter-spacing:-.3px;color:#0B0B0D;" class="txt">
                      ${escapeHtml(benefitsTitleText)}
                    </div>
                    <div style="font-size:13px;line-height:1.65;font-weight:650;color:rgba(11,11,13,.70);padding-top:6px;" class="txt2">
                      ${escapeHtml(benefitsSubtitleText)}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:12px 22px 8px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${benefitsRows}
                    </table>
                  </td>
                </tr>` : ''}
                ${moments.length > 0 ? `
                <tr><td><div class="hr"></div></td></tr>
                <tr>
                  <td class="px" style="padding:18px 22px 12px 22px;">
                    <div style="font-size:16px;line-height:1.25;font-weight:950;letter-spacing:-.3px;color:#0B0B0D;" class="txt">
                      ${escapeHtml(momentsTitleText)}
                    </div>
                    <div style="font-size:13px;line-height:1.65;font-weight:650;color:rgba(11,11,13,.70);padding-top:6px;" class="txt2">
                      ${escapeHtml(momentsSubtitleText)}
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                      ${momentsRows}
                    </table>
                    ${params.jewelImageUrl ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                      <tr>
                        <td style="border-radius:18px;overflow:hidden;border:1px solid rgba(11,11,13,.10);">
                          <img src="${escapeAttr(params.jewelImageUrl)}" width="596" alt="" style="width:100%;max-width:596px;height:auto;display:block;">
                        </td>
                      </tr>
                    </table>` : ''}
                  </td>
                </tr>` : ''}
                <tr><td><div class="hr"></div></td></tr>
                <tr>
                  <td class="px" style="padding:14px 22px 18px 22px;">
                    <div style="font-size:12px;line-height:1.7;font-weight:700;color:rgba(11,11,13,.60);" class="muted">
                      ${escapeHtml(footerLine1)}
                    </div>
                    <div style="font-size:12px;line-height:1.7;font-weight:800;color:rgba(11,11,13,.72);padding-top:12px;" class="muted">
                      ${supportText}: <a href="mailto:${escapeAttr(supportEmail)}" style="color:rgba(11,11,13,.72);text-decoration:underline;">${escapeHtml(supportEmail)}</a>
                    </div>
                    <div style="font-size:12px;line-height:1.7;font-weight:700;color:rgba(11,11,13,.55);padding-top:10px;" class="muted">
                      <a href="${escapeAttr(unsubscribeUrl)}" style="color:rgba(11,11,13,.55);text-decoration:underline;">${unsubscribeText}</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:14px 22px 0 22px;text-align:center;font-size:12px;font-weight:700;color:rgba(11,11,13,.50);">
              ${escapeHtml(brandName)} &middot; ${escapeHtml(programName)}
            </td>
          </tr>
          <tr>
            <td style="height:18px;"></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: defaults.subject, html };
}
