import { PETWASH_LOGO_BASE64 } from './logo-base64';

interface MembershipConfirmationParams {
  firstName: string;
  email: string;
  membershipId: string;
  tier: string;
  points: number;
  language: 'he' | 'en';
}

const TIER_CONFIG: Record<string, { en: string; he: string; gradient: string; icon: string; textColor: string; cardGradient: string; accentColor: string; glowColor: string; ornament: string }> = {
  bronze: {
    en: 'Bronze', he: 'ארד',
    gradient: 'linear-gradient(145deg, #B87333, #CD7F32, #DEB887)',
    icon: '✦',
    textColor: '#8B6914',
    cardGradient: 'linear-gradient(145deg, #2C1810, #4A2C1A, #6B3A20)',
    accentColor: '#D4A574',
    glowColor: 'rgba(205, 127, 50, 0.4)',
    ornament: '◆'
  },
  silver: {
    en: 'Silver', he: 'כסף',
    gradient: 'linear-gradient(145deg, #A8A8A8, #C0C0C0, #E8E8E8)',
    icon: '✧',
    textColor: '#5A5A5A',
    cardGradient: 'linear-gradient(145deg, #1A1D21, #2A2D31, #3A3D41)',
    accentColor: '#C0C0C0',
    glowColor: 'rgba(192, 192, 192, 0.4)',
    ornament: '◇'
  },
  gold: {
    en: 'Gold', he: 'זהב',
    gradient: 'linear-gradient(145deg, #C9A96E, #D4AF37, #F0D68A)',
    icon: '✦',
    textColor: '#8B7536',
    cardGradient: 'linear-gradient(145deg, #1A1408, #2A2210, #3A3018)',
    accentColor: '#C9A96E',
    glowColor: 'rgba(201, 169, 110, 0.5)',
    ornament: '❖'
  },
  platinum: {
    en: 'Platinum', he: 'פלטינום',
    gradient: 'linear-gradient(145deg, #D4D0C8, #E5E4E2, #F0EFED)',
    icon: '◈',
    textColor: '#6B6B6B',
    cardGradient: 'linear-gradient(145deg, #18181B, #27272A, #3F3F46)',
    accentColor: '#E5E4E2',
    glowColor: 'rgba(229, 228, 226, 0.4)',
    ornament: '◆'
  },
  diamond: {
    en: 'Diamond', he: 'יהלום',
    gradient: 'linear-gradient(145deg, #A8D8EA, #B9F2FF, #E0F7FA)',
    icon: '◇',
    textColor: '#1E6B8A',
    cardGradient: 'linear-gradient(145deg, #0A1628, #142338, #1E3048)',
    accentColor: '#7EC8E3',
    glowColor: 'rgba(126, 200, 227, 0.5)',
    ornament: '◇'
  },
  emerald: {
    en: 'Emerald', he: 'אמרלד',
    gradient: 'linear-gradient(145deg, #2E8B57, #50C878, #76D7A0)',
    icon: '❋',
    textColor: '#1B5E20',
    cardGradient: 'linear-gradient(145deg, #0A1A10, #142A1A, #1E3A24)',
    accentColor: '#50C878',
    glowColor: 'rgba(80, 200, 120, 0.4)',
    ornament: '✿'
  },
  royal: {
    en: '7-Star Royal', he: 'רויאל 7 כוכבים',
    gradient: 'linear-gradient(145deg, #4B0082, #8B008B, #BA55D3)',
    icon: '♛',
    textColor: '#4B0082',
    cardGradient: 'linear-gradient(145deg, #0D0015, #1A0030, #2D004D)',
    accentColor: '#BA55D3',
    glowColor: 'rgba(186, 85, 211, 0.5)',
    ornament: '♛'
  },
};

