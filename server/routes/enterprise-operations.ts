import { Router } from "express";
import { storage } from "../storage";
import { insertOpsTaskSchema, insertOpsIncidentSchema, insertOpsSlaTrackingSchema } from "@shared/schema-operations";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";

const router = Router();

// =================== OPERATIONS TASKS ===================

// GET /api/enterprise/operations/tasks - Get all tasks with filters
router.get("/tasks", requireAdmin, async (req, res) => {
  try {
    const filters = {
      taskId: req.query.taskId as string,
      assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined,
      status: req.query.status as string,
      priority: req.query.priority as string,
      category: req.query.category as string,
      stationId: req.query.stationId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const tasks = await storage.getOpsTasks(filters);
    res.json(tasks);
  } catch (error) {
    logger.error("[Operations API] Error fetching tasks", { error });
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// GET /api/enterprise/operations/tasks/overdue - Get overdue tasks
router.get("/tasks/overdue", requireAdmin, async (req, res) => {
  try {
    const tasks = await storage.getOverdueOpsTasks();
    res.json(tasks);
  } catch (error) {
    logger.error("[Operations API] Error fetching overdue tasks", { error });
    res.status(500).json({ error: "Failed to fetch overdue tasks" });
  }
});

// GET /api/enterprise/operations/tasks/status/:status - Get tasks by status
router.get("/tasks/status/:status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.params;
    const tasks = await storage.getTasksByStatus(status);
    res.json(tasks);
  } catch (error) {
    logger.error("[Operations API] Error fetching tasks by status", { error });
    res.status(500).json({ error: "Failed to fetch tasks by status" });
  }
});

// GET /api/enterprise/operations/tasks/priority/:priority - Get tasks by priority
router.get("/tasks/priority/:priority", requireAdmin, async (req, res) => {
  try {
    const { priority } = req.params;
    const tasks = await storage.getTasksByPriority(priority);
    res.json(tasks);
  } catch (error) {
    logger.error("[Operations API] Error fetching tasks by priority", { error });
    res.status(500).json({ error: "Failed to fetch tasks by priority" });
  }
});

// GET /api/enterprise/operations/tasks/:id - Get task by ID
router.get("/tasks/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = await storage.getOpsTask(id);
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json(task);
  } catch (error) {
    logger.error("[Operations API] Error fetching task", { error });
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// POST /api/enterprise/operations/tasks - Create new task
router.post("/tasks", requireAdmin, async (req, res) => {
  try {
    const validatedData = insertOpsTaskSchema.parse(req.body);
    const task = await storage.createOpsTask(validatedData);
    
    logger.info("[Operations API] Task created", { taskId: task.id, taskType: task.category });
    res.status(201).json(task);
  } catch (error) {
    logger.error("[Operations API] Error creating task", { error });
    res.status(400).json({ error: "Failed to create task" });
  }
});

// PATCH /api/enterprise/operations/tasks/:id - Update task
router.patch("/tasks/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = await storage.updateOpsTask(id, req.body);
    
    logger.info("[Operations API] Task updated", { taskId: id });
    res.json(task);
  } catch (error) {
    logger.error("[Operations API] Error updating task", { error });
    
    if (error instanceof Error && error.message === "Task not found") {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.status(500).json({ error: "Failed to update task" });
  }
});

// POST /api/enterprise/operations/tasks/:id/complete - Complete task
router.post("/tasks/:id/complete", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { completedBy, notes } = req.body;
    
    const task = await storage.completeOpsTask(id, completedBy, notes);
    
    logger.info("[Operations API] Task completed", { taskId: id, completedBy });
    res.json(task);
  } catch (error) {
    logger.error("[Operations API] Error completing task", { error });
    
    if (error instanceof Error && error.message === "Task not found") {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.status(500).json({ error: "Failed to complete task" });
  }
});

// =================== OPERATIONS INCIDENTS ===================

// GET /api/enterprise/operations/incidents - Get all incidents with filters
router.get("/incidents", requireAdmin, async (req, res) => {
  try {
    const filters = {
      incidentId: req.query.incidentId as string,
      severity: req.query.severity as string,
      status: req.query.status as string,
      category: req.query.category as string,
      stationId: req.query.stationId as string,
      assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined,
      slaBreach: req.query.slaBreach === 'true' ? true : req.query.slaBreach === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const incidents = await storage.getIncidents(filters);
    res.json(incidents);
  } catch (error) {
    logger.error("[Operations API] Error fetching incidents", { error });
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

// GET /api/enterprise/operations/incidents/sla-breaches - Get SLA breach incidents
router.get("/incidents/sla-breaches", requireAdmin, async (req, res) => {
  try {
    const incidents = await storage.getSlaBreachIncidents();
    res.json(incidents);
  } catch (error) {
    logger.error("[Operations API] Error fetching SLA breach incidents", { error });
    res.status(500).json({ error: "Failed to fetch SLA breach incidents" });
  }
});

// GET /api/enterprise/operations/incidents/severity/:severity - Get incidents by severity
router.get("/incidents/severity/:severity", requireAdmin, async (req, res) => {
  try {
    const { severity } = req.params;
    const incidents = await storage.getIncidentsBySeverity(severity);
    res.json(incidents);
  } catch (error) {
    logger.error("[Operations API] Error fetching incidents by severity", { error });
    res.status(500).json({ error: "Failed to fetch incidents by severity" });
  }
});

// GET /api/enterprise/operations/incidents/:id - Get incident by ID
router.get("/incidents/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const incident = await storage.getIncident(id);
    
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    res.json(incident);
  } catch (error) {
    logger.error("[Operations API] Error fetching incident", { error });
    res.status(500).json({ error: "Failed to fetch incident" });
  }
});

// POST /api/enterprise/operations/incidents - Create new incident
router.post("/incidents", requireAdmin, async (req, res) => {
  try {
    const validatedData = insertOpsIncidentSchema.parse(req.body);
    const incident = await storage.createIncident(validatedData);
    
    logger.info("[Operations API] Incident created", { incidentId: incident.id, severity: incident.severity });
    res.status(201).json(incident);
  } catch (error) {
    logger.error("[Operations API] Error creating incident", { error });
    res.status(400).json({ error: "Failed to create incident" });
  }
});

// PATCH /api/enterprise/operations/incidents/:id - Update incident
router.patch("/incidents/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const incident = await storage.updateIncident(id, req.body);
    
    logger.info("[Operations API] Incident updated", { incidentId: id });
    res.json(incident);
  } catch (error) {
    logger.error("[Operations API] Error updating incident", { error });
    
    if (error instanceof Error && error.message === "Incident not found") {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    res.status(500).json({ error: "Failed to update incident" });
  }
});

// POST /api/enterprise/operations/incidents/:id/resolve - Resolve incident
router.post("/incidents/:id/resolve", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { resolvedBy, resolution, preventiveMeasures } = req.body;
    
    const incident = await storage.resolveIncident(id, resolvedBy, resolution, preventiveMeasures);
    
    logger.info("[Operations API] Incident resolved", { incidentId: id, resolvedBy });
    res.json(incident);
  } catch (error) {
    logger.error("[Operations API] Error resolving incident", { error });
    
    if (error instanceof Error && error.message === "Incident not found") {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    res.status(500).json({ error: "Failed to resolve incident" });
  }
});

// POST /api/enterprise/operations/incidents/:id/close - Close incident
router.post("/incidents/:id/close", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { closedBy } = req.body;
    
    const incident = await storage.closeIncident(id, closedBy);
    
    logger.info("[Operations API] Incident closed", { incidentId: id, closedBy });
    res.json(incident);
  } catch (error) {
    logger.error("[Operations API] Error closing incident", { error });
    
    if (error instanceof Error && error.message === "Incident not found") {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    res.status(500).json({ error: "Failed to close incident" });
  }
});

