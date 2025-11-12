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
  // In production, fetch from database with real-time data
  return {
    totalStations: 127, // Total Pet Wash™ stations
    activeStations: 124,
    totalRevenueToday: 45230.50,
    totalCustomersToday: 1847,
    averageComplianceScore: 94.7,
    criticalAlerts: 3,
    topPerformers: [
      { stationId: 'TLV-001', revenue: 8945.00 },
      { stationId: 'HFA-003', revenue: 7612.00 },
      { stationId: 'JLM-002', revenue: 6891.00 },
    ],
    needsAttention: [
      { stationId: 'BER-005', issue: 'Low soap inventory (< 10%)' },
      { stationId: 'ASH-002', issue: 'Compliance score dropped to 78%' },
      { stationId: 'PTH-001', issue: 'Average wait time > 15 minutes' },
    ],
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

  return {
    deploymentId,
    status: 'scheduled',
    successfulDeployments: 0,
    failedDeployments: 0,
    estimatedCompletionTime: '2 hours',
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
  return {
    helpDeskAvailable: true,
    helpDeskHours: '24/7 (Priority tier)',
    trainingPortal: {
      totalCourses: 24,
      completedCourses: 18,
      certificationsEarned: ['K9000 Certified Technician', 'Customer Service Excellence', 'Health & Safety Level 2'],
      nextCourse: 'Advanced Troubleshooting (Available Dec 1)',
    },
    supplierNetwork: {
      approvedVendors: 12,
      bulkDiscountAvailable: true,
      nextOrderDeadline: new Date('2025-11-15'),
    },
    regionalManager: {
      name: 'David Levi',
      email: 'david.levi@petwash.co.il',
      phone: '+972-50-123-4567',
      nextCheckIn: new Date('2025-11-10'),
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

export const APPROVED_SUPPLIERS: ApprovedSupplier[] = [
  {
    supplierId: 'SUP-001',
    name: 'EcoClean Israel Ltd',
    category: 'chemicals',
    bulkPricing: { minOrder: 50, discountRate: 15 },
    deliveryTime: '2-3 business days',
    qualityCertified: true,
  },
  {
    supplierId: 'SUP-002',
    name: 'K9000 Equipment Supply',
    category: 'equipment',
    bulkPricing: { minOrder: 10, discountRate: 20 },
    deliveryTime: '5-7 business days',
    qualityCertified: true,
  },
];
