/**
 * Pet Wash™ Platform Copy Email Service
 * LUXURY COUTURE EDITION - Fashion-Brand Aesthetics
 * November 2025
 */
import { Router } from 'express';
import { logger } from '../lib/logger';
import { sendLuxuryEmail } from '../email/luxury-email-service';
const router = Router();
const generatePlatformCopyEmail = () => {
    const html = `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Pet Wash™ — Luxury Platform Collection 2025</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  
  <!-- Wrapper Table -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 0;">
        
        <!-- Main Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width: 640px; background-color: #ffffff;">
          
          <!-- Hero Section -->
          <tr>
            <td style="padding: 80px 48px 64px 48px; text-align: center; background-color: #ffffff;">
              
              <!-- Brand Mark -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 48px;">
                    <div style="display: inline-block; border: 2px solid #00C569; padding: 12px 32px; letter-spacing: 4px;">
                      <span style="font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 11px; font-weight: 400; color: #00C569; text-transform: uppercase;">Est. 2025 · Israel</span>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Main Title -->
              <h1 style="margin: 0 0 24px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 42px; font-weight: 400; color: #1a1a1a; letter-spacing: 2px; line-height: 1.1;">
                PET WASH™
              </h1>
              
              <!-- Subtitle -->
              <p style="margin: 0 0 32px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 300; color: #888888; letter-spacing: 3px; text-transform: uppercase;">
                Luxury Pet Care Ecosystem
              </p>
              
              <!-- Decorative Line -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="80" align="center">
                <tr>
                  <td style="height: 2px; background: linear-gradient(90deg, #00C569 0%, #008F46 100%);"></td>
                </tr>
              </table>
              
              <!-- Collection Title -->
              <p style="margin: 40px 0 0 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 18px; font-weight: 400; color: #1a1a1a; font-style: italic;">
                Platform Collection — 2025
              </p>
              
            </td>
          </tr>
          
          <!-- Spacer -->
          <tr><td style="height: 32px; background-color: #ffffff;"></td></tr>
          
          <!-- Section: The Seven Platforms -->
          <tr>
            <td style="padding: 0 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 48px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; color: #00C569; letter-spacing: 4px; text-transform: uppercase;">
                      The Collection
                    </p>
                    <h2 style="margin: 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 28px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      Seven Platforms
                    </h2>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Platform 1: Pet Boarding -->
          <tr>
            <td style="padding: 0 48px 40px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid rgba(0, 197, 105, 0.15); border-radius: 0;">
                <tr>
                  <td style="padding: 40px;">
                    
                    <!-- Platform Number -->
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 12px; font-weight: 400; color: #00C569; letter-spacing: 3px;">
                      01 — THE SITTER SUITE™
                    </p>
                    
                    <!-- Platform Name -->
                    <h3 style="margin: 0 0 20px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 24px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      Pet Boarding
                    </h3>
                    
                    <!-- Thin Accent Line -->
                    <table role="presentation" cellpadding="0" cellspacing="0" width="40">
                      <tr>
                        <td style="height: 1px; background-color: #00C569;"></td>
                      </tr>
                    </table>
                    
                    <!-- English Description -->
                    <p style="margin: 24px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #444444; line-height: 1.7;">
                      Overnight care in a loving sitter's home
                    </p>
                    
                    <!-- Hebrew -->
                    <p style="margin: 16px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #666666; line-height: 1.7; direction: rtl; text-align: right;">
                      <span style="color: #00C569;">פנסיון לחיות מחמד</span> — טיפול לילי בבית מארח אוהב
                    </p>
                    
                    <!-- Route -->
                    <p style="margin: 24px 0 0 0; font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 1px;">
                      /sitter-suite
                    </p>
                    
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Platform 2: House Sitting -->
          <tr>
            <td style="padding: 0 48px 40px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid rgba(0, 197, 105, 0.15); border-radius: 0;">
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 12px; font-weight: 400; color: #00C569; letter-spacing: 3px;">
                      02 — THE SITTER SUITE™
                    </p>
                    <h3 style="margin: 0 0 20px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 24px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      House Sitting
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="40">
                      <tr><td style="height: 1px; background-color: #00C569;"></td></tr>
                    </table>
                    <p style="margin: 24px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #444444; line-height: 1.7;">
                      Your sitter stays in your home with your pet
                    </p>
                    <p style="margin: 16px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #666666; line-height: 1.7; direction: rtl; text-align: right;">
                      <span style="color: #00C569;">שמרטפות בבית</span> — המטפל נשאר בביתך עם חיית המחמד
                    </p>
                    <p style="margin: 24px 0 0 0; font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 1px;">
                      /sitter-suite
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Platform 3: Doggy Daycare -->
          <tr>
            <td style="padding: 0 48px 40px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid rgba(0, 197, 105, 0.15); border-radius: 0;">
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 12px; font-weight: 400; color: #00C569; letter-spacing: 3px;">
                      03 — THE SITTER SUITE™
                    </p>
                    <h3 style="margin: 0 0 20px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 24px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      Doggy Daycare
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="40">
                      <tr><td style="height: 1px; background-color: #00C569;"></td></tr>
                    </table>
                    <p style="margin: 24px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #444444; line-height: 1.7;">
                      Daytime care while you work
                    </p>
                    <p style="margin: 16px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #666666; line-height: 1.7; direction: rtl; text-align: right;">
                      <span style="color: #00C569;">מעון יום לכלבים</span> — טיפול יומי בזמן שאתה בעבודה
                    </p>
                    <p style="margin: 24px 0 0 0; font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 1px;">
                      /sitter-suite
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Platform 4: Walk My Pet -->
          <tr>
            <td style="padding: 0 48px 40px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid rgba(0, 197, 105, 0.15); border-radius: 0;">
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 12px; font-weight: 400; color: #00C569; letter-spacing: 3px;">
                      04 — WALK MY PET™
                    </p>
                    <h3 style="margin: 0 0 20px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 24px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      Dog Walking
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="40">
                      <tr><td style="height: 1px; background-color: #00C569;"></td></tr>
                    </table>
                    <p style="margin: 24px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #444444; line-height: 1.7;">
                      30 or 60 minute walks with GPS tracking
                    </p>
                    <p style="margin: 16px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #666666; line-height: 1.7; direction: rtl; text-align: right;">
                      <span style="color: #00C569;">טיולי כלבים</span> — טיולים של 30 או 60 דקות עם מעקב GPS
                    </p>
                    <p style="margin: 24px 0 0 0; font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 1px;">
                      /walk-my-pet
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Platform 5: PetTrek Transport -->
          <tr>
            <td style="padding: 0 48px 40px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid rgba(0, 197, 105, 0.15); border-radius: 0;">
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 12px; font-weight: 400; color: #00C569; letter-spacing: 3px;">
                      05 — PETTREK™
                    </p>
                    <h3 style="margin: 0 0 20px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 24px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      Pet Transport
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="40">
                      <tr><td style="height: 1px; background-color: #00C569;"></td></tr>
                    </table>
                    <p style="margin: 24px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #444444; line-height: 1.7;">
                      Safe transportation to vet, groomer &amp; more
                    </p>
                    <p style="margin: 16px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #666666; line-height: 1.7; direction: rtl; text-align: right;">
                      <span style="color: #00C569;">הסעות חיות מחמד</span> — הסעה בטוחה לווטרינר, מטפח ועוד
                    </p>
                    <p style="margin: 24px 0 0 0; font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 1px;">
                      /pettrek
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Platform 6: Academy -->
          <tr>
            <td style="padding: 0 48px 40px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid rgba(0, 197, 105, 0.15); border-radius: 0;">
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 12px; font-weight: 400; color: #00C569; letter-spacing: 3px;">
                      06 — PET WASH ACADEMY™
                    </p>
                    <h3 style="margin: 0 0 20px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 24px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      Dog Training
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="40">
                      <tr><td style="height: 1px; background-color: #00C569;"></td></tr>
                    </table>
                    <p style="margin: 24px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #444444; line-height: 1.7;">
                      Private training with certified trainers
                    </p>
                    <p style="margin: 16px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #666666; line-height: 1.7; direction: rtl; text-align: right;">
                      <span style="color: #00C569;">אילוף כלבים</span> — אימון פרטי עם מאלפים מוסמכים
                    </p>
                    <p style="margin: 24px 0 0 0; font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 1px;">
                      /academy
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Platform 7: K9000 Smart Hub (Special) -->
          <tr>
            <td style="padding: 0 48px 40px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 2px solid #00C569; border-radius: 0;">
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 12px; font-weight: 400; color: #00C569; letter-spacing: 3px;">
                      07 — K9000™ SMART HUB
                    </p>
                    <h3 style="margin: 0 0 20px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 24px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      Outdoor DIY Pet Wash
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="40">
                      <tr><td style="height: 1px; background-color: #00C569;"></td></tr>
                    </table>
                    
                    <!-- Physical Station Badge -->
                    <p style="margin: 24px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 600; color: #00C569; letter-spacing: 2px; text-transform: uppercase;">
                      ◆ Physical Station · Not A Marketplace ◆
                    </p>
                    
                    <p style="margin: 20px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #444444; line-height: 1.7;">
                      Self-service wash stations available 24/7
                    </p>
                    <p style="margin: 16px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 300; color: #666666; line-height: 1.7; direction: rtl; text-align: right;">
                      <span style="color: #00C569;">עמדה חכמה לשטיפת חיות מחמד</span> — שירות עצמי 24/7
                    </p>
                    
                    <!-- Tech Specs -->
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 28px; border-top: 1px solid rgba(0, 197, 105, 0.15); padding-top: 24px;">
                      <tr>
                        <td style="padding-top: 24px;">
                          <p style="margin: 0 0 12px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 300; color: #666666; line-height: 1.6;">
                            <span style="color: #00C569;">◇</span>&nbsp;&nbsp;QR Code Activation via Mobile
                          </p>
                          <p style="margin: 0 0 12px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 300; color: #666666; line-height: 1.6;">
                            <span style="color: #00C569;">◇</span>&nbsp;&nbsp;Nayax Israel Payment Terminal
                          </p>
                          <p style="margin: 0 0 12px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 300; color: #666666; line-height: 1.6;">
                            <span style="color: #00C569;">◇</span>&nbsp;&nbsp;100% Organic Shampoo · Australian Tea Tree Oil
                          </p>
                          <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 300; color: #666666; line-height: 1.6;">
                            <span style="color: #00C569;">◇</span>&nbsp;&nbsp;7-Star LED Visual Experience
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 24px 0 0 0; font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 1px;">
                      /k9000
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Spacer -->
          <tr><td style="height: 48px; background-color: #ffffff;"></td></tr>
          
          <!-- Trust & Safety Section -->
          <tr>
            <td style="padding: 0 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 48px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; color: #00C569; letter-spacing: 4px; text-transform: uppercase;">
                      Pet Wash Protect™
                    </p>
                    <h2 style="margin: 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 28px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      Trust &amp; Safety
                    </h2>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Trust Features Grid -->
          <tr>
            <td style="padding: 0 48px 48px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="48%" valign="top" style="padding-right: 16px;">
                    
                    <!-- Feature 1 -->
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 24px; border: 1px solid rgba(0, 197, 105, 0.15);">
                          <p style="margin: 0 0 8px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 14px; font-weight: 400; color: #1a1a1a;">
                            Background Verified
                          </p>
                          <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888; line-height: 1.5;">
                            Enhanced background checks<br><span style="direction: rtl;">אימות רקע מורחב</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Feature 2 -->
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 24px; border: 1px solid rgba(0, 197, 105, 0.15);">
                          <p style="margin: 0 0 8px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 14px; font-weight: 400; color: #1a1a1a;">
                            24/7 Support
                          </p>
                          <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888; line-height: 1.5;">
                            Always here when you need us<br><span style="direction: rtl;">תמיכה מסביב לשעון</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Feature 3 -->
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 24px; border: 1px solid rgba(0, 197, 105, 0.15);">
                          <p style="margin: 0 0 8px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 14px; font-weight: 400; color: #1a1a1a;">
                            GPS Tracking
                          </p>
                          <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888; line-height: 1.5;">
                            Real-time location tracking<br><span style="direction: rtl;">מעקב GPS בזמן אמת</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                  </td>
                  <td width="48%" valign="top" style="padding-left: 16px;">
                    
                    <!-- Feature 4 -->
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 24px; border: 2px solid #00C569;">
                          <p style="margin: 0 0 8px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 14px; font-weight: 400; color: #00C569;">
                            ₪25,000 Guarantee
                          </p>
                          <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888; line-height: 1.5;">
                            Covers eligible vet care<br><span style="direction: rtl;">ערבות לטיפול וטרינרי</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Feature 5 -->
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 24px; border: 1px solid rgba(0, 197, 105, 0.15);">
                          <p style="margin: 0 0 8px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 14px; font-weight: 400; color: #1a1a1a;">
                            Photo Updates
                          </p>
                          <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888; line-height: 1.5;">
                            Photos during every service<br><span style="direction: rtl;">תמונות במהלך השירות</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Feature 6 -->
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 24px; border: 1px solid rgba(0, 197, 105, 0.15);">
                          <p style="margin: 0 0 8px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 14px; font-weight: 400; color: #1a1a1a;">
                            72-Hour Escrow
                          </p>
                          <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888; line-height: 1.5;">
                            Secure Nayax payments<br><span style="direction: rtl;">תשלום מאובטח בנאמנות</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Spacer -->
          <tr><td style="height: 48px; background-color: #ffffff;"></td></tr>
          
          <!-- How It Works Section -->
          <tr>
            <td style="padding: 0 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 48px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; color: #00C569; letter-spacing: 4px; text-transform: uppercase;">
                      The Process
                    </p>
                    <h2 style="margin: 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 28px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      Three Simple Steps
                    </h2>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Steps -->
          <tr>
            <td style="padding: 0 48px 64px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="33%" valign="top" style="text-align: center; padding: 0 8px;">
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 36px; font-weight: 400; color: #00C569;">
                      01
                    </p>
                    <p style="margin: 0 0 8px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 16px; font-weight: 400; color: #1a1a1a;">
                      Search
                    </p>
                    <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888;">
                      חפש והשווה
                    </p>
                  </td>
                  <td width="33%" valign="top" style="text-align: center; padding: 0 8px;">
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 36px; font-weight: 400; color: #00C569;">
                      02
                    </p>
                    <p style="margin: 0 0 8px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 16px; font-weight: 400; color: #1a1a1a;">
                      Meet
                    </p>
                    <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888;">
                      פגישת היכרות
                    </p>
                  </td>
                  <td width="33%" valign="top" style="text-align: center; padding: 0 8px;">
                    <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 36px; font-weight: 400; color: #00C569;">
                      03
                    </p>
                    <p style="margin: 0 0 8px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 16px; font-weight: 400; color: #1a1a1a;">
                      Book
                    </p>
                    <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888;">
                      הזמן ותירגע
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Spacer -->
          <tr><td style="height: 32px; background-color: #ffffff;"></td></tr>
          
          <!-- Design Specifications -->
          <tr>
            <td style="padding: 0 48px 64px 48px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid rgba(0, 197, 105, 0.15); padding-top: 48px;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; color: #00C569; letter-spacing: 4px; text-transform: uppercase;">
                      Design System
                    </p>
                    <h2 style="margin: 0 0 32px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 22px; font-weight: 400; color: #1a1a1a; letter-spacing: 1px;">
                      2025 Luxury Specifications
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(0, 197, 105, 0.1);">
                          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 2px; text-transform: uppercase;">Primary Color</span>
                          <span style="float: right; font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-size: 12px; color: #00C569;">#00C569 → #008F46</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(0, 197, 105, 0.1);">
                          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 2px; text-transform: uppercase;">Background</span>
                          <span style="float: right; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #1a1a1a;">Pure White</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(0, 197, 105, 0.1);">
                          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 2px; text-transform: uppercase;">Typography</span>
                          <span style="float: right; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #1a1a1a;">Didot · Helvetica Neue</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(0, 197, 105, 0.1);">
                          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 2px; text-transform: uppercase;">Aesthetic</span>
                          <span style="float: right; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #1a1a1a;">7-Star Couture</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 400; color: #aaaaaa; letter-spacing: 2px; text-transform: uppercase;">Inspiration</span>
                          <span style="float: right; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #1a1a1a;">Pet Wash™ Premium Design</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 48px; background-color: #ffffff; text-align: center; border-top: 1px solid rgba(0, 197, 105, 0.15);">
              
              <!-- Brand -->
              <p style="margin: 0 0 16px 0; font-family: 'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif; font-size: 18px; font-weight: 400; color: #1a1a1a; letter-spacing: 2px;">
                PET WASH™
              </p>
              
              <!-- Tagline -->
              <p style="margin: 0 0 24px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 300; color: #888888; letter-spacing: 1px;">
                Premium Organic Pet Care Ecosystem
              </p>
              
              <!-- Decorative Line -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="60" align="center">
                <tr>
                  <td style="height: 1px; background: linear-gradient(90deg, #00C569 0%, #008F46 100%);"></td>
                </tr>
              </table>
              
              <!-- Date -->
              <p style="margin: 24px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 300; color: #aaaaaa; letter-spacing: 1px;">
                November 2025
              </p>
              
              <!-- Links -->
              <p style="margin: 16px 0 0 0; font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-size: 10px; font-weight: 400; color: #cccccc; letter-spacing: 1px;">
                docs/PETWASH_PLATFORM_COPY_2025.md · /services
              </p>
              
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
`;
    return {
        subject: 'Pet Wash™ — Platform Collection 2025',
        html
    };
};
router.post('/send-platform-copy', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email address is required'
            });
        }
        const { subject, html } = generatePlatformCopyEmail();
        const sent = await sendLuxuryEmail({
            to: email,
            subject,
            html,
            from: {
                email: 'Support@PetWash.co.il',
                name: 'Pet Wash™'
            }
        });
        if (sent) {
            logger.info('[Platform Copy] Luxury email sent', { to: email });
            return res.json({
                success: true,
                message: `Luxury platform copy sent to ${email}`
            });
        }
        else {
            logger.warn('[Platform Copy] Email not sent - SendGrid may not be configured');
            return res.json({
                success: false,
                message: 'Email service not configured',
                previewHtml: html
            });
        }
    }
    catch (error) {
        logger.error('[Platform Copy] Error', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send email'
        });
    }
});
router.get('/platform-copy-preview', async (_req, res) => {
    const { html } = generatePlatformCopyEmail();
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});
export default router;
