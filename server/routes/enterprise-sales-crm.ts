import express from "express";
import { storage } from "../storage";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";
import {
  insertCrmCommunicationSchema,
  insertCrmDealStageSchema,
  insertCrmTaskSchema,
  insertCrmActivitySchema,
} from "@shared/schema";

const router = express.Router();

// =================== CRM COMMUNICATIONS ===================

// GET /api/enterprise/sales/crm/communications - List all communications with optional filters
router.get("/communications", requireAdmin, async (req, res) => {
  try {
    const { leadId, customerId, opportunityId, type, direction } = req.query;
    
    const filters = {
      leadId: leadId ? parseInt(leadId as string) : undefined,
      customerId: customerId ? parseInt(customerId as string) : undefined,
      opportunityId: opportunityId ? parseInt(opportunityId as string) : undefined,
      type: type as string | undefined,
      direction: direction as string | undefined,
    };

    const communications = await storage.getCommunications(filters);
    res.json(communications);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching communications:", error);
    res.status(500).json({ error: "Failed to fetch communications" });
  }
});

// GET /api/enterprise/sales/crm/communications/:id - Get single communication
router.get("/communications/:id", requireAdmin, async (req, res) => {
  try {
    const communication = await storage.getCommunication(parseInt(req.params.id));
    if (!communication) {
      return res.status(404).json({ error: "Communication not found" });
    }
    res.json(communication);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching communication:", error);
    res.status(500).json({ error: "Failed to fetch communication" });
  }
});

// POST /api/enterprise/sales/crm/communications - Create new communication
router.post("/communications", requireAdmin, async (req, res) => {
  try {
    const validated = insertCrmCommunicationSchema.parse(req.body);
    const communication = await storage.createCommunication(validated);
    res.status(201).json(communication);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error creating communication:", error);
    res.status(400).json({ error: error.message || "Failed to create communication" });
  }
});

// PATCH /api/enterprise/sales/crm/communications/:id - Update communication
router.patch("/communications/:id", requireAdmin, async (req, res) => {
  try {
    const communication = await storage.getCommunication(parseInt(req.params.id));
    if (!communication) {
      return res.status(404).json({ error: "Communication not found" });
    }
    
    const updated = await storage.updateCommunication(parseInt(req.params.id), req.body);
    res.json(updated);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error updating communication:", error);
    res.status(400).json({ error: "Failed to update communication" });
  }
});

// =================== CRM DEAL STAGES ===================

// GET /api/enterprise/sales/crm/deal-stages - List all deal stages
router.get("/deal-stages", requireAdmin, async (req, res) => {
  try {
    const stages = await storage.getDealStages();
    res.json(stages);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching deal stages:", error);
    res.status(500).json({ error: "Failed to fetch deal stages" });
  }
});

// GET /api/enterprise/sales/crm/deal-stages/:id - Get single deal stage
router.get("/deal-stages/:id", requireAdmin, async (req, res) => {
  try {
    const stage = await storage.getDealStage(parseInt(req.params.id));
    if (!stage) {
      return res.status(404).json({ error: "Deal stage not found" });
    }
    res.json(stage);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching deal stage:", error);
    res.status(500).json({ error: "Failed to fetch deal stage" });
  }
});

// POST /api/enterprise/sales/crm/deal-stages - Create new deal stage
router.post("/deal-stages", requireAdmin, async (req, res) => {
  try {
    const validated = insertCrmDealStageSchema.parse(req.body);
    const stage = await storage.createDealStage(validated);
    res.status(201).json(stage);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error creating deal stage:", error);
    res.status(400).json({ error: error.message || "Failed to create deal stage" });
  }
});

// PATCH /api/enterprise/sales/crm/deal-stages/:id - Update deal stage
router.patch("/deal-stages/:id", requireAdmin, async (req, res) => {
  try {
    const stage = await storage.getDealStage(parseInt(req.params.id));
    if (!stage) {
      return res.status(404).json({ error: "Deal stage not found" });
    }
    
    const updated = await storage.updateDealStage(parseInt(req.params.id), req.body);
    res.json(updated);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error updating deal stage:", error);
    res.status(400).json({ error: "Failed to update deal stage" });
  }
});

// DELETE /api/enterprise/sales/crm/deal-stages/:id - Delete deal stage
router.delete("/deal-stages/:id", requireAdmin, async (req, res) => {
  try {
    const stage = await storage.getDealStage(parseInt(req.params.id));
    if (!stage) {
      return res.status(404).json({ error: "Deal stage not found" });
    }
    
    const deleted = await storage.deleteDealStage(parseInt(req.params.id));
    if (!deleted) {
      return res.status(400).json({ error: "Failed to delete deal stage" });
    }
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error deleting deal stage:", error);
    res.status(400).json({ error: "Failed to delete deal stage" });
  }
});

