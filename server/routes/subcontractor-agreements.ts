/**
 * SUBCONTRACTOR AGREEMENT ROUTES 2025
 * 
 * Israeli-compliant digital signature system for subcontractor agreements.
 * 
 * CRITICAL LEGAL NOTICE:
 * - This module implements FREE internal e-signature system (NO paid providers like DocuSign/Adobe Sign)
 * - Stores legally-binding signatures meeting Israeli digital signature law requirements for 2025/2026
 * - Captures: ipAddress, userAgent, deviceInfo, signedAt, agreementVersion, agreementSnapshotJson, auditTrailId
 * - Legal text MUST be reviewed by licensed Israeli lawyer before production use
 * 
 * ROUTES:
 * - POST /api/subcontractors/agreements/2025/sign - Sign subcontractor agreement
 * - GET /api/subcontractors/agreements/2025/:signatureId - Get signed agreement details
 * - GET /api/subcontractors/agreements/2025/contractor/:contractorId - Get all signatures for contractor
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { subcontractorSignatures, insertSubcontractorSignatureSchema } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { 
  createSubcontractorSignature,
  SUBCONTRACTOR_AGREEMENT_2025,
  SUBCONTRACTOR_AGREEMENT_IL_2025,
  type DigitalSignatureMethod,
  type ClientDeviceInfo,
  ISRAEL_SUBCONTRACTOR_COMPLIANCE_2025
} from '../../src/petwash_subcontractor_legal_esign_2025';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const router = Router();

/**
 * POST /api/subcontractors/agreements/2025/sign
 * 
 * Save subcontractor signature to production Postgres database.
 * Frontend sends signature data, backend stores with full Israeli compliance fields.
 * 
 * Request body:
 * - subcontractorId: string (contractor ID or user ID)
 * - fullName: string
 * - email: string
 * - phone?: string
 * - signatureMethod: "typed_name" | "drawn_signature" | "otp_code" | "external_provider"
 * - rawSignatureData: string (canvas data, typed name, OTP code, etc.)
 * 
 * Returns:
 * - signatureId: UUID of created signature
 * - agreementVersion: Version that was signed (e.g., "2025.01")
 * - signedAt: ISO timestamp
 */
router.post('/api/subcontractors/agreements/2025/sign', async (req: Request, res: Response) => {
  try {
    const bodyData = req.body || {};

    // Validate required fields
    if (!bodyData.rawSignatureData) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: rawSignatureData'
      });
    }

    // Create signature record using enhanced contract module
    const signatureData = createSubcontractorSignature({
      subcontractorId: bodyData.subcontractorId,
      fullName: bodyData.fullName,
      email: bodyData.email,
      phone: bodyData.phone,
      signatureMethod: bodyData.signatureMethod,
      rawSignatureData: bodyData.rawSignatureData,
      clientDevice: bodyData.clientDevice, // Enhanced: ClientDeviceInfo object
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      agreedToPrivacy: bodyData.agreedToPrivacy !== false, // Default true for backwards compatibility
      agreedToTerms: bodyData.agreedToTerms !== false       // Default true for backwards compatibility
    });

    // Validate using Drizzle/Zod schema (architect-mandated validation)
    const validationResult = insertSubcontractorSignatureSchema.safeParse({
      id: signatureData.id,
      subcontractorId: signatureData.subcontractorId,
      fullName: signatureData.fullName,
      email: signatureData.email,
      phone: signatureData.phone,
      agreementVersion: signatureData.agreementVersion,
      signedAt: signatureData.signedAt,
      ipAddress: signatureData.ipAddress,
      userAgent: signatureData.userAgent,
      deviceInfo: signatureData.deviceInfo,
      signatureMethod: signatureData.signatureMethod,
      signaturePayload: signatureData.signaturePayload,
      agreementSnapshotJson: signatureData.agreementSnapshotJson,
      agreedToPrivacy: signatureData.agreedToPrivacy,
      agreedToTerms: signatureData.agreedToTerms,
      auditTrailId: signatureData.auditTrailId,
    });

    if (!validationResult.success) {
      const validationError = fromZodError(validationResult.error);
      return res.status(400).json({
        ok: false,
        error: `Validation failed: ${validationError.message}`
      });
    }

    // Insert into production Postgres database
    const [savedSignature] = await db.insert(subcontractorSignatures).values(validationResult.data).returning();

    console.log(`[Subcontractor Agreement 2025] Signature saved: ${savedSignature.id} for ${savedSignature.email}`);

    return res.status(201).json({
      ok: true,
      data: {
        signatureId: savedSignature.id,
        agreementVersion: savedSignature.agreementVersion,
        signedAt: savedSignature.signedAt,
      }
    });
  } catch (err) {
    console.error('[Subcontractor Agreement 2025] Sign error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error while saving signature'
    });
  }
});

/**
 * GET /api/subcontractors/agreements/2025/:signatureId
 * 
 * Retrieve signed agreement details for legal documentation.
 * Returns full signature record including agreement snapshot.
 */
router.get('/api/subcontractors/agreements/2025/:signatureId', async (req: Request, res: Response) => {
  try {
    const { signatureId } = req.params;

    if (!signatureId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing signatureId parameter'
      });
    }

    // Query from production database
    const signature = await db.query.subcontractorSignatures.findFirst({
      where: eq(subcontractorSignatures.id, signatureId)
    });

    if (!signature) {
      return res.status(404).json({
        ok: false,
        error: 'Signature not found'
      });
    }

    return res.json({
      ok: true,
      data: {
        signature,
        // Return the agreement as it was at time of signing
        agreement: signature.agreementSnapshotJson
      }
    });
  } catch (err) {
    console.error('[Subcontractor Agreement 2025] Get signature error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error while retrieving signature'
    });
  }
});

/**
 * GET /api/subcontractors/agreements/2025/contractor/:contractorId
 * 
 * Get all signed agreements for a specific contractor.
 * Returns signatures sorted by most recent first.
 */
router.get('/api/subcontractors/agreements/2025/contractor/:contractorId', async (req: Request, res: Response) => {
  try {
    const { contractorId } = req.params;

    if (!contractorId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing contractorId parameter'
      });
    }

    // Query all signatures for this contractor
    const signatures = await db.query.subcontractorSignatures.findMany({
      where: eq(subcontractorSignatures.subcontractorId, contractorId),
      orderBy: [desc(subcontractorSignatures.signedAt)]
    });

    return res.json({
      ok: true,
      data: {
        contractorId,
        signatures,
        count: signatures.length
      }
    });
  } catch (err) {
    console.error('[Subcontractor Agreement 2025] Get contractor signatures error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error while retrieving contractor signatures'
    });
  }
});

/**
 * GET /api/subcontractors/agreements/2025/template
 * 
 * Get the current agreement template (for preview before signing).
 * Returns the latest version of the agreement without requiring signature.
 */
router.get('/api/subcontractors/agreements/2025/template', async (req: Request, res: Response) => {
  try {
    return res.json({
      ok: true,
      data: {
        agreement: SUBCONTRACTOR_AGREEMENT_IL_2025,
        version: SUBCONTRACTOR_AGREEMENT_IL_2025.version,
        language: SUBCONTRACTOR_AGREEMENT_IL_2025.language,
        complianceConfig: ISRAEL_SUBCONTRACTOR_COMPLIANCE_2025 // Enhanced: compliance rules included
      }
    });
  } catch (err) {
    console.error('[Subcontractor Agreement 2025] Get template error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error while retrieving agreement template'
    });
  }
});

export default router;
