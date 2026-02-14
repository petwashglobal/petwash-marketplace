/**
 * KYC 2026 Orchestrator - Main Entry Point
 * 
 * Coordinates the entire KYC verification pipeline:
 * 1. Rate limiting (per-user and per-IP)
 * 2. Anomaly detection (velocity, device, document fingerprint)
 * 3. Memory-only document processing (zero-storage)
 * 4. Liveness detection
 * 5. Neural face matching (30-landmark geometric ratio comparison)
 * 6. OCR with field redaction (only hashes + last-4 stored)
 * 7. Cryptographic document fingerprinting (SHA-256)
 * 8. Audit trail recording (hash-chained, tamper-evident)
 * 9. Security alerts for anomalies
 * 10. Decision engine (approve / manual_review / reject)
 * 
 * ARCHITECTURE:
 * - All processing in-memory (Buffers)
 * - Raw images wiped after processing
 * - Only fingerprints + scores + decisions persisted
 * - No Cloud Storage dependency for verification flow
 */

import { kycMemoryProcessor, type KYCDocumentInput, type KYCProcessingResult } from './KYCMemoryProcessor';
import { kycAnomalyDetector, type AnomalyResult } from './KYCAnomalyDetector';
import { kycAuditTrail } from './KYCAuditTrail';
import { KYCSecurityAlerts } from './KYCSecurityAlerts';
import { logger } from '../../lib/logger';

export interface KYCSubmissionInput {
  userId: string;
  documentType: 'national_id' | 'drivers_license' | 'passport' | 'disability_certificate' | 'retirement_certificate';
  documentCountry: string;
  selfieBuffer: Buffer;
  idFrontBuffer: Buffer;
  idBackBuffer?: Buffer;
  mimeType: string;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  sessionId?: string;
}

export interface KYCVerificationResult {
  success: boolean;
  verificationId: string;
  status: 'approved' | 'manual_review' | 'rejected' | 'blocked';
  faceMatchScore: number;
  faceMatchVerdict: string;
  livenessPass: boolean;
  livenessConfidence: number;
  ocrConfidence: number;
  riskScore: number;
  riskLevel: string;
  documentFingerprint: string;
  processingDurationMs: number;
  message: string;
  anomalies: string[];
  auditEntryId: string;
}

export class KYCOrchestrator {

