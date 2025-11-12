import type { User } from './schema';

export interface DiscountCalculation {
  discountType: 'none' | 'general_member' | 'verified_senior' | 'verified_disability';
  discountPercent: number;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  canApplyDiscount: boolean;
  errorMessage?: string;
}

export function calculateMembershipDiscount(
  user: User | null,
  originalPrice: number,
  isClubMemberSelected: boolean = false
): DiscountCalculation {
  // Base calculation
  const calculation: DiscountCalculation = {
    discountType: 'none',
    discountPercent: 0,
    originalPrice,
    discountAmount: 0,
    finalPrice: originalPrice,
    canApplyDiscount: false
  };

  // No user or not requesting club membership
  if (!user || !isClubMemberSelected) {
    return calculation;
  }

  // Check for verified senior discount (תעודת גימלאים)
  if (user.isSeniorVerified && user.idVerificationStatus === 'approved') {
    calculation.discountType = 'verified_senior';
    calculation.discountPercent = 10;
    calculation.canApplyDiscount = true;
  }
  // Check for verified disability discount (תעודת נכה)
  else if (user.isDisabilityVerified && user.idVerificationStatus === 'approved') {
    calculation.discountType = 'verified_disability';
    calculation.discountPercent = 10;
    calculation.canApplyDiscount = true;
  }
  // General club member discount (max 5%)
  else if (user.isClubMember) {
    calculation.discountType = 'general_member';
    calculation.discountPercent = 5;
    calculation.canApplyDiscount = true;
  }
  // Not eligible for any discount
  else {
    calculation.errorMessage = 'Please complete club membership registration to receive discount';
    return calculation;
  }

  // Calculate final amounts
  calculation.discountAmount = (originalPrice * calculation.discountPercent) / 100;
  calculation.finalPrice = originalPrice - calculation.discountAmount;

  return calculation;
}

export interface MembershipStatus {
  isClubMember: boolean;
  isSeniorVerified: boolean;
  isDisabilityVerified: boolean;
  idVerificationStatus: string;
  maxDiscountPercent: number;
  currentDiscountType: string;
  requiresIdVerification: boolean;
  verificationDocuments: string[];
}

export function getMembershipStatus(user: User | null): MembershipStatus {
  if (!user) {
    return {
      isClubMember: false,
      isSeniorVerified: false,
      isDisabilityVerified: false,
      idVerificationStatus: 'none',
      maxDiscountPercent: 0,
      currentDiscountType: 'none',
      requiresIdVerification: false,
      verificationDocuments: []
    };
  }

  const verificationDocs = [];
  let requiresVerification = false;

  if (user.isSeniorVerified && user.idVerificationStatus !== 'approved') {
    verificationDocs.push('תעודת גימלאים (Senior Citizens ID)');
    requiresVerification = true;
  }
  
  if (user.isDisabilityVerified && user.idVerificationStatus !== 'approved') {
    verificationDocs.push('תעודת נכה (Disability ID)');
    requiresVerification = true;
  }

  if (requiresVerification) {
    verificationDocs.push('תעודת זהות (Israeli ID Card)');
  }

  return {
    isClubMember: user.isClubMember || false,
    isSeniorVerified: user.isSeniorVerified || false,
    isDisabilityVerified: user.isDisabilityVerified || false,
    idVerificationStatus: user.idVerificationStatus || 'none',
    maxDiscountPercent: user.maxDiscountPercent || 5,
    currentDiscountType: user.currentDiscountType || 'none',
    requiresIdVerification: requiresVerification,
    verificationDocuments: verificationDocs
  };
}

export const DISCOUNT_RULES = {
  GENERAL_MEMBER: {
    percent: 5,
    description: 'General club member discount',
    descriptionHe: 'הנחה לחברי מועדון רגילים',
    requiresVerification: false
  },
  VERIFIED_SENIOR: {
    percent: 10,
    description: 'Verified senior citizen discount (תעודת גימלאים)',
    descriptionHe: 'הנחה לגימלאים מאומתים',
    requiresVerification: true,
    documents: ['תעודת גימלאים', 'תעודת זהות']
  },
  VERIFIED_DISABILITY: {
    percent: 10,
    description: 'Verified disability discount (תעודת נכה)',
    descriptionHe: 'הנחה לבעלי מוגבלות מאומתים',
    requiresVerification: true,
    documents: ['תעודת נכה', 'תעודת זהות']
  },
  MAX_ONE_DISCOUNT: {
    description: 'Only one discount can be applied at a time',
    descriptionHe: 'ניתן להחיל הנחה אחת בלבד בכל עת'
  }
} as const;