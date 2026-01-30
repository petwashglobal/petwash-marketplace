/**
 * Pet Wash Ltd - Secure Company Registration Data
 *
 * ⚠️ CONFIDENTIAL - INTERNAL USE ONLY ⚠️
 * This information is NEVER exposed to the public
 * Only accessible by authorized personnel
 */
import { db as adminDb } from './lib/firebase-admin';
import { logger } from './lib/logger';
// Authorized personnel who can access this information
const AUTHORIZED_USERS = [
    'nirhadad1@gmail.com', // Nir Hadad - Owner & CEO
    'ido.shakarzi@example.com' // Ido Shakarzi - Approved personnel
];
/**
 * Official Company Registration Data
 * ⚠️ CONFIDENTIAL - DO NOT EXPOSE PUBLICLY
 */
const COMPANY_REGISTRATION = {
    // Company Details
    companyName: 'PET WASH LTD',
    companyNameHebrew: 'פט וואש בע"מ',
    companyNumber: '517145033',
    registrationDate: '2025-04-02',
    status: 'Active (פעילה)',
    companyType: 'Israeli Private Company (חברה פרטית)',
    liability: 'Limited Liability (בערבון מוגבל)',
    // Business Information
    businessPurpose: [
        'Establishment, management and operation of self-service pet washing stations',
        'Development of technologies and related services in the field of animal care and hygiene',
        'Marketing, import and export of equipment, materials and services related to pet washing',
        'Any other legal business activity compatible with the company\'s objectives'
    ],
    registeredAddress: {
        street: 'Uzi Hitman 8',
        city: 'Rosh HaAyin',
        postalCode: '4806859'
    },
    // Capital Structure
    authorizedShares: 1000,
    issuedShares: 1000,
    shareValue: 1,
    currency: 'ILS (New Israeli Shekel)',
    // Owner/Director Information (CONFIDENTIAL)
    owner: {
        name: 'Nir Hadad',
        nameHebrew: 'חדד ניר',
        israeliId: '033554437',
        address: {
            street: 'Elimelech Rimalt 18',
            city: 'Ramat Gan',
            postalCode: '5228114'
        },
        roles: ['Sole Shareholder', 'Director', 'CEO (מנכ"ל)'],
        sharesOwned: 1000, // 100% ownership
        appointmentDate: '2025-04-02'
    },
    // Legal Status
    hasDebts: false,
    hasCharges: false,
    hasStatusChanges: false,
    // Document Reference
    certificateIssuedDate: '2025-07-20',
    lastUpdated: '2025-07-21'
};
/**
 * Check if user is authorized to access company registration data
 */
export function isAuthorizedUser(email) {
    return AUTHORIZED_USERS.includes(email.toLowerCase());
}
/**
 * Get company registration information
 * ⚠️ Only accessible by authorized personnel
 */
export async function getCompanyRegistration(requestedBy) {
    try {
        // Verify authorization
        if (!isAuthorizedUser(requestedBy)) {
            logger.warn('[Company Registration] Unauthorized access attempt', {
                requestedBy,
                timestamp: new Date().toISOString()
            });
            // Log unauthorized access attempt to Firestore
            await adminDb.collection('security_audit_log').add({
                type: 'unauthorized_access_attempt',
                resource: 'company_registration',
                requestedBy,
                timestamp: new Date(),
                granted: false
            });
            return null;
        }
        // Log authorized access
        logger.info('[Company Registration] Authorized access granted', {
            requestedBy
        });
        await adminDb.collection('security_audit_log').add({
            type: 'authorized_access',
            resource: 'company_registration',
            requestedBy,
            timestamp: new Date(),
            granted: true
        });
        return COMPANY_REGISTRATION;
    }
    catch (error) {
        logger.error('[Company Registration] Failed to retrieve data', error);
        return null;
    }
}
/**
 * Get public company information (safe for public display)
 * ⚠️ This does NOT include owner personal information
 */
export function getPublicCompanyInfo() {
    return {
        companyName: COMPANY_REGISTRATION.companyName,
        companyNameHebrew: COMPANY_REGISTRATION.companyNameHebrew,
        companyNumber: COMPANY_REGISTRATION.companyNumber,
        registrationDate: COMPANY_REGISTRATION.registrationDate,
        status: COMPANY_REGISTRATION.status,
        businessPurpose: COMPANY_REGISTRATION.businessPurpose,
        registeredAddress: COMPANY_REGISTRATION.registeredAddress
        // NO OWNER INFORMATION - Public safe only
    };
}
/**
 * Add authorized user (only current owner can add)
 */
export async function addAuthorizedUser(newUserEmail, authorizedBy) {
    try {
        // Only Nir Hadad can add authorized users
        if (authorizedBy.toLowerCase() !== 'nirhadad1@gmail.com') {
            logger.warn('[Company Registration] Unauthorized attempt to add user', {
                newUserEmail,
                authorizedBy
            });
            return false;
        }
        if (!AUTHORIZED_USERS.includes(newUserEmail.toLowerCase())) {
            AUTHORIZED_USERS.push(newUserEmail.toLowerCase());
            logger.info('[Company Registration] New authorized user added', {
                newUserEmail,
                authorizedBy
            });
            // Log to audit trail
            await adminDb.collection('security_audit_log').add({
                type: 'authorized_user_added',
                newUserEmail,
                authorizedBy,
                timestamp: new Date()
            });
            return true;
        }
        return false;
    }
    catch (error) {
        logger.error('[Company Registration] Failed to add authorized user', error);
        return false;
    }
}
/**
 * Sanitize any text to ensure NO owner personal information leaks
 */
export function sanitizeForPublic(text) {
    if (!text)
        return text;
    let sanitized = text;
    // Remove owner name
    sanitized = sanitized.replace(/Nir Hadad/gi, '[OWNER_NAME]');
    sanitized = sanitized.replace(/ניר חדד/g, '[OWNER_NAME]');
    sanitized = sanitized.replace(/חדד ניר/g, '[OWNER_NAME]');
    // Remove Israeli ID
    sanitized = sanitized.replace(/033554437/g, '[OWNER_ID]');
    // Remove personal addresses
    sanitized = sanitized.replace(/Elimelech Rimalt 18/gi, '[OWNER_ADDRESS]');
    sanitized = sanitized.replace(/רימלט אלימלך 18/g, '[OWNER_ADDRESS]');
    return sanitized;
}
