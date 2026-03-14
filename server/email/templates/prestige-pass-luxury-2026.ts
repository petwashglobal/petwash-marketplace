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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="40" viewBox="0 0 52 40">
  <rect width="52" height="40" rx="6" fill="${color}" opacity=".9"/>
  <rect x="17" y="0" width="18" height="40" rx="2" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
  <rect x="0" y="12" width="52" height="16" rx="2" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
  <rect x="17" y="12" width="18" height="16" rx="2" fill="rgba(0,0,0,.3)"/>
  <rect x="19" y="14" width="14" height="12" rx="1" fill="${color}" opacity=".25"/>
  <rect x="22" y="17" width="8" height="6" rx="1" fill="rgba(0,0,0,.2)"/>
</svg>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// CONTACTLESS ICON
// ──────────────────────────────────────────────────────────────────────────────
function contactlessIcon(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
  <path d="M4 14 A12 12 0 0 1 24 14" stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>
  <path d="M8 14 A8 8 0 0 1 20 14" stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity=".65"/>
  <path d="M12 14 A4 4 0 0 1 16 14" stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity=".4"/>
  <circle cx="14" cy="14" r="2" fill="${color}" opacity=".95"/>
</svg>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// OFFICIAL APPLE WALLET BADGE
// ──────────────────────────────────────────────────────────────────────────────
function appleWalletBadge(url: string, isHe: boolean): string {
  return `
<a href="${url}" target="_blank" style="display:inline-block;text-decoration:none;">
  <table role="presentation" cellspacing="0" cellpadding="0"
         style="background:#000000;border-radius:14px;border:1px solid rgba(255,255,255,.15);
                box-shadow:0 4px 20px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.08);">
    <tr>
      <td style="padding:13px 22px 13px 18px;">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;padding-right:11px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="26" viewBox="0 0 814 1000" fill="#ffffff">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-154.8-95.6C33.3 756.3 11 658.7 11 563.7c0-214.2 139.4-327.3 276.8-327.3 71 0 130.1 46.4 174.9 46.4 42.7 0 109.6-49.5 186.7-49.5zm-154.3-100.3c31.7-37.6 54.4-89.9 54.4-142.2 0-7.1-.5-14.3-1.6-20.4-51.5 2-112 34.4-148.7 75.8-28.5 32.4-55.1 84.7-55.1 137.7 0 7.5 1.1 15 1.6 17.3 3.2.5 8.4 1.1 13.6 1.1 46.4 0 101.5-30.8 135.8-69.3z"/>
              </svg>
            </td>
            <td style="vertical-align:middle;">
              <div style="font-size:9px;color:rgba(255,255,255,.55);letter-spacing:1.5px;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.2;margin-bottom:2px;">${isHe ? 'הוסף ל' : 'Add to'}</div>
              <div style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:0.2px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.1;white-space:nowrap;">Apple Wallet</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</a>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// OFFICIAL GOOGLE WALLET BADGE
// ──────────────────────────────────────────────────────────────────────────────
function googleWalletBadge(url: string, isHe: boolean): string {
  return `
<a href="${url}" target="_blank" style="display:inline-block;text-decoration:none;">
  <table role="presentation" cellspacing="0" cellpadding="0"
         style="background:#1f1f1f;border-radius:14px;border:1px solid rgba(255,255,255,.12);
                box-shadow:0 4px 20px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06);">
    <tr>
      <td style="padding:13px 22px 13px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;padding-right:11px;">
              <!-- Google Wallet Icon (G with wallet colors) -->
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="12" fill="#fff" opacity=".07"/>
                <text x="12" y="17" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="800">
                  <tspan fill="#4285F4">G</tspan>
                </text>
              </svg>
            </td>
            <td style="vertical-align:middle;">
              <div style="font-size:9px;color:rgba(255,255,255,.45);letter-spacing:1.5px;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.2;margin-bottom:2px;">${isHe ? 'שמור ב' : 'Save to'}</div>
              <div style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:0.2px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.1;white-space:nowrap;">Google Wallet</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</a>`;
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
<body style="margin:0;padding:0;background:#030303;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<!-- OUTER WRAPPER -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"
       style="background:linear-gradient(180deg,#080808 0%,#030303 100%);">
<tr><td align="center" style="padding:40px 12px 48px;">

<!-- CONTENT CARD -->
<table role="presentation" width="600" cellspacing="0" cellpadding="0"
       style="max-width:600px;width:100%;background:#0c0c0c;
              border-radius:24px;
              border:1px solid #1c1c1c;
              box-shadow:0 0 0 1px rgba(212,175,55,.06),0 40px 80px rgba(0,0,0,.9);
              overflow:hidden;">

  <!-- ═══════════ TOP METALLIC BAND ═══════════ -->
  <tr>
    <td style="background:linear-gradient(90deg,
               #030303 0%,
               #1a1200 15%,
               #8a6f00 28%,
               #D4AF37 38%,
               #F0D060 50%,
               #D4AF37 62%,
               #8a6f00 72%,
               #1a1200 85%,
               #030303 100%);
               height:2px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>

  <!-- ═══════════ HEADER ═══════════ -->
  <tr>
    <td style="padding:32px 40px 22px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <!-- Brand wordmark -->
            <div style="font-size:9px;letter-spacing:7px;color:#D4AF37;text-transform:uppercase;margin-bottom:5px;font-weight:600;">P E T W A S H ™</div>
            <div style="font-size:10px;letter-spacing:4px;color:#2e2e2e;text-transform:uppercase;">${isHe ? 'כרטיס חבר פרסטיז' : 'PRESTIGE MEMBERSHIP'}</div>
          </td>
          <td align="${isHe ? 'left' : 'right'}">
            <!-- Discount badge -->
            <div style="display:inline-block;background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(212,175,55,.04));
                        border:1px solid rgba(212,175,55,.25);border-radius:8px;padding:7px 14px;text-align:center;">
              <div style="font-size:20px;font-weight:900;color:${cfg.accentHex};letter-spacing:0.5px;line-height:1;">${cfg.discountPct}%</div>
              <div style="font-size:8px;letter-spacing:3px;color:#4a4a4a;text-transform:uppercase;margin-top:2px;">${isHe ? 'הנחה' : 'DISCOUNT'}</div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══════════ GREETING ═══════════ -->
  <tr>
    <td style="padding:0 40px 28px;">
      <!-- Thin divider -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,#1e1e1e,transparent);margin-bottom:24px;"></div>
      <p style="margin:0 0 10px;font-size:16px;color:#c8c8c8;line-height:1.75;font-weight:300;letter-spacing:0.3px;">
        ${isHe
          ? `שלום <strong style="color:#fff;font-weight:600;">${p.firstName}</strong>, הכרטיס הפרסטיז שלך מוכן לשימוש מלא.`
          : `Hello <strong style="color:#fff;font-weight:600;">${p.firstName}</strong>, your Prestige Pass is ready.`
        }
      </p>
      <p style="margin:0;font-size:12px;color:#3a3a3a;line-height:1.7;letter-spacing:0.5px;">
        ${isHe
          ? 'שמור/י אותו ב-Apple Wallet או ב-Google Wallet — גישה מיידית בכל תחנת K9000.'
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
    <td style="padding:4px 40px 28px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
             style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:16px;overflow:hidden;">
        <tr>
          <!-- Cash Wallet -->
          <td align="center" style="padding:20px 8px;border-${isHe ? 'left' : 'right'}:1px solid #141414;">
            <div style="font-size:8px;letter-spacing:3px;color:#3a3a3a;text-transform:uppercase;margin-bottom:8px;">${isHe ? 'ארנק מזומן' : 'CASH WALLET'}</div>
            <div style="font-size:20px;font-weight:800;color:#D4AF37;letter-spacing:-0.5px;">₪${fmt(p.cashWalletILS)}</div>
          </td>
          <!-- eGift Balance -->
          <td align="center" style="padding:20px 8px;border-${isHe ? 'left' : 'right'}:1px solid #141414;">
            <div style="font-size:8px;letter-spacing:3px;color:#3a3a3a;text-transform:uppercase;margin-bottom:8px;">${isHe ? 'כרטיסי מתנה' : 'E-GIFT'}</div>
            <div style="font-size:20px;font-weight:800;color:#E7C978;letter-spacing:-0.5px;">₪${fmt(p.eGiftBalanceILS)}</div>
          </td>
          <!-- Loyalty Points -->
          <td align="center" style="padding:20px 8px;">
            <div style="font-size:8px;letter-spacing:3px;color:#3a3a3a;text-transform:uppercase;margin-bottom:8px;">${isHe ? 'נקודות' : 'POINTS'}</div>
            <div style="font-size:20px;font-weight:800;color:#888;letter-spacing:-0.5px;">${fmt(p.loyaltyPoints)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══════════ TIER PROGRESS ═══════════ (only if not maxed) -->
  ${p.nextTierName && progressPct < 100 ? `
  <tr>
    <td style="padding:0 40px 24px;">
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
    <td style="padding:0 40px 28px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
             style="background:#080808;border:1px solid #161616;border-radius:16px;border-${isHe ? 'right' : 'left'}:3px solid ${cfg.accentHex};overflow:hidden;">
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
    <td style="padding:0 36px 32px;">

      <!-- Section label -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
        <tr>
          <td style="border-top:1px solid #1a1a1a;"></td>
          <td style="padding:0 16px;white-space:nowrap;">
            <div style="font-size:9px;letter-spacing:4px;color:#3a3a3a;text-transform:uppercase;text-align:center;">
              ${isHe ? 'שמור לארנק הנייד שלך' : 'SAVE TO YOUR MOBILE WALLET'}
            </div>
          </td>
          <td style="border-top:1px solid #1a1a1a;"></td>
        </tr>
      </table>

      <!-- Two badges side by side -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding:0 8px 0 0;">
            ${appleWalletBadge(p.appleWalletUrl || `${appUrl}/prestige-pass`, isHe)}
          </td>
          <td align="center" style="padding:0 0 0 8px;">
            ${googleWalletBadge(p.googleWalletUrl || `${appUrl}/prestige-pass`, isHe)}
          </td>
        </tr>
      </table>

      <!-- Subtle note -->
      <div style="font-size:10px;color:#2a2a2a;text-align:center;margin-top:14px;letter-spacing:1px;">
        ${isHe ? 'גישה מיידית · QR מתחלף כל 45 שניות · ₪0 ביד' : 'Instant access · QR auto-rotates every 45 sec · ₪0 out of pocket'}
      </div>

    </td>
  </tr>

  <!-- ═══════════ CTA ═══════════ -->
  <tr>
    <td style="padding:0 40px 36px;" align="center">
      <a href="${appUrl}/prestige-pass" target="_blank"
         style="display:inline-block;
                background:linear-gradient(135deg,#C6A35B 0%,#F0D060 40%,#E7C978 60%,#B8941F 100%);
                color:#0a0800;font-size:12px;font-weight:800;text-decoration:none;
                padding:17px 52px;border-radius:40px;text-align:center;
                letter-spacing:4px;text-transform:uppercase;
                box-shadow:0 0 30px rgba(212,175,55,.25),0 4px 20px rgba(0,0,0,.6);">
        ${isHe ? '← פתח את הפאס שלי' : 'OPEN MY PASS →'}
      </a>
    </td>
  </tr>

  <!-- ═══════════ BOTTOM METALLIC BAND ═══════════ -->
  <tr>
    <td style="background:linear-gradient(90deg,
               #030303 0%,
               #1a1200 15%,
               #8a6f00 28%,
               #D4AF37 38%,
               #F0D060 50%,
               #D4AF37 62%,
               #8a6f00 72%,
               #1a1200 85%,
               #030303 100%);
               height:2px;font-size:0;">&nbsp;</td>
  </tr>

  <!-- ═══════════ FOOTER ═══════════ -->
  <tr>
    <td style="padding:24px 40px;text-align:center;">
      <p style="margin:0 0 6px;font-size:9px;letter-spacing:5px;color:#2a2a2a;text-transform:uppercase;">P E T W A S H ™ &nbsp;·&nbsp; PREMIUM ORGANIC PET CARE</p>
      <p style="margin:0 0 6px;font-size:10px;color:#2a2a2a;">
        <a href="https://petwash.co.il" style="color:#8a6f30;text-decoration:none;letter-spacing:1px;">petwash.co.il</a>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <a href="mailto:support@petwash.co.il" style="color:#8a6f30;text-decoration:none;">support@petwash.co.il</a>
      </p>
      <p style="margin:14px 0 0;font-size:9px;color:#1e1e1e;line-height:1.7;letter-spacing:0.3px;">
        ${isHe
          ? 'כרטיס זה מונפק ע"י PetWash Ltd. (ח.פ. 516458396) · אינו ניתן להעברה · © 2024–2026 PetWash™'
          : 'Issued by PetWash Ltd. (Co. 516458396) · Non-transferable · © 2024–2026 PetWash™'
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
