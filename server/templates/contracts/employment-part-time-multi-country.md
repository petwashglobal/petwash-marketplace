# PART-TIME EMPLOYMENT AGREEMENT

**PET WASH™ {{country_upper}}**  
Entity: {{legal_entity_name}}  
Registration: {{company_registration_number}}

---

## PART-TIME EMPLOYMENT CONTRACT

**Date:** {{contract_date}}  
**Employer:** {{legal_entity_name}}  
**Employee:** {{employee_name}}, ID: {{employee_id_number}}

### 1. POSITION
**Title:** {{job_title}}  
**Department:** {{department}}  
**Reports To:** {{manager_name}}

**Duties:** {{job_responsibilities}}

### 2. HOURS & SCHEDULE
- **Part-Time Hours:** {{weekly_hours}} hours per week ({{hours_percentage}}% of full-time)
- **Schedule:** {{work_schedule}}
- **Flexibility:** {{schedule_flexibility}}

### 3. COMPENSATION
**Annual Salary (Pro-Rated):** {{currency}}{{annual_salary_prorated}}  
*(Full-time equivalent: {{currency}}{{fte_salary}})*

**Pay Frequency:** {{payment_frequency}}  
**Overtime:** {{overtime_policy}}

### 4. PRO-RATED BENEFITS

{{#if_country_ISRAEL}}
**Israel-Specific Benefits:**
- Annual Leave: {{annual_leave_days}} days (pro-rated: {{hours_percentage}}%)
- Sick Leave: As per Israeli Sick Pay Law (pro-rated)
- Public Holidays: {{paid_holidays}} days (pro-rated)
- Pension (Gemel): {{pension_contribution}}% employer contribution
- Study Fund (Keren Hishtalmut): {{study_fund_contribution}}%
- Severance Pay: As per Israeli law (accumulated pro-rata)
{{/if_country_ISRAEL}}

{{#if_country_US}}
**United States Benefits:**
- Vacation: {{vacation_days}} days per year (pro-rated)
- Sick Leave: {{sick_leave_days}} days (where required by state law)
- 401(k) Eligibility: {{retirement_eligible}}
- Health Insurance: {{health_insurance_eligibility}}
- Classification: Part-time W-2 employee
{{/if_country_US}}

{{#if_country_CANADA}}
**Canada Benefits:**
- Vacation: {{vacation_weeks}} weeks ({{Employment_Standards_Act_province}})
- Statutory Holidays: Pro-rated entitlement
- CPP/EI: Mandatory deductions apply
- Benefits: {{benefits_eligibility}} (varies by province)
{{/if_country_CANADA}}

{{#if_country_UK}}
**UK Benefits:**
- Annual Leave: {{annual_leave_days}} days (pro-rated from 28 days)
- Pension: Auto-enrollment if earning > £10,000/year
- Sick Pay: Statutory Sick Pay (SSP) if eligible
- Bank Holidays: Pro-rated entitlement
{{/if_country_UK}}

{{#if_country_AUSTRALIA}}
**Australia Benefits:**
- Annual Leave: {{annual_leave_weeks}} weeks (pro-rated from 4 weeks)
- Sick/Carer's Leave: {{sick_leave_days}} days per year (pro-rated)
- Public Holidays: Pro-rated pay
- Superannuation: {{super_rate}}% employer contribution (if earning > $450/month)
{{/if_country_AUSTRALIA}}

### 5. PROBATION
- **Probation Period:** {{probation_period_days}} days
- **Notice During Probation:** {{probation_notice_days}} days

### 6. CONVERSION TO FULL-TIME
Employee may request conversion to full-time after {{conversion_eligibility_months}} months.  
Employer not obligated but will consider based on business needs.

### 7. SECONDARY EMPLOYMENT
{{#if_allow_secondary_employment}}
- Employee may engage in other employment provided no conflict of interest
- Must not compete with Pet Wash™ services
- Employer work takes priority during scheduled hours
{{/if_allow_secondary_employment}}

{{#if_not_allow_secondary_employment}}
- Employee must seek written approval for secondary employment
- No competing services allowed
{{/if_not_allow_secondary_employment}}

### 8. TERMINATION
**Notice Period:** {{notice_period_days}} days for either party  
**Severance:** As required by {{country}} law (pro-rated)

### 9. COMPLIANCE

{{#if_country_US}}
**US Compliance:**
- Fair Labor Standards Act (FLSA)
- State-specific part-time employment laws
- ACA eligibility: {{aca_status}} (based on hours)
{{/if_country_US}}

{{#if_country_CANADA}}
**Canada Compliance:**
- {{province}} Employment Standards Act
- Part-time employee protections apply
{{/if_country_CANADA}}

{{#if_country_UK}}
**UK Compliance:**
- Part-time Workers Regulations 2000
- Equal treatment with full-time employees
{{/if_country_UK}}

{{#if_country_ISRAEL}}
**Israel Compliance:**
- Hours of Work and Rest Law (pro-rated)
- Equal rights per Part-Time Employees Law
{{/if_country_ISRAEL}}

{{#if_country_AUSTRALIA}}
**Australia Compliance:**
- Fair Work Act 2009
- National Employment Standards (NES) apply (pro-rated)
{{/if_country_AUSTRALIA}}

### 10. GOVERNING LAW
**Jurisdiction:** {{jurisdiction_country}}, {{jurisdiction_state}}  
**Disputes:** Resolved per {{country}} employment law

---

**EMPLOYER**  
{{legal_entity_name}}  
Authorized Signatory: ___________________________  
Date: {{signature_date}}

**EMPLOYEE**  
{{employee_name}}  
Signature: ___________________________  
Date: {{signature_date}}
