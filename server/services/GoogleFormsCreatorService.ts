import { google } from 'googleapis';
import { logger } from '../lib/logger';
import { db } from '../db';
import { googleFormsConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { appendFormSubmission } from './googleSheetsIntegration';

const SCOPES = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (!raw.startsWith('{')) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}

type FormItem = {
  title: string;
  description?: string;
  required?: boolean;
  type: 'text' | 'paragraph' | 'choice' | 'scale' | 'email' | 'phone' | 'date';
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
};

function buildItem(item: FormItem, index: number) {
  const base: any = {
    createItem: {
      item: {
        title: item.title,
        description: item.description,
      },
      location: { index },
    },
  };

  if (item.type === 'scale') {
    base.createItem.item.questionItem = {
      question: {
        required: item.required !== false,
        scaleQuestion: {
          low: item.scaleMin ?? 1,
          high: item.scaleMax ?? 5,
          lowLabel: item.scaleMinLabel ?? 'גרוע / Poor',
          highLabel: item.scaleMaxLabel ?? 'מצוין / Excellent',
        },
      },
    };
  } else if (item.type === 'choice') {
    base.createItem.item.questionItem = {
      question: {
        required: item.required !== false,
        choiceQuestion: {
          type: 'DROP_DOWN',
          options: (item.options || []).map(v => ({ value: v })),
        },
      },
    };
  } else if (item.type === 'paragraph') {
    base.createItem.item.questionItem = {
      question: {
        required: item.required !== false,
        textQuestion: { paragraph: true },
      },
    };
  } else {
    base.createItem.item.questionItem = {
      question: {
        required: item.required !== false,
        textQuestion: { paragraph: false },
      },
    };
  }

  return base;
}

async function createForm(
  title: string,
  titleHe: string,
  description: string,
  items: FormItem[],
): Promise<{ formId: string; formUrl: string; responderUri: string }> {
  const auth = getAuth();
  const authClient = await auth.getClient();
  const forms = google.forms({ version: 'v1', auth: authClient as any });

  const created = await forms.forms.create({
    requestBody: {
      info: {
        title: `${title} | ${titleHe}`,
        documentTitle: title,
      },
    },
  });

  const formId = created.data.formId!;

  const updateRequests = [
    {
      updateFormInfo: {
        info: { description },
        updateMask: 'description',
      },
    },
    ...items.map((item, i) => buildItem(item, i)),
  ];

  await forms.forms.batchUpdate({
    formId,
    requestBody: { requests: updateRequests },
  });

  const responderUri = `https://docs.google.com/forms/d/${formId}/viewform`;
  const formUrl = `https://docs.google.com/forms/d/${formId}/viewform?embedded=true`;

  return { formId, formUrl, responderUri };
}

async function saveFormConfig(
  formType: string,
  formUrl: string,
  formTitle: string,
  formTitleHe: string,
) {
  const existing = await db.select().from(googleFormsConfig).where(eq(googleFormsConfig.formType, formType)).limit(1);
  if (existing.length > 0) {
    await db.update(googleFormsConfig).set({ formUrl, formTitle, formTitleHe, updatedAt: new Date() }).where(eq(googleFormsConfig.formType, formType));
  } else {
    await db.insert(googleFormsConfig).values({ formType, formUrl, formTitle, formTitleHe, enabled: true, height: 900 });
  }
}

export type CreatedForm = {
  formType: string;
  title: string;
  formId: string;
  responderUri: string;
  sheetTab: string;
};

