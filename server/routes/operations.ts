import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../customAuth";
import { 
  loadEmployeeContext, 
  requireFranchiseScope, 
  getFranchiseFilter,
  canAccessFranchise,
  type FranchiseAuthRequest 
} from "../middleware/franchiseAuth";
import { db } from "../db";
import { opsTasksTable, opsIncidents, insertOpsTaskSchema, insertOpsIncidentSchema } from "@shared/schema-operations";
import { eq, and, sql, inArray, desc, asc, gte, lte } from "drizzle-orm";

const router = Router();

// Whitelisted sort fields for tasks (prevents schema inference attacks)
const TASK_SORT_FIELDS = [
  "id", "taskId", "title", "priority", "category", "status", 
  "dueDate", "createdAt", "updatedAt", "escalationLevel"
] as const;

// Whitelisted sort fields for incidents
const INCIDENT_SORT_FIELDS = [
  "id", "incidentId", "title", "severity", "category", "status",
  "priority", "reportedAt", "resolvedAt", "escalationLevel", "slaBreach"
] as const;

// Apply authentication and franchise context to all routes
router.use(requireAuth);
router.use(loadEmployeeContext);
router.use(requireFranchiseScope);

// ===================== TASK ROUTES =====================

// List tasks with global filters and franchise scoping
router.get("/tasks", async (req: FranchiseAuthRequest, res) => {
  try {
    const filters: any[] = [];
    
    // CRITICAL: Enforce franchise scoping
    const franchiseFilter = getFranchiseFilter(req.employee!);
    if (franchiseFilter !== null) {
      filters.push(eq(opsTasksTable.franchiseId, franchiseFilter));
    }
    
    // Additional filters (only if allowed by franchise scope)
    if (req.query.franchiseId && franchiseFilter === null) {
      // Only corporate HQ can filter by specific franchiseId
      filters.push(eq(opsTasksTable.franchiseId, parseInt(req.query.franchiseId as string)));
    }
    if (req.query.region) {
      filters.push(eq(opsTasksTable.region, req.query.region as string));
    }
    if (req.query.country) {
      filters.push(eq(opsTasksTable.country, req.query.country as string));
    }
    if (req.query.status) {
      filters.push(eq(opsTasksTable.status, req.query.status as string));
    }
    if (req.query.priority) {
      filters.push(eq(opsTasksTable.priority, req.query.priority as string));
    }
    if (req.query.escalationLevel) {
      filters.push(eq(opsTasksTable.escalationLevel, parseInt(req.query.escalationLevel as string)));
    }
    if (req.query.assignedTo) {
      filters.push(eq(opsTasksTable.assignedTo, parseInt(req.query.assignedTo as string)));
    }
    if (req.query.stationId) {
      filters.push(eq(opsTasksTable.stationId, req.query.stationId as string));
    }

    // Date range filters
    if (req.query.dueDateFrom) {
      filters.push(gte(opsTasksTable.dueDate, new Date(req.query.dueDateFrom as string)));
    }
    if (req.query.dueDateTo) {
      filters.push(lte(opsTasksTable.dueDate, new Date(req.query.dueDateTo as string)));
    }

    // Pagination
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
    const offset = parseInt(req.query.offset as string || "0");

    // Whitelisted sorting (prevents schema inference)
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) || "desc";
    
    if (!TASK_SORT_FIELDS.includes(sortBy as any)) {
      return res.status(400).json({ 
        error: "Invalid sortBy field",
        allowed: TASK_SORT_FIELDS 
      });
    }
    
    const sortColumn = (opsTasksTable as any)[sortBy];

    const tasks = await db
      .select()
      .from(opsTasksTable)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(opsTasksTable)
      .where(filters.length > 0 ? and(...filters) : undefined);

    return res.json({
      tasks,
      total: Number(countResult.count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Get task by ID with franchise authorization
router.get("/tasks/:id", async (req: FranchiseAuthRequest, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const [task] = await db
      .select()
      .from(opsTasksTable)
      .where(eq(opsTasksTable.id, taskId));

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check franchise authorization
    if (!canAccessFranchise(req.employee!, task.franchiseId)) {
      return res.status(403).json({ error: "Access denied to this franchise's data" });
    }

    return res.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return res.status(500).json({ error: "Failed to fetch task" });
  }
});

// Create task with franchise scoping
router.post("/tasks", async (req: FranchiseAuthRequest, res) => {
  try {
    const validated = insertOpsTaskSchema.parse(req.body);
    
    // Enforce franchise scoping
    const franchiseFilter = getFranchiseFilter(req.employee!);
    if (franchiseFilter !== null && validated.franchiseId !== franchiseFilter) {
      return res.status(403).json({ 
        error: "You can only create tasks for your own franchise" 
      });
    }
    
    const [task] = await db
      .insert(opsTasksTable)
      .values({
        ...validated,
        createdBy: req.employee!.id,
        franchiseId: validated.franchiseId || franchiseFilter,
      })
      .returning();

    return res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating task:", error);
    return res.status(500).json({ error: "Failed to create task" });
  }
});

// Update task with franchise authorization and audit trail
router.patch("/tasks/:id", async (req: FranchiseAuthRequest, res) => {
  try {
    const taskId = parseInt(req.params.id);
    
    // Get existing task for authorization and audit trail
    const [existingTask] = await db
      .select()
      .from(opsTasksTable)
      .where(eq(opsTasksTable.id, taskId));

    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check franchise authorization
    if (!canAccessFranchise(req.employee!, existingTask.franchiseId)) {
      return res.status(403).json({ error: "Access denied to this franchise's data" });
    }

    // Validate update payload
    const updateSchema = insertOpsTaskSchema.partial();
    const validated = updateSchema.parse(req.body);

    // Prevent franchise escalation
    if (validated.franchiseId && validated.franchiseId !== existingTask.franchiseId) {
      const franchiseFilter = getFranchiseFilter(req.employee!);
      if (franchiseFilter !== null) {
        return res.status(403).json({ 
          error: "You cannot move tasks to another franchise" 
        });
      }
    }

    // Build action log entry (append, don't overwrite)
    const actionLogEntry = {
      action: "update",
      by: req.employee!.id,
      at: new Date().toISOString(),
      details: {
        changed: Object.keys(validated),
        previous: Object.fromEntries(
          Object.keys(validated).map(key => [key, (existingTask as any)[key]])
        ),
      },
    };

    const currentActionLog = (existingTask.actionLog as any[]) || [];
    const updatedActionLog = [...currentActionLog, actionLogEntry];

    const [task] = await db
      .update(opsTasksTable)
      .set({
        ...validated,
        modifiedBy: req.employee!.id,
        actionLog: updatedActionLog,
        updatedAt: new Date(),
      })
      .where(eq(opsTasksTable.id, taskId))
      .returning();

    return res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error updating task:", error);
    return res.status(500).json({ error: "Failed to update task" });
  }
});

// Escalate task with franchise authorization
router.post("/tasks/:id/escalate", async (req: FranchiseAuthRequest, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const escalateSchema = z.object({
      escalatedTo: z.number(),
      escalationReason: z.string(),
      escalationLevel: z.number().min(1).max(5),
    });

    const validated = escalateSchema.parse(req.body);

    // Get existing task
    const [existingTask] = await db
      .select()
      .from(opsTasksTable)
      .where(eq(opsTasksTable.id, taskId));

    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check franchise authorization
    if (!canAccessFranchise(req.employee!, existingTask.franchiseId)) {
      return res.status(403).json({ error: "Access denied to this franchise's data" });
    }

    // Build escalation history entry (append, don't overwrite)
    const escalationEntry = {
      level: validated.escalationLevel,
      to: validated.escalatedTo,
      at: new Date().toISOString(),
      reason: validated.escalationReason,
      by: req.employee!.id,
    };

    const currentEscalationHistory = (existingTask.escalationHistory as any[]) || [];
    const updatedEscalationHistory = [...currentEscalationHistory, escalationEntry];

    // Build action log entry (append, don't overwrite)
    const actionLogEntry = {
      action: "escalate",
      by: req.employee!.id,
      at: new Date().toISOString(),
      details: {
        level: validated.escalationLevel,
        to: validated.escalatedTo,
        reason: validated.escalationReason,
      },
    };

    const currentActionLog = (existingTask.actionLog as any[]) || [];
    const updatedActionLog = [...currentActionLog, actionLogEntry];

    const [task] = await db
      .update(opsTasksTable)
      .set({
        escalationLevel: validated.escalationLevel,
        escalatedTo: validated.escalatedTo,
        escalatedAt: new Date(),
        escalationReason: validated.escalationReason,
        escalationHistory: updatedEscalationHistory,
        actionLog: updatedActionLog,
        status: "escalated",
        modifiedBy: req.employee!.id,
        updatedAt: new Date(),
      })
      .where(eq(opsTasksTable.id, taskId))
      .returning();

    return res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error escalating task:", error);
    return res.status(500).json({ error: "Failed to escalate task" });
  }
});

// Bulk create tasks with franchise scoping
router.post("/tasks/bulk", async (req: FranchiseAuthRequest, res) => {
  try {
    const bulkSchema = z.object({
      tasks: z.array(insertOpsTaskSchema).max(50),
    });

    const validated = bulkSchema.parse(req.body);

    // Enforce franchise scoping on all tasks
    const franchiseFilter = getFranchiseFilter(req.employee!);
    const tasks = validated.tasks.map(task => {
      if (franchiseFilter !== null && task.franchiseId !== franchiseFilter) {
        throw new Error("You can only create tasks for your own franchise");
      }
      return {
        ...task,
        createdBy: req.employee!.id,
        franchiseId: task.franchiseId || franchiseFilter,
      };
    });

    const createdTasks = await db
      .insert(opsTasksTable)
      .values(tasks)
      .returning();

    return res.status(201).json({ tasks: createdTasks, count: createdTasks.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error bulk creating tasks:", error);
    return res.status(500).json({ error: "Failed to bulk create tasks" });
  }
});

// Bulk update tasks with per-record authorization and audit appending
router.patch("/tasks/bulk", async (req: FranchiseAuthRequest, res) => {
  try {
    const bulkUpdateSchema = z.object({
      ids: z.array(z.number()).max(50),
      updates: insertOpsTaskSchema.partial(),
    });

    const validated = bulkUpdateSchema.parse(req.body);

    // Fetch all existing tasks for authorization and audit trail
    const existingTasks = await db
      .select()
      .from(opsTasksTable)
      .where(inArray(opsTasksTable.id, validated.ids));

    // Check franchise authorization for each task
    for (const task of existingTasks) {
      if (!canAccessFranchise(req.employee!, task.franchiseId)) {
        return res.status(403).json({ 
          error: `Access denied to task ${task.taskId} from another franchise` 
        });
      }
    }

    // Build audit log entry for bulk update
    const actionLogEntry = {
      action: "bulk_update",
      by: req.employee!.id,
      at: new Date().toISOString(),
      details: {
        changed: Object.keys(validated.updates),
        taskCount: validated.ids.length,
      },
    };

    // Update each task individually to properly append audit logs
    const updatedTasks = [];
    for (const existingTask of existingTasks) {
      const currentActionLog = (existingTask.actionLog as any[]) || [];
      const updatedActionLog = [...currentActionLog, actionLogEntry];

      const [updated] = await db
        .update(opsTasksTable)
        .set({
          ...validated.updates,
          modifiedBy: req.employee!.id,
          actionLog: updatedActionLog,
          updatedAt: new Date(),
        })
        .where(eq(opsTasksTable.id, existingTask.id))
        .returning();

      updatedTasks.push(updated);
    }

    return res.json({ tasks: updatedTasks, count: updatedTasks.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error bulk updating tasks:", error);
    return res.status(500).json({ error: "Failed to bulk update tasks" });
  }
});

// ===================== INCIDENT ROUTES =====================

// List incidents with global filters and franchise scoping
router.get("/incidents", async (req: FranchiseAuthRequest, res) => {
  try {
    const filters: any[] = [];
    
    // CRITICAL: Enforce franchise scoping
    const franchiseFilter = getFranchiseFilter(req.employee!);
    if (franchiseFilter !== null) {
      filters.push(eq(opsIncidents.franchiseId, franchiseFilter));
    }
    
    // Additional filters (only if allowed by franchise scope)
    if (req.query.franchiseId && franchiseFilter === null) {
      filters.push(eq(opsIncidents.franchiseId, parseInt(req.query.franchiseId as string)));
    }
    if (req.query.region) {
      filters.push(eq(opsIncidents.region, req.query.region as string));
    }
    if (req.query.country) {
      filters.push(eq(opsIncidents.country, req.query.country as string));
    }
    if (req.query.status) {
      filters.push(eq(opsIncidents.status, req.query.status as string));
    }
    if (req.query.severity) {
      filters.push(eq(opsIncidents.severity, req.query.severity as string));
    }
    if (req.query.escalationLevel) {
      filters.push(eq(opsIncidents.escalationLevel, parseInt(req.query.escalationLevel as string)));
    }
    if (req.query.assignedTo) {
      filters.push(eq(opsIncidents.assignedTo, parseInt(req.query.assignedTo as string)));
    }
    if (req.query.stationId) {
      filters.push(eq(opsIncidents.stationId, req.query.stationId as string));
    }
    if (req.query.slaBreach === "true") {
      filters.push(eq(opsIncidents.slaBreach, true));
    }

    // Pagination
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
    const offset = parseInt(req.query.offset as string || "0");

    // Whitelisted sorting (prevents schema inference)
    const sortBy = (req.query.sortBy as string) || "reportedAt";
    const sortOrder = (req.query.sortOrder as string) || "desc";
    
    if (!INCIDENT_SORT_FIELDS.includes(sortBy as any)) {
      return res.status(400).json({ 
        error: "Invalid sortBy field",
        allowed: INCIDENT_SORT_FIELDS 
      });
    }
    
    const sortColumn = (opsIncidents as any)[sortBy];

    const incidents = await db
      .select()
      .from(opsIncidents)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(opsIncidents)
      .where(filters.length > 0 ? and(...filters) : undefined);

    return res.json({
      incidents,
      total: Number(countResult.count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

// Get incident by ID with franchise authorization
router.get("/incidents/:id", async (req: FranchiseAuthRequest, res) => {
  try {
    const incidentId = parseInt(req.params.id);
    const [incident] = await db
      .select()
      .from(opsIncidents)
      .where(eq(opsIncidents.id, incidentId));

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    // Check franchise authorization
    if (!canAccessFranchise(req.employee!, incident.franchiseId)) {
      return res.status(403).json({ error: "Access denied to this franchise's data" });
    }

    return res.json(incident);
  } catch (error) {
    console.error("Error fetching incident:", error);
    return res.status(500).json({ error: "Failed to fetch incident" });
  }
});

// Create incident with franchise scoping
router.post("/incidents", async (req: FranchiseAuthRequest, res) => {
  try {
    const validated = insertOpsIncidentSchema.parse(req.body);
    
    // Enforce franchise scoping
    const franchiseFilter = getFranchiseFilter(req.employee!);
    if (franchiseFilter !== null && validated.franchiseId !== franchiseFilter) {
      return res.status(403).json({ 
        error: "You can only create incidents for your own franchise" 
      });
    }
    
    const [incident] = await db
      .insert(opsIncidents)
      .values({
        ...validated,
        reportedBy: req.employee!.id,
        franchiseId: validated.franchiseId || franchiseFilter,
      })
      .returning();

    return res.status(201).json(incident);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating incident:", error);
    return res.status(500).json({ error: "Failed to create incident" });
  }
});

// Update incident with franchise authorization and audit trail
router.patch("/incidents/:id", async (req: FranchiseAuthRequest, res) => {
  try {
    const incidentId = parseInt(req.params.id);
    
    // Get existing incident for authorization and audit trail
    const [existingIncident] = await db
      .select()
      .from(opsIncidents)
      .where(eq(opsIncidents.id, incidentId));

    if (!existingIncident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    // Check franchise authorization
    if (!canAccessFranchise(req.employee!, existingIncident.franchiseId)) {
      return res.status(403).json({ error: "Access denied to this franchise's data" });
    }

    // Validate update payload
    const updateSchema = insertOpsIncidentSchema.partial();
    const validated = updateSchema.parse(req.body);

    // Prevent franchise escalation
    if (validated.franchiseId && validated.franchiseId !== existingIncident.franchiseId) {
      const franchiseFilter = getFranchiseFilter(req.employee!);
      if (franchiseFilter !== null) {
        return res.status(403).json({ 
          error: "You cannot move incidents to another franchise" 
        });
      }
    }

    // Build action log entry (append, don't overwrite)
    const actionLogEntry = {
      action: "update",
      by: req.employee!.id,
      at: new Date().toISOString(),
      details: {
        changed: Object.keys(validated),
        previous: Object.fromEntries(
          Object.keys(validated).map(key => [key, (existingIncident as any)[key]])
        ),
      },
    };

    const currentActionLog = (existingIncident.actionLog as any[]) || [];
    const updatedActionLog = [...currentActionLog, actionLogEntry];

    const [incident] = await db
      .update(opsIncidents)
      .set({
        ...validated,
        modifiedBy: req.employee!.id,
        actionLog: updatedActionLog,
        updatedAt: new Date(),
      })
      .where(eq(opsIncidents.id, incidentId))
      .returning();

    return res.json(incident);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error updating incident:", error);
    return res.status(500).json({ error: "Failed to update incident" });
  }
});

// Escalate incident with franchise authorization
router.post("/incidents/:id/escalate", async (req: FranchiseAuthRequest, res) => {
  try {
    const incidentId = parseInt(req.params.id);
    const escalateSchema = z.object({
      escalatedTo: z.number(),
      escalationReason: z.string(),
      escalationLevel: z.number().min(1).max(5),
    });

    const validated = escalateSchema.parse(req.body);

    // Get existing incident
    const [existingIncident] = await db
      .select()
      .from(opsIncidents)
      .where(eq(opsIncidents.id, incidentId));

    if (!existingIncident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    // Check franchise authorization
    if (!canAccessFranchise(req.employee!, existingIncident.franchiseId)) {
      return res.status(403).json({ error: "Access denied to this franchise's data" });
    }

    // Build escalation history entry (append, don't overwrite)
    const escalationEntry = {
      level: validated.escalationLevel,
      to: validated.escalatedTo,
      at: new Date().toISOString(),
      reason: validated.escalationReason,
      by: req.employee!.id,
    };

    const currentEscalationHistory = (existingIncident.escalationHistory as any[]) || [];
    const updatedEscalationHistory = [...currentEscalationHistory, escalationEntry];

    // Build action log entry (append, don't overwrite)
    const actionLogEntry = {
      action: "escalate",
      by: req.employee!.id,
      at: new Date().toISOString(),
      details: {
        level: validated.escalationLevel,
        to: validated.escalatedTo,
        reason: validated.escalationReason,
      },
    };

    const currentActionLog = (existingIncident.actionLog as any[]) || [];
    const updatedActionLog = [...currentActionLog, actionLogEntry];

    const [incident] = await db
      .update(opsIncidents)
      .set({
        escalationLevel: validated.escalationLevel,
        escalatedTo: validated.escalatedTo,
        escalatedAt: new Date(),
        escalationReason: validated.escalationReason,
        escalationHistory: updatedEscalationHistory,
        actionLog: updatedActionLog,
        status: "escalated",
        modifiedBy: req.employee!.id,
        updatedAt: new Date(),
      })
      .where(eq(opsIncidents.id, incidentId))
      .returning();

    return res.json(incident);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error escalating incident:", error);
    return res.status(500).json({ error: "Failed to escalate incident" });
  }
});

// Bulk create incidents with franchise scoping
router.post("/incidents/bulk", async (req: FranchiseAuthRequest, res) => {
  try {
    const bulkSchema = z.object({
      incidents: z.array(insertOpsIncidentSchema).max(50),
    });

    const validated = bulkSchema.parse(req.body);

    // Enforce franchise scoping on all incidents
    const franchiseFilter = getFranchiseFilter(req.employee!);
    const incidents = validated.incidents.map(incident => {
      if (franchiseFilter !== null && incident.franchiseId !== franchiseFilter) {
        throw new Error("You can only create incidents for your own franchise");
      }
      return {
        ...incident,
        reportedBy: req.employee!.id,
        franchiseId: incident.franchiseId || franchiseFilter,
      };
    });

    const createdIncidents = await db
      .insert(opsIncidents)
      .values(incidents)
      .returning();

    return res.status(201).json({ incidents: createdIncidents, count: createdIncidents.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error bulk creating incidents:", error);
    return res.status(500).json({ error: "Failed to bulk create incidents" });
  }
});

// Bulk update incidents with per-record authorization and audit appending
router.patch("/incidents/bulk", async (req: FranchiseAuthRequest, res) => {
  try {
    const bulkUpdateSchema = z.object({
      ids: z.array(z.number()).max(50),
      updates: insertOpsIncidentSchema.partial(),
    });

    const validated = bulkUpdateSchema.parse(req.body);

    // Fetch all existing incidents for authorization and audit trail
    const existingIncidents = await db
      .select()
      .from(opsIncidents)
      .where(inArray(opsIncidents.id, validated.ids));

    // Check franchise authorization for each incident
    for (const incident of existingIncidents) {
      if (!canAccessFranchise(req.employee!, incident.franchiseId)) {
        return res.status(403).json({ 
          error: `Access denied to incident ${incident.incidentId} from another franchise` 
        });
      }
    }

    // Build audit log entry for bulk update
    const actionLogEntry = {
      action: "bulk_update",
      by: req.employee!.id,
      at: new Date().toISOString(),
      details: {
        changed: Object.keys(validated.updates),
        incidentCount: validated.ids.length,
      },
    };

    // Update each incident individually to properly append audit logs
    const updatedIncidents = [];
    for (const existingIncident of existingIncidents) {
      const currentActionLog = (existingIncident.actionLog as any[]) || [];
      const updatedActionLog = [...currentActionLog, actionLogEntry];

      const [updated] = await db
        .update(opsIncidents)
        .set({
          ...validated.updates,
          modifiedBy: req.employee!.id,
          actionLog: updatedActionLog,
          updatedAt: new Date(),
        })
        .where(eq(opsIncidents.id, existingIncident.id))
        .returning();

      updatedIncidents.push(updated);
    }

    return res.json({ incidents: updatedIncidents, count: updatedIncidents.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error bulk updating incidents:", error);
    return res.status(500).json({ error: "Failed to bulk update incidents" });
  }
});

export default router;
