import { db } from '../db';
import { departments, roles, controlPanelPlatforms, userRoles } from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';

// ============================================================================
// SEED DATA - Departments, Roles, Platforms
// ============================================================================

export const DEPARTMENTS = [
  { key: 'executive', label: 'Executive', description: 'C-level and executive leadership' },
  { key: 'operations', label: 'Operations', description: 'Day-to-day operational management' },
  { key: 'logistics', label: 'Logistics', description: 'Supply chain and logistics coordination' },
  { key: 'sales', label: 'Sales', description: 'Sales and business development' },
  { key: 'marketing', label: 'Marketing', description: 'Marketing and brand management' },
  { key: 'finance', label: 'Finance', description: 'Financial planning and analysis' },
  { key: 'accounting', label: 'Accounting', description: 'Bookkeeping and financial reporting' },
  { key: 'customer_support', label: 'Customer Support', description: 'Customer service and support' },
  { key: 'health_safety', label: 'Health & Safety', description: 'Safety compliance and protocols' },
  { key: 'technology', label: 'Technology', description: 'IT and software development' },
  { key: 'transportation', label: 'Transportation', description: 'Fleet and driver management' },
  { key: 'legal', label: 'Legal', description: 'Legal compliance and contracts' },
  { key: 'hr', label: 'HR', description: 'Human resources and recruitment' },
  { key: 'partners', label: 'Partners', description: 'Partner relationship management' },
  { key: 'franchise', label: 'Franchise', description: 'Franchise operations and support' },
  { key: 'subcontractors', label: 'Subcontractors', description: 'Subcontractor coordination' },
];

export const ROLES = [
  { 
    key: 'super_admin', 
    label: 'Super Admin', 
    departmentKey: 'executive',
    description: 'Full system access and control' 
  },
  { 
    key: 'company_admin', 
    label: 'Company Admin', 
    departmentKey: 'executive',
    description: 'Company-wide administrative access' 
  },
  { 
    key: 'city_manager', 
    label: 'City Manager', 
    departmentKey: 'operations',
    description: 'Manages operations for a specific city' 
  },
  { 
    key: 'field_technician', 
    label: 'Field Technician', 
    departmentKey: 'operations',
    description: 'On-site station maintenance and support' 
  },
  { 
    key: 'driver', 
    label: 'Driver', 
    departmentKey: 'transportation',
    description: 'Transportation and delivery services' 
  },
  { 
    key: 'customer_support_agent', 
    label: 'Customer Support Agent', 
    departmentKey: 'customer_support',
    description: 'Customer service and issue resolution' 
  },
  { 
    key: 'finance_controller', 
    label: 'Finance Controller', 
    departmentKey: 'finance',
    description: 'Financial oversight and reporting' 
  },
  { 
    key: 'sales_manager', 
    label: 'Sales Manager', 
    departmentKey: 'sales',
    description: 'Sales team management and strategy' 
  },
  { 
    key: 'franchise_owner', 
    label: 'Franchise Owner', 
    departmentKey: 'franchise',
    description: 'Franchise location owner/operator' 
  },
  { 
    key: 'partner_account_manager', 
    label: 'Partner Account Manager', 
    departmentKey: 'partners',
    description: 'Manages partner relationships and accounts' 
  },
  { 
    key: 'view_only_auditor', 
    label: 'View-Only Auditor', 
    departmentKey: 'finance',
    description: 'Read-only access for auditing purposes' 
  },
];

export const PLATFORMS = [
  { key: 'petwash_hub', label: 'Hub', description: 'Central operations hub' },
  { key: 'petwash_manager', label: 'Manager', description: 'Management dashboard' },
  { key: 'petwash_partner', label: 'Partner', description: 'Partner portal' },
  { key: 'petwash_franchise', label: 'Franchise', description: 'Franchise management' },
  { key: 'petwash_academy', label: 'Academy', description: 'Training and education' },
  { key: 'petwash_payments', label: 'Payments', description: 'Payment processing' },
  { key: 'petwash_loyalty', label: 'Loyalty', description: 'Loyalty program management' },
  { key: 'petwash_api', label: 'API', description: 'API access and integration' },
  { key: 'petwash_support', label: 'Support', description: 'Customer support platform' },
  { key: 'petwash_kyc', label: 'KYC', description: 'Know Your Customer verification' },
];

// ============================================================================
// INITIALIZATION - Seed database with initial data
// ============================================================================

