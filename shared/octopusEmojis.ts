/**
 * 🐙 OCTOPUS PROTOCOL EMOJI CONSTANTS
 * 7-Star Luxury Metallic Emoji System (2025 Design Standards)
 * 
 * Inspired by Pet Wash™ Premium Loyalty Tier Design:
 * - Consistent metallic theme (🥉🥈🥇💎💠💚👑)
 * - Enterprise-grade visual hierarchy
 * - Production-ready audit logging
 * 
 * Usage:
 * ```typescript
 * import { OCTOPUS_ADMIN, OCTOPUS_ACTIONS } from '@/shared/octopusEmojis';
 * logger.info(`${OCTOPUS_ADMIN.HEAD_OFFICE_OVERRIDE} by ${userId}`);
 * logger.info(`${OCTOPUS_ACTIONS.CREATE} new franchise location`);
 * ```
 */

// ==================== ADMIN ACCESS LEVELS (7-Star Metallic Design) ====================

export const OCTOPUS_ADMIN = {
  /** 🚨 HEAD OFFICE OVERRIDE - Critical admin access requiring audit */
  HEAD_OFFICE_OVERRIDE: '🚨',
  
  /** 👑 SUPER_ADMIN - Highest privilege level (Royal Tier) */
  SUPER_ADMIN: '👑',
  
  /** 💎 EXECUTIVE_ADMIN - Executive level (Platinum Tier) */
  EXECUTIVE_ADMIN: '💎',
  
  /** 🥇 REGIONAL_ADMIN - Regional operations manager (Gold Tier) */
  REGIONAL_ADMIN: '🥇',
  
  /** 🥈 FRANCHISE_ADMIN - Individual location admin (Silver Tier) */
  FRANCHISE_ADMIN: '🥈',
  
  /** 🥉 STANDARD_ADMIN - Entry-level admin (Bronze Tier) */
  STANDARD_ADMIN: '🥉',
  
  /** 👤 STANDARD_USER - Normal authenticated user */
  STANDARD_USER: '👤',
} as const;

// ==================== ACTIONS ====================

export const OCTOPUS_ACTIONS = {
  /** ➕ CREATE - New resource creation */
  CREATE: '➕',
  
  /** 🗑️ DELETE - Resource deletion */
  DELETE: '🗑️',
  
  /** 🔄 UPDATE - Resource modification */
  UPDATE: '🔄',
  
  /** 👀 VIEW - Read-only access */
  VIEW: '👀',
  
  /** 📋 LIST - Batch viewing */
  LIST: '📋',
  
  /** ✅ APPROVE - Approval action */
  APPROVE: '✅',
  
  /** ❌ REJECT - Rejection action */
  REJECT: '❌',
  
  /** 📧 EMAIL - Email notification sent */
  EMAIL: '📧',
  
  /** 💬 SMS - SMS notification sent */
  SMS: '💬',
  
  /** 📊 REPORT - Analytics/reporting action */
  REPORT: '📊',
  
  /** 🔒 LOCK - Resource locked */
  LOCK: '🔒',
  
  /** 🔓 UNLOCK - Resource unlocked */
  UNLOCK: '🔓',
  
  /** 📤 EXPORT - Data export */
  EXPORT: '📤',
  
  /** 📥 IMPORT - Data import */
  IMPORT: '📥',
} as const;

// ==================== SECURITY & RISK ====================

export const OCTOPUS_SECURITY = {
  /** 🚨 FRAUD_ALERT - High-risk transaction detected */
  FRAUD_ALERT: '🚨',
  
  /** ⚠️ WARNING - Medium-risk activity */
  WARNING: '⚠️',
  
  /** ✅ SAFE - Low-risk, normal operation */
  SAFE: '✅',
  
  /** 🛡️ BLOCKED - Access denied */
  BLOCKED: '🛡️',
  
  /** 🔐 ENCRYPTED - Sensitive data encrypted */
  ENCRYPTED: '🔐',
  
  /** 🔓 DECRYPTED - Sensitive data accessed */
  DECRYPTED: '🔓',
  
  /** 👁️ AUDIT - Compliance audit log */
  AUDIT: '👁️',
  
  /** 🎭 ANOMALY - Unusual pattern detected */
  ANOMALY: '🎭',
} as const;

// ==================== BUSINESS UNITS (Pet Wash™ Octopus Structure) ====================

