/**
 * PetWash™ Prestige Pass — Luxury Unified Pass Email
 * Credit-card style visual with QR, loyalty, eGift & wallet buttons
 */

import { PETWASH_LOGO_BASE64 } from './logo-base64';

export interface PrestigePassEmailParams {
  firstName: string;
  lastName?: string;
  email: string;
  tier: 'pearl' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'emerald' | 'royal' | 'black';
  cardNumber: string;
  loyaltyPoints: number;
  cashWalletILS: number;
  eGiftBalanceILS: number;
  freeWashesRemaining: number;
  memberSinceYear: number;
  nextTierName?: string;
  nextTierPointsNeeded?: number;
  qrDataUrl: string;
  appleWalletUrl?: string | null;
  googleWalletUrl?: string | null;
  appBaseUrl?: string;
  language?: 'he' | 'en';
}

const TIER_CONFIG: Record<string, {
  label: string;
  labelHe: string;
  cardBg: string;
  cardGlow: string;
  chipColor: string;
  accentHex: string;
  accentRgb: string;
  bandColor: string;
  discountPct: number;
  emoji: string;
}> = {
  pearl: {
    label: 'Prestige Pearl', labelHe: 'פרסטיז פנינה',
    cardBg: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d4a 40%, #1a1a2e 100%)',
    cardGlow: 'rgba(180, 160, 220, 0.35)',
    chipColor: '#c8b8e8', accentHex: '#c8b8e8', accentRgb: '200,184,232',
    bandColor: '#8870a8', discountPct: 5, emoji: '🪨',
  },
  silver: {
    label: 'Prestige Silver', labelHe: 'פרסטיז כסף',
    cardBg: 'linear-gradient(135deg, #1c1c1c 0%, #3a3a3a 40%, #1c1c1c 100%)',
    cardGlow: 'rgba(192, 200, 212, 0.4)',
    chipColor: '#c0c8d4', accentHex: '#c0c8d4', accentRgb: '192,200,212',
    bandColor: '#6a7280', discountPct: 10, emoji: '🥈',
  },
  gold: {
    label: 'Prestige Gold', labelHe: 'פרסטיז זהב',
    cardBg: 'linear-gradient(135deg, #1a1200 0%, #2a1f00 40%, #1a1200 100%)',
    cardGlow: 'rgba(212, 175, 55, 0.45)',
    chipColor: '#D4AF37', accentHex: '#D4AF37', accentRgb: '212,175,55',
    bandColor: '#B8941F', discountPct: 15, emoji: '🥇',
  },
  platinum: {
    label: 'Prestige Platinum', labelHe: 'פרסטיז פלטינום',
    cardBg: 'linear-gradient(135deg, #0f0f1a 0%, #1a2030 40%, #0f0f1a 100%)',
    cardGlow: 'rgba(216, 220, 240, 0.45)',
    chipColor: '#d8dcf0', accentHex: '#d8dcf0', accentRgb: '216,220,240',
    bandColor: '#8890b0', discountPct: 20, emoji: '💠',
  },
  diamond: {
    label: 'Prestige Diamond', labelHe: 'פרסטיז יהלום',
    cardBg: 'linear-gradient(135deg, #050d1a 0%, #0a1830 45%, #050d1a 100%)',
    cardGlow: 'rgba(100, 160, 255, 0.5)',
    chipColor: '#64a0ff', accentHex: '#64a0ff', accentRgb: '100,160,255',
    bandColor: '#2255cc', discountPct: 25, emoji: '💎',
  },
  emerald: {
    label: 'Prestige Emerald', labelHe: 'פרסטיז אמרלד',
    cardBg: 'linear-gradient(135deg, #000f08 0%, #001a10 45%, #000f08 100%)',
    cardGlow: 'rgba(0, 200, 100, 0.45)',
    chipColor: '#00c864', accentHex: '#00c864', accentRgb: '0,200,100',
    bandColor: '#007040', discountPct: 35, emoji: '💚',
  },
  royal: {
    label: 'Prestige Royal', labelHe: 'פרסטיז רויאל',
    cardBg: 'linear-gradient(135deg, #0a0006 0%, #1a0012 45%, #0a0006 100%)',
    cardGlow: 'rgba(220, 80, 180, 0.5)',
    chipColor: '#dc50b4', accentHex: '#dc50b4', accentRgb: '220,80,180',
    bandColor: '#880060', discountPct: 50, emoji: '👑',
  },
  black: {
    label: 'Prestige Black', labelHe: 'פרסטיז שחור',
    cardBg: 'linear-gradient(135deg, #000000 0%, #0d0d0d 30%, #1a1100 60%, #0d0d0d 80%, #000000 100%)',
    cardGlow: 'rgba(212, 175, 55, 0.6)',
    chipColor: '#D4AF37', accentHex: '#D4AF37', accentRgb: '212,175,55',
    bandColor: '#8a6f00', discountPct: 50, emoji: '⬛',
  },
};

