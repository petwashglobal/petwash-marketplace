import express from "express";
import { storage } from "../storage";
import { requireAdmin } from "../adminAuth";
import { z } from "zod";
import { 
  insertPolicyDocumentSchema,
  insertPolicyAcknowledgmentSchema,
  insertComplianceCertificationSchema
} from "@shared/schema-policy";

const router = express.Router();

// =================== POLICY DOCUMENTS ===================

// GET /api/enterprise/policy/documents - Get all policy documents
router.get("/documents", requireAdmin, async (req, res) => {
  try {
    const documents = await storage.getAllPolicyDocuments();
    res.json(documents);
  } catch (error: any) {
    console.error("[Enterprise Policy] Error fetching policy documents:", error);
    res.status(500).json({ error: "Failed to fetch policy documents" });
  }
});

// GET /api/enterprise/policy/documents/active - Get active policy documents
router.get("/documents/active", requireAdmin, async (req, res) => {
  try {
    const documents = await storage.getActivePolicyDocuments();
    res.json(documents);
  } catch (error: any) {
    console.error("[Enterprise Policy] Error fetching active policy documents:", error);
    res.status(500).json({ error: "Failed to fetch active policy documents" });
  }
});

// GET /api/enterprise/policy/documents/category/:category - Get documents by category
// IMPORTANT: This must come BEFORE /documents/:id to avoid :id matching "category"
router.get("/documents/category/:category", requireAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    const documents = await storage.getPolicyDocumentsByCategory(category);
    res.json(documents);
  } catch (error: any) {
    console.error("[Enterprise Policy] Error fetching policy documents by category:", error);
    res.status(500).json({ error: "Failed to fetch policy documents by category" });
  }
});

// GET /api/enterprise/policy/documents/:id - Get policy document by ID
router.get("/documents/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const document = await storage.getPolicyDocumentById(id);
    if (!document) {
      return res.status(404).json({ error: "Policy document not found" });
    }
    res.json(document);
  } catch (error: any) {
    console.error("[Enterprise Policy] Error fetching policy document:", error);
    res.status(500).json({ error: "Failed to fetch policy document" });
  }
});

// POST /api/enterprise/policy/documents - Create new policy document
router.post("/documents", requireAdmin, async (req, res) => {
  try {
    const validated = insertPolicyDocumentSchema.parse(req.body);
    const document = await storage.createPolicyDocument(validated);
    res.status(201).json(document);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Policy] Error creating policy document:", error);
    res.status(500).json({ error: "Failed to create policy document" });
  }
});

// PUT /api/enterprise/policy/documents/:id - Update policy document
router.put("/documents/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateSchema = insertPolicyDocumentSchema.partial();
    const validated = updateSchema.parse(req.body);
    const document = await storage.updatePolicyDocument(id, validated);
    res.json(document);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Policy] Error updating policy document:", error);
    res.status(500).json({ error: "Failed to update policy document" });
  }
});

// DELETE /api/enterprise/policy/documents/:id - Delete policy document
router.delete("/documents/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deletePolicyDocument(id);
    res.json({ message: "Policy document deleted successfully" });
  } catch (error: any) {
    console.error("[Enterprise Policy] Error deleting policy document:", error);
    res.status(500).json({ error: "Failed to delete policy document" });
  }
});

// =================== POLICY ACKNOWLEDGMENTS ===================

// GET /api/enterprise/policy/documents/:id/acknowledgments - Get acknowledgments for a policy
router.get("/documents/:id/acknowledgments", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const acknowledgments = await storage.getPolicyAcknowledgments(id);
    res.json(acknowledgments);
  } catch (error: any) {
    console.error("[Enterprise Policy] Error fetching policy acknowledgments:", error);
    res.status(500).json({ error: "Failed to fetch policy acknowledgments" });
  }
});

// POST /api/enterprise/policy/acknowledgments - Record policy acknowledgment
router.post("/acknowledgments", requireAdmin, async (req, res) => {
  try {
    const validated = insertPolicyAcknowledgmentSchema.parse(req.body);
    
    // Add tracking info
    const acknowledgmentData = {
      ...validated,
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string || null,
      userAgent: req.headers['user-agent'] || null,
    };
    
    const acknowledgment = await storage.recordPolicyAcknowledgment(acknowledgmentData);
    res.status(201).json(acknowledgment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Policy] Error recording policy acknowledgment:", error);
    res.status(500).json({ error: "Failed to record policy acknowledgment" });
  }
});

// =================== COMPLIANCE CERTIFICATIONS ===================

// GET /api/enterprise/policy/certifications - Get all compliance certifications
router.get("/certifications", requireAdmin, async (req, res) => {
  try {
    const certifications = await storage.getAllComplianceCertifications();
    res.json(certifications);
  } catch (error: any) {
    console.error("[Enterprise Policy] Error fetching certifications:", error);
    res.status(500).json({ error: "Failed to fetch certifications" });
  }
});

// GET /api/enterprise/policy/certifications/expiring - Get expiring certifications
router.get("/certifications/expiring", requireAdmin, async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 30;
    const certifications = await storage.getExpiringCertifications(daysAhead);
    res.json(certifications);
  } catch (error: any) {
    console.error("[Enterprise Policy] Error fetching expiring certifications:", error);
    res.status(500).json({ error: "Failed to fetch expiring certifications" });
  }
});

// GET /api/enterprise/policy/certifications/:id - Get certification by ID
router.get("/certifications/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const certification = await storage.getComplianceCertificationById(id);
    if (!certification) {
      return res.status(404).json({ error: "Certification not found" });
    }
    res.json(certification);
  } catch (error: any) {
    console.error("[Enterprise Policy] Error fetching certification:", error);
    res.status(500).json({ error: "Failed to fetch certification" });
  }
});

// GET /api/enterprise/policy/certifications/employee/:employeeId - Get employee certifications
router.get("/certifications/employee/:employeeId", requireAdmin, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const certifications = await storage.getEmployeeCertifications(employeeId);
    res.json(certifications);
  } catch (error: any) {
    console.error("[Enterprise Policy] Error fetching employee certifications:", error);
    res.status(500).json({ error: "Failed to fetch employee certifications" });
  }
});

// POST /api/enterprise/policy/certifications - Create new certification
router.post("/certifications", requireAdmin, async (req, res) => {
  try {
    const validated = insertComplianceCertificationSchema.parse(req.body);
    const certification = await storage.createComplianceCertification(validated);
    res.status(201).json(certification);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Policy] Error creating certification:", error);
    res.status(500).json({ error: "Failed to create certification" });
  }
});

// PUT /api/enterprise/policy/certifications/:id - Update certification
router.put("/certifications/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateSchema = insertComplianceCertificationSchema.partial();
    const validated = updateSchema.parse(req.body);
    const certification = await storage.updateComplianceCertification(id, validated);
    res.json(certification);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Policy] Error updating certification:", error);
    res.status(500).json({ error: "Failed to update certification" });
  }
});

export default router;
