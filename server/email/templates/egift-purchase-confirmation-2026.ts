import { PETWASH_LOGO_BASE64 } from './logo-base64';

export type SeasonalTheme = 'black_friday' | 'valentines' | 'christmas' | 'hannukah' | 'purim' | 'general';

interface EGiftPurchaseConfirmationParams {
  buyerName: string;
  buyerEmail: string;
  recipientName: string;
  giftValue: number;
  currency: string;
  voucherId: string;
  transactionHash: string;
  personalMessage?: string;
  deliveryMethod: string;
  seasonalTheme?: SeasonalTheme;
  language: 'he' | 'en';
  appleWalletUrl?: string | null;
  googleWalletUrl?: string | null;
}

interface ThemeConfig {
  gradient: string;
  accent: string;
  accentLight: string;
  headerEmoji: string;
  badgeBg: string;
  badgeText: string;
  badgeTextHe: string;
  footerOrnament: string;
  heroTitle: string;
  heroTitleHe: string;
  heroSubtitle: string;
  heroSubtitleHe: string;
}

const SEASONAL_THEMES: Record<SeasonalTheme, ThemeConfig> = {
  black_friday: {
    gradient: 'linear-gradient(145deg, #0a0a0a, #1a1a1a, #0d0d0d)',
    accent: '#c9a96e',
    accentLight: 'rgba(201, 169, 110, 0.15)',
    headerEmoji: '🖤',
    badgeBg: 'linear-gradient(135deg, #0a0a0a, #1a1a1a)',
    badgeText: 'BLACK FRIDAY EXCLUSIVE',
    badgeTextHe: 'בלעדי BLACK FRIDAY',
    footerOrnament: '♛',
    heroTitle: 'Black Friday Purchase Confirmed',
    heroTitleHe: 'הרכישה אושרה — Black Friday',
    heroSubtitle: 'Your exclusive luxury gift has been sent',
    heroSubtitleHe: 'המתנה היוקרתית הבלעדית שלך נשלחה',
  },
  valentines: {
    gradient: 'linear-gradient(145deg, #4a0020, #7a0033, #4a0020)',
    accent: '#ff6b9d',
    accentLight: 'rgba(255, 107, 157, 0.15)',
    headerEmoji: '💝',
    badgeBg: 'linear-gradient(135deg, #4a0020, #7a0033)',
    badgeText: "VALENTINE'S SPECIAL",
    badgeTextHe: "מתנת יום האהבה",
    footerOrnament: '♥',
    heroTitle: "Valentine's Gift — Purchase Confirmed",
    heroTitleHe: 'מתנת יום האהבה — הרכישה אושרה',
    heroSubtitle: 'A gift of love, beautifully delivered',
    heroSubtitleHe: 'מתנה עם אהבה, נשלחה בסטייל',
  },
  christmas: {
    gradient: 'linear-gradient(145deg, #0d2818, #1a4028, #0d2818)',
    accent: '#d4af37',
    accentLight: 'rgba(212, 175, 55, 0.15)',
    headerEmoji: '🎄',
    badgeBg: 'linear-gradient(135deg, #0d2818, #1a4028)',
    badgeText: 'HOLIDAY GIFT',
    badgeTextHe: 'מתנת חג',
    footerOrnament: '✦',
    heroTitle: 'Holiday Gift — Purchase Confirmed',
    heroTitleHe: 'מתנת חג — הרכישה אושרה',
    heroSubtitle: 'Spreading joy this holiday season',
    heroSubtitleHe: 'שולחים שמחה בעונת החגים',
  },
  hannukah: {
    gradient: 'linear-gradient(145deg, #0a1628, #162d50, #0a1628)',
    accent: '#6ba3d6',
    accentLight: 'rgba(107, 163, 214, 0.15)',
    headerEmoji: '🕎',
    badgeBg: 'linear-gradient(135deg, #0a1628, #162d50)',
    badgeText: 'HANUKKAH GIFT',
    badgeTextHe: 'מתנת חנוכה',
    footerOrnament: '✡',
    heroTitle: 'Hanukkah Gift — Purchase Confirmed',
    heroTitleHe: 'מתנת חנוכה — הרכישה אושרה',
    heroSubtitle: 'Eight days of light, one perfect gift',
    heroSubtitleHe: 'שמונה ימים של אור, מתנה מושלמת אחת',
  },
  purim: {
    gradient: 'linear-gradient(145deg, #2a0845, #4a1080, #2a0845)',
    accent: '#d4a0d4',
    accentLight: 'rgba(212, 160, 212, 0.15)',
    headerEmoji: '🎭',
    badgeBg: 'linear-gradient(135deg, #2a0845, #4a1080)',
    badgeText: 'PURIM GIFT',
    badgeTextHe: 'משלוח מנות Pet Wash™',
    footerOrnament: '✦',
    heroTitle: 'Purim Gift — Purchase Confirmed',
    heroTitleHe: 'משלוח מנות — הרכישה אושרה',
    heroSubtitle: 'A joyful surprise, delivered with love',
    heroSubtitleHe: 'הפתעה שמחה, נשלחה באהבה',
  },
  general: {
    gradient: 'linear-gradient(145deg, #1a1a1a, #2d2d2d, #1a1a1a)',
    accent: '#c9a96e',
    accentLight: 'rgba(201, 169, 110, 0.15)',
    headerEmoji: '✅',
    badgeBg: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)',
    badgeText: 'PURCHASE CONFIRMED',
    badgeTextHe: 'הרכישה אושרה',
    footerOrnament: '◆',
    heroTitle: 'E-Gift Purchase Confirmed',
    heroTitleHe: 'הרכישה אושרה בהצלחה',
    heroSubtitle: 'Your luxury gift has been sent',
    heroSubtitleHe: 'המתנה היוקרתית שלך נשלחה',
  },
};