function fmt(n: number) {
  return n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function maskCard(num: string): string {
  const last4 = num.replace(/\D/g, '').slice(-4);
  return `•••• •••• •••• ${last4}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Chip SVG (like a real EMV chip)
// ──────────────────────────────────────────────────────────────────────────────
function chipSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="36" viewBox="0 0 48 36">
  <rect width="48" height="36" rx="5" fill="${color}" opacity=".85"/>
  <rect x="16" y="0" width="16" height="36" rx="2" fill="none" stroke="${color}" stroke-width="1.2" opacity=".4"/>
  <rect x="0" y="10" width="48" height="16" rx="2" fill="none" stroke="${color}" stroke-width="1.2" opacity=".4"/>
  <rect x="16" y="10" width="16" height="16" rx="1" fill="#000" opacity=".25"/>
  <rect x="18" y="12" width="12" height="12" rx="1" fill="${color}" opacity=".3"/>
</svg>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// CONTACTLESS ICON
// ──────────────────────────────────────────────────────────────────────────────
function contactlessIcon(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="30" viewBox="0 0 24 30" fill="none">
  <path d="M5 15 A9 9 0 0 1 19 15" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".9"/>
  <path d="M8 15 A6 6 0 0 1 16 15" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
  <path d="M11 15 A3 3 0 0 1 13 15" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".5"/>
  <circle cx="12" cy="15" r="1.5" fill="${color}" opacity=".85"/>
</svg>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ──────────────────────────────────────────────────────────────────────────────
export function buildPrestigePassLuxuryEmail(p: PrestigePassEmailParams): string {
  const cfg = TIER_CONFIG[p.tier] ?? TIER_CONFIG.black;
  const isHe = (p.language ?? 'he') === 'he';
  const appUrl = p.appBaseUrl ?? 'https://petwash.co.il';
  const maskedNum = maskCard(p.cardNumber);
  const totalBalanceILS = p.cashWalletILS + p.eGiftBalanceILS;

  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ');

  // Progress bar width (0-100%)
  const progressPct = p.nextTierPointsNeeded && p.nextTierPointsNeeded > 0
    ? Math.min(100, Math.round((1 - p.nextTierPointsNeeded / (p.loyaltyPoints + p.nextTierPointsNeeded)) * 100))
    : 100;

  const html = `<!DOCTYPE html>
<html lang="${isHe ? 'he' : 'en'}" dir="${isHe ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${isHe ? 'כרטיס הפרסטיז שלך — PetWash™' : 'Your Prestige Pass — PetWash™'}</title>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<!-- OUTER WRAPPER -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505;">
<tr><td align="center" style="padding:32px 12px;">

<!-- CONTENT CARD -->
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#0a0a0a;border-radius:20px;border:1px solid #1e1e1e;overflow:hidden;">

  <!-- ═══════════ TOP GOLD BAND ═══════════ -->
  <tr>
    <td style="background:linear-gradient(90deg,#0a0a0a 0%,#2a1f00 30%,#D4AF37 50%,#2a1f00 70%,#0a0a0a 100%);height:3px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>

  <!-- ═══════════ HEADER ═══════════ -->
  <tr>
    <td style="padding:28px 36px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <div style="font-size:10px;letter-spacing:5px;color:#D4AF37;text-transform:uppercase;margin-bottom:4px;">PETWASH™</div>
            <div style="font-size:11px;letter-spacing:3px;color:#555;text-transform:uppercase;">${isHe ? 'חבר פרסטיז' : 'PRESTIGE MEMBER'}</div>
          </td>
          <td align="${isHe ? 'left' : 'right'}">
            <div style="background:linear-gradient(135deg,${cfg.accentHex},${cfg.bandColor});-webkit-background-clip:text;color:transparent;font-size:22px;font-weight:900;letter-spacing:1px;">
              ${cfg.emoji} ${cfg.discountPct}% OFF
            </div>
            <div style="font-size:10px;letter-spacing:2px;color:#666;text-transform:uppercase;margin-top:2px;">${isHe ? 'הנחה בכל קנייה' : 'on every purchase'}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══════════ GREETING ═══════════ -->
  <tr>
    <td style="padding:0 36px 24px;">
      <p style="margin:0;font-size:15px;color:#ccc;line-height:1.7;">
        ${isHe
          ? `שלום <strong style="color:#fff;">${p.firstName}</strong>, הכרטיס הפרסטיז שלך מוכן לשימוש מלא.`
          : `Hello <strong style="color:#fff;">${p.firstName}</strong>, your Prestige Pass is ready to use.`
        }
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#555;line-height:1.6;">
        ${isHe
          ? 'שמור/י אותו ב-Apple Wallet או ב-Google Wallet — לגישה מיידית בכל תחנת K9000.'
          : 'Save it to Apple Wallet or Google Wallet — instant access at every K9000 station.'
        }
      </p>
    </td>
  </tr>

  <!-- ═══════════ THE CREDIT CARD ═══════════ -->
  <tr>
    <td align="center" style="padding:0 28px 28px;">

      <!-- card shell — 85.6 × 53.98mm ratio = 3.37 : 2.125 ≈ 560 × 352 scaled to 540 × 339 -->
      <table role="presentation" width="540" cellspacing="0" cellpadding="0"
             style="max-width:540px;width:100%;background:${cfg.cardBg};
                    border-radius:18px;overflow:hidden;
                    box-shadow:0 0 60px rgba(${cfg.accentRgb},.28),
                               0 0 120px rgba(${cfg.accentRgb},.12),
                               0 20px 60px rgba(0,0,0,.9);
                    border:1px solid rgba(${cfg.accentRgb},.18);">

        <!-- ROW 1: logo + contactless -->
        <tr>
          <td style="padding:22px 26px 6px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <!-- PetWash wordmark -->
                  <span style="font-size:13px;letter-spacing:5px;font-weight:800;color:${cfg.accentHex};text-transform:uppercase;">PetWash™</span>
                </td>
                <td align="${isHe ? 'left' : 'right'}" style="vertical-align:top;">
                  ${contactlessIcon(cfg.accentHex)}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ROW 2: Tier badge -->
        <tr>
          <td style="padding:2px 26px 14px;">
            <span style="display:inline-block;background:rgba(${cfg.accentRgb},.12);border:1px solid rgba(${cfg.accentRgb},.35);
                         color:${cfg.accentHex};font-size:9px;letter-spacing:3px;font-weight:700;
                         padding:4px 12px;border-radius:20px;text-transform:uppercase;">
              ${isHe ? cfg.labelHe : cfg.label}
            </span>
          </td>
        </tr>

        <!-- ROW 3: Chip + QR -->
        <tr>
          <td style="padding:0 26px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <!-- Chip -->
                <td style="vertical-align:middle;width:60px;">
                  ${chipSvg(cfg.chipColor)}
                </td>
                <!-- spacer -->
                <td style="width:12px;"></td>
                <!-- Balance pills -->
                <td style="vertical-align:middle;">
                  <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding-bottom:6px;">
                        <span style="background:rgba(0,0,0,.45);border:1px solid rgba(${cfg.accentRgb},.2);
                                     color:${cfg.accentHex};font-size:10px;letter-spacing:1px;font-weight:700;
                                     padding:4px 10px;border-radius:6px;white-space:nowrap;">
                          ${isHe ? 'נקודות' : 'POINTS'}&nbsp;&nbsp;<strong style="font-size:13px;">${fmt(p.loyaltyPoints)}</strong>
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span style="background:rgba(0,0,0,.45);border:1px solid rgba(${cfg.accentRgb},.2);
                                     color:#fff;font-size:10px;letter-spacing:1px;font-weight:700;
                                     padding:4px 10px;border-radius:6px;white-space:nowrap;">
                          ${isHe ? 'יתרה' : 'BALANCE'}&nbsp;&nbsp;<strong style="font-size:13px;color:${cfg.accentHex};">₪${fmt(totalBalanceILS)}</strong>
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
                <!-- QR code for K9000 -->
                <td align="${isHe ? 'left' : 'right'}" style="vertical-align:middle;padding-${isHe ? 'right' : 'left'}:0;">
                  <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="background:rgba(0,0,0,.6);border:1px solid rgba(${cfg.accentRgb},.3);border-radius:10px;padding:5px;">
                        <img src="${p.qrDataUrl}" width="72" height="72" alt="K9000 QR"
                             style="display:block;border-radius:6px;"/>
                        <div style="font-size:7px;letter-spacing:2px;color:${cfg.accentHex};text-transform:uppercase;margin-top:3px;text-align:center;">K9000</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ROW 4: Card number -->
        <tr>
          <td style="padding:4px 26px 8px;">
            <div style="font-size:18px;letter-spacing:4px;color:rgba(255,255,255,.85);font-family:'Courier New',monospace;font-weight:600;">
              ${maskedNum}
            </div>
          </td>
        </tr>

        <!-- ROW 5: Name + member since + free washes -->
        <tr>
          <td style="padding:4px 26px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:3px;">${isHe ? 'שם חבר' : 'CARD HOLDER'}</div>
                  <div style="font-size:13px;letter-spacing:2px;color:#ddd;font-weight:600;text-transform:uppercase;">${fullName || 'PETWASH MEMBER'}</div>
                </td>
                <td align="${isHe ? 'left' : 'right'}">
                  <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:3px;">${isHe ? 'חבר מ' : 'MEMBER'}</div>
                  <div style="font-size:13px;letter-spacing:2px;color:#ddd;font-weight:600;">${p.memberSinceYear}</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="background:rgba(${cfg.accentRgb},.1);border:1px solid rgba(${cfg.accentRgb},.25);border-radius:8px;padding:5px 10px;text-align:center;">
                    <div style="font-size:9px;letter-spacing:1px;color:#666;text-transform:uppercase;">${isHe ? 'שטיפות חינם' : 'FREE WASHES'}</div>
                    <div style="font-size:18px;font-weight:900;color:${cfg.accentHex};line-height:1.1;">${p.freeWashesRemaining}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Bottom gold shimmer line -->
        <tr>
          <td style="background:linear-gradient(90deg,transparent,rgba(${cfg.accentRgb},.6),transparent);height:1px;font-size:0;">&nbsp;</td>
        </tr>

      </table>
      <!-- END CREDIT CARD -->

    </td>
  </tr>

  <!-- ═══════════ BALANCE BREAKDOWN ═══════════ -->
  <tr>
    <td style="padding:4px 36px 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
             style="background:#111;border:1px solid #1e1e1e;border-radius:12px;overflow:hidden;">
        <tr>
          <!-- Cash Wallet -->
          <td align="center" style="padding:18px 12px;border-${isHe ? 'left' : 'right'}:1px solid #1e1e1e;">
            <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:6px;">${isHe ? '💳 ארנק מזומן' : '💳 CASH WALLET'}</div>
            <div style="font-size:22px;font-weight:800;color:#D4AF37;">₪${fmt(p.cashWalletILS)}</div>
          </td>
          <!-- eGift Balance -->
          <td align="center" style="padding:18px 12px;border-${isHe ? 'left' : 'right'}:1px solid #1e1e1e;">
            <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:6px;">${isHe ? '🎁 כרטיסי מתנה' : '🎁 E-GIFT CREDITS'}</div>
            <div style="font-size:22px;font-weight:800;color:#F0D060;">₪${fmt(p.eGiftBalanceILS)}</div>
          </td>
          <!-- Loyalty Points -->
          <td align="center" style="padding:18px 12px;">
            <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:6px;">${isHe ? '⭐ נקודות נאמנות' : '⭐ LOYALTY POINTS'}</div>
            <div style="font-size:22px;font-weight:800;color:#fff;">${fmt(p.loyaltyPoints)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══════════ TIER PROGRESS ═══════════ (only if not maxed) -->
  ${p.nextTierName && progressPct < 100 ? `
  <tr>
    <td style="padding:0 36px 24px;">
      <div style="font-size:10px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:8px;">
        ${isHe
          ? `${progressPct}% בדרך אל ${p.nextTierName}`
          : `${progressPct}% progress toward ${p.nextTierName}`
        }
      </div>
      <!-- Progress bar track -->
      <div style="background:#1a1a1a;border-radius:6px;height:6px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,${cfg.accentHex},${cfg.bandColor});width:${progressPct}%;height:6px;border-radius:6px;"></div>
      </div>
      ${p.nextTierPointsNeeded ? `
      <div style="font-size:10px;color:#444;margin-top:5px;text-align:${isHe ? 'left' : 'right'};">
        ${isHe
          ? `עוד ${fmt(p.nextTierPointsNeeded)} נקודות לדרגה הבאה`
          : `${fmt(p.nextTierPointsNeeded)} points to next tier`
        }
      </div>` : ''}
    </td>
  </tr>` : ''}

  <!-- ═══════════ K9000 INSTRUCTIONS ═══════════ -->
  <tr>
    <td style="padding:0 36px 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
             style="background:#0d0d0d;border:1px solid #1e1e1e;border-radius:12px;border-${isHe ? 'right' : 'left'}:3px solid ${cfg.accentHex};overflow:hidden;">
        <tr>
          <td style="padding:16px 20px;">
            <div style="font-size:11px;letter-spacing:3px;color:${cfg.accentHex};text-transform:uppercase;margin-bottom:10px;">
              ${isHe ? '🤖 איך לממש בתחנת K9000' : '🤖 HOW TO REDEEM AT K9000 KIOSK'}
            </div>
            <table role="presentation" cellspacing="0" cellpadding="0">
              ${(['1', '2', '3'] as const).map((n, i) => {
                const steps = isHe
                  ? ['גש/י לתחנת K9000 הקרובה', 'הציג/י את קוד ה-QR בכרטיס (מתחלף אוטומטית כל 45 שניות)', 'הסורק יאמת ויפעיל שטיפה — ₪0 ביד']
                  : ['Approach any K9000 wash station', 'Show the QR code on your pass (auto-rotates every 45 sec)', 'Scanner verifies instantly — ₪0 out of pocket'];
                return `<tr>
                  <td style="padding:4px 0;vertical-align:top;width:24px;">
                    <span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;
                                 background:rgba(${cfg.accentRgb},.15);border:1px solid rgba(${cfg.accentRgb},.3);
                                 border-radius:50%;font-size:10px;font-weight:700;color:${cfg.accentHex};">${n}</span>
                  </td>
                  <td style="padding:4px 0 4px ${isHe ? '0' : '10px'};font-size:12px;color:#888;line-height:1.5;">${steps[i]}</td>
                </tr>`;
              }).join('')}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══════════ WALLET BUTTONS ═══════════ -->
  <tr>
    <td style="padding:0 36px 28px;">
      <div style="font-size:11px;letter-spacing:3px;color:#333;text-transform:uppercase;text-align:center;margin-bottom:16px;">
        ${isHe ? '📲 שמור ל-Wallet — גישה מיידית' : '📲 SAVE TO WALLET — INSTANT ACCESS'}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <!-- Apple Wallet -->
          <td align="center" style="padding:0 6px 0 0;">
            <a href="${p.appleWalletUrl || `${appUrl}/api/prestige-pass/apple-wallet`}"
               target="_blank" style="display:block;text-decoration:none;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background:#000;border:1px solid #333;border-radius:12px;">
                <tr>
                  <td style="padding:14px 20px;" align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <!-- Apple logo approximation -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 814 1000" fill="#fff">
                            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-154.8-95.6C33.3 756.3 11 658.7 11 563.7c0-214.2 139.4-327.3 276.8-327.3 71 0 130.1 46.4 174.9 46.4 42.7 0 109.6-49.5 186.7-49.5zm-154.3-100.3c31.7-37.6 54.4-89.9 54.4-142.2 0-7.1-.5-14.3-1.6-20.4-51.5 2-112 34.4-148.7 75.8-28.5 32.4-55.1 84.7-55.1 137.7 0 7.5 1.1 15 1.6 17.3 3.2.5 8.4 1.1 13.6 1.1 46.4 0 101.5-30.8 135.8-69.3z"/>
                          </svg>
                        </td>
                        <td style="padding-${isHe ? 'right' : 'left'}:10px;">
                          <div style="font-size:9px;color:#888;letter-spacing:2px;text-transform:uppercase;">${isHe ? 'הוסף ל' : 'Add to'}</div>
                          <div style="font-size:16px;font-weight:700;color:#fff;letter-spacing:0.5px;">Apple Wallet</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </a>
          </td>

          <!-- Google Wallet -->
          <td align="center" style="padding:0 0 0 6px;">
            <a href="${p.googleWalletUrl || `${appUrl}/api/prestige-pass/google-wallet`}"
               target="_blank" style="display:block;text-decoration:none;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;">
                <tr>
                  <td style="padding:14px 20px;" align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <!-- Google G -->
                          <table role="presentation" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="font-size:18px;font-weight:900;color:#4285F4;font-family:Arial,sans-serif;line-height:1;">G</td>
                              <td style="font-size:18px;font-weight:900;color:#EA4335;font-family:Arial,sans-serif;line-height:1;">o</td>
                              <td style="font-size:18px;font-weight:900;color:#FBBC05;font-family:Arial,sans-serif;line-height:1;">o</td>
                              <td style="font-size:18px;font-weight:900;color:#4285F4;font-family:Arial,sans-serif;line-height:1;">g</td>
                              <td style="font-size:18px;font-weight:900;color:#34A853;font-family:Arial,sans-serif;line-height:1;">l</td>
                              <td style="font-size:18px;font-weight:900;color:#EA4335;font-family:Arial,sans-serif;line-height:1;">e</td>
                            </tr>
                          </table>
                        </td>
                        <td style="padding-${isHe ? 'right' : 'left'}:10px;">
                          <div style="font-size:9px;color:#666;letter-spacing:2px;text-transform:uppercase;">${isHe ? 'הוסף ל' : 'Add to'}</div>
                          <div style="font-size:16px;font-weight:700;color:#fff;letter-spacing:0.5px;">Google Wallet</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══════════ CTA ═══════════ -->
  <tr>
    <td style="padding:0 36px 32px;">
      <a href="${appUrl}/prestige-pass" target="_blank"
         style="display:block;background:linear-gradient(135deg,#D4AF37 0%,#F0D060 50%,#B8941F 100%);
                color:#0a0a0a;font-size:15px;font-weight:800;text-decoration:none;
                padding:16px 36px;border-radius:10px;text-align:center;
                letter-spacing:2px;text-transform:uppercase;">
        ${isHe ? 'פתח את הפאס שלי &larr;' : '&rarr; Open My Pass'}
      </a>
    </td>
  </tr>

  <!-- ═══════════ BOTTOM GOLD LINE ═══════════ -->
  <tr>
    <td style="background:linear-gradient(90deg,#0a0a0a 0%,#D4AF37 30%,#F0D060 50%,#D4AF37 70%,#0a0a0a 100%);height:1px;font-size:0;">&nbsp;</td>
  </tr>

  <!-- ═══════════ FOOTER ═══════════ -->
  <tr>
    <td style="padding:20px 36px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#333;letter-spacing:2px;text-transform:uppercase;">PetWash™ · Premium Organic Pet Care</p>
      <p style="margin:0 0 4px;font-size:11px;color:#333;">
        <a href="https://petwash.co.il" style="color:#D4AF37;text-decoration:none;">petwash.co.il</a>
        &nbsp;·&nbsp;
        <a href="mailto:support@petwash.co.il" style="color:#D4AF37;text-decoration:none;">support@petwash.co.il</a>
      </p>
      <p style="margin:12px 0 0;font-size:9px;color:#222;line-height:1.6;">
        ${isHe
          ? 'כרטיס זה מונפק ע"י PetWash Ltd. (ח.פ. 516458396). אינו ניתן להעברה. © 2024–2026 PetWash™'
          : 'Issued by PetWash Ltd. (Co. 516458396). Non-transferable. © 2024–2026 PetWash™'
        }
      </p>
    </td>
  </tr>

</table>
<!-- END CONTENT CARD -->

</td></tr>
</table>
<!-- END OUTER WRAPPER -->

</body>
</html>`;

  return html;
}
