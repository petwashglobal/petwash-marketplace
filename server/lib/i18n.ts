/**
 * Backend i18n (Internationalization) System
 * Supports English (en) and Hebrew (he)
 */

export type Language = 'en' | 'he';

interface Translation {
  en: string;
  he: string;
}

// Employee Management Messages
export const employeeMessages = {
  created: {
    en: 'Employee created successfully',
    he: 'העובד נוצר בהצלחה'
  },
  updated: {
    en: 'Employee updated successfully',
    he: 'העובד עודכן בהצלחה'
  },
  deleted: {
    en: 'Employee deleted successfully',
    he: 'העובד נמחק בהצלחה'
  },
  suspended: {
    en: 'Employee suspended successfully',
    he: 'העובד הושעה בהצלחה'
  },
  activated: {
    en: 'Employee activated successfully',
    he: 'העובד הופעל בהצלחה'
  },
  inviteSent: {
    en: 'Password setup email sent successfully',
    he: 'אימייל הגדרת סיסמה נשלח בהצלחה'
  },
  mobileLinkGenerated: {
    en: 'Mobile login link generated successfully',
    he: 'קישור כניסה לנייד נוצר בהצלחה'
  },
  notFound: {
    en: 'Employee not found',
    he: 'העובד לא נמצא'
  },
  alreadyExists: {
    en: 'Employee with this email already exists',
    he: 'עובד עם כתובת אימייל זו כבר קיים'
  },
  invalidRole: {
    en: 'Invalid employee role',
    he: 'תפקיד עובד לא חוקי'
  },
  noPermission: {
    en: 'You do not have permission to perform this action',
    he: 'אין לך הרשאה לבצע פעולה זו'
  }
};

// Authentication Messages
export const authMessages = {
  loginSuccess: {
    en: 'Login successful',
    he: 'התחברות מוצלחת'
  },
  loginFailed: {
    en: 'Invalid credentials',
    he: 'פרטי התחברות שגויים'
  },
  sessionCreated: {
    en: 'Session created successfully',
    he: 'הפעלה נוצרה בהצלחה'
  },
  sessionExpired: {
    en: 'Your session has expired',
    he: 'תוקף ההפעלה פג'
  },
  unauthorized: {
    en: 'Unauthorized access',
    he: 'גישה לא מורשית'
  },
  accountSuspended: {
    en: 'This account has been suspended',
    he: 'חשבון זה הושעה'
  },
  accountDisabled: {
    en: 'This account has been disabled',
    he: 'חשבון זה הושבת'
  },
  invalidToken: {
    en: 'Invalid or expired token',
    he: 'טוקן לא חוקי או פג תוקף'
  }
};