const FORMS_DEFINITIONS: Array<{
  type: string;
  title: string;
  titleHe: string;
  description: string;
  sheetTab: string;
  items: FormItem[];
}> = [
  {
    type: 'review',
    title: 'Customer Review & Rating',
    titleHe: 'ביקורת לקוח וציון',
    description: 'Share your experience with PetWash™ services. Your feedback helps us improve.\nשתפו את חווייתכם עם שירותי PetWash™.',
    sheetTab: 'Feedback & Reviews',
    items: [
      { title: 'Full Name / שם מלא', type: 'text', required: true },
      { title: 'Email Address / כתובת אימייל', type: 'text', required: true },
      { title: 'Phone Number / מספר טלפון', type: 'text', required: false },
      { title: 'Service Platform / פלטפורמה', type: 'choice', required: true, options: ['K9000 Dog Wash', 'Sitter Suite', 'Walk My Pet', 'PetTrek Transport', 'PetWash Academy', 'Other / אחר'] },
      { title: 'Service Date / תאריך השירות', type: 'date', required: false },
      { title: 'City / עיר', type: 'text', required: false },
      { title: 'Overall Rating / ציון כולל (1–5)', type: 'scale', required: true, scaleMin: 1, scaleMax: 5, scaleMinLabel: 'גרוע / Poor', scaleMaxLabel: 'מצוין / Excellent' },
      { title: 'Quality of Service / איכות השירות (1–5)', type: 'scale', required: true, scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Needs Improvement', scaleMaxLabel: 'Outstanding' },
      { title: 'Provider Professionalism / מקצועיות הספק (1–5)', type: 'scale', required: true, scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Unprofessional', scaleMaxLabel: 'Highly Professional' },
      { title: 'Value for Money / תמורה לכסף (1–5)', type: 'scale', required: true, scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Poor Value', scaleMaxLabel: 'Excellent Value' },
      { title: 'Review Title / כותרת הביקורת', type: 'text', required: false },
      { title: 'Your Review / ביקורתכם', description: 'Please describe your experience in detail.', type: 'paragraph', required: true },
      { title: 'Would You Recommend PetWash™? / ממליצים?', type: 'choice', required: true, options: ['Yes, definitely / כן, בהחלט', 'Probably yes / כנראה שכן', 'Not sure / לא בטוח', 'Probably not / כנראה שלא', 'No / לא'] },
      { title: 'Booking Reference / מזהה הזמנה', type: 'text', required: false },
      { title: 'How did you hear about us? / איך שמעתם עלינו?', type: 'choice', required: false, options: ['Google Search', 'Social Media', 'Friend Referral', 'Returning Customer', 'Other'] },
    ],
  },
  {
    type: 'provider_application',
    title: 'Provider Onboarding Application',
    titleHe: 'בקשת הצטרפות כספק שירות',
    description: 'Apply to join the PetWash™ provider network. We review all applications within 2–3 business days.\nהגישו מועמדות להצטרף לרשת הספקים של PetWash™.',
    sheetTab: 'Provider Applications',
    items: [
      { title: 'First Name / שם פרטי', type: 'text', required: true },
      { title: 'Last Name / שם משפחה', type: 'text', required: true },
      { title: 'Email Address / כתובת אימייל', type: 'text', required: true },
      { title: 'Phone Number / מספר טלפון', type: 'text', required: true },
      { title: 'Date of Birth / תאריך לידה', type: 'date', required: true },
      { title: 'Street Address / כתובת', type: 'text', required: true },
      { title: 'City / עיר', type: 'text', required: true },
      { title: 'Country / מדינה', type: 'choice', required: true, options: ['Israel / ישראל', 'United Kingdom', 'Australia', 'Canada', 'United States', 'Other'] },
      { title: 'ID Number / מספר תעודת זהות', type: 'text', required: true },
      { title: 'Service Type / סוג שירות', type: 'choice', required: true, options: ['K9000 Wash Station Operator', 'Pet Sitter (Sitter Suite)', 'Dog Walker (Walk My Pet)', 'Transport Driver (PetTrek)', 'Pet Trainer (Academy)', 'Multiple Services'] },
      { title: 'Years of Experience with Animals / שנות ניסיון עם בעלי חיים', type: 'choice', required: true, options: ['Less than 1 year', '1–2 years', '3–5 years', '6–10 years', 'More than 10 years'] },
      { title: 'Languages Spoken / שפות', type: 'text', required: false, description: 'e.g. Hebrew, English, Arabic' },
      { title: 'Availability / זמינות', type: 'choice', required: true, options: ['Full-time / משרה מלאה', 'Part-time / חצי משרה', 'Weekends only / סופי שבוע', 'Evenings only / ערבים', 'Flexible / גמיש'] },
      { title: 'Do you have a vehicle? / יש לכם רכב?', type: 'choice', required: true, options: ['Yes - Car / כן - מכונית', 'Yes - Motorcycle / כן - אופנוע', 'No / לא'] },
      { title: 'Have you worked with a pet care service before? / עבדתם עם שירות טיפול בחיות לפני?', type: 'choice', required: false, options: ['Yes / כן', 'No / לא'] },
      { title: 'Brief Bio / קצת עליכם', description: 'Tell us about yourself, your experience with animals, and why you want to join PetWash™.', type: 'paragraph', required: true },
      { title: 'Emergency Contact Name / שם איש קשר לחירום', type: 'text', required: false },
      { title: 'Emergency Contact Phone / טלפון חירום', type: 'text', required: false },
      { title: 'How did you hear about us? / איך שמעתם עלינו?', type: 'choice', required: false, options: ['Online Search', 'Social Media', 'Referred by Friend', 'Job Board', 'Other'] },
    ],
  },
  {
    type: 'hr_job_application',
    title: 'HR Job Application',
    titleHe: 'בקשת מועמדות לתפקיד',
    description: 'Apply for a position at PetWash™ HQ or regional offices.\nהגישו מועמדות לתפקיד במשרדי PetWash™.',
    sheetTab: 'HR Job Applications',
    items: [
      { title: 'First Name / שם פרטי', type: 'text', required: true },
      { title: 'Last Name / שם משפחה', type: 'text', required: true },
      { title: 'Email Address / כתובת אימייל', type: 'text', required: true },
      { title: 'Phone Number / מספר טלפון', type: 'text', required: true },
      { title: 'Date of Birth / תאריך לידה', type: 'date', required: false },
      { title: 'Street Address / כתובת', type: 'text', required: true },
      { title: 'City / עיר', type: 'text', required: true },
      { title: 'Country / מדינה', type: 'choice', required: true, options: ['Israel / ישראל', 'United Kingdom', 'Australia', 'Canada', 'United States', 'Other'] },
      { title: 'Position Applying For / תפקיד מבוקש', type: 'choice', required: true, options: ['Operations Manager', 'Customer Success', 'Software Engineer', 'Data Analyst', 'Marketing & Growth', 'Finance & Accounting', 'Legal & Compliance', 'Sales Executive', 'Regional Manager', 'Other / אחר'] },
      { title: 'Department / מחלקה', type: 'choice', required: true, options: ['Engineering / הנדסה', 'Operations / תפעול', 'Customer Success / שירות לקוחות', 'Marketing / שיווק', 'Finance / כספים', 'HR / משאבי אנוש', 'Legal / משפטי', 'Sales / מכירות'] },
      { title: 'Years of Experience / שנות ניסיון', type: 'choice', required: true, options: ['0–1 years (Entry)', '2–3 years', '4–6 years', '7–10 years', '10+ years (Senior)'] },
      { title: 'Education Level / השכלה', type: 'choice', required: true, options: ['High School / תיכון', 'Vocational / מקצועי', "Bachelor's Degree / תואר ראשון", "Master's Degree / תואר שני", 'PhD / דוקטורט', 'Other'] },
      { title: 'ID / Tax Number / ת.ז. או מספר מס', type: 'text', required: false },
      { title: 'LinkedIn / Portfolio URL', type: 'text', required: false },
      { title: 'Expected Salary (₪ / month) / משכורת מבוקשת', type: 'text', required: false },
      { title: 'Available Start Date / תאריך התחלה אפשרי', type: 'date', required: false },
      { title: 'Cover Letter / מכתב מוטיבציה', description: 'Tell us why you want to work at PetWash™ and what you bring to the team.', type: 'paragraph', required: true },
      { title: 'References Available? / אסמכתאות?', type: 'choice', required: false, options: ['Yes, upon request / כן, לפי בקשה', 'No / לא'] },
      { title: 'How did you hear about this position?', type: 'choice', required: false, options: ['LinkedIn', 'Indeed', 'Company Website', 'Referred by Employee', 'Social Media', 'Other'] },
    ],
  },
  {
    type: 'franchise_inquiry',
    title: 'Franchise Inquiry',
    titleHe: 'פנייה לזיכיון',
    description: 'Interested in opening a PetWash™ location? Fill in the form and our franchise team will contact you.\nמעוניינים לפתוח סניף PetWash™? מלאו את הטופס.',
    sheetTab: 'Franchise Inquiries',
    items: [
      { title: 'Full Name / שם מלא', type: 'text', required: true },
      { title: 'Company Name / שם חברה', type: 'text', required: false },
      { title: 'Email Address / כתובת אימייל', type: 'text', required: true },
      { title: 'Phone Number / מספר טלפון', type: 'text', required: true },
      { title: 'Street Address / כתובת', type: 'text', required: false },
      { title: 'City / עיר', type: 'text', required: true },
      { title: 'Country / מדינה', type: 'choice', required: true, options: ['Israel / ישראל', 'United Kingdom', 'Australia', 'Canada', 'United States', 'Other'] },
      { title: 'Preferred Location for Franchise / מיקום מבוקש לזיכיון', type: 'text', required: true },
      { title: 'Investment Budget / תקציב השקעה', type: 'choice', required: true, options: ['Up to ₪500,000', '₪500K – ₪1M', '₪1M – ₪2M', 'Over ₪2M', 'Open to discussion'] },
      { title: 'Planned Opening Timeline / ציר זמן', type: 'choice', required: true, options: ['Within 3 months', '3–6 months', '6–12 months', '1–2 years', 'Just exploring'] },
      { title: 'Business Experience / ניסיון עסקי', type: 'choice', required: true, options: ['First Business', 'Experienced Entrepreneur', 'Already Own a Franchise', 'Corporate Background', 'Other'] },
      { title: 'Do you have a commercial property in mind? / נכס מסחרי?', type: 'choice', required: false, options: ['Yes, already secured', 'Yes, looking', 'No'] },
      { title: 'Tell us about yourself and your motivation / קצת עליכם ועל המוטיבציה', type: 'paragraph', required: true },
      { title: 'How did you hear about PetWash™? / איך שמעתם?', type: 'choice', required: false, options: ['Google', 'Social Media', 'News Article', 'Friend / Colleague', 'Existing Location', 'Other'] },
    ],
  },
  {
    type: 'sales_lead',
    title: 'Business Inquiry & Sales Lead',
    titleHe: 'פנייה עסקית ולידים',
    description: 'Interested in partnering with PetWash™ or using our enterprise services? We will get back to you within 24 hours.\nמעוניינים בשיתוף פעולה עסקי? נחזור אליכם תוך 24 שעות.',
    sheetTab: 'Sales Leads',
    items: [
      { title: 'Contact Name / שם איש קשר', type: 'text', required: true },
      { title: 'Company / Organization / חברה', type: 'text', required: false },
      { title: 'Email Address / כתובת אימייל', type: 'text', required: true },
      { title: 'Phone Number / מספר טלפון', type: 'text', required: true },
      { title: 'Street Address / כתובת', type: 'text', required: false },
      { title: 'City / עיר', type: 'text', required: true },
      { title: 'Country / מדינה', type: 'choice', required: true, options: ['Israel / ישראל', 'United Kingdom', 'Australia', 'Canada', 'United States', 'Other'] },
      { title: 'Inquiry Type / סוג הפנייה', type: 'choice', required: true, options: ['Enterprise Partnership', 'API Integration', 'Reseller / Distributor', 'White Label Licensing', 'Bulk Bookings', 'Supplier / Vendor', 'Other'] },
      { title: 'Service Interest / שירות מבוקש', type: 'choice', required: true, options: ['K9000 Wash Stations', 'Sitter Suite Platform', 'Walk My Pet', 'PetTrek Transport', 'PetWash Academy', 'Multiple Platforms', 'Full Suite'] },
      { title: 'Estimated Monthly Volume / נפח חודשי משוער', type: 'choice', required: false, options: ['Under ₪10,000', '₪10K–₪50K', '₪50K–₪200K', 'Over ₪200K', "Don't know yet"] },
      { title: 'Number of Pets / Animals Involved / מספר בעלי חיים', type: 'text', required: false },
      { title: 'Brief description of your needs / תיאור קצר של הצרכים שלכם', type: 'paragraph', required: true },
      { title: 'Best time to contact you / הזמן הנוח לצור קשר', type: 'choice', required: false, options: ['Morning 8–12', 'Afternoon 12–17', 'Evening 17–20', 'Anytime / כל זמן'] },
      { title: 'How did you hear about PetWash™?', type: 'choice', required: false, options: ['Google', 'LinkedIn', 'Referral', 'Industry Event', 'News / Media', 'Other'] },
    ],
  },
  {
    type: 'customer_onboarding',
    title: 'Customer Onboarding & Pet Registration',
    titleHe: 'אונבורדינג לקוחות ורישום חיית מחמד',
    description: 'Welcome to PetWash™! Complete your profile and register your pet to get started.\nברוכים הבאים ל-PetWash™! השלימו את פרופילכם.',
    sheetTab: 'Pet Profiles',
    items: [
      { title: 'Owner First Name / שם פרטי', type: 'text', required: true },
      { title: 'Owner Last Name / שם משפחה', type: 'text', required: true },
      { title: 'Email Address / כתובת אימייל', type: 'text', required: true },
      { title: 'Phone Number / מספר טלפון', type: 'text', required: true },
      { title: 'Street Address / כתובת', type: 'text', required: true },
      { title: 'City / עיר', type: 'text', required: true },
      { title: 'Country / מדינה', type: 'choice', required: true, options: ['Israel / ישראל', 'United Kingdom', 'Australia', 'Canada', 'United States', 'Other'] },
      { title: 'Preferred Language / שפה מועדפת', type: 'choice', required: false, options: ['Hebrew / עברית', 'English', 'Arabic / ערבית', 'Russian / רוסית', 'Other'] },
      { title: 'Pet Name / שם החיה', type: 'text', required: true },
      { title: 'Animal Species / סוג בעל חיים', type: 'choice', required: true, options: ['Dog / כלב', 'Cat / חתול', 'Rabbit / ארנב', 'Bird / ציפור', 'Reptile / זוחל', 'Other / אחר'] },
      { title: 'Breed / גזע', type: 'text', required: false },
      { title: 'Age (years) / גיל (שנים)', type: 'text', required: true },
      { title: 'Weight (kg) / משקל (ק"ג)', type: 'text', required: false },
      { title: 'Gender / מין', type: 'choice', required: false, options: ['Male / זכר', 'Female / נקבה', 'Neutered Male / זכר מסורס', 'Spayed Female / נקבה מעוקרת'] },
      { title: 'Microchip Number / מספר שבב', type: 'text', required: false },
      { title: 'Vet Name / שם הווטרינר', type: 'text', required: false },
      { title: 'Vet Phone / טלפון וטרינר', type: 'text', required: false },
      { title: 'Known Allergies / אלרגיות ידועות', type: 'paragraph', required: false },
      { title: 'Medical Notes / הערות רפואיות', description: 'Any conditions, medications, or special needs we should know about.', type: 'paragraph', required: false },
      { title: 'Vaccinations Up to Date? / חיסונים עדכניים?', type: 'choice', required: true, options: ['Yes / כן', 'No / לא', "Don't know / לא יודע"] },
      { title: 'How did you hear about PetWash™?', type: 'choice', required: false, options: ['Google', 'App Store', 'Social Media', 'Friend Referral', 'Vet Recommendation', 'Walk-in / K9000 Station', 'Other'] },
    ],
  },
  {
    type: 'refund_request',
    title: 'Refund Request',
    titleHe: 'בקשת החזר כספי',
    description: 'Submit a refund request for a PetWash™ service. We review all requests within 2–5 business days.\nהגישו בקשה להחזר כספי. אנו בוחנים כל בקשה תוך 2–5 ימי עסקים.',
    sheetTab: 'Refund Requests',
    items: [
      { title: 'Full Name / שם מלא', type: 'text', required: true },
      { title: 'Email Address / כתובת אימייל', type: 'text', required: true },
      { title: 'Phone Number / מספר טלפון', type: 'text', required: true },
      { title: 'Street Address / כתובת', type: 'text', required: false },
      { title: 'City / עיר', type: 'text', required: false },
      { title: 'Booking / Transaction ID / מזהה הזמנה', type: 'text', required: true },
      { title: 'Service Type / סוג שירות', type: 'choice', required: true, options: ['K9000 Dog Wash', 'Sitter Suite', 'Walk My Pet', 'PetTrek Transport', 'PetWash Academy', 'Other'] },
      { title: 'Booking Date / תאריך ההזמנה', type: 'date', required: false },
      { title: 'Amount Paid (₪) / סכום ששולם', type: 'text', required: true },
      { title: 'Refund Amount Requested (₪) / סכום החזר מבוקש', type: 'text', required: true },
      { title: 'Reason for Refund / סיבת ההחזר', type: 'choice', required: true, options: ['Service not provided / השירות לא ניתן', 'Service quality issue / בעיית איכות', 'Pet injury / פציעת חיית מחמד', 'Cancelled by provider / בוטל ע"י ספק', 'Duplicate charge / חיוב כפול', 'Other / אחר'] },
      { title: 'Description of Issue / תיאור הבעיה', type: 'paragraph', required: true },
      { title: 'Preferred Refund Method / שיטת החזר מועדפת', type: 'choice', required: true, options: ['Original payment method / שיטת התשלום המקורית', 'Credit to PetWash™ Wallet / קרדיט לארנק', 'Bank Transfer / העברה בנקאית'] },
    ],
  },
  {
    type: 'contact',
    title: 'Contact & Support',
    titleHe: 'צור קשר ותמיכה',
    description: 'Get in touch with the PetWash™ support team. We respond within 24 hours.\nצרו קשר עם צוות התמיכה של PetWash™. נחזור אליכם תוך 24 שעות.',
    sheetTab: 'Contact & Inquiries',
    items: [
      { title: 'Full Name / שם מלא', type: 'text', required: true },
      { title: 'Email Address / כתובת אימייל', type: 'text', required: true },
      { title: 'Phone Number / מספר טלפון', type: 'text', required: false },
      { title: 'City / עיר', type: 'text', required: false },
      { title: 'Inquiry Type / סוג הפנייה', type: 'choice', required: true, options: ['General Question / שאלה כללית', 'Technical Support / תמיכה טכנית', 'Billing Issue / בעיית חיוב', 'Provider Issue / בעיית ספק', 'Account Issue / בעיית חשבון', 'Feedback / משוב', 'Other / אחר'] },
      { title: 'Platform / פלטפורמה', type: 'choice', required: false, options: ['K9000 Wash', 'Sitter Suite', 'Walk My Pet', 'PetTrek', 'Academy', 'General App', 'Other'] },
      { title: 'Booking Reference / מזהה הזמנה', type: 'text', required: false },
      { title: 'Subject / נושא', type: 'text', required: true },
      { title: 'Message / הודעה', type: 'paragraph', required: true },
      { title: 'Preferred Contact Method / שיטת יצירת קשר מועדפת', type: 'choice', required: false, options: ['Email / אימייל', 'Phone / טלפון', 'WhatsApp', 'Any / כל שיטה'] },
    ],
  },
];

export async function createAllForms(): Promise<CreatedForm[]> {
  const results: CreatedForm[] = [];

  for (const def of FORMS_DEFINITIONS) {
    try {
      logger.info(`[GoogleForms] Creating form: ${def.title}`);
      const { formId, formUrl, responderUri } = await createForm(def.title, def.titleHe, def.description, def.items);
      await saveFormConfig(def.type, formUrl, def.title, def.titleHe);
      results.push({ formType: def.type, title: def.title, formId, responderUri, sheetTab: def.sheetTab });
      logger.info(`[GoogleForms] ✅ Created: ${def.title} → ${responderUri}`);
    } catch (err: any) {
      logger.error(`[GoogleForms] ❌ Failed to create ${def.title}: ${err.message}`);
    }
  }

  return results;
}

export async function syncFormResponses(formId: string, sheetTab: string): Promise<number> {
  try {
    const auth = getAuth();
    const authClient = await auth.getClient();
    const forms = google.forms({ version: 'v1', auth: authClient as any });

    const formData = await forms.forms.get({ formId });
    const items = formData.data.items || [];

    const resp = await forms.forms.responses.list({ formId });
    const responses = resp.data.responses || [];

    for (const response of responses) {
      const answers = response.answers || {};
      const data: Record<string, any> = {
        Timestamp: new Date(response.createTime || '').toISOString(),
        'Response ID': response.responseId,
      };

      for (const item of items) {
        const qId = item.questionItem?.question?.questionId;
        if (!qId) continue;
        const answer = answers[qId];
        if (!answer) continue;
        const val = answer.textAnswers?.answers?.[0]?.value
          || answer.scaleAnswer?.value?.toString()
          || '';
        data[item.title || qId] = val;
      }

      await appendFormSubmission(sheetTab, data, `${formId}:${response.responseId}`);
    }

    return responses.length;
  } catch (err: any) {
    logger.error(`[GoogleForms] Sync failed for ${formId}: ${err.message}`);
    return 0;
  }
}

export { FORMS_DEFINITIONS };
