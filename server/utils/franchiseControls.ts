/**
 * 🏆 McDONALD'S-STYLE FRANCHISE MANAGEMENT
 * Centralized technology, real-time dashboards, quality audits
 * Adopted from McDonald's 40,000+ location franchise model
 */

export interface FranchiseStation {
  stationId: string;
  franchiseeId: string;
  location: {
    address: string;
    city: string;
    country: string;
    coordinates: { lat: number; lng: number };
  };
  operationalStatus: 'active' | 'maintenance' | 'offline' | 'suspended';
  lastHealthCheck: Date;
  complianceScore: number; // 0-100
  performance: {
    revenueToday: number;
    customersToday: number;
    averageWaitTime: number; // minutes
    customerSatisfaction: number; // 0-5 stars
  };
}

export interface FranchiseeControl {
  franchiseeId: string;
  name: string;
  email: string;
  phone: string;
  joinedDate: Date;
  totalStations: number;
  tier: 'single' | 'multi' | 'master';
  mandatoryUpdatesEnabled: boolean;
  supportLevel: 'standard' | 'priority' | '24_7_dedicated';
}

/**
 * Real-time franchise command center
 * McDonald's HQ sees all 40,000 locations live
 */
export function getFranchiseCommandCenter(franchiseeId?: string): {
  totalStations: number;
  activeStations: number;
  totalRevenueToday: number;
  totalCustomersToday: number;
  averageComplianceScore: number;
  criticalAlerts: number;
  topPerformers: Array<{ stationId: string; revenue: number }>;
  needsAttention: Array<{ stationId: string; issue: string }>;
} {
  // HONEST DEFAULT (was fabricated: 127 stations / ₪45,230 / fake TLV-HFA-JLM
  // performers). PetWash currently operates 2 company-owned Kfar Saba stations
  // and has NO franchise network yet, so there is no real franchise feed to
  // report. Returning invented numbers here misled the admin panel. When a real
  // franchise ledger exists, wire it in; until then report the truth.
  return {
    totalStations: 0,
    activeStations: 0,
    totalRevenueToday: 0,
    totalCustomersToday: 0,
    averageComplianceScore: 0,
    criticalAlerts: 0,
    topPerformers: [],
    needsAttention: [],
  };
}

/**
 * Quality audit checklist (McDonald's mystery shopper program)
 */
export interface QualityAudit {
  auditId: string;
  stationId: string;
  auditDate: Date;
  auditorName: string;
  categories: {
    cleanliness: { score: number; notes: string };
    equipment: { score: number; notes: string };
    customerService: { score: number; notes: string };
    safety: { score: number; notes: string };
    branding: { score: number; notes: string };
  };
  overallScore: number;
  passedAudit: boolean;
  correctiveActions?: string[];
}

export function createQualityAudit(stationId: string): QualityAudit {
  const auditId = `QA-${Date.now()}`;

  return {
    auditId,
    stationId,
    auditDate: new Date(),
    auditorName: 'Regional Quality Manager',
    categories: {
      cleanliness: { score: 0, notes: '' },
      equipment: { score: 0, notes: '' },
      customerService: { score: 0, notes: '' },
      safety: { score: 0, notes: '' },
      branding: { score: 0, notes: '' },
    },
    overallScore: 0,
    passedAudit: false,
  };
}

/**
 * Mandatory updates deployment (McDonald's centralized menu changes)
 * HQ controls pricing, menu items, promotions globally
 */
export interface MandatoryUpdate {
  updateId: string;
  type: 'pricing' | 'service_menu' | 'promotion' | 'branding' | 'security_patch';
  title: string;
  description: string;
  deploymentDate: Date;
  affectedStations: string[];
  autoDeployEnabled: boolean;
  rollbackAvailable: boolean;
}

export function deployMandatoryUpdate(update: MandatoryUpdate): {
  deploymentId: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed';
  successfulDeployments: number;
  failedDeployments: number;
  estimatedCompletionTime: string;
} {
  const deploymentId = `DEPLOY-${update.updateId}-${Date.now()}`;

  // HONEST: there is NO remote station-deployment rail wired. Previously this
  // returned status:'scheduled' — an admin pressing "push security patch" got a
  // reassuring receipt while nothing happened. Report failure so no one believes
  // an update shipped. Wire a real rail before flipping this to 'scheduled'.
  return {
    deploymentId,
    status: 'failed',
    successfulDeployments: 0,
    failedDeployments: (update.affectedStations || []).length,
    estimatedCompletionTime: 'n/a — remote station deployment is not available yet',
  };
}

/**
 * Franchisee support infrastructure
 * McDonald's 24/7 helpdesk, training portal, annual conferences
 */
export interface FranchiseeSupport {
  helpDeskAvailable: boolean;
  helpDeskHours: string;
  trainingPortal: {
    totalCourses: number;
    completedCourses: number;
    certificationsEarned: string[];
    nextCourse: string;
  };
  supplierNetwork: {
    approvedVendors: number;
    bulkDiscountAvailable: boolean;
    nextOrderDeadline: Date;
  };
  regionalManager: {
    name: string;
    email: string;
    phone: string;
    nextCheckIn: Date;
  };
}

export function getFranchiseeSupport(franchiseeId: string): FranchiseeSupport {
  // HONEST: no franchisee support org exists yet (was fabricated "David Levi"
  // + fake course/cert counts + 12 fake vendors). Real support is the company
  // inbox; everything else is empty until a real program is stood up.
  return {
    helpDeskAvailable: true,
    helpDeskHours: 'support@petwash.co.il',
    trainingPortal: {
      totalCourses: 0,
      completedCourses: 0,
      certificationsEarned: [],
      nextCourse: '',
    },
    supplierNetwork: {
      approvedVendors: APPROVED_SUPPLIERS.length,
      bulkDiscountAvailable: false,
      nextOrderDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    regionalManager: {
      name: 'PetWash Support',
      email: 'support@petwash.co.il',
      phone: '',
      nextCheckIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  };
}

/**
 * Supply chain control (McDonald's approved vendors only)
 */
export interface ApprovedSupplier {
  supplierId: string;
  name: string;
  category: 'chemicals' | 'equipment' | 'packaging' | 'consumables';
  bulkPricing: {
    minOrder: number;
    discountRate: number;
  };
  deliveryTime: string;
  qualityCertified: boolean;
}

// HONEST: no approved-supplier network exists yet (was two fabricated vendors,
// "EcoClean Israel Ltd" / "K9000 Equipment Supply"). Populate when real supplier
// agreements are signed.
export const APPROVED_SUPPLIERS: ApprovedSupplier[] = [];
