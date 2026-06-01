export const FRANCHISE_CONTROL_VERSION = 'petwash-franchise-location-partner-2026-05-30';

export type FranchisePartnerStatus =
  | 'DRAFT'
  | 'INFO_REQUESTED'
  | 'NDA_REQUIRED'
  | 'NDA_SIGNED'
  | 'SITE_REVIEW'
  | 'LEGAL_REVIEW'
  | 'ACCOUNTANT_REVIEW'
  | 'NIR_APPROVAL_REQUIRED'
  | 'APPROVED_PILOT'
  | 'ACTIVE'
  | 'REJECTED'
  | 'SUSPENDED';

export type FranchiseEvidenceType =
  | 'NDA_SIGNED'
  | 'SITE_ADDRESS_VERIFIED'
  | 'SITE_RIGHT_TO_USE'
  | 'LEGAL_PARTNER_AGREEMENT'
  | 'SUPPLY_SUPPORT_MODEL'
  | 'TRAINING_MANUAL_VERSION'
  | 'BRAND_COMPLIANCE_RULES'
  | 'INSURANCE_EVIDENCE'
  | 'TAX_ACCOUNTANT_REVIEW'
  | 'BANK_VERIFICATION'
  | 'K9000_ASSET_ASSIGNMENT'
  | 'REVENUE_SHARE_TERMS'
  | 'NIR_APPROVAL';

export type FranchiseEvidenceState = 'MISSING' | 'PENDING_REVIEW' | 'APPROVED' | 'WAIVED_BY_OWNER';

export interface FranchiseEvidenceRule {
  type: FranchiseEvidenceType;
  owner: 'legal' | 'accountant' | 'operations' | 'finance' | 'brand' | 'nir';
  blocksActivation: boolean;
  purpose: string;
}

export const FRANCHISE_EVIDENCE_RULES: FranchiseEvidenceRule[] = [
  {
    type: 'NDA_SIGNED',
    owner: 'legal',
    blocksActivation: true,
    purpose: 'Commercial terms, site economics, manuals, and supplier details are not shared before NDA.',
  },
  {
    type: 'SITE_ADDRESS_VERIFIED',
    owner: 'operations',
    blocksActivation: true,
    purpose: 'The site must be a real verified address with operational suitability.',
  },
  {
    type: 'SITE_RIGHT_TO_USE',
    owner: 'legal',
    blocksActivation: true,
    purpose: 'The partner must prove ownership, lease, landlord consent, or another valid right to operate at the site.',
  },
  {
    type: 'LEGAL_PARTNER_AGREEMENT',
    owner: 'legal',
    blocksActivation: true,
    purpose: 'Operating rights, responsibilities, termination, data use, confidentiality, and brand limits must be signed.',
  },
  {
    type: 'SUPPLY_SUPPORT_MODEL',
    owner: 'operations',
    blocksActivation: true,
    purpose: 'Pet Wash supply, spare parts, consumables, support desk, and service responsibilities must be explicit.',
  },
  {
    type: 'TRAINING_MANUAL_VERSION',
    owner: 'operations',
    blocksActivation: true,
    purpose: 'No partner operates without a current training/manual version and training completion evidence.',
  },
  {
    type: 'BRAND_COMPLIANCE_RULES',
    owner: 'brand',
    blocksActivation: true,
    purpose: 'Pricing, signage, public claims, advertising, and use of Pet Wash marks require approval rules.',
  },
  {
    type: 'INSURANCE_EVIDENCE',
    owner: 'legal',
    blocksActivation: true,
    purpose: 'Pet Wash is not an insurance company; required partner/site insurance evidence must be reviewed.',
  },
  {
    type: 'TAX_ACCOUNTANT_REVIEW',
    owner: 'accountant',
    blocksActivation: true,
    purpose: 'VAT, revenue-share, supplier/customer document flow, and accounting categories require accountant review.',
  },
  {
    type: 'BANK_VERIFICATION',
    owner: 'finance',
    blocksActivation: true,
    purpose: 'Settlement or revenue-share cannot use unverified bank details.',
  },
  {
    type: 'K9000_ASSET_ASSIGNMENT',
    owner: 'finance',
    blocksActivation: true,
    purpose: 'Machine ownership, custody, insurance, maintenance, and asset register link must be clear.',
  },
  {
    type: 'REVENUE_SHARE_TERMS',
    owner: 'accountant',
    blocksActivation: true,
    purpose: 'Fees, royalties, rent, revenue-share, VAT treatment, and SUMIT/accountant fields must be approved.',
  },
  {
    type: 'NIR_APPROVAL',
    owner: 'nir',
    blocksActivation: true,
    purpose: 'No partner/site activation without owner approval.',
  },
];

export const FORBIDDEN_PUBLIC_FRANCHISE_CLAIMS = [
  'fastest-growing',
  'proven business model',
  'global franchise network',
  'global expansion planned',
  '220% Avg. ROI',
  'Excellent ROI',
  '500+ franchisees',
  '92% success probability',
  "world's leading network",
  'become a successful business owner',
  'Exclusive Territory',
  'Complete Insurance',
  'Regional master franchise',
  'City franchise partner',
  'Franchise and white label',
  'white-label solutions',
] as const;

export interface FranchisePartnerControlInput {
  status: FranchisePartnerStatus;
  evidence: Partial<Record<FranchiseEvidenceType, FranchiseEvidenceState>>;
  publicCopyHasFinancialClaim?: boolean;
  publicCopyHasUnverifiedScaleClaim?: boolean;
  aiRecommendedApproval?: boolean;
}

export interface FranchisePartnerControlResult {
  allowed: boolean;
  version: string;
  blockers: string[];
  missingEvidence: FranchiseEvidenceType[];
  requiresApprovers: Array<FranchiseEvidenceRule['owner']>;
}

export function evaluateFranchisePartnerActivation(
  input: FranchisePartnerControlInput,
): FranchisePartnerControlResult {
  const blockers: string[] = [];
  const missingEvidence: FranchiseEvidenceType[] = [];
  const requiresApprovers = new Set<FranchiseEvidenceRule['owner']>();

  if (input.aiRecommendedApproval) {
    blockers.push('AI may flag and suggest next checks, but it cannot approve a partner or site.');
  }

  if (input.publicCopyHasFinancialClaim) {
    blockers.push('Public finance, return, payback, revenue, or profit claims are blocked unless legally approved evidence exists.');
  }

  if (input.publicCopyHasUnverifiedScaleClaim) {
    blockers.push('Public scale claims are blocked unless verified from production records and approved.');
  }

  for (const rule of FRANCHISE_EVIDENCE_RULES) {
    const state = input.evidence[rule.type];
    if (rule.blocksActivation && state !== 'APPROVED' && state !== 'WAIVED_BY_OWNER') {
      missingEvidence.push(rule.type);
      requiresApprovers.add(rule.owner);
      blockers.push(`${rule.type}: ${rule.purpose}`);
    }
  }

  return {
    allowed: blockers.length === 0 && input.status === 'NIR_APPROVAL_REQUIRED',
    version: FRANCHISE_CONTROL_VERSION,
    blockers,
    missingEvidence,
    requiresApprovers: Array.from(requiresApprovers),
  };
}
