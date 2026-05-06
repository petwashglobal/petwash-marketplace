import express from "express";
import { storage } from "../storage";
import { requireAdmin } from "../adminAuth";
import { z } from "zod";
import {
  insertHrEmployeeSchema,
  insertHrPayrollSchema,
  insertHrTimeTrackingSchema,
  insertHrPerformanceReviewSchema,
  insertHrRecruitmentSchema,
  insertHrJobApplicationSchema
} from "@shared/schema";
import { logAuditEvent } from "../middleware/auditLog";

/**
 * PR-W34j: every enterprise-hr admin mutation writes a hash-chained
 * audit_events row. Fire-and-forget. HR mutations include payroll —
 * the audit log is the legal record of who changed what when.
 */
function emitHrAudit(params: {
  actionType: string;
  actorUserId: string | null | undefined;
  targetType: string;
  targetId: string | number | null | undefined;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): void {
  setImmediate(() => {
    logAuditEvent({
      actorUserId: params.actorUserId ?? undefined,
      actorRole: 'admin',
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId != null ? String(params.targetId) : undefined,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: params.metadata ?? {},
    }).catch(() => {});
  });
}

const router = express.Router();

// =================== EMPLOYEES ===================

router.get("/employees", requireAdmin, async (req, res) => {
  try {
    const { filter, department } = req.query;
    let employees;
    if (filter === "active") {
      employees = await storage.getActiveEmployees();
    } else if (department) {
      employees = await storage.getEmployeesByDepartment(department as string);
    } else {
      employees = await storage.getAllEmployees();
    }
    res.json(employees);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

router.get("/employees/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const employee = await storage.getEmployeeById(id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    res.json(employee);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

router.post("/employees", requireAdmin, async (req: any, res) => {
  try {
    const validated = insertHrEmployeeSchema.parse(req.body);
    const employee = await storage.createEmployee(validated);
    emitHrAudit({
      actionType: 'HR_EMPLOYEE_CREATE',
      actorUserId: req.adminUser?.id,
      targetType: 'employee',
      targetId: (employee as any)?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { departmentId: (employee as any)?.departmentId, role: (employee as any)?.role },
    });
    res.status(201).json(employee);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    res.status(500).json({ error: "Failed to create employee" });
  }
});

router.patch("/employees/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const employee = await storage.updateEmployee(id, updates);
    emitHrAudit({
      actionType: 'HR_EMPLOYEE_UPDATE',
      actorUserId: req.adminUser?.id,
      targetType: 'employee',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { fields: Object.keys(updates || {}) },
    });
    res.json(employee);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update employee" });
  }
});

// =================== PAYROLL ===================

router.get("/payroll", requireAdmin, async (req, res) => {
  try {
    const payroll = await storage.getAllPayroll();
    res.json(payroll);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
});

router.get("/employees/:id/payroll", requireAdmin, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const payroll = await storage.getEmployeePayroll(employeeId);
    res.json(payroll);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
});

router.post("/payroll", requireAdmin, async (req: any, res) => {
  try {
    const validated = insertHrPayrollSchema.parse(req.body);
    const payroll = await storage.createPayroll(validated);
    emitHrAudit({
      actionType: 'HR_PAYROLL_CREATE',
      actorUserId: req.adminUser?.id,
      targetType: 'payroll',
      targetId: (payroll as any)?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { employeeId: (payroll as any)?.employeeId, period: (payroll as any)?.period, grossAmount: (payroll as any)?.grossAmount },
    });
    res.status(201).json(payroll);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    res.status(500).json({ error: "Failed to create payroll" });
  }
});

router.patch("/payroll/:id/status", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const payroll = await storage.updatePayrollStatus(id, status);
    emitHrAudit({
      actionType: 'HR_PAYROLL_STATUS_UPDATE',
      actorUserId: req.adminUser?.id,
      targetType: 'payroll',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { newStatus: status },
    });
    res.json(payroll);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

// =================== TIME TRACKING ===================

router.get("/employees/:id/time-tracking", requireAdmin, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const { start, end } = req.query;
    let timeEntries;
    if (start && end) {
      timeEntries = await storage.getTimeTrackingByDateRange(employeeId, start as string, end as string);
    } else {
      timeEntries = await storage.getEmployeeTimeTracking(employeeId);
    }
    res.json(timeEntries);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch time tracking" });
  }
});

router.post("/time-tracking/clock-in", requireAdmin, async (req: any, res) => {
  try {
    const validated = insertHrTimeTrackingSchema.parse(req.body);
    const entry = await storage.clockIn(validated);
    emitHrAudit({
      actionType: 'HR_TIME_CLOCK_IN',
      actorUserId: req.adminUser?.id,
      targetType: 'time_entry',
      targetId: (entry as any)?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { employeeId: (entry as any)?.employeeId },
    });
    res.status(201).json(entry);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    res.status(500).json({ error: "Failed to clock in" });
  }
});

router.patch("/time-tracking/:id/clock-out", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { clockOutTime } = req.body;
    const entry = await storage.clockOut(id, clockOutTime);
    emitHrAudit({
      actionType: 'HR_TIME_CLOCK_OUT',
      actorUserId: req.adminUser?.id,
      targetType: 'time_entry',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to clock out" });
  }
});

router.patch("/time-tracking/:id/approve", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { approvedBy } = req.body;
    const entry = await storage.approveTimeEntry(id, approvedBy);
    emitHrAudit({
      actionType: 'HR_TIME_APPROVE',
      actorUserId: req.adminUser?.id,
      targetType: 'time_entry',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { approvedBy },
    });
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to approve entry" });
  }
});