const TIER_BY_VALUE: Record<string, { min: number; name: string; nameHe: string; icon: string }> = {
  ELITE: { min: 750, name: 'Maison Prestige', nameHe: "מזון פרסטיז'", icon: '♛' },
  PREMIUM: { min: 400, name: 'Grand Collection', nameHe: 'גרנד קולקשן', icon: '✦' },
  PLUS: { min: 200, name: 'Signature', nameHe: 'סיגנטשר', icon: '❖' },
  CLASSIC: { min: 0, name: 'Collection', nameHe: 'קולקשן', icon: '✧' },
};

function getTierConfig(value: number) {
  if (value >= 750) return TIER_BY_VALUE.ELITE;
  if (value >= 400) return TIER_BY_VALUE.PREMIUM;
  if (value >= 200) return TIER_BY_VALUE.PLUS;
  return TIER_BY_VALUE.CLASSIC;
}

function formatCurrency(value: number, currency: string): string {
  if (currency === 'ILS') return `₪${value.toLocaleString()}`;
  if (currency === 'USD') return `$${value.toLocaleString()}`;
  if (currency === 'EUR') return `€${value.toLocaleString()}`;
  if (currency === 'GBP') return `£${value.toLocaleString()}`;
  return `${value.toLocaleString()} ${currency}`;
}

function getHebrewYearPurimDate(year: number): { month: number; day: number } {
  const purimDates: Record<number, { month: number; day: number }> = {
    2025: { month: 3, day: 14 },
    2026: { month: 3, day: 3 },
    2027: { month: 3, day: 23 },
    2028: { month: 3, day: 12 },
    2029: { month: 3, day: 1 },
    2030: { month: 3, day: 19 },
  };
  return purimDates[year] || { month: 3, day: 14 };
}

function detectSeasonalTheme(): SeasonalTheme {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();

  if (month === 11 && day >= 20) return 'black_friday';
  if (month === 2 && day >= 1 && day <= 14) return 'valentines';
  if (month === 12 && day >= 15 && day <= 31) return 'christmas';
  if (month === 12 && day >= 1 && day <= 14) return 'hannukah';

  const purim = getHebrewYearPurimDate(year);
  if (month === purim.month) {
    const diffDays = day - purim.day;
    if (diffDays >= -5 && diffDays <= 1) return 'purim';
  }

  return 'general';
}

