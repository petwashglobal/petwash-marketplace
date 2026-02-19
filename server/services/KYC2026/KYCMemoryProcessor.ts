/**
 * KYC 2026 Memory-Only Document Processor
 * 
 * ZERO-STORAGE ARCHITECTURE:
 * - All document images processed entirely in-memory (Buffer/Stream)
 * - No temporary files written to disk or Cloud Storage
 * - Only cryptographic fingerprint (SHA-256) + decision retained
 * - Raw image bytes are garbage collected after processing
 * 
 * SECURITY:
 * - Buffer wiped after processing via explicit nulling
 * - No CDN, no cache, no thumbnails, no backup of raw images
 * - Signed URLs never generated for KYC documents
 * - OCR text is redacted before storage (only field extracts kept)
 */

import crypto from 'crypto';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import { logger } from '../../lib/logger';

export interface KYCDocumentInput {
  selfieBuffer: Buffer;
  idFrontBuffer: Buffer;
  idBackBuffer?: Buffer;
  mimeType: string;
}

export interface KYCProcessingResult {
  documentFingerprint: string;
  selfieFingerprint: string;
  faceMatchScore: number;
  faceMatchVerdict: 'match' | 'mismatch' | 'inconclusive' | 'error';
  ocrFields: RedactedFields;
  ocrConfidence: number;
  photoQuality: PhotoQualityResult;
  livenessResult: LivenessResult;
  processingTimestamp: string;
  processingDurationMs: number;
}

export interface RedactedFields {
  nameDetected: boolean;
  nameHash?: string;
  idNumberDetected: boolean;
  idNumberLastFour?: string;
  birthDateDetected: boolean;
  expiryDateDetected: boolean;
  issuingCountryDetected: boolean;
  documentTypeInferred?: string;
}

export interface PhotoQualityResult {
  selfieQuality: 'good' | 'acceptable' | 'poor';
  idQuality: 'good' | 'acceptable' | 'poor';
  issues: string[];
  selfieBlurred: boolean;
  selfieUnderexposed: boolean;
  idBlurred: boolean;
  idUnderexposed: boolean;
}

export interface LivenessResult {
  passed: boolean;
  confidence: number;
  checks: {
    singleFaceDetected: boolean;
    faceNotTooSmall: boolean;
    headPoseNatural: boolean;
    expressionNatural: boolean;
    notScreenCapture: boolean;
    detectionConfidenceHigh: boolean;
  };
  failureReasons: string[];
}

export class KYCMemoryProcessor {
  private visionClient: ImageAnnotatorClient | null = null;

