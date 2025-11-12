import { Router, Request, Response } from "express";
import { db } from "../db";
import { digitalSignatures, signedDocuments, insertDigitalSignatureSchema, insertSignedDocumentSchema } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import crypto from 'crypto';
import { recordAuditEvent } from "../utils/auditSignature";

const router = Router();

// Middleware to verify CEO/authorized user
async function verifyCEOAccess(req: Request, res: Response, next: Function) {
  const user = req.user as any;
  
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // Check if user is Nir Hadad (CEO) or authorized executive
  const authorizedEmails = [
    "nir@petwash.co.il",
    "nir.hadad@petwash.co.il",
    // Add other authorized signers
  ];
  
  if (!authorizedEmails.includes(user.email?.toLowerCase())) {
    return res.status(403).json({ error: "CEO/Executive access only" });
  }
  
  next();
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
    
    res.json({ document: signedDoc });
  } catch (error: any) {
    logger.error("[Signatures API] Failed to sign document", { error: error.message });
    res.status(500).json({ error: "Failed to sign document" });
  }
});

export default router;
