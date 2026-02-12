import { PETWASH_LOGO_BASE64 } from './logo-base64';

interface ProviderWelcomeEmailData {
  firstName: string;
  lastName: string;
  email: string;
  language: 'he' | 'en';
  providerType: string;
  applicationId: string | number;
  serviceTypes?: string[];
  autoApproved?: boolean;
}

const PROVIDER_TYPE_LABELS: Record<string, { en: string; he: string }> = {
  pet_sitting: { en: 'Pet Sitter', he: '\u05E9\u05DE\u05E8\u05D8\u05E3/\u05D9\u05EA' },
  dog_walking: { en: 'Dog Walker', he: '\u05DE\u05D8\u05D9\u05D9\u05DC/\u05EA \u05DB\u05DC\u05D1\u05D9\u05DD' },
  pet_transport: { en: 'Pet Transport Driver', he: '\u05E0\u05D4\u05D2/\u05EA \u05D4\u05E1\u05E2\u05D5\u05EA' },
  grooming: { en: 'Groomer', he: '\u05DE\u05D8\u05E4\u05D7/\u05EA' },
  training: { en: 'Pet Trainer', he: '\u05DE\u05D0\u05DC\u05E3/\u05EA' },
  wash_hub_operator: { en: 'K9000\u2122 Station Operator', he: '\u05DE\u05E4\u05E2\u05D9\u05DC/\u05EA \u05EA\u05D7\u05E0\u05EA K9000\u2122' },
  veterinary_house_calls: { en: 'Home Vet', he: '\u05D5\u05D8\u05E8\u05D9\u05E0\u05E8/\u05D9\u05EA \u05D1\u05D1\u05D9\u05EA' },
};