  constructor() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
          : undefined;
        this.visionClient = new ImageAnnotatorClient({ credentials });
        logger.info('[KYC2026:MemoryProcessor] Vision API client initialized');
      } catch (err: any) {
        logger.error('[KYC2026:MemoryProcessor] Failed to init Vision API:', err.message);
      }
    } else {
      logger.warn('[KYC2026:MemoryProcessor] No GCP credentials - KYC processing unavailable');
    }
  }

  async processDocument(input: KYCDocumentInput): Promise<KYCProcessingResult> {
    const startTime = Date.now();

    const documentFingerprint = this.computeFingerprint(input.idFrontBuffer);
    const selfieFingerprint = this.computeFingerprint(input.selfieBuffer);

    if (!this.visionClient) {
      return {
        documentFingerprint,
        selfieFingerprint,
        faceMatchScore: 0,
        faceMatchVerdict: 'error',
        ocrFields: this.emptyRedactedFields(),
        ocrConfidence: 0,
        photoQuality: this.emptyPhotoQuality(),
        livenessResult: this.failedLiveness('Vision API not available'),
        processingTimestamp: new Date().toISOString(),
        processingDurationMs: Date.now() - startTime,
      };
    }

    const [faceResult, ocrResult, qualityResult, livenessResult] = await Promise.all([
      this.performFaceMatch(input.selfieBuffer, input.idFrontBuffer),
      this.performOCR(input.idFrontBuffer),
      this.assessPhotoQuality(input.selfieBuffer, input.idFrontBuffer),
      this.performLivenessCheck(input.selfieBuffer),
    ]);

    this.wipeBuffers(input);

    return {
      documentFingerprint,
      selfieFingerprint,
      faceMatchScore: faceResult.score,
      faceMatchVerdict: faceResult.verdict,
      ocrFields: ocrResult.fields,
      ocrConfidence: ocrResult.confidence,
      photoQuality: qualityResult,
      livenessResult,
      processingTimestamp: new Date().toISOString(),
      processingDurationMs: Date.now() - startTime,
    };
  }

  computeFingerprint(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async performFaceMatch(
    selfieBuffer: Buffer,
    idBuffer: Buffer
  ): Promise<{ score: number; verdict: 'match' | 'mismatch' | 'inconclusive' | 'error' }> {
    try {
      const [selfieResult, idResult] = await Promise.all([
        this.visionClient!.faceDetection({ image: { content: selfieBuffer.toString('base64') } }),
        this.visionClient!.faceDetection({ image: { content: idBuffer.toString('base64') } }),
      ]);

      const selfieFaces = selfieResult[0]?.faceAnnotations || [];
      const idFaces = idResult[0]?.faceAnnotations || [];

      if (selfieFaces.length !== 1) {
        return { score: 0, verdict: selfieFaces.length === 0 ? 'error' : 'inconclusive' };
      }
      if (idFaces.length < 1) {
        return { score: 0, verdict: 'error' };
      }

      const score = this.computeNeuralFaceScore(selfieFaces[0], idFaces[0]);

      let verdict: 'match' | 'mismatch' | 'inconclusive';
      if (score >= 78) {
        verdict = 'match';
      } else if (score >= 55) {
        verdict = 'inconclusive';
      } else {
        verdict = 'mismatch';
      }

      return { score, verdict };
    } catch (err: any) {
      logger.error('[KYC2026:FaceMatch] Error:', err.message);
      return { score: 0, verdict: 'error' };
    }
  }

  private computeNeuralFaceScore(
    face1: protos.google.cloud.vision.v1.IFaceAnnotation,
    face2: protos.google.cloud.vision.v1.IFaceAnnotation
  ): number {
    const landmarks1 = face1.landmarks || [];
    const landmarks2 = face2.landmarks || [];

    if (landmarks1.length === 0 || landmarks2.length === 0) return 0;

    const keyTypes = [
      'LEFT_EYE', 'RIGHT_EYE', 'LEFT_OF_LEFT_EYEBROW', 'RIGHT_OF_LEFT_EYEBROW',
      'LEFT_OF_RIGHT_EYEBROW', 'RIGHT_OF_RIGHT_EYEBROW',
      'MIDPOINT_BETWEEN_EYES', 'NOSE_TIP', 'NOSE_BOTTOM_RIGHT', 'NOSE_BOTTOM_LEFT',
      'NOSE_BOTTOM_CENTER', 'UPPER_LIP', 'LOWER_LIP', 'MOUTH_LEFT', 'MOUTH_RIGHT',
      'MOUTH_CENTER', 'LEFT_EAR_TRAGION', 'RIGHT_EAR_TRAGION', 'CHIN_GNATHION',
      'CHIN_LEFT_GONION', 'CHIN_RIGHT_GONION', 'LEFT_EYE_TOP_BOUNDARY',
      'LEFT_EYE_BOTTOM_BOUNDARY', 'RIGHT_EYE_TOP_BOUNDARY', 'RIGHT_EYE_BOTTOM_BOUNDARY',
      'FOREHEAD_GLABELLA', 'LEFT_EYE_LEFT_CORNER', 'LEFT_EYE_RIGHT_CORNER',
      'RIGHT_EYE_LEFT_CORNER', 'RIGHT_EYE_RIGHT_CORNER',
    ];

    const getLandmark = (landmarks: any[], type: string) =>
      landmarks.find((l: any) => l.type === type);

    const normalize1 = this.normalizeLandmarks(landmarks1, keyTypes);
    const normalize2 = this.normalizeLandmarks(landmarks2, keyTypes);

    if (!normalize1 || !normalize2) return 0;

    const ratios1 = this.computeGeometricRatios(normalize1);
    const ratios2 = this.computeGeometricRatios(normalize2);

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < ratios1.length && i < ratios2.length; i++) {
      if (ratios1[i] !== 0 && ratios2[i] !== 0) {
        const ratio = Math.min(ratios1[i], ratios2[i]) / Math.max(ratios1[i], ratios2[i]);
        totalSimilarity += ratio;
        comparisons++;
      }
    }

    if (comparisons === 0) return 0;

    const baseScore = (totalSimilarity / comparisons) * 100;

    let confidenceBonus = 0;
    const conf1 = face1.detectionConfidence ?? 0;
    const conf2 = face2.detectionConfidence ?? 0;
    if (conf1 > 0.9 && conf2 > 0.9) confidenceBonus = 3;
    else if (conf1 > 0.8 && conf2 > 0.8) confidenceBonus = 1;

    let anglePenalty = 0;
    const pan1 = Math.abs(face1.panAngle ?? 0);
    const pan2 = Math.abs(face2.panAngle ?? 0);
    const tilt1 = Math.abs(face1.tiltAngle ?? 0);
    const tilt2 = Math.abs(face2.tiltAngle ?? 0);
    if (pan1 > 30 || pan2 > 30 || tilt1 > 25 || tilt2 > 25) anglePenalty = 8;
    else if (pan1 > 20 || pan2 > 20 || tilt1 > 15 || tilt2 > 15) anglePenalty = 3;

    return Math.max(0, Math.min(100, Math.round((baseScore + confidenceBonus - anglePenalty) * 100) / 100));
  }

  private normalizeLandmarks(landmarks: any[], keyTypes: string[]): Map<string, { x: number; y: number; z: number }> | null {
    const map = new Map<string, { x: number; y: number; z: number }>();

    const leftEye = landmarks.find((l: any) => l.type === 'LEFT_EYE');
    const rightEye = landmarks.find((l: any) => l.type === 'RIGHT_EYE');
    if (!leftEye?.position || !rightEye?.position) return null;

    const eyeDistance = Math.sqrt(
      Math.pow((rightEye.position.x ?? 0) - (leftEye.position.x ?? 0), 2) +
      Math.pow((rightEye.position.y ?? 0) - (leftEye.position.y ?? 0), 2)
    );

    if (eyeDistance < 1) return null;

    const centerX = ((leftEye.position.x ?? 0) + (rightEye.position.x ?? 0)) / 2;
    const centerY = ((leftEye.position.y ?? 0) + (rightEye.position.y ?? 0)) / 2;

    for (const type of keyTypes) {
      const lm = landmarks.find((l: any) => l.type === type);
      if (lm?.position) {
        map.set(type, {
          x: ((lm.position.x ?? 0) - centerX) / eyeDistance,
          y: ((lm.position.y ?? 0) - centerY) / eyeDistance,
          z: ((lm.position.z ?? 0)) / eyeDistance,
        });
      }
    }

    return map;
  }

  private computeGeometricRatios(landmarks: Map<string, { x: number; y: number; z: number }>): number[] {
    const ratios: number[] = [];
    const get = (type: string) => landmarks.get(type);

    const dist = (a: { x: number; y: number } | undefined, b: { x: number; y: number } | undefined) => {
      if (!a || !b) return 0;
      return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    };

    ratios.push(dist(get('LEFT_EYE'), get('RIGHT_EYE')));
    ratios.push(dist(get('LEFT_EYE'), get('NOSE_TIP')));
    ratios.push(dist(get('RIGHT_EYE'), get('NOSE_TIP')));
    ratios.push(dist(get('NOSE_TIP'), get('MOUTH_CENTER')));
    ratios.push(dist(get('NOSE_TIP'), get('CHIN_GNATHION')));
    ratios.push(dist(get('MOUTH_LEFT'), get('MOUTH_RIGHT')));
    ratios.push(dist(get('LEFT_EYE'), get('CHIN_GNATHION')));
    ratios.push(dist(get('RIGHT_EYE'), get('CHIN_GNATHION')));
    ratios.push(dist(get('MIDPOINT_BETWEEN_EYES'), get('NOSE_TIP')));
    ratios.push(dist(get('MIDPOINT_BETWEEN_EYES'), get('CHIN_GNATHION')));
    ratios.push(dist(get('FOREHEAD_GLABELLA'), get('CHIN_GNATHION')));
    ratios.push(dist(get('LEFT_EAR_TRAGION'), get('RIGHT_EAR_TRAGION')));
    ratios.push(dist(get('LEFT_EYE'), get('MOUTH_LEFT')));
    ratios.push(dist(get('RIGHT_EYE'), get('MOUTH_RIGHT')));
    ratios.push(dist(get('NOSE_BOTTOM_LEFT'), get('NOSE_BOTTOM_RIGHT')));
    ratios.push(dist(get('LEFT_EYE_LEFT_CORNER'), get('LEFT_EYE_RIGHT_CORNER')));
    ratios.push(dist(get('RIGHT_EYE_LEFT_CORNER'), get('RIGHT_EYE_RIGHT_CORNER')));
    ratios.push(dist(get('UPPER_LIP'), get('LOWER_LIP')));

    const eyeDist = ratios[0] || 1;
    return ratios.map(r => r / eyeDist);
  }

  private async performOCR(idBuffer: Buffer): Promise<{ fields: RedactedFields; confidence: number }> {
    try {
      const [result] = await this.visionClient!.documentTextDetection({
        image: { content: idBuffer.toString('base64') },
      });

      const fullText = result.fullTextAnnotation?.text || '';
      const confidence = result.fullTextAnnotation?.pages?.[0]?.confidence ?? 0;

      const fields = this.extractAndRedactFields(fullText);

      return { fields, confidence: confidence * 100 };
    } catch (err: any) {
      logger.error('[KYC2026:OCR] Error:', err.message);
      return { fields: this.emptyRedactedFields(), confidence: 0 };
    }
  }

  private extractAndRedactFields(text: string): RedactedFields {
    const idPatterns = [
      /\b\d{9}\b/,
      /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/,
      /\b[A-Z]{1,2}\d{6,8}\b/,
    ];

    let idNumberDetected = false;
    let idNumberLastFour: string | undefined;
    for (const pattern of idPatterns) {
      const match = text.match(pattern);
      if (match) {
        idNumberDetected = true;
        const clean = match[0].replace(/[-\s]/g, '');
        idNumberLastFour = clean.slice(-4);
        break;
      }
    }

    const datePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
    const dates = text.match(datePattern) || [];

    const namePattern = /^[A-Z\u0590-\u05FF\u0600-\u06FF][a-zA-Z\u0590-\u05FF\u0600-\u06FF\s'-]{2,40}$/m;
    const nameMatch = text.match(namePattern);
    const nameDetected = !!nameMatch;
    const nameHash = nameMatch
      ? crypto.createHash('sha256').update(nameMatch[0].trim().toLowerCase()).digest('hex').substring(0, 16)
      : undefined;

    return {
      nameDetected,
      nameHash,
      idNumberDetected,
      idNumberLastFour,
      birthDateDetected: dates.length >= 1,
      expiryDateDetected: dates.length >= 2,
      issuingCountryDetected: /israel|ישראל|united states|canada|australia|england/i.test(text),
      documentTypeInferred: this.inferDocumentType(text),
    };
  }

  private inferDocumentType(text: string): string | undefined {
    const lower = text.toLowerCase();
    if (/passport|דרכון/.test(lower)) return 'passport';
    if (/driver|license|רישיון נהיגה/.test(lower)) return 'drivers_license';
    if (/disability|נכה|נכות/.test(lower)) return 'disability_certificate';
    if (/retirement|pension|גימלאים/.test(lower)) return 'retirement_certificate';
    if (/identity|תעודת זהות|id card/.test(lower)) return 'national_id';
    return undefined;
  }

  private async assessPhotoQuality(
    selfieBuffer: Buffer,
    idBuffer: Buffer
  ): Promise<PhotoQualityResult> {
    const issues: string[] = [];
    let selfieBlurred = false, selfieUnderexposed = false;
    let idBlurred = false, idUnderexposed = false;

    try {
      const [selfieResult, idResult] = await Promise.all([
        this.visionClient!.faceDetection({ image: { content: selfieBuffer.toString('base64') } }),
        this.visionClient!.imageProperties({ image: { content: idBuffer.toString('base64') } }),
      ]);

      const selfieFaces = selfieResult[0]?.faceAnnotations || [];
      if (selfieFaces.length === 1) {
        const face = selfieFaces[0];
        if (face.blurredLikelihood === 'VERY_LIKELY' || face.blurredLikelihood === 'LIKELY') {
          selfieBlurred = true;
          issues.push('Selfie appears blurred');
        }
        if (face.underExposedLikelihood === 'VERY_LIKELY' || face.underExposedLikelihood === 'LIKELY') {
          selfieUnderexposed = true;
          issues.push('Selfie is underexposed (too dark)');
        }
      }

      const idColors = idResult[0]?.imagePropertiesAnnotation?.dominantColors?.colors || [];
      const avgBrightness = idColors.reduce((sum: number, c: any) => {
        const r = c.color?.red ?? 0;
        const g = c.color?.green ?? 0;
        const b = c.color?.blue ?? 0;
        return sum + (r + g + b) / 3 * (c.pixelFraction ?? 0);
      }, 0);

      if (avgBrightness < 40) {
        idUnderexposed = true;
        issues.push('ID document photo is too dark');
      }
    } catch (err: any) {
      issues.push('Could not fully assess photo quality');
    }

    const selfieQuality = selfieBlurred || selfieUnderexposed ? (selfieBlurred && selfieUnderexposed ? 'poor' : 'acceptable') : 'good';
    const idQuality = idBlurred || idUnderexposed ? 'acceptable' : 'good';

    return { selfieQuality, idQuality, issues, selfieBlurred, selfieUnderexposed, idBlurred, idUnderexposed };
  }

  /**
   * Heuristic liveness check using Google Cloud Vision face annotations.
   * NOT ISO 30107-3 certified. Checks: single face, face size, head pose,
   * blur detection (screen capture defense), expression analysis.
   * For certified passive liveness, integrate a dedicated SDK (e.g. FaceTec, iProov).
   */
  private async performLivenessCheck(selfieBuffer: Buffer): Promise<LivenessResult> {
    const checks = {
      singleFaceDetected: false,
      faceNotTooSmall: false,
      headPoseNatural: false,
      expressionNatural: false,
      notScreenCapture: false,
      detectionConfidenceHigh: false,
    };
    const failureReasons: string[] = [];

    try {
      const [result] = await this.visionClient!.faceDetection({
        image: { content: selfieBuffer.toString('base64') },
      });

      const faces = result.faceAnnotations || [];

      checks.singleFaceDetected = faces.length === 1;
      if (!checks.singleFaceDetected) {
        failureReasons.push(faces.length === 0 ? 'No face detected' : 'Multiple faces detected');
      }

      if (faces.length >= 1) {
        const face = faces[0];

        const bbox = face.boundingPoly?.vertices || [];
        if (bbox.length >= 4) {
          const width = Math.abs((bbox[1]?.x ?? 0) - (bbox[0]?.x ?? 0));
          const height = Math.abs((bbox[2]?.y ?? 0) - (bbox[1]?.y ?? 0));
          checks.faceNotTooSmall = width > 80 && height > 80;
          if (!checks.faceNotTooSmall) {
            failureReasons.push('Face too small - likely a photo of a photo');
          }
        }

        const pan = Math.abs(face.panAngle ?? 0);
        const tilt = Math.abs(face.tiltAngle ?? 0);
        const roll = Math.abs(face.rollAngle ?? 0);
        checks.headPoseNatural = pan < 35 && tilt < 25 && roll < 20;
        if (!checks.headPoseNatural) {
          failureReasons.push('Head angle is extreme - not a natural selfie pose');
        }

        const isBlurred = face.blurredLikelihood === 'VERY_LIKELY' || face.blurredLikelihood === 'LIKELY';
        checks.notScreenCapture = !isBlurred;
        if (!checks.notScreenCapture) {
          failureReasons.push('Image appears blurred - possible screen capture');
        }

        const sorrowHigh = face.sorrowLikelihood === 'VERY_LIKELY';
        const angerHigh = face.angerLikelihood === 'VERY_LIKELY';
        const surpriseHigh = face.surpriseLikelihood === 'VERY_LIKELY';
        checks.expressionNatural = !sorrowHigh && !angerHigh && !surpriseHigh;
        if (!checks.expressionNatural) {
          failureReasons.push('Unnatural facial expression detected');
        }

        checks.detectionConfidenceHigh = (face.detectionConfidence ?? 0) > 0.85;
        if (!checks.detectionConfidenceHigh) {
          failureReasons.push('Low face detection confidence - may not be a real face');
        }
      }

      const passed = Object.values(checks).filter(Boolean).length >= 5;
      const confidence = (Object.values(checks).filter(Boolean).length / Object.values(checks).length) * 100;

      return { passed, confidence, checks, failureReasons };
    } catch (err: any) {
      logger.error('[KYC2026:Liveness] Error:', err.message);
      return this.failedLiveness(err.message);
    }
  }

  private wipeBuffers(input: KYCDocumentInput): void {
    try {
      input.selfieBuffer.fill(0);
      input.idFrontBuffer.fill(0);
      if (input.idBackBuffer) input.idBackBuffer.fill(0);
    } catch {
      // Buffer may already be detached
    }
  }

  private emptyRedactedFields(): RedactedFields {
    return {
      nameDetected: false,
      idNumberDetected: false,
      birthDateDetected: false,
      expiryDateDetected: false,
      issuingCountryDetected: false,
    };
  }

  private emptyPhotoQuality(): PhotoQualityResult {
    return {
      selfieQuality: 'poor',
      idQuality: 'poor',
      issues: ['Processing unavailable'],
      selfieBlurred: false,
      selfieUnderexposed: false,
      idBlurred: false,
      idUnderexposed: false,
    };
  }

  private failedLiveness(reason: string): LivenessResult {
    return {
      passed: false,
      confidence: 0,
      checks: {
        singleFaceDetected: false,
        faceNotTooSmall: false,
        headPoseNatural: false,
        expressionNatural: false,
        notScreenCapture: false,
        detectionConfidenceHigh: false,
      },
      failureReasons: [reason],
    };
  }
}

export const kycMemoryProcessor = new KYCMemoryProcessor();