  async processSubmission(input: KYCSubmissionInput): Promise<KYCVerificationResult> {
    const startTime = Date.now();
    const verificationId = `kyc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    logger.info(`[KYC2026:Orchestrator] Starting verification ${verificationId}`, {
      userId: input.userId,
      documentType: input.documentType,
      documentCountry: input.documentCountry,
    });

    const earlyFingerprint = kycMemoryProcessor.computeFingerprint(input.idFrontBuffer);
    const selfieFingerprint = kycMemoryProcessor.computeFingerprint(input.selfieBuffer);

    const anomalyResult = await kycAnomalyDetector.analyze({
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      documentFingerprint: earlyFingerprint,
      selfieFingerprint,
      documentCountry: input.documentCountry,
      deviceId: input.deviceId,
      sessionId: input.sessionId,
    });

    if (anomalyResult.shouldBlock) {
      kycAuditTrail.record({
        action: 'kyc_blocked',
        actorId: input.userId,
        actorRole: 'user',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deviceFingerprint: anomalyResult.deviceFingerprint,
        metadata: {
          verificationId,
          riskScore: anomalyResult.riskScore,
          anomalies: anomalyResult.anomalies.map(a => a.type),
        },
        riskScore: anomalyResult.riskScore,
      });

      await KYCSecurityAlerts.send({
        alertType: 'block',
        severity: 'critical',
        title: 'KYC Submission Blocked',
        description: `User ${input.userId} blocked from KYC with risk score ${anomalyResult.riskScore}`,
        userId: input.userId,
        ipAddress: input.ipAddress,
        riskScore: anomalyResult.riskScore,
        anomalies: anomalyResult.anomalies,
      });

      return {
        success: false,
        verificationId,
        status: 'blocked',
        faceMatchScore: 0,
        faceMatchVerdict: 'blocked',
        livenessPass: false,
        livenessConfidence: 0,
        ocrConfidence: 0,
        riskScore: anomalyResult.riskScore,
        riskLevel: anomalyResult.riskLevel,
        documentFingerprint: earlyFingerprint,
        processingDurationMs: Date.now() - startTime,
        message: 'Verification temporarily unavailable due to security concerns. Please try again later.',
        anomalies: anomalyResult.anomalies.map(a => a.type),
        auditEntryId: '',
      };
    }

    if (anomalyResult.shouldAlert) {
      await KYCSecurityAlerts.send({
        alertType: 'anomaly',
        severity: 'warning',
        title: 'KYC Anomaly Detected',
        description: `Suspicious KYC activity from user ${input.userId}`,
        userId: input.userId,
        ipAddress: input.ipAddress,
        riskScore: anomalyResult.riskScore,
        anomalies: anomalyResult.anomalies,
      });
    }

    const processingResult = await kycMemoryProcessor.processDocument({
      selfieBuffer: input.selfieBuffer,
      idFrontBuffer: input.idFrontBuffer,
      idBackBuffer: input.idBackBuffer,
      mimeType: input.mimeType,
    });

    const status = this.determineVerdict(processingResult, anomalyResult, input.documentType);

    const auditEntry = kycAuditTrail.record({
      action: status === 'approved' ? 'kyc_approved' :
              status === 'manual_review' ? 'kyc_manual_review' :
              status === 'rejected' ? 'kyc_rejected' : 'kyc_submitted',
      actorId: input.userId,
      actorRole: 'user',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceFingerprint: anomalyResult.deviceFingerprint,
      metadata: {
        verificationId,
        documentType: input.documentType,
        documentCountry: input.documentCountry,
        faceMatchScore: processingResult.faceMatchScore,
        faceMatchVerdict: processingResult.faceMatchVerdict,
        livenessPass: processingResult.livenessResult.passed,
        livenessConfidence: processingResult.livenessResult.confidence,
        ocrConfidence: processingResult.ocrConfidence,
        documentFingerprint: processingResult.documentFingerprint,
        riskScore: anomalyResult.riskScore,
        riskLevel: anomalyResult.riskLevel,
        status,
      },
      riskScore: anomalyResult.riskScore,
    });

    if (processingResult.livenessResult.passed) {
      kycAuditTrail.record({
        action: 'kyc_liveness_passed',
        actorId: input.userId,
        actorRole: 'user',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: {
          confidence: processingResult.livenessResult.confidence,
          checks: processingResult.livenessResult.checks,
        },
      });
    } else {
      kycAuditTrail.record({
        action: 'kyc_liveness_failed',
        actorId: input.userId,
        actorRole: 'user',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: {
          confidence: processingResult.livenessResult.confidence,
          failureReasons: processingResult.livenessResult.failureReasons,
        },
      });
    }

    const message = this.generateMessage(status, processingResult);

    logger.info(`[KYC2026:Orchestrator] Verification ${verificationId} complete: ${status}`, {
      faceMatchScore: processingResult.faceMatchScore,
      livenessPass: processingResult.livenessResult.passed,
      riskScore: anomalyResult.riskScore,
      durationMs: Date.now() - startTime,
    });

    return {
      success: status === 'approved',
      verificationId,
      status,
      faceMatchScore: processingResult.faceMatchScore,
      faceMatchVerdict: processingResult.faceMatchVerdict,
      livenessPass: processingResult.livenessResult.passed,
      livenessConfidence: processingResult.livenessResult.confidence,
      ocrConfidence: processingResult.ocrConfidence,
      riskScore: anomalyResult.riskScore,
      riskLevel: anomalyResult.riskLevel,
      documentFingerprint: processingResult.documentFingerprint,
      processingDurationMs: Date.now() - startTime,
      message,
      anomalies: anomalyResult.anomalies.map(a => a.type),
      auditEntryId: auditEntry.id,
    };
  }

  private determineVerdict(
    processing: KYCProcessingResult,
    anomaly: AnomalyResult,
    documentType: string
  ): 'approved' | 'manual_review' | 'rejected' {
    if (!processing.livenessResult.passed) {
      if (processing.livenessResult.confidence < 50) {
        return 'rejected';
      }
      return 'manual_review';
    }

    if (processing.faceMatchVerdict === 'mismatch') {
      return 'rejected';
    }

    if (processing.faceMatchVerdict === 'inconclusive') {
      return 'manual_review';
    }

    if (processing.faceMatchVerdict === 'error') {
      return 'manual_review';
    }

    if (anomaly.shouldRequireManualReview) {
      return 'manual_review';
    }

    if (documentType === 'disability_certificate' || documentType === 'retirement_certificate') {
      return 'manual_review';
    }

    if (processing.photoQuality.selfieQuality === 'poor' || processing.photoQuality.idQuality === 'poor') {
      return 'manual_review';
    }

    if (processing.faceMatchScore >= 78 && processing.livenessResult.passed && anomaly.riskScore < 25) {
      return 'approved';
    }

    return 'manual_review';
  }

  private generateMessage(status: string, processing: KYCProcessingResult): string {
    switch (status) {
      case 'approved':
        return 'Identity verified successfully. Your account has been verified.';
      case 'manual_review':
        if (!processing.livenessResult.passed) {
          return 'Additional verification required. Our team will review your submission within 24 hours.';
        }
        if (processing.faceMatchVerdict === 'inconclusive') {
          return 'We need to manually verify your identity. A team member will review your submission shortly.';
        }
        return 'Your submission has been received and is under review. You will be notified once the review is complete.';
      case 'rejected':
        if (processing.faceMatchVerdict === 'mismatch') {
          return 'The selfie does not match the ID photo. Please try again with a clear, well-lit selfie.';
        }
        return 'Verification could not be completed. Please ensure your documents are clear and try again.';
      case 'blocked':
        return 'Verification temporarily unavailable. Please try again later.';
      default:
        return 'Verification is being processed.';
    }
  }

  async getSystemHealth(): Promise<{
    anomalyStats: ReturnType<typeof kycAnomalyDetector.getStats>;
    auditStats: Awaited<ReturnType<typeof kycAuditTrail.getStats>>;
    chainIntegrity: Awaited<ReturnType<typeof kycAuditTrail.verifyChain>>;
  }> {
    const [auditStats, chainIntegrity] = await Promise.all([
      kycAuditTrail.getStats(),
      kycAuditTrail.verifyChain(),
    ]);
    return {
      anomalyStats: kycAnomalyDetector.getStats(),
      auditStats,
      chainIntegrity,
    };
  }
}

export const kycOrchestrator = new KYCOrchestrator();
