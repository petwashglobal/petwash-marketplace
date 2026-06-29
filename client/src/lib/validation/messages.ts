/**
 * Centralized, localized validation messages — the validation module's i18n.
 *
 * Keys follow the `validation.*` dotted convention. he + en are defined here
 * (the two languages actually rendered for validation today); any other language
 * falls back to English. Extend an entry with ar/ru/fr/es when ready.
 *
 * Used by every schema file in this folder. Never hardcode validation strings
 * inside forms — reference a schema (which carries the localized message) or
 * call vmsg(key, lang) directly.
 */

export type ValidationLang = 'he' | 'en' | string;

export type ValidationKey =
  // generic
  | 'validation.required'
  | 'validation.text.tooShort'
  | 'validation.text.tooLong'
  | 'validation.consent.required'
  // identity / contact
  | 'validation.email.invalid'
  | 'validation.phone.invalid'
  | 'validation.id.invalid'
  | 'validation.postalCode.invalid'
  | 'validation.name.required'
  // password
  | 'validation.password.tooShort'
  | 'validation.password.needsUpper'
  | 'validation.password.needsNumber'
  // dates
  | 'validation.date.required'
  | 'validation.date.invalid'
  | 'validation.date.futureRequired'
  | 'validation.date.notFuture'
  | 'validation.date.endBeforeStart'
  | 'validation.user.mustBe18'
  // pets
  | 'validation.pet.nameRequired'
  | 'validation.pet.dobFuture'
  // booking
  | 'validation.booking.petRequired'
  | 'validation.booking.dateRequired'
  | 'validation.booking.startInPast'
  // payment
  | 'validation.payment.amountInvalid'
  | 'validation.payment.amountMin'
  | 'validation.payment.amountMax'
  // provider
  | 'validation.provider.serviceRequired'
  // paw finder
  | 'validation.pawFinder.petTypeRequired'
  | 'validation.pawFinder.locationRequired'
  | 'validation.pawFinder.contactRequired'
  // incident
  | 'validation.incident.descriptionRequired'
  // gift
  | 'validation.gift.recipientRequired';

const MESSAGES: Record<ValidationKey, { en: string; he: string }> = {
  'validation.required': { en: 'This field is required', he: 'שדה חובה' },
  'validation.text.tooShort': { en: 'This is too short', he: 'הטקסט קצר מדי' },
  'validation.text.tooLong': { en: 'This is too long', he: 'הטקסט ארוך מדי' },
  'validation.consent.required': { en: 'Please accept to continue', he: 'יש לאשר כדי להמשיך' },

  'validation.email.invalid': { en: 'Please enter a valid email address', he: 'אנא הזן כתובת אימייל תקינה' },
  'validation.phone.invalid': { en: 'Please enter a valid phone number', he: 'אנא הזן מספר טלפון תקין' },
  'validation.id.invalid': { en: 'Please enter a valid ID number', he: 'אנא הזן מספר תעודת זהות תקין' },
  'validation.postalCode.invalid': { en: 'Please enter a valid postal code', he: 'אנא הזן מיקוד תקין' },
  'validation.name.required': { en: 'Please enter your full name', he: 'אנא הזן שם מלא' },

  'validation.password.tooShort': { en: 'Password must be at least 8 characters', he: 'הסיסמה חייבת להכיל לפחות 8 תווים' },
  'validation.password.needsUpper': { en: 'Password must include an uppercase letter', he: 'הסיסמה חייבת לכלול אות גדולה' },
  'validation.password.needsNumber': { en: 'Password must include a number', he: 'הסיסמה חייבת לכלול ספרה' },

  'validation.date.required': { en: 'Please select a date', he: 'אנא בחר תאריך' },
  'validation.date.invalid': { en: 'Please enter a valid date', he: 'אנא הזן תאריך תקין' },
  'validation.date.futureRequired': { en: 'Date must be in the future', he: 'התאריך חייב להיות עתידי' },
  'validation.date.notFuture': { en: 'Date cannot be in the future', he: 'התאריך לא יכול להיות עתידי' },
  'validation.date.endBeforeStart': { en: 'End date must be after the start date', he: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה' },
  'validation.user.mustBe18': { en: 'You must be at least 18 years old', he: 'עליך להיות בן 18 לפחות' },

  'validation.pet.nameRequired': { en: "Please enter your pet's name", he: 'אנא הזן את שם חיית המחמד' },
  'validation.pet.dobFuture': { en: "Birth date can't be in the future", he: 'תאריך הלידה לא יכול להיות עתידי' },

  'validation.booking.petRequired': { en: 'Please select a pet', he: 'אנא בחר חיית מחמד' },
  'validation.booking.dateRequired': { en: 'Please select booking dates', he: 'אנא בחר תאריכי הזמנה' },
  'validation.booking.startInPast': { en: 'Start date cannot be in the past', he: 'תאריך ההתחלה לא יכול להיות בעבר' },

  'validation.payment.amountInvalid': { en: 'Please enter a valid amount', he: 'אנא הזן סכום תקין' },
  'validation.payment.amountMin': { en: 'Amount is below the minimum', he: 'הסכום נמוך מהמינימום' },
  'validation.payment.amountMax': { en: 'Amount is above the maximum', he: 'הסכום גבוה מהמקסימום' },

  'validation.provider.serviceRequired': { en: 'Please select at least one service', he: 'אנא בחר לפחות שירות אחד' },

  'validation.pawFinder.petTypeRequired': { en: 'Please select the pet type', he: 'אנא בחר סוג חיה' },
  'validation.pawFinder.locationRequired': { en: 'Please provide a location or area', he: 'אנא ציין מיקום או אזור' },
  'validation.pawFinder.contactRequired': { en: 'Please choose a contact preference', he: 'אנא בחר אופן יצירת קשר' },

  'validation.incident.descriptionRequired': { en: 'Please describe what happened', he: 'אנא תאר מה קרה' },

  'validation.gift.recipientRequired': { en: "Please enter the recipient's email or mobile", he: 'אנא הזן אימייל או נייד של הנמען' },
};

/** Resolve a validation key into a localized string (English fallback). */
export function vmsg(key: ValidationKey, lang: ValidationLang = 'en'): string {
  const entry = MESSAGES[key];
  if (!entry) return key;
  return String(lang).toLowerCase().startsWith('he') ? entry.he : entry.en;
}