// =================== PERFORMANCE REVIEWS ===================

router.get("/performance-reviews", requireAdmin, async (req, res) => {
  try {
    const reviews = await storage.getAllPerformanceReviews();
    res.json(reviews);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch performance reviews" });
  }
});

router.get("/performance-reviews/pending", requireAdmin, async (req, res) => {
  try {
    const reviews = await storage.getPendingReviews();
    res.json(reviews);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch pending reviews" });
  }
});

router.get("/employees/:id/performance-reviews", requireAdmin, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const reviews = await storage.getEmployeeReviews(employeeId);
    res.json(reviews);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch employee reviews" });
  }
});

router.get("/performance-reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const review = await storage.getReviewById(id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch review" });
  }
});

router.post("/performance-reviews", requireAdmin, async (req: any, res) => {
  try {
    const validated = insertHrPerformanceReviewSchema.parse(req.body);
    const review = await storage.createPerformanceReview(validated);
    emitHrAudit({
      actionType: 'HR_REVIEW_CREATE',
      actorUserId: req.adminUser?.id,
      targetType: 'performance_review',
      targetId: review.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { employeeId: (review as any)?.employeeId, period: (review as any)?.period },
    });
    res.status(201).json(review);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    res.status(500).json({ error: "Failed to create performance review" });
  }
});

router.patch("/performance-reviews/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const review = await storage.updatePerformanceReview(id, req.body);
    emitHrAudit({
      actionType: 'HR_REVIEW_UPDATE',
      actorUserId: req.adminUser?.id,
      targetType: 'performance_review',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { fields: Object.keys(req.body || {}) },
    });
    res.json(review);
  } catch (error: any) {
    if (error.message === "Performance review not found") return res.status(404).json({ error: "Review not found" });
    res.status(500).json({ error: "Failed to update performance review" });
  }
});

router.patch("/performance-reviews/:id/acknowledge", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { signature } = req.body;
    const review = await storage.acknowledgeReview(id, signature);
    emitHrAudit({
      actionType: 'HR_REVIEW_ACKNOWLEDGE',
      actorUserId: req.adminUser?.id,
      targetType: 'performance_review',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { hasSignature: !!signature },
    });
    res.json(review);
  } catch (error: any) {
    if (error.message === "Performance review not found") return res.status(404).json({ error: "Review not found" });
    res.status(500).json({ error: "Failed to acknowledge review" });
  }
});

// =================== RECRUITMENT & ONBOARDING ===================

router.get("/job-openings", requireAdmin, async (req, res) => {
  try {
    const { filter } = req.query;
    let jobs;
    if (filter === "open") {
      jobs = await storage.getOpenJobOpenings();
    } else {
      jobs = await storage.getAllJobOpenings();
    }
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch job openings" });
  }
});

router.get("/job-openings/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const job = await storage.getJobOpeningById(id);
    if (!job) return res.status(404).json({ error: "Job opening not found" });
    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch job opening" });
  }
});

router.post("/job-openings", requireAdmin, async (req: any, res) => {
  try {
    const validated = insertHrRecruitmentSchema.parse(req.body);
    const job = await storage.createJobOpening(validated);
    emitHrAudit({
      actionType: 'HR_JOB_OPENING_CREATE',
      actorUserId: req.adminUser?.id,
      targetType: 'job_opening',
      targetId: job.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { title: (job as any)?.title, department: (job as any)?.department },
    });
    res.status(201).json(job);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    res.status(500).json({ error: "Failed to create job opening" });
  }
});

router.patch("/job-openings/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const job = await storage.updateJobOpening(id, req.body);
    emitHrAudit({
      actionType: 'HR_JOB_OPENING_UPDATE',
      actorUserId: req.adminUser?.id,
      targetType: 'job_opening',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { fields: Object.keys(req.body || {}) },
    });
    res.json(job);
  } catch (error: any) {
    if (error.message === "Job opening not found") return res.status(404).json({ error: "Job opening not found" });
    res.status(500).json({ error: "Failed to update job opening" });
  }
});

router.get("/applications", requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.query;
    let applications;
    if (jobId) {
      applications = await storage.getJobApplications(parseInt(jobId as string));
    } else {
      applications = await storage.getAllJobApplications();
    }
    res.json(applications);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

router.get("/applications/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const application = await storage.getJobApplicationById(id);
    if (!application) return res.status(404).json({ error: "Application not found" });
    res.json(application);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

router.post("/applications", requireAdmin, async (req: any, res) => {
  try {
    const validated = insertHrJobApplicationSchema.parse(req.body);
    const application = await storage.createJobApplication(validated);
    emitHrAudit({
      actionType: 'HR_APPLICATION_CREATE',
      actorUserId: req.adminUser?.id,
      targetType: 'job_application',
      targetId: application.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { jobId: (application as any)?.jobId },
    });
    res.status(201).json(application);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: error.errors });
    res.status(500).json({ error: "Failed to create application" });
  }
});

router.patch("/applications/:id/status", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, ...updates } = req.body;
    const application = await storage.updateJobApplicationStatus(id, status, updates);
    emitHrAudit({
      actionType: 'HR_APPLICATION_STATUS_UPDATE',
      actorUserId: req.adminUser?.id,
      targetType: 'job_application',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { newStatus: status, fields: Object.keys(updates || {}) },
    });
    res.json(application);
  } catch (error: any) {
    if (error.message === "Application not found") return res.status(404).json({ error: "Application not found" });
    res.status(500).json({ error: "Failed to update application status" });
  }
});

export default router;