export async function initializeControlPanelRegistry() {
  try {
    // Check if data already exists
    const existingDepts = await db.select().from(departments).limit(1);
    if (existingDepts.length > 0) {
      console.log('Control Panel Registry already initialized');
      return;
    }

    console.log('Initializing Control Panel Registry...');

    // Insert departments
    const insertedDepts = await db.insert(departments)
      .values(DEPARTMENTS.map(d => ({ key: d.key, label: d.label, description: d.description })))
      .returning();
    
    console.log(`✓ Inserted ${insertedDepts.length} departments`);

    // Create department key to ID mapping
    const deptMap = new Map(insertedDepts.map(d => [d.key, d.id]));

    // Insert roles with department references
    const rolesWithDeptIds = ROLES.map(r => ({
      key: r.key,
      label: r.label,
      description: r.description,
      departmentId: deptMap.get(r.departmentKey) || null,
    }));

    const insertedRoles = await db.insert(roles)
      .values(rolesWithDeptIds)
      .returning();
    
    console.log(`✓ Inserted ${insertedRoles.length} roles`);

    // Insert platforms
    const insertedPlatforms = await db.insert(controlPanelPlatforms)
      .values(PLATFORMS.map(p => ({ key: p.key, label: p.label, description: p.description })))
      .returning();
    
    console.log(`✓ Inserted ${insertedPlatforms.length} platforms`);

    console.log('✓ Control Panel Registry initialized successfully');
  } catch (error) {
    console.error('Error initializing Control Panel Registry:', error);
    throw error;
  }
}

// ============================================================================
// PERMISSION CHECKING FUNCTIONS
// ============================================================================

/**
 * Get all effective roles for a user
 */
export async function getUserEffectiveRoles(userId: string) {
  const userRoleRecords = await db
    .select({
      roleId: userRoles.roleId,
      roleKey: roles.key,
      roleLabel: roles.label,
      departmentId: roles.departmentId,
      departmentKey: departments.key,
      departmentLabel: departments.label,
      scopeType: userRoles.scopeType,
      scopeId: userRoles.scopeId,
      grantedAt: userRoles.grantedAt,
      grantedBy: userRoles.grantedBy,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(departments, eq(roles.departmentId, departments.id))
    .where(eq(userRoles.userId, userId));

  return userRoleRecords;
}

/**
 * Check if user has a specific role
 */
export async function userHasRole(userId: string, roleKey: string, scopeType?: string, scopeId?: string): Promise<boolean> {
  const query = db
    .select()
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(roles.key, roleKey)
      )
    );

  // If scope is specified, check it as well
  if (scopeType && scopeId) {
    query.where(
      and(
        eq(userRoles.userId, userId),
        eq(roles.key, roleKey),
        eq(userRoles.scopeType, scopeType),
        eq(userRoles.scopeId, scopeId)
      )
    );
  }

  const result = await query;
  return result.length > 0;
}

/**
 * Check if user has any of the specified roles
 */
export async function userHasAnyRole(userId: string, roleKeys: string[]): Promise<boolean> {
  const userRoleRecords = await db
    .select()
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  const userRoleKeys = userRoleRecords.map(r => r.roles.key);
  return roleKeys.some(key => userRoleKeys.includes(key));
}

/**
 * Check if user has admin privileges (super_admin or company_admin)
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  return userHasAnyRole(userId, ['super_admin', 'company_admin']);
}

/**
 * Assign role to user
 */
export async function assignRoleToUser(
  userId: string,
  roleKey: string,
  scopeType: string | null,
  scopeId: string | null,
  grantedBy: string
) {
  // Get role ID from key
  const role = await db.select().from(roles).where(eq(roles.key, roleKey)).limit(1);
  
  if (role.length === 0) {
    throw new Error(`Role not found: ${roleKey}`);
  }

  // Check if role already assigned
  const existing = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, role[0].id),
        scopeType ? eq(userRoles.scopeType, scopeType) : eq(userRoles.scopeType, null),
        scopeId ? eq(userRoles.scopeId, scopeId) : eq(userRoles.scopeId, null)
      )
    );

  if (existing.length > 0) {
    throw new Error('Role already assigned to user');
  }

  // Assign role
  const [assigned] = await db.insert(userRoles)
    .values({
      userId,
      roleId: role[0].id,
      scopeType,
      scopeId,
      grantedBy,
    })
    .returning();

  return assigned;
}

/**
 * Revoke role from user
 */
export async function revokeRoleFromUser(userId: string, userRoleId: number) {
  const deleted = await db
    .delete(userRoles)
    .where(
      and(
        eq(userRoles.id, userRoleId),
        eq(userRoles.userId, userId)
      )
    )
    .returning();

  if (deleted.length === 0) {
    throw new Error('Role assignment not found');
  }

  return deleted[0];
}

// ============================================================================
// REGISTRY EXPORT FUNCTIONS
// ============================================================================

/**
 * Get all departments
 */
export async function getAllDepartments() {
  return db.select().from(departments).where(eq(departments.isActive, true));
}

/**
 * Get all roles
 */
export async function getAllRoles() {
  return db
    .select({
      id: roles.id,
      key: roles.key,
      label: roles.label,
      description: roles.description,
      isActive: roles.isActive,
      departmentId: roles.departmentId,
      departmentKey: departments.key,
      departmentLabel: departments.label,
    })
    .from(roles)
    .leftJoin(departments, eq(roles.departmentId, departments.id))
    .where(eq(roles.isActive, true));
}

/**
 * Get all platforms
 */
export async function getAllPlatforms() {
  return db.select().from(controlPanelPlatforms).where(eq(controlPanelPlatforms.isActive, true));
}