export function generateProviderWelcomeEmail(data: ProviderWelcomeEmailData): { subject: string; html: string } {
  const isHebrew = data.language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const joinDate = new Date().toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const providerLabel = PROVIDER_TYPE_LABELS[data.providerType] || { en: data.providerType, he: data.providerType };

  const subject = isHebrew
    ? `\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05E6\u05D5\u05D5\u05EA Pet Wash\u2122, ${data.firstName} \u2014 ${data.autoApproved ? '\u05D4\u05D1\u05E7\u05E9\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4' : '\u05D4\u05D1\u05E7\u05E9\u05D4 \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4'}`
    : `Welcome to Pet Wash\u2122 Team, ${data.firstName} \u2014 Application ${data.autoApproved ? 'Approved' : 'Received'}`;

  const servicesHtml = (data.serviceTypes || [data.providerType]).map(type => {
    const label = PROVIDER_TYPE_LABELS[type] || { en: type, he: type };
    return `<div style="display: inline-block; background: linear-gradient(135deg, #f0fdfa, #ccfbf1); border: 1px solid #99f6e4; border-radius: 2px; padding: 10px 20px; margin: 4px; font-size: 13px; color: #0d9488; font-weight: 500; letter-spacing: 0.3px;">${isHebrew ? label.he : label.en}</div>`;
  }).join('');

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
      
      <div style="background: linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #0d9488 100%); padding: 56px 40px; text-align: center; position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #2dd4bf, #99f6e4, #5eead4, #14b8a6);"></div>
        <img src="${PETWASH_LOGO_BASE64}" alt="Pet Wash\u2122" style="max-width: 150px; height: auto; margin-bottom: 24px;" />
        <h1 style="color: #ffffff; font-size: 28px; font-weight: 400; letter-spacing: 1.5px; margin: 0; font-family: 'Georgia', serif; text-shadow: 0 2px 8px rgba(0,0,0,0.15);">
          ${isHebrew ? '\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05E6\u05D5\u05D5\u05EA' : 'Welcome to the Team'}
        </h1>
        <div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 10px; letter-spacing: 3px; text-transform: uppercase;">
          ${isHebrew ? '\u05E0\u05D5\u05EA\u05E0\u05D9 \u05E9\u05D9\u05E8\u05D5\u05EA \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9\u05D9\u05DD' : 'Professional Service Providers'}
        </div>
        <div style="display: inline-block; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); color: #99f6e4; padding: 8px 24px; border-radius: 2px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top: 20px;">
          ${isHebrew ? providerLabel.he : providerLabel.en}
        </div>
      </div>
      
      <div style="height: 2px; background: linear-gradient(90deg, #0d9488, #2dd4bf, #5eead4, #99f6e4, #5eead4, #2dd4bf, #0d9488);"></div>
      
      <div style="padding: 52px 44px;">
        <h2 style="font-size: 22px; color: #0f172a; margin: 0 0 28px; font-weight: 400; text-align: ${isHebrew ? 'right' : 'left'}; font-family: 'Georgia', serif;">
          ${isHebrew ? `\u05E9\u05DC\u05D5\u05DD ${data.firstName},` : `Dear ${data.firstName},`}
        </h2>
        
        ${data.autoApproved ? `
        <div style="text-align: center; padding: 24px; margin: 28px 0; border-radius: 2px; background: linear-gradient(135deg, #f0fdfa, #ccfbf1); border: 1px solid #99f6e4;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #0d9488, #14b8a6); margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
            <span style="color: #ffffff; font-size: 20px; font-weight: bold; line-height: 40px;">\u2713</span>
          </div>
          <h3 style="margin: 0 0 6px; font-size: 18px; color: #0d9488; font-family: 'Georgia', serif; font-weight: 400;">
            ${isHebrew ? '\u05D4\u05D1\u05E7\u05E9\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4' : 'Application Approved'}
          </h3>
          <p style="margin: 0; font-size: 13px; color: #0f766e;">
            ${isHebrew ? '\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA \u05E4\u05E2\u05D9\u05DC \u05D5\u05DE\u05D5\u05DB\u05DF \u05DC\u05E7\u05D1\u05DC\u05EA \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA.' : 'Your account is active and ready to receive bookings.'}
          </p>
        </div>
        ` : `
        <div style="text-align: center; padding: 24px; margin: 28px 0; border-radius: 2px; background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 1px solid #fde68a;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #d97706, #f59e0b); margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
            <span style="color: #ffffff; font-size: 18px; font-weight: bold; line-height: 40px;">\u2026</span>
          </div>
          <h3 style="margin: 0 0 6px; font-size: 18px; color: #b45309; font-family: 'Georgia', serif; font-weight: 400;">
            ${isHebrew ? '\u05D4\u05D1\u05E7\u05E9\u05D4 \u05D1\u05D1\u05D3\u05D9\u05E7\u05D4' : 'Application Under Review'}
          </h3>
          <p style="margin: 0; font-size: 13px; color: #a16207;">
            ${isHebrew ? '\u05D4\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD \u05E9\u05DC\u05DA \u05E0\u05D1\u05D3\u05E7\u05D9\u05DD. \u05E0\u05D7\u05D6\u05D5\u05E8 \u05D0\u05DC\u05D9\u05DA \u05EA\u05D5\u05DA 2\u20133 \u05D9\u05DE\u05D9 \u05E2\u05E1\u05E7\u05D9\u05DD.' : 'Your documents are being reviewed. We\'ll get back to you within 2\u20133 business days.'}
          </p>
        </div>
        `}
        
        <p style="font-size: 15px; line-height: 1.9; color: #475569; margin: 0 0 24px; text-align: ${isHebrew ? 'right' : 'left'};">
          ${isHebrew
            ? '\u05EA\u05D5\u05D3\u05D4 \u05E9\u05D4\u05E6\u05D8\u05E8\u05E4\u05EA \u05DC\u05E6\u05D5\u05D5\u05EA \u05E0\u05D5\u05EA\u05E0\u05D9 \u05D4\u05E9\u05D9\u05E8\u05D5\u05EA \u05E9\u05DC Pet Wash\u2122. \u05DB\u05E0\u05D5\u05EA\u05DF \u05E9\u05D9\u05E8\u05D5\u05EA \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9, \u05EA\u05E7\u05D1\u05DC \u05D2\u05D9\u05E9\u05D4 \u05DC\u05DC\u05D5\u05D7 \u05D1\u05E7\u05E8\u05D4 \u05D9\u05D9\u05E2\u05D5\u05D3\u05D9 \u05E2\u05DD \u05DB\u05DC \u05D4\u05DB\u05DC\u05D9\u05DD \u05E9\u05D0\u05EA\u05D4 \u05E6\u05E8\u05D9\u05DA \u05DC\u05E0\u05D4\u05DC \u05D0\u05EA \u05D4\u05E2\u05E1\u05E7 \u05E9\u05DC\u05DA.'
            : 'Thank you for joining the Pet Wash\u2122 provider team. As a professional service provider, you\'ll get access to a dedicated dashboard with all the tools you need to manage your business.'}
        </p>
        
        <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 2px; padding: 28px; margin: 32px 0;">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #0d9488; margin: 0 0 20px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'};">
            ${isHebrew ? '\u05E4\u05E8\u05D8\u05D9 \u05D4\u05D1\u05E7\u05E9\u05D4' : 'Application Details'}
          </h3>
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? '\u05DE\u05E1\u05E4\u05E8 \u05D1\u05E7\u05E9\u05D4:' : 'Application ID:'}</span>
            <span style="color: #0f172a; font-weight: 500; font-family: 'Courier New', monospace;">#${data.applicationId}</span>
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
            <span style="color: #64748b;">${isHebrew ? '\u05EA\u05E4\u05E7\u05D9\u05D3:' : 'Role:'}</span>
            <span style="color: #0d9488; font-weight: 500;">${isHebrew ? providerLabel.he : providerLabel.en}</span>
          </div>
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? '\u05EA\u05D0\u05E8\u05D9\u05DA \u05D4\u05D2\u05E9\u05D4:' : 'Submit Date:'}</span>
            <span style="color: #0f172a; font-weight: 500;">${joinDate}</span>
          </div>
          <div style="padding: 12px 0; display: flex; justify-content: space-between; font-size: 14px; ${isHebrew ? 'direction: rtl;' : ''}">
            <span style="color: #64748b;">${isHebrew ? '\u05E1\u05D8\u05D8\u05D5\u05E1:' : 'Status:'}</span>
            <span style="color: ${data.autoApproved ? '#0d9488' : '#b45309'}; font-weight: 600;">
              ${data.autoApproved
                ? (isHebrew ? '\u2713 \u05DE\u05D0\u05D5\u05E9\u05E8' : '\u2713 Approved')
                : (isHebrew ? '\u2026 \u05D1\u05D1\u05D3\u05D9\u05E7\u05D4' : '\u2026 Under Review')}
            </span>
          </div>
        </div>
        
        ${servicesHtml ? `
        <div style="margin: 28px 0; text-align: ${isHebrew ? 'right' : 'left'};">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #0d9488; margin: 0 0 14px; font-weight: 600;">
            ${isHebrew ? '\u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD \u05E9\u05E0\u05D1\u05D7\u05E8\u05D5' : 'Selected Services'}
          </h3>
          ${servicesHtml}
        </div>
        ` : ''}
        
        <div style="background: linear-gradient(135deg, #f0fdfa, #ccfbf1); border: 1px solid #99f6e4; border-radius: 2px; padding: 32px; margin: 36px 0;">
          <h3 style="font-size: 16px; color: #0f172a; margin: 0 0 20px; text-align: ${isHebrew ? 'right' : 'left'}; font-family: 'Georgia', serif; font-weight: 400;">
            ${isHebrew ? '\u05DC\u05D5\u05D7 \u05D4\u05D1\u05E7\u05E8\u05D4 \u05D4\u05DE\u05E7\u05E6\u05D5\u05E2\u05D9 \u05E9\u05DC\u05DA' : 'Your Professional Dashboard'}
          </h3>
          <p style="font-size: 14px; color: #0f766e; margin: 0 0 20px; text-align: ${isHebrew ? 'right' : 'left'}; line-height: 1.7;">
            ${isHebrew
              ? '\u05DB\u05E0\u05D5\u05EA\u05DF \u05E9\u05D9\u05E8\u05D5\u05EA \u05D1\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05D4 \u05EA\u05E7\u05D1\u05DC \u05D2\u05D9\u05E9\u05D4 \u05DC\u05DC\u05D5\u05D7 \u05D1\u05E7\u05E8\u05D4 \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9 \u05D4\u05DB\u05D5\u05DC\u05DC:'
              : 'As a Pet Wash\u2122 provider you get access to a professional dashboard including:'}
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #115e59; border-bottom: 1px solid #99f6e4; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #14b8a6; font-size: 8px; top: 14px;">\u25C6</span>
              ${isHebrew ? '\u05E7\u05D1\u05DC\u05EA \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D7\u05D3\u05E9\u05D5\u05EA \u05D1\u05D6\u05DE\u05DF \u05D0\u05DE\u05EA \u05E2\u05DD \u05D0\u05D9\u05E9\u05D5\u05E8 \u05DB\u05E4\u05D5\u05DC \u05D1\u05DC\u05D7\u05D9\u05E6\u05D4' : 'Receive new bookings in real-time with dual confirmation'}
            </td></tr>
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #115e59; border-bottom: 1px solid #99f6e4; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #14b8a6; font-size: 8px; top: 14px;">\u25C6</span>
              ${isHebrew ? '\u05E0\u05D9\u05D4\u05D5\u05DC \u05DC\u05D5\u05D7 \u05D6\u05DE\u05E0\u05D9\u05DD \u05D5\u05EA\u05D0\u05E8\u05D9\u05DB\u05D9\u05DD' : 'Schedule and calendar management'}
            </td></tr>
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #115e59; border-bottom: 1px solid #99f6e4; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #14b8a6; font-size: 8px; top: 14px;">\u25C6</span>
              ${isHebrew ? '\u05E6\u05E4\u05D9\u05D9\u05D4 \u05D1\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D9\u05EA \u05E2\u05D1\u05D5\u05D3\u05D5\u05EA \u05E2\u05DD \u05EA\u05D0\u05E8\u05D9\u05DB\u05D9\u05DD \u05D5\u05DE\u05D6\u05D4\u05D9 \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA' : 'View job history with dates and client IDs'}
            </td></tr>
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #115e59; border-bottom: 1px solid #99f6e4; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #14b8a6; font-size: 8px; top: 14px;">\u25C6</span>
              ${isHebrew ? '\u05DE\u05E2\u05E7\u05D1 \u05D0\u05D7\u05E8 \u05D4\u05DB\u05E0\u05E1\u05D5\u05EA \u05D5\u05EA\u05E9\u05DC\u05D5\u05DE\u05D9\u05DD' : 'Track earnings and payments'}
            </td></tr>
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #115e59; border-bottom: 1px solid #99f6e4; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #14b8a6; font-size: 8px; top: 14px;">\u25C6</span>
              ${isHebrew ? '\u05D3\u05D9\u05E8\u05D5\u05D2\u05D9\u05DD \u05D5\u05D1\u05D9\u05E7\u05D5\u05E8\u05D5\u05EA \u05DE\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA' : 'Ratings and reviews from clients'}
            </td></tr>
            <tr><td style="padding: 10px 0; padding-${isHebrew ? 'right' : 'left'}: 24px; font-size: 14px; color: #115e59; position: relative; text-align: ${isHebrew ? 'right' : 'left'}; vertical-align: top;">
              <span style="position: absolute; ${isHebrew ? 'right: 0;' : 'left: 0;'} color: #14b8a6; font-size: 8px; top: 14px;">\u25C6</span>
              ${isHebrew ? '\u05E0\u05D9\u05D4\u05D5\u05DC \u05DE\u05E6\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D5\u05E1\u05D8\u05D8\u05D9\u05E1\u05D8\u05D9\u05E7\u05D5\u05EA \u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD' : 'Manage availability status and performance statistics'}
            </td></tr>
          </table>
        </div>
        
        <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-${isHebrew ? 'right' : 'left'}: 3px solid #0d9488; border-radius: 2px; padding: 20px 24px; margin: 28px 0;">
          <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 6px;">
            ${isHebrew ? '\u05DE\u05D1\u05E0\u05D4 \u05E2\u05DE\u05DC\u05D5\u05EA:' : 'Commission Structure:'}
          </strong>
          <span style="font-size: 13px; color: #475569; line-height: 1.7;">
            ${isHebrew
              ? 'Pet Wash\u2122 \u05D2\u05D5\u05D1\u05D4 \u05E2\u05DE\u05DC\u05D4 \u05E7\u05D1\u05D5\u05E2\u05D4 \u05E9\u05DC 15% \u05E2\u05DC \u05DB\u05DC \u05D4\u05D6\u05DE\u05E0\u05D4. 85% \u05DE\u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05DE\u05D5\u05E2\u05D1\u05E8 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05D0\u05DC\u05D9\u05DA.'
              : 'Pet Wash\u2122 charges a flat 15% commission on every booking. 85% of the payment goes directly to you.'}
          </span>
        </div>
        
        ${!data.autoApproved ? `
        <div style="margin: 36px 0;">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #0d9488; margin: 0 0 24px; font-weight: 600; text-align: ${isHebrew ? 'right' : 'left'};">
            ${isHebrew ? '\u05D4\u05E9\u05DC\u05D1\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD' : 'Next Steps'}
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 36px; vertical-align: top; padding: 8px 0;">
                <div style="width: 32px; height: 32px; border-radius: 2px; background: linear-gradient(135deg, #0f172a, #1e293b); color: #99f6e4; display: inline-block; text-align: center; line-height: 32px; font-size: 14px; font-weight: 600;">1</div>
              </td>
              <td style="padding: 8px 0 8px ${isHebrew ? '0' : '12px'}; padding-${isHebrew ? 'right' : 'left'}: 12px; vertical-align: top;">
                <h4 style="font-size: 14px; color: #0f172a; margin: 4px 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? '\u05D0\u05D9\u05DE\u05D5\u05EA \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD' : 'Document Verification'}</h4>
                <p style="font-size: 13px; color: #64748b; margin: 4px 0 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? '\u05D4\u05E6\u05D5\u05D5\u05EA \u05E9\u05DC\u05E0\u05D5 \u05D1\u05D5\u05D3\u05E7 \u05D0\u05EA \u05D4\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD \u05E9\u05D4\u05D2\u05E9\u05EA' : 'Our team is reviewing your submitted documents'}</p>
              </td>
            </tr>
            <tr>
              <td style="width: 36px; vertical-align: top; padding: 8px 0;">
                <div style="width: 32px; height: 32px; border-radius: 2px; background: linear-gradient(135deg, #0f172a, #1e293b); color: #99f6e4; display: inline-block; text-align: center; line-height: 32px; font-size: 14px; font-weight: 600;">2</div>
              </td>
              <td style="padding: 8px 0 8px ${isHebrew ? '0' : '12px'}; padding-${isHebrew ? 'right' : 'left'}: 12px; vertical-align: top;">
                <h4 style="font-size: 14px; color: #0f172a; margin: 4px 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? '\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D7\u05E9\u05D1\u05D5\u05DF' : 'Account Approval'}</h4>
                <p style="font-size: 13px; color: #64748b; margin: 4px 0 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? '\u05E0\u05E2\u05D3\u05DB\u05DF \u05D0\u05D5\u05EA\u05DA \u05D1\u05DE\u05D9\u05D9\u05DC \u05D5\u05D1\u05D4\u05D5\u05D3\u05E2\u05EA \u05D8\u05E7\u05E1\u05D8 \u05D1\u05E8\u05D2\u05E2 \u05E9\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05D9\u05D0\u05D5\u05E9\u05E8' : 'We\'ll notify you via email and SMS once approved'}</p>
              </td>
            </tr>
            <tr>
              <td style="width: 36px; vertical-align: top; padding: 8px 0;">
                <div style="width: 32px; height: 32px; border-radius: 2px; background: linear-gradient(135deg, #0f172a, #1e293b); color: #99f6e4; display: inline-block; text-align: center; line-height: 32px; font-size: 14px; font-weight: 600;">3</div>
              </td>
              <td style="padding: 8px 0 8px ${isHebrew ? '0' : '12px'}; padding-${isHebrew ? 'right' : 'left'}: 12px; vertical-align: top;">
                <h4 style="font-size: 14px; color: #0f172a; margin: 4px 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? '\u05D4\u05EA\u05D7\u05DC \u05DC\u05E2\u05D1\u05D5\u05D3' : 'Start Working'}</h4>
                <p style="font-size: 13px; color: #64748b; margin: 4px 0 0; text-align: ${isHebrew ? 'right' : 'left'};">${isHebrew ? '\u05D4\u05EA\u05D7\u05D1\u05E8 \u05DC\u05DC\u05D5\u05D7 \u05D4\u05D1\u05E7\u05E8\u05D4, \u05D4\u05E4\u05E2\u05DC \u05DE\u05E6\u05D1 \u05DE\u05E7\u05D5\u05D5\u05DF \u05D5\u05D4\u05EA\u05D7\u05DC \u05DC\u05E7\u05D1\u05DC \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA' : 'Log into your dashboard, go online, and start receiving bookings'}</p>
              </td>
            </tr>
          </table>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="https://petwash.co.il/provider/dashboard" style="display: inline-block; background: linear-gradient(135deg, #0f172a, #1e293b); color: #99f6e4; text-decoration: none; padding: 16px 44px; border-radius: 2px; font-size: 14px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; font-family: 'Georgia', serif;">
            ${isHebrew ? '\u05DC\u05D5\u05D7 \u05D4\u05D1\u05E7\u05E8\u05D4 \u05E9\u05DC\u05D9' : 'My Dashboard'}
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
          <a href="https://petwash.co.il" style="color: #5eead4; text-decoration: none; font-size: 13px; letter-spacing: 0.5px;">petwash.co.il</a>
          <span style="color: rgba(255,255,255,0.2); margin: 0 8px;">\u2502</span>
          <a href="mailto:Support@PetWash.co.il" style="color: #5eead4; text-decoration: none; font-size: 13px;">Support@PetWash.co.il</a>
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