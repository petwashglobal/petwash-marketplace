#!/usr/bin/env tsx
/**
 * Pet Wash™ Deployment Monitor
 * Monitors petwash.co.il and sends notification when deployment is successful
 */

import sgMail from '@sendgrid/mail';
import { logger } from '../server/lib/logger';

const SITE_URL = 'https://petwash.co.il';
const HEALTH_ENDPOINT = `${SITE_URL}/health`;
const CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
const NOTIFICATION_EMAIL = 'nir.h@petwash.co.il';
const MAX_ATTEMPTS = 180; // 6 hours max monitoring

let attemptCount = 0;
let isMonitoring = true;

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.error('❌ SENDGRID_API_KEY not found - cannot send notifications');
  process.exit(1);
}

async function checkDeployment(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      headers: {
        'User-Agent': 'PetWash-Deployment-Monitor/1.0'
      }
    });

    if (response.ok) {
      const data = await response.json();
      logger.info('✅ Site is LIVE!', { status: response.status, data });
      return true;
    } else {
      logger.warn(`⏳ Site not ready yet (${response.status})`);
      return false;
    }
  } catch (error) {
    logger.warn('⏳ Site not accessible yet', { error: error instanceof Error ? error.message : 'Unknown error' });
    return false;
  }
}

async function sendSuccessNotification(): Promise<void> {
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'full',
    timeStyle: 'long'
  });

  const emailContent = {
    to: NOTIFICATION_EMAIL,
    from: {
      email: 'support@petwash.co.il',
      name: 'Pet Wash™ Deployment System'
    },
    subject: '🚀 Pet Wash™ is LIVE on petwash.co.il!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 28px; }
          .header .emoji { font-size: 48px; margin-bottom: 10px; }
          .section { background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 20px; border-radius: 5px; }
          .section h2 { margin-top: 0; color: #059669; font-size: 20px; }
          .detail { display: flex; justify-content: space-between; margin: 12px 0; padding: 10px; background: white; border-radius: 5px; }
          .label { font-weight: 600; color: #555; }
          .value { color: #333; font-weight: 500; }
          .success { color: #10b981; font-weight: 600; font-size: 18px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: 600; }
          .button:hover { background: #059669; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .status-badge { display: inline-block; background: #10b981; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="emoji">🎉</div>
          <h1>Deployment Successful!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 18px;">Your Pet Wash™ platform is now live</p>
        </div>

        <div class="section">
          <h2>🚀 Deployment Status</h2>
          <div class="detail">
            <span class="label">Status:</span>
            <span class="status-badge">✅ LIVE & OPERATIONAL</span>
          </div>
          <div class="detail">
            <span class="label">Deployment Time:</span>
            <span class="value">${timestamp}</span>
          </div>
          <div class="detail">
            <span class="label">Production URL:</span>
            <span class="value">https://petwash.co.il</span>
          </div>
          <div class="detail">
            <span class="label">Health Endpoint:</span>
            <span class="value">https://petwash.co.il/health</span>
          </div>
        </div>

        <div class="section">
          <h2>✅ Verification Complete</h2>
          <p>Your production deployment has been automatically verified:</p>
          <ul style="margin: 15px 0; padding-left: 25px;">
            <li>✅ Server responding to requests</li>
            <li>✅ Health check endpoint operational</li>
            <li>✅ SSL/HTTPS certificate active</li>
            <li>✅ Domain DNS resolution confirmed</li>
          </ul>
        </div>

        <div class="section">
          <h2>🌐 Your Site is Now Accessible</h2>
          <p>Visit your live production site:</p>
          <div style="text-align: center;">
            <a href="https://petwash.co.il" class="button">🔗 Open petwash.co.il</a>
          </div>
        </div>

        <div class="section">
          <h2>📊 Next Steps</h2>
          <ul style="margin: 15px 0; padding-left: 25px;">
            <li>Test all critical user journeys (sign in, navigation, features)</li>
            <li>Verify all 7 divisions are working (Sitter Suite, Walk My Pet, PetTrek, etc.)</li>
            <li>Check admin dashboard functionality</li>
            <li>Monitor Sentry for any production errors</li>
            <li>Review performance metrics</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p class="success">🎊 Congratulations on your successful deployment!</p>
        </div>

        <div class="footer">
          <p><strong>Pet Wash™ Automated Deployment System</strong></p>
          <p>This notification was sent automatically when your production deployment was verified.</p>
          <p style="margin-top: 10px;">For support: <a href="mailto:support@petwash.co.il">support@petwash.co.il</a></p>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sgMail.send(emailContent);
    logger.info('✅ Success notification email sent!', { to: NOTIFICATION_EMAIL });
    console.log('\n🎉 SUCCESS NOTIFICATION SENT!');
    console.log(`📧 Email sent to: ${NOTIFICATION_EMAIL}`);
  } catch (error) {
    logger.error('Failed to send notification email', { error });
    console.error('❌ Failed to send email:', error);
  }
}

async function monitorDeployment(): Promise<void> {
  console.log('\n🔍 Pet Wash™ Deployment Monitor Started');
  console.log(`🌐 Monitoring: ${SITE_URL}`);
  console.log(`📧 Notification Email: ${NOTIFICATION_EMAIL}`);
  console.log(`⏱️  Check Interval: 2 minutes`);
  console.log(`📊 Max Monitoring Time: 6 hours\n`);

  while (isMonitoring && attemptCount < MAX_ATTEMPTS) {
    attemptCount++;
    const elapsed = Math.floor((attemptCount * CHECK_INTERVAL) / 1000 / 60);
    
    console.log(`[Attempt ${attemptCount}/${MAX_ATTEMPTS}] Checking deployment... (${elapsed} min elapsed)`);

    const isLive = await checkDeployment();

    if (isLive) {
      console.log('\n✅ DEPLOYMENT SUCCESSFUL!');
      console.log('🚀 Site is now live at: https://petwash.co.il');
      console.log('📤 Sending notification...\n');
      
      await sendSuccessNotification();
      
      console.log('\n✅ Monitoring complete - deployment verified!');
      isMonitoring = false;
      process.exit(0);
    } else {
      console.log(`⏳ Site not ready yet. Next check in 2 minutes...\n`);
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }
  }

  if (attemptCount >= MAX_ATTEMPTS) {
    console.log('\n⚠️  Maximum monitoring time reached (6 hours)');
    console.log('💡 Please check deployment manually or contact Replit support');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Monitoring stopped by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Monitoring stopped');
  process.exit(0);
});

// Start monitoring
monitorDeployment().catch((error) => {
  logger.error('Fatal error in deployment monitor:', error);
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
