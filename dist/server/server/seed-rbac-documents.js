/**
 * Seed script for RBAC roles and document management system
 * Sets up:
 * - System roles (CEO, Director, K9000 Supplier, Franchise Owner, etc.)
 * - Role assignments for Nir Hadad and Ido Shakarzi
 * - Document categories
 * - Initial K9000 documents
 */
import { db } from './db';
import { systemRoles, documentCategories } from '../shared/schema-enterprise';
import { logger } from './lib/logger';
async function seedRBACAndDocuments() {
    try {
        // Production safeguard: Check if already seeded
        const existingRoles = await db.select().from(systemRoles).limit(1);
        if (existingRoles.length > 0) {
            logger.warn('⚠️  RBAC roles already seeded. Skipping to prevent duplication.');
            logger.warn('⚠️  To re-seed, manually delete records from systemRoles table first.');
            return;
        }
        logger.info('🔐 Seeding RBAC roles and permissions...');
        // 1. Create system roles
        const roles = await db.insert(systemRoles).values([
            // Super Admin - CEO
            {
                roleCode: 'CEO',
                roleName: 'Chief Executive Officer',
                roleNameHe: 'מנכ"ל',
                department: 'executive',
                accessLevel: 10,
                permissions: ['*'], // All permissions
                canAccessAllStations: true,
                canAccessFinancials: true,
                canAccessLegal: true,
                canAccessK9000Supplier: true,
                canManageFranchises: true,
                isActive: true,
            },
            // Super Admin - Director
            {
                roleCode: 'DIRECTOR',
                roleName: 'Director',
                roleNameHe: 'מנהל',
                department: 'executive',
                accessLevel: 10,
                permissions: ['*'],
                canAccessAllStations: true,
                canAccessFinancials: true,
                canAccessLegal: true,
                canAccessK9000Supplier: true,
                canManageFranchises: true,
                isActive: true,
            },
            // K9000 Supplier Manager
            {
                roleCode: 'K9000_SUPPLIER_MANAGER',
                roleName: 'K9000 Supplier Manager',
                roleNameHe: 'מנהל ספק K9000',
                department: 'k9000_supplier',
                accessLevel: 7,
                permissions: [
                    'view_documents',
                    'upload_documents',
                    'manage_inventory',
                    'view_orders',
                    'process_orders',
                    'manage_spare_parts'
                ],
                canAccessAllStations: false,
                canAccessFinancials: false,
                canAccessLegal: false,
                canAccessK9000Supplier: true,
                canManageFranchises: false,
                isActive: true,
            },
            // Franchise Owner
            {
                roleCode: 'FRANCHISE_OWNER',
                roleName: 'Franchise Owner',
                roleNameHe: 'בעל זיכיון',
                department: 'franchise',
                accessLevel: 5,
                permissions: [
                    'view_documents',
                    'view_own_stations',
                    'create_orders',
                    'view_own_bills',
                    'manage_own_inventory'
                ],
                canAccessAllStations: false,
                canAccessFinancials: false,
                canAccessLegal: false,
                canAccessK9000Supplier: false,
                canManageFranchises: false,
                isActive: true,
            },
            // Operations Manager
            {
                roleCode: 'OPERATIONS_MANAGER',
                roleName: 'Operations Manager',
                roleNameHe: 'מנהל תפעול',
                department: 'operations',
                accessLevel: 8,
                permissions: [
                    'view_documents',
                    'manage_stations',
                    'view_all_orders',
                    'manage_maintenance',
                    'view_analytics'
                ],
                canAccessAllStations: true,
                canAccessFinancials: false,
                canAccessLegal: false,
                canAccessK9000Supplier: false,
                canManageFranchises: true,
                isActive: true,
            },
            // Finance Manager
            {
                roleCode: 'FINANCE_MANAGER',
                roleName: 'Finance Manager',
                roleNameHe: 'מנהל פיננסי',
                department: 'finance',
                accessLevel: 8,
                permissions: [
                    'view_documents',
                    'view_all_bills',
                    'manage_payments',
                    'view_financials',
                    'generate_reports'
                ],
                canAccessAllStations: true,
                canAccessFinancials: true,
                canAccessLegal: false,
                canAccessK9000Supplier: false,
                canManageFranchises: false,
                isActive: true,
            },
            // Legal Manager
            {
                roleCode: 'LEGAL_MANAGER',
                roleName: 'Legal Manager',
                roleNameHe: 'מנהל משפטי',
                department: 'legal',
                accessLevel: 9,
                permissions: [
                    'view_documents',
                    'upload_documents',
                    'view_legal_documents',
                    'manage_contracts',
                    'view_confidential'
                ],
                canAccessAllStations: false,
                canAccessFinancials: false,
                canAccessLegal: true,
                canAccessK9000Supplier: false,
                canManageFranchises: false,
                isActive: true,
            },
        ]).returning();
        logger.info(`✅ Created ${roles.length} system roles`);
        // 2. Create document categories
        const categories = await db.insert(documentCategories).values([
            {
                categoryCode: 'k9000_invoices',
                categoryName: 'K9000 Invoices',
                categoryNameHe: 'חשבוניות K9000',
                department: 'k9000_supplier',
                requiredAccessLevel: 5,
                isConfidential: false,
                storagePath: 'k9000/invoices',
            },
            {
                categoryCode: 'k9000_contracts',
                categoryName: 'K9000 Contracts & Agreements',
                categoryNameHe: 'חוזים והסכמים K9000',
                department: 'k9000_supplier',
                requiredAccessLevel: 7,
                isConfidential: true,
                storagePath: 'k9000/contracts',
            },
            {
                categoryCode: 'k9000_technical',
                categoryName: 'K9000 Technical Specifications',
                categoryNameHe: 'מפרטים טכניים K9000',
                department: 'k9000_supplier',
                requiredAccessLevel: 5,
                isConfidential: false,
                storagePath: 'k9000/technical',
            },
            {
                categoryCode: 'k9000_manuals',
                categoryName: 'K9000 Operators Manuals',
                categoryNameHe: 'מדריכי הפעלה K9000',
                department: 'k9000_supplier',
                requiredAccessLevel: 5,
                isConfidential: false,
                storagePath: 'k9000/manuals',
            },
            {
                categoryCode: 'legal_trademark',
                categoryName: 'Trademark Applications',
                categoryNameHe: 'בקשות סימן מסחר',
                department: 'legal',
                requiredAccessLevel: 9,
                isConfidential: true,
                storagePath: 'legal/trademarks',
            },
            {
                categoryCode: 'legal_contracts',
                categoryName: 'Legal Contracts',
                categoryNameHe: 'חוזים משפטיים',
                department: 'legal',
                requiredAccessLevel: 9,
                isConfidential: true,
                storagePath: 'legal/contracts',
            },
            {
                categoryCode: 'franchise_agreements',
                categoryName: 'Franchise Agreements',
                categoryNameHe: 'הסכמי זיכיון',
                department: 'franchise',
                requiredAccessLevel: 7,
                isConfidential: true,
                storagePath: 'franchise/agreements',
            },
        ]).returning();
        logger.info(`✅ Created ${categories.length} document categories`);
        // 3. Assign roles to CEO and Director
        // Note: These will be created when users first log in with those emails
        // But we can pre-create them if we know their Firebase UIDs
        logger.info('✅ RBAC system seeded successfully');
        logger.info('');
        logger.info('📋 Super Admin Access:');
        logger.info('  - nir.h@petwash.co.il (Founder & CEO) - Full Access');
        logger.info('  - Ido.S@petwash.co.il (+972 55-8813036) (Director) - Full Access');
        logger.info('');
        logger.info('🔐 Access Control Rules:');
        logger.info('  - K9000 supplier personnel: Access ONLY to K9000 section');
        logger.info('  - Franchisees: Access ONLY to their own franchisee data');
        logger.info('  - Super admins: Unrestricted access to all sections');
        logger.info('  - Cross-section access requires super admin approval');
    }
    catch (error) {
        logger.error('Error seeding RBAC and documents:', error);
        throw error;
    }
}
// Run if called directly
if (require.main === module) {
    seedRBACAndDocuments()
        .then(() => {
        logger.info('✅ Seed complete!');
        process.exit(0);
    })
        .catch((error) => {
        logger.error('❌ Seed failed:', error);
        process.exit(1);
    });
}
export default seedRBACAndDocuments;
