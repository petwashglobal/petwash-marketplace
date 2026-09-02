/**
 * Admin Provider Full-Verification routes — mounted at /api/admin/provider-verification.
 * Drives the manual "PENDING PETWASH REVIEW" checklist: tick artefacts, record
 * name/DOB/photo/contract match verdicts, record official-document receipt +
 * secure destroy/delete/legal-hold, and the final identity-verified decision.
 * requireAdmin (isSuperAdmin) guards the router; the service audit-logs everything.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { isSuperAdminVerified } from "../middleware/rbac";
import { logger } from "../lib/logger";
import {
  MATCH_VERDICTS, OFFICIAL_DOC_TYPES, DOC_SUBMISSION_METHODS,
} from "@shared/schema-provider-verification";
import {
  computeChecklist, patchReview, setReviewDecision, recordDocument,
  markDocumentReceived, markDocumentDestroyed, markDocumentDeleted, setDocumentLegalHold,
} from "../services/providerFullVerification";

const router = Router();
function adminUid(req: any): string { return req.firebaseUser?.uid || req.userId || req.user?.id || "unknown"; }
function requireAdmin(req: any, res: any, next: any) {
  if (!isSuperAdminVerified(req)) return res.status(403).json({ error: "Full admin access required" });
  next();
}
router.use(requireAdmin);

const verdict = z.enum(MATCH_VERDICTS as unknown as [string, ...string[]]);

router.get("/:applicationId/checklist", async (req: Request, res: Response) => {
  try {
    const cl = await computeChecklist(req.params.applicationId);
    if (!cl) return res.status(404).json({ error: "Application not found" });
    return res.json(cl);
  } catch (e: any) {
    logger.error("[AdminProviderVerify] checklist failed", { error: e?.message });
    return res.status(500).json({ error: "Failed to load checklist" });
  }
});

const patchSchema = z.object({
  typedDetailsChecked: z.boolean().optional(),
  selfieChecked: z.boolean().optional(),
  officialDocumentChecked: z.boolean().optional(),
  contractChecked: z.boolean().optional(),
  nameMatch: verdict.optional(),
  dobMatch: verdict.optional(),
  documentNumberMatch: verdict.optional(),
  selfiePhotoMatch: verdict.optional(),
  contractNameMatch: verdict.optional(),
  notes: z.string().max(2000).optional(),
});

router.post("/:applicationId/patch", async (req: Request, res: Response) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid patch", detail: parsed.error.flatten() });
  try {
    await patchReview(req.params.applicationId, adminUid(req), parsed.data as any, req.ip, req.headers["user-agent"]);
    const cl = await computeChecklist(req.params.applicationId);
    return res.json({ ok: true, checklist: cl });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "patch failed" });
  }
});

router.post("/:applicationId/decision", async (req: Request, res: Response) => {
  const schema = z.object({ decision: z.enum(["approved", "needs_more_info", "rejected"]), notes: z.string().max(2000).default("") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid decision", detail: parsed.error.flatten() });
  try {
    await setReviewDecision(req.params.applicationId, adminUid(req), parsed.data.decision, parsed.data.notes, req.ip, req.headers["user-agent"]);
    const cl = await computeChecklist(req.params.applicationId);
    return res.json({ ok: true, checklist: cl });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "decision failed" });
  }
});

router.post("/:applicationId/document", async (req: Request, res: Response) => {
  const schema = z.object({
    documentType: z.enum(OFFICIAL_DOC_TYPES as unknown as [string, ...string[]]),
    submissionMethod: z.enum(DOC_SUBMISSION_METHODS as unknown as [string, ...string[]]),
    providerId: z.string().optional(),
    fileId: z.string().optional(),
    physicalReceived: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid document", detail: parsed.error.flatten() });
  try {
    const id = await recordDocument(req.params.applicationId, adminUid(req), parsed.data as any, req.ip, req.headers["user-agent"]);
    return res.json({ ok: true, documentId: id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "record failed" });
  }
});

const docAction = (fn: (docId: number, adminId: string, applicationId: string, ip?: string, ua?: string) => Promise<void>) =>
  async (req: Request, res: Response) => {
    const docId = z.coerce.number().int().positive().safeParse(req.params.docId);
    const applicationId = z.string().min(1).safeParse(req.body?.applicationId);
    if (!docId.success || !applicationId.success) return res.status(400).json({ error: "docId + applicationId required" });
    try {
      await fn(docId.data, adminUid(req), applicationId.data, req.ip, req.headers["user-agent"]);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "action failed" });
    }
  };

router.post("/document/:docId/received", docAction(markDocumentReceived));
router.post("/document/:docId/destroyed", docAction(markDocumentDestroyed));
router.post("/document/:docId/deleted", docAction(markDocumentDeleted));
router.post("/document/:docId/legal-hold", async (req: Request, res: Response) => {
  const docId = z.coerce.number().int().positive().safeParse(req.params.docId);
  const schema = z.object({ applicationId: z.string().min(1), reason: z.string().min(3) });
  const parsed = schema.safeParse(req.body);
  if (!docId.success || !parsed.success) return res.status(400).json({ error: "docId + applicationId + reason required" });
  try {
    await setDocumentLegalHold(docId.data, adminUid(req), parsed.data.applicationId, parsed.data.reason, req.ip, req.headers["user-agent"]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "legal-hold failed" });
  }
});

export default router;
