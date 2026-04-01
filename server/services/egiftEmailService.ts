import { logger } from '../lib/logger';
import { createMailService, isSendGridConfigured } from '../lib/sendgrid';
import { EmailService } from '../emailService';

const mailService = createMailService();

interface EGiftEmailConfig {
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  value: number;
  currency: string;
  publicCode: string;
  giftCardId: string;
  occasion: string;
  messageLanguage: string;
  personalMessage?: string;
  eligibleServices: string[];
  expiresInMonths: number;
}

const tierColors: Record<string, { bg: string; accent: string; name: string; nameHe: string }> = {
  CLASSIC: { bg: '#f8e8ee', accent: '#d4547a', name: 'Classic', nameHe: 'קלאסי' },
  PLUS: { bg: '#e8f0e8', accent: '#4a7c59', name: 'Plus', nameHe: 'פלוס' },
  PREMIUM: { bg: '#2a2a2a', accent: '#c9a96e', name: 'Premium', nameHe: 'פרימיום' },
  ELITE: { bg: '#f5e6c8', accent: '#b8860b', name: 'Maison', nameHe: 'מזון' },
};

const occasionEmoji: Record<string, string> = {
  birthday: '🎂',
  thankyou: '💛',
  holiday: '✨',
  love: '❤️',
  newpet: '🐾',
  congrats: '🎉',
  justbecause: '🎁',
};

function getTier(value: number): string {
  if (value >= 750) return 'ELITE';
  if (value >= 400) return 'PREMIUM';
  if (value >= 200) return 'PLUS';
  return 'CLASSIC';
}

function formatCurrency(value: number, currency: string): string {
  if (currency === 'ILS') return `₪${value.toLocaleString()}`;
  return `${value.toLocaleString()} ${currency}`;
}