// WebAuthn/Passkey Messages
export const webauthnMessages = {
  // Registration
  registrationSuccess: {
    en: 'Biometric authentication successfully enabled',
    he: 'אימות ביומטרי הופעל בהצלחה'
  },
  registrationFailed: {
    en: 'Failed to register biometric authentication',
    he: 'הרשמת אימות ביומטרי נכשלה'
  },
  deviceRegistered: {
    en: 'Device registered successfully',
    he: 'המכשיר נרשם בהצלחה'
  },
  
  // Authentication
  authenticationSuccess: {
    en: 'Biometric authentication successful',
    he: 'אימות ביומטרי הצליח'
  },
  authenticationFailed: {
    en: 'Biometric authentication failed',
    he: 'אימות ביומטרי נכשל'
  },
  authenticationCancelled: {
    en: 'Authentication was cancelled',
    he: 'האימות בוטל'
  },
  
  // Challenges
  challengeNotFound: {
    en: 'Authentication challenge not found or expired',
    he: 'אתגר האימות לא נמצא או פג תוקפו'
  },
  challengeExpired: {
    en: 'Authentication challenge has expired. Please try again.',
    he: 'אתגר האימות פג תוקפו. אנא נסה שוב.'
  },
  challengeMismatch: {
    en: 'Authentication challenge mismatch',
    he: 'אתגר אימות לא תואם'
  },
  
  // Credentials
  credentialNotFound: {
    en: 'Biometric credential not found',
    he: 'אישור ביומטרי לא נמצא'
  },
  noCredentialsForEmail: {
    en: 'No biometric credentials found for this email',
    he: 'לא נמצאו אישורים ביומטריים עבור כתובת אימייל זו'
  },
  credentialAlreadyExists: {
    en: 'This biometric credential is already registered',
    he: 'אישור ביומטרי זה כבר רשום'
  },
  tooManyDevices: {
    en: 'Maximum number of devices reached. Please remove a device first.',
    he: 'מספר מכשירים מקסימלי הושג. אנא הסר מכשיר תחילה.'
  },
  
  // Devices
  deviceRevoked: {
    en: 'Device has been revoked',
    he: 'המכשיר בוטל'
  },
  deviceRenamed: {
    en: 'Device renamed successfully',
    he: 'שם המכשיר שונה בהצלחה'
  },
  deviceRemoved: {
    en: 'Device removed successfully',
    he: 'המכשיר הוסר בהצלחה'
  },
  deviceLowTrust: {
    en: 'Device trust score is too low. Please re-register your biometric.',
    he: 'ציון האמון של המכשיר נמוך מדי. אנא רשום מחדש את הביומטרי שלך.'
  },
  deviceSuspicious: {
    en: 'Suspicious activity detected on this device',
    he: 'זוהתה פעילות חשודה במכשיר זה'
  },
  
  // Platform support
  notSupported: {
    en: 'Your device does not support biometric authentication',
    he: 'המכשיר שלך אינו תומך באימות ביומטרי'
  },
  platformAuthNotAvailable: {
    en: 'Biometric authentication is not available on this device',
    he: 'אימות ביומטרי אינו זמין במכשיר זה'
  },
  
  // Security
  originMismatch: {
    en: 'Authentication origin mismatch. Please try again from the official website.',
    he: 'מקור האימות אינו תואם. אנא נסה שוב מהאתר הרשמי.'
  },
  attestationFailed: {
    en: 'Device attestation validation failed',
    he: 'אימות תעודת המכשיר נכשל'
  },
  reAuthRequired: {
    en: 'Re-authentication required for this sensitive action',
    he: 'נדרש אימות מחדש לפעולה רגישה זו'
  },
  
  // Recovery paths
  recovery: {
    tryAgain: {
      en: 'Please try authenticating again',
      he: 'אנא נסה להתחבר שוב'
    },
    usePassword: {
      en: 'You can also sign in with your password',
      he: 'אתה יכול גם להתחבר עם הסיסמה שלך'
    },
    contactSupport: {
      en: 'If the problem persists, please contact support',
      he: 'אם הבעיה נמשכת, אנא פנה לתמיכה'
    },
    checkDevice: {
      en: 'Please ensure your device biometric is properly configured',
      he: 'אנא וודא שהביומטרי של המכשיר שלך מוגדר כראוי'
    },
    removeAndReRegister: {
      en: 'Try removing this device and registering it again',
      he: 'נסה להסיר מכשיר זה ולרשום אותו מחדש'
    }
  }
};

// Validation Messages
export const validationMessages = {
  required: {
    en: 'This field is required',
    he: 'שדה זה חובה'
  },
  invalidEmail: {
    en: 'Invalid email address',
    he: 'כתובת אימייל לא חוקית'
  },
  invalidPhone: {
    en: 'Invalid phone number',
    he: 'מספר טלפון לא חוקי'
  },
  passwordTooShort: {
    en: 'Password must be at least 6 characters',
    he: 'הסיסמה חייבת להיות לפחות 6 תווים'
  },
  invalidData: {
    en: 'Invalid data provided',
    he: 'נתונים לא חוקיים'
  }
};