export const OCTOPUS_UNITS = {
  /** 🏢 HEAD_OFFICE - Central administration (7-star management) */
  HEAD_OFFICE: '🏢',
  
  /** 🏪 FRANCHISE - Location operations (franchise network) */
  FRANCHISE: '🏪',
  
  /** 👥 CUSTOMER - End-user services (mobile experience) */
  CUSTOMER: '👥',
  
  /** 🤝 SHARED - Multi-role infrastructure (enterprise core) */
  SHARED: '🤝',
  
  /** 🐕 K9000 - IoT wash stations (smart hardware) */
  K9000: '🐕',
  
  /** 🚶 WALK_MY_PET - Dog walking marketplace */
  WALK_MY_PET: '🚶',
  
  /** 🏠 SITTER_SUITE - Pet sitting services */
  SITTER_SUITE: '🏠',
  
  /** 🚗 PETTREK - Pet transportation */
  PETTREK: '🚗',
  
  /** 🎨 PLUSH_LAB - AI avatar creator */
  PLUSH_LAB: '🎨',
  
  /** 🧴 TRADITIONAL_GROOMING - Classic pet grooming */
  TRADITIONAL_GROOMING: '🧴',
} as const;

// ==================== PAYMENT & FINANCE ====================

export const OCTOPUS_FINANCE = {
  /** 💳 PAYMENT - Transaction processed */
  PAYMENT: '💳',
  
  /** 💰 REFUND - Refund issued */
  REFUND: '💰',
  
  /** 🧾 INVOICE - Invoice generated */
  INVOICE: '🧾',
  
  /** 📉 CHARGEBACK - Payment disputed */
  CHARGEBACK: '📉',
  
  /** 🎁 GIFT_CARD - E-gift card transaction */
  GIFT_CARD: '🎁',
  
  /** 💎 LOYALTY - Loyalty points activity */
  LOYALTY: '💎',
  
  /** 🏦 BANK - Bank reconciliation */
  BANK: '🏦',
  
  /** 📊 ACCOUNTING - Financial record */
  ACCOUNTING: '📊',
} as const;

// ==================== STATUS INDICATORS ====================

export const OCTOPUS_STATUS = {
  /** ✅ SUCCESS - Operation completed successfully */
  SUCCESS: '✅',
  
  /** ❌ FAILURE - Operation failed */
  FAILURE: '❌',
  
  /** ⏳ PENDING - Operation in progress */
  PENDING: '⏳',
  
  /** ⏸️ PAUSED - Operation paused */
  PAUSED: '⏸️',
  
  /** 🔄 PROCESSING - Active processing */
  PROCESSING: '🔄',
  
  /** 🎉 COMPLETED - Workflow completed */
  COMPLETED: '🎉',
  
  /** 🚀 STARTED - New operation initiated */
  STARTED: '🚀',
  
  /** 🛑 CANCELLED - Operation cancelled */
  CANCELLED: '🛑',
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get action emoji by name
 * @example getActionEmoji('create') // ➕
 */
export function getActionEmoji(action: string): string {
  const upperAction = action.toUpperCase();
  return (OCTOPUS_ACTIONS as any)[upperAction] || '•';
}

/**
 * Get admin level emoji by role
 * @example getAdminEmoji('SUPER_ADMIN') // 👑
 */
export function getAdminEmoji(role: string): string {
  const upperRole = role.toUpperCase();
  return (OCTOPUS_ADMIN as any)[upperRole] || OCTOPUS_ADMIN.STANDARD_USER;
}

/**
 * Get security risk emoji by level
 * @example getRiskEmoji('HIGH') // 🚨
 */
export function getRiskEmoji(level: string): string {
  if (level === 'HIGH' || level === 'CRITICAL') return OCTOPUS_SECURITY.FRAUD_ALERT;
  if (level === 'MEDIUM') return OCTOPUS_SECURITY.WARNING;
  return OCTOPUS_SECURITY.SAFE;
}

/**
 * Format a complete audit log entry
 * @example formatAuditLog('SUPER_ADMIN', 'CREATE', 'franchise', 'admin@example.com')
 * // Returns: "👑 ➕ CREATE franchise by admin@example.com"
 */
export function formatAuditLog(
  adminLevel: keyof typeof OCTOPUS_ADMIN,
  action: keyof typeof OCTOPUS_ACTIONS,
  resource: string,
  userId: string,
  ip?: string
): string {
  const adminEmoji = OCTOPUS_ADMIN[adminLevel];
  const actionEmoji = OCTOPUS_ACTIONS[action];
  const ipSuffix = ip ? ` | IP: ${ip}` : '';
  
  return `${adminEmoji} ${actionEmoji} ${action} ${resource} by ${userId}${ipSuffix}`;
}

// ==================== TYPE EXPORTS ====================

export type AdminLevel = keyof typeof OCTOPUS_ADMIN;
export type Action = keyof typeof OCTOPUS_ACTIONS;
export type SecurityLevel = keyof typeof OCTOPUS_SECURITY;
export type BusinessUnit = keyof typeof OCTOPUS_UNITS;
export type PaymentAction = keyof typeof OCTOPUS_FINANCE;
export type StatusIndicator = keyof typeof OCTOPUS_STATUS;
