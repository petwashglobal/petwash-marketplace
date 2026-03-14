import { PETWASH_LOGO_BASE64 } from './logo-base64';

interface CustomerWelcomeEmailData {
  firstName: string;
  lastName: string;
  email: string;
  language: 'he' | 'en';
  loyaltyTier?: string;
  petType?: string;
}

export function generateCustomerWelcomeEmail(data: CustomerWelcomeEmailData): { subject: string; html: string } {
  const isHebrew = data.language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const joinDate = new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = isHebrew
    ? `\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05DE\u05E9\u05E4\u05D7\u05EA Pet Wash\u2122, ${data.firstName} \u2014 \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA \u05E4\u05E2\u05D9\u05DC`
    : `Welcome to Pet Wash\u2122, ${data.firstName} \u2014 Your Account is Active`;

  const html = `<!DOCTYPE html>
<html lang="${data.language}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Georgia', 'Times New Roman', 'Palatino', serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
    <div style="background: #ffffff; border-radius: 2px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
      
      <div style="background: linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding: 56px 40px; text-align: center; position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #dcc07a, #c9a96e);"></div>
        <img src="${PETWASH_LOGO_BASE64}" alt="Pet Wash\u2122" style="max-width: 150px; height: auto; margin-bottom: 24px;" />
        <h1 style="color: #ffffff; font-size: 28px; font-weight: 400; letter-spacing: 1.5px; margin: 0; font-family: 'Georgia', serif; text-shadow: 0 2px 8px rgba(0,0,0,0.15);">
          ${isHebrew ? '\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05DE\u05E9\u05E4\u05D7\u05D4' : 'Welcome to the Family'}
        </h1>
        <div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 10px; letter-spacing: 3px; text-transform: uppercase;">
          ${isHebrew ? '\u05D8\u05D9\u05E4\u05D5\u05D7 \u05D9\u05D5\u05E7\u05E8\u05EA\u05D9 \u05DC\u05D7\u05D9\u05D5\u05EA \u05DE\u05D7\u05DE\u05D3' : 'Premium Organic Pet Care'}
        </div>
      </div>
      
      <div style="height: 2px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #dcc07a, #e8d5a3, #c9a96e);"></div>
      
      <div style="padding: 52px 44px;">
        <h2 style="font-size: 22px; color: #0f172a; margin: 0 0 28px; font-weight: 400; text-align: ${isHebrew ? 'right' : 'left'}; font-family: 'Georgia', serif;">
          ${isHebrew ? `\u05E9\u05DC\u05D5\u05DD ${data.firstName},` : `Dear ${data.firstName},`}
        </h2>
        
        <p style="font-size: 15px; line-height: 1.9; color: #475569; margin: 0 0 24px; text-align: ${isHebrew ? 'right' : 'left'};">
          ${isHebrew
            ? '\u05EA\u05D5\u05D3\u05D4 \u05E9\u05D4\u05E6\u05D8\u05E8\u05E4\u05EA \u05DC\u05E7\u05D4\u05D9\u05DC\u05EA Pet Wash\u2122. \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA \u05E0\u05D5\u05E6\u05E8 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4 \u05D5\u05DE\u05D5\u05DB\u05DF \u05DC\u05E9\u05D9\u05DE\u05D5\u05E9. \u05D0\u05E0\u05D7\u05E0\u05D5 \u05E9\u05DE\u05D7\u05D9\u05DD \u05DC\u05E7\u05D1\u05DC \u05D0\u05D5\u05EA\u05DA \u05DC\u05E7\u05D4\u05D9\u05DC\u05D4 \u05E9\u05DC\u05E0\u05D5 \u05E9\u05DC \u05D0\u05D5\u05D4\u05D1\u05D9 \u05D7\u05D9\u05D5\u05EA \u05DE\u05D7\u05DE\u05D3.'
            : 'Thank you for joining Pet Wash\u2122. Your account has been successfully created and is ready to use. We\'re delighted to welcome you to our community of pet lovers.'}
        </p>
        
        <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 2px; padding: 28px; margin: 32px 0;">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #0f172a; margin: 0 0 20px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'};">
            ${isHebrew ? '\u05E4\u05E8\u05D8\u05D9 \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF' : 'Account Details'}
          </h3>
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? '\u05E1\u05D5\u05D2 \u05D7\u05E9\u05D1\u05D5\u05DF:' : 'Account Type:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${isHebrew ? '\u05DC\u05E7\u05D5\u05D7' : 'Customer'}</span>
          </div>
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? '\u05E9\u05DD:' : 'Name:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${data.firstName} ${data.lastName}</span>
          </div>
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? '\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC:' : 'Email:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${data.email}</span>
          </div>
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? '\u05EA\u05D0\u05E8\u05D9\u05DA \u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA:' : 'Join Date:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${joinDate}</span>
          </div>
          <div style="padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? '\u05D3\u05E8\u05D2\u05EA \u05E0\u05D0\u05DE\u05E0\u05D5\u05EA:' : 'Loyalty Tier:'}</span>
            <span style="color: #c9a96e; font-weight: 600;">\u2605 ${isHebrew ? '\u05D7\u05D3\u05E9' : 'New Member'}</span>
          </div>
        </div>
        
        <div style="background: linear-gradient(135deg, #fffbf0, #fef7e6); border-${isHebrew ? 'right' : 'left'}: 3px solid #c9a96e; padding: 24px 28px; margin: 32px 0; border-radius: 2px;">
          <h4 style="font-size: 14px; color: #0f172a; margin: 0 0 12px; text-align: ${isHebrew ? 'right' : 'left'}; font-family: 'Georgia', serif; font-weight: 400;">
            ${isHebrew ? '\u05D2\u05D9\u05E9\u05EA \u05D4\u05DC\u05E7\u05D5\u05D7 \u05E9\u05DC\u05DA \u05DB\u05D5\u05DC\u05DC\u05EA:' : 'Your Customer Access Includes:'}
          </h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; padding-${isHebrew ? 'right' : 'left'}: 20px; font-size: 13px; color: #78716c; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #c9a96e; font-weight: bold;">\u2713</span>
              ${isHebrew ? '\u05D4\u05D6\u05DE\u05E0\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9 \u05E9\u05D8\u05D9\u05E4\u05D4 \u05D1\u05EA\u05D7\u05E0\u05D5\u05EA K9000\u2122' : 'Book K9000\u2122 wash station services'}
            </td></tr>
            <tr><td style="padding: 8px 0; padding-${isHebrew ? 'right' : 'left'}: 20px; font-size: 13px; color: #78716c; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #c9a96e; font-weight: bold;">\u2713</span>
              ${isHebrew ? '\u05E8\u05DB\u05D9\u05E9\u05EA \u05D7\u05D1\u05D9\u05DC\u05D5\u05EA \u05E9\u05D8\u05D9\u05E4\u05D4 \u05D5\u05DB\u05E8\u05D8\u05D9\u05E1\u05D9 \u05DE\u05EA\u05E0\u05D4' : 'Purchase wash packages and e-gift cards'}
            </td></tr>
            <tr><td style="padding: 8px 0; padding-${isHebrew ? 'right' : 'left'}: 20px; font-size: 13px; color: #78716c; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #c9a96e; font-weight: bold;">\u2713</span>
              ${isHebrew ? '\u05D4\u05D6\u05DE\u05E0\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9 \u05E9\u05DE\u05E8\u05D8\u05E4\u05D5\u05EA, \u05D8\u05D9\u05D5\u05DC\u05D9\u05DD \u05D5\u05D4\u05E1\u05E2\u05D5\u05EA' : 'Book pet sitting, walking and transport services'}
            </td></tr>
            <tr><td style="padding: 8px 0; padding-${isHebrew ? 'right' : 'left'}: 20px; font-size: 13px; color: #78716c; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #c9a96e; font-weight: bold;">\u2713</span>
              ${isHebrew ? '\u05E6\u05D1\u05D9\u05E8\u05EA \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05E0\u05D0\u05DE\u05E0\u05D5\u05EA \u05D1\u05DB\u05DC \u05E9\u05D9\u05DE\u05D5\u05E9' : 'Earn loyalty points with every use'}
            </td></tr>
            <tr><td style="padding: 8px 0; padding-${isHebrew ? 'right' : 'left'}: 20px; font-size: 13px; color: #78716c; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #c9a96e; font-weight: bold;">\u2713</span>
              ${isHebrew ? '\u05E0\u05D9\u05D4\u05D5\u05DC \u05D4\u05D7\u05D9\u05D5\u05EA \u05E9\u05DC\u05DA \u05D5\u05E6\u05E4\u05D9\u05D9\u05D4 \u05D1\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D9\u05EA \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA' : 'Manage your pets and view booking history'}
            </td></tr>
          </table>
          <p style="margin-top: 16px; font-size: 13px; font-style: italic; color: #94a3b8; text-align: ${isHebrew ? 'right' : 'left'};">
            ${isHebrew
              ? '\u05DE\u05E2\u05D5\u05E0\u05D9\u05D9\u05DF \u05DC\u05D4\u05E6\u05D9\u05E2 \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD? \u05D4\u05D2\u05E9 \u05D1\u05E7\u05E9\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA \u05E0\u05D5\u05EA\u05DF \u05E9\u05D9\u05E8\u05D5\u05EA \u05D5\u05EA\u05E7\u05D1\u05DC \u05D2\u05D9\u05E9\u05D4 \u05DC\u05DC\u05D5\u05D7 \u05D1\u05E7\u05E8\u05D4 \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9.'
              : 'Interested in offering services? Apply to become a provider and unlock your professional dashboard.'}
          </p>
        </div>
        
        <!-- ══ PRESTIGE PASS WALLET SECTION ══ -->
        <div style="background: #0a0a0a; border-radius: 16px; padding: 28px 28px 24px; margin: 32px 0; text-align: center;">

          <!-- Gold top line -->
          <div style="height: 2px; background: linear-gradient(90deg, transparent, #8a6f00 20%, #D4AF37 38%, #F0D060 50%, #D4AF37 62%, #8a6f00 80%, transparent); border-radius: 1px; margin-bottom: 22px;"></div>

          <div style="font-size: 9px; letter-spacing: 6px; color: #D4AF37; text-transform: uppercase; margin-bottom: 4px; font-family: 'Helvetica Neue', Arial, sans-serif;">P E T W A S H ™</div>
          <div style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 6px 0 4px; font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.3px;">
            ${isHebrew ? 'הכרטיס הדיגיטלי שלך מוכן' : 'Your Digital Member Pass is Ready'}
          </div>
          <div style="font-size: 11px; color: #3a3a3a; margin-bottom: 20px; font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.5px;">
            ${isHebrew ? 'שמור לארנק שלך — גישה מיידית בכל תחנת K9000' : 'Save to your wallet — instant access at every K9000 station'}
          </div>

          <!-- Wallet badges side by side -->
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
            <tr>
              <td style="padding: 0 6px 0 0;">
                <!-- Apple Wallet badge -->
                <a href="https://petwash.co.il/prestige-pass" target="_blank" style="display:inline-block;text-decoration:none;">
                  <table role="presentation" cellspacing="0" cellpadding="0"
                         style="background:#000000;border-radius:14px;border:1px solid rgba(255,255,255,.12);
                                box-shadow:0 4px 16px rgba(0,0,0,.5);">
                    <tr>
                      <td style="padding:10px 20px 10px 13px;">
                        <table role="presentation" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="vertical-align:middle;padding-right:12px;">
                              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 46 46">
                                <rect width="46" height="46" rx="10" fill="#EDE8E0"/>
                                <rect x="7" y="10" width="32" height="20" rx="3" fill="#F5C842" transform="rotate(-8 23 20)"/>
                                <rect x="7" y="13" width="32" height="20" rx="3" fill="#34C759" transform="rotate(-3 23 23)"/>
                                <rect x="6" y="18" width="34" height="22" rx="4" fill="#FAF7F2"/>
                                <rect x="6" y="24" width="34" height="7" fill="#E8E2D8"/>
                                <rect x="10" y="26" width="14" height="3" rx="1.5" fill="#C8BFB0" opacity=".7"/>
                                <rect x="22" y="19" width="18" height="12" rx="2.5" fill="#FF3B30" opacity=".9" transform="rotate(4 31 25)"/>
                              </svg>
                            </td>
                            <td style="vertical-align:middle;">
                              <div style="font-size:10px;color:rgba(255,255,255,.5);font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.3;">${isHebrew ? 'הוסף ל' : 'Add to'}</div>
                              <div style="font-size:17px;font-weight:700;color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.2;white-space:nowrap;">Apple Wallet</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </a>
              </td>
              <td style="padding: 0 0 0 6px;">
                <!-- Google Wallet badge -->
                <a href="https://petwash.co.il/prestige-pass" target="_blank" style="display:inline-block;text-decoration:none;">
                  <table role="presentation" cellspacing="0" cellpadding="0"
                         style="background:#1c1c1e;border-radius:14px;border:1px solid rgba(255,255,255,.1);
                                box-shadow:0 4px 16px rgba(0,0,0,.45);">
                    <tr>
                      <td style="padding:10px 20px 10px 13px;">
                        <table role="presentation" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="vertical-align:middle;padding-right:12px;">
                              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 46 46">
                                <rect width="46" height="46" rx="10" fill="#1A73E8"/>
                                <rect x="8" y="10" width="30" height="18" rx="3" fill="#34A853" transform="rotate(-10 23 19)"/>
                                <rect x="8" y="14" width="30" height="18" rx="3" fill="#FBBC04" transform="rotate(-4 23 23)"/>
                                <rect x="8" y="18" width="30" height="18" rx="3" fill="#EA4335" transform="rotate(2 23 27)"/>
                                <rect x="7" y="22" width="32" height="18" rx="4" fill="#4285F4"/>
                                <rect x="12" y="27" width="10" height="6" rx="2" fill="#fff" opacity=".25"/>
                                <rect x="12" y="34" width="22" height="2" rx="1" fill="#fff" opacity=".2"/>
                              </svg>
                            </td>
                            <td style="vertical-align:middle;">
                              <div style="font-size:10px;color:rgba(255,255,255,.45);font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.3;">${isHebrew ? 'הוסף ל' : 'Add to'}</div>
                              <div style="font-size:17px;font-weight:700;color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.2;white-space:nowrap;">Google Wallet</div>
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

          <!-- Gold bottom line -->
          <div style="height: 2px; background: linear-gradient(90deg, transparent, #8a6f00 20%, #D4AF37 38%, #F0D060 50%, #D4AF37 62%, #8a6f00 80%, transparent); border-radius: 1px; margin-top: 22px;"></div>
        </div>
        <!-- ══ END PRESTIGE PASS WALLET SECTION ══ -->

        <div style="margin: 36px 0;">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #0f172a; margin: 0 0 24px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'};">
            ${isHebrew ? '\u05D4\u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD \u05E9\u05DC\u05E0\u05D5' : 'Our Services'}
          </h3>
          <table style="width: 100%; border-collapse: separate; border-spacing: 10px;">
            <tr>
              <td style="width: 50%; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 2px; padding: 20px; text-align: center; vertical-align: top;">
                <div style="font-size: 32px; margin-bottom: 10px; filter: saturate(0.8);">\u{1F6BF}</div>
                <div style="font-size: 13px; color: #0f172a; font-weight: 500; letter-spacing: 0.3px;">${isHebrew ? '\u05EA\u05D7\u05E0\u05D5\u05EA K9000\u2122' : 'K9000\u2122 Stations'}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${isHebrew ? '\u05E9\u05D8\u05D9\u05E4\u05D4 \u05E2\u05E6\u05DE\u05D9\u05EA \u05D0\u05D5\u05E8\u05D2\u05E0\u05D9\u05EA' : 'Organic self-wash'}</div>
              </td>
              <td style="width: 50%; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 2px; padding: 20px; text-align: center; vertical-align: top;">
                <div style="font-size: 32px; margin-bottom: 10px; filter: saturate(0.8);">\u{1F3E0}</div>
                <div style="font-size: 13px; color: #0f172a; font-weight: 500; letter-spacing: 0.3px;">${isHebrew ? '\u05E9\u05DE\u05D9\u05E8\u05D4 \u05E2\u05DC \u05D7\u05D9\u05D5\u05EA' : 'Pet Sitting'}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${isHebrew ? '\u05E9\u05DE\u05E8\u05D8\u05E4\u05D9\u05DD \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9\u05D9\u05DD' : 'Professional sitters'}</div>
              </td>
            </tr>
            <tr>
              <td style="width: 50%; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 2px; padding: 20px; text-align: center; vertical-align: top;">
                <div style="font-size: 32px; margin-bottom: 10px; filter: saturate(0.8);">\u{1F415}</div>
                <div style="font-size: 13px; color: #0f172a; font-weight: 500; letter-spacing: 0.3px;">${isHebrew ? '\u05D8\u05D9\u05D5\u05DC\u05D9 \u05DB\u05DC\u05D1\u05D9\u05DD' : 'Dog Walking'}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${isHebrew ? '\u05DE\u05D8\u05D9\u05D9\u05DC\u05D9\u05DD \u05DE\u05D0\u05D5\u05DE\u05EA\u05D9\u05DD' : 'Verified walkers'}</div>
              </td>
              <td style="width: 50%; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 2px; padding: 20px; text-align: center; vertical-align: top;">
                <div style="font-size: 32px; margin-bottom: 10px; filter: saturate(0.8);">\u{1F697}</div>
                <div style="font-size: 13px; color: #0f172a; font-weight: 500; letter-spacing: 0.3px;">${isHebrew ? '\u05D4\u05E1\u05E2\u05D5\u05EA' : 'Pet Transport'}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${isHebrew ? '\u05D4\u05E1\u05E2\u05D5\u05EA \u05D1\u05D8\u05D5\u05D7\u05D5\u05EA' : 'Safe transport'}</div>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="https://petwash.co.il/packages" style="display: inline-block; background: linear-gradient(135deg, #0f172a, #1e293b); color: #e8d5a3; text-decoration: none; padding: 16px 44px; border-radius: 2px; font-size: 14px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; font-family: 'Georgia', serif;">
            ${isHebrew ? '\u05D7\u05D1\u05D9\u05DC\u05D5\u05EA \u05E9\u05D8\u05D9\u05E4\u05D4' : 'Wash Packages'}
          </a>
        </div>
        
        <p style="font-size: 14px; text-align: center; font-style: italic; color: #94a3b8; line-height: 1.8; margin: 32px 0 0; font-family: 'Georgia', serif;">
          ${isHebrew
            ? '\u05D0\u05E0\u05D7\u05E0\u05D5 \u05D0\u05D5\u05D4\u05D1\u05D9\u05DD \u05D0\u05EA \u05D7\u05D9\u05D5\u05EA \u05D4\u05DE\u05D7\u05DE\u05D3 \u05E9\u05DC\u05E0\u05D5, \u05D0\u05D1\u05DC \u05D4\u05DD \u05D0\u05D5\u05D4\u05D1\u05D9\u05DD \u05D0\u05D5\u05EA\u05E0\u05D5 \u05D9\u05D5\u05EA\u05E8.'
            : 'We love our pets, but they actually love us more.'}
        </p>
      </div>
      
      <div style="background: linear-gradient(160deg, #0f172a, #1e293b); padding: 36px 44px; text-align: center;">
        <p style="margin: 0;">
          <a href="https://petwash.co.il" style="color: #e8d5a3; text-decoration: none; font-size: 13px; letter-spacing: 0.5px;">petwash.co.il</a>
          <span style="color: rgba(255,255,255,0.2); margin: 0 8px;">\u2502</span>
          <a href="mailto:Support@PetWash.co.il" style="color: #e8d5a3; text-decoration: none; font-size: 13px;">Support@PetWash.co.il</a>
        </p>
        <p style="color: rgba(255,255,255,0.3); font-size: 11px; line-height: 1.8; margin: 16px 0 0; letter-spacing: 0.5px;">
          \u00A9 ${new Date().getFullYear()} Pet Wash\u2122. ${isHebrew ? '\u05DB\u05DC \u05D4\u05D6\u05DB\u05D5\u05D9\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA' : 'All rights reserved'}.<br>
          ${isHebrew ? '\u05DE\u05E1\u05E4\u05E8 \u05D7\u05D1\u05E8\u05D4' : 'Company No.'} 517145033 \u2502 ${isHebrew ? '\u05E8\u05E9\u05D5\u05DE\u05D4 \u05D1\u05D9\u05E9\u05E8\u05D0\u05DC' : 'Registered in Israel'}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}