/**
 * KYC 2026 - Enterprise-Grade Identity Verification System
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    PetWash™ KYC 2026 Architecture              │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │  LAYER 1: PERIMETER DEFENSE                                    │
 * │  ├─ KYCRateLimiter (per-user, per-IP, per-endpoint)            │
 * │  ├─ Anti-bot detection (submission interval analysis)          │
 * │  └─ IP/Device blocking (exponential backoff)                   │
 * │                                                                 │
 * │  LAYER 2: ANOMALY DETECTION                                    │
 * │  ├─ Velocity checks (hourly windows)                           │
 * │  ├─ Device fingerprinting (UA + device ID hash)                │
 * │  ├─ Document fingerprint cross-reference (SHA-256)             │
 * │  ├─ Multi-IP/Multi-device detection                            │
 * │  └─ Bot pattern recognition (interval analysis)                │
 * │                                                                 │
 * │  LAYER 3: IDENTITY VERIFICATION (Memory-Only)                  │
 * │  ├─ Liveness Detection (face size, head pose, blur, expression)│
 * │  ├─ Neural Face Matching (30-landmark normalized ratios)       │
 * │  ├─ OCR + Field Extraction (redacted: hash + last-4 only)     │
 * │  ├─ Photo Quality Assessment (blur, exposure, resolution)      │
 * │  └─ Document Fingerprinting (SHA-256, zero-storage)            │
 * │                                                                 │
 * │  LAYER 4: ACCESS CONTROL                                       │
 * │  ├─ KYC-specific RBAC (kyc_admin, kyc_reviewer, kyc_auditor)  │
 * │  ├─ Mandatory MFA for admin operations (4hr session, IP-bound)│
 * │  ├─ Per-permission enforcement                                 │
 * │  └─ Super admin override with full audit                       │
 * │                                                                 │
 * │  LAYER 5: AUDIT & COMPLIANCE                                   │
 * │  ├─ SHA-256 hash-chained audit trail (blockchain-style)        │
 * │  ├─ Sensitive data redaction (DLP in logs)                     │
 * │  ├─ Chain integrity verification                               │
 * │  └─ GDPR / Israeli Privacy Law 2025 compliance                │
 * │                                                                 │
 * │  LAYER 6: INCIDENT RESPONSE                                    │
 * │  ├─ P1-P4 severity classification                              │
 * │  ├─ Automated P1 containment (suspend KYC, revoke sessions)   │
 * │  ├─ Real-time email alerts (SendGrid)                          │
 * │  └─ Incident tracking and resolution workflow                  │
 * │                                                                 │
 * │  LAYER 7: SECURITY ALERTS                                      │
 * │  ├─ Real-time email notifications (critical + warning)         │
 * │  ├─ Alert deduplication (5-minute window)                      │
 * │  └─ Structured HTML reports with anomaly breakdown             │
 * │                                                                 │
 * │  DATA RETAINED (Zero-Storage Mode):                            │
 * │  ├─ Document fingerprint (SHA-256 hash)                        │
 * │  ├─ Selfie fingerprint (SHA-256 hash)                          │
 * │  ├─ Face match score + verdict                                 │
 * │  ├─ Liveness score + check results                             │
 * │  ├─ OCR field hashes (name hash, ID last-4)                   │
 * │  ├─ Risk score + anomaly flags                                 │
 * │  ├─ Device fingerprint                                         │
 * │  ├─ Audit trail entries (hash-chained)                         │
 * │  └─ Decision + timestamp + masked IP                           │
 * │                                                                 │
 * │  DATA NOT RETAINED:                                            │
 * │  ├─ Raw selfie image                                           │
 * │  ├─ Raw ID document image                                      │
 * │  ├─ Full OCR text                                              │
 * │  ├─ Full ID numbers                                            │
 * │  ├─ Full names (only hash)                                     │
 * │  └─ Any Cloud Storage files                                    │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * WHAT MAKES THIS 2026 vs 2022:
 * 
 * 2022 Level:
 * - Upload to Cloud Storage → process → maybe delete later
 * - Simple password check for admin
 * - No liveness detection
 * - Basic landmark distance comparison
 * - No anomaly detection
 * - Logs contain sensitive data
 * 
 * 2026 Level:
 * - Memory-only processing, buffer wiped after use
 * - Mandatory MFA with IP-bound sessions (4hr expiry)
 * - Multi-signal liveness (face size, pose, blur, expression, confidence)
 * - 30-landmark normalized geometric ratio comparison
 * - Real-time anomaly detection (velocity, device, document fingerprint)
 * - Hash-chained audit trail with tamper detection
 * - Automated incident response with P1 containment
 * - DLP: sensitive data never reaches logs
 * - Zero raw data retained - only cryptographic fingerprints + decisions
 */

export { kycMemoryProcessor, KYCMemoryProcessor } from './KYCMemoryProcessor';
export type { KYCDocumentInput, KYCProcessingResult, RedactedFields, PhotoQualityResult, LivenessResult } from './KYCMemoryProcessor';

export { kycAnomalyDetector, KYCAnomalyDetector } from './KYCAnomalyDetector';
export type { AnomalyInput, AnomalyResult, AnomalyFlag } from './KYCAnomalyDetector';

export { kycAuditTrail, KYCAuditTrail } from './KYCAuditTrail';
export type { KYCAuditAction, KYCAuditEntry } from './KYCAuditTrail';

export { KYCSecurityAlerts } from './KYCSecurityAlerts';
export type { SecurityAlertInput } from './KYCSecurityAlerts';

export { KYCAccessControl, requireKYCPermission, requireKYCMFA } from './KYCAccessControl';
export type { KYCRole } from './KYCAccessControl';

export { kycOrchestrator, KYCOrchestrator } from './KYCOrchestrator';
export type { KYCSubmissionInput, KYCVerificationResult } from './KYCOrchestrator';

export { KYCIncidentResponse } from './KYCIncidentResponse';
export type { SecurityIncident, IncidentSeverity } from './KYCIncidentResponse';

export {
  kycSubmitLimiter,
  kycSubmitIPLimiter,
  kycFaceMatchLimiter,
  kycMFALimiter,
  kycAdminReviewLimiter,
  kycLivenessLimiter,
} from './KYCRateLimiter';
