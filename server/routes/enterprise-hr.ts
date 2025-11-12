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

const router = express.Router();

// =================== EMPLOYEES ===================

// GET /api/enterprise/hr/employees - Get all employees
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
    console.error("[Enterprise HR] Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// GET /api/enterprise/hr/employees/:id - Get employee by ID
router.get("/employees/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const employee = await storage.getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json(employee);
  } catch (error: any) {
    console.error("[Enterprise HR] Error fetching employee:", error);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

// POST /api/enterprise/hr/employees - Create new employee
router.post("/employees", requireAdmin, async (req, res) => {
  try {
    const validated = insertHrEmployeeSchema.parse(req.body);
    const employee = await storage.createEmployee(validated);
    res.status(201).json(employee);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise HR] Error creating employee:", error);
    res.status(500).json({ error: "Failed to create employee" });
  }
});

// PATCH /api/enterprise/hr/employees/:id - Update employee
router.patch("/employees/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const employee = await storage.updateEmployee(id, updates);
    res.json(employee);
  } catch (error: any) {
    console.error("[Enterprise HR] Error updating employee:", error);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

// =================== PAYROLL ===================

// GET /api/enterprise/hr/payroll - Get all payroll records
router.get("/payroll", requireAdmin, async (req, res) => {
  try {
    const payroll = await storage.getAllPayroll();
    res.json(payroll);
  } catch (error: any) {
    console.error("[Enterprise HR] Error fetching payroll:", error);
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
});

// GET /api/enterprise/hr/employees/:id/payroll - Get employee payroll
router.get("/employees/:id/payroll", requireAdmin, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const payroll = await storage.getEmployeePayroll(employeeId);
    res.json(payroll);
  } catch (error: any) {
    console.error("[Enterprise HR] Error fetching employee payroll:", error);
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
});

// POST /api/enterprise/hr/payroll - Create payroll record
router.post("/payroll", requireAdmin, async (req, res) => {
  try {
    const validated = insertHrPayrollSchema.parse(req.body);
    const payroll = await storage.createPayroll(validated);
    res.status(201).json(payroll);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise HR] Error creating payroll:", error);
    res.status(500).json({ error: "Failed to create payroll" });
  }
});

// PATCH /api/enterprise/hr/payroll/:id/status - Update payroll status
router.patch("/payroll/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const payroll = await storage.updatePayrollStatus(id, status);
    res.json(payroll);
  } catch (error: any) {
    console.error("[Enterprise HR] Error updating payroll status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// =================== TIME TRACKING ===================

// GET /api/enterprise/hr/employees/:id/time-tracking - Get employee time entries
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
    console.error("[Enterprise HR] Error fetching time tracking:", error);
    res.status(500).json({ error: "Failed to fetch time tracking" });
  }
});

// POST /api/enterprise/hr/time-tracking/clock-in - Clock in
router.post("/time-tracking/clock-in", requireAdmin, async (req, res) => {
  try {
    const validated = insertHrTimeTrackingSchema.parse(req.body);
    const entry = await storage.clockIn(validated);
    res.status(201).json(entry);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise HR] Error clocking in:", error);
    res.status(500).json({ error: "Failed to clock in" });
  }
});

// PATCH /api/enterprise/hr/time-tracking/:id/clock-out - Clock out
router.patch("/time-tracking/:id/clock-out", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { clockOutTime } = req.body;
    const entry = await storage.clockOut(id, clockOutTime);
    res.json(entry);
  } catch (error: any) {
    console.error("[Enterprise HR] Error clocking out:", error);
    res.status(500).json({ error: "Failed to clock out" });
  }
});

// PATCH /api/enterprise/hr/time-tracking/:id/approve - Approve time entry
router.patch("/time-tracking/:id/approve", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { approvedBy } = req.body;
    const entry = await storage.approveTimeEntry(id, approvedBy);
    res.json(entry);
  } catch (error: any) {
    console.error("[Enterprise HR] Error approving time entry:", error);
    res.status(500).json({ error: "Failed to approve entry" });
  }
});

// =================== PERFORMANCE REVIEWS ===================

// GET /api/enterprise/hr/performance-reviews - Get all performance reviews
router.get("/performance-reviews", requireAdmin, async (req, res) => {
  try {
    const reviews = await storage.getAllPerformanceReviews();
    res.json(reviews);
  } catch (error: any) {
    console.error("[Enterprise HR] Error fetching performance reviews:", error);
    res.status(500).json({ error: "Failed to fetch performance reviews" });
  }
});

// GET /api/enterprise/hr/performance-reviews/pending - Get pending reviews
router.get("/performance-reviews/pending", requireAdmin, async (req, res) => {
  try {
    const reviews = await storage.getPendingReviews();
    res.json(reviews);
  } catch (error: any) {
    console.error("[Enterprise HR] Error fetching pending reviews:", error);
    res.status(500).json({ error: "Failed to fetch pending reviews" });
  }
});

// GET /api/enterprise/hr/employees/:id/performance-reviews - Get employee reviews
router.get("/employees/:id/performance-reviews", requireAdmin, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const reviews = await storage.getEmployeeReviews(employeeId);
    res.json(reviews);
  } catch (error: any) {
    console.error("[Enterprise HR] Error fetching employee reviews:", error);
    res.status(500).json({ error: "Failed to fetch employee reviews" });
  }
});

