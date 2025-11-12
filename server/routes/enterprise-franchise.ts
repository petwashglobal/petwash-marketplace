import express from "express";
import { storage } from "../storage";
import { requireAdmin } from "../adminAuth";
import { z } from "zod";
import {
  insertFranchiseeSchema,
  insertFranchiseRoyaltyPaymentSchema,
} from "@shared/schema-franchise";
import { NotFoundError } from "../errors";

const router = express.Router();

// =================== FRANCHISEES ===================

// GET /api/enterprise/franchise/franchisees - Get all franchisees
router.get("/franchisees", requireAdmin, async (req, res) => {
  try {
    const franchisees = await storage.getAllFranchisees();
    res.json(franchisees);
  } catch (error: any) {
    console.error("[Enterprise Franchise] Error fetching franchisees:", error);
    res.status(500).json({ error: "Failed to fetch franchisees" });
  }
});

// GET /api/enterprise/franchise/franchisees/active - Get active franchisees
router.get("/franchisees/active", requireAdmin, async (req, res) => {
  try {
    const franchisees = await storage.getActiveFranchisees();
    res.json(franchisees);
  } catch (error: any) {
    console.error("[Enterprise Franchise] Error fetching active franchisees:", error);
    res.status(500).json({ error: "Failed to fetch active franchisees" });
  }
});

// GET /api/enterprise/franchise/franchisees/country/:country - Get franchisees by country
// IMPORTANT: This must come BEFORE /franchisees/:id to avoid :id matching "country"
router.get("/franchisees/country/:country", requireAdmin, async (req, res) => {
  try {
    const { country } = req.params;
    const franchisees = await storage.getFranchiseesByCountry(country);
    res.json(franchisees);
  } catch (error: any) {
    console.error("[Enterprise Franchise] Error fetching franchisees by country:", error);
    res.status(500).json({ error: "Failed to fetch franchisees by country" });
  }
});

// GET /api/enterprise/franchise/franchisees/:id - Get franchisee by ID
router.get("/franchisees/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const franchisee = await storage.getFranchiseeById(id);
    if (!franchisee) {
      return res.status(404).json({ error: "Franchisee not found" });
    }
    res.json(franchisee);
  } catch (error: any) {
    console.error("[Enterprise Franchise] Error fetching franchisee:", error);
    res.status(500).json({ error: "Failed to fetch franchisee" });
  }
});

// POST /api/enterprise/franchise/franchisees - Create new franchisee
router.post("/franchisees", requireAdmin, async (req, res) => {
  try {
    const validated = insertFranchiseeSchema.parse(req.body);
    const franchisee = await storage.createFranchisee(validated);
    res.status(201).json(franchisee);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Franchise] Error creating franchisee:", error);
    res.status(500).json({ error: "Failed to create franchisee" });
  }
});

// PUT /api/enterprise/franchise/franchisees/:id - Update franchisee
router.put("/franchisees/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateSchema = insertFranchiseeSchema.partial();
    const validated = updateSchema.parse(req.body);
    const franchisee = await storage.updateFranchisee(id, validated);
    res.json(franchisee);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error("[Enterprise Franchise] Error updating franchisee:", error);
    res.status(500).json({ error: "Failed to update franchisee" });
  }
});

// =================== ROYALTY PAYMENTS ===================

// GET /api/enterprise/franchise/royalty-payments - Get all royalty payments
router.get("/royalty-payments", requireAdmin, async (req, res) => {
  try {
    const payments = await storage.getAllRoyaltyPayments();
    res.json(payments);
  } catch (error: any) {
    console.error("[Enterprise Franchise] Error fetching royalty payments:", error);
    res.status(500).json({ error: "Failed to fetch royalty payments" });
  }
});

// GET /api/enterprise/franchise/royalty-payments/pending - Get pending royalty payments
router.get("/royalty-payments/pending", requireAdmin, async (req, res) => {
  try {
    const payments = await storage.getPendingRoyaltyPayments();
    res.json(payments);
  } catch (error: any) {
    console.error("[Enterprise Franchise] Error fetching pending royalty payments:", error);
    res.status(500).json({ error: "Failed to fetch pending royalty payments" });
  }
});

// GET /api/enterprise/franchise/royalty-payments/overdue - Get overdue royalty payments
router.get("/royalty-payments/overdue", requireAdmin, async (req, res) => {
  try {
    const payments = await storage.getOverdueRoyaltyPayments();
    res.json(payments);
  } catch (error: any) {
    console.error("[Enterprise Franchise] Error fetching overdue royalty payments:", error);
    res.status(500).json({ error: "Failed to fetch overdue royalty payments" });
  }
});

// GET /api/enterprise/franchise/royalty-payments/franchisee/:franchiseeId - Get royalty payments for franchisee
// IMPORTANT: This must come BEFORE /royalty-payments/:id to avoid :id matching "franchisee"
router.get("/royalty-payments/franchisee/:franchiseeId", requireAdmin, async (req, res) => {
  try {
    const franchiseeId = parseInt(req.params.franchiseeId);
    const payments = await storage.getFranchiseeRoyaltyPayments(franchiseeId);
    res.json(payments);
  } catch (error: any) {
    console.error("[Enterprise Franchise] Error fetching franchisee royalty payments:", error);
    res.status(500).json({ error: "Failed to fetch franchisee royalty payments" });
  }
});

// GET /api/enterprise/franchise/royalty-payments/:id - Get royalty payment by ID
router.get("/royalty-payments/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const payment = await storage.getRoyaltyPaymentById(id);
    if (!payment) {
      return res.status(404).json({ error: "Royalty payment not found" });
    }
    res.json(payment);
  } catch (error: any) {
    console.error("[Enterprise Franchise] Error fetching royalty payment:", error);
    res.status(500).json({ error: "Failed to fetch royalty payment" });
  }
});

// POST /api/enterprise/franchise/royalty-payments - Create new royalty payment
router.post("/royalty-payments", requireAdmin, async (req, res) => {
  try {
    const validated = insertFranchiseRoyaltyPaymentSchema.parse(req.body);
    const payment = await storage.createRoyaltyPayment(validated);
    res.status(201).json(payment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise Franchise] Error creating royalty payment:", error);
    res.status(500).json({ error: "Failed to create royalty payment" });
  }
});

// PUT /api/enterprise/franchise/royalty-payments/:id - Update royalty payment
router.put("/royalty-payments/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateSchema = insertFranchiseRoyaltyPaymentSchema.partial();
    const validated = updateSchema.parse(req.body);
    const payment = await storage.updateRoyaltyPayment(id, validated);
    res.json(payment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error("[Enterprise Franchise] Error updating royalty payment:", error);
    res.status(500).json({ error: "Failed to update royalty payment" });
  }
});

// POST /api/enterprise/franchise/royalty-payments/:id/record-payment - Record a royalty payment
router.post("/royalty-payments/:id/record-payment", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const paymentDataSchema = z.object({
      paidDate: z.string(),
      paymentMethod: z.string(),
      paymentReference: z.string().optional(),
    });
    const validated = paymentDataSchema.parse(req.body);
    const payment = await storage.recordRoyaltyPayment(id, validated);
    res.json(payment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error("[Enterprise Franchise] Error recording royalty payment:", error);
    res.status(500).json({ error: "Failed to record royalty payment" });
  }
});

export default router;
