import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  integer,
  decimal,
  boolean,
  serial,
  date,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { franchisees } from "./schema-franchise";

// =================== HR DEPARTMENT ===================

export const hrEmployees = pgTable("hr_employees", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id").unique().notNull(), // EMP-2025-0001
  firebaseUid: varchar("firebase_uid").unique(),
  
  // Franchise linkage for multi-tenant authorization (NULL for corporate HQ employees)
  franchiseId: integer("franchise_id"), // FK to franchisees.id
  role: varchar("role").default("employee"), // admin, manager, employee, viewer
  permissions: jsonb("permissions"), // Array of permission strings for fine-grained access
  
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone"),
  personalId: varchar("personal_id"), // National ID / SSN (encrypted)
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender"),
  nationality: varchar("nationality"),
  address: text("address"),
  emergencyContact: jsonb("emergency_contact"), // {name, phone, relationship}
  department: varchar("department").notNull(), // HR, Sales, Operations, Logistics, Accounts, IT
  position: varchar("position").notNull(),
  employmentType: varchar("employment_type").notNull(), // full_time, part_time, contractor, intern
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  managerId: integer("manager_id"), // Self-referencing for hierarchy
  salary: decimal("salary", { precision: 10, scale: 2 }), // encrypted
  salaryCurrency: varchar("salary_currency").default("ILS"),
  paymentFrequency: varchar("payment_frequency").default("monthly"), // monthly, biweekly, weekly
  bankAccountDetails: jsonb("bank_account_details"), // encrypted
  taxDetails: jsonb("tax_details"), // tax number, exemptions
  socialInsuranceNumber: varchar("social_insurance_number"), // encrypted
  isActive: boolean("is_active").default(true),
  photoUrl: varchar("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeIdIdx: uniqueIndex("idx_hr_employees_id").on(table.employeeId),
  emailIdx: index("idx_hr_employees_email").on(table.email),
  firebaseUidIdx: index("idx_hr_employees_firebase_uid").on(table.firebaseUid),
  franchiseIdx: index("idx_hr_employees_franchise").on(table.franchiseId),
  roleIdx: index("idx_hr_employees_role").on(table.role),
  departmentIdx: index("idx_hr_employees_department").on(table.department),
  activeIdx: index("idx_hr_employees_active").on(table.isActive),
  managerIdx: index("idx_hr_employees_manager").on(table.managerId),
  
  // Foreign Key Constraint
  franchiseFk: foreignKey({
    columns: [table.franchiseId],
    foreignColumns: [franchisees.id],
    name: "fk_hr_employees_franchise"
  }),
}));

export const hrPayroll = pgTable("hr_payroll", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => hrEmployees.id).notNull(),
  payPeriodStart: date("pay_period_start").notNull(),
  payPeriodEnd: date("pay_period_end").notNull(),
  grossSalary: decimal("gross_salary", { precision: 10, scale: 2 }).notNull(),
  bonuses: decimal("bonuses", { precision: 10, scale: 2 }).default("0"),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).default("0"),
  taxWithheld: decimal("tax_withheld", { precision: 10, scale: 2 }).default("0"),
  socialInsurance: decimal("social_insurance", { precision: 10, scale: 2 }).default("0"),
  netSalary: decimal("net_salary", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  paymentStatus: varchar("payment_status").default("pending"), // pending, processed, paid, failed
  paymentDate: date("payment_date"),
  paymentMethod: varchar("payment_method"), // bank_transfer, check, cash
  payslipUrl: text("payslip_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_payroll_employee").on(table.employeeId),
  periodIdx: index("idx_payroll_period").on(table.payPeriodStart, table.payPeriodEnd),
  statusIdx: index("idx_payroll_status").on(table.paymentStatus),
}));

export const hrPerformanceReviews = pgTable("hr_performance_reviews", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => hrEmployees.id).notNull(),
  reviewerId: integer("reviewer_id").references(() => hrEmployees.id).notNull(),
  reviewPeriod: varchar("review_period").notNull(), // Q1 2025, Annual 2025
  reviewDate: date("review_date").notNull(),
  overallRating: decimal("overall_rating", { precision: 2, scale: 1 }).notNull(), // 1-5
  performanceGoals: jsonb("performance_goals"), // array of {goal, status, notes}
  strengths: text("strengths"),
  areasForImprovement: text("areas_for_improvement"),
  developmentPlan: text("development_plan"),
  promotionRecommended: boolean("promotion_recommended").default(false),
  raiseRecommended: boolean("raise_recommended").default(false),
  recommendedRaisePercent: decimal("recommended_raise_percent", { precision: 5, scale: 2 }),
  status: varchar("status").default("draft"), // draft, completed, acknowledged, archived
  employeeSignature: text("employee_signature"), // digital signature
  reviewerSignature: text("reviewer_signature"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_reviews_employee").on(table.employeeId),
  reviewerIdx: index("idx_reviews_reviewer").on(table.reviewerId),
  dateIdx: index("idx_reviews_date").on(table.reviewDate),
}));