// =================== CRM TASKS ===================

// GET /api/enterprise/sales/crm/tasks - List all tasks with optional filters
router.get("/tasks", requireAdmin, async (req, res) => {
  try {
    const { assignedTo, status, priority, leadId, opportunityId } = req.query;
    
    const filters = {
      assignedTo: assignedTo as string | undefined,
      status: status as string | undefined,
      priority: priority as string | undefined,
      leadId: leadId ? parseInt(leadId as string) : undefined,
      opportunityId: opportunityId ? parseInt(opportunityId as string) : undefined,
    };

    const tasks = await storage.getTasks(filters);
    res.json(tasks);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// GET /api/enterprise/sales/crm/tasks/overdue - Get overdue tasks
router.get("/tasks/overdue", requireAdmin, async (req, res) => {
  try {
    const { assignedTo } = req.query;
    const tasks = await storage.getOverdueTasks(assignedTo as string | undefined);
    res.json(tasks);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching overdue tasks:", error);
    res.status(500).json({ error: "Failed to fetch overdue tasks" });
  }
});

// GET /api/enterprise/sales/crm/tasks/upcoming - Get upcoming tasks
router.get("/tasks/upcoming", requireAdmin, async (req, res) => {
  try {
    const { assignedTo, days } = req.query;
    const tasks = await storage.getUpcomingTasks(
      assignedTo as string | undefined,
      days ? parseInt(days as string) : undefined
    );
    res.json(tasks);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching upcoming tasks:", error);
    res.status(500).json({ error: "Failed to fetch upcoming tasks" });
  }
});

// GET /api/enterprise/sales/crm/tasks/:id - Get single task
router.get("/tasks/:id", requireAdmin, async (req, res) => {
  try {
    const task = await storage.getTask(parseInt(req.params.id));
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching task:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// POST /api/enterprise/sales/crm/tasks - Create new task
router.post("/tasks", requireAdmin, async (req, res) => {
  try {
    const validated = insertCrmTaskSchema.parse(req.body);
    const task = await storage.createTask(validated);
    res.status(201).json(task);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error creating task:", error);
    res.status(400).json({ error: error.message || "Failed to create task" });
  }
});

// PATCH /api/enterprise/sales/crm/tasks/:id - Update task
router.patch("/tasks/:id", requireAdmin, async (req, res) => {
  try {
    const task = await storage.getTask(parseInt(req.params.id));
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    const updated = await storage.updateTask(parseInt(req.params.id), req.body);
    res.json(updated);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error updating task:", error);
    res.status(400).json({ error: "Failed to update task" });
  }
});

// POST /api/enterprise/sales/crm/tasks/:id/complete - Complete task
router.post("/tasks/:id/complete", requireAdmin, async (req, res) => {
  try {
    const task = await storage.getTask(parseInt(req.params.id));
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    const { completedBy, outcome, notes } = req.body;
    const completed = await storage.completeTask(
      parseInt(req.params.id),
      completedBy,
      outcome,
      notes
    );
    res.json(completed);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error completing task:", error);
    res.status(400).json({ error: "Failed to complete task" });
  }
});

// =================== CRM ACTIVITIES ===================

// GET /api/enterprise/sales/crm/activities - List all activities with optional filters
router.get("/activities", requireAdmin, async (req, res) => {
  try {
    const { leadId, customerId, opportunityId, userId, activityType } = req.query;
    
    const filters = {
      leadId: leadId ? parseInt(leadId as string) : undefined,
      customerId: customerId ? parseInt(customerId as string) : undefined,
      opportunityId: opportunityId ? parseInt(opportunityId as string) : undefined,
      userId: userId as string | undefined,
      activityType: activityType as string | undefined,
    };

    const activities = await storage.getActivities(filters);
    res.json(activities);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching activities:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

// GET /api/enterprise/sales/crm/activities/:id - Get single activity
router.get("/activities/:id", requireAdmin, async (req, res) => {
  try {
    const activity = await storage.getActivity(parseInt(req.params.id));
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }
    res.json(activity);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error fetching activity:", error);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

// POST /api/enterprise/sales/crm/activities - Create new activity
router.post("/activities", requireAdmin, async (req, res) => {
  try {
    const validated = insertCrmActivitySchema.parse(req.body);
    const activity = await storage.createActivity(validated);
    res.status(201).json(activity);
  } catch (error: any) {
    logger.error("[Enterprise Sales CRM] Error creating activity:", error);
    res.status(400).json({ error: error.message || "Failed to create activity" });
  }
});

export default router;
