/**
 * Partner Invitation Email Template - 2025
 * Beautiful, professional invitation for external partners
 */

interface PartnerInvitationData {
  partnerName: string;
  partnerEmail: string;
  role: string;
  presentationUrl: string;
  language?: 'he' | 'en';
}

export function generatePartnerInvitation(data: PartnerInvitationData): { subject: string; html: string } {
  const { partnerName, role, presentationUrl } = data;

  const subject = `🚀 Pet Wash™ Investor Presentation - Exclusive Access for ${partnerName}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pet Wash™ - Partner Invitation</title>
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
          Exclusive Investor Presentation Access
        </p>
      </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
      <td style="padding: 50px 40px 30px 40px;">
        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 28px; font-weight: 700;">
          Dear ${partnerName},
        </h2>
        <p style="margin: 0 0 20px 0; color: #333; font-size: 17px; line-height: 1.7;">
          We're delighted to share our comprehensive investor presentation with you! As our valued 
          <strong style="color: #667eea;">${role}</strong>, you're an essential part of the Pet Wash™ family.
        </p>
        <p style="margin: 0 0 20px 0; color: #333; font-size: 17px; line-height: 1.7;">
          Working alongside <strong>Nir Hadad</strong> and <strong>Ido Shakarzi</strong>, your expertise in 
          <strong>installations, construction, compliance, and regulations</strong> has been invaluable to our success.
        </p>
        <p style="margin: 0 0 20px 0; color: #333; font-size: 17px; line-height: 1.7;">
          We appreciate your talent, dedication, and the amazing work you do. You're a wonderful person and 
          we're fortunate to have you as part of our team! 💙
        </p>
      </td>
    </tr>

    <!-- Presentation Highlights -->
    <tr>
      <td style="padding: 0 40px 30px 40px;">
        <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 16px; padding: 30px; margin-bottom: 30px;">
          <h3 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 22px; font-weight: 700;">
            📊 What's Inside the Presentation:
          </h3>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 10px 0;">
                <span style="color: #667eea; font-size: 20px; margin-right: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">Years of R&D Investment</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0;">
                <span style="color: #667eea; font-size: 20px; margin-right: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">12 Technology Platforms (AI, IoT, Cloud, Banking, etc.)</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0;">
                <span style="color: #667eea; font-size: 20px; margin-right: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">CE-Certified K9000 Hardware Specifications</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0;">
                <span style="color: #667eea; font-size: 20px; margin-right: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">Market Analysis & Growth Opportunity</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0;">
                <span style="color: #667eea; font-size: 20px; margin-right: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">Competitive Advantages & Trust Factors</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0;">
                <span style="color: #667eea; font-size: 20px; margin-right: 10px;">✅</span>
                <span style="color: #333; font-size: 16px; font-weight: 500;">Global Expansion Vision</span>
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
          🚀 VIEW INVESTOR PRESENTATION
        </a>
        <p style="margin: 20px 0 0 0; color: #666; font-size: 14px;">
          View-only access • No login required
        </p>
      </td>
    </tr>

    <!-- Additional Info -->
    <tr>
      <td style="padding: 0 40px 40px 40px;">
        <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; color: #333; font-size: 15px; line-height: 1.6;">
            <strong>📍 Direct Link:</strong><br>
            <a href="${presentationUrl}" style="color: #667eea; text-decoration: none; word-break: break-all;">
              ${presentationUrl}
            </a>
          </p>
          <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
            Feel free to share this with anyone you think should see it!
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
          Company #517145033 • Israel 🇮🇱
        </p>
        <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.7); font-size: 14px;">
          8 Uzi Chitman St, Rosh HaAyin
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
          Thank you for being an amazing part of our journey! 🙏
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
