import crypto from 'crypto';

export function generateGiftCardCode(): string {
  const prefix = "PWG";
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
}

export function calculateDiscount(user: any): number {
  // Priority order: highest discount wins (only one applies)
  if (user.isVerifiedSenior) {
    return 10; // 10% off for verified seniors (65+)
  }
  
  if (user.isVerifiedDisability) {
    return 10; // 10% off for verified disability ID holders
  }
  
  if (user.loyaltyTier === "new") {
    return 10; // 10% off first wash for new members
  }
  
  if (user.loyaltyTier === "regular") {
    return 5; // 5% off every wash for regular members
  }
  
  return 0; // No discount
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Israeli phone number validation (with or without country code)
  const phoneRegex = /^(\+972|0)([2-9]\d{7,8})$/;
  return phoneRegex.test(phone.replace(/[-\s]/g, ''));
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₪${num.toFixed(0)}`;
}

export function formatDate(date: Date | string, locale: 'en' | 'he' = 'en'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (locale === 'he') {
    return dateObj.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>\"']/g, '');
}

export function generateQRCode(data: string): string {
  // In a real implementation, this would generate an actual QR code
  // For now, return a placeholder URL that would generate the QR code
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
}

export function validateGiftCardCode(code: string): boolean {
  const codeRegex = /^PWG-[A-F0-9]{6}$/;
  return codeRegex.test(code);
}

export function calculateLoyaltyTier(totalSpent: number, washCount: number): string {
  if (totalSpent === 0 && washCount === 0) {
    return 'new';
  }
  
  // After first purchase, user becomes regular member
  return 'regular';
}

export function getDiscountDescription(loyaltyTier: string, isVerifiedSenior: boolean, isVerifiedDisability: boolean, language: 'en' | 'he' = 'en'): string {
  const descriptions = {
    en: {
      new: '10% off your first wash',
      regular: '5% off every wash',
      senior: '10% off every wash (Senior discount)',
      disability: '10% off every wash (Disability discount)'
    },
    he: {
      new: '10% הנחה על הרחיצה הראשונה',
      regular: '5% הנחה על כל רחיצה',
      senior: '10% הנחה על כל רחיצה (הנחת גיל הזהב)',
      disability: '10% הנחה על כל רחיצה (הנחת מוגבלות)'
    }
  };
  
  if (isVerifiedSenior) {
    return descriptions[language].senior;
  }
  
  if (isVerifiedDisability) {
    return descriptions[language].disability;
  }
  
  return descriptions[language][loyaltyTier as keyof typeof descriptions.en] || descriptions[language].regular;
}

export function isValidIsraeliID(id: string): boolean {
  // Basic Israeli ID validation (9 digits)
  const idRegex = /^\d{9}$/;
  if (!idRegex.test(id)) {
    return false;
  }
  
  // Luhn algorithm check for Israeli ID
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let digit = parseInt(id[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }
    sum += digit;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(id[8]);
}

export function createWashPackageData() {
  return [
    {
      name: 'Single Wash',
      nameHe: 'רחיצה יחידה',
      description: '100% organic shampoo with Tea Tree Oil, organic conditioner, full rinse, and pet-friendly air dry',
      descriptionHe: 'שמפו אורגני 100% עם שמן עץ התה, מרכך אורגני, שטיפה מלאה וייבוש ידידותי לחיות מחמד',
      price: '55.00',
      washCount: 1,
      isActive: true
    },
    {
      name: '3 Washes',
      nameHe: '3 רחיצות',
      description: 'Three complete washes with 10% bulk discount, no expiration date, transferable credits',
      descriptionHe: 'שלוש רחיצות מלאות עם 10% הנחה כמותית, ללא תאריך תפוגה, זיכויים ניתנים להעברה',
      price: '150.00',
      washCount: 3,
      isActive: true
    },
    {
      name: '5 Washes',
      nameHe: '5 רחיצות',
      description: 'Five complete washes with 20% bulk discount, priority booking, family sharing, best value',
      descriptionHe: 'חמש רחיצות מלאות עם 20% הנחה כמותית, הזמנה מועדפת, שיתוף משפחתי, הערך הטוב ביותר',
      price: '220.00',
      washCount: 5,
      isActive: true
    }
  ];
}
