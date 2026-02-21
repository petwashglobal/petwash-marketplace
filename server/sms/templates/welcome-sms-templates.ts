export type WelcomeSMSType = 'CUSTOMER' | 'PROVIDER' | 'STAFF';

interface WelcomeSMSParams {
  firstName: string;
  membershipId: string;
  language: 'he' | 'en';
}

const TEMPLATES: Record<WelcomeSMSType, Record<'he' | 'en', (p: WelcomeSMSParams) => string>> = {
  CUSTOMER: {
    he: (p) =>
      `Pet Wash™ - ברוכים הבאים! 🐾\n\n` +
      `שלום ${p.firstName},\n` +
      `ברוכים הבאים למשפחת Pet Wash™!\n\n` +
      `מספר חברות: ${p.membershipId}\n\n` +
      `שמרו על המספר הזה - הוא המפתח שלכם לעולם של טיפוח פרימיום לחיות המחמד.\n\n` +
      `התחילו עכשיו: petwash.co.il/complete-profile\n\n` +
      `Pet Wash™ - Premium Pet Care`,

    en: (p) =>
      `Pet Wash™ - Welcome! 🐾\n\n` +
      `Hi ${p.firstName},\n` +
      `Welcome to the Pet Wash™ family!\n\n` +
      `Membership #: ${p.membershipId}\n\n` +
      `Keep this number safe - it's your key to premium pet care services.\n\n` +
      `Get started: petwash.co.il/complete-profile\n\n` +
      `Pet Wash™ - Premium Pet Care`,
  },

  PROVIDER: {
    he: (p) =>
      `Pet Wash™ - ברוכים הבאים לצוות! 🐾\n\n` +
      `שלום ${p.firstName},\n` +
      `הבקשה שלך התקבלה בהצלחה.\n\n` +
      `מספר ספק: ${p.membershipId}\n\n` +
      `הצוות שלנו יבדוק את הבקשה ויחזור אליך תוך 48 שעות.\n\n` +
      `מעקב: petwash.co.il/provider-onboarding\n\n` +
      `Pet Wash™ - Premium Pet Care`,

    en: (p) =>
      `Pet Wash™ - Welcome to the Team! 🐾\n\n` +
      `Hi ${p.firstName},\n` +
      `Your application has been received.\n\n` +
      `Provider #: ${p.membershipId}\n\n` +
      `Our team will review your application within 48 hours.\n\n` +
      `Track status: petwash.co.il/provider-onboarding\n\n` +
      `Pet Wash™ - Premium Pet Care`,
  },

  STAFF: {
    he: (p) =>
      `Pet Wash™ - קבלת בקשת צוות 🐾\n\n` +
      `שלום ${p.firstName},\n` +
      `בקשת ההצטרפות שלך לצוות Pet Wash™ התקבלה.\n\n` +
      `מספר עובד: ${p.membershipId}\n\n` +
      `משאבי אנוש ייצרו איתך קשר בקרוב.\n\n` +
      `Pet Wash™ - Premium Pet Care`,

    en: (p) =>
      `Pet Wash™ - Staff Request Received 🐾\n\n` +
      `Hi ${p.firstName},\n` +
      `Your Pet Wash™ team application has been received.\n\n` +
      `Staff #: ${p.membershipId}\n\n` +
      `HR will be in touch with you shortly.\n\n` +
      `Pet Wash™ - Premium Pet Care`,
  },
};

export function renderWelcomeSMS(type: WelcomeSMSType, params: WelcomeSMSParams): string {
  return TEMPLATES[type][params.language](params);
}

export function getTemplateId(type: WelcomeSMSType): string {
  return `welcome_${type.toLowerCase()}_v1`;
}
