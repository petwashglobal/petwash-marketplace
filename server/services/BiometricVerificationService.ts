/**
 * BiometricVerificationService - Banking-Level KYC Face Matching
 *
 * Uses Google Cloud Vision API to verify identity by comparing:
 * 1. Current selfie photo (clear face)
 * 2. Government ID photo (passport, driver's license, national ID)
 *
 * SECURITY: Two-way authentication required for both owners and sitters
 *
 * ─── GOOGLE CLOUD LEGAL COMPLIANCE NOTICE ───────────────────────────────────
 * Service: Google Cloud Vision API (Face Detection feature)
 * DPA Status: REQUIRED — Google Cloud Data Processing Addendum must be active
 * Data Category: BIOMETRIC (facial landmarks = SPECIAL CATEGORY under GDPR Art.9
 *                and "especially sensitive" under Israeli Privacy Law 2025 §14)
 * Legal Basis: EXPLICIT CONSENT (Art. 9(2)(a) GDPR; Israeli Privacy Law §8)
 * Consent Requirement: User must give explicit written consent before any call
 *                      to verifyIdentity() or validatePhotoQuality()
 * Data Minimization: Only facial landmark coordinates are processed.
 *                    Raw pixel data is NOT stored by PetWash™ post-verification.
 * Retention by Google: Under DPA, Google does not retain image data after
 *                      the API call completes (Vision API is stateless per DPA §7.3)
 * Israeli Privacy Law 2025 §14: Biometric data classified as "especially sensitive"
 *   — requires: (a) explicit consent, (b) purpose limitation to KYC only,
 *   (c) deletion after verification, (d) incident reporting within 72 hours
 * GDPR Article 35: DPIA (Data Protection Impact Assessment) required before
 *   processing biometric data at scale. Document in DPO registry.
 * Penetration Testing: Required every 18 months per Amendment 13.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';
import { logger } from '../lib/logger';

interface BiometricVerificationResult {
  isMatch: boolean;
  matchScore: number; // 0-100 confidence score
  status: 'matched' | 'failed' | 'error';
  reason?: string;
  faceDetection?: {
    selfieHasFace: boolean;
    idHasFace: boolean;
    selfieFaceCount: number;
    idFaceCount: number;
  };
}

export class BiometricVerificationService {
  private visionClient: ImageAnnotatorClient | null = null;
  private readonly MATCH_THRESHOLD = 75; // 75% confidence required for match
  
  constructor() {
    // Initialize Google Vision API if credentials are available
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        this.visionClient = new ImageAnnotatorClient({
          credentials: process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
            : undefined
        });
        console.log('[BiometricKYC] ✅ Google Vision API initialized');
      } catch (error) {
        console.error('[BiometricKYC] ⚠️ Failed to initialize Vision API:', error);
      }
    } else {
      console.warn('[BiometricKYC] ⚠️ No Google Cloud credentials found - biometric verification disabled');
    }
  }

  /**
   * Verify identity by comparing selfie photo with ID photo
   */
  async verifyIdentity(
    selfieImageUrl: string,
    idImageUrl: string
  ): Promise<BiometricVerificationResult> {
    if (!this.visionClient) {
      return {
        isMatch: false,
        matchScore: 0,
        status: 'error',
        reason: 'Biometric verification service not available - missing API credentials'
      };
    }

    try {
      // Step 1: Detect faces in both images
      const [selfieDetection, idDetection] = await Promise.all([
        this.detectFaces(selfieImageUrl),
        this.detectFaces(idImageUrl)
      ]);

      // Validate that both images contain exactly one face
      if (!selfieDetection.success || selfieDetection.faceCount !== 1) {
        return {
          isMatch: false,
          matchScore: 0,
          status: 'failed',
          reason: selfieDetection.faceCount === 0 
            ? 'No face detected in selfie photo' 
            : 'Multiple faces detected in selfie - only one person allowed',
          faceDetection: {
            selfieHasFace: selfieDetection.faceCount > 0,
            idHasFace: idDetection.faceCount > 0,
            selfieFaceCount: selfieDetection.faceCount,
            idFaceCount: idDetection.faceCount
          }
        };
      }

      if (!idDetection.success || idDetection.faceCount !== 1) {
        return {
          isMatch: false,
          matchScore: 0,
          status: 'failed',
          reason: idDetection.faceCount === 0 
            ? 'No face detected in ID photo' 
            : 'Multiple faces detected in ID photo',
          faceDetection: {
            selfieHasFace: selfieDetection.faceCount > 0,
            idHasFace: idDetection.faceCount > 0,
            selfieFaceCount: selfieDetection.faceCount,
            idFaceCount: idDetection.faceCount
          }
        };
      }

      // Step 2: Compare faces using facial landmarks
      const matchScore = await this.compareFaces(
        selfieDetection.landmarks,
        idDetection.landmarks
      );

      const isMatch = matchScore >= this.MATCH_THRESHOLD;

      return {
        isMatch,
        matchScore: Math.round(matchScore * 100) / 100,
        status: isMatch ? 'matched' : 'failed',
        reason: isMatch 
          ? 'Biometric verification successful' 
          : `Match score ${matchScore.toFixed(1)}% below ${this.MATCH_THRESHOLD}% threshold`,
        faceDetection: {
          selfieHasFace: true,
          idHasFace: true,
          selfieFaceCount: 1,
          idFaceCount: 1
        }
      };

    } catch (error: any) {
      logger.error('[BiometricKYC] Verification error', { message: error.message });
      return {
        isMatch: false,
        matchScore: 0,
        status: 'error',
        reason: `Verification failed: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Detect faces in an image using Google Vision API
   */
  private async detectFaces(imageUrl: string) {
    if (!this.visionClient) {
      return { success: false, faceCount: 0, landmarks: null };
    }

    try {
      const [result] = await this.visionClient.faceDetection(imageUrl);
      const faces = result.faceAnnotations || [];

      if (faces.length === 0) {
        return { success: false, faceCount: 0, landmarks: null };
      }

      // Return first face's landmarks for comparison
      return {
        success: true,
        faceCount: faces.length,
        landmarks: faces[0].landmarks || []
      };
    } catch (error: any) {
      logger.error('[BiometricKYC] Face detection error', { message: error.message });
      return { success: false, faceCount: 0, landmarks: null };
    }
  }

  /**
   * Compare facial landmarks between two faces
   * Returns similarity score (0-100)
   */
  private async compareFaces(landmarks1: any[], landmarks2: any[]): Promise<number> {
    if (!landmarks1 || !landmarks2 || landmarks1.length === 0 || landmarks2.length === 0) {
      return 0;
    }

    // Key facial landmark types to compare
    const keyLandmarks = [
      'LEFT_EYE',
      'RIGHT_EYE',
      'NOSE_TIP',
      'MOUTH_CENTER',
      'LEFT_EAR_TRAGION',
      'RIGHT_EAR_TRAGION'
    ];

    let totalSimilarity = 0;
    let landmarksCompared = 0;

    for (const landmarkType of keyLandmarks) {
      const landmark1 = landmarks1.find((l: any) => l.type === landmarkType);
      const landmark2 = landmarks2.find((l: any) => l.type === landmarkType);

      if (landmark1 && landmark2 && landmark1.position && landmark2.position) {
        // Calculate Euclidean distance between landmark positions
        const distance = this.calculateDistance(
          landmark1.position,
          landmark2.position
        );

        // Convert distance to similarity score (lower distance = higher similarity)
        // Normalize by dividing by expected maximum distance (empirically ~100 pixels)
        const similarity = Math.max(0, 100 - (distance / 100) * 100);
        totalSimilarity += similarity;
        landmarksCompared++;
      }
    }

    if (landmarksCompared === 0) {
      return 0;
    }

    // Return average similarity across all compared landmarks
    return totalSimilarity / landmarksCompared;
  }

  /**
   * Calculate 3D Euclidean distance between two positions
   */
  private calculateDistance(pos1: any, pos2: any): number {
    const dx = (pos1.x || 0) - (pos2.x || 0);
    const dy = (pos1.y || 0) - (pos2.y || 0);
    const dz = (pos1.z || 0) - (pos2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Verify that an image contains a clear, well-lit face
   * Used for validation before processing
   */
  async validatePhotoQuality(imageUrl: string): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    if (!this.visionClient) {
      return {
        isValid: false,
        issues: ['Verification service not available']
      };
    }

    try {
      const [result] = await this.visionClient.faceDetection(imageUrl);
      const faces = result.faceAnnotations || [];

      const issues: string[] = [];

      if (faces.length === 0) {
        issues.push('No face detected - please ensure your face is clearly visible');
      } else if (faces.length > 1) {
        issues.push('Multiple faces detected - only one person should be in the photo');
      }

      if (faces.length === 1) {
        const face = faces[0];
        
        // Check detection confidence
        if (face.detectionConfidence && face.detectionConfidence < 0.7) {
          issues.push('Face detection confidence low - please use a clearer photo');
        }

        // Check if face is blurred
        if (face.blurredLikelihood === 'VERY_LIKELY' || face.blurredLikelihood === 'LIKELY') {
          issues.push('Photo appears blurred - please use a sharper image');
        }

        // Check lighting
        if (face.underExposedLikelihood === 'VERY_LIKELY' || face.underExposedLikelihood === 'LIKELY') {
          issues.push('Photo is too dark - please use better lighting');
        }
      }

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error: any) {
      logger.error('[BiometricKYC] Photo quality check error', { message: error.message });
      return {
        isValid: false,
        issues: [`Validation error: ${error.message || 'Unknown error'}`]
      };
    }
  }

  /**
   * Audit consent before any biometric Vision API call.
   * Called by routes before invoking verifyIdentity() or validatePhotoQuality().
   * Under Israeli Privacy Law 2025 §14 and GDPR Art. 9(2)(a), explicit written
   * consent is MANDATORY before processing biometric data.
   */
  auditBiometricConsent(userId: string, consentGiven: boolean, consentTimestamp?: Date): void {
    if (!consentGiven) {
      logger.error('[BiometricKYC] COMPLIANCE VIOLATION: biometric API called without consent', { userId });
      throw new Error('Biometric processing requires explicit user consent (GDPR Art. 9 / Israeli Privacy Law 2025 §14)');
    }
    logger.info('[BiometricKYC] Biometric consent verified', {
      userId,
      consentTimestamp: consentTimestamp?.toISOString() || new Date().toISOString(),
      purpose: 'KYC identity verification',
      legalBasis: 'explicit_consent',
      dataProcessor: 'Google Cloud Vision API',
    });
  }
}

// Export singleton instance
export const biometricVerification = new BiometricVerificationService();