// POST /api/enterprise/operations/incidents/:id/escalate - Escalate incident
router.post("/incidents/:id/escalate", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { escalatedBy, escalationNotes } = req.body;
    
    const incident = await storage.escalateIncident(id, escalatedBy, escalationNotes);
    
    logger.info("[Operations API] Incident escalated", { incidentId: id, escalatedBy });
    res.json(incident);
  } catch (error) {
    logger.error("[Operations API] Error escalating incident", { error });
    
    if (error instanceof Error && error.message === "Incident not found") {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    res.status(500).json({ error: "Failed to escalate incident" });
  }
});

// =================== SLA TRACKING ===================

// GET /api/enterprise/operations/sla - Get SLA trackings with filters
router.get("/sla", requireAdmin, async (req, res) => {
  try {
    const filters = {
      entityType: req.query.entityType as string,
      entityId: req.query.entityId ? parseInt(req.query.entityId as string) : undefined,
      slaType: req.query.slaType as string,
      status: req.query.status as string,
      isBreach: req.query.isBreach === 'true' ? true : req.query.isBreach === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const trackings = await storage.getSlaTrackings(filters);
    res.json(trackings);
  } catch (error) {
    logger.error("[Operations API] Error fetching SLA trackings", { error });
    res.status(500).json({ error: "Failed to fetch SLA trackings" });
  }
});

// GET /api/enterprise/operations/sla/breaches - Get SLA breaches
router.get("/sla/breaches", requireAdmin, async (req, res) => {
  try {
    const entityType = req.query.entityType as string | undefined;
    const breaches = await storage.getSlaBreaches(entityType);
    res.json(breaches);
  } catch (error) {
    logger.error("[Operations API] Error fetching SLA breaches", { error });
    res.status(500).json({ error: "Failed to fetch SLA breaches" });
  }
});

// GET /api/enterprise/operations/sla/metrics - Get SLA metrics
router.get("/sla/metrics", requireAdmin, async (req, res) => {
  try {
    const entityType = req.query.entityType as string | undefined;
    const metrics = await storage.getSlaMetrics(entityType);
    res.json(metrics);
  } catch (error) {
    logger.error("[Operations API] Error fetching SLA metrics", { error });
    res.status(500).json({ error: "Failed to fetch SLA metrics" });
  }
});

// GET /api/enterprise/operations/sla/:id - Get SLA tracking by ID
router.get("/sla/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tracking = await storage.getSlaTracking(id);
    
    if (!tracking) {
      return res.status(404).json({ error: "SLA tracking not found" });
    }
    
    res.json(tracking);
  } catch (error) {
    logger.error("[Operations API] Error fetching SLA tracking", { error });
    res.status(500).json({ error: "Failed to fetch SLA tracking" });
  }
});

// POST /api/enterprise/operations/sla - Create SLA tracking
router.post("/sla", requireAdmin, async (req, res) => {
  try {
    const validatedData = insertOpsSlaTrackingSchema.parse(req.body);
    const tracking = await storage.createSlaTracking(validatedData);
    
    logger.info("[Operations API] SLA tracking created", { id: tracking.id, entityType: tracking.entityType });
    res.status(201).json(tracking);
  } catch (error) {
    logger.error("[Operations API] Error creating SLA tracking", { error });
    res.status(400).json({ error: "Failed to create SLA tracking" });
  }
});

// PATCH /api/enterprise/operations/sla/:id - Update SLA tracking
router.patch("/sla/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tracking = await storage.updateSlaTracking(id, req.body);
    
    logger.info("[Operations API] SLA tracking updated", { id });
    res.json(tracking);
  } catch (error) {
    logger.error("[Operations API] Error updating SLA tracking", { error });
    
    if (error instanceof Error && error.message === "SLA tracking not found") {
      return res.status(404).json({ error: "SLA tracking not found" });
    }
    
    res.status(500).json({ error: "Failed to update SLA tracking" });
  }
});

export default router;
