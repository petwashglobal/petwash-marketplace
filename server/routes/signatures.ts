import { Router, Request, Response } from "express";
import { db } from "../db";
import { digitalSignatures, signedDocuments, insertDigitalSignatureSchema, insertSignedDocumentSchema } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import crypto from 'crypto';
import { recordAuditEvent } from "../utils/auditSignature";
import { GoogleSheetsService } from "../services/googleSheetsIntegration";

const router = Router();

// Middleware to verify CEO/authorized signer.
//
// Authorization sources (either grants access):
//   1. Firebase Custom Claim `role: 'ceo'` or `signingAuthority: true` —
//      the durable, revocable, account-portable mechanism. Preferred.
//   2. Hard-coded authorizedEmails — legacy fallback retained until
//      every authorized signer has the custom claim set. Once confirmed,
//      remove this branch in a follow-up commit.
//
// To set the custom claim on a Firebase user (one-time, from a trusted env):
//   await admin.auth().setCustomUserClaims(uid, { role: 'ceo' });
// Users must sign out and back in for new claims to appear in the token.
async function verifyCEOAccess(req: Request, res: Response, next: Function) {
  const user = req.user as any;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Path 1 — Firebase Custom Claim (preferred).
  // Fetch the live user record so revoked claims are honored immediately
  // instead of waiting for the ID token to expire.
  try {
    const { adminAuth } = await import('../lib/firebase-admin');
    const uid: string | undefined = user.uid || user.firebaseUser?.uid;
    if (uid) {
      const userRecord = await adminAuth.getUser(uid);
      const claims = (userRecord.customClaims || {}) as Record<string, any>;
      if (claims.role === 'ceo' || claims.signingAuthority === true) {
        return next();
      }
    }
  } catch (err) {
    logger.warn('[Signatures] customClaims lookup failed, falling back to email allowlist', { err: (err as Error)?.message });
  }

  // Path 2 — legacy email allowlist (TODO: remove after custom claim is set).
  const authorizedEmails = [
    "nir@petwash.co.il",
    "nir.hadad@petwash.co.il",
  ];
  if (authorizedEmails.includes(user.email?.toLowerCase())) {
    logger.warn('[Signatures] authorized via legacy email fallback — set Firebase Custom Claim role=ceo to remove this path', { email: user.email });
    return next();
  }

  return res.status(403).json({ error: "CEO/Executive access only" });
}

// Get user's digital signatures
router.get("/", verifyCEOAccess, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    
    const signatures = await db
      .select()
      .from(digitalSignatures)
      .where(eq(digitalSignatures.userId, user.uid))
      .orderBy(desc(digitalSignatures.createdAt));
    
    res.json({ signatures });
  } catch (error: any) {
    logger.error("[Signatures API] Failed to fetch signatures", { error: error.message });
    res.status(500).json({ error: "Failed to fetch signatures" });
  }
});

// Upload new signature
router.post("/", verifyCEOAccess, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const data = insertDigitalSignatureSchema.parse(req.body);
    
    // Generate cryptographic hash for signature image
    const signatureHash = crypto
      .createHash('sha256')
      .update(data.signatureImageUrl)
      .digest('hex');
    
    // Create signature record
    const [signature] = await db
      .insert(digitalSignatures)
      .values({
        ...data,
        userId: user.uid,
        signatureHash,
        createdBy: user.uid,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
      })
      .returning();
    
    // Audit trail
    await recordAuditEvent({
      eventType: 'signature_created',
      customerUid: user.uid,
      metadata: {
        signatureId: signature.id,
        signerName: data.signerName,
        signerTitle: data.signerTitle,
      },
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
    
    logger.info("[Signatures API] Digital signature created", {
      signatureId: signature.id,
      signerName: data.signerName,
    });
    
    res.json({ signature });
  } catch (error: any) {
    logger.error("[Signatures API] Failed to create signature", { error: error.message });
    res.status(500).json({ error: "Failed to create signature" });
  }
});

// Get all signed documents
router.get("/documents", verifyCEOAccess, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    
    // Get user's signature IDs
    const userSignatures = await db
      .select()
      .from(digitalSignatures)
      .where(eq(digitalSignatures.userId, user.uid));
    
    const signatureIds = userSignatures.map(s => s.id);
    
    if (signatureIds.length === 0) {
      return res.json({ documents: [] });
    }
    
    // Get all documents signed with user's signatures
    const documents = await db
      .select()
      .from(signedDocuments)
      .orderBy(desc(signedDocuments.signedDate))
      .limit(100);
    
    res.json({ documents });
  } catch (error: any) {
    logger.error("[Signatures API] Failed to fetch signed documents", { error: error.message });
    res.status(500).json({ error: "Failed to fetch signed documents" });
  }
});

// Sign a document
router.post("/documents/sign", verifyCEOAccess, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const data = insertSignedDocumentSchema.parse(req.body);
    
    // Verify signature belongs to user
    const [signature] = await db
      .select()
      .from(digitalSignatures)
      .where(eq(digitalSignatures.id, data.signatureId))
      .limit(1);
    
    if (!signature || signature.userId !== user.uid) {
      return res.status(403).json({ error: "Invalid signature ID" });
    }
    
    // Generate document hash (blockchain-style)
    const documentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        documentType: data.documentType,
        documentTitle: data.documentTitle,
        signedDocumentUrl: data.signedDocumentUrl,
        signedBy: data.signedBy,
        signedDate: data.signedDate,
      }))
      .digest('hex');
    
    // Get previous document hash for chain linking
    const [previousDoc] = await db
      .select()
      .from(signedDocuments)
      .orderBy(desc(signedDocuments.createdAt))
      .limit(1);
    
    const previousDocumentHash = previousDoc?.documentHash || null;
    
    // Generate audit hash
    const auditHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        documentHash,
        previousDocumentHash,
        signedBy: data.signedBy,
        timestamp: new Date().toISOString(),
      }))
      .digest('hex');
    
    // Create signed document record
    const [signedDoc] = await db
      .insert(signedDocuments)
      .values({
        ...data,
        documentHash,
        previousDocumentHash,
        auditHash,
      })
      .returning();
    
    // Audit trail
    await recordAuditEvent({
      eventType: 'document_signed',
      customerUid: user.uid,
      metadata: {
        documentId: signedDoc.id,
        documentType: data.documentType,
        documentTitle: data.documentTitle,
        signedBy: data.signedBy,
      },
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });
    
    logger.info("[Signatures API] Document signed successfully", {
      documentId: signedDoc.id,
      documentTitle: data.documentTitle,
      signedBy: data.signedBy,
    });

    GoogleSheetsService.logESignature({
      signatureId: signedDoc.id.toString(),
      documentTitle: data.documentTitle,
      signerName: data.signedBy,
      signerEmail: user.email || '',
      documentType: data.documentType,
      contractReference: signedDoc.documentHash || '',
      signatureStatus: 'Signed',
      signedAt: new Date().toISOString(),
      ipAddress: req.ip || 'Unknown',
    }).catch(err => logger.error('[Signatures API] Google Sheets logging failed - DB record saved', err));
    
    res.json({ document: signedDoc });
  } catch (error: any) {
    logger.error("[Signatures API] Failed to sign document", { error: error.message });
    res.status(500).json({ error: "Failed to sign document" });
  }
});

export default router;