export const hrRecruitment = pgTable("hr_recruitment", {
  id: serial("id").primaryKey(),
  jobTitle: varchar("job_title").notNull(),
  department: varchar("department").notNull(),
  employmentType: varchar("employment_type").notNull(), // full_time, part_time, contractor
  location: varchar("location").notNull(),
  salaryRange: varchar("salary_range"),
  jobDescription: text("job_description").notNull(),
  requirements: text("requirements").notNull(),
  responsibilities: text("responsibilities").notNull(),
  benefits: text("benefits"),
  numberOfPositions: integer("number_of_positions").default(1),
  hiringManagerId: integer("hiring_manager_id"),
  status: varchar("status").default("open"), // open, closed, on_hold, filled
  postedDate: date("posted_date").notNull(),
  closingDate: date("closing_date"),
  applicationCount: integer("application_count").default(0),
  interviewCount: integer("interview_count").default(0),
  offersMade: integer("offers_made").default(0),
  hiresMade: integer("hires_made").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("idx_recruitment_status").on(table.status),
  departmentIdx: index("idx_recruitment_department").on(table.department),
}));

export const hrJobApplications = pgTable("hr_job_applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => hrRecruitment.id).notNull(),
  applicantName: varchar("applicant_name").notNull(),
  applicantEmail: varchar("applicant_email").notNull(),
  applicantPhone: varchar("applicant_phone"),
  resumeUrl: text("resume_url"),
  coverLetter: text("cover_letter"),
  linkedinProfile: varchar("linkedin_profile"),
  portfolioUrl: varchar("portfolio_url"),
  yearsOfExperience: integer("years_of_experience"),
  currentEmployer: varchar("current_employer"),
  expectedSalary: decimal("expected_salary", { precision: 10, scale: 2 }),
  availableStartDate: date("available_start_date"),
  applicationStatus: varchar("application_status").default("submitted"), // submitted, screening, interview, offer, hired, rejected
  interviewDate: timestamp("interview_date"),
  interviewNotes: text("interview_notes"),
  rejectionReason: text("rejection_reason"),
  appliedAt: timestamp("applied_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  jobIdx: index("idx_applications_job").on(table.jobId),
  statusIdx: index("idx_applications_status").on(table.applicationStatus),
  emailIdx: index("idx_applications_email").on(table.applicantEmail),
}));

