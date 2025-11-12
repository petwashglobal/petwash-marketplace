import express from "express";
import { storage } from "../storage";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";
import { insertCrmLeadSchema, insertCrmOpportunitySchema } from "@shared/schema";

const router = express.Router();

// =================== CRM LEADS ===================

// GET /api/enterprise/sales/leads - List all leads with optional filters
router.get("/leads", requireAdmin, async (req, res) => {
    try {
      const { status, source, assignedTo, qualificationStatus } = req.query;
      
      const filters = {
        status: status as string,
        source: source as string,
        assignedTo: assignedTo as string,
        qualificationStatus: qualificationStatus as string,
      };

      const leads = await storage.getLeads(filters);
      res.json(leads);
    } catch (error) {
      logger.error("[Enterprise Sales] Failed to fetch leads", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // GET /api/enterprise/sales/leads/:id - Get single lead
  router.get("/leads/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const lead = await storage.getLead(id);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json(lead);
    } catch (error) {
      logger.error(`[Enterprise Sales] Failed to fetch lead ${req.params.id}`, error);
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  // POST /api/enterprise/sales/leads - Create new lead
  router.post("/leads", requireAdmin, async (req, res) => {
    try {
      const validated = insertCrmLeadSchema.parse(req.body);
      const lead = await storage.createLead(validated);
      
      logger.info(`[Enterprise Sales] Lead created: ${lead.id}`, {
        leadId: lead.id,
        email: lead.email,
        source: lead.leadSource,
      });

      res.status(201).json(lead);
    } catch (error) {
      logger.error("[Enterprise Sales] Failed to create lead", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create lead" });
    }
  });

  // PATCH /api/enterprise/sales/leads/:id - Update lead
  router.patch("/leads/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getLead(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const updated = await storage.updateLead(id, req.body);
      
      logger.info(`[Enterprise Sales] Lead updated: ${id}`, {
        leadId: id,
        changes: Object.keys(req.body),
      });

      res.json(updated);
    } catch (error) {
      logger.error(`[Enterprise Sales] Failed to update lead ${req.params.id}`, error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update lead" });
    }
  });

  // PATCH /api/enterprise/sales/leads/:id/status - Update lead status
  router.patch("/leads/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, qualificationStatus } = req.body;
      
      const existing = await storage.getLead(id);
      if (!existing) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const updates: any = {};
      if (status) updates.leadStatus = status;
      if (qualificationStatus) updates.qualificationStatus = qualificationStatus;

      const updated = await storage.updateLead(id, updates);
      res.json(updated);
    } catch (error) {
      logger.error(`[Enterprise Sales] Failed to update lead status ${req.params.id}`, error);
      res.status(400).json({ error: "Failed to update lead status" });
    }
  });

  // PATCH /api/enterprise/sales/leads/:id/assign - Assign lead to sales rep
  router.patch("/leads/:id/assign", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { assignedTo } = req.body;
      
      const existing = await storage.getLead(id);
      if (!existing) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const updated = await storage.updateLead(id, { 
        assignedTo,
        assignedAt: new Date(),
      });
      
      res.json(updated);
    } catch (error) {
      logger.error(`[Enterprise Sales] Failed to assign lead ${req.params.id}`, error);
      res.status(400).json({ error: "Failed to assign lead" });
    }
  });

  // =================== OPPORTUNITIES ===================

  // GET /api/enterprise/sales/opportunities - List all opportunities with filters
  router.get("/opportunities", requireAdmin, async (req, res) => {
    try {
      const { status, assignedTo, stageId } = req.query;
      
      const filters = {
        status: status as string,
        assignedTo: assignedTo as string,
        stageId: stageId ? parseInt(stageId as string) : undefined,
      };

      const opportunities = await storage.getOpportunities(filters);
      res.json(opportunities);
    } catch (error) {
      logger.error("[Enterprise Sales] Failed to fetch opportunities", error);
      res.status(500).json({ error: "Failed to fetch opportunities" });
    }
  });

  // GET /api/enterprise/sales/opportunities/:id - Get single opportunity
  router.get("/opportunities/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const opportunity = await storage.getOpportunity(id);
      
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }

      res.json(opportunity);
    } catch (error) {
      logger.error(`[Enterprise Sales] Failed to fetch opportunity ${req.params.id}`, error);
      res.status(500).json({ error: "Failed to fetch opportunity" });
    }
  });

  // POST /api/enterprise/sales/opportunities - Create new opportunity
  router.post("/opportunities", requireAdmin, async (req, res) => {
    try {
      const validated = insertCrmOpportunitySchema.parse(req.body);
      const opportunity = await storage.createOpportunity(validated);
      
      logger.info(`[Enterprise Sales] Opportunity created: ${opportunity.id}`, {
        opportunityId: opportunity.id,
        name: opportunity.name,
        value: opportunity.estimatedValue,
      });

      res.status(201).json(opportunity);
    } catch (error) {
      logger.error("[Enterprise Sales] Failed to create opportunity", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create opportunity" });
    }
  });

  // PATCH /api/enterprise/sales/opportunities/:id - Update opportunity
  router.patch("/opportunities/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getOpportunity(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Opportunity not found" });
      }

      const updated = await storage.updateOpportunity(id, req.body);
      
      logger.info(`[Enterprise Sales] Opportunity updated: ${id}`, {
        opportunityId: id,
        changes: Object.keys(req.body),
      });

      res.json(updated);
    } catch (error) {
      logger.error(`[Enterprise Sales] Failed to update opportunity ${req.params.id}`, error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update opportunity" });
    }
  });

  // PATCH /api/enterprise/sales/opportunities/:id/status - Update opportunity status
  router.patch("/opportunities/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, lostReason } = req.body;
      
      const existing = await storage.getOpportunity(id);
      if (!existing) {
        return res.status(404).json({ error: "Opportunity not found" });
      }

      const updates: any = { status };
      if (status === "lost" && lostReason) {
        updates.lostReason = lostReason;
      }
      if (status === "won") {
        updates.actualCloseDate = new Date();
      }

      const updated = await storage.updateOpportunity(id, updates);
      res.json(updated);
    } catch (error) {
      logger.error(`[Enterprise Sales] Failed to update opportunity status ${req.params.id}`, error);
      res.status(400).json({ error: "Failed to update opportunity status" });
    }
  });

  // PATCH /api/enterprise/sales/opportunities/:id/stage - Move opportunity to different stage
  router.patch("/opportunities/:id/stage", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { dealStageId } = req.body;
      
      const existing = await storage.getOpportunity(id);
      if (!existing) {
        return res.status(404).json({ error: "Opportunity not found" });
      }

      const updated = await storage.updateOpportunity(id, { 
        dealStageId,
        lastActivityAt: new Date(),
      });
      
      res.json(updated);
    } catch (error) {
      logger.error(`[Enterprise Sales] Failed to update opportunity stage ${req.params.id}`, error);
      res.status(400).json({ error: "Failed to update opportunity stage" });
    }
  });

export default router;