// Email Templates
export const emailTemplates = {
  passwordSetup: {
    subject: {
      en: 'Set up your Pet Wash™ admin account',
      he: 'הגדר את חשבון המנהל שלך ב-Pet Wash™'
    },
    greeting: {
      en: (name: string) => `Hi ${name},`,
      he: (name: string) => `שלום ${name},`
    },
    body: {
      en: 'Your Pet Wash™ admin account has been created. Click the link below to set your password and activate your account:',
      he: 'חשבון המנהל שלך ב-Pet Wash™ נוצר. לחץ על הקישור למטה כדי להגדיר את הסיסמה שלך ולהפעיל את החשבון:'
    },
    buttonText: {
      en: 'Set Your Password',
      he: 'הגדר את הסיסמה שלך'
    },
    expiryNotice: {
      en: 'This link will expire in 24 hours.',
      he: 'קישור זה יפוג תוקף תוך 24 שעות.'
    },
    roleLabel: {
      en: 'Role:',
      he: 'תפקיד:'
    },
    createdByLabel: {
      en: 'Created by:',
      he: 'נוצר על ידי:'
    },
    footer: {
      en: 'If you didn\'t request this account, please ignore this email.',
      he: 'אם לא ביקשת חשבון זה, אנא התעלם מאימייל זה.'
    },
    signature: {
      en: 'Pet Wash™ Admin Team',
      he: 'צוות המנהלים של Pet Wash™'
    }
  },
  passwordReset: {
    subject: {
      en: 'Reset your Pet Wash™ password',
      he: 'אפס את הסיסמה שלך ב-Pet Wash™'
    },
    greeting: {
      en: (name: string) => `Hi ${name},`,
      he: (name: string) => `שלום ${name},`
    },
    body: {
      en: 'Click the link below to reset your password:',
      he: 'לחץ על הקישור למטה כדי לאפס את הסיסמה שלך:'
    },
    buttonText: {
      en: 'Reset Password',
      he: 'אפס סיסמה'
    },
    expiryNotice: {
      en: 'This link will expire in 24 hours.',
      he: 'קישור זה יפוג תוקף תוך 24 שעות.'
    },
    footer: {
      en: 'If you didn\'t request this password reset, please ignore this email.',
      he: 'אם לא ביקשת איפוס סיסמה זה, אנא התעלם מאימייל זה.'
    }
  }
};

// Role Names
export const roleNames = {
  admin: {
    en: 'Admin',
    he: 'מנהל מערכת'
  },
  ops: {
    en: 'Ops Manager',
    he: 'מנהל תפעול'
  },
  manager: {
    en: 'Station Manager',
    he: 'מנהל תחנה'
  },
  maintenance: {
    en: 'Maintenance Technician',
    he: 'טכנאי תחזוקה'
  },
  support: {
    en: 'Support/CRM',
    he: 'תמיכה/CRM'
  }
};

// Status Names
export const statusNames = {
  active: {
    en: 'Active',
    he: 'פעיל'
  },
  suspended: {
    en: 'Suspended',
    he: 'מושעה'
  },
  inactive: {
    en: 'Inactive',
    he: 'לא פעיל'
  }
};

// General Messages
export const generalMessages = {
  success: {
    en: 'Operation completed successfully',
    he: 'הפעולה הושלמה בהצלחה'
  },
  error: {
    en: 'An error occurred',
    he: 'אירעה שגיאה'
  },
  serverError: {
    en: 'Internal server error',
    he: 'שגיאת שרת פנימית'
  },
  notFound: {
    en: 'Resource not found',
    he: 'המשאב לא נמצא'
  },
  forbidden: {
    en: 'Access forbidden',
    he: 'הגישה נאסרה'
  },
  badRequest: {
    en: 'Invalid request',
    he: 'בקשה לא חוקית'
  }
};

/**
 * Get translated message
 */
export function t(message: Translation, lang: Language = 'en'): string {
  return message[lang] || message.en;
}

/**
 * Get language from request headers or query params
 */
export function getLanguage(req: any): Language {
  // Check query param
  if (req.query?.lang === 'he' || req.query?.lang === 'hebrew') {
    return 'he';
  }
  
  // Check header
  const acceptLanguage = req.headers['accept-language'] || '';
  if (acceptLanguage.includes('he') || acceptLanguage.includes('iw')) {
    return 'he';
  }
  
  // Default to English
  return 'en';
}

/**
 * Create bilingual response
 */
export function bilingualResponse(
  message: Translation,
  data?: any,
  lang?: Language
): { message: string; message_en: string; message_he: string; data?: any } {
  return {
    message: t(message, lang || 'en'),
    message_en: message.en,
    message_he: message.he,
    ...(data && { data })
  };
}

/**
 * Create bilingual error response
 */
export function bilingualError(
  message: Translation,
  statusCode: number = 400,
  lang?: Language
): { error: string; error_en: string; error_he: string; statusCode: number } {
  return {
    error: t(message, lang || 'en'),
    error_en: message.en,
    error_he: message.he,
    statusCode
  };
}
