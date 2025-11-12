/**
 * Pet Wash™ Launch Invitation Email Template
 * Pure white background with 7-star metallic luxury design
 */

export function generateLaunchInvitationEmail(
  recipientName: string,
  petName: string
): { subject: string; html: string } {
  const subject = `🌟 ${recipientName} & ${petName} - You're Invited to Pet Wash™ Grand Launch!`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pet Wash™ Launch Invitation</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background: #FFFFFF;
      padding: 0;
      margin: 0;
    }
    .container {
      max-width: 700px;
      margin: 0 auto;
      background: #FFFFFF;
    }
    .header {
      text-align: center;
      padding: 60px 40px 40px;
      background: linear-gradient(135deg, #FFFFFF 0%, #F8F9FA 100%);
      border-bottom: 3px solid;
      border-image: linear-gradient(90deg, #C0C0C0, #E8E8E8, #FFFFFF, #E8E8E8, #C0C0C0) 1;
    }
    .logo {
      font-size: 48px;
      font-weight: 900;
      background: linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 25%, #FFFFFF 50%, #E8E8E8 75%, #C0C0C0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
      letter-spacing: 2px;
      margin-bottom: 20px;
    }
    .tagline {
      font-size: 18px;
      color: #888888;
      font-weight: 500;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .content {
      padding: 60px 40px;
      background: #FFFFFF;
    }
    .greeting {
      font-size: 32px;
      font-weight: 700;
      color: #1A1A1A;
      margin-bottom: 30px;
      text-align: center;
      background: linear-gradient(135deg, #2C2C2C, #5A5A5A, #2C2C2C);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .message {
      font-size: 18px;
      line-height: 1.8;
      color: #4A4A4A;
      margin-bottom: 30px;
      text-align: center;
    }
    .highlight-box {
      background: linear-gradient(135deg, #F8F9FA 0%, #FFFFFF 100%);
      border: 2px solid;
      border-image: linear-gradient(90deg, #D0D0D0, #F0F0F0, #D0D0D0) 1;
      border-radius: 16px;
      padding: 40px;
      margin: 40px 0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.06);
    }
    .launch-title {
      font-size: 24px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 30px;
      background: linear-gradient(135deg, #4A4A4A, #7A7A7A, #4A4A4A);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 30px;
    }
    .feature-item {
      text-align: center;
      padding: 20px;
      background: #FFFFFF;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
      border: 1px solid #E8E8E8;
    }
    .feature-icon {
      font-size: 36px;
      margin-bottom: 12px;
    }
    .feature-text {
      font-size: 14px;
      color: #6A6A6A;
      font-weight: 600;
      line-height: 1.5;
    }
    .cta-button {
      display: inline-block;
      padding: 20px 60px;
      background: linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 50%, #C0C0C0 100%);
      color: #1A1A1A;
      text-decoration: none;
      font-size: 18px;
      font-weight: 700;
      border-radius: 50px;
      text-align: center;
      margin: 40px auto;
      display: block;
      width: fit-content;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      border: 2px solid #FFFFFF;
      letter-spacing: 1px;
      transition: all 0.3s ease;
    }
    .divider {
      height: 2px;
      background: linear-gradient(90deg, transparent, #D0D0D0, transparent);
      margin: 40px 0;
    }
    .footer {
      text-align: center;
      padding: 40px;
      background: linear-gradient(135deg, #F8F9FA 0%, #FFFFFF 100%);
      border-top: 2px solid;
      border-image: linear-gradient(90deg, #C0C0C0, #E8E8E8, #FFFFFF, #E8E8E8, #C0C0C0) 1;
    }
    .footer-text {
      font-size: 14px;
      color: #888888;
      line-height: 1.6;
    }
    .social-links {
      margin-top: 20px;
    }
    .social-icon {
      display: inline-block;
      width: 40px;
      height: 40px;
      margin: 0 8px;
      background: linear-gradient(135deg, #E8E8E8, #FFFFFF);
      border-radius: 50%;
      line-height: 40px;
      text-decoration: none;
      color: #5A5A5A;
      font-size: 18px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .stars {
      text-align: center;
      font-size: 24px;
      margin: 20px 0;
      letter-spacing: 8px;
    }
    @media only screen and (max-width: 600px) {
      .feature-grid {
        grid-template-columns: 1fr;
      }
      .content {
        padding: 40px 20px;
      }
      .header {
        padding: 40px 20px 30px;
      }
      .logo {
        font-size: 36px;
      }
      .greeting {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">PET WASH™</div>
      <div class="tagline">Premium Organic Pet Care</div>
      <div class="stars">⭐⭐⭐⭐⭐⭐⭐</div>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="greeting">
        Dear ${recipientName} & ${petName} 🐾
      </div>

      <div class="message">
        We are thrilled to personally invite you to the <strong>Grand Launch</strong> of 
        <strong>Pet Wash™</strong> - Israel's first <em>7-star premium organic pet care platform</em>!
      </div>

      <div class="message">
        As a valued friend, we want ${petName} to experience luxury pet care like never before. 
        Join us in revolutionizing how we care for our beloved companions.
      </div>

      <div class="highlight-box">
        <div class="launch-title">
          🎉 What Makes Pet Wash™ Special?
        </div>

        <div class="feature-grid">
          <div class="feature-item">
            <div class="feature-icon">🌿</div>
            <div class="feature-text">100% Organic<br>Premium Products</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🤖</div>
            <div class="feature-text">AI-Powered<br>Kenzo Assistant</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🚿</div>
            <div class="feature-text">K9000™ IoT<br>Smart Stations</div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📱</div>
            <div class="feature-text">8 Premium<br>Pet Services</div>
          </div>
        </div>
      </div>

      <div class="message">
        <strong>Exclusive Launch Benefits:</strong><br><br>
        ✨ <strong>50% OFF</strong> your first wash<br>
        ✨ Free membership in our <strong>Platinum Loyalty Program</strong><br>
        ✨ Priority access to <strong>Pet Wash Academy™</strong> training<br>
        ✨ Complimentary <strong>Apple Wallet</strong> digital pass<br>
        ✨ Meet our team and tour our facilities
      </div>

      <a href="https://www.petwash.co.il" class="cta-button">
        RESERVE ${petName.toUpperCase()}'S SPOT NOW
      </a>

      <div class="divider"></div>

      <div class="message" style="font-size: 16px;">
        <strong>Our 8 Premium Platforms:</strong><br><br>
        🐕 <strong>Main Wash Services</strong> - Premium organic washing<br>
        🎓 <strong>Pet Wash Academy™</strong> - Certified professional trainers<br>
        🚶 <strong>Walk My Pet™</strong> - GPS-tracked dog walking<br>
        🚗 <strong>PetTrek™</strong> - Real-time pet transport<br>
        🏠 <strong>The Sitter Suite™</strong> - Trusted pet sitting<br>
        🎨 <strong>The Plush Lab™</strong> - AI avatar creator<br>
        🏢 <strong>Franchise Opportunities</strong> - Global expansion<br>
        🤖 <strong>K9000 IoT Stations</strong> - Smart wash technology
      </div>

      <div class="message" style="margin-top: 40px; font-size: 16px; font-style: italic; color: #6A6A6A;">
        "${petName} deserves the very best. Pet Wash™ delivers 7-star luxury, 
        powered by Israeli innovation and genuine care for every pet."
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">
        <strong>Pet Wash™ Ltd</strong><br>
        Israel's Premium Organic Pet Care Platform<br>
        <a href="https://www.petwash.co.il" style="color: #5A5A5A;">www.petwash.co.il</a>
      </div>

      <div class="social-links">
        <a href="#" class="social-icon">📘</a>
        <a href="#" class="social-icon">📸</a>
        <a href="#" class="social-icon">🎵</a>
      </div>

      <div class="divider" style="margin: 30px 0;"></div>

      <div class="footer-text" style="font-size: 12px; color: #AAAAAA;">
        This is a personal invitation from Pet Wash™.<br>
        You received this email because you're awesome! 🌟<br>
        © 2025 Pet Wash™ Ltd. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return { subject, html };
}