export function generateEGiftPurchaseConfirmation(params: EGiftPurchaseConfirmationParams): { subject: string; html: string } {
  const {
    buyerName,
    recipientName,
    giftValue,
    currency,
    voucherId,
    transactionHash,
    personalMessage,
    deliveryMethod,
    language,
    appleWalletUrl,
    googleWalletUrl,
  } = params;

  const seasonalTheme = params.seasonalTheme || detectSeasonalTheme();
  const theme = SEASONAL_THEMES[seasonalTheme];
  const tier = getTierConfig(giftValue);
  const isHe = language === 'he';
  const dir = isHe ? 'rtl' : 'ltr';
  const alignOpp = isHe ? 'left' : 'right';
  const formattedValue = formatCurrency(giftValue, currency);
  const tierName = isHe ? tier.nameHe : tier.name;
  const purchaseDate = new Date();
  const formattedDate = purchaseDate.toLocaleDateString(isHe ? 'he-IL' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const deliveryLabel = deliveryMethod === 'whatsapp'
    ? (isHe ? 'WhatsApp' : 'WhatsApp')
    : deliveryMethod === 'both'
      ? (isHe ? 'אימייל + WhatsApp' : 'Email + WhatsApp')
      : (isHe ? 'אימייל' : 'Email');

  const subject = isHe
    ? `${theme.headerEmoji} ${theme.heroTitleHe} — ${formattedValue} ל${recipientName}`
    : `${theme.headerEmoji} ${theme.heroTitle} — ${formattedValue} for ${recipientName}`;

  const html = `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @keyframes fadeIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
    @keyframes breathe { 0%,100% { box-shadow:0 8px 32px rgba(0,0,0,0.25); } 50% { box-shadow:0 16px 48px rgba(0,0,0,0.35), 0 0 40px ${theme.accent}15; } }
    @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.03); } }
    .fi { animation: fadeIn 0.8s ease both; }
    .d1 { animation-delay:0.1s; } .d2 { animation-delay:0.2s; } .d3 { animation-delay:0.3s; } .d4 { animation-delay:0.4s; } .d5 { animation-delay:0.5s; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:20px 12px;">

    <div style="border:1px solid #e0dbd3;border-radius:2px;overflow:hidden;background:white;">

      <!-- Seasonal Badge Bar -->
      <div class="fi" style="background:${theme.badgeBg};padding:8px 0;text-align:center;">
        <span style="font-size:9px;letter-spacing:6px;color:${theme.accent};text-transform:uppercase;font-weight:500;">
          ${theme.footerOrnament} &nbsp; ${isHe ? theme.badgeTextHe : theme.badgeText} &nbsp; ${theme.footerOrnament}
        </span>
      </div>

      <!-- Logo -->
      <div class="fi d1" style="padding:32px 40px 12px;text-align:center;background:white;">
        <img src="${PETWASH_LOGO_BASE64}" alt="Pet Wash™" style="max-width:120px;height:auto;" />
        <div style="margin-top:10px;font-size:8px;letter-spacing:5px;text-transform:uppercase;color:#bbb;">
          ${isHe ? 'אישור רכישה יוקרתי' : 'Luxury Purchase Confirmation'}
        </div>
        <div style="width:40px;height:1px;background:${theme.accent};margin:12px auto 0;"></div>
      </div>

      <!-- Hero -->
      <div class="fi d2" style="padding:24px 40px;text-align:center;">
        <div style="font-size:44px;margin-bottom:10px;">${theme.headerEmoji}</div>
        <h1 style="font-size:24px;font-weight:300;color:#1a1a1a;margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.3px;">
          ${isHe ? theme.heroTitleHe : theme.heroTitle}
        </h1>
        <p style="font-size:13px;color:#888;margin:0;line-height:1.7;max-width:400px;display:inline-block;">
          ${isHe ? theme.heroSubtitleHe : theme.heroSubtitle}
        </p>
      </div>

      <!-- Divider -->
      <div style="text-align:center;padding:0 40px;">
        <span style="font-size:6px;letter-spacing:4px;color:#ccc;">── ─ ─</span>
        <span style="font-size:14px;color:${theme.accent};margin:0 8px;">${tier.icon}</span>
        <span style="font-size:6px;letter-spacing:4px;color:#ccc;">─ ─ ──</span>
      </div>

      <!-- Amount Highlight -->
      <div class="fi d3" style="padding:28px 40px;text-align:center;">
        <div style="display:inline-block;padding:24px 48px;border-radius:12px;background:${theme.gradient};position:relative;overflow:hidden;animation:breathe 4s ease-in-out infinite;">
          <div style="position:absolute;inset:0;background:linear-gradient(110deg,transparent 20%,rgba(255,255,255,0.02) 30%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.02) 70%,transparent 80%);background-size:250% 100%;animation:shimmer 4s ease-in-out infinite;pointer-events:none;"></div>
          <div style="position:relative;">
            <div style="font-size:9px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:8px;">
              ${isHe ? 'סכום המתנה' : 'Gift Amount'}
            </div>
            <div style="font-size:44px;font-weight:200;color:${theme.accent};font-family:Georgia,'Times New Roman',serif;letter-spacing:-1px;text-shadow:0 2px 20px ${theme.accent}30;">
              ${formattedValue}
            </div>
            <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-top:6px;">
              ${tier.icon} ${tierName}
            </div>
          </div>
        </div>
      </div>

      <!-- Delivery Status -->
      <div class="fi d3" style="padding:20px 40px;text-align:center;">
        <div style="display:inline-block;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:14px 28px;">
          <div style="font-size:20px;margin-bottom:6px;">✅</div>
          <div style="font-size:13px;font-weight:600;color:#065f46;">
            ${isHe ? `נשלח בהצלחה ל${recipientName}` : `Successfully sent to ${recipientName}`}
          </div>
          <div style="font-size:11px;color:#059669;margin-top:4px;">
            ${isHe ? `שיטת משלוח: ${deliveryLabel}` : `Delivery: ${deliveryLabel}`}
          </div>
        </div>
      </div>

      ${personalMessage ? `
      <!-- Personal Message Preview -->
      <div class="fi d4" style="padding:16px 40px;">
        <div style="padding:18px;background:#faf9f7;border-radius:4px;border-${dir === 'rtl' ? 'right' : 'left'}:3px solid ${theme.accent};">
          <div style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#bbb;margin-bottom:8px;">
            ${isHe ? 'ההודעה שלך' : 'Your Message'}
          </div>
          <p style="font-size:14px;color:#555;margin:0;line-height:1.7;font-style:italic;font-family:Georgia,'Times New Roman',serif;">
            &ldquo;${personalMessage}&rdquo;
          </p>
        </div>
      </div>` : ''}

      <!-- Receipt / Order Details -->
      <div class="fi d4" style="padding:24px 40px;background:#faf9f7;border-top:1px solid #f0ede8;border-bottom:1px solid #f0ede8;">
        <div style="text-align:center;margin-bottom:18px;">
          <div style="font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#bbb;">
            ${isHe ? 'פרטי הרכישה' : 'Purchase Receipt'}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr style="border-bottom:1px solid #f0ede8;">
            <td style="padding:12px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'מאת' : 'Purchaser'}</td>
            <td style="padding:12px 0;color:#1a1a1a;text-align:${alignOpp};font-weight:500;">${buyerName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f0ede8;">
            <td style="padding:12px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'נמען' : 'Recipient'}</td>
            <td style="padding:12px 0;color:#1a1a1a;text-align:${alignOpp};font-weight:500;">${recipientName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f0ede8;">
            <td style="padding:12px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'קולקציה' : 'Collection'}</td>
            <td style="padding:12px 0;text-align:${alignOpp};">
              <span style="display:inline-block;padding:2px 12px;border:1px solid ${theme.accent};border-radius:2px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${theme.accent};">
                ${tier.icon} ${tierName}
              </span>
            </td>
          </tr>
          <tr style="border-bottom:1px solid #f0ede8;">
            <td style="padding:12px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'סכום' : 'Amount'}</td>
            <td style="padding:12px 0;color:#1a1a1a;text-align:${alignOpp};font-weight:700;font-size:16px;">${formattedValue}</td>
          </tr>
          <tr style="border-bottom:1px solid #f0ede8;">
            <td style="padding:12px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'תאריך רכישה' : 'Purchase Date'}</td>
            <td style="padding:12px 0;color:#1a1a1a;text-align:${alignOpp};">${formattedDate}</td>
          </tr>
          <tr style="border-bottom:1px solid #f0ede8;">
            <td style="padding:12px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'מזהה עסקה' : 'Transaction ID'}</td>
            <td style="padding:12px 0;color:#1a1a1a;text-align:${alignOpp};font-family:'Courier New',monospace;font-size:10px;letter-spacing:1px;">${voucherId}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'משלוח' : 'Delivery'}</td>
            <td style="padding:12px 0;color:#1a1a1a;text-align:${alignOpp};">${deliveryLabel}</td>
          </tr>
        </table>
      </div>

      <!-- Blockchain Security -->
      <div class="fi d5" style="padding:24px 40px;background:white;">
        <div style="border:1px solid #f0ede8;border-radius:6px;padding:18px;background:#fffbeb;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="font-size:16px;">🔐</span>
            <span style="font-size:11px;font-weight:600;color:#92400e;letter-spacing:0.5px;">
              ${isHe ? 'אבטחת בלוקצ\'יין' : 'Blockchain Security'}
            </span>
          </div>
          <p style="font-size:10px;color:#92400e;margin:0 0 8px;line-height:1.5;">
            ${isHe
              ? 'עסקה זו מאובטחת בגיבוב קריפטוגרפי בסגנון בלוקצ\'יין — בלתי ניתנת לשינוי ועמידה בפני זיוף.'
              : 'This transaction is secured with blockchain-style cryptographic hashing — immutable and tamper-proof.'}
          </p>
          <div style="background:white;border:1px solid #fbbf24;border-radius:3px;padding:8px 12px;font-family:'Courier New',monospace;font-size:9px;color:#78350f;word-break:break-all;letter-spacing:0.3px;">
            ${transactionHash}
          </div>
        </div>
      </div>

      <!-- Redeemable At -->
      <div class="fi d5" style="padding:16px 40px;background:#faf9f7;border-top:1px solid #f0ede8;">
        <div style="text-align:center;">
          <div style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#bbb;margin-bottom:8px;">
            ${isHe ? 'למימוש בכל שירותי' : 'Redeemable Across'}
          </div>
          <div style="font-size:11px;color:#999;line-height:2;letter-spacing:0.5px;">
            <span style="white-space:nowrap;">🚿 K9000™</span>
            <span style="color:#ddd;margin:0 6px;">·</span>
            <span style="white-space:nowrap;">🏠 Sitter Suite™</span>
            <span style="color:#ddd;margin:0 6px;">·</span>
            <span style="white-space:nowrap;">🐾 Walk My Pet™</span>
            <span style="color:#ddd;margin:0 6px;">·</span>
            <span style="white-space:nowrap;">🎓 Academy™</span>
            <span style="color:#ddd;margin:0 6px;">·</span>
            <span style="white-space:nowrap;">🧸 Plush Lab™</span>
            <span style="color:#ddd;margin:0 6px;">·</span>
            <span style="white-space:nowrap;">💎 Wash Hub™</span>
          </div>
        </div>
      </div>

      <!-- CTA — Apple Wallet + Google Wallet + My Wallet -->
      <div class="fi d5" style="padding:32px 40px;text-align:center;background:white;border-top:1px solid #f0ede8;">
        <p style="font-size:13px;color:#555;margin:0 0 8px;font-weight:600;letter-spacing:0.5px;">
          ${isHe ? '📲 הוסף לארנק הדיגיטלי שלך' : '📲 Add your gift card to your digital wallet'}
        </p>
        <p style="font-size:11px;color:#999;margin:0 0 22px;line-height:1.6;max-width:360px;display:inline-block;">
          ${isHe
            ? 'לחץ/י על הכפתור המתאים — הגישה לכרטיס תמיד תהיה ביד.'
            : 'Tap the button below — your gift card will always be one tap away.'}
        </p>

        <!-- Wallet buttons row -->
        <div style="display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px;">

          ${appleWalletUrl ? `
          <!-- Apple Wallet button — official badge style -->
          <a href="${appleWalletUrl}" style="display:inline-block;text-decoration:none;" target="_blank" rel="noopener">
            <img
              src="https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/downloads/Add_to_Apple_Wallet_rgb_US_UK.svg"
              alt="Add to Apple Wallet"
              width="160"
              height="52"
              style="display:block;border-radius:8px;"
              onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block';"
            />
            <span style="display:none;padding:13px 24px;background:#000;color:#fff;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:0.3px;">
              🍎 ${isHe ? 'הוסף ל-Apple Wallet' : 'Add to Apple Wallet'}
            </span>
          </a>
          ` : ''}

          ${googleWalletUrl ? `
          <!-- Google Wallet button — official badge style -->
          <a href="${googleWalletUrl}" style="display:inline-block;text-decoration:none;" target="_blank" rel="noopener">
            <img
              src="https://wallet.google.com/intl/en_us/images/google-wallet-badge.svg"
              alt="Add to Google Wallet"
              width="160"
              height="52"
              style="display:block;border-radius:8px;"
              onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block';"
            />
            <span style="display:none;padding:13px 24px;background:#1a73e8;color:#fff;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:0.3px;">
              🔵 ${isHe ? 'הוסף ל-Google Wallet' : 'Add to Google Wallet'}
            </span>
          </a>
          ` : ''}

          ${!appleWalletUrl && !googleWalletUrl ? `
          <!-- Fallback if passes not configured -->
          <p style="font-size:11px;color:#bbb;margin:0;">
            ${isHe ? 'כרטיסי ארנק יהיו זמינים בקרוב' : 'Wallet passes coming soon'}
          </p>
          ` : ''}

        </div>

        <!-- Divider -->
        <div style="width:40px;height:1px;background:#e8e4df;margin:0 auto 18px;"></div>

        <!-- My Wallet link -->
        <p style="font-size:11px;color:#aaa;margin:0 0 12px;">
          ${isHe ? 'צפה במצב המימוש בחשבון שלך' : 'Track redemption status in your account'}
        </p>
        <a href="https://petwash.co.il/my-wallet" style="display:inline-block;padding:12px 36px;border:1px solid #1a1a1a;color:#1a1a1a;text-decoration:none;font-size:10px;letter-spacing:4px;text-transform:uppercase;font-weight:500;">
          ${isHe ? 'הארנק שלי' : 'My Wallet'}
        </a>
      </div>

      <!-- Footer -->
      <div style="background:#1a1a1a;padding:28px 40px;text-align:center;">
        <div style="font-size:7px;letter-spacing:6px;text-transform:uppercase;color:${theme.accent};margin-bottom:14px;">
          ${theme.footerOrnament} &nbsp; ${theme.footerOrnament} &nbsp; ${theme.footerOrnament}
        </div>
        <p style="font-size:10px;color:rgba(255,255,255,0.4);margin:0 0 6px;line-height:1.5;letter-spacing:0.5px;">
          ${isHe ? 'תודה שרכשת ב-Pet Wash™' : 'Thank you for purchasing from Pet Wash™'}
        </p>
        <p style="font-size:10px;color:rgba(255,255,255,0.25);margin:0 0 12px;">
          <a href="https://petwash.co.il" style="color:${theme.accent};text-decoration:none;letter-spacing:1px;">petwash.co.il</a>
          <span style="margin:0 8px;color:rgba(255,255,255,0.1);">|</span>
          <a href="mailto:Support@PetWash.co.il" style="color:rgba(255,255,255,0.35);text-decoration:none;">Support@PetWash.co.il</a>
        </p>
        <div style="width:30px;height:1px;background:rgba(255,255,255,0.1);margin:0 auto 12px;"></div>
        <p style="font-size:8px;color:rgba(255,255,255,0.2);margin:0 0 4px;letter-spacing:0.5px;">
          ${isHe
            ? 'זהו אישור רכישה רשמי. שמור/י לצרכי רישום.'
            : 'This is an official purchase receipt. Keep for your records.'}
        </p>
        <p style="font-size:8px;color:rgba(255,255,255,0.2);margin:0 0 4px;letter-spacing:0.5px;">
          ${isHe
            ? 'לא ניתן להחזר. לא ניתן להעברה. לא ניתן למימוש במזומן. שימוש חד פעמי.'
            : 'Non-refundable. Non-transferable. Cannot be redeemed for cash. Single-use only.'}
        </p>
        <p style="font-size:8px;color:rgba(255,255,255,0.12);margin:0;letter-spacing:1px;">
          Pet Wash Ltd. (Israel Company #516458396)
          <br>&copy; ${new Date().getFullYear()} Pet Wash™. ${isHe ? 'כל הזכויות שמורות.' : 'All rights reserved.'}
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
