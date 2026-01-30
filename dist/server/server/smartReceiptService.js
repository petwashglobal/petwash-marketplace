import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { db } from './db';
import { smartWashReceipts, users, washPackages, loyaltyAnalytics } from '@shared/schema';
import { TIER_CONFIGS } from '@shared/schema-loyalty';
import { eq } from 'drizzle-orm';
import { logger } from './lib/logger';
export class SmartReceiptService {
    static POINTS_PER_SHEKEL = 1; // 1 point per ₪1 spent
    /**
     * Generate unique transaction ID in TX-XXXXXXX format
     */
    static generateTransactionId() {
        const randomPart = nanoid(7).toUpperCase();
        return `TX-${randomPart}`;
    }
    /**
     * Mask customer ID (phone or email) for privacy
     */
    static maskCustomerId(identifier) {
        if (identifier.includes('@')) {
            // Email masking: j***@example.com
            const [localPart, domain] = identifier.split('@');
            const maskedLocal = localPart.charAt(0) + '*'.repeat(Math.max(localPart.length - 1, 3));
            return `${maskedLocal}@${domain}`;
        }
        else {
            // Phone masking: +972-***-***-1234
            const cleaned = identifier.replace(/\D/g, '');
            if (cleaned.length >= 10) {
                return `+972-***-***-${cleaned.slice(-4)}`;
            }
            return `***-***-${cleaned.slice(-4)}`;
        }
    }
    /**
     * Calculate loyalty points earned from purchase
     */
    static calculateLoyaltyPoints(finalTotal) {
        return Math.floor(finalTotal * this.POINTS_PER_SHEKEL);
    }
    /**
     * Calculate tier progress based on total points (7-STAR SYSTEM)
     */
    static calculateTierProgress(currentPoints) {
        let currentTierConfig = TIER_CONFIGS[0];
        let nextTierConfig = null;
        // Find current tier
        for (let i = TIER_CONFIGS.length - 1; i >= 0; i--) {
            if (currentPoints >= TIER_CONFIGS[i].threshold) {
                currentTierConfig = TIER_CONFIGS[i];
                // Get next tier if exists
                if (i < TIER_CONFIGS.length - 1) {
                    nextTierConfig = TIER_CONFIGS[i + 1];
                }
                break;
            }
        }
        const nextTierPoints = nextTierConfig?.threshold ?? currentPoints;
        const pointsToNextTier = nextTierConfig ? nextTierPoints - currentPoints : 0;
        const progressPercentage = nextTierConfig
            ? Math.min(100, ((currentPoints - currentTierConfig.threshold) / (nextTierPoints - currentTierConfig.threshold)) * 100)
            : 100;
        return {
            currentTier: currentTierConfig.name,
            nextTier: nextTierConfig?.name ?? currentTierConfig.name,
            currentTierPoints: currentPoints,
            nextTierPoints,
            pointsToNextTier: Math.max(0, pointsToNextTier),
            progressPercentage
        };
    }
    /**
     * Generate QR code for receipt URL
     */
    static async generateReceiptQRCode(receiptUrl) {
        try {
            return await QRCode.toDataURL(receiptUrl, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
        }
        catch (error) {
            logger.error('Error generating QR code', error);
            return '';
        }
    }
    /**
     * Update user's loyalty analytics
     */
    static async updateUserLoyaltyAnalytics(userId, pointsEarned, amountSpent) {
        try {
            // Get existing analytics or create new
            const [existingAnalytics] = await db
                .select()
                .from(loyaltyAnalytics)
                .where(eq(loyaltyAnalytics.userId, userId));
            const newTotalSpent = existingAnalytics
                ? parseFloat(existingAnalytics.totalSpent) + amountSpent
                : amountSpent;
            const newTotalWashes = existingAnalytics
                ? existingAnalytics.totalWashes + 1
                : 1;
            const tierProgress = this.calculateTierProgress(pointsEarned);
            if (existingAnalytics) {
                await db
                    .update(loyaltyAnalytics)
                    .set({
                    totalSpent: newTotalSpent.toString(),
                    totalWashes: newTotalWashes,
                    currentTier: tierProgress.currentTier.toLowerCase(),
                    lifetimeValue: newTotalSpent.toString(),
                    lastActivity: new Date(),
                    updatedAt: new Date()
                })
                    .where(eq(loyaltyAnalytics.userId, userId));
            }
            else {
                await db
                    .insert(loyaltyAnalytics)
                    .values({
                    userId,
                    totalSpent: newTotalSpent.toString(),
                    totalWashes: newTotalWashes,
                    currentTier: tierProgress.currentTier.toLowerCase(),
                    lifetimeValue: newTotalSpent.toString(),
                    lastActivity: new Date(),
                    averageMonthlySpend: "0"
                });
            }
        }
        catch (error) {
            logger.error('Error updating loyalty analytics', error);
        }
    }
    /**
     * Create a smart wash receipt
     */
    static async createSmartReceipt(request) {
        try {
            // Generate transaction ID
            const transactionId = this.generateTransactionId();
            // Get package details
            const [washPackage] = await db
                .select()
                .from(washPackages)
                .where(eq(washPackages.id, request.packageId));
            if (!washPackage) {
                throw new Error('Wash package not found');
            }
            // Get user details if provided
            let user;
            if (request.userId) {
                const [userResult] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, request.userId));
                user = userResult;
            }
            // Calculate loyalty points
            const loyaltyPointsEarned = this.calculateLoyaltyPoints(request.finalTotal);
            // Get current user's total points for tier calculation
            let currentUserPoints = loyaltyPointsEarned;
            if (user) {
                const [userAnalytics] = await db
                    .select()
                    .from(loyaltyAnalytics)
                    .where(eq(loyaltyAnalytics.userId, user.id));
                if (userAnalytics) {
                    currentUserPoints = Math.floor(parseFloat(userAnalytics.totalSpent)) + loyaltyPointsEarned;
                }
            }
            // Calculate tier progress
            const tierProgress = this.calculateTierProgress(currentUserPoints);
            // Generate receipt URL and QR code
            const receiptUrl = `https://petwash.co.il/receipt/${transactionId}`;
            const receiptQrCode = await this.generateReceiptQRCode(receiptUrl);
            // Mask customer identifier
            const customerIdMasked = this.maskCustomerId(user?.phone || user?.email || request.customerEmail);
            // Create receipt data
            const receiptData = {
                transactionId,
                userId: request.userId || null,
                packageId: request.packageId,
                locationName: request.locationName || 'Pet Wash™ Premium Station',
                washType: washPackage.name,
                washDuration: request.washDuration || 15,
                customerIdMasked,
                paymentMethod: request.paymentMethod,
                originalAmount: request.originalAmount.toString(),
                discountApplied: (request.discountApplied || 0).toString(),
                finalTotal: request.finalTotal.toString(),
                loyaltyPointsEarned,
                currentTierPoints: tierProgress.currentTierPoints,
                nextTierPoints: tierProgress.nextTierPoints,
                currentTier: tierProgress.currentTier,
                nextTier: tierProgress.nextTier,
                receiptQrCode,
                receiptUrl,
                emailSent: false,
                washDateTime: new Date()
            };
            // Insert receipt into database
            const [createdReceipt] = await db
                .insert(smartWashReceipts)
                .values(receiptData)
                .returning();
            // Update user's loyalty analytics
            if (request.userId) {
                await this.updateUserLoyaltyAnalytics(request.userId, loyaltyPointsEarned, request.finalTotal);
            }
            return createdReceipt;
        }
        catch (error) {
            logger.error('Error creating smart receipt', error);
            throw new Error('Failed to create smart receipt');
        }
    }
    /**
     * Get receipt by transaction ID
     */
    static async getReceiptByTransactionId(transactionId) {
        try {
            const [receipt] = await db
                .select()
                .from(smartWashReceipts)
                .where(eq(smartWashReceipts.transactionId, transactionId));
            return receipt || null;
        }
        catch (error) {
            logger.error('Error getting receipt', error);
            return null;
        }
    }
    /**
     * Get user's recent receipts
     */
    static async getUserReceipts(userId, limit = 10) {
        try {
            return await db
                .select()
                .from(smartWashReceipts)
                .where(eq(smartWashReceipts.userId, userId))
                .orderBy(smartWashReceipts.washDateTime)
                .limit(limit);
        }
        catch (error) {
            logger.error('Error getting user receipts', error);
            return [];
        }
    }
    /**
     * Generate tier progress display text
     */
    static getTierProgressText(receipt) {
        const { currentTierPoints, nextTierPoints, currentTier, nextTier } = receipt;
        if (currentTier === nextTier) {
            return `${currentTierPoints} pts - ${currentTier} Member`;
        }
        return `${currentTierPoints} / ${nextTierPoints} pts → ${nextTier}`;
    }
    /**
     * Get receipt sharing URL with UTM parameters
     */
    static getReceiptSharingUrl(transactionId) {
        return `https://petwash.co.il/receipt/${transactionId}?utm_source=receipt&utm_medium=qr&utm_campaign=loyalty`;
    }
    /**
     * Get rate experience URL
     */
    static getRateExperienceUrl(transactionId) {
        return `https://petwash.co.il/rate/${transactionId}?utm_source=receipt&utm_medium=email`;
    }
    /**
     * Get book next wash URL
     */
    static getBookNextWashUrl(packageId) {
        return `https://petwash.co.il/?package=${packageId}&utm_source=receipt&utm_medium=email&utm_campaign=retention`;
    }
    /**
     * Get referral link for user
     */
    static getReferralLink(userId) {
        return `https://petwash.co.il/?ref=${userId}&utm_source=receipt&utm_medium=referral`;
    }
}