// GET /api/enterprise/hr/performance-reviews/:id - Get specific review
router.get("/performance-reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const review = await storage.getReviewById(id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }
    res.json(review);
  } catch (error: any) {
    console.error("[Enterprise HR] Error fetching review:", error);
    res.status(500).json({ error: "Failed to fetch review" });
  }
});

// POST /api/enterprise/hr/performance-reviews - Create performance review
router.post("/performance-reviews", requireAdmin, async (req, res) => {
  try {
    const validated = insertHrPerformanceReviewSchema.parse(req.body);
    const review = await storage.createPerformanceReview(validated);
    console.log("[Enterprise HR] Performance review created", { reviewId: review.id });
    res.status(201).json(review);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise HR] Error creating performance review:", error);
    res.status(500).json({ error: "Failed to create performance review" });
  }
});

// PATCH /api/enterprise/hr/performance-reviews/:id - Update performance review
router.patch("/performance-reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const review = await storage.updatePerformanceReview(id, req.body);
    console.log("[Enterprise HR] Performance review updated", { reviewId: review.id });
    res.json(review);
  } catch (error: any) {
    if (error.message === "Performance review not found") {
      return res.status(404).json({ error: "Review not found" });
    }
    console.error("[Enterprise HR] Error updating performance review:", error);
    res.status(500).json({ error: "Failed to update performance review" });
  }
});

// PATCH /api/enterprise/hr/performance-reviews/:id/acknowledge - Acknowledge review
router.patch("/performance-reviews/:id/acknowledge", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { signature } = req.body;
    const review = await storage.acknowledgeReview(id, signature);
    console.log("[Enterprise HR] Performance review acknowledged", { reviewId: review.id });
    res.json(review);
  } catch (error: any) {
    if (error.message === "Performance review not found") {
      return res.status(404).json({ error: "Review not found" });
    }
    console.error("[Enterprise HR] Error acknowledging review:", error);
    res.status(500).json({ error: "Failed to acknowledge review" });
  }
});

// =================== RECRUITMENT & ONBOARDING ===================

// GET /api/enterprise/hr/job-openings - Get all job openings
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
    console.error("[Enterprise HR] Error fetching job openings:", error);
    res.status(500).json({ error: "Failed to fetch job openings" });
  }
});

// GET /api/enterprise/hr/job-openings/:id - Get specific job opening
router.get("/job-openings/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const job = await storage.getJobOpeningById(id);
    if (!job) {
      return res.status(404).json({ error: "Job opening not found" });
    }
    res.json(job);
  } catch (error: any) {
    console.error("[Enterprise HR] Error fetching job opening:", error);
    res.status(500).json({ error: "Failed to fetch job opening" });
  }
});

// POST /api/enterprise/hr/job-openings - Create job opening
router.post("/job-openings", requireAdmin, async (req, res) => {
  try {
    const validated = insertHrRecruitmentSchema.parse(req.body);
    const job = await storage.createJobOpening(validated);
    console.log("[Enterprise HR] Job opening created", { jobId: job.id });
    res.status(201).json(job);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise HR] Error creating job opening:", error);
    res.status(500).json({ error: "Failed to create job opening" });
  }
});

// PATCH /api/enterprise/hr/job-openings/:id - Update job opening
router.patch("/job-openings/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const job = await storage.updateJobOpening(id, req.body);
    console.log("[Enterprise HR] Job opening updated", { jobId: job.id });
    res.json(job);
  } catch (error: any) {
    if (error.message === "Job opening not found") {
      return res.status(404).json({ error: "Job opening not found" });
    }
    console.error("[Enterprise HR] Error updating job opening:", error);
    res.status(500).json({ error: "Failed to update job opening" });
  }
});

// GET /api/enterprise/hr/applications - Get all applications
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
    console.error("[Enterprise HR] Error fetching applications:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// GET /api/enterprise/hr/applications/:id - Get specific application
router.get("/applications/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const application = await storage.getJobApplicationById(id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }
    res.json(application);
  } catch (error: any) {
    console.error("[Enterprise HR] Error fetching application:", error);
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

// POST /api/enterprise/hr/applications - Create job application
router.post("/applications", requireAdmin, async (req, res) => {
  try {
    const validated = insertHrJobApplicationSchema.parse(req.body);
    const application = await storage.createJobApplication(validated);
    console.log("[Enterprise HR] Application created", { applicationId: application.id });
    res.status(201).json(application);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("[Enterprise HR] Error creating application:", error);
    res.status(500).json({ error: "Failed to create application" });
  }
});

// PATCH /api/enterprise/hr/applications/:id/status - Update application status
router.patch("/applications/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, ...updates } = req.body;
    const application = await storage.updateJobApplicationStatus(id, status, updates);
    console.log("[Enterprise HR] Application status updated", { applicationId: application.id, status });
    res.json(application);
  } catch (error: any) {
    if (error.message === "Application not found") {
      return res.status(404).json({ error: "Application not found" });
    }
    console.error("[Enterprise HR] Error updating application status:", error);
    res.status(500).json({ error: "Failed to update application status" });
  }
});

export default router;
