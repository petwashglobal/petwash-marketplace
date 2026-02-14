import { PETWASH_LOGO_BASE64 } from './logo-base64';

interface EGiftActivationParams {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  giftValue: number;
  currency: string;
  giftCode: string;
  serialNumber: string;
  personalMessage?: string;
  expiresAt: string;
  language: 'he' | 'en';
}

const TIER_BY_VALUE: Record<string, { min: number; name: string; nameHe: string; gradient: string; cardBg: string; accent: string; accentLight: string; ornament: string; icon: string }> = {
  ELITE: {
    min: 750, name: 'Maison Prestige', nameHe: 'מזון פרסטיז\'',
    gradient: 'linear-gradient(145deg, #0D0D0D, #1a1a1a, #2a2a2a)',
    cardBg: 'linear-gradient(145deg, #0a0a0a, #1a1610, #0a0a0a)',
    accent: '#c9a96e',
    accentLight: 'rgba(201, 169, 110, 0.15)',
    ornament: '♛', icon: '♛'
  },
  PREMIUM: {
    min: 400, name: 'Grand Collection', nameHe: 'גרנד קולקשן',
    gradient: 'linear-gradient(145deg, #1a1a1a, #2d2d2d, #1a1a1a)',
    cardBg: 'linear-gradient(145deg, #141414, #1e1e1e, #141414)',
    accent: '#c9a96e',
    accentLight: 'rgba(201, 169, 110, 0.12)',
    ornament: '◆', icon: '✦'
  },
  PLUS: {
    min: 200, name: 'Signature', nameHe: 'סיגנטשר',
    gradient: 'linear-gradient(145deg, #1B3A2A, #2E5A40, #1B3A2A)',
    cardBg: 'linear-gradient(145deg, #0f2118, #1a3828, #0f2118)',
    accent: '#7CB98B',
    accentLight: 'rgba(124, 185, 139, 0.12)',
    ornament: '❖', icon: '✧'
  },
  CLASSIC: {
    min: 0, name: 'Collection', nameHe: 'קולקשן',
    gradient: 'linear-gradient(145deg, #3A1A28, #5A2A3E, #3A1A28)',
    cardBg: 'linear-gradient(145deg, #2a1520, #3d2030, #2a1520)',
    accent: '#D4A0B0',
    accentLight: 'rgba(212, 160, 176, 0.12)',
    ornament: '◇', icon: '✦'
  },
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

export function generateEGiftActivationEmail(params: EGiftActivationParams): { subject: string; html: string } {
  const { recipientName, senderName, giftValue, currency, giftCode, serialNumber, personalMessage, expiresAt, language } = params;
  const isHe = language === 'he';
  const dir = isHe ? 'rtl' : 'ltr';
  const alignOpp = isHe ? 'left' : 'right';
  const tier = getTierConfig(giftValue);
  const formattedValue = formatCurrency(giftValue, currency);
  const tierName = isHe ? tier.nameHe : tier.name;

  const subject = isHe
    ? `✨ ${senderName} שלח/ה לך מתנה יוקרתית של Pet Wash™ — ${formattedValue}`
    : `✨ ${senderName} sent you a Pet Wash™ Luxury Gift — ${formattedValue}`;

  const html = `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @keyframes fadeIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
    @keyframes breathe { 0%,100% { box-shadow:0 12px 40px rgba(0,0,0,0.3); } 50% { box-shadow:0 20px 60px rgba(0,0,0,0.4), 0 0 60px ${tier.accent}20; } }
    @keyframes goldShine { 0%,100% { opacity:0.3; } 50% { opacity:0.6; } }
    @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }
    .fi { animation: fadeIn 0.8s ease both; }
    .d1 { animation-delay:0.1s; } .d2 { animation-delay:0.2s; } .d3 { animation-delay:0.3s; } .d4 { animation-delay:0.4s; } .d5 { animation-delay:0.5s; } .d6 { animation-delay:0.6s; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:20px 12px;">

    <!-- Outer Frame -->
    <div style="border:1px solid #e0dbd3;border-radius:2px;overflow:hidden;background:white;">

      <!-- Top Ornamental Bar -->
      <div class="fi" style="background:#1a1a1a;padding:6px 0;text-align:center;">
        <span style="font-size:8px;letter-spacing:8px;color:${tier.accent};text-transform:uppercase;">
          ${tier.ornament} &nbsp; E-Gift Collection &nbsp; ${tier.ornament}
        </span>
      </div>

      <!-- Logo -->
      <div class="fi d1" style="padding:36px 40px 16px;text-align:center;background:white;">
        <img src="${PETWASH_LOGO_BASE64}" alt="Pet Wash™" style="max-width:130px;height:auto;" />
        <div style="margin-top:14px;font-size:9px;letter-spacing:6px;text-transform:uppercase;color:#bbb;">
          ${tierName}
        </div>
        <div style="width:40px;height:1px;background:${tier.accent};margin:14px auto 0;"></div>
      </div>

      <!-- Hero Section -->
      <div class="fi d2" style="padding:28px 40px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;animation:float 3s ease-in-out infinite;">🎁</div>
        <div style="font-size:11px;letter-spacing:5px;text-transform:uppercase;color:${tier.accent};margin-bottom:16px;">
          ${isHe ? 'מתנה בשבילך' : 'A Gift For You'}
        </div>
        <h1 style="font-size:28px;font-weight:300;color:#1a1a1a;margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.5px;">
          ${isHe ? `${recipientName}` : `${recipientName}`}
        </h1>
        <p style="font-size:14px;color:#888;margin:0;line-height:1.7;max-width:380px;display:inline-block;">
          ${isHe
            ? `${senderName} בחר/ה עבורך כרטיס מתנה יוקרתי מקולקציית Pet Wash™`
            : `${senderName} has selected a luxury gift card from the Pet Wash™ collection for you`}
        </p>
      </div>

      <!-- Ornament Divider -->
      <div style="text-align:center;padding:0 40px;">
        <span style="font-size:6px;letter-spacing:4px;color:#ccc;">── ─ ─</span>
        <span style="font-size:14px;color:${tier.accent};margin:0 8px;">${tier.icon}</span>
        <span style="font-size:6px;letter-spacing:4px;color:#ccc;">─ ─ ──</span>
      </div>

      <!-- Gift Card Visual -->
      <div class="fi d3" style="padding:32px 40px;text-align:center;">
        <div style="display:inline-block;width:320px;max-width:100%;border-radius:12px;background:${tier.cardBg};box-shadow:0 24px 64px rgba(0,0,0,0.35);position:relative;overflow:hidden;animation:breathe 4s ease-in-out infinite;">
          <!-- Shimmer -->
          <div style="position:absolute;inset:0;background:linear-gradient(110deg,transparent 20%,rgba(255,255,255,0.02) 30%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.02) 70%,transparent 80%);background-size:250% 100%;animation:shimmer 4s ease-in-out infinite;pointer-events:none;"></div>
          <!-- Diagonal Gold Line -->
          <div style="position:absolute;top:0;right:0;width:120px;height:120px;background:linear-gradient(135deg, transparent 45%, ${tier.accent}08 50%, transparent 55%);pointer-events:none;"></div>

          <div style="position:relative;padding:28px 24px;">
            <!-- Card Top -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
              <div style="text-align:left;">
                <div style="font-size:8px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.35);">Pet Wash™</div>
                <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${tier.accent};">E-Gift</div>
              </div>
              <div style="font-size:22px;color:${tier.accent};animation:float 3s ease-in-out infinite;">${tier.icon}</div>
            </div>

            <!-- Value Display -->
            <div style="text-align:center;margin-bottom:20px;">
              <div style="font-size:48px;font-weight:200;color:${tier.accent};font-family:Georgia,'Times New Roman',serif;letter-spacing:-1px;text-shadow:0 2px 20px ${tier.accent}30;">
                ${formattedValue}
              </div>
              <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-top:4px;">
                ${tierName}
              </div>
            </div>

            <!-- Recipient -->
            <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:14px;margin-bottom:12px;">
              <div style="font-size:14px;font-weight:300;color:rgba(255,255,255,0.8);letter-spacing:2px;text-transform:uppercase;">
                ${recipientName.toUpperCase()}
              </div>
            </div>

            <!-- Card Footer -->
            <div style="font-size:8px;color:rgba(255,255,255,0.2);letter-spacing:0.5px;">
              SN: ${serialNumber}
            </div>
          </div>
        </div>
      </div>

      <!-- Activation Code Section -->
      <div class="fi d3" style="padding:28px 40px;text-align:center;background:#faf9f7;border-top:1px solid #f0ede8;border-bottom:1px solid #f0ede8;">
        <div style="font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#bbb;margin-bottom:16px;">
          ${isHe ? 'קוד ההפעלה שלך' : 'Your Activation Code'}
        </div>
        <div style="display:inline-block;padding:16px 40px;border:1px solid ${tier.accent};border-radius:2px;background:white;">
          <span style="font-size:28px;font-weight:300;letter-spacing:8px;color:#1a1a1a;font-family:'Courier New',monospace;">
            ${giftCode}
          </span>
        </div>
        <p style="font-size:10px;color:#bbb;margin:12px 0 0;letter-spacing:0.5px;">
          ${isHe ? 'שמור את הקוד הזה — הוא המפתח שלך' : 'Keep this code safe — it is your key'}
        </p>
      </div>

      ${personalMessage ? `
      <!-- Personal Message - Handwritten Feel -->
      <div class="fi d4" style="padding:28px 40px;background:white;">
        <div style="text-align:center;margin-bottom:16px;">
          <span style="font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#bbb;">
            ${isHe ? 'הודעה אישית' : 'Personal Note'}
          </span>
        </div>
        <div style="padding:24px;background:#faf9f7;border-radius:4px;border-${dir === 'rtl' ? 'right' : 'left'}:3px solid ${tier.accent};">
          <p style="font-size:15px;color:#555;margin:0;line-height:1.8;font-style:italic;font-family:Georgia,'Times New Roman',serif;">
            &ldquo;${personalMessage}&rdquo;
          </p>
          <p style="font-size:11px;color:#bbb;margin:14px 0 0;text-align:${alignOpp};letter-spacing:1px;">
            — ${senderName}
          </p>
        </div>
      </div>` : ''}

      <!-- Gift Details Table -->
      <div class="fi d4" style="padding:28px 40px;background:white;border-top:1px solid #f5f3ef;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#bbb;">
            ${isHe ? 'פרטי כרטיס המתנה' : 'Gift Card Details'}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr style="border-bottom:1px solid #f5f3ef;">
            <td style="padding:13px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'מאת' : 'From'}</td>
            <td style="padding:13px 0;color:#1a1a1a;text-align:${alignOpp};font-weight:500;">${senderName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f5f3ef;">
            <td style="padding:13px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'סכום' : 'Value'}</td>
            <td style="padding:13px 0;color:#1a1a1a;text-align:${alignOpp};font-weight:600;font-size:15px;">${formattedValue}</td>
          </tr>
          <tr style="border-bottom:1px solid #f5f3ef;">
            <td style="padding:13px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'קולקציה' : 'Collection'}</td>
            <td style="padding:13px 0;text-align:${alignOpp};">
              <span style="display:inline-block;padding:3px 14px;border:1px solid ${tier.accent};border-radius:2px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${tier.accent};">
                ${tier.icon} ${tierName}
              </span>
            </td>
          </tr>
          <tr style="border-bottom:1px solid #f5f3ef;">
            <td style="padding:13px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'מספר סידורי' : 'Serial No.'}</td>
            <td style="padding:13px 0;color:#1a1a1a;text-align:${alignOpp};font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;">${serialNumber}</td>
          </tr>
          <tr>
            <td style="padding:13px 0;color:#999;letter-spacing:0.5px;">${isHe ? 'תוקף עד' : 'Valid Until'}</td>
            <td style="padding:13px 0;color:#1a1a1a;text-align:${alignOpp};">${expiresAt}</td>
          </tr>
        </table>
      </div>

      <!-- Redeemable Platforms -->
      <div class="fi d5" style="padding:20px 40px;background:#faf9f7;border-top:1px solid #f0ede8;">
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

      <!-- CTA Button -->
      <div class="fi d5" style="padding:40px;text-align:center;background:white;border-top:1px solid #f0ede8;">
        <p style="font-size:13px;color:#888;margin:0 0 24px;line-height:1.7;max-width:360px;display:inline-block;">
          ${isHe
            ? 'הפעל את כרטיס המתנה שלך ותיהנה מכל שירותי הפרימיום של Pet Wash™'
            : 'Activate your gift card and enjoy the full Pet Wash™ premium experience'}
        </p>
        <div>
          <a href="https://petwash.co.il/gift-cards/activate?code=${giftCode}" style="display:inline-block;padding:16px 52px;border:1px solid #1a1a1a;color:#1a1a1a;text-decoration:none;font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:500;">
            ${isHe ? 'הפעלת כרטיס מתנה' : 'Activate Gift Card'}
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#1a1a1a;padding:32px 40px;text-align:center;">
        <div style="font-size:7px;letter-spacing:6px;text-transform:uppercase;color:${tier.accent};margin-bottom:16px;">
          ${tier.ornament} &nbsp; ${tier.ornament} &nbsp; ${tier.ornament}
        </div>
        <p style="font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 8px;line-height:1.6;letter-spacing:0.5px;">
          ${isHe ? 'נשלח באהבה דרך Pet Wash™' : 'Sent with love via Pet Wash™'}
        </p>
        <p style="font-size:10px;color:rgba(255,255,255,0.25);margin:0 0 16px;">
          <a href="https://petwash.co.il" style="color:${tier.accent};text-decoration:none;letter-spacing:1px;">petwash.co.il</a>
          <span style="margin:0 8px;color:rgba(255,255,255,0.1);">|</span>
          <a href="mailto:Support@PetWash.co.il" style="color:rgba(255,255,255,0.35);text-decoration:none;">Support@PetWash.co.il</a>
        </p>
        <div style="width:30px;height:1px;background:rgba(255,255,255,0.1);margin:0 auto 16px;"></div>
        <p style="font-size:9px;color:rgba(255,255,255,0.15);margin:0;letter-spacing:1px;">
          &copy; ${new Date().getFullYear()} Pet Wash™ Ltd. ${isHe ? 'כל הזכויות שמורות.' : 'All rights reserved.'}
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
