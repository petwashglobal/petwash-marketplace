import QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { logger } from './lib/logger';

export interface QRCodeData {
  voucherId: string;
  code: string;
  washCount: number;
  expiresAt: string;
  verificationHash: string;
  barcodeNumber: string;
  timestamp: string;
}

export interface BarcodeData {
  type: 'CODE128' | 'CODE39' | 'EAN13';
  value: string;
  checksum: string;
}

export class QRCodeService {
  // Generate unique barcode number for Nayax reader
  static generateUniqueBarcodeNumber(voucherId: number): string {
    // Generate unique 12-digit barcode number with timestamp and voucher ID
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const paddedVoucherId = voucherId.toString().padStart(4, '0'); // 4-digit voucher ID
    const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 2-digit random
    
    return `${timestamp}${paddedVoucherId}${randomSuffix}`;
  }

  // Generate barcode with checksum for CODE128 format
  static generateBarcodeData(barcodeNumber: string): BarcodeData {
    // Calculate simple checksum for validation
    const checksum = this.calculateChecksum(barcodeNumber);
    
    return {
      type: 'CODE128',
      value: barcodeNumber,
      checksum
    };
  }

  // Calculate checksum for barcode validation
  static calculateChecksum(value: string): string {
    let sum = 0;
    for (let i = 0; i < value.length; i++) {
      sum += parseInt(value[i]) * (i + 1);
    }
    return (sum % 103).toString().padStart(2, '0');
  }

  // Generate QR code for e-voucher with barcode integration
  static async generateVoucherQRCode(voucherId: number, code: string, washCount: number, expiresAt: Date): Promise<string> {
    const barcodeNumber = this.generateUniqueBarcodeNumber(voucherId);
    const timestamp = new Date().toISOString();
    
    const qrData: QRCodeData = {
      voucherId: voucherId.toString(),
      code,
      washCount,
      expiresAt: expiresAt.toISOString(),
      verificationHash: this.generateVerificationHash(code, voucherId.toString()),
      barcodeNumber,
      timestamp
    };

    try {
      // Generate QR code as data URL for embedding in vouchers
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'H',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 200
      });

      return qrCodeDataURL;
    } catch (error) {
      logger.error('QR code generation failed', error);
      throw new Error('Failed to generate QR code');
    }
  }

  // Generate barcode SVG for display (readable by Nayax DOT)
  static generateBarcodeSVG(barcodeNumber: string): string {
    const barcodeData = this.generateBarcodeData(barcodeNumber);
    
    // Simple CODE128 barcode representation as SVG
    const bars = this.generateCode128Bars(barcodeData.value);
    const width = bars.length * 2;
    const height = 50;
    
    let svgBars = '';
    for (let i = 0; i < bars.length; i++) {
      if (bars[i] === '1') {
        svgBars += `<rect x="${i * 2}" y="0" width="2" height="${height}" fill="black"/>`;
      }
    }
    
    return `
      <svg width="${width}" height="${height + 20}" xmlns="http://www.w3.org/2000/svg">
        ${svgBars}
        <text x="${width / 2}" y="${height + 15}" text-anchor="middle" font-family="monospace" font-size="10" fill="black">
          ${barcodeNumber}
        </text>
      </svg>
    `;
  }

  // Generate CODE128 barcode pattern (simplified)
  static generateCode128Bars(value: string): string {
    // Simplified CODE128 pattern generation
    let bars = '11010000100'; // Start B pattern
    
    for (const char of value) {
      const charCode = char.charCodeAt(0);
      // Simple pattern based on character code
      const pattern = (charCode % 2 === 0) ? '110100' : '100110';
      bars += pattern;
    }
    
    bars += '1100011101011'; // Stop pattern
    return bars;
  }

  // Generate unique voucher code
  static generateVoucherCode(): string {
    return `PW-${nanoid(8).toUpperCase()}`;
  }

  // Generate verification hash for security
  static generateVerificationHash(code: string, voucherId: string): string {
    const data = `${code}-${voucherId}-${process.env.QR_VERIFICATION_SECRET || 'pet-wash-secret'}`;
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
  }

  // Verify QR code data integrity
  static verifyQRCodeData(qrData: QRCodeData): boolean {
    const expectedHash = this.generateVerificationHash(qrData.code, qrData.voucherId);
    return qrData.verificationHash === expectedHash;
  }

  // Verify barcode data integrity
  static verifyBarcodeData(barcodeData: BarcodeData): boolean {
    const expectedChecksum = this.calculateChecksum(barcodeData.value);
    return barcodeData.checksum === expectedChecksum;
  }

  // Parse QR code data from Nayax terminal scan
  static parseQRCodeData(qrCodeString: string): QRCodeData | null {
    try {
      const data = JSON.parse(qrCodeString) as QRCodeData;
      
      // Verify required fields
      if (!data.voucherId || !data.code || !data.washCount || !data.expiresAt || !data.verificationHash || !data.barcodeNumber) {
        return null;
      }

      // Verify data integrity
      if (!this.verifyQRCodeData(data)) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to parse QR code data', error);
      return null;
    }
  }

  // Parse barcode data from Nayax terminal scan
  static parseBarcodeData(barcodeString: string): BarcodeData | null {
    try {
      // Extract barcode number and checksum from scanned string
      const match = barcodeString.match(/^(\d+)([A-F0-9]{2})$/);
      if (!match) {
        return null;
      }

      const barcodeData: BarcodeData = {
        type: 'CODE128',
        value: match[1],
        checksum: match[2]
      };

      // Verify barcode integrity
      if (!this.verifyBarcodeData(barcodeData)) {
        return null;
      }

      return barcodeData;
    } catch (error) {
      logger.error('Failed to parse barcode data', error);
      return null;
    }
  }
}