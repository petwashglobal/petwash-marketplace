/**
 * Receipt Fraud Detection Service
 * 
 * AI-powered fraud prevention for Israeli operations
 * Prevents employees/subcontractors from:
 * - Submitting fake receipts
 * - Creating duplicate expenses
 * - Manipulating receipt images
 * - Submitting excessive/unrealistic amounts
 * 
 * Uses:
 * - Google Vision API for OCR
 * - Gemini 2.5 Flash for fraud analysis
 * - Hash-based duplicate detection
 * - Pattern recognition for fake receipts
 */

import { GoogleGenAI } from "@google/genai";
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { logger } from '../lib/logger';
import crypto from 'crypto';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const visionClient = new ImageAnnotatorClient();

export interface ReceiptData {
  merchantName?: string;
  merchantAddress?: string;
  date?: string;
  time?: string;
  items: Array<{
    description: string;
    quantity?: number;
    price?: number;
  }>;
  subtotal?: number;
  tax?: number;
  total: number;
  currency?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  rawText: string;
}

export interface FraudAnalysisResult {
  fraudScore: number; // 0-100 (0 = legitimate, 100 = definitely fake)
  isLegitimate: boolean;
  flags: string[];
  warnings: string[];
  confidence: number; // 0-100
  analysis: string;
  ocrData: ReceiptData;
  duplicateHash: string;
}

export class ReceiptFraudDetectionService {
  /**
   * Analyze receipt image for fraud indicators
   */
  async analyzeReceipt(imageUrl: string, employeeId: string, amount: number): Promise<FraudAnalysisResult> {
    try {
      logger.info('[ReceiptFraud] Starting fraud analysis', { imageUrl, employeeId, amount });

      // Step 1: OCR extraction using Google Vision
      const ocrData = await this.extractReceiptData(imageUrl);
      
      // Step 2: Generate duplicate detection hash
      const duplicateHash = this.generateReceiptHash(ocrData);
      
      // Step 3: Check for duplicate submissions
      const isDuplicate = await this.checkDuplicate(duplicateHash, employeeId);
      
      // Step 4: AI fraud analysis using Gemini
      const geminiAnalysis = await this.geminiFraudAnalysis(ocrData, amount, isDuplicate);
      
      // Step 5: Calculate final fraud score
      const fraudScore = this.calculateFraudScore(ocrData, geminiAnalysis, isDuplicate, amount);
      
      // Step 6: Generate flags and warnings
      const { flags, warnings } = this.generateFlags(ocrData, geminiAnalysis, isDuplicate, amount);
      
      const result: FraudAnalysisResult = {
        fraudScore,
        isLegitimate: fraudScore < 30, // Below 30 = likely legitimate
        flags,
        warnings,
        confidence: geminiAnalysis.confidence,
        analysis: geminiAnalysis.summary,
        ocrData,
        duplicateHash,
      };

      logger.info('[ReceiptFraud] ✅ Analysis complete', {
        employeeId,
        fraudScore,
        isLegitimate: result.isLegitimate,
        flagCount: flags.length,
      });

      return result;

    } catch (error) {
      logger.error('[ReceiptFraud] Analysis failed', { error, imageUrl, employeeId });
      throw new Error('Receipt fraud analysis failed');
    }
  }

  /**
   * Extract receipt data using Google Vision OCR
   */
  private async extractReceiptData(imageUrl: string): Promise<ReceiptData> {
    try {
      const [result] = await visionClient.textDetection(imageUrl);
      const detections = result.textAnnotations;
      
      if (!detections || detections.length === 0) {
        throw new Error('No text detected in receipt image');
      }

      const rawText = detections[0]?.description || '';
      
      // Parse receipt using pattern matching
      const receipt: ReceiptData = {
        rawText,
        items: [],
        total: this.extractTotal(rawText),
        merchantName: this.extractMerchantName(rawText),
        date: this.extractDate(rawText),
        receiptNumber: this.extractReceiptNumber(rawText),
        currency: this.extractCurrency(rawText),
      };

      logger.info('[ReceiptFraud] OCR extraction complete', {
        textLength: rawText.length,
        merchantName: receipt.merchantName,
        total: receipt.total,
      });

      return receipt;

    } catch (error) {
      logger.error('[ReceiptFraud] OCR extraction failed', { error });
      throw error;
    }
  }

