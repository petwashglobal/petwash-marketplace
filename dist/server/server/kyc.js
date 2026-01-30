// KYC Verification System - Server-side utilities
import { createHash } from 'crypto';
import { db } from './lib/firebase-admin';
import { logger } from './lib/logger';
// Trusted countries for international ID verification
export const TRUSTED_COUNTRIES = [
    'IL', // Israel
    'US', // United States
    'GB', // United Kingdom
    'CA', // Canada
    'AU', // Australia
    'FR', // France
    'DE', // Germany
    'NL', // Netherlands
    'BE', // Belgium
    'CH', // Switzerland
    'SE', // Sweden
    'NO', // Norway
    'DK', // Denmark
    'NZ', // New Zealand
    'IE', // Ireland
    'ES', // Spain (España)
    'PT', // Portugal
];
// Hash ID number with salt for duplicate detection (never store raw ID)
export function hashIdNumber(countryCode, idNumber) {
    const salt = process.env.KYC_SALT;
    if (!salt) {
        throw new Error('KYC_SALT environment variable not set');
    }
    const combined = `${salt}${countryCode}${idNumber}`;
    const hash = createHash('sha256').update(combined).digest('hex');
    return `sha256:${hash}`;
}
// Check if ID hash already exists in registry
export async function checkDuplicateId(idHash) {
    try {
        const registryDoc = await db.collection('kyc_registry').doc(idHash).get();
        if (registryDoc.exists) {
            const data = registryDoc.data();
            return { exists: true, uid: data.uid };
        }
        return { exists: false };
    }
    catch (error) {
        logger.error('Error checking duplicate ID', error);
        throw error;
    }
}
// Register ID hash in registry (call only after approval)
export async function registerIdHash(idHash, uid, type) {
    try {
        await db.collection('kyc_registry').doc(idHash).set({
            uid,
            type,
            createdAt: new Date()
        });
    }
    catch (error) {
        logger.error('Error registering ID hash', error);
        throw error;
    }
}
// Get KYC document for user
export async function getKYCDocument(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return null;
        }
        const userData = userDoc.data();
        return userData?.kyc || null;
    }
    catch (error) {
        logger.error('Error getting KYC document', error);
        throw error;
    }
}
// Update KYC document
export async function updateKYCDocument(uid, updates) {
    try {
        await db.collection('users').doc(uid).update({
            kyc: updates
        });
    }
    catch (error) {
        logger.error('Error updating KYC document', error);
        throw error;
    }
}
// Check if user has valid KYC approval
export async function hasValidKYCApproval(uid) {
    try {
        const kycDoc = await getKYCDocument(uid);
        if (!kycDoc) {
            return { valid: false };
        }
        // Check if approved and not expired
        if (kycDoc.status === 'approved') {
            if (kycDoc.expiresAt && new Date(kycDoc.expiresAt) < new Date()) {
                // Expired - update status
                await updateKYCDocument(uid, { status: 'expired' });
                return { valid: false };
            }
            return { valid: true, type: kycDoc.type };
        }
        return { valid: false };
    }
    catch (error) {
        logger.error('Error checking KYC approval', error);
        return { valid: false };
    }
}
// Get pending KYC submissions for admin review
export async function getPendingKYCSubmissions(limit = 50) {
    try {
        const usersSnapshot = await db.collection('users').limit(limit).get();
        const pending = [];
        for (const doc of usersSnapshot.docs) {
            const data = doc.data();
            if (data.kyc && data.kyc.status === 'pending') {
                // Get user profile for email and name
                const profileDoc = await db.collection('users').doc(doc.id).collection('profile').doc('data').get();
                const profileData = profileDoc.data();
                pending.push({
                    uid: doc.id,
                    email: profileData?.email || '',
                    firstName: profileData?.firstName || '',
                    lastName: profileData?.lastName || '',
                    type: data.kyc.type,
                    status: data.kyc.status,
                    submittedAt: data.kyc.submittedAt?.toDate ? data.kyc.submittedAt.toDate().toISOString() : data.kyc.submittedAt,
                    reviewedAt: data.kyc.reviewedAt?.toDate ? data.kyc.reviewedAt.toDate().toISOString() : data.kyc.reviewedAt,
                    docPaths: data.kyc.docPaths || [],
                    nameOnDoc: data.kyc.nameOnDoc,
                    dob: data.kyc.dob,
                    rejectionReason: data.kyc.rejectionReason
                });
            }
        }
        // Sort by submission date (newest first)
        pending.sort((a, b) => {
            const dateA = new Date(a.submittedAt).getTime();
            const dateB = new Date(b.submittedAt).getTime();
            return dateB - dateA;
        });
        return pending;
    }
    catch (error) {
        logger.error('Error getting pending submissions', error);
        throw error;
    }
}
// Approve KYC submission
export async function approveKYC(uid, reviewerUid, expiresAt) {
    try {
        const kycDoc = await getKYCDocument(uid);
        if (!kycDoc) {
            throw new Error('KYC document not found');
        }
        // Register ID hash in registry
        await registerIdHash(kycDoc.idHash, uid, kycDoc.type);
        // Update KYC document
        await updateKYCDocument(uid, {
            status: 'approved',
            reviewedAt: new Date(),
            reviewerUid,
            expiresAt: expiresAt || null
        });
        // Update user's discount flags in Firestore profile
        const profileRef = db.collection('users').doc(uid).collection('profile').doc('data');
        if (kycDoc.type === 'senior') {
            await profileRef.update({ seniorDiscount: true });
        }
        else if (kycDoc.type === 'disability') {
            await profileRef.update({ disabilityDiscount: true });
        }
    }
    catch (error) {
        logger.error('Error approving KYC', error);
        throw error;
    }
}
// Reject KYC submission
export async function rejectKYC(uid, reviewerUid, reason) {
    try {
        await updateKYCDocument(uid, {
            status: 'rejected',
            reviewedAt: new Date(),
            reviewerUid,
            rejectionReason: reason
        });
    }
    catch (error) {
        logger.error('Error rejecting KYC', error);
        throw error;
    }
}
// Log discount usage
export async function logDiscountUsage(uid, orderId, amount, kycType) {
    try {
        await db.collection('users').doc(uid).collection('loyalty_ledger').doc(orderId).set({
            orderId,
            amount,
            kycType,
            timestamp: new Date(),
            type: 'kyc_discount'
        });
    }
    catch (error) {
        logger.error('Error logging discount usage', error);
        throw error;
    }
}
// Calculate KYC discount percentage
export function getKYCDiscountPercentage(type) {
    switch (type) {
        case 'senior':
            return 10; // 10% senior discount (verified)
        case 'disability':
            return 10; // 10% disability discount (verified)
        case 'national_id':
            return 5; // 5% verified ID holder discount
        case 'passport':
        case 'drivers_license':
        case 'residence_permit':
            return 5; // 5% verified international customer discount
        default:
            return 0;
    }
}
// Validate if country code is from trusted list
export function isTrustedCountry(countryCode) {
    return TRUSTED_COUNTRIES.includes(countryCode.toUpperCase());
}
// Get document type display names (bilingual)
export function getDocumentTypeName(type, language = 'en') {
    const names = {
        disability: {
            en: { name: 'Disability Certificate', description: 'Israeli disability certificate (תעודת נכה)' },
            he: { name: 'תעודת נכה', description: 'תעודת נכה ישראלית (Disability Certificate)' }
        },
        senior: {
            en: { name: 'Senior/Pensioner Certificate', description: 'Israeli senior citizen certificate (תעודת פנסיונרים)' },
            he: { name: 'תעודת פנסיונרים', description: 'תעודת פנסיונרים ישראלית (Senior Certificate)' }
        },
        national_id: {
            en: { name: 'National ID Card', description: 'Israeli identity card (תעודת זהות)' },
            he: { name: 'תעודת זהות', description: 'תעודת זהות ישראלית (National ID Card)' }
        },
        passport: {
            en: { name: 'Passport', description: 'Valid international passport from trusted countries' },
            he: { name: 'דרכון', description: 'דרכון בינלאומי בתוקף ממדינות מהימנות' }
        },
        drivers_license: {
            en: { name: 'Driver\'s License', description: 'Valid driver\'s license from trusted countries' },
            he: { name: 'רישיון נהיגה', description: 'רישיון נהיגה בתוקף ממדינות מהימנות' }
        },
        residence_permit: {
            en: { name: 'Residence Permit', description: 'Valid residence permit or visa' },
            he: { name: 'רישיון שהייה', description: 'רישיון שהייה או ויזה בתוקף' }
        }
    };
    return names[type][language];
}
// Get country name (bilingual)
export function getCountryName(countryCode, language = 'en') {
    const countries = {
        IL: { en: 'Israel', he: 'ישראל' },
        US: { en: 'United States', he: 'ארצות הברית' },
        GB: { en: 'United Kingdom', he: 'בריטניה' },
        CA: { en: 'Canada', he: 'קנדה' },
        AU: { en: 'Australia', he: 'אוסטרליה' },
        FR: { en: 'France', he: 'צרפת' },
        DE: { en: 'Germany', he: 'גרמניה' },
        NL: { en: 'Netherlands', he: 'הולנד' },
        BE: { en: 'Belgium', he: 'בלגיה' },
        CH: { en: 'Switzerland', he: 'שוויץ' },
        SE: { en: 'Sweden', he: 'שוודיה' },
        NO: { en: 'Norway', he: 'נורווגיה' },
        DK: { en: 'Denmark', he: 'דנמרק' },
        NZ: { en: 'New Zealand', he: 'ניו זילנד' },
        IE: { en: 'Ireland', he: 'אירלנד' },
    };
    return countries[countryCode.toUpperCase()]?.[language] || countryCode;
}
// Check if user has KYC discount available for checkout
export async function checkKYCDiscount(uid) {
    try {
        const { valid, type } = await hasValidKYCApproval(uid);
        if (!valid || !type) {
            return { hasDiscount: false, discountPercent: 0, type: null };
        }
        const discountPercent = getKYCDiscountPercentage(type);
        return { hasDiscount: true, discountPercent, type };
    }
    catch (error) {
        logger.error('Error checking KYC discount', error);
        return { hasDiscount: false, discountPercent: 0, type: null };
    }
}
// Validate file upload
export function validateKYCFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const minSize = 50 * 1024; // 50KB
    if (!allowedTypes.includes(file.mimetype)) {
        return { valid: false, error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed.' };
    }
    if (file.size > maxSize) {
        return { valid: false, error: 'File too large. Maximum size is 10MB.' };
    }
    if (file.size < minSize) {
        return { valid: false, error: 'File too small. Minimum size is 50KB for quality verification.' };
    }
    return { valid: true };
}
