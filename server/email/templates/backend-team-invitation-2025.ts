/**
 * Backend Team Invitation Email - Luxury 2025 Design
 * Ultra-modern, premium design following latest 2025 trends
 */

interface BackendInvitationData {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  senderEmail: string;
  personalMessage?: string;
}

export function generateBackendTeamInvitation(data: BackendInvitationData): { subject: string; html: string } {
  const subject = '🚀 Join the Pet Wash™ Backend Revolution';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Pet Wash Backend Team</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&family=Playfair+Display:wght@700;900&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      padding: 40px 20px;
    }
    
    .container {
      max-width: 680px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    .header {
      background: linear-gradient(135deg, #7C3AED 0%, #6366F1 50%, #3B82F6 100%);
      padding: 60px 40px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      animation: pulse 15s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    
    .logo {
      font-family: 'Playfair Display', serif;
      font-size: 42px;
      font-weight: 900;
      color: #FFFFFF;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      margin-bottom: 10px;
      position: relative;
      z-index: 1;
    }
    
    .tagline {
      color: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      font-weight: 300;
      letter-spacing: 3px;
      text-transform: uppercase;
      position: relative;
      z-index: 1;
    }
    
    .hero-icon {
      font-size: 80px;
      margin: 30px 0 20px;
      filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.2));
      position: relative;
      z-index: 1;
    }
    
    .content {
      padding: 60px 50px;
    }
    
    .greeting {
      font-size: 32px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 30px;
      background: linear-gradient(135deg, #7C3AED, #3B82F6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .message {
      font-size: 18px;
      line-height: 1.8;
      color: #475569;
      margin-bottom: 30px;
    }
    
    .message strong {
      color: #1E293B;
      font-weight: 600;
    }
    
    .highlight-box {
      background: linear-gradient(135deg, #F0F9FF 0%, #EEF2FF 100%);
      border-left: 4px solid #7C3AED;
      padding: 30px;
      border-radius: 16px;
      margin: 40px 0;
    }
    
    .highlight-box h3 {
      color: #7C3AED;
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 15px;
    }
    
    .highlight-box p {
      color: #475569;
      font-size: 16px;
      line-height: 1.7;
      margin: 0;
    }
    
    .perks-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 40px 0;
    }
    
    .perk-card {
      background: #F8FAFC;
      padding: 25px;
      border-radius: 12px;
      text-align: center;
      border: 1px solid #E2E8F0;
      transition: transform 0.3s ease;
    }
    
    .perk-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(124, 58, 237, 0.15);
    }
    
    .perk-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }
    
    .perk-title {
      font-size: 16px;
      font-weight: 600;
      color: #1E293B;
      margin-bottom: 8px;
    }
    
    .perk-desc {
      font-size: 13px;
      color: #64748B;
      line-height: 1.5;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #7C3AED 0%, #6366F1 100%);
      color: #FFFFFF;
      padding: 20px 50px;
      text-decoration: none;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 700;
      margin: 30px 0;
      box-shadow: 0 10px 30px rgba(124, 58, 237, 0.3);
      transition: all 0.3s ease;
      text-align: center;
    }
    
    .cta-button:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(124, 58, 237, 0.4);
    }
    
    .personal-note {
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
      border-left: 4px solid #F59E0B;
      padding: 30px;
      border-radius: 16px;
      margin: 40px 0;
    }
    
    .personal-note-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .personal-note-icon {
      font-size: 28px;
      margin-right: 12px;
    }
    
    .personal-note-title {
      font-size: 18px;
      font-weight: 700;
      color: #92400E;
    }
    
    .personal-note-text {
      color: #78350F;
      font-size: 16px;
      line-height: 1.7;
      font-style: italic;
    }
    
    .footer {
      background: #F8FAFC;
      padding: 40px 50px;
      text-align: center;
      border-top: 1px solid #E2E8F0;
    }
    
    .footer-text {
      color: #64748B;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    
    .signature {
      margin-top: 30px;
    }
    
    .signature-name {
      font-size: 20px;
      font-weight: 700;
      color: #1E293B;
      margin-bottom: 5px;
    }
    
    .signature-title {
      font-size: 14px;
      color: #7C3AED;
      font-weight: 600;
    }
    
    .social-links {
      margin-top: 30px;
    }
    
    .social-links a {
      display: inline-block;
      margin: 0 10px;
      font-size: 24px;
      text-decoration: none;
      transition: transform 0.3s ease;
    }
    
    .social-links a:hover {
      transform: scale(1.2);
    }
    
    @media (max-width: 600px) {
      .content {
        padding: 40px 30px;
      }
      
      .perks-grid {
        grid-template-columns: 1fr;
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
      <div class="hero-icon">🚀</div>
    </div>
    
    <!-- Content -->
    <div class="content">
      <h1 class="greeting">Welcome to the Revolution, ${data.recipientName}!</h1>
      
      <p class="message">
        We're absolutely <strong>thrilled</strong> to invite you to join the <strong>Pet Wash™ Backend Engineering Team</strong> — 
        where cutting-edge technology meets the love and care of millions of pets worldwide.
      </p>
      
      <p class="message">
        You're not just joining a team. You're becoming part of a <strong>mission</strong> to transform pet care through 
        innovation, elegance, and world-class engineering.
      </p>
      
      <!-- Personal Thank You Note -->
      ${data.personalMessage ? `
      <div class="personal-note">
        <div class="personal-note-header">
          <span class="personal-note-icon">💜</span>
          <div class="personal-note-title">A Personal Note from ${data.senderName}</div>
        </div>
        <p class="personal-note-text">${data.personalMessage}</p>
      </div>
      ` : ''}
      
      <!-- Why You're Perfect -->
      <div class="highlight-box">
        <h3>🎯 Why You're Perfect for This</h3>
        <p>
          Over the past few months, your contributions have been nothing short of <strong>extraordinary</strong>. 
          Your dedication, innovation, and passion for excellence perfectly embody the Pet Wash™ spirit. 
          We've watched you elevate every project you touch, and we know you're ready for this next chapter.
        </p>
      </div>
      
      <!-- What Awaits -->
      <h2 style="font-size: 26px; color: #1E293B; margin: 40px 0 25px; font-weight: 700;">
        ✨ What Awaits You
      </h2>
      
      <div class="perks-grid">
        <div class="perk-card">
          <div class="perk-icon">🧠</div>
          <div class="perk-title">Cutting-Edge Tech</div>
          <div class="perk-desc">TypeScript, React, AI, Firebase, Enterprise Architecture</div>
        </div>
        
        <div class="perk-card">
          <div class="perk-icon">🌍</div>
          <div class="perk-title">Global Impact</div>
          <div class="perk-desc">Building systems that serve pet lovers worldwide</div>
        </div>
        
        <div class="perk-card">
          <div class="perk-icon">🎨</div>
          <div class="perk-title">Creative Freedom</div>
          <div class="perk-desc">Your ideas shape the future of pet care technology</div>
        </div>
        
        <div class="perk-card">
          <div class="perk-icon">🚀</div>
          <div class="perk-title">Fast Growth</div>
          <div class="perk-desc">Rapid expansion into international markets</div>
        </div>
      </div>
      
      <!-- Vision -->
      <div class="highlight-box" style="background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); border-left-color: #10B981;">
        <h3 style="color: #10B981;">🌟 Our 2025-2026 Vision</h3>
        <p>
          We're building the <strong>world's most advanced pet care platform</strong>. AI-powered personalization, 
          IoT-connected washing stations, real-time analytics, banking-level security, and a customer experience 
          that pet owners absolutely adore. You'll be at the heart of it all.
        </p>
      </div>
      
      <!-- CTA -->
      <div style="text-align: center;">
        <a href="https://petwash.co.il/backend-team" class="cta-button">
          🎉 Accept Your Invitation
        </a>
      </div>
      
      <p class="message" style="text-align: center; margin-top: 30px;">
        Ready to build something <strong>extraordinary</strong> together?
      </p>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">
        🐾 Pet Wash™ — Where Technology Meets Unconditional Love<br>
        Serving pet families across Israel and expanding globally
      </p>
      
      <div class="signature">
        <div class="signature-name">${data.senderName}</div>
        <div class="signature-title">Founder & CEO, Pet Wash Ltd</div>
      </div>
      
      <div class="social-links">
        <a href="https://www.facebook.com/petwash" style="color: #3B82F6;">📘</a>
        <a href="https://www.instagram.com/petwash" style="color: #EC4899;">📸</a>
        <a href="https://www.linkedin.com/company/petwash" style="color: #0EA5E9;">💼</a>
      </div>
      
      <p class="footer-text" style="margin-top: 30px; font-size: 12px;">
        © 2025 Pet Wash Ltd. All rights reserved.<br>
        Company No. 517145033 | Registered in Israel
      </p>
    </div>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}
