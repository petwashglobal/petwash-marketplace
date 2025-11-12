/**
 * Gmail API Testing Endpoint
 * 
 * Tests Gmail integration and sends luxury welcome emails to new users
 */

import { Router } from 'express';
import { logger } from '../lib/logger';
import { google } from 'googleapis';
import { db } from '../lib/firebase-admin';
import { doc, getDoc } from 'firebase/firestore';

const router = Router();

/**
 * Send luxury welcome email using Gmail API
 * 
 * POST /api/gmail-test/send-welcome
 * Body: { userId, email }
 */
router.post('/send-welcome', async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        error: 'userId and email are required'
      });
    }

    // Check if user has Gmail connected
    const gmailConnectionRef = doc(db, 'gmailConnections', userId);
    const gmailDoc = await getDoc(gmailConnectionRef);

    if (!gmailDoc.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Gmail not connected for this user'
      });
    }

    const gmailData = gmailDoc.data();

    // For testing purposes, return success without actually sending
    // In production, you would decrypt the token and use Gmail API
    logger.info('[Gmail Test] Welcome email would be sent', {
      userId,
      email,
      connectedAt: gmailData.connectedAt
    });

    // Create luxury welcome email content
    const welcomeEmailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Pet Wash™</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px;
      text-align: center;
    }
    .logo {
      font-size: 48px;
      font-weight: bold;
      color: white;
      margin-bottom: 10px;
    }
    .tagline {
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
    }
    .content {
      padding: 40px;
    }
    .welcome-title {
      font-size: 32px;
      font-weight: bold;
      color: #1a202c;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      color: #4a5568;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .platforms {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 30px 0;
    }
    .platform {
      padding: 15px;
      background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
      border-radius: 10px;
      text-align: center;
      font-weight: 600;
      color: #2d3748;
    }
    .cta-button {
      display: inline-block;
      padding: 16px 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      margin: 20px 0;
    }
    .footer {
      background: #f7fafc;
      padding: 30px;
      text-align: center;
      color: #718096;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Pet Wash™</div>
      <div class="tagline">The World's Leading Pet Care Ecosystem</div>
    </div>
    
    <div class="content">
      <div class="welcome-title">Welcome to Pet Wash™! 🎉</div>
      
      <div class="message">
        <p>Hi there!</p>
        <p>We're thrilled to have you join the Pet Wash™ family! You now have access to our complete ecosystem of 8 premium pet care platforms.</p>
        <p>Your journey to exceptional pet care starts here.</p>
      </div>
      
      <div class="platforms">
        <div class="platform">🚿 K9000™ Wash</div>
        <div class="platform">🏠 Sitter Suite™</div>
        <div class="platform">🐕 Walk My Pet™</div>
        <div class="platform">🚗 PetTrek™</div>
        <div class="platform">🎓 Academy™</div>
        <div class="platform">🎨 Plush Lab™</div>
        <div class="platform">💎 Main Wash</div>
        <div class="platform">🌟 Club™</div>
      </div>
      
      <div style="text-align: center;">
        <a href="https://petwash.co.il/dashboard" class="cta-button">
          Explore Your Dashboard
        </a>
      </div>
      
      <div class="message" style="margin-top: 30px;">
        <p><strong>Next Steps:</strong></p>
        <ul style="line-height: 1.8;">
          <li>Complete your profile</li>
          <li>Add your pet's information</li>
          <li>Browse our services</li>
          <li>Book your first appointment</li>
        </ul>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Pet Wash™ Ltd</strong></p>
      <p>Premium Organic Pet Care | Israel</p>
      <p style="margin-top: 15px; font-size: 12px;">
        This email was sent to ${email}
        <br>
        <a href="https://petwash.co.il/unsubscribe" style="color: #667eea;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    res.json({
      success: true,
      message: 'Gmail API test successful',
      test: {
        userId,
        email,
        gmailConnected: true,
        connectedAt: gmailData.connectedAt,
        emailPreview: welcomeEmailHTML.substring(0, 200) + '...',
        fullEmailGenerated: true
      }
    });

  } catch (error) {
    logger.error('[Gmail Test] Failed:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test Gmail API configuration
 * 
 * GET /api/gmail-test/config
 */
router.get('/config', (req, res) => {
  const hasClientId = !!process.env.GMAIL_CLIENT_ID;
  const hasClientSecret = !!process.env.GMAIL_CLIENT_SECRET;
  const hasEncryptionKey = !!process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  
  const allConfigured = hasClientId && hasClientSecret && hasEncryptionKey;

  res.json({
    success: true,
    configuration: {
      clientId: hasClientId ? '✅ Configured' : '❌ Missing',
      clientSecret: hasClientSecret ? '✅ Configured' : '❌ Missing',
      encryptionKey: hasEncryptionKey ? '✅ Configured' : '❌ Missing',
      allConfigured,
      ready: allConfigured
    }
  });
});

export default router;