export function generateMembershipConfirmationEmail(params: MembershipConfirmationParams): { subject: string; html: string } {
  const { firstName, email, membershipId, tier, points, language } = params;
  const isHe = language === 'he';
  const dir = isHe ? 'rtl' : 'ltr';
  const align = isHe ? 'right' : 'left';
  const alignOpp = isHe ? 'left' : 'right';
  const t = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const tierName = isHe ? t.he : t.en;
  const joinDate = new Date().toLocaleDateString(isHe ? 'he-IL' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const subject = isHe
    ? `${t.icon} ברוכים הבאים למועדון Pet Wash Privilege™ — דרגת ${tierName}`
    : `${t.icon} Welcome to Pet Wash Privilege™ — ${tierName} Tier`;

  const html = `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>    .fi { animation: fadeIn 0.8s ease both; }
    .d1 { animation-delay:0.1s; } .d2 { animation-delay:0.2s; } .d3 { animation-delay:0.3s; } .d4 { animation-delay:0.4s; } .d5 { animation-delay:0.5s; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:20px 12px;">

    <!-- Outer Frame with Art Deco Border -->
    <div style="border:1px solid #e0dbd3;border-radius:2px;overflow:hidden;background:white;">

      <!-- Top Ornamental Bar -->
      <div class="fi" style="background:#1a1a1a;padding:6px 0;text-align:center;">
        <span style="font-size:8px;letter-spacing:8px;color:${t.accentColor};text-transform:uppercase;">
          ${t.ornament} &nbsp; Pet Wash Privilege™ &nbsp; ${t.ornament}
        </span>
      </div>

      <!-- Logo Section - Maison Style -->
      <div class="fi d1" style="padding:40px 40px 20px;text-align:center;background:white;">
        <img src="${PETWASH_LOGO_BASE64}" alt="Pet Wash™" style="max-width:140px;height:auto;" />
        <div style="margin-top:16px;font-size:9px;letter-spacing:6px;text-transform:uppercase;color:#999;">
          ${isHe ? 'מועדון חברים יוקרתי' : 'Exclusive Members Club'}
        </div>
        <div style="width:40px;height:1px;background:${t.accentColor};margin:16px auto 0;"></div>
      </div>

      <!-- Hero Welcome -->
      <div class="fi d2" style="padding:32px 40px;text-align:center;">
        <div style="font-size:11px;letter-spacing:5px;text-transform:uppercase;color:${t.accentColor};margin-bottom:16px;">
          ${isHe ? 'ברוכים הבאים' : 'Welcome'}
        </div>
        <h1 style="font-size:32px;font-weight:300;color:#1a1a1a;margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.5px;line-height:1.2;">
          ${firstName}
        </h1>
        <p style="font-size:14px;color:#888;margin:0;line-height:1.7;max-width:400px;display:inline-block;">
          ${isHe
            ? 'חברותך במועדון היוקרה הבלעדי של Pet Wash™ מאושרת. עולם של פריבילגיות מחכה לך.'
            : 'Your place in the exclusive Pet Wash™ Privilege Club is confirmed. A world of distinction awaits.'}
        </p>
      </div>

      <!-- Divider Ornament -->
      <div style="text-align:center;padding:0 40px;">
        <div style="display:inline-block;">
          <span style="font-size:6px;letter-spacing:4px;color:#ccc;">── ─ ─</span>
          <span style="font-size:14px;color:${t.accentColor};margin:0 8px;">${t.icon}</span>
          <span style="font-size:6px;letter-spacing:4px;color:#ccc;">─ ─ ──</span>
        </div>
      </div>

      <!-- Membership Card - Noir Luxe -->
      <div class="fi d3" style="padding:32px 40px;text-align:center;">
        <div style="display:inline-block;width:320px;max-width:100%;border-radius:12px;background:${t.cardGradient};box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative;overflow:hidden;animation:breathe 4s ease-in-out infinite;">
          <!-- Shimmer Overlay -->
          <div style="position:absolute;inset:0;background:linear-gradient(110deg,transparent 25%,rgba(255,255,255,0.04) 35%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 65%,transparent 75%);background-size:250% 100%;animation:shimmer 4s ease-in-out infinite;pointer-events:none;"></div>
          
          <!-- Card Content -->
          <div style="position:relative;padding:28px 24px 24px;">
            <!-- Card Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
              <div style="text-align:left;">
                <div style="font-size:8px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Pet Wash™</div>
                <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${t.accentColor};">Privilege</div>
              </div>
              <div style="font-size:24px;color:${t.accentColor};animation:float 3s ease-in-out infinite;">${t.icon}</div>
            </div>

            <!-- Tier Badge -->
            <div style="text-align:center;margin-bottom:20px;">
              <div style="display:inline-block;padding:6px 28px;border:1px solid ${t.accentColor}50;border-radius:2px;">
                <span style="font-size:14px;letter-spacing:6px;text-transform:uppercase;color:${t.accentColor};font-weight:300;">
                  ${tierName}
                </span>
              </div>
            </div>

            <!-- Member Name -->
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;margin-bottom:16px;">
              <div style="font-size:16px;font-weight:300;color:rgba(255,255,255,0.9);letter-spacing:3px;text-transform:uppercase;">
                ${firstName.toUpperCase()}
              </div>
            </div>

            <!-- Card Footer -->
            <div style="display:flex;justify-content:space-between;align-items:flex-end;">
              <div>
                <div style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:2px;">Member Since</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:0.5px;">${joinDate}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:2px;">ID</div>
                <div style="font-size:9px;color:rgba(255,255,255,0.5);font-family:'Courier New',monospace;letter-spacing:1px;">${membershipId}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Points Display -->
        <div style="margin-top:24px;">
          <div style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#bbb;margin-bottom:8px;">
            ${isHe ? 'נקודות פריבילגיה' : 'Privilege Points'}
          </div>
          <div style="font-size:36px;font-weight:200;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;letter-spacing:2px;">
            ${points.toLocaleString()}
          </div>
          <div style="font-size:10px;color:${t.accentColor};letter-spacing:2px;margin-top:2px;">
            ${isHe ? 'זמינות מיידית' : 'Available Now'}
          </div>
        </div>
      </div>

      <!-- Elegant Divider -->
      <div style="padding:0 60px;">
        <div style="height:1px;background:linear-gradient(90deg, transparent, #ddd, transparent);"></div>
      </div>

      <!-- Benefits Section - Haute Couture Style -->
      <div class="fi d4" style="padding:32px 40px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#bbb;">
            ${isHe ? 'הפריבילגיות שלך' : 'Your Privileges'}
          </div>
        </div>

        <!-- Benefit Items - Fashion House Style -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:16px 0;border-bottom:1px solid #f5f3ef;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:44px;vertical-align:top;">
                  <div style="width:36px;height:36px;border-radius:50%;background:#faf8f5;border:1px solid #eee;text-align:center;line-height:36px;font-size:16px;">✨</div>
                </td>
                <td style="vertical-align:top;padding-${isHe ? 'right' : 'left'}:14px;">
                  <div style="font-size:13px;font-weight:600;color:#1a1a1a;letter-spacing:0.3px;">${isHe ? 'נקודות בונוס ברוכים הבאים' : 'Welcome Bonus Reward'}</div>
                  <div style="font-size:11px;color:#999;margin-top:3px;line-height:1.5;">${isHe ? `${points} נקודות כבר בחשבון הפריבילגיה שלך` : `${points} points already credited to your Privilege account`}</div>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0;border-bottom:1px solid #f5f3ef;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:44px;vertical-align:top;">
                  <div style="width:36px;height:36px;border-radius:50%;background:#faf8f5;border:1px solid #eee;text-align:center;line-height:36px;font-size:16px;">🌟</div>
                </td>
                <td style="vertical-align:top;padding-${isHe ? 'right' : 'left'}:14px;">
                  <div style="font-size:13px;font-weight:600;color:#1a1a1a;letter-spacing:0.3px;">${isHe ? 'מערכת 7 כוכבים' : '7-Star Ascension'}</div>
                  <div style="font-size:11px;color:#999;margin-top:3px;line-height:1.5;">${isHe ? 'עלה בדרגות מארד ועד רויאל — כל דרגה פותחת הטבות בלעדיות' : 'Rise from Bronze to Royal — each tier unlocks exclusive privileges'}</div>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0;border-bottom:1px solid #f5f3ef;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:44px;vertical-align:top;">
                  <div style="width:36px;height:36px;border-radius:50%;background:#faf8f5;border:1px solid #eee;text-align:center;line-height:36px;font-size:16px;">🐾</div>
                </td>
                <td style="vertical-align:top;padding-${isHe ? 'right' : 'left'}:14px;">
                  <div style="font-size:13px;font-weight:600;color:#1a1a1a;letter-spacing:0.3px;">${isHe ? 'צבירה בכל הפלטפורמות' : 'Earn Across All Maisons'}</div>
                  <div style="font-size:11px;color:#999;margin-top:3px;line-height:1.5;">${isHe ? 'K9000 · סיטר סוויט · ווק מיי פט · אקדמיה · פלאש לאב · ווש האב' : 'K9000 · Sitter Suite · Walk My Pet · Academy · Plush Lab · Wash Hub'}</div>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:44px;vertical-align:top;">
                  <div style="width:36px;height:36px;border-radius:50%;background:#faf8f5;border:1px solid #eee;text-align:center;line-height:36px;font-size:16px;">💝</div>
                </td>
                <td style="vertical-align:top;padding-${isHe ? 'right' : 'left'}:14px;">
                  <div style="font-size:13px;font-weight:600;color:#1a1a1a;letter-spacing:0.3px;">${isHe ? 'הפתעות וחוויות VIP' : 'VIP Surprises & Experiences'}</div>
                  <div style="font-size:11px;color:#999;margin-top:3px;line-height:1.5;">${isHe ? 'מתנות יום הולדת, אירועים בלעדיים וחוויות שמורות לחברים' : 'Birthday gifts, exclusive events, and members-only experiences'}</div>
                </td>
              </tr></table>
            </td>
          </tr>
        </table>
      </div>

      <!-- Membership Details - Minimalist Luxury Table -->
      <div class="fi d4" style="background:#faf9f7;padding:28px 40px;border-top:1px solid #f0ede8;border-bottom:1px solid #f0ede8;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#bbb;">
            ${isHe ? 'פרטי החברות' : 'Membership Details'}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="border-bottom:1px solid #ece9e4;">
            <td style="padding:14px 0;color:#999;font-size:12px;letter-spacing:0.5px;">${isHe ? 'תוכנית' : 'Programme'}</td>
            <td style="padding:14px 0;color:#1a1a1a;text-align:${alignOpp};font-weight:500;font-size:12px;letter-spacing:0.5px;">Pet Wash Privilege™</td>
          </tr>
          <tr style="border-bottom:1px solid #ece9e4;">
            <td style="padding:14px 0;color:#999;font-size:12px;letter-spacing:0.5px;">${isHe ? 'דרגה' : 'Tier'}</td>
            <td style="padding:14px 0;text-align:${alignOpp};">
              <span style="display:inline-block;padding:4px 16px;border:1px solid ${t.accentColor};border-radius:2px;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:${t.textColor};">
                ${t.icon} ${tierName}
              </span>
            </td>
          </tr>
          <tr style="border-bottom:1px solid #ece9e4;">
            <td style="padding:14px 0;color:#999;font-size:12px;letter-spacing:0.5px;">${isHe ? 'מזהה חבר' : 'Member No.'}</td>
            <td style="padding:14px 0;color:#1a1a1a;text-align:${alignOpp};font-family:'Courier New',monospace;font-size:11px;letter-spacing:1.5px;">${membershipId}</td>
          </tr>
          <tr style="border-bottom:1px solid #ece9e4;">
            <td style="padding:14px 0;color:#999;font-size:12px;letter-spacing:0.5px;">${isHe ? 'דוא"ל' : 'Email'}</td>
            <td style="padding:14px 0;color:#1a1a1a;text-align:${alignOpp};font-size:12px;">${email}</td>
          </tr>
          <tr>
            <td style="padding:14px 0;color:#999;font-size:12px;letter-spacing:0.5px;">${isHe ? 'תאריך הצטרפות' : 'Member Since'}</td>
            <td style="padding:14px 0;color:#1a1a1a;text-align:${alignOpp};font-size:12px;">${joinDate}</td>
          </tr>
        </table>
      </div>

      <!-- CTA Button - Haute Style -->
      <div class="fi d5" style="padding:40px;text-align:center;background:white;">
        <a href="https://petwash.co.il/loyalty" style="display:inline-block;padding:16px 52px;border:1px solid #1a1a1a;color:#1a1a1a;text-decoration:none;font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:500;transition:all 0.3s;">
          ${isHe ? 'כניסה למועדון' : 'Enter Your Club'}
        </a>
        <p style="font-size:11px;color:#bbb;margin:16px 0 0;letter-spacing:0.5px;">
          ${isHe ? 'petwash.co.il/loyalty' : 'petwash.co.il/loyalty'}
        </p>
      </div>

      <!-- Footer - Maison Style -->
      <div style="background:#1a1a1a;padding:32px 40px;text-align:center;">
        <div style="font-size:7px;letter-spacing:6px;text-transform:uppercase;color:${t.accentColor};margin-bottom:16px;">
          ${t.ornament} &nbsp; ${t.ornament} &nbsp; ${t.ornament}
        </div>
        <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:0 0 8px;line-height:1.6;letter-spacing:0.5px;">
          ${isHe ? 'תודה שהצטרפת למשפחת Pet Wash™ Privilege' : 'Thank you for joining the Pet Wash™ Privilege family'}
        </p>
        <p style="font-size:10px;color:rgba(255,255,255,0.3);margin:0 0 16px;">
          <a href="https://petwash.co.il" style="color:${t.accentColor};text-decoration:none;letter-spacing:1px;">petwash.co.il</a>
          <span style="margin:0 8px;color:rgba(255,255,255,0.15);">|</span>
          <a href="mailto:Support@PetWash.co.il" style="color:rgba(255,255,255,0.4);text-decoration:none;">Support@PetWash.co.il</a>
        </p>
        <div style="width:30px;height:1px;background:rgba(255,255,255,0.1);margin:0 auto 16px;"></div>
        <p style="font-size:9px;color:rgba(255,255,255,0.2);margin:0;letter-spacing:1px;">
          &copy; ${new Date().getFullYear()} Pet Wash™ Ltd. ${isHe ? 'כל הזכויות שמורות.' : 'All rights reserved.'}
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
