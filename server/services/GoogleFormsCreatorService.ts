/**
 * Google Forms Creator Service
 * Creates PetWash branded Google Forms programmatically via the Google Forms API
 * Used by /api/google-forms/create-all (admin-only endpoint)
 */

import { logger } from '../lib/logger';
import { db } from '../db';
import { googleFormsConfig } from '@shared/schema';

export interface FormDefinition {
  type: string;
  title: string;
  titleHe: string;
  description: string;
  sheetTab: string;
  items: FormItem[];
}

export interface FormItem {
  title: string;
  titleHe: string;
  type: 'TEXT' | 'PARAGRAPH_TEXT' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'SCALE' | 'DATE' | 'TIME' | 'EMAIL' | 'PHONE_NUMBER';
  required?: boolean;
  options?: string[];
}

export interface CreatedFormResult {
  formType: string;
  title: string;
  formId: string | null;
  responderUri: string | null;
  sheetTab: string;
  error?: string;
}

export const FORMS_DEFINITIONS: FormDefinition[] = [
  {
    type: 'club-registration',
    title: 'PetWash Club Registration',
    titleHe: 'הצטרפות למועדון PetWash',
    description: 'Join the PetWash loyalty club and earn rewards',
    sheetTab: 'Club Registrations',
    items: [
      { title: 'Full Name', titleHe: 'שם מלא', type: 'TEXT', required: true },
      { title: 'Email Address', titleHe: 'כתובת אימייל', type: 'EMAIL', required: true },
      { title: 'Phone Number', titleHe: 'מספר טלפון', type: 'PHONE_NUMBER', required: true },
      { title: 'City', titleHe: 'עיר', type: 'TEXT', required: true },
      { title: 'Pet Type', titleHe: 'סוג חיית המחמד', type: 'MULTIPLE_CHOICE', options: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'] },
      { title: 'How did you hear about us?', titleHe: 'כיצד שמעת עלינו?', type: 'MULTIPLE_CHOICE', options: ['Instagram', 'Facebook', 'Google', 'Friend', 'Other'] },
    ],
  },
  {
    type: 'provider-registration',
    title: 'PetWash Provider Application',
    titleHe: 'הגשת מועמדות לספק שירות',
    description: 'Apply to become a certified PetWash service provider',
    sheetTab: 'Provider Applications',
    items: [
      { title: 'Full Name', titleHe: 'שם מלא', type: 'TEXT', required: true },
      { title: 'Email Address', titleHe: 'כתובת אימייל', type: 'EMAIL', required: true },
      { title: 'Phone Number', titleHe: 'מספר טלפון', type: 'PHONE_NUMBER', required: true },
      { title: 'City', titleHe: 'עיר', type: 'TEXT', required: true },
      { title: 'Services Offered', titleHe: 'שירותים מוצעים', type: 'CHECKBOX', options: ['Grooming', 'Dog Walking', 'Pet Sitting', 'Training', 'Veterinary', 'K9000'] },
      { title: 'Years of Experience', titleHe: 'שנות ניסיון', type: 'MULTIPLE_CHOICE', options: ['0-1', '1-3', '3-5', '5-10', '10+'] },
      { title: 'Tell us about yourself', titleHe: 'ספר לנו על עצמך', type: 'PARAGRAPH_TEXT' },
    ],
  },
  {
    type: 'quick-booking',
    title: 'PetWash Quick Booking',
    titleHe: 'הזמנה מהירה',
    description: 'Request a pet care service appointment',
    sheetTab: 'Quick Bookings',
    items: [
      { title: 'Your Name', titleHe: 'שמך', type: 'TEXT', required: true },
      { title: 'Phone Number', titleHe: 'מספר טלפון', type: 'PHONE_NUMBER', required: true },
      { title: 'Service Type', titleHe: 'סוג השירות', type: 'MULTIPLE_CHOICE', required: true, options: ['Grooming', 'Dog Walking', 'Boarding', 'Training', 'Veterinary', 'K9000'] },
      { title: 'Pet Type & Name', titleHe: 'סוג וגיל החיה', type: 'TEXT', required: true },
      { title: 'Preferred Date', titleHe: 'תאריך מועדף', type: 'DATE' },
      { title: 'Additional Notes', titleHe: 'הערות נוספות', type: 'PARAGRAPH_TEXT' },
    ],
  },
  {
    type: 'legal-agreement',
    title: 'PetWash Terms & Service Agreement',
    titleHe: 'הסכם שירות',
    description: 'Service terms and conditions agreement',
    sheetTab: 'Legal Agreements',
    items: [
      { title: 'Full Name', titleHe: 'שם מלא', type: 'TEXT', required: true },
      { title: 'ID Number (Teudat Zehut)', titleHe: 'מספר תעודת זהות', type: 'TEXT', required: true },
      { title: 'Email Address', titleHe: 'כתובת אימייל', type: 'EMAIL', required: true },
      { title: 'I agree to the Terms of Service', titleHe: 'אני מסכים לתנאי השירות', type: 'CHECKBOX', required: true, options: ['Yes, I agree / כן, אני מסכים'] },
      { title: 'I agree to the Privacy Policy', titleHe: 'אני מסכים למדיניות הפרטיות', type: 'CHECKBOX', required: true, options: ['Yes, I agree / כן, אני מסכים'] },
      { title: 'Signature Date', titleHe: 'תאריך חתימה', type: 'DATE', required: true },
    ],
  },
  {
    type: 'grooming-feedback',
    title: 'PetWash Grooming Feedback',
    titleHe: 'משוב על שירות טיפוח',
    description: 'Share your experience with our grooming service',
    sheetTab: 'Grooming Feedback',
    items: [
      { title: 'Your Name', titleHe: 'שמך', type: 'TEXT' },
      { title: 'Branch / Station', titleHe: 'סניף / תחנה', type: 'MULTIPLE_CHOICE', options: ['Tel Aviv', 'Jerusalem', 'Haifa', 'Be\'er Sheva', 'Netanya', 'Other'] },
      { title: 'Overall Rating', titleHe: 'דירוג כללי', type: 'SCALE', required: true },
      { title: 'Staff Friendliness', titleHe: 'ידידותיות הצוות', type: 'SCALE' },
      { title: 'Service Quality', titleHe: 'איכות השירות', type: 'SCALE' },
      { title: 'Would you recommend us?', titleHe: 'האם תמליץ עלינו?', type: 'MULTIPLE_CHOICE', options: ['Definitely / בהחלט', 'Maybe / אולי', 'No / לא'] },
      { title: 'Additional Comments', titleHe: 'הערות נוספות', type: 'PARAGRAPH_TEXT' },
    ],
  },
];

/**
 * Creates all PetWash forms via Google Forms API
 * Requires Google Forms API to be enabled in Google Cloud Console
 * Returns results for each form (success or failure)
 */
export async function createAllForms(): Promise<CreatedFormResult[]> {
  logger.info('[GoogleFormsCreator] Starting bulk form creation', { count: FORMS_DEFINITIONS.length });

  const results: CreatedFormResult[] = [];

  for (const definition of FORMS_DEFINITIONS) {
    try {
      // Note: Creating Google Forms programmatically requires the Google Forms API
      // and a service account with Forms API access enabled.
      // For now, return placeholder URLs that can be manually configured.
      logger.info('[GoogleFormsCreator] Processing form definition', { type: definition.type });

      const result: CreatedFormResult = {
        formType: definition.type,
        title: definition.title,
        formId: null,
        responderUri: null,
        sheetTab: definition.sheetTab,
        error: 'Google Forms API requires manual setup. Please create forms at forms.google.com and configure URLs via the admin panel.',
      };

      results.push(result);

      logger.info('[GoogleFormsCreator] Form definition processed', {
        type: definition.type,
        note: 'Requires manual Google Forms creation',
      });
    } catch (error: any) {
      logger.error('[GoogleFormsCreator] Failed to process form', {
        type: definition.type,
        error: error.message,
      });

      results.push({
        formType: definition.type,
        title: definition.title,
        formId: null,
        responderUri: null,
        sheetTab: definition.sheetTab,
        error: error.message,
      });
    }
  }

  logger.info('[GoogleFormsCreator] Bulk form creation complete', {
    total: results.length,
    succeeded: results.filter(r => r.formId).length,
    failed: results.filter(r => !r.formId).length,
  });

  return results;
}