export const hrTimeTracking = pgTable("hr_time_tracking", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => hrEmployees.id, { onDelete: 'cascade' }).notNull(),
  clockInTime: timestamp("clock_in_time").notNull(),
  clockOutTime: timestamp("clock_out_time"),
  totalHours: decimal("total_hours", { precision: 5, scale: 2 }),
  workType: varchar("work_type").default("regular"), // regular, overtime, remote, onsite
  location: varchar("location"), // station ID or "remote"
  notes: text("notes"),
  approvedBy: integer("approved_by"), // manager ID
  approvalStatus: varchar("approval_status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_time_tracking_employee").on(table.employeeId),
  clockInIdx: index("idx_time_tracking_clock_in").on(table.clockInTime),
  statusIdx: index("idx_time_tracking_status").on(table.approvalStatus),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertHrEmployeeSchema = createInsertSchema(hrEmployees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHrEmployee = z.infer<typeof insertHrEmployeeSchema>;
export type HrEmployee = typeof hrEmployees.$inferSelect;

export const insertHrPayrollSchema = createInsertSchema(hrPayroll).omit({
  id: true,
  createdAt: true,
});
export type InsertHrPayroll = z.infer<typeof insertHrPayrollSchema>;
export type HrPayroll = typeof hrPayroll.$inferSelect;

export const insertHrPerformanceReviewSchema = createInsertSchema(hrPerformanceReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHrPerformanceReview = z.infer<typeof insertHrPerformanceReviewSchema>;
export type HrPerformanceReview = typeof hrPerformanceReviews.$inferSelect;

export const insertHrRecruitmentSchema = createInsertSchema(hrRecruitment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHrRecruitment = z.infer<typeof insertHrRecruitmentSchema>;
export type HrRecruitment = typeof hrRecruitment.$inferSelect;

export const insertHrJobApplicationSchema = createInsertSchema(hrJobApplications).omit({
  id: true,
  appliedAt: true,
  updatedAt: true,
});
export type InsertHrJobApplication = z.infer<typeof insertHrJobApplicationSchema>;
export type HrJobApplication = typeof hrJobApplications.$inferSelect;

export const insertHrTimeTrackingSchema = createInsertSchema(hrTimeTracking).omit({
  id: true,
  createdAt: true,
});
export type InsertHrTimeTracking = z.infer<typeof insertHrTimeTrackingSchema>;
export type HrTimeTracking = typeof hrTimeTracking.$inferSelect;

// =================== COMPENSATION & BENEFITS ===================

export const compensationStructure = pgTable("compensation_structure", {
  id: serial("id").primaryKey(),
  gradeId: varchar("grade_id").unique().notNull(), // GRADE-1, GRADE-2, etc.
  gradeName: varchar("grade_name").notNull(), // Entry Level, Mid Level, Senior, Executive
  department: varchar("department"),
  seniorityLevel: varchar("seniority_level").notNull(),
  salaryMin: decimal("salary_min", { precision: 10, scale: 2 }).notNull(),
  salaryMax: decimal("salary_max", { precision: 10, scale: 2 }).notNull(),
  salaryMid: decimal("salary_mid", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  bonusEligible: boolean("bonus_eligible").default(false),
  bonusTargetPercent: decimal("bonus_target_percent", { precision: 5, scale: 2 }),
  commissionEligible: boolean("commission_eligible").default(false),
  commissionStructure: jsonb("commission_structure"), // {base: 2%, tier1: 5%, tier2: 10%}
  equityEligible: boolean("equity_eligible").default(false),
  equityRangeMin: decimal("equity_range_min", { precision: 10, scale: 4 }),
  equityRangeMax: decimal("equity_range_max", { precision: 10, scale: 4 }),
  benefitsTier: varchar("benefits_tier"), // basic, standard, premium, executive
  overtimeEligible: boolean("overtime_eligible").default(true),
  isActive: boolean("is_active").default(true),
  effectiveDate: date("effective_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  gradeIdIdx: uniqueIndex("idx_compensation_grade_id").on(table.gradeId),
  departmentIdx: index("idx_compensation_department").on(table.department),
  levelIdx: index("idx_compensation_level").on(table.seniorityLevel),
}));

export const benefitsPackages = pgTable("benefits_packages", {
  id: serial("id").primaryKey(),
  packageId: varchar("package_id").unique().notNull(), // PKG-BASIC, PKG-PREMIUM
  packageName: varchar("package_name").notNull(),
  packageTier: varchar("package_tier").notNull(), // basic, standard, premium, executive
  description: text("description"),
  healthInsurance: boolean("health_insurance").default(false),
  healthInsuranceDetails: jsonb("health_insurance_details"), // {provider, coverage, deductible, copay}
  dentalInsurance: boolean("dental_insurance").default(false),
  visionInsurance: boolean("vision_insurance").default(false),
  lifeInsurance: boolean("life_insurance").default(false),
  lifeInsuranceCoverage: decimal("life_insurance_coverage", { precision: 10, scale: 2 }),
  disabilityInsurance: boolean("disability_insurance").default(false),
  retirementPlan: boolean("retirement_plan").default(false),
  retirementMatchPercent: decimal("retirement_match_percent", { precision: 5, scale: 2 }),
  paidTimeOffDays: integer("paid_time_off_days").default(0),
  sickLeaveDays: integer("sick_leave_days").default(0),
  paidHolidays: integer("paid_holidays").default(0),
  parentalLeaveDays: integer("parental_leave_days").default(0),
  gymMembership: boolean("gym_membership").default(false),
  commuteBenefit: boolean("commute_benefit").default(false),
  commuteAmount: decimal("commute_amount", { precision: 10, scale: 2 }),
  mealAllowance: boolean("meal_allowance").default(false),
  mealAmount: decimal("meal_amount", { precision: 10, scale: 2 }),
  phoneAllowance: boolean("phone_allowance").default(false),
  phoneAmount: decimal("phone_amount", { precision: 10, scale: 2 }),
  educationBenefit: boolean("education_benefit").default(false),
  educationMaxAmount: decimal("education_max_amount", { precision: 10, scale: 2 }),
  remoteWorkAllowance: boolean("remote_work_allowance").default(false),
  remoteWorkAmount: decimal("remote_work_amount", { precision: 10, scale: 2 }),
  currency: varchar("currency").default("ILS"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  packageIdIdx: uniqueIndex("idx_benefits_package_id").on(table.packageId),
  tierIdx: index("idx_benefits_tier").on(table.packageTier),
}));

export const employeeBenefitsEnrollment = pgTable("employee_benefits_enrollment", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => hrEmployees.id, { onDelete: 'cascade' }).notNull(),
  packageId: integer("package_id").references(() => benefitsPackages.id).notNull(),
  enrollmentDate: date("enrollment_date").notNull(),
  effectiveDate: date("effective_date").notNull(),
  terminationDate: date("termination_date"),
  healthDependents: integer("health_dependents").default(0),
  dentalDependents: integer("dental_dependents").default(0),
  visionDependents: integer("vision_dependents").default(0),
  lifeInsuranceBeneficiary: jsonb("life_insurance_beneficiary"), // {name, relationship, percentage}
  retirementContributionPercent: decimal("retirement_contribution_percent", { precision: 5, scale: 2 }),
  status: varchar("status").default("active"), // active, suspended, terminated
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_benefits_enrollment_employee").on(table.employeeId),
  packageIdx: index("idx_benefits_enrollment_package").on(table.packageId),
  statusIdx: index("idx_benefits_enrollment_status").on(table.status),
}));

export const employeeTerminations = pgTable("employee_terminations", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => hrEmployees.id).notNull(),
  terminationDate: date("termination_date").notNull(),
  terminationType: varchar("termination_type").notNull(), // voluntary, involuntary, retirement, layoff, end_of_contract
  terminationReason: varchar("termination_reason"),
  noticePeriodDays: integer("notice_period_days"),
  noticeGivenDate: date("notice_given_date"),
  finalWorkingDay: date("final_working_day"),
  severanceEligible: boolean("severance_eligible").default(false),
  severanceAmount: decimal("severance_amount", { precision: 10, scale: 2 }),
  severanceCurrency: varchar("severance_currency").default("ILS"),
  exitInterviewCompleted: boolean("exit_interview_completed").default(false),
  exitInterviewDate: date("exit_interview_date"),
  exitInterviewNotes: text("exit_interview_notes"),
  exitInterviewConductedBy: integer("exit_interview_conducted_by"),
  rehireEligible: boolean("rehire_eligible").default(true),
  equipmentReturned: boolean("equipment_returned").default(false),
  accessRevoked: boolean("access_revoked").default(false),
  finalPaymentProcessed: boolean("final_payment_processed").default(false),
  finalPaymentDate: date("final_payment_date"),
  cobraEligible: boolean("cobra_eligible").default(false),
  cobraNotificationSent: boolean("cobra_notification_sent").default(false),
  terminatedBy: integer("terminated_by"),
  approvedBy: integer("approved_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_terminations_employee").on(table.employeeId),
  dateIdx: index("idx_terminations_date").on(table.terminationDate),
  typeIdx: index("idx_terminations_type").on(table.terminationType),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS (COMPENSATION & BENEFITS) ===================

export const insertCompensationStructureSchema = createInsertSchema(compensationStructure).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompensationStructure = z.infer<typeof insertCompensationStructureSchema>;
export type CompensationStructure = typeof compensationStructure.$inferSelect;

export const insertBenefitsPackageSchema = createInsertSchema(benefitsPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBenefitsPackage = z.infer<typeof insertBenefitsPackageSchema>;
export type BenefitsPackage = typeof benefitsPackages.$inferSelect;

export const insertEmployeeBenefitsEnrollmentSchema = createInsertSchema(employeeBenefitsEnrollment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmployeeBenefitsEnrollment = z.infer<typeof insertEmployeeBenefitsEnrollmentSchema>;
export type EmployeeBenefitsEnrollment = typeof employeeBenefitsEnrollment.$inferSelect;

export const insertEmployeeTerminationSchema = createInsertSchema(employeeTerminations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmployeeTermination = z.infer<typeof insertEmployeeTerminationSchema>;
export type EmployeeTermination = typeof employeeTerminations.$inferSelect;
