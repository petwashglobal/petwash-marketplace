/**
 * PetWash™ Prestige Pass — Luxury Unified Pass Email
 * Credit-card style visual with QR, loyalty, eGift & wallet buttons
 * Pure white background, gold accents, dark card floated on white.
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
  chipColor: string;
  accentHex: string;
  accentRgb: string;
  bandColor: string;
}> = {
  pearl: {
    label: 'Prestige Pearl', labelHe: 'פרסטיז פנינה',
    cardBg: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d4a 40%, #1a1a2e 100%)',
    chipColor: '#c8b8e8', accentHex: '#c8b8e8', accentRgb: '200,184,232',
    bandColor: '#8870a8',
  },
  silver: {
    label: 'Prestige Silver', labelHe: 'פרסטיז כסף',
    cardBg: 'linear-gradient(135deg, #1c1c1c 0%, #3a3a3a 40%, #1c1c1c 100%)',
    chipColor: '#c0c8d4', accentHex: '#c0c8d4', accentRgb: '192,200,212',
    bandColor: '#6a7280',
  },
  gold: {
    label: 'Prestige Gold', labelHe: 'פרסטיז זהב',
    cardBg: 'linear-gradient(135deg, #1a1200 0%, #2a1f00 40%, #1a1200 100%)',
    chipColor: '#D4AF37', accentHex: '#D4AF37', accentRgb: '212,175,55',
    bandColor: '#B8941F',
  },
  platinum: {
    label: 'Prestige Platinum', labelHe: 'פרסטיז פלטינום',
    cardBg: 'linear-gradient(135deg, #0f0f1a 0%, #1a2030 40%, #0f0f1a 100%)',
    chipColor: '#d8dcf0', accentHex: '#d8dcf0', accentRgb: '216,220,240',
    bandColor: '#8890b0',
  },
  diamond: {
    label: 'Prestige Diamond', labelHe: 'פרסטיז יהלום',
    cardBg: 'linear-gradient(135deg, #050d1a 0%, #0a1830 45%, #050d1a 100%)',
    chipColor: '#64a0ff', accentHex: '#64a0ff', accentRgb: '100,160,255',
    bandColor: '#2255cc',
  },
  emerald: {
    label: 'Prestige Emerald', labelHe: 'פרסטיז אמרלד',
    cardBg: 'linear-gradient(135deg, #000f08 0%, #001a10 45%, #000f08 100%)',
    chipColor: '#00c864', accentHex: '#00c864', accentRgb: '0,200,100',
    bandColor: '#007040',
  },
  royal: {
    label: 'Prestige Royal', labelHe: 'פרסטיז רויאל',
    cardBg: 'linear-gradient(135deg, #0a0006 0%, #1a0012 45%, #0a0006 100%)',
    chipColor: '#dc50b4', accentHex: '#dc50b4', accentRgb: '220,80,180',
    bandColor: '#880060',
  },
  black: {
    label: 'Prestige Black', labelHe: 'פרסטיז שחור',
    cardBg: 'linear-gradient(135deg, #000000 0%, #0d0d0d 30%, #1a1100 60%, #0d0d0d 80%, #000000 100%)',
    chipColor: '#D4AF37', accentHex: '#D4AF37', accentRgb: '212,175,55',
    bandColor: '#8a6f00',
  },
};

function fmt(n: number) {
  return n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function maskCard(num: string): string {
  const last4 = num.replace(/\D/g, '').slice(-4);
  return `•••• &nbsp;•••• &nbsp;•••• &nbsp;${last4}`;
}

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

function contactlessIcon(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
  <path d="M4 14 A12 12 0 0 1 24 14" stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>
  <path d="M8 14 A8 8 0 0 1 20 14" stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity=".65"/>
  <path d="M12 14 A4 4 0 0 1 16 14" stroke="${color}" stroke-width="2.2" stroke-linecap="round" opacity=".4"/>
  <circle cx="14" cy="14" r="2" fill="${color}" opacity=".95"/>
</svg>`;
}

function appleWalletIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
  <rect width="46" height="46" rx="10" fill="#EDE8E0"/>
  <rect x="7" y="10" width="32" height="20" rx="3" fill="#F5C842" transform="rotate(-8 23 20)"/>
  <rect x="7" y="13" width="32" height="20" rx="3" fill="#34C759" transform="rotate(-3 23 23)"/>
  <rect x="6" y="18" width="34" height="22" rx="4" fill="#FAF7F2"/>
  <rect x="6" y="24" width="34" height="7" fill="#E8E2D8"/>
  <rect x="10" y="26" width="14" height="3" rx="1.5" fill="#C8BFB0" opacity=".7"/>
  <rect x="22" y="19" width="18" height="12" rx="2.5" fill="#FF3B30" opacity=".9" transform="rotate(4 31 25)"/>
</svg>`;
}

function googleWalletIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
  <rect width="46" height="46" rx="10" fill="#1A73E8"/>
  <rect x="8" y="10" width="30" height="18" rx="3" fill="#34A853" transform="rotate(-10 23 19)"/>
  <rect x="8" y="14" width="30" height="18" rx="3" fill="#FBBC04" transform="rotate(-4 23 23)"/>
  <rect x="8" y="18" width="30" height="18" rx="3" fill="#EA4335" transform="rotate(2 23 27)"/>
  <rect x="7" y="22" width="32" height="18" rx="4" fill="#4285F4"/>
  <rect x="12" y="27" width="10" height="6" rx="2" fill="#fff" opacity=".25"/>
  <rect x="12" y="34" width="22" height="2" rx="1" fill="#fff" opacity=".2"/>
</svg>`;
}

function appleWalletBadge(url: string, isHe: boolean): string {
  return `
<a href="${url}" target="_blank" style="display:inline-block;text-decoration:none;">
  <table role="presentation" cellspacing="0" cellpadding="0"
         style="background:#000000;border-radius:16px;border:1px solid rgba(255,255,255,.12);
                box-shadow:0 4px 16px rgba(0,0,0,.2);">
    <tr>
      <td style="padding:11px 24px 11px 14px;">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;padding-right:13px;">
              ${appleWalletIcon()}
            </td>
            <td style="vertical-align:middle;">
              <div style="font-size:11px;color:rgba(255,255,255,.6);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.3;margin-bottom:1px;">${isHe ? 'הוסף ל' : 'Add to'}</div>
              <div style="font-size:20px;font-weight:700;color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.15;white-space:nowrap;letter-spacing:-0.3px;">Apple Wallet</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</a>`;
}

function googleWalletBadge(url: string, isHe: boolean): string {
  return `
<a href="${url}" target="_blank" style="display:inline-block;text-decoration:none;">
  <table role="presentation" cellspacing="0" cellpadding="0"
         style="background:#1c1c1e;border-radius:16px;border:1px solid rgba(255,255,255,.1);
                box-shadow:0 4px 16px rgba(0,0,0,.18);">
    <tr>
      <td style="padding:11px 24px 11px 14px;">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align:middle;padding-right:13px;">
              ${googleWalletIcon()}
            </td>
            <td style="vertical-align:middle;">
              <div style="font-size:11px;color:rgba(255,255,255,.5);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.3;margin-bottom:1px;">${isHe ? 'הוסף ל' : 'Add to'}</div>
              <div style="font-size:20px;font-weight:700;color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.15;white-space:nowrap;letter-spacing:-0.3px;">Google Wallet</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</a>`;
}

export function buildPrestigePassLuxuryEmail(p: PrestigePassEmailParams): string {
  const cfg = TIER_CONFIG[p.tier] ?? TIER_CONFIG.black;
  const isHe = (p.language ?? 'he') === 'he';
  const appUrl = p.appBaseUrl ?? 'https://petwash.co.il';
  const maskedNum = maskCard(p.cardNumber);
  const totalBalanceILS = p.cashWalletILS + p.eGiftBalanceILS;
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ');

  const progressPct = p.nextTierPointsNeeded && p.nextTierPointsNeeded > 0
    ? Math.min(100, Math.round((1 - p.nextTierPointsNeeded / (p.loyaltyPoints + p.nextTierPointsNeeded)) * 100))
    : 100;

  return `<!DOCTYPE html>
<html lang="${isHe ? 'he' : 'en'}" dir="${isHe ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${isHe ? 'כרטיס הפרסטיז שלך — PetWash™' : 'Your Prestige Pass — PetWash™'}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<!-- OUTER WRAPPER -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;">
<tr><td align="center" style="padding:36px 12px 48px;">

<!-- CONTENT CARD — pure white -->
<table role="presentation" width="600" cellspacing="0" cellpadding="0"
       style="max-width:600px;width:100%;background:#ffffff;
              border-radius:20px;
              box-shadow:0 2px 24px rgba(0,0,0,.10),0 1px 4px rgba(0,0,0,.06);">

  <!-- ═══ GOLD TOP BAND ═══ -->
  <tr>
    <td style="background:linear-gradient(90deg,
               #ffffff 0%,
               #e8d48a 10%,
               #D4AF37 25%,
               #F0D060 50%,
               #D4AF37 75%,
               #e8d48a 90%,
               #ffffff 100%);
               height:3px;font-size:0;line-height:0;border-radius:20px 20px 0 0;">&nbsp;</td>
  </tr>

  <!-- ═══ HEADER ═══ -->
  <tr>
    <td style="padding:32px 40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <div style="font-size:9px;letter-spacing:6px;color:#C6A35B;text-transform:uppercase;font-weight:700;margin-bottom:4px;">P&nbsp;E&nbsp;T&nbsp;W&nbsp;A&nbsp;S&nbsp;H&nbsp;™</div>
            <div style="font-size:10px;letter-spacing:3px;color:#aaaaaa;text-transform:uppercase;">${isHe ? 'כרטיס חבר פרסטיז' : 'PRESTIGE MEMBERSHIP'}</div>
          </td>
          <td align="${isHe ? 'left' : 'right'}">
            <div style="display:inline-block;background:linear-gradient(135deg,#000000 0%,#1a1100 60%,#0d0d0d 100%);
                        border-radius:8px;padding:8px 16px;text-align:center;
                        box-shadow:0 2px 8px rgba(0,0,0,.18);">
              <div style="font-size:9px;letter-spacing:3px;color:rgba(${cfg.accentRgb},.7);text-transform:uppercase;margin-bottom:3px;">${isHe ? cfg.labelHe : cfg.label}</div>
              <div style="font-size:11px;letter-spacing:2px;color:${cfg.accentHex};font-weight:700;">${isHe ? '✦ פרמיום ✦' : '✦ PREMIUM ✦'}</div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ GREETING ═══ -->
  <tr>
    <td style="padding:0 40px 28px;">
      <div style="height:1px;background:linear-gradient(90deg,transparent,#e8e0d0,transparent);margin-bottom:22px;"></div>
      <p style="margin:0 0 8px;font-size:17px;color:#1a1a1a;line-height:1.6;font-weight:400;">
        ${isHe
          ? `שלום <strong style="color:#000;font-weight:700;">${p.firstName}</strong>,`
          : `Hello <strong style="color:#000;font-weight:700;">${p.firstName}</strong>,`
        }
      </p>
      <p style="margin:0;font-size:14px;color:#555555;line-height:1.7;">
        ${isHe
          ? 'הכרטיס הפרסטיז שלך מוכן לשימוש מלא. שמור/י אותו ב‑Apple Wallet או ב‑Google Wallet — גישה מיידית בכל תחנת K9000.'
          : 'Your Prestige Pass is ready for full use. Save it to Apple Wallet or Google Wallet — instant access at every K9000 station.'
        }
      </p>
    </td>
  </tr>

  <!-- ═══ THE DARK CREDIT CARD (floated on white) ═══ -->
  <tr>
    <td align="center" style="padding:0 28px 32px;">

      <table role="presentation" width="540" cellspacing="0" cellpadding="0"
             style="max-width:540px;width:100%;background:${cfg.cardBg};
                    border-radius:18px;overflow:hidden;
                    box-shadow:0 8px 40px rgba(${cfg.accentRgb},.22),
                               0 24px 60px rgba(0,0,0,.22),
                               0 2px 8px rgba(0,0,0,.18);
                    border:1px solid rgba(${cfg.accentRgb},.2);">

        <!-- ROW 1: brand + contactless -->
        <tr>
          <td style="padding:22px 26px 6px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <span style="font-size:13px;letter-spacing:5px;font-weight:800;color:${cfg.accentHex};text-transform:uppercase;">PetWash™</span>
                </td>
                <td align="${isHe ? 'left' : 'right'}" style="vertical-align:top;">
                  ${contactlessIcon(cfg.accentHex)}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ROW 2: Tier label -->
        <tr>
          <td style="padding:2px 26px 14px;">
            <span style="display:inline-block;background:rgba(${cfg.accentRgb},.12);border:1px solid rgba(${cfg.accentRgb},.35);
                         color:${cfg.accentHex};font-size:9px;letter-spacing:3px;font-weight:700;
                         padding:4px 12px;border-radius:20px;text-transform:uppercase;">
              ${isHe ? cfg.labelHe : cfg.label}
            </span>
          </td>
        </tr>

        <!-- ROW 3: Chip + Balances + QR -->
        <tr>
          <td style="padding:0 26px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="vertical-align:middle;width:60px;">
                  ${chipSvg(cfg.chipColor)}
                </td>
                <td style="width:12px;"></td>
                <td style="vertical-align:middle;">
                  <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding-bottom:6px;">
                        <span style="background:rgba(0,0,0,.45);border:1px solid rgba(${cfg.accentRgb},.22);
                                     color:${cfg.accentHex};font-size:10px;letter-spacing:1px;font-weight:700;
                                     padding:4px 10px;border-radius:6px;white-space:nowrap;">
                          ${isHe ? 'נקודות' : 'POINTS'}&nbsp;&nbsp;<strong style="font-size:13px;">${fmt(p.loyaltyPoints)}</strong>
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span style="background:rgba(0,0,0,.45);border:1px solid rgba(${cfg.accentRgb},.22);
                                     color:#fff;font-size:10px;letter-spacing:1px;font-weight:700;
                                     padding:4px 10px;border-radius:6px;white-space:nowrap;">
                          ${isHe ? 'יתרה' : 'BALANCE'}&nbsp;&nbsp;<strong style="font-size:13px;color:${cfg.accentHex};">₪${fmt(totalBalanceILS)}</strong>
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="${isHe ? 'left' : 'right'}" style="vertical-align:middle;">
                  <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="background:rgba(255,255,255,.96);border-radius:10px;padding:6px;">
                        <img src="${p.qrDataUrl}" width="72" height="72" alt=""
                             style="display:block;border-radius:5px;"/>
                        <div style="font-size:7px;letter-spacing:2px;color:#666;text-transform:uppercase;margin-top:3px;text-align:center;">K9000</div>
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
            <div style="font-size:18px;letter-spacing:3px;color:rgba(255,255,255,.82);font-family:'Courier New',monospace;font-weight:600;">
              ${maskedNum}
            </div>
          </td>
        </tr>

        <!-- ROW 5: Name + year + free washes -->
        <tr>
          <td style="padding:4px 26px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:3px;">${isHe ? 'שם חבר' : 'CARD HOLDER'}</div>
                  <div style="font-size:12px;letter-spacing:2px;color:#ddd;font-weight:600;text-transform:uppercase;">${fullName || 'PETWASH MEMBER'}</div>
                </td>
                <td align="${isHe ? 'left' : 'right'}">
                  <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:3px;">${isHe ? 'חבר מ' : 'MEMBER'}</div>
                  <div style="font-size:12px;letter-spacing:2px;color:#ddd;font-weight:600;">${p.memberSinceYear}</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="background:rgba(${cfg.accentRgb},.1);border:1px solid rgba(${cfg.accentRgb},.3);border-radius:8px;padding:5px 12px;text-align:center;">
                    <div style="font-size:9px;letter-spacing:1px;color:#666;text-transform:uppercase;">${isHe ? 'שטיפות חינם' : 'FREE WASHES'}</div>
                    <div style="font-size:20px;font-weight:900;color:${cfg.accentHex};line-height:1.1;">${p.freeWashesRemaining}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Bottom shimmer line -->
        <tr>
          <td style="background:linear-gradient(90deg,transparent,rgba(${cfg.accentRgb},.5),transparent);height:1px;font-size:0;">&nbsp;</td>
        </tr>

      </table>
      <!-- END CREDIT CARD -->

    </td>
  </tr>

  <!-- ═══ BALANCE BREAKDOWN — white with gold borders ═══ -->
  <tr>
    <td style="padding:0 40px 28px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
             style="border:1px solid #e8e0cc;border-radius:14px;overflow:hidden;">
        <tr>
          <td align="center" style="padding:18px 8px;border-${isHe ? 'left' : 'right'}:1px solid #e8e0cc;">
            <div style="font-size:8px;letter-spacing:3px;color:#aaaaaa;text-transform:uppercase;margin-bottom:8px;">${isHe ? 'ארנק מזומן' : 'CASH WALLET'}</div>
            <div style="font-size:22px;font-weight:800;color:#C6A35B;letter-spacing:-0.5px;">₪${fmt(p.cashWalletILS)}</div>
          </td>
          <td align="center" style="padding:18px 8px;border-${isHe ? 'left' : 'right'}:1px solid #e8e0cc;">
            <div style="font-size:8px;letter-spacing:3px;color:#aaaaaa;text-transform:uppercase;margin-bottom:8px;">${isHe ? 'כרטיסי מתנה' : 'E-GIFT'}</div>
            <div style="font-size:22px;font-weight:800;color:#D4AF37;letter-spacing:-0.5px;">₪${fmt(p.eGiftBalanceILS)}</div>
          </td>
          <td align="center" style="padding:18px 8px;">
            <div style="font-size:8px;letter-spacing:3px;color:#aaaaaa;text-transform:uppercase;margin-bottom:8px;">${isHe ? 'נקודות' : 'POINTS'}</div>
            <div style="font-size:22px;font-weight:800;color:#888888;letter-spacing:-0.5px;">${fmt(p.loyaltyPoints)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ TIER PROGRESS ═══ -->
  ${p.nextTierName && progressPct < 100 ? `
  <tr>
    <td style="padding:0 40px 24px;">
      <div style="font-size:11px;letter-spacing:1px;color:#888;margin-bottom:8px;font-weight:500;">
        ${isHe
          ? `${progressPct}% בדרך אל ${p.nextTierName}`
          : `${progressPct}% progress toward ${p.nextTierName}`
        }
      </div>
      <div style="background:#f0f0f0;border-radius:6px;height:5px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#C6A35B,#D4AF37);width:${progressPct}%;height:5px;border-radius:6px;"></div>
      </div>
      ${p.nextTierPointsNeeded ? `
      <div style="font-size:11px;color:#bbb;margin-top:6px;text-align:${isHe ? 'left' : 'right'};">
        ${isHe
          ? `עוד ${fmt(p.nextTierPointsNeeded)} נקודות לדרגה הבאה`
          : `${fmt(p.nextTierPointsNeeded)} points to next tier`
        }
      </div>` : ''}
    </td>
  </tr>` : ''}

  <!-- ═══ K9000 INSTRUCTIONS ═══ -->
  <tr>
    <td style="padding:0 40px 28px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
             style="background:#fafafa;border:1px solid #eee;border-radius:14px;
                    border-${isHe ? 'right' : 'left'}:3px solid #D4AF37;overflow:hidden;">
        <tr>
          <td style="padding:18px 22px;">
            <div style="font-size:11px;letter-spacing:2px;color:#C6A35B;text-transform:uppercase;margin-bottom:12px;font-weight:700;">
              ${isHe ? 'איך לממש בתחנת K9000' : 'HOW TO REDEEM AT K9000 KIOSK'}
            </div>
            <table role="presentation" cellspacing="0" cellpadding="0">
              ${(['1', '2', '3'] as const).map((n, i) => {
                const steps = isHe
                  ? ['גש/י לתחנת K9000 הקרובה', 'הציג/י את קוד ה‑QR בכרטיס (מתחלף אוטומטית כל 45 שניות)', 'הסורק יאמת ויפעיל שטיפה — ₪0 ביד']
                  : ['Approach any K9000 wash station', 'Show the QR code on your pass (auto-rotates every 45 sec)', 'Scanner verifies instantly — ₪0 out of pocket'];
                return `<tr>
                  <td style="padding:5px 0;vertical-align:top;width:28px;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;
                                 background:#D4AF37;
                                 border-radius:50%;font-size:10px;font-weight:800;color:#000;">${n}</span>
                  </td>
                  <td style="padding:5px 0 5px 10px;font-size:13px;color:#444;line-height:1.5;">${steps[i]}</td>
                </tr>`;
              }).join('')}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ WALLET BUTTONS ═══ -->
  <tr>
    <td style="padding:0 36px 32px;">

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
        <tr>
          <td style="border-top:1px solid #eee;"></td>
          <td style="padding:0 16px;white-space:nowrap;">
            <div style="font-size:9px;letter-spacing:4px;color:#bbb;text-transform:uppercase;text-align:center;">
              ${isHe ? 'שמור לארנק הנייד שלך' : 'SAVE TO YOUR MOBILE WALLET'}
            </div>
          </td>
          <td style="border-top:1px solid #eee;"></td>
        </tr>
      </table>

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

      <div style="font-size:11px;color:#cccccc;text-align:center;margin-top:14px;letter-spacing:0.5px;">
        ${isHe ? 'גישה מיידית · QR מתחלף כל 45 שניות · ₪0 ביד' : 'Instant access · QR auto-rotates every 45 sec · ₪0 out of pocket'}
      </div>

    </td>
  </tr>

  <!-- ═══ CTA ═══ -->
  <tr>
    <td style="padding:0 40px 36px;" align="center">
      <a href="${appUrl}/prestige-pass" target="_blank"
         style="display:inline-block;
                background:linear-gradient(135deg,#C6A35B 0%,#F0D060 40%,#E7C978 60%,#B8941F 100%);
                color:#0a0800;font-size:12px;font-weight:800;text-decoration:none;
                padding:17px 52px;border-radius:40px;text-align:center;
                letter-spacing:4px;text-transform:uppercase;
                box-shadow:0 4px 20px rgba(198,163,91,.35);">
        ${isHe ? '← פתח את הפאס שלי' : 'OPEN MY PASS →'}
      </a>
    </td>
  </tr>

  <!-- ═══ GOLD BOTTOM BAND ═══ -->
  <tr>
    <td style="background:linear-gradient(90deg,
               #ffffff 0%,
               #e8d48a 10%,
               #D4AF37 25%,
               #F0D060 50%,
               #D4AF37 75%,
               #e8d48a 90%,
               #ffffff 100%);
               height:3px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>

  <!-- ═══ FOOTER ═══ -->
  <tr>
    <td style="padding:24px 40px;text-align:center;background:#fafafa;border-radius:0 0 20px 20px;">
      <p style="margin:0 0 6px;font-size:9px;letter-spacing:5px;color:#cccccc;text-transform:uppercase;">P&nbsp;E&nbsp;T&nbsp;W&nbsp;A&nbsp;S&nbsp;H&nbsp;™&nbsp;·&nbsp;PREMIUM ORGANIC PET CARE</p>
      <p style="margin:0 0 8px;font-size:11px;color:#aaaaaa;">
        <a href="https://petwash.co.il" style="color:#C6A35B;text-decoration:none;">petwash.co.il</a>
        &nbsp;·&nbsp;
        <a href="mailto:support@petwash.co.il" style="color:#C6A35B;text-decoration:none;">support@petwash.co.il</a>
      </p>
      <p style="margin:0;font-size:10px;color:#cccccc;line-height:1.7;">
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
}
