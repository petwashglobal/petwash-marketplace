import { storage } from './storage';
import { QRCodeService } from './qrCode';
import type { InsertEVoucher, EVoucher, InsertEVoucherRedemption } from '@shared/schema';
import { logger } from './lib/logger';

export interface CreateVoucherRequest {
  packageId: number;
  recipientEmail?: string;
  recipientPhone?: string;
  senderName?: string;
  personalMessage?: string;
  digitalCardTheme?: string;
}

export interface RedeemVoucherRequest {
  qrCodeData: string;
  washStationId: string;
  userId?: string;
  washesRequested?: number;
}

export interface VoucherRedemptionResult {
  success: boolean;
  message: string;
  remainingWashes?: number;
  transactionId?: string;
  voucherId?: number;
}

export class VoucherService {
  // Create a new e-voucher with QR code
  static async createEVoucher(request: CreateVoucherRequest): Promise<EVoucher> {
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
    const voucherData: InsertEVoucher = {
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
    const qrCodeDataURL = await QRCodeService.generateVoucherQRCode(
      voucher.id,
      voucher.code,
      voucher.totalWashes,
      expiresAt
    );

    // Update voucher with QR code
    const updatedVoucher = await storage.updateEVoucher(voucher.id, {
      qrCode: qrCodeDataURL
    });

    return updatedVoucher;
  }

  // Redeem e-voucher via QR code scan (Nayax terminal integration)
  static async redeemVoucher(request: RedeemVoucherRequest): Promise<VoucherRedemptionResult> {
    try {
      // Parse QR code data
      const qrData = QRCodeService.parseQRCodeData(request.qrCodeData);
      if (!qrData) {
        return {
          success: false,
          message: 'Invalid QR code data'
        };
      }

      // Get voucher from database
      const voucher = await storage.getEVoucherByCode(qrData.code);
      if (!voucher) {
        return {
          success: false,
          message: 'Voucher not found'
        };
      }

      // Validate voucher
      const validationResult = this.validateVoucher(voucher, qrData, request.washesRequested || 1);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: validationResult.reason || 'Voucher validation failed'
        };
      }

      // Process redemption
      const washesUsed = request.washesRequested || 1;
      const newRemainingWashes = voucher.remainingWashes - washesUsed;

      // Create redemption record
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const redemptionData: InsertEVoucherRedemption = {
        voucherId: voucher.id,
        userId: request.userId,
        washStationId: request.washStationId,
        washesUsed,
        transactionId,
      };

      await storage.createEVoucherRedemption(redemptionData);

      // Update voucher remaining washes
      await storage.updateEVoucher(voucher.id, {
        remainingWashes: newRemainingWashes,
        activatedAt: voucher.activatedAt || new Date(),
      });

      return {
        success: true,
        message: `Successfully redeemed ${washesUsed} wash${washesUsed > 1 ? 'es' : ''}`,
        remainingWashes: newRemainingWashes,
        transactionId,
        voucherId: voucher.id
      };

    } catch (error) {
      logger.error('Voucher redemption error', error);
      return {
        success: false,
        message: 'Redemption failed due to system error'
      };
    }
  }

  // Validate voucher for redemption
  private static validateVoucher(
    voucher: EVoucher, 
    qrData: any, 
    washesRequested: number
  ): { isValid: boolean; reason?: string } {
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
  static async getVoucherDetails(code: string): Promise<EVoucher | null> {
    const voucher = await storage.getEVoucherByCode(code);
    return voucher || null;
  }

  // Get user's vouchers
  static async getUserVouchers(userId: string): Promise<EVoucher[]> {
    return await storage.getUserEVouchers(userId);
  }

  // Transfer voucher ownership (for gifting)
  static async transferVoucher(code: string, newOwnerId: string): Promise<boolean> {
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