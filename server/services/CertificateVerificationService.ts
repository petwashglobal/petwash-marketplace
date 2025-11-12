/**
 * Certificate Verification Service
 * תעודת נכה, גימלאים, תעודת זהות, רשיון נהיגה - Full Document Workflow
 * 
 * Complete Flow:
 * 1. Upload documents to Firebase Cloud Storage
 * 2. Scan with Google Vision API (OCR + Face Detection)
 * 3. Biometric face matching (selfie vs ID photo)
 * 4. Save results to PostgreSQL database
 * 5. Update user verification status
 * 6. Optional: Manual admin review for edge cases
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';
import { storage } from '../lib/firebase-admin';
import { db } from '../db';
import { 
  biometricCertificateVerifications, 
  users,
  approvedCountries,
  type InsertBiometricCertificateVerification,
  type BiometricCertificateVerification 
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { biometricVerification } from './BiometricVerificationService';

export type DocumentType = 
  | 'national_id' 
  | 'drivers_license' 
  | 'disability_certificate' 
  | 'retirement_certificate' 
  | 'club_membership';

interface UploadedDocument {
  frontUrl: string;
  backUrl?: string;
  selfieUrl: string;
}

interface DocumentScanResult {
  textExtracted: string;
  confidence: number;
  detectedFields: {
    name?: string;
    idNumber?: string;
    birthDate?: string;
    expiryDate?: string;
    issuingCountry?: string;
    documentType?: string;
  };
}

interface VerificationResult {
  success: boolean;
  verificationId: number;
  status: 'approved' | 'pending' | 'rejected' | 'manual_review';
  biometricMatchScore: number;
  message: string;
  requiresManualReview: boolean;
}

export class CertificateVerificationService {
  private visionClient: ImageAnnotatorClient | null = null;
  
  constructor() {
    // Initialize Google Vision API
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        this.visionClient = new ImageAnnotatorClient({
          credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        });
        logger.info('[CertificateVerification] ✅ Google Vision API initialized');
      } catch (error) {
        logger.error('[CertificateVerification] ⚠️ Failed to initialize Vision API:', error);
      }
    }
  }

  /**
   * Main verification flow - processes uploaded documents
   */
  async verifyDocument(
    userId: string,
    documentType: DocumentType,
    documentCountry: string,
    uploadedFiles: UploadedDocument,
    ipAddress?: string,
    userAgent?: string
  ): Promise<VerificationResult> {
    try {
      logger.info('[CertificateVerification] Starting verification', { 
        userId, 
        documentType, 
        documentCountry 
      });

      // Step 0: Validate country is approved
      const countryCheck = await this.validateApprovedCountry(documentCountry, documentType);
      if (!countryCheck.isValid) {
        throw new Error(countryCheck.reason || 'Country not approved for verification');
      }

      // Step 1: Scan document with OCR
      const ocrResult = await this.scanDocument(uploadedFiles.frontUrl);
      
      // Step 2: Biometric face matching (selfie vs ID photo)
      const biometricResult = await biometricVerification.verifyIdentity(
        uploadedFiles.selfieUrl,
        uploadedFiles.frontUrl
      );

      // Step 3: Determine verification status
      const requiresManualReview = this.requiresManualReview(
        documentType,
        documentCountry,
        biometricResult.matchScore,
        ocrResult.confidence
      );

      const verificationStatus = this.determineStatus(
        biometricResult.isMatch,
        requiresManualReview,
        documentType
      );

      // Step 4: Save to database
      const verificationRecord = await this.saveVerification({
        userId,
        documentType,
        documentCountry,
        documentFrontUrl: uploadedFiles.frontUrl,
        documentBackUrl: uploadedFiles.backUrl || null,
        selfiePhotoUrl: uploadedFiles.selfieUrl,
        ocrTextExtracted: ocrResult.textExtracted,
        ocrConfidence: ocrResult.confidence.toString(),
        detectedFields: ocrResult.detectedFields,
        biometricMatchStatus: biometricResult.status,
        biometricMatchScore: biometricResult.matchScore.toString(),
        faceDetectionData: biometricResult.faceDetection,
        verificationStatus,
        verificationMethod: requiresManualReview ? 'manual' : 'automatic',
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        isDisabilityVerified: documentType === 'disability_certificate' && verificationStatus === 'approved',
        isRetirementVerified: documentType === 'retirement_certificate' && verificationStatus === 'approved',
        isClubMemberVerified: documentType === 'club_membership' && verificationStatus === 'approved',
        auditLog: [{
          timestamp: new Date().toISOString(),
          action: 'verification_submitted',
          notes: `Initial upload - ${documentType} from ${documentCountry}`
        }]
      });

      // Step 5: Update user profile if approved automatically
      if (verificationStatus === 'approved') {
        await this.updateUserProfile(userId, documentType);
      }

      // Step 6: Return result
      return {
        success: true,
        verificationId: verificationRecord.id,
        status: verificationStatus as any,
        biometricMatchScore: biometricResult.matchScore,
        message: this.getStatusMessage(verificationStatus, documentType, biometricResult.matchScore),
        requiresManualReview
      };

    } catch (error: any) {
      logger.error('[CertificateVerification] Verification failed', error);
      throw new Error(`Verification failed: ${error.message}`);
    }
  }

  /**
   * Validate that country is approved for document verification
   */
  private async validateApprovedCountry(
    countryCode: string,
    documentType: DocumentType
  ): Promise<{ isValid: boolean; reason?: string }> {
    try {
      const [country] = await db
        .select()
        .from(approvedCountries)
        .where(eq(approvedCountries.countryCode, countryCode.toUpperCase()));

      if (!country) {
        return {
          isValid: false,
          reason: `Country ${countryCode} is not in our approved countries list`
        };
      }

      if (!country.isActive) {
        return {
          isValid: false,
          reason: `Country ${countryCode} is currently disabled for verification`
        };
      }

      // Check if country accepts specific document type
      if (documentType === 'national_id' && !country.acceptsNationalId) {
        return {
          isValid: false,
          reason: `Country ${countryCode} does not accept national ID cards`
        };
      }

      if (documentType === 'drivers_license' && !country.acceptsDriversLicense) {
        return {
          isValid: false,
          reason: `Country ${countryCode} does not accept driver's licenses`
        };
      }

      logger.info('[CertificateVerification] Country validation passed', {
        countryCode,
        documentType,
        requiresManualReview: country.requiresManualReview
      });

      return { isValid: true };
    } catch (error: any) {
      logger.error('[CertificateVerification] Country validation error', error);
      return {
        isValid: false,
        reason: 'Failed to validate country approval status'
      };
    }
  }

  /**
   * Get list of approved countries
   */
  async getApprovedCountries() {
    return await db
      .select()
      .from(approvedCountries)
      .where(eq(approvedCountries.isActive, true))
      .orderBy(approvedCountries.countryName);
  }

  /**
   * Scan document with Google Vision OCR
   */
  private async scanDocument(imageUrl: string): Promise<DocumentScanResult> {
    if (!this.visionClient) {
      return {
        textExtracted: '',
        confidence: 0,
        detectedFields: {}
      };
    }

    try {
      // Run text detection and document text detection in parallel
      const [textResult, docTextResult] = await Promise.all([
        this.visionClient.textDetection(imageUrl),
        this.visionClient.documentTextDetection(imageUrl)
      ]);

      const textAnnotations = textResult[0].textAnnotations || [];
      const fullText = textAnnotations.length > 0 ? textAnnotations[0].description || '' : '';
      
      // Calculate confidence from first annotation
      const confidence = textAnnotations.length > 0 
        ? (textAnnotations[0].confidence || 0.8) * 100 
        : 0;

      // Extract structured fields
      const detectedFields = this.extractFields(fullText);

      logger.info('[CertificateVerification] OCR completed', { 
        textLength: fullText.length, 
        confidence 
      });

      return {
        textExtracted: fullText,
        confidence,
        detectedFields
      };
    } catch (error: any) {
      logger.error('[CertificateVerification] OCR failed', error);
      return {
        textExtracted: '',
        confidence: 0,
        detectedFields: {}
      };
    }
  }

  /**
   * Extract structured fields from OCR text
   */
  private extractFields(text: string): DocumentScanResult['detectedFields'] {
    const fields: DocumentScanResult['detectedFields'] = {};

    // Extract ID number (various patterns)
    const idPatterns = [
      /\b\d{9}\b/,  // Israeli ID (9 digits)
      /\b[A-Z0-9]{8,12}\b/,  // General ID/License number
    ];
    for (const pattern of idPatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.idNumber = match[0];
        break;
      }
    }

    // Extract dates (various formats)
    const datePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
    const dates = text.match(datePattern);
    if (dates && dates.length > 0) {
      fields.expiryDate = dates[dates.length - 1]; // Typically last date
      if (dates.length > 1) {
        fields.birthDate = dates[0]; // Typically first date
      }
    }

    // Extract country (common country names)
    const countryPatterns = [
      { pattern: /israel|ישראל/i, code: 'IL' },
      { pattern: /united states|usa/i, code: 'US' },
      { pattern: /united kingdom|uk|britain/i, code: 'GB' },
      { pattern: /france|française/i, code: 'FR' },
      { pattern: /germany|deutschland/i, code: 'DE' },
    ];
    for (const { pattern, code } of countryPatterns) {
      if (pattern.test(text)) {
        fields.issuingCountry = code;
        break;
      }
    }

    // Detect document type
    if (/driver|license|רישיון|נהיגה/i.test(text)) {
      fields.documentType = 'drivers_license';
    } else if (/passport|דרכון/i.test(text)) {
      fields.documentType = 'passport';
    } else if (/נכה|disability/i.test(text)) {
      fields.documentType = 'disability_certificate';
    } else if (/גימלאי|retirement|pension/i.test(text)) {
      fields.documentType = 'retirement_certificate';
    }

    return fields;
  }

  /**
   * Determine if manual review is needed
   */
  private requiresManualReview(
    documentType: DocumentType,
    country: string,
    biometricScore: number,
    ocrConfidence: number
  ): boolean {
    // Israeli disability/retirement certificates always need manual review
    if (documentType === 'disability_certificate' || documentType === 'retirement_certificate') {
      return true;
    }

    // Low biometric match score
    if (biometricScore < 75) {
      return true;
    }

    // Low OCR confidence
    if (ocrConfidence < 70) {
      return true;
    }

    // High-risk countries (example - adjust as needed)
    const highRiskCountries = ['XX', 'YY'];
    if (highRiskCountries.includes(country)) {
      return true;
    }

    return false;
  }

  /**
   * Determine verification status
   */
  private determineStatus(
    biometricMatch: boolean,
    requiresManualReview: boolean,
    documentType: DocumentType
  ): 'approved' | 'pending' | 'rejected' | 'manual_review' {
    if (requiresManualReview) {
      return 'manual_review';
    }

    if (!biometricMatch) {
      return 'rejected';
    }

    // Automatic approval for standard IDs with good biometric match
    if (documentType === 'national_id' || documentType === 'drivers_license') {
      return 'approved';
    }

    // Everything else pending manual review
    return 'manual_review';
  }

  /**
   * Save verification to database
   */
  private async saveVerification(
    data: Partial<InsertBiometricCertificateVerification>
  ): Promise<BiometricCertificateVerification> {
    const [record] = await db
      .insert(biometricCertificateVerifications)
      .values(data as InsertBiometricCertificateVerification)
      .returning();
    
    logger.info('[CertificateVerification] Saved to database', { id: record.id });
    return record;
  }

  /**
   * Update user profile with verification status
   */
  private async updateUserProfile(userId: string, documentType: DocumentType): Promise<void> {
    const updates: Partial<typeof users.$inferInsert> = {};

    if (documentType === 'disability_certificate') {
      updates.isDisabilityVerified = true;
      updates.loyaltyTier = 'verified_disability';
      updates.maxDiscountPercent = 10;
    } else if (documentType === 'retirement_certificate') {
      updates.isSeniorVerified = true;
      updates.loyaltyTier = 'verified_senior';
      updates.maxDiscountPercent = 10;
    } else if (documentType === 'club_membership') {
      updates.isClubMember = true;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, userId));
      logger.info('[CertificateVerification] User profile updated', { userId, updates });
    }
  }

  /**
   * Get user-friendly status message
   */
  private getStatusMessage(
    status: string,
    documentType: DocumentType,
    biometricScore: number
  ): string {
    const docTypeNames: Record<DocumentType, { en: string; he: string }> = {
      national_id: { en: 'National ID', he: 'תעודת זהות' },
      drivers_license: { en: 'Driver\'s License', he: 'רשיון נהיגה' },
      disability_certificate: { en: 'Disability Certificate', he: 'תעודת נכה' },
      retirement_certificate: { en: 'Retirement Certificate', he: 'תעודת גימלאי' },
      club_membership: { en: 'Club Membership', he: 'חברות מועדון' }
    };

    const docName = docTypeNames[documentType];

    switch (status) {
      case 'approved':
        return `✅ ${docName.he} אומתה בהצלחה! קיבלת גישה להטבות המיוחדות.`;
      
      case 'manual_review':
        return `⏳ ${docName.he} נשלחה לבדיקה ידנית. נעדכן אותך תוך 24-48 שעות.`;
      
      case 'rejected':
        return `❌ האימות נכשל (${biometricScore.toFixed(0)}% התאמה). אנא העלה תמונות ברורות יותר.`;
      
      default:
        return `⏳ ${docName.he} בתהליך עיבוד...`;
    }
  }

  /**
   * Get user's verification history
   */
  async getUserVerifications(userId: string): Promise<BiometricCertificateVerification[]> {
    return await db
      .select()
      .from(biometricCertificateVerifications)
      .where(eq(biometricCertificateVerifications.userId, userId))
      .orderBy(desc(biometricCertificateVerifications.createdAt));
  }

  /**
   * Get pending verifications for admin review
   */
  async getPendingVerifications(): Promise<BiometricCertificateVerification[]> {
    return await db
      .select()
      .from(biometricCertificateVerifications)
      .where(eq(biometricCertificateVerifications.verificationStatus, 'manual_review'))
      .orderBy(desc(biometricCertificateVerifications.createdAt));
  }

  /**
   * Admin: Approve verification manually
   */
  async approveVerification(
    verificationId: number,
    adminUid: string,
    notes?: string
  ): Promise<void> {
    const [verification] = await db
      .select()
      .from(biometricCertificateVerifications)
      .where(eq(biometricCertificateVerifications.id, verificationId));

    if (!verification) {
      throw new Error('Verification not found');
    }

    // Update verification
    await db
      .update(biometricCertificateVerifications)
      .set({
        verificationStatus: 'approved',
        verifiedAt: new Date(),
        verifiedBy: adminUid,
        auditLog: [
          ...(verification.auditLog as any[] || []),
          {
            timestamp: new Date().toISOString(),
            action: 'manual_approval',
            user: adminUid,
            notes: notes || 'Approved by admin'
          }
        ]
      })
      .where(eq(biometricCertificateVerifications.id, verificationId));

    // Update user profile
    await this.updateUserProfile(verification.userId, verification.documentType as DocumentType);

    logger.info('[CertificateVerification] Manually approved', { 
      verificationId, 
      adminUid,
      userId: verification.userId 
    });
  }

  /**
   * Admin: Reject verification manually
   */
  async rejectVerification(
    verificationId: number,
    adminUid: string,
    reason: string
  ): Promise<void> {
    const [verification] = await db
      .select()
      .from(biometricCertificateVerifications)
      .where(eq(biometricCertificateVerifications.id, verificationId));

    if (!verification) {
      throw new Error('Verification not found');
    }

    await db
      .update(biometricCertificateVerifications)
      .set({
        verificationStatus: 'rejected',
        rejectionReason: reason,
        verifiedBy: adminUid,
        auditLog: [
          ...(verification.auditLog as any[] || []),
          {
            timestamp: new Date().toISOString(),
            action: 'manual_rejection',
            user: adminUid,
            notes: reason
          }
        ]
      })
      .where(eq(biometricCertificateVerifications.id, verificationId));

    logger.info('[CertificateVerification] Manually rejected', { 
      verificationId, 
      adminUid,
      reason 
    });
  }
}

// Export singleton instance
export const certificateVerification = new CertificateVerificationService();
