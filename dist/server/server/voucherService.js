import { storage } from './storage';
import { QRCodeService } from './qrCode';
import { logger } from './lib/logger';
export class VoucherService {
    // Create a new e-voucher with QR code
    static async createEVoucher(request) {
        // Get wash package details
        const washPackage = await storage.getWashPackage(request.packageId);
        if (!washPackage) {
            throw new Error('Invalid wash package');
        }
        // Generate unique voucher code
        const code = QRCodeService.generateVoucherCode();
        // Set expiration to 12 months from now
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        // Create voucher data
        const voucherData = {
            code,
            qrCode: '', // Will be updated after voucher is created
            packageId: request.packageId,
            value: washPackage.price,
            totalWashes: washPackage.washCount,
            remainingWashes: washPackage.washCount,
            recipientEmail: request.recipientEmail,
            recipientPhone: request.recipientPhone,
            senderName: request.senderName,
            personalMessage: request.personalMessage,
            digitalCardTheme: request.digitalCardTheme || 'default',
            expiresAt,
            isActive: true,
        };
        // Create voucher in database
        const voucher = await storage.createEVoucher(voucherData);
        // Generate QR code with voucher ID
        const qrCodeDataURL = await QRCodeService.generateVoucherQRCode(voucher.id, voucher.code, voucher.totalWashes, expiresAt);
        // Update voucher with QR code
        const updatedVoucher = await storage.updateEVoucher(voucher.id, {
            qrCode: qrCodeDataURL
        });
        return updatedVoucher;
    }
    // Redeem e-voucher via QR code scan (Nayax terminal integration)
    // 🔒 ATOMIC REDEMPTION: Prevents race conditions on multi-wash vouchers
    static async redeemVoucher(request) {
        try {
            // Parse QR code data
            const qrData = QRCodeService.parseQRCodeData(request.qrCodeData);
            if (!qrData) {
                return {
                    success: false,
                    message: 'Invalid QR code data'
                };
            }
            const washesRequested = request.washesRequested || 1;
            const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            // 🔒 ATOMIC TRANSACTION: Get voucher, validate, update, and log in single transaction
            // CRITICAL: Prevents race condition where multiple requests could overdraw remaining washes
            const result = await storage.redeemVoucherAtomic({
                code: qrData.code,
                washesRequested,
                userId: request.userId,
                washStationId: request.washStationId,
                transactionId,
            });
            if (!result.success) {
                return {
                    success: false,
                    message: result.error || 'Voucher redemption failed'
                };
            }
            return {
                success: true,
                message: `Successfully redeemed ${washesRequested} wash${washesRequested > 1 ? 'es' : ''}`,
                remainingWashes: result.remainingWashes,
                transactionId,
                voucherId: result.voucherId
            };
        }
        catch (error) {
            logger.error('Voucher redemption error', error);
            return {
                success: false,
                message: 'Redemption failed due to system error'
            };
        }
    }
    // Validate voucher for redemption
    static validateVoucher(voucher, qrData, washesRequested) {
        // Check if voucher is active
        if (!voucher.isActive) {
            return { isValid: false, reason: 'Voucher is not active' };
        }
        // Check if voucher has expired
        if (voucher.expiresAt && new Date() > new Date(voucher.expiresAt)) {
            return { isValid: false, reason: 'Voucher has expired' };
        }
        // Check if voucher has sufficient washes
        if (voucher.remainingWashes < washesRequested) {
            return { isValid: false, reason: `Insufficient washes remaining (${voucher.remainingWashes} available)` };
        }
        // Verify QR data matches voucher
        if (qrData.voucherId !== voucher.id.toString() || qrData.code !== voucher.code) {
            return { isValid: false, reason: 'QR code data mismatch' };
        }
        return { isValid: true };
    }
    // Get voucher details for mobile app display
    static async getVoucherDetails(code) {
        const voucher = await storage.getEVoucherByCode(code);
        return voucher || null;
    }
    // Get user's vouchers
    static async getUserVouchers(userId) {
        return await storage.getUserEVouchers(userId);
    }
    // Transfer voucher ownership (for gifting)
    static async transferVoucher(code, newOwnerId) {
        const voucher = await storage.getEVoucherByCode(code);
        if (!voucher || !voucher.isActive) {
            return false;
        }
        await storage.updateEVoucher(voucher.id, {
            ownerId: newOwnerId,
            activatedAt: new Date()
        });
        return true;
    }
}