export async function sendEGiftConfirmationEmail(config: EGiftEmailConfig): Promise<void> {
  if (!isSendGridConfigured()) {
    logger.warn('[EGiftEmail] SendGrid not configured - skipping email');
    return;
  }

  // Consent check — sender purchased this e-gift, so it is transactional.
  // We still verify they haven't hard-bounced or unsubscribed.
  const senderConsent = await EmailService.checkEmailConsent(config.senderEmail, 'transactional');
  if (!senderConsent) {
    logger.info('[EGiftEmail] Sender consent check failed, skipping sender confirmation', { to: config.senderEmail });
    // Do not abort — still attempt recipient delivery below.
  }

  // Rate limiting guard
  const senderRateOk = EmailService.checkRateLimit(config.senderEmail);
  if (!senderRateOk) {
    logger.warn('[EGiftEmail] Rate limit exceeded for sender', { to: config.senderEmail });
    // Non-fatal — proceed to recipient
  }

  const tier = getTier(config.value);
  const colors = tierColors[tier] || tierColors.CLASSIC;
  const rtlLanguages = ['he', 'ar'];
  const isHe = config.messageLanguage === 'he' || config.messageLanguage === 'ar';
  const direction = isHe ? 'rtl' : 'ltr';
  const msgDirection = rtlLanguages.includes(config.messageLanguage) ? 'rtl' : 'ltr';
  const emoji = occasionEmoji[config.occasion] || '🎁';
  const formattedValue = formatCurrency(config.value, config.currency);
  
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + config.expiresInMonths);
  const expiryFormatted = expiryDate.toLocaleDateString(isHe ? 'he-IL' : 'en-US', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  });

  const serialNumber = `PWL${config.giftCardId.substring(0, 8).toUpperCase()}`;

  const t = {
    subject: isHe 
      ? `${emoji} כרטיס מתנה דיגיטלי של Pet Wash™ נשלח בהצלחה!`
      : `${emoji} Your Pet Wash™ E-Gift Card Has Been Sent!`,
    heading: isHe ? 'כרטיס המתנה נשלח!' : 'Gift Card Sent!',
    subheading: isHe 
      ? `${config.senderName}, המתנה שלך בדרך אל ${config.recipientName}`
      : `${config.senderName}, your gift is on its way to ${config.recipientName}`,
    orderDetails: isHe ? 'פרטי ההזמנה' : 'Order Details',
    from: isHe ? 'מאת' : 'From',
    to: isHe ? 'אל' : 'To',
    amount: isHe ? 'סכום' : 'Amount',
    code: isHe ? 'קוד המתנה' : 'Gift Code',
    serial: isHe ? 'מספר סידורי' : 'Serial Number',
    expires: isHe ? 'תוקף עד' : 'Valid Until',
    tier: isHe ? 'דרגה' : 'Tier',
    redeemable: isHe ? 'ניתן למימוש ב:' : 'Redeemable at:',
    yourMessage: isHe ? 'ההודעה שלך' : 'Your Message',
    recipientNotified: isHe 
      ? `${config.recipientName} יקבל/תקבל אימייל עם כרטיס המתנה בקרוב.`
      : `${config.recipientName} will receive their gift card email shortly.`,
    thankYou: isHe 
      ? 'תודה שבחרת ב-Pet Wash™ - טיפוח יוקרתי לחיות מחמד'
      : 'Thank you for choosing Pet Wash™ - Luxury Pet Care',
    allRights: isHe ? 'כל הזכויות שמורות' : 'All rights reserved',
  };

  const serviceNames: Record<string, string> = {
    wash: isHe ? 'שטיפות K9000' : 'K9000 Washes',
    sitter: isHe ? 'פט סיטר' : 'Pet Sitting',
    walk: isHe ? 'טיולי כלבים' : 'Dog Walking',
    trek: isHe ? 'הסעות' : 'Pet Transport',
    academy: isHe ? 'אקדמיה' : 'Academy',
    nayax: isHe ? 'תחנות Nayax' : 'Nayax Stations',
  };

  const servicesHtml = config.eligibleServices
    .map(s => serviceNames[s] || s)
    .join(' · ');

  const html = `
<!DOCTYPE html>
<html lang="${isHe ? 'he' : 'en'}" dir="${direction}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.85; }
    }
    .animate-fade { animation: fadeInUp 0.6s ease-out both; }
    .animate-fade-delay { animation: fadeInUp 0.6s ease-out 0.2s both; }
    .animate-fade-delay-2 { animation: fadeInUp 0.6s ease-out 0.4s both; }
    .shimmer-code {
      background: linear-gradient(90deg, ${colors.accent}15, ${colors.accent}30, ${colors.accent}15);
      background-size: 200% 100%;
      animation: shimmer 3s ease-in-out infinite;
    }
    .pulse-badge { animation: pulse 2s ease-in-out infinite; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    
    <!-- Header -->
    <div class="animate-fade" style="text-align:center;padding:32px 24px 20px;background:white;border-radius:12px 12px 0 0;border-bottom:2px solid ${colors.accent}20;">
      <div style="font-size:24px;font-weight:700;letter-spacing:0.5px;color:#1a1a1a;margin-bottom:4px;">
        Pet Wash™
      </div>
      <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${colors.accent};font-weight:500;">
        E-Gift Collection
      </div>
    </div>

    <!-- Hero Section -->
    <div class="animate-fade-delay" style="background:white;padding:32px 24px;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">${emoji}</div>
      <h1 style="font-size:22px;font-weight:300;color:#1a1a1a;margin:0 0 8px;letter-spacing:-0.5px;font-family:Georgia,serif;">
        ${t.heading}
      </h1>
      <p style="font-size:14px;color:#888;margin:0;line-height:1.5;">
        ${t.subheading}
      </p>
    </div>

    <!-- Card Visual -->
    <div class="animate-fade-delay" style="background:linear-gradient(135deg, ${colors.bg}, ${colors.bg}dd);padding:24px;text-align:center;">
      <div style="display:inline-block;padding:20px 32px;border-radius:8px;background:${tier === 'PREMIUM' ? '#2a2a2a' : 'white'};box-shadow:0 8px 32px rgba(0,0,0,0.12);">
        <div style="font-size:36px;font-weight:300;color:${tier === 'PREMIUM' ? '#c9a96e' : '#1a1a1a'};letter-spacing:-1px;font-family:Georgia,serif;">
          ${formattedValue}
        </div>
        <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${tier === 'PREMIUM' ? '#999' : '#aaa'};margin-top:4px;">
          ${isHe ? (colors.nameHe || colors.name) : colors.name} · E-Gift
        </div>
        ${config.recipientName ? `
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid ${tier === 'PREMIUM' ? '#444' : '#eee'};">
          <div style="font-size:13px;font-weight:600;color:${tier === 'PREMIUM' ? '#ddd' : '#333'};letter-spacing:1px;">
            ${config.recipientName.toUpperCase()}
          </div>
        </div>` : ''}
        <div style="margin-top:8px;font-size:9px;color:${tier === 'PREMIUM' ? '#777' : '#bbb'};letter-spacing:0.5px;">
          SN: ${serialNumber}
        </div>
      </div>
    </div>

    <!-- Gift Code -->
    <div class="animate-fade-delay-2 shimmer-code" style="padding:20px 24px;text-align:center;">
      <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;margin:0 0 8px;">
        ${t.code}
      </p>
      <div class="pulse-badge" style="display:inline-block;padding:12px 28px;border-radius:6px;background:white;border:2px dashed ${colors.accent};box-shadow:0 2px 12px ${colors.accent}20;">
        <span style="font-size:22px;font-weight:700;letter-spacing:4px;color:${colors.accent};font-family:'Courier New',monospace;">
          ${config.publicCode}
        </span>
      </div>
    </div>

    <!-- Order Details -->
    <div class="animate-fade-delay-2" style="background:white;padding:24px;border-top:1px solid #f0f0f0;">
      <h3 style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;margin:0 0 16px;font-weight:500;">
        ${t.orderDetails}
      </h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #f5f5f5;">
          <td style="padding:8px 0;color:#999;">${t.from}</td>
          <td style="padding:8px 0;color:#333;text-align:${isHe ? 'left' : 'right'};font-weight:500;">${config.senderName}</td>
        </tr>
        <tr style="border-bottom:1px solid #f5f5f5;">
          <td style="padding:8px 0;color:#999;">${t.to}</td>
          <td style="padding:8px 0;color:#333;text-align:${isHe ? 'left' : 'right'};font-weight:500;">${config.recipientName}</td>
        </tr>
        <tr style="border-bottom:1px solid #f5f5f5;">
          <td style="padding:8px 0;color:#999;">${t.amount}</td>
          <td style="padding:8px 0;color:#333;text-align:${isHe ? 'left' : 'right'};font-weight:600;font-size:15px;">${formattedValue}</td>
        </tr>
        <tr style="border-bottom:1px solid #f5f5f5;">
          <td style="padding:8px 0;color:#999;">${t.tier}</td>
          <td style="padding:8px 0;text-align:${isHe ? 'left' : 'right'};">
            <span style="padding:3px 10px;border-radius:3px;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:600;background:${colors.accent}15;color:${colors.accent};">
              ${isHe ? (colors.nameHe || colors.name) : colors.name}
            </span>
          </td>
        </tr>
        <tr style="border-bottom:1px solid #f5f5f5;">
          <td style="padding:8px 0;color:#999;">${t.serial}</td>
          <td style="padding:8px 0;color:#333;text-align:${isHe ? 'left' : 'right'};font-family:'Courier New',monospace;font-size:11px;">${serialNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#999;">${t.expires}</td>
          <td style="padding:8px 0;color:#333;text-align:${isHe ? 'left' : 'right'};">${expiryFormatted}</td>
        </tr>
      </table>

      <div style="margin-top:16px;padding:12px;background:#fafaf8;border-radius:4px;">
        <p style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#999;margin:0 0 6px;font-weight:500;">
          ${t.redeemable}
        </p>
        <p style="font-size:12px;color:#666;margin:0;line-height:1.6;">
          ${servicesHtml}
        </p>
      </div>
    </div>

    ${config.personalMessage ? `
    <!-- Personal Message -->
    <div style="background:#fafaf8;padding:20px 24px;border-top:1px solid #f0f0f0;">
      <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#999;margin:0 0 8px;font-weight:500;">
        ${t.yourMessage}
      </p>
      <div dir="${msgDirection}" style="padding:16px;background:white;border-radius:6px;border-${msgDirection === 'rtl' ? 'right' : 'left'}:3px solid ${colors.accent};">
        <p style="font-size:14px;color:#444;margin:0;line-height:1.6;font-style:italic;text-align:${msgDirection === 'rtl' ? 'right' : 'left'};">
          "${config.personalMessage}"
        </p>
        <p style="font-size:11px;color:#aaa;margin:8px 0 0;text-align:${msgDirection === 'rtl' ? 'left' : 'right'};">
          — ${config.senderName}
        </p>
      </div>
    </div>` : ''}

    <!-- Footer -->
    <div style="background:white;padding:24px;border-radius:0 0 12px 12px;border-top:1px solid #f0f0f0;text-align:center;">
      <p style="font-size:12px;color:#888;margin:0 0 4px;line-height:1.5;">
        ${t.recipientNotified}
      </p>
      <p style="font-size:11px;color:#aaa;margin:16px 0 0;">
        ${t.thankYou}
      </p>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f5f5f5;">
        <p style="font-size:10px;color:#ccc;margin:0;">
          © ${new Date().getFullYear()} פט וואש בע"מ / PET WASH LTD | ח.פ. 517145033 | ${t.allRights}
        </p>
      </div>
    </div>

  </div>
</body>
</html>`;

  const recipientHeading = isHe ? 'קיבלת כרטיס מתנה!' : "You've Received a Gift Card!";
  const recipientSubheading = isHe 
    ? `${config.senderName} שלח/ה לך כרטיס מתנה של Pet Wash™`
    : `${config.senderName} sent you a Pet Wash™ gift card`;
  const recipientHtml = html
    .replace(`>${t.heading}<`, `>${recipientHeading}<`)
    .replace(`>${t.subheading}<`, `>${recipientSubheading}<`);

  // Sender confirmation — only if consent passed and rate-limit ok
  if (senderConsent && senderRateOk) {
    try {
      await mailService.send({
        to: config.senderEmail,
        from: { email: 'noreply@petwash.co.il', name: 'Pet Wash™' },
        subject: t.subject,
        html,
      });
      logger.info('[EGiftEmail] Sender confirmation sent', { to: config.senderEmail });
    } catch (err) {
      logger.warn('[EGiftEmail] Failed to send sender confirmation:', err);
    }
  }

  // Recipient delivery — e-gift delivery to recipient is always transactional.
  // The recipient has not interacted with the system before, so we skip
  // our internal consent table (they're not a registered user yet) but
  // we must still rate-limit per address to prevent abuse.
  const recipientRateOk = EmailService.checkRateLimit(config.recipientEmail);
  if (!recipientRateOk) {
    logger.warn('[EGiftEmail] Rate limit exceeded for recipient — e-gift delivery skipped', { to: config.recipientEmail });
    return;
  }

  try {
    const recipientSubject = isHe
      ? `${emoji} ${config.senderName} שלח/ה לך כרטיס מתנה של Pet Wash™!`
      : `${emoji} ${config.senderName} sent you a Pet Wash™ E-Gift Card!`;

    // E-gift delivery to recipient must NOT include unsubscribe headers.
    // This is a paid delivery, not a marketing email (Israeli Spam Law §2(5)(a)).
    await mailService.send({
      to: config.recipientEmail,
      from: { email: 'noreply@petwash.co.il', name: 'Pet Wash™' },
      subject: recipientSubject,
      html: recipientHtml,
    });
    logger.info('[EGiftEmail] Recipient notification sent', { to: config.recipientEmail });
  } catch (err) {
    logger.warn('[EGiftEmail] Failed to send recipient notification:', err);
  }
}