  /**
   * AI-powered fraud analysis using Gemini
   */
  private async geminiFraudAnalysis(
    receipt: ReceiptData,
    claimedAmount: number,
    isDuplicate: boolean
  ): Promise<{ confidence: number; summary: string; suspiciousPatterns: string[] }> {
    try {
      const prompt = `You are an expert fraud detection AI for expense receipts in Israel (ILS currency).

RECEIPT DATA:
${JSON.stringify(receipt, null, 2)}

CLAIMED AMOUNT: ₪${claimedAmount}
DUPLICATE FLAG: ${isDuplicate ? 'YES - This exact receipt hash has been submitted before!' : 'NO'}

Analyze this receipt for fraud indicators:

1. **Fake Receipt Patterns**:
   - Generic/template text
   - Missing critical details (merchant address, tax ID, receipt number)
   - Unrealistic formatting or spacing
   - Inconsistent fonts or text alignment
   - Computer-generated appearance vs. actual receipt printer
   - Missing VAT (Israel requires 18% VAT on most purchases)

2. **Amount Manipulation**:
   - Does claimed amount match OCR total?
   - Are prices realistic for Israel market?
   - Excessive spending (e.g., ₪500+ for lunch)
   - Round numbers (suspicious pattern: ₪100, ₪200, ₪500 exactly)

3. **Merchant Validation**:
   - Does merchant name make sense?
   - Is address format correct for Israel?
   - Does business type match expense category?

4. **Date/Time Anomalies**:
   - Weekend or holiday purchases (suspicious if not explained)
   - Late night purchases (2am-5am unusual for business expenses)
   - Future dates (impossible!)

5. **Duplicate Submission**:
   - If duplicate flag is YES, this is HIGH FRAUD RISK

Respond in JSON format:
{
  "confidence": <0-100>,
  "summary": "<brief analysis in 2-3 sentences>",
  "suspiciousPatterns": ["<pattern1>", "<pattern2>", ...]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(cleanedText);

      logger.info('[ReceiptFraud] Gemini analysis complete', {
        confidence: analysis.confidence,
        patternCount: analysis.suspiciousPatterns?.length || 0,
      });

      return analysis;

    } catch (error) {
      logger.error('[ReceiptFraud] Gemini analysis failed', { error });
      return {
        confidence: 50,
        summary: 'AI analysis unavailable - manual review required',
        suspiciousPatterns: ['ai_unavailable'],
      };
    }
  }

  /**
   * Calculate final fraud score (0-100)
   */
  private calculateFraudScore(
    receipt: ReceiptData,
    geminiAnalysis: any,
    isDuplicate: boolean,
    claimedAmount: number
  ): number {
    let score = 0;

    // Base score from Gemini AI (0-50 points)
    score += Math.min(50, geminiAnalysis.confidence || 0);

    // Duplicate submission (+40 points - CRITICAL)
    if (isDuplicate) {
      score += 40;
    }

    // Amount mismatch (+20 points)
    if (receipt.total && Math.abs(receipt.total - claimedAmount) > 5) {
      score += 20;
    }

    // Missing critical fields (+10 points each)
    if (!receipt.merchantName) score += 10;
    if (!receipt.date) score += 10;
    if (!receipt.receiptNumber) score += 10;

    // Excessive amount (+15 points if > ₪1000)
    if (claimedAmount > 1000) {
      score += 15;
    }

    // Round number pattern (+5 points)
    if (claimedAmount % 100 === 0) {
      score += 5;
    }

    return Math.min(100, score);
  }

  /**
   * Generate fraud flags and warnings
   */
  private generateFlags(
    receipt: ReceiptData,
    geminiAnalysis: any,
    isDuplicate: boolean,
    claimedAmount: number
  ): { flags: string[]; warnings: string[] } {
    const flags: string[] = [];
    const warnings: string[] = [];

    if (isDuplicate) {
      flags.push('duplicate');
      warnings.push('⚠️ DUPLICATE: This receipt has been submitted before');
    }

    if (receipt.total && Math.abs(receipt.total - claimedAmount) > 5) {
      flags.push('amount_mismatch');
      warnings.push(`Amount mismatch: Claimed ₪${claimedAmount} vs Receipt ₪${receipt.total}`);
    }

    if (!receipt.merchantName) {
      flags.push('missing_merchant');
      warnings.push('Missing merchant name - possible fake receipt');
    }

    if (!receipt.receiptNumber) {
      flags.push('missing_receipt_number');
      warnings.push('Missing receipt number - suspicious');
    }

    if (claimedAmount > 1000) {
      flags.push('excessive_amount');
      warnings.push(`Excessive amount: ₪${claimedAmount} requires manager approval`);
    }

    if (claimedAmount % 100 === 0) {
      flags.push('round_number');
      warnings.push('Round number pattern detected');
    }

    // Add Gemini-detected patterns
    if (geminiAnalysis.suspiciousPatterns) {
      geminiAnalysis.suspiciousPatterns.forEach((pattern: string) => {
        flags.push(pattern);
        warnings.push(`AI detected: ${pattern}`);
      });
    }

    return { flags, warnings };
  }

  /**
   * Generate hash for duplicate detection
   */
  private generateReceiptHash(receipt: ReceiptData): string {
    const hashInput = [
      receipt.merchantName || '',
      receipt.total || 0,
      receipt.date || '',
      receipt.receiptNumber || '',
    ].join('|').toLowerCase();

    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Check if receipt hash already exists
   */
  private async checkDuplicate(hash: string, employeeId: string): Promise<boolean> {
    try {
      const { db } = await import('../db');
      const { staffExpenses } = await import('../../shared/schema');
      const { and, eq, ne } = await import('drizzle-orm');

      const existing = await db.select()
        .from(staffExpenses)
        .where(
          and(
            eq(staffExpenses.duplicateCheckHash, hash),
            ne(staffExpenses.status, 'rejected') // Ignore rejected submissions
          )
        )
        .limit(1);

      return existing.length > 0;
    } catch (error) {
      logger.error('[ReceiptFraud] Duplicate check failed', { error });
      return false;
    }
  }

  // Helper methods for OCR parsing
  private extractTotal(text: string): number {
    const patterns = [
      /total[:\s]*₪?[\s]*(\d+\.?\d*)/i,
      /sum[:\s]*₪?[\s]*(\d+\.?\d*)/i,
      /סה"כ[:\s]*₪?[\s]*(\d+\.?\d*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return 0;
  }

  private extractMerchantName(text: string): string | undefined {
    const lines = text.split('\n').filter(l => l.trim());
    return lines[0]?.trim() || undefined;
  }

  private extractDate(text: string): string | undefined {
    const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
    const match = text.match(datePattern);
    return match ? match[1] : undefined;
  }

  private extractReceiptNumber(text: string): string | undefined {
    const patterns = [
      /receipt\s*#?:?\s*(\d+)/i,
      /מספר\s*קבלה:?\s*(\d+)/i,
      /מס['׳]\s*(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  private extractCurrency(text: string): string {
    if (text.includes('₪') || text.includes('ILS') || text.includes('שקל')) {
      return 'ILS';
    }
    if (text.includes('$') || text.includes('USD')) {
      return 'USD';
    }
    return 'ILS'; // Default for Israel
  }
}

export const receiptFraudDetection = new ReceiptFraudDetectionService();
