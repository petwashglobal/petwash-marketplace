export type WelcomeSMSType = 'CUSTOMER' | 'PROVIDER' | 'STAFF';

interface WelcomeSMSParams {
  firstName: string;
  membershipId: string;
  language: 'he' | 'en';
}

const TEMPLATES: Record<WelcomeSMSType, Record<'he' | 'en', (p: WelcomeSMSParams) => string>> = {
  CUSTOMER: {
    he: (p) =>
      `ברוכים הבאים ל-PetWash.\n` +
      `מספר חברות: ${p.membershipId}\n\n` +
      `השלימו את הפרופיל:\n` +
      `https://petwash.co.il/complete-profile\n\n` +
      `תמיכה: support@petwash.co.il`,

    en: (p) =>
      `Welcome to PetWash.\n` +
      `Your Member ID: ${p.membershipId}\n\n` +
      `Complete your profile:\n` +
      `https://petwash.co.il/complete-profile\n\n` +
      `Support: support@petwash.co.il`,
  },

  PROVIDER: {
    he: (p) =>
      `ברוכים הבאים ל-PetWash Providers.\n` +
      `מספר ספק: ${p.membershipId}\n\n` +
      `התחילו את תהליך הצטרפות:\n` +
      `https://petwash.co.il/provider-onboarding\n\n` +
      `אימות זהות נדרש לפני הפעלה.`,

    en: (p) =>
      `Welcome to PetWash Providers.\n` +
      `Your Provider ID: ${p.membershipId}\n\n` +
      `Start onboarding:\n` +
      `https://petwash.co.il/provider-onboarding\n\n` +
      `Identity verification is required to go live.`,
  },

  STAFF: {
    he: (p) =>
      `בקשת צוות PetWash התקבלה.\n` +
      `מספר בקשה: ${p.membershipId}\n\n` +
      `הגישה תופעל לאחר אישור.`,

    en: (p) =>
      `PetWash Staff request received.\n` +
      `Your Request ID: ${p.membershipId}\n\n` +
      `Access will be enabled after approval.`,
  },
};

export function renderWelcomeSMS(type: WelcomeSMSType, params: WelcomeSMSParams): string {
  return TEMPLATES[type][params.language](params);
}

export function getTemplateId(type: WelcomeSMSType): string {
  return `welcome_${type.toLowerCase()}_v2`;
}
