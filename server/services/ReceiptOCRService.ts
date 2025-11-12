/**
 * Receipt OCR Service
 * Uses Google Cloud Vision API for automatic receipt text extraction
 * Implements Camera-First UI/UX mandate with Smart-Fill capabilities
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';
import { logger } from '../lib/logger';

interface ReceiptData {
  date?: string;
  totalAmount?: number;
  vendorName?: string;
  taxId?: string;
  rawText: string;
  confidence: number;
}

class ReceiptOCRService {
  private visionClient: ImageAnnotatorClient | null = null;

  constructor() {
    try {
      this.visionClient = new ImageAnnotatorClient();
      logger.info('[ReceiptOCR] ✅ Google Vision API initialized');
    } catch (error) {
      logger.error('[ReceiptOCR] ⚠️ Failed to initialize Google Vision API', error);
      this.visionClient = null;
    }
  }

  /**
   * Extract text and structured data from receipt image
   */
  async extractReceiptData(imageBuffer: Buffer): Promise<ReceiptData> {
    if (!this.visionClient) {
      throw new Error('Google Vision API not initialized');
    }

    try {
      // Perform OCR with text detection
      const [result] = await this.visionClient.textDetection({
        image: { content: imageBuffer },
      });

      const detections = result.textAnnotations || [];
      
      if (detections.length === 0) {
        throw new Error('No text detected in image');
      }

      // Full text is in the first annotation
      const rawText = detections[0]?.description || '';
      
      logger.info('[ReceiptOCR] Raw text extracted', { 
        textLength: rawText.length,
        preview: rawText.substring(0, 100)
      });

      // Parse receipt data using regex patterns
      const receiptData: ReceiptData = {
        rawText,
        confidence: detections[0]?.confidence || 0.8,
      };

      // Extract date (various formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)
      const datePatterns = [
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
        /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
      ];

      for (const pattern of datePatterns) {
        const dateMatch = rawText.match(pattern);
        if (dateMatch) {
          const [_, p1, p2, p3] = dateMatch;
          
          // Try DD/MM/YYYY format first
          if (parseInt(p1) <= 31 && parseInt(p2) <= 12) {
            const day = p1.padStart(2, '0');
            const month = p2.padStart(2, '0');
            receiptData.date = `${p3}-${month}-${day}`;
            break;
          }
          // Try YYYY/MM/DD format
          else if (parseInt(p2) <= 12 && parseInt(p3) <= 31) {
            const month = p2.padStart(2, '0');
            const day = p3.padStart(2, '0');
            receiptData.date = `${p1}-${month}-${day}`;
            break;
          }
        }
      }

      // Extract total amount - Enhanced for Israeli receipts
      const amountPatterns = [
        // Israeli specific patterns (highest priority)
        /(?:סה"כ לתשלום|סה"כ כולל מע"מ|סה"כ אחרי עיגול)[:\s]*[₪]*\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
        /(?:total|סה"כ|סך הכל|Total Amount|TOTAL)[:\s]*[₪ILS\s]*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
        // With currency symbol
        /[₪]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
        /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*[₪ILS]/,
        // Fallback: standard amount format
        /(\d{2,4}\.\d{2})/,
      ];

      for (const pattern of amountPatterns) {
        const amountMatch = rawText.match(pattern);
        if (amountMatch) {
          // Remove commas from Israeli number format (1,982.00 → 1982.00)
          const amountStr = amountMatch[1].replace(/,/g, '');
          const amount = parseFloat(amountStr);
          if (amount > 0 && amount < 1000000) {  // Sanity check
            receiptData.totalAmount = amount;
            logger.info('[ReceiptOCR] Amount detected', { amount, pattern: pattern.source });
            break;
          }
        }
      }

      // Extract vendor/supplier name (usually at the top)
      const lines = rawText.split('\n').filter(line => line.trim().length > 0);
      if (lines.length > 0) {
        // First non-empty line is usually the vendor name
        receiptData.vendorName = lines[0].trim().substring(0, 100);
      }

      // Extract tax ID / VAT number - Enhanced for Israeli formats
      const taxIdPatterns = [
        /(?:עוסק מורשה|ע\.?מ\.?)[:\s]*(\d{9})/i,  // Israeli VAT
        /(?:ח\.?פ\.?\/ת\.?ז|ח\.פ|חפ)[:\s]*(\d{9})/i,  // Israeli company number
        /(?:HP|Tax ID|VAT)[:\s]*(\d{9})/i,  // English variants
      ];

      for (const pattern of taxIdPatterns) {
        const taxIdMatch = rawText.match(pattern);
        if (taxIdMatch) {
          receiptData.taxId = taxIdMatch[1];
          logger.info('[ReceiptOCR] Tax ID detected', { taxId: taxIdMatch[1] });
          break;
        }
      }

      logger.info('[ReceiptOCR] ✅ Receipt data extracted', {
        hasDate: !!receiptData.date,
        hasAmount: !!receiptData.totalAmount,
        hasVendor: !!receiptData.vendorName,
        hasTaxId: !!receiptData.taxId,
      });

      return receiptData;

    } catch (error) {
      logger.error('[ReceiptOCR] ❌ OCR extraction failed', error);
      throw new Error('Failed to extract receipt data');
    }
  }

  /**
   * Validate receipt image quality
   */
  async validateReceiptImage(imageBuffer: Buffer): Promise<{ valid: boolean; message?: string }> {
    if (!this.visionClient) {
      return { valid: false, message: 'Vision API not available' };
    }

    try {
      const [result] = await this.visionClient.textDetection({
        image: { content: imageBuffer },
      });

      const detections = result.textAnnotations || [];

      if (detections.length === 0) {
        return { valid: false, message: 'No text detected. Please ensure the receipt is clear and well-lit.' };
      }

      const textLength = (detections[0]?.description || '').length;
      if (textLength < 20) {
        return { valid: false, message: 'Receipt text is too short. Please capture the entire receipt.' };
      }

      return { valid: true };

    } catch (error) {
      logger.error('[ReceiptOCR] Validation failed', error);
      return { valid: false, message: 'Failed to validate receipt image' };
    }
  }
}

export const receiptOCRService = new ReceiptOCRService();
