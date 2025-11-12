/**
 * CEO Wallet & Team Management Routes
 * PRIVATE - Backend only, not exposed to public
 * For executive team Apple Wallet passes and invitations
 */

import express from 'express';
import { AppleWalletService } from '../appleWallet';
import { GoogleWalletService } from '../googleWallet';
import { logger } from '../lib/logger';
import { db } from '../lib/firebase-admin';
import sgMail from '@sendgrid/mail';

const router = express.Router();

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * GET /api/ceo/wallet/business-card
 * Download CEO business card for Apple Wallet (email link compatible)
 * PRIVATE - Admin only
 */
router.get('/business-card', async (req, res) => {
  try {
    // CEO Business Card Data (default)
    const businessCardData = {
      name: 'Nir Hadad',
      title: 'Founder & CEO',
      company: 'Pet Wash™',
      email: 'nir.h@petwash.co.il',
      phone: '+972-50-XXX-XXXX',
      website: 'https://petwash.co.il',
      socialMedia: {
        tiktok: '@petwashltd',
        instagram: '@petwashltd',
        facebook: 'petwashltd'
      }
    };

    // Check if certificates are configured
    if (!AppleWalletService.hasValidCertificates()) {
      logger.warn('[CEO Wallet] Apple Wallet certificates not configured - returning info page');
      
      // Return a nice HTML page explaining the situation
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Pet Wash™ - CEO Business Card</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .card {
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              padding: 40px;
              max-width: 500px;
              text-align: center;
              box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            }
            h1 { font-size: 32px; margin-bottom: 20px; }
            .logo { font-size: 64px; margin-bottom: 20px; }
            p { line-height: 1.6; opacity: 0.9; }
            .info { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">🎴</div>
            <h1>CEO Business Card</h1>
            <p><strong>Nir Hadad</strong><br>Founder & CEO<br>Pet Wash™</p>
            <div class="info">
              <p style="font-size: 14px;">Apple Wallet pass generation is currently being configured. Your digital business card will be available soon.</p>
              <p style="font-size: 12px; margin-top: 15px;">Contact: nir.h@petwash.co.il</p>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    // Generate business card
    const passBuffer = await AppleWalletService.generateBusinessCard(businessCardData);

    // Send pass file with inline disposition (opens directly in Apple Wallet on iOS - instant add!)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="PetWash_CEO_NirHadad.pkpass"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(passBuffer);

    logger.info('[CEO Wallet] Business card downloaded via GET', { timestamp: new Date().toISOString() });

  } catch (error) {
    logger.error('[CEO Wallet] Error generating business card (GET):', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Error - Pet Wash™</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #1c1c1e;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            text-align: center;
          }
          .error { background: rgba(239, 68, 68, 0.1); padding: 30px; border-radius: 15px; max-width: 400px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>⚠️ Error</h1>
          <p>Unable to generate business card. Please contact Support@PetWash.co.il</p>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * POST /api/ceo/wallet/business-card
 * Generate CEO business card for Apple Wallet (API endpoint)
 * PRIVATE - Admin only
 */
router.post('/business-card', async (req, res) => {
  try {
    const { name, email, title } = req.body;

    // CEO Business Card Data
    const businessCardData = {
      name: name || 'Nir Hadad',
      title: title || 'Founder & CEO',
      company: 'Pet Wash™',
      email: email || 'nir.h@petwash.co.il',
      phone: '+972-50-XXX-XXXX',
      website: 'https://petwash.co.il',
      socialMedia: {
        tiktok: '@petwashltd',
        instagram: '@petwashltd',
        facebook: 'petwashltd'
      }
    };

    // Check if certificates are configured
    if (!AppleWalletService.hasValidCertificates()) {
      logger.warn('[CEO Wallet] Apple Wallet certificates not configured - simulating pass generation');
      return res.json({
        success: true,
        message: 'Business card generated (simulation mode)',
        data: businessCardData,
        note: 'Apple Developer certificates required for actual .pkpass file'
      });
    }

    // Generate business card
    const passBuffer = await AppleWalletService.generateBusinessCard(businessCardData);

    // Send pass file with inline disposition (opens directly in Apple Wallet on iOS - instant add!)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="PetWash_CEO_${name?.replace(/\s+/g, '_')}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(passBuffer);

    logger.info('[CEO Wallet] Business card generated', { name, email });

  } catch (error) {
    logger.error('[CEO Wallet] Error generating business card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate business card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ceo/send-wallet-email
 * Send Apple Wallet pass via email to CEO/team
 */
router.post('/send-wallet-email', async (req, res) => {
  try {
    const { email, name, passType, tier } = req.body;

    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'SendGrid not configured'
      });
    }

    const baseUrl = process.env.BASE_URL || 'https://petwash.co.il';
    
    let emailSubject = '';
    let emailContent = '';

    if (passType === 'business-card') {
      emailSubject = '🎴 Your Pet Wash™ Digital Business Card';
      emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%); color: white; padding: 40px; border-radius: 15px; text-align: center; margin-bottom: 30px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 10px; margin: 20px 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #000 0%, #1c1c1e 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎴 Your Digital Business Card</h1>
            <p>Founder & CEO - Pet Wash™</p>
          </div>
          <div class="content">
            <p>Dear ${name || 'Executive Team Member'},</p>
            <p>Your premium Pet Wash™ digital business card is ready to add to Apple Wallet.</p>
            <p><strong>Features:</strong></p>
            <ul>
              <li>✅ Luxury black design (Centurion-style)</li>
              <li>✅ Instant contact sharing</li>
              <li>✅ Social media links included</li>
              <li>✅ Always accessible in Apple Wallet</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/api/ceo/wallet/business-card" class="button">
                Add to Apple Wallet
              </a>
            </div>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              This is a private executive resource. Do not share publicly.
            </p>
          </div>
        </body>
        </html>
      `;
    } else if (passType === 'loyalty') {
      emailSubject = '🐾 Your Pet Wash™ VIP Loyalty Card';
      emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 15px; text-align: center; margin-bottom: 30px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 10px; margin: 20px 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🐾 Your VIP Loyalty Card</h1>
            <p>Pet Wash™ ${tier?.toUpperCase() || 'PLATINUM'} Member</p>
          </div>
          <div class="content">
            <p>Dear ${name || 'VIP Member'},</p>
            <p>Your Pet Wash™ VIP loyalty card is ready to add to Apple Wallet.</p>
            <p><strong>Benefits:</strong></p>
            <ul>
              <li>✅ Instant loyalty discounts</li>
              <li>✅ Location-based notifications</li>
              <li>✅ Real-time points balance</li>
              <li>✅ QR code for quick check-in</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/wallet-download" class="button">
                Add to Apple Wallet
              </a>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const emailData = {
      to: email,
      from: {
        email: 'Support@PetWash.co.il',
        name: 'Pet Wash™'
      },
      subject: emailSubject,
      html: emailContent
    };

    await sgMail.send(emailData);

    logger.info('[CEO Wallet] Email sent', { email, passType });

    res.json({
      success: true,
      message: 'Email sent successfully',
      recipient: email
    });

  } catch (error) {
    logger.error('[CEO Wallet] Error sending email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ceo/send-launch-invitation
 * Send formal 2026 launch invitation
 */
router.post('/send-launch-invitation', async (req, res) => {
  try {
    const { recipients, ccRecipients, launchDate } = req.body;

    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'SendGrid not configured'
      });
    }

    const formattedDate = launchDate || 'November 7, 2025';

    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.8;
            color: #333;
            max-width: 700px;
            margin: 0 auto;
            padding: 40px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            border-radius: 20px;
            padding: 50px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .header {
            text-align: center;
            padding: 40px 0;
            border-bottom: 3px solid #667eea;
            margin-bottom: 40px;
          }
          .header h1 {
            color: #667eea;
            font-size: 42px;
            margin: 0 0 15px 0;
            font-weight: 700;
          }
          .header .subtitle {
            font-size: 20px;
            color: #764ba2;
            font-weight: 600;
          }
          .logo {
            font-size: 64px;
            margin-bottom: 20px;
          }
          .section {
            margin: 35px 0;
          }
          .section h2 {
            color: #667eea;
            font-size: 26px;
            margin-bottom: 20px;
            font-weight: 600;
          }
          .launch-date {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            margin: 40px 0;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
          }
          .launch-date .date {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .launch-date .label {
            font-size: 16px;
            opacity: 0.95;
          }
          .highlights {
            background: #f0f9ff;
            padding: 30px;
            border-radius: 12px;
            border-left: 5px solid #667eea;
            margin: 30px 0;
          }
          .highlights ul {
            margin: 15px 0;
            padding-left: 25px;
          }
          .highlights li {
            margin: 12px 0;
            color: #1e40af;
            font-size: 16px;
          }
          .quote {
            text-align: center;
            font-style: italic;
            color: #6b7280;
            font-size: 20px;
            margin: 40px 0;
            padding: 30px;
            background: #f9fafb;
            border-radius: 12px;
          }
          .cta {
            text-align: center;
            margin: 40px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 18px 45px;
            text-decoration: none;
            border-radius: 30px;
            font-weight: bold;
            font-size: 18px;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
            transition: transform 0.2s;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #e5e7eb;
            color: #6b7280;
          }
          .footer .brand {
            font-size: 28px;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🐾</div>
            <h1>You're Officially Invited</h1>
            <div class="subtitle">Pet Wash™ Israel Brand Launch 2026</div>
          </div>

          <div class="section">
            <p style="font-size: 18px;">
              Dear Valued Team Member,
            </p>
            <p>
              It is with immense pride and excitement that we invite you to the <strong>official launch</strong> of <strong>Pet Wash™</strong> in Israel. This milestone represents months of dedication, innovation, and unwavering commitment to revolutionizing premium pet care.
            </p>
          </div>

          <div class="launch-date">
            <div class="date">${formattedDate}</div>
            <div class="label">Official Brand Launch Date</div>
          </div>

          <div class="section">
            <h2>🌟 A New Era in Pet Care</h2>
            <p>
              Pet Wash™ isn't just launching a service—we're introducing a <strong>premium lifestyle brand</strong> that combines cutting-edge technology, organic excellence, and uncompromising quality. This is the culmination of our vision to provide Israel's pet owners with the finest care their beloved companions deserve.
            </p>
          </div>

          <div class="highlights">
            <h3 style="color: #667eea; margin-top: 0;">What We're Launching:</h3>
            <ul>
              <li><strong>11 Advanced Authentication Methods</strong> - Banking-level security with Face ID/Touch ID</li>
              <li><strong>6-Language Platform</strong> - Serving Israel's diverse community</li>
              <li><strong>K9000 Smart Stations</strong> - State-of-the-art automated pet washing technology</li>
              <li><strong>100% Organic Products</strong> - Tea Tree Oil formula, eco-friendly and safe</li>
              <li><strong>AI-Powered Service</strong> - 24/7 intelligent customer support</li>
              <li><strong>Apple & Google Wallet Integration</strong> - Premium digital loyalty cards</li>
              <li><strong>Real-Time Monitoring</strong> - 30+ automated systems ensuring excellence</li>
            </ul>
          </div>

          <div class="section">
            <h2>🚀 Our Mission</h2>
            <p>
              To establish Pet Wash™ as <strong>Israel's leading premium pet care brand</strong>, setting new standards for quality, convenience, and innovation. We're not just washing pets—we're creating an experience that celebrates the bond between pets and their families.
            </p>
          </div>

          <div class="quote">
            "Excellence is not a destination; it is a continuous journey that never ends."
            <div style="margin-top: 15px; color: #667eea; font-weight: 600;">— Pet Wash™ Vision</div>
          </div>

          <div class="section">
            <h2>💙 Thank You</h2>
            <p>
              This launch is possible because of <strong>your</strong> dedication, expertise, and belief in our vision. Every line of code, every strategic decision, every late night—it all comes together on <strong>${formattedDate}</strong>.
            </p>
            <p style="font-size: 18px; font-weight: 600; color: #667eea; margin-top: 25px;">
              Let's make history together.
            </p>
          </div>

          <div class="cta">
            <a href="https://petwash.co.il" class="button">
              Visit Pet Wash™
            </a>
          </div>

          <div class="footer">
            <div class="brand">🐾 Pet Wash™</div>
            <p><strong>Premium Pet Care Platform</strong></p>
            <p style="margin-top: 15px;">Launching in Israel - ${formattedDate}</p>
            <p style="font-size: 14px; margin-top: 20px;">
              <a href="https://petwash.co.il" style="color: #667eea; text-decoration: none;">petwash.co.il</a>
            </p>
            <p style="font-size: 12px; margin-top: 25px; color: #9ca3af;">
              This invitation was sent by Pet Wash™ Management<br>
              For inquiries: Support@PetWash.co.il
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailData: any = {
      to: recipients,
      cc: ccRecipients,
      from: {
        email: 'Support@PetWash.co.il',
        name: 'Pet Wash™ Management'
      },
      subject: `🐾 Official Invitation: Pet Wash™ Israel Launch - ${formattedDate}`,
      html: emailContent
    };

    await sgMail.send(emailData);

    logger.info('[CEO Wallet] Launch invitation sent', {
      recipients,
      ccRecipients,
      launchDate: formattedDate
    });

    res.json({
      success: true,
      message: 'Launch invitations sent successfully',
      recipients,
      ccRecipients,
      launchDate: formattedDate
    });

  } catch (error) {
    logger.error('[CEO Wallet] Error sending launch invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send invitation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ceo/add-team-members
 * Add team members to Firestore database
 */
router.post('/add-team-members', async (req, res) => {
  try {
    const { members } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Members array is required'
      });
    }

    const results = [];

    for (const member of members) {
      try {
        const { email, name, role, loyaltyTier } = member;

        // Create user document in Firestore
        const userRef = db.collection('users').doc();
        await userRef.set({
          email,
          displayName: name,
          role: role || 'team_member',
          loyaltyTier: loyaltyTier || 'platinum',
          loyaltyPoints: 0,
          loyaltyDiscountPercent: loyaltyTier === 'platinum' ? 20 : 15,
          loyaltyMemberSince: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isTeamMember: true,
          metadata: {
            addedBy: 'ceo_management',
            addedAt: new Date().toISOString()
          }
        });

        results.push({
          email,
          name,
          userId: userRef.id,
          success: true
        });

        logger.info('[CEO Wallet] Team member added', { email, name, userId: userRef.id });

      } catch (error) {
        results.push({
          email: member.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      message: `Added ${results.filter(r => r.success).length} of ${members.length} team members`,
      results
    });

  } catch (error) {
    logger.error('[CEO Wallet] Error adding team members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add team members',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
