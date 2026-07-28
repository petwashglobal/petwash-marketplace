-- 0106_hr_tables_ensure.sql
-- The 10 HR tables (shared/schema-hr.ts) were only ever created by `drizzle-push`,
-- never by a migration file. The production deploy gate applies MIGRATION FILES,
-- so it could not guarantee they exist — and /api/enterprise/hr/* (employees,
-- performance-reviews, recruitment, job-applications, payroll, time-tracking…)
-- does `SELECT ... FROM hr_*` with no guard, so a missing table = 500 on
-- /admin/hr, /admin/recruitment, /admin/performance-reviews. This migration makes
-- their existence guaranteed. Every statement is IF NOT EXISTS, so it is a safe
-- no-op on any environment drizzle-push already provisioned. Created in dependency
-- order; intra-HR foreign keys kept, the external franchisees FK intentionally
-- omitted (franchise_id column kept, nullable — "NULL for corporate HQ") to avoid
-- a cross-schema dependency at migration time. (2026-07-27, audit finding: phantom HR tables)

CREATE TABLE IF NOT EXISTS hr_employees (
  id                       serial PRIMARY KEY,
  employee_id              varchar UNIQUE NOT NULL,
  firebase_uid             varchar UNIQUE,
  franchise_id             integer,
  role                     varchar DEFAULT 'employee',
  permissions              jsonb,
  first_name               varchar NOT NULL,
  last_name                varchar NOT NULL,
  email                    varchar UNIQUE NOT NULL,
  phone                    varchar,
  personal_id              varchar,
  date_of_birth            date,
  gender                   varchar,
  nationality              varchar,
  address                  text,
  emergency_contact        jsonb,
  department               varchar NOT NULL,
  position                 varchar NOT NULL,
  employment_type          varchar NOT NULL,
  start_date               date NOT NULL,
  end_date                 date,
  manager_id               integer,
  salary                   numeric(10,2),
  salary_currency          varchar DEFAULT 'ILS',
  payment_frequency        varchar DEFAULT 'monthly',
  bank_account_details     jsonb,
  tax_details              jsonb,
  social_insurance_number  varchar,
  is_active                boolean DEFAULT true,
  photo_url                varchar,
  created_at               timestamp DEFAULT now(),
  updated_at               timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_employees_id ON hr_employees (employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_email ON hr_employees (email);
CREATE INDEX IF NOT EXISTS idx_hr_employees_firebase_uid ON hr_employees (firebase_uid);
CREATE INDEX IF NOT EXISTS idx_hr_employees_franchise ON hr_employees (franchise_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_role ON hr_employees (role);
CREATE INDEX IF NOT EXISTS idx_hr_employees_department ON hr_employees (department);
CREATE INDEX IF NOT EXISTS idx_hr_employees_active ON hr_employees (is_active);
CREATE INDEX IF NOT EXISTS idx_hr_employees_manager ON hr_employees (manager_id);

CREATE TABLE IF NOT EXISTS hr_payroll (
  id                serial PRIMARY KEY,
  employee_id       integer NOT NULL REFERENCES hr_employees(id),
  pay_period_start  date NOT NULL,
  pay_period_end    date NOT NULL,
  gross_salary      numeric(10,2) NOT NULL,
  bonuses           numeric(10,2) DEFAULT '0',
  deductions        numeric(10,2) DEFAULT '0',
  tax_withheld      numeric(10,2) DEFAULT '0',
  social_insurance  numeric(10,2) DEFAULT '0',
  net_salary        numeric(10,2) NOT NULL,
  currency          varchar DEFAULT 'ILS',
  payment_status    varchar DEFAULT 'pending',
  payment_date      date,
  payment_method    varchar,
  payslip_url       text,
  notes             text,
  created_at        timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON hr_payroll (employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON hr_payroll (pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON hr_payroll (payment_status);

CREATE TABLE IF NOT EXISTS hr_performance_reviews (
  id                        serial PRIMARY KEY,
  employee_id               integer NOT NULL REFERENCES hr_employees(id),
  reviewer_id               integer NOT NULL REFERENCES hr_employees(id),
  review_period             varchar NOT NULL,
  review_date               date NOT NULL,
  overall_rating            numeric(2,1) NOT NULL,
  performance_goals         jsonb,
  strengths                 text,
  areas_for_improvement     text,
  development_plan          text,
  promotion_recommended     boolean DEFAULT false,
  raise_recommended         boolean DEFAULT false,
  recommended_raise_percent numeric(5,2),
  status                    varchar DEFAULT 'draft',
  employee_signature        text,
  reviewer_signature        text,
  acknowledged_at           timestamp,
  created_at                timestamp DEFAULT now(),
  updated_at                timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_employee ON hr_performance_reviews (employee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON hr_performance_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON hr_performance_reviews (review_date);

CREATE TABLE IF NOT EXISTS hr_recruitment (
  id                   serial PRIMARY KEY,
  job_title            varchar NOT NULL,
  department           varchar NOT NULL,
  employment_type      varchar NOT NULL,
  location             varchar NOT NULL,
  salary_range         varchar,
  job_description      text NOT NULL,
  requirements         text NOT NULL,
  responsibilities     text NOT NULL,
  benefits             text,
  number_of_positions  integer DEFAULT 1,
  hiring_manager_id    integer,
  status               varchar DEFAULT 'open',
  posted_date          date NOT NULL,
  closing_date         date,
  application_count    integer DEFAULT 0,
  interview_count      integer DEFAULT 0,
  offers_made          integer DEFAULT 0,
  hires_made           integer DEFAULT 0,
  created_at           timestamp DEFAULT now(),
  updated_at           timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recruitment_status ON hr_recruitment (status);
CREATE INDEX IF NOT EXISTS idx_recruitment_department ON hr_recruitment (department);

CREATE TABLE IF NOT EXISTS hr_job_applications (
  id                   serial PRIMARY KEY,
  job_id               integer NOT NULL REFERENCES hr_recruitment(id),
  applicant_name       varchar NOT NULL,
  applicant_email      varchar NOT NULL,
  applicant_phone      varchar,
  resume_url           text,
  cover_letter         text,
  linkedin_profile     varchar,
  portfolio_url        varchar,
  years_of_experience  integer,
  current_employer     varchar,
  expected_salary      numeric(10,2),
  available_start_date date,
  application_status   varchar DEFAULT 'submitted',
  interview_date       timestamp,
  interview_notes      text,
  rejection_reason     text,
  applied_at           timestamp DEFAULT now(),
  updated_at           timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_applications_job ON hr_job_applications (job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON hr_job_applications (application_status);
CREATE INDEX IF NOT EXISTS idx_applications_email ON hr_job_applications (applicant_email);

CREATE TABLE IF NOT EXISTS hr_time_tracking (
  id               serial PRIMARY KEY,
  employee_id      integer NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  clock_in_time    timestamp NOT NULL,
  clock_out_time   timestamp,
  total_hours      numeric(5,2),
  work_type        varchar DEFAULT 'regular',
  location         varchar,
  notes            text,
  approved_by      integer,
  approval_status  varchar DEFAULT 'pending',
  created_at       timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_tracking_employee ON hr_time_tracking (employee_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_clock_in ON hr_time_tracking (clock_in_time);
CREATE INDEX IF NOT EXISTS idx_time_tracking_status ON hr_time_tracking (approval_status);

CREATE TABLE IF NOT EXISTS compensation_structure (
  id                     serial PRIMARY KEY,
  grade_id               varchar UNIQUE NOT NULL,
  grade_name             varchar NOT NULL,
  department             varchar,
  seniority_level        varchar NOT NULL,
  salary_min             numeric(10,2) NOT NULL,
  salary_max             numeric(10,2) NOT NULL,
  salary_mid             numeric(10,2) NOT NULL,
  currency               varchar DEFAULT 'ILS',
  bonus_eligible         boolean DEFAULT false,
  bonus_target_percent   numeric(5,2),
  commission_eligible    boolean DEFAULT false,
  commission_structure   jsonb,
  equity_eligible        boolean DEFAULT false,
  equity_range_min       numeric(10,4),
  equity_range_max       numeric(10,4),
  benefits_tier          varchar,
  overtime_eligible      boolean DEFAULT true,
  is_active              boolean DEFAULT true,
  effective_date         date NOT NULL,
  created_at             timestamp DEFAULT now(),
  updated_at             timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_compensation_grade_id ON compensation_structure (grade_id);
CREATE INDEX IF NOT EXISTS idx_compensation_department ON compensation_structure (department);
CREATE INDEX IF NOT EXISTS idx_compensation_level ON compensation_structure (seniority_level);

CREATE TABLE IF NOT EXISTS benefits_packages (
  id                        serial PRIMARY KEY,
  package_id                varchar UNIQUE NOT NULL,
  package_name              varchar NOT NULL,
  package_tier              varchar NOT NULL,
  description               text,
  health_insurance          boolean DEFAULT false,
  health_insurance_details  jsonb,
  dental_insurance          boolean DEFAULT false,
  vision_insurance          boolean DEFAULT false,
  life_insurance            boolean DEFAULT false,
  life_insurance_coverage   numeric(10,2),
  disability_insurance      boolean DEFAULT false,
  retirement_plan           boolean DEFAULT false,
  retirement_match_percent  numeric(5,2),
  paid_time_off_days        integer DEFAULT 0,
  sick_leave_days           integer DEFAULT 0,
  paid_holidays             integer DEFAULT 0,
  parental_leave_days       integer DEFAULT 0,
  gym_membership            boolean DEFAULT false,
  commute_benefit           boolean DEFAULT false,
  commute_amount            numeric(10,2),
  meal_allowance            boolean DEFAULT false,
  meal_amount               numeric(10,2),
  phone_allowance           boolean DEFAULT false,
  phone_amount              numeric(10,2),
  education_benefit         boolean DEFAULT false,
  education_max_amount      numeric(10,2),
  remote_work_allowance     boolean DEFAULT false,
  remote_work_amount        numeric(10,2),
  currency                  varchar DEFAULT 'ILS',
  is_active                 boolean DEFAULT true,
  created_at                timestamp DEFAULT now(),
  updated_at                timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_benefits_package_id ON benefits_packages (package_id);
CREATE INDEX IF NOT EXISTS idx_benefits_tier ON benefits_packages (package_tier);

CREATE TABLE IF NOT EXISTS employee_benefits_enrollment (
  id                              serial PRIMARY KEY,
  employee_id                     integer NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  package_id                      integer NOT NULL REFERENCES benefits_packages(id),
  enrollment_date                 date NOT NULL,
  effective_date                  date NOT NULL,
  termination_date                date,
  health_dependents               integer DEFAULT 0,
  dental_dependents               integer DEFAULT 0,
  vision_dependents               integer DEFAULT 0,
  life_insurance_beneficiary      jsonb,
  retirement_contribution_percent numeric(5,2),
  status                          varchar DEFAULT 'active',
  created_at                      timestamp DEFAULT now(),
  updated_at                      timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_benefits_enrollment_employee ON employee_benefits_enrollment (employee_id);
CREATE INDEX IF NOT EXISTS idx_benefits_enrollment_package ON employee_benefits_enrollment (package_id);
CREATE INDEX IF NOT EXISTS idx_benefits_enrollment_status ON employee_benefits_enrollment (status);

CREATE TABLE IF NOT EXISTS employee_terminations (
  id                          serial PRIMARY KEY,
  employee_id                 integer NOT NULL REFERENCES hr_employees(id),
  termination_date            date NOT NULL,
  termination_type            varchar NOT NULL,
  termination_reason          varchar,
  notice_period_days          integer,
  notice_given_date           date,
  final_working_day           date,
  severance_eligible          boolean DEFAULT false,
  severance_amount            numeric(10,2),
  severance_currency          varchar DEFAULT 'ILS',
  exit_interview_completed    boolean DEFAULT false,
  exit_interview_date         date,
  exit_interview_notes        text,
  exit_interview_conducted_by integer,
  rehire_eligible             boolean DEFAULT true,
  equipment_returned          boolean DEFAULT false,
  access_revoked              boolean DEFAULT false,
  final_payment_processed     boolean DEFAULT false,
  final_payment_date          date,
  cobra_eligible              boolean DEFAULT false,
  cobra_notification_sent     boolean DEFAULT false,
  terminated_by               integer,
  approved_by                 integer,
  notes                       text,
  created_at                  timestamp DEFAULT now(),
  updated_at                  timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_terminations_employee ON employee_terminations (employee_id);
CREATE INDEX IF NOT EXISTS idx_terminations_date ON employee_terminations (termination_date);
CREATE INDEX IF NOT EXISTS idx_terminations_type ON employee_terminations (termination_type);
