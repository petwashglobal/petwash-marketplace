/**
 * Partner Invitation Email Template - Hebrew Version 2025
 * Beautiful, personal invitation in Hebrew with English brand touches
 */

interface PartnerInvitationHebrewData {
  partnerName: string;
  partnerEmail: string;
  role: string;
  presentationUrl: string;
}

export function generatePartnerInvitationHebrew(data: PartnerInvitationHebrewData): { subject: string; html: string } {
  const { partnerName, role, presentationUrl } = data;

  const subject = `🚀 ⁦Pet Wash™⁩ - מצגת משקיעים בלעדית עבור ${partnerName}`;

  const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⁦Pet Wash™⁩ - הזמנה לשותף</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
  
  <!-- Main Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 680px; margin: 40px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
    
    <!-- Header with Gradient -->
    <tr>
      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); padding: 50px 40px; text-align: center;">
        <div style="font-size: 60px; margin-bottom: 20px;">🐾</div>
        <h1 style="margin: 0; color: white; font-size: 42px; font-weight: 900; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">
          PET WASH™
        </h1>
        <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.95); font-size: 18px; font-weight: 500;">
          גישה בלעדית למצגת המשקיעים
        </p>
      </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
      <td style="padding: 50px 40px 30px 40px; text-align: right;">
        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 28px; font-weight: 700;">
          ${partnerName} היקר,
        </h2>
        <p style="margin: 0 0 20px 0; color: #333; font-size: 17px; line-height: 1.8;">
          אנחנו שמחים מאוד לשתף אותך במצגת המשקיעים המקיפה שלנו! בתור 
          <strong style="color: #667eea;">${role}</strong> שלנו, אתה חלק חשוב ומרכזי במשפחת ⁦Pet Wash™⁩.
        </p>
        <p style="margin: 0 0 20px 0; color: #333; font-size: 17px; line-height: 1.8;">
          העבודה שלך יחד עם <strong>ניר חדד</strong> ו-<strong>עידו שקרזי</strong>, המומחיות שלך ב-<strong>התקנות, בנייה, תאימות ורגולציה</strong> - תרומתך לא תסולא בפז.
        </p>
        <p style="margin: 0 0 20px 0; color: #333; font-size: 17px; line-height: 1.8;">
          אנחנו מעריכים את הכישרון, המסירות והעבודה המדהימה שלך. אתה אדם נפלא ואנחנו בני מזל שאתה חלק מהצוות! 💙
        </p>
      </td>
    </tr>

    <!-- Presentation Highlights -->
    <tr>
      <td style="padding: 0 40px 30px 40px;">
        <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 16px; padding: 30px; margin-bottom: 30px;">
          <h3 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 22px; font-weight: 700; text-align: right;">
            📊 מה כלול במצגת:
          </h3>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" dir="rtl">
            <tr>
              <td style="padding: 10px 0; text-align: right;">
                <span style="color: #667eea; font-size: 20px; margin-left: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">שנים של השקעה במחקר ופיתוח (R&D)</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; text-align: right;">
                <span style="color: #667eea; font-size: 20px; margin-left: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">12 פלטפורמות טכנולוגיה (AI, IoT, Cloud, Banking ועוד)</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; text-align: right;">
                <span style="color: #667eea; font-size: 20px; margin-left: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">מפרט ציוד K9000 מוסמך CE</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; text-align: right;">
                <span style="color: #667eea; font-size: 20px; margin-left: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">ניתוח שוק והזדמנויות צמיחה</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; text-align: right;">
                <span style="color: #667eea; font-size: 20px; margin-left: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">יתרונות תחרותיים וגורמי אמון</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; text-align: right;">
                <span style="color: #667eea; font-size: 20px; margin-left: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">חזון התרחבות עולמית</span>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- CTA Button -->
    <tr>
      <td style="padding: 0 40px 40px 40px; text-align: center;">
        <a href="${presentationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 18px 50px; border-radius: 50px; font-size: 18px; font-weight: 700; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
          🚀 צפה במצגת המשקיעים
        </a>
        <p style="margin: 20px 0 0 0; color: #666; font-size: 14px;">
          צפייה בלבד • ללא צורך בהתחברות
        </p>
      </td>
    </tr>

    <!-- Additional Info -->
    <tr>
      <td style="padding: 0 40px 40px 40px;">
        <div style="background: #f8f9fa; border-right: 4px solid #667eea; padding: 20px; border-radius: 8px; text-align: right;">
          <p style="margin: 0 0 10px 0; color: #333; font-size: 15px; line-height: 1.6;">
            <strong>📍 קישור ישיר:</strong><br>
            <a href="${presentationUrl}" style="color: #667eea; text-decoration: none; word-break: break-all; direction: ltr; display: inline-block;">
              ${presentationUrl}
            </a>
          </p>
          <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
            מוזמן לשתף את המצגת עם כל מי שלדעתך צריך לראות אותה!
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d3748 100%); padding: 40px; text-align: center;">
        <p style="margin: 0 0 15px 0; color: white; font-size: 20px; font-weight: 700;">
          Pet Wash Ltd (פט וואש בע"מ)
        </p>
        <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.8); font-size: 14px;">
          ח.פ. 517145033 • ישראל 🇮🇱
        </p>
        <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.7); font-size: 14px;">
          רח' עוזי חיטמן 8, ראש העין
        </p>
        <div style="margin: 20px 0;">
          <a href="mailto:Nir.H@PetWash.co.il" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 14px;">
            📧 Nir.H@PetWash.co.il
          </a>
          <span style="color: rgba(255,255,255,0.5);">•</span>
          <a href="https://petwash.co.il" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 14px;">
            🌐 www.petwash.co.il
          </a>
        </div>
        <p style="margin: 20px 0 0 0; color: rgba(255,255,255,0.6); font-size: 13px;">
          תודה שאתה חלק מדהים מהמסע שלנו! 🙏
        </p>
      </td>
    </tr>

  </table>

  <!-- Mobile Optimization -->
  <style>
    @media only screen and (max-width: 600px) {
      h1 { font-size: 32px !important; }
      h2 { font-size: 24px !important; }
      h3 { font-size: 20px !important; }
      p { font-size: 16px !important; }
      td { padding: 30px 20px !important; }
    }
  </style>

</body>
</html>
  `;

  return { subject, html };
}
