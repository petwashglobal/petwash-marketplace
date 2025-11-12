# Pet Wash Ltd - Franchise Onboarding & Multi-Tenant Data Model
## Enterprise Architecture for Global Franchise Expansion

Last Updated: November 11, 2025  
Status: **PLANNING PHASE**

---

## Executive Summary

Pet Wash Ltd is designed as a global franchise operation with independent business units operating under one unified platform. This document outlines the data model for franchise onboarding, multi-tenant RBAC, and per-country operations.

**Business Units:**
- 🛁 **K9000 Wash Stations** (flagship IoT product)
- 🏠 **The Sitter Suite™** (pet sitting marketplace)
- 🐕 **Walk My Pet™** (dog walking marketplace)
- 🚗 **PetTrek™** (pet transport marketplace)
- 🎨 **The Plush Lab™** (AI avatar creator)

**Key Requirements:**
1. Single unified login identity across all business units
2. Role-based views and permissions (HQ, country, franchise, staff)
3. Per-country tax, legal, and compliance separation
4. IoT device management with franchise-level ownership
5. AI-powered franchise application review
6. Revenue sharing and financial transparency

---

## Database Schema Design

### 1. `franchise_entities`

Master table for all franchise locations worldwide.

```sql
CREATE TABLE franchise_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Information
  franchise_code VARCHAR(20) UNIQUE NOT NULL, -- 'IL-TLV-001', 'US-NYC-042'
  legal_name VARCHAR(255) NOT NULL,
  brand_name VARCHAR(255),
  entity_type VARCHAR(50) NOT NULL, -- 'master', 'regional', 'local'
  
  -- Ownership Structure
  parent_franchise_id UUID REFERENCES franchise_entities(id), -- NULL for HQ
  franchisee_user_id VARCHAR(255) NOT NULL, -- Firebase UID of owner
  operating_company_name VARCHAR(255),
  tax_id VARCHAR(100), -- Country-specific tax ID
  
  -- Location Details
  country_code VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
  region VARCHAR(100), -- State/Province
  city VARCHAR(100),
  address JSONB NOT NULL, -- Full address with lat/lng
  geohash VARCHAR(20),
  timezone VARCHAR(50) DEFAULT 'Asia/Jerusalem',
  
  -- Business Units (what this franchise operates)
  business_units JSONB NOT NULL DEFAULT '[]', 
  -- ['k9000', 'sitter-suite', 'walk-my-pet', 'pettrek', 'plush-lab']
  
  -- Financial & Compliance
  currency VARCHAR(3) NOT NULL DEFAULT 'ILS',
  revenue_share_percentage DECIMAL(5, 2), -- % paid to Pet Wash Ltd HQ
  payment_terms VARCHAR(50), -- 'net-30', 'net-60'
  bank_details JSONB, -- Encrypted bank account info
  
  -- Status & Lifecycle
  status VARCHAR(50) NOT NULL DEFAULT 'pending', 
  -- 'pending', 'approved', 'active', 'suspended', 'terminated'
  approved_by VARCHAR(255), -- HQ admin who approved
  approved_at TIMESTAMPTZ,
  activation_date DATE,
  termination_date DATE,
  termination_reason TEXT,
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_franchise_entities_franchise_code ON franchise_entities(franchise_code);
CREATE INDEX idx_franchise_entities_country_code ON franchise_entities(country_code);
CREATE INDEX idx_franchise_entities_franchisee_user_id ON franchise_entities(franchisee_user_id);
CREATE INDEX idx_franchise_entities_status ON franchise_entities(status);
CREATE INDEX idx_franchise_entities_parent_franchise_id ON franchise_entities(parent_franchise_id);
```

**Hierarchy Example:**
```
Pet Wash Ltd (HQ)
├── Israel Operations (IL-HQ)
│   ├── Tel Aviv Franchise (IL-TLV-001)
│   │   ├── K9000 Station #1
│   │   ├── K9000 Station #2
│   │   └── Walk My Pet Team
│   └── Haifa Franchise (IL-HFA-001)
├── USA Operations (US-HQ)
│   ├── New York Franchise (US-NYC-001)
│   └── Los Angeles Franchise (US-LAX-001)
└── Canada Operations (CA-HQ)
    └── Toronto Franchise (CA-TOR-001)
```

---

### 2. `franchise_applications`

Tracks franchise applications through AI-powered review process.

```sql
CREATE TABLE franchise_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Applicant Information
  applicant_email VARCHAR(255) NOT NULL,
  applicant_name VARCHAR(255) NOT NULL,
  applicant_phone VARCHAR(50),
  applicant_user_id VARCHAR(255), -- Firebase UID (if registered)
  
  -- Application Details
  requested_country VARCHAR(2) NOT NULL,
  requested_region VARCHAR(100),
  requested_city VARCHAR(100),
  requested_business_units TEXT[] NOT NULL, -- ['k9000', 'walk-my-pet']
  
  -- Financial Capacity
  estimated_investment_amount DECIMAL(12, 2),
  investment_currency VARCHAR(3),
  net_worth DECIMAL(12, 2),
  liquid_assets DECIMAL(12, 2),
  funding_source VARCHAR(100), -- 'personal', 'loan', 'investor'
  
  -- Experience & Background
  business_experience_years INTEGER,
  pet_industry_experience BOOLEAN DEFAULT false,
  franchise_experience BOOLEAN DEFAULT false,
  education_level VARCHAR(50),
  professional_background TEXT,
  
  -- Documents (uploaded via secure file storage)
  documents JSONB DEFAULT '[]', 
  -- [{type: 'passport', url: 'gs://...', verified: true}]
  
  -- AI Review
  ai_review_status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'analyzing', 'reviewed', 'flagged'
  ai_score DECIMAL(5, 2), -- 0-100 AI confidence score
  ai_summary TEXT, -- Gemini-generated summary
  ai_flags JSONB DEFAULT '[]', -- Risk factors identified by AI
  ai_reviewed_at TIMESTAMPTZ,
  
  -- Human Review
  human_review_status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'approved', 'rejected', 'needs_more_info'
  reviewed_by VARCHAR(255), -- HQ admin who reviewed
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  
  -- KYC & Compliance
  kyc_status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'verified', 'failed'
  background_check_status VARCHAR(50) DEFAULT 'pending',
  credit_check_status VARCHAR(50) DEFAULT 'pending',
  
  -- Outcome
  franchise_id UUID REFERENCES franchise_entities(id), -- If approved
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_franchise_applications_applicant_email ON franchise_applications(applicant_email);
CREATE INDEX idx_franchise_applications_ai_review_status ON franchise_applications(ai_review_status);
CREATE INDEX idx_franchise_applications_human_review_status ON franchise_applications(human_review_status);
CREATE INDEX idx_franchise_applications_requested_country ON franchise_applications(requested_country);
```

---

### 3. `country_operations`

Per-country configuration for tax, legal, and compliance.

```sql
CREATE TABLE country_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Country Identification
  country_code VARCHAR(2) PRIMARY KEY, -- ISO 3166-1 alpha-2
  country_name VARCHAR(100) NOT NULL,
  region VARCHAR(50), -- 'Middle East', 'North America', 'Europe'
  
  -- Operational Status
  is_active BOOLEAN DEFAULT false,
  launch_date DATE,
  responsible_hq_admin VARCHAR(255),
  
  -- Tax & Legal Configuration
  tax_authority_name VARCHAR(255),
  vat_rate DECIMAL(5, 2), -- Standard VAT rate (e.g., 17.00 for Israel)
  tax_id_format VARCHAR(100), -- Regex for validation
  requires_local_entity BOOLEAN DEFAULT true,
  requires_tax_registration BOOLEAN DEFAULT true,
  
  -- Currency & Financial
  default_currency VARCHAR(3) NOT NULL,
  payment_methods_allowed TEXT[], -- ['credit_card', 'bank_transfer', 'cash']
  local_payment_gateway VARCHAR(100), -- 'nayax', 'stripe', 'adyen'
  
  -- Compliance & Legal
  data_residency_required BOOLEAN DEFAULT false, -- GDPR/local laws
  data_storage_region VARCHAR(50), -- 'eu-west-1', 'us-east-1'
  legal_agreements_required TEXT[], -- ['franchise_agreement', 'data_processing']
  minimum_insurance_coverage DECIMAL(12, 2),
  
  -- Language & Localization
  default_language VARCHAR(5), -- ISO 639-1 (e.g., 'he-IL', 'en-US')
  supported_languages TEXT[],
  rtl_layout BOOLEAN DEFAULT false,
  date_format VARCHAR(20), -- 'DD/MM/YYYY', 'MM/DD/YYYY'
  
  -- Business Rules
  minimum_franchise_fee DECIMAL(12, 2),
  royalty_percentage_default DECIMAL(5, 2),
  allowed_business_units TEXT[],
  prohibited_business_units TEXT[],
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_country_operations_is_active ON country_operations(is_active);
CREATE INDEX idx_country_operations_region ON country_operations(region);
```

**Example Data:**
```sql
INSERT INTO country_operations VALUES (
  'IL', 'Israel', 'Middle East', true, '2025-01-01', 
  'admin@petwash.co.il', 'Israeli Tax Authority', 17.00, 
  '^\d{9}$', true, true, 'ILS', 
  '{credit_card,bank_transfer}', 'nayax', 
  false, 'eu-west-1', '{franchise_agreement,privacy_policy}', 
  100000.00, 'he-IL', '{he-IL,en-US}', true, 'DD/MM/YYYY',
  50000.00, 10.00, '{k9000,sitter-suite,walk-my-pet,pettrek}', 
  '{}', '{}', NOW(), NOW()
);
```

---

### 4. `franchise_staff`

Employees working at franchise locations.

```sql
CREATE TABLE franchise_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Staff Identity
  user_id VARCHAR(255) NOT NULL, -- Firebase UID
  franchise_id UUID NOT NULL REFERENCES franchise_entities(id),
  
  -- Role & Permissions
  role VARCHAR(50) NOT NULL, 
  -- 'franchise_owner', 'manager', 'dispatcher', 'technician', 
  -- 'sitter', 'walker', 'driver', 'trainer'
  
  permissions JSONB NOT NULL DEFAULT '{}',
  -- {k9000: {view: true, operate: true}, walk-my-pet: {dispatch: true}}
  
  -- Employment Details
  employee_type VARCHAR(50), -- 'full_time', 'part_time', 'contractor'
  employment_start_date DATE,
  employment_end_date DATE,
  
  -- Financial
  compensation_type VARCHAR(50), -- 'salary', 'hourly', 'commission'
  compensation_amount DECIMAL(10, 2),
  compensation_currency VARCHAR(3),
  
  -- Access Control
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_franchise_staff_user_id ON franchise_staff(user_id);
CREATE INDEX idx_franchise_staff_franchise_id ON franchise_staff(franchise_id);
CREATE INDEX idx_franchise_staff_role ON franchise_staff(role);
CREATE INDEX idx_franchise_staff_is_active ON franchise_staff(is_active);
```

---

### 5. `iot_devices` (K9000 Wash Stations)

IoT device management with franchise-level ownership.

```sql
CREATE TABLE iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Device Identification
  device_id VARCHAR(50) UNIQUE NOT NULL, -- Hardware serial number
  device_type VARCHAR(50) NOT NULL DEFAULT 'k9000', -- 'k9000', 'k9000-pro'
  firmware_version VARCHAR(20),
  
  -- Ownership
  franchise_id UUID NOT NULL REFERENCES franchise_entities(id),
  installation_location JSONB NOT NULL, -- {address, lat, lng, indoor/outdoor}
  
  -- Status & Telemetry
  status VARCHAR(50) NOT NULL DEFAULT 'offline',
  -- 'offline', 'online', 'maintenance', 'error', 'decommissioned'
  last_seen_at TIMESTAMPTZ,
  last_transaction_at TIMESTAMPTZ,
  
  -- Maintenance
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  maintenance_alerts JSONB DEFAULT '[]',
  
  -- Financial Tracking
  installation_cost DECIMAL(10, 2),
  monthly_operational_cost DECIMAL(10, 2),
  total_revenue_generated DECIMAL(12, 2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  
  -- Configuration
  configuration JSONB, -- Device-specific settings
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_iot_devices_device_id ON iot_devices(device_id);
CREATE INDEX idx_iot_devices_franchise_id ON iot_devices(franchise_id);
CREATE INDEX idx_iot_devices_status ON iot_devices(status);
CREATE INDEX idx_iot_devices_last_seen_at ON iot_devices(last_seen_at);
```

---

### 6. `revenue_sharing`

Track revenue distribution between franchises and HQ.

```sql
CREATE TABLE revenue_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Franchise
  franchise_id UUID NOT NULL REFERENCES franchise_entities(id),
  
  -- Revenue Breakdown
  total_revenue DECIMAL(12, 2) NOT NULL, -- Gross revenue for period
  franchise_costs DECIMAL(12, 2), -- Operating costs
  net_revenue DECIMAL(12, 2), -- Revenue after costs
  
  -- Revenue Share
  hq_share_percentage DECIMAL(5, 2), -- From franchise_entities
  hq_share_amount DECIMAL(12, 2), -- Amount owed to HQ
  franchise_share_amount DECIMAL(12, 2), -- Amount kept by franchise
  
  -- Payment Status
  payment_status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'processed', 'paid', 'overdue'
  payment_due_date DATE,
  payment_date DATE,
  payment_reference VARCHAR(255),
  
  -- Detailed Breakdown by Business Unit
  business_unit_breakdown JSONB,
  -- {k9000: {revenue: 50000, hq_share: 5000}, walk-my-pet: {...}}
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_sharing_franchise_id ON revenue_sharing(franchise_id);
CREATE INDEX idx_revenue_sharing_period_start ON revenue_sharing(period_start);
CREATE INDEX idx_revenue_sharing_payment_status ON revenue_sharing(payment_status);
```

---

## Multi-Tenant RBAC System

### Role Hierarchy

```
HQ (Pet Wash Ltd)
├── CEO / Founder
├── CFO / Finance
├── CTO / Engineering
├── COO / Operations
└── Regional Managers

Country Level
├── Country Director
├── Compliance Officer
└── Regional Support

Franchise Level
├── Franchise Owner
├── General Manager
├── Dispatcher (for marketplaces)
├── Technician (for K9000)
└── Staff (sitters, walkers, drivers)

End Users
├── Pet Owners (customers)
└── Service Providers (operator contractors)
```

### Permission Matrix

| Role | HQ Dashboard | Franchise Management | IoT Devices | Marketplaces | Financial Reports |
|------|--------------|----------------------|-------------|--------------|-------------------|
| **HQ Admin** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **Country Director** | ✅ Read | ✅ Country Only | ✅ Country Only | ✅ Country Only | ✅ Country Only |
| **Franchise Owner** | ❌ | ✅ Own Only | ✅ Own Only | ✅ Own Only | ✅ Own Only |
| **Manager** | ❌ | ❌ | ✅ Assigned | ✅ Assigned | ✅ Read Only |
| **Dispatcher** | ❌ | ❌ | ❌ | ✅ Dispatch | ❌ |
| **Technician** | ❌ | ❌ | ✅ Maintenance | ❌ | ❌ |
| **Staff** | ❌ | ❌ | ❌ | ✅ Execute Jobs | ❌ |

### Implementation Pattern

```typescript
// server/middleware/rbac.ts
export function requireFranchiseAccess(requiredPermission: string) {
  return async (req, res, next) => {
    const userId = req.user.uid; // Firebase UID
    const franchiseId = req.params.franchiseId;
    
    // Check if user has access to this franchise
    const staffRecord = await db.query.franchiseStaff.findFirst({
      where: and(
        eq(franchiseStaff.userId, userId),
        eq(franchiseStaff.franchiseId, franchiseId),
        eq(franchiseStaff.isActive, true)
      )
    });
    
    if (!staffRecord) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if user has required permission
    const hasPermission = checkPermission(
      staffRecord.permissions,
      requiredPermission
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    req.franchise = staffRecord;
    next();
  };
}

// Usage in routes
app.get('/api/franchises/:franchiseId/devices', 
  requireAuth, 
  requireFranchiseAccess('k9000.view'),
  async (req, res) => {
    // User has access to view K9000 devices for this franchise
    const devices = await getDevicesForFranchise(req.params.franchiseId);
    res.json(devices);
  }
);
```

---

## Franchise Onboarding Flow

### 1. Application Submission

```
User → Web Form → Franchise Application Created
  ↓
AI Review (Gemini 2.5 Flash)
  ├─ Parse documents (passport, business registration)
  ├─ Analyze financial capacity
  ├─ Flag risk factors
  └─ Generate AI score + summary
  ↓
Human Review (HQ Admin)
  ├─ Review AI analysis
  ├─ Check background & credit
  ├─ Approve / Reject / Request more info
  ↓
Approved → Franchise Entity Created
```

### 2. AI-Powered Application Review

```typescript
// server/services/FranchiseApplicationService.ts
export async function reviewFranchiseApplication(applicationId: string) {
  const application = await db.query.franchiseApplications.findFirst({
    where: eq(franchiseApplications.id, applicationId)
  });
  
  // Use Gemini to analyze application
  const prompt = `
Analyze this franchise application for Pet Wash Ltd:

Applicant: ${application.applicantName}
Country: ${application.requestedCountry}
Investment: ${application.estimatedInvestmentAmount} ${application.investmentCurrency}
Net Worth: ${application.netWorth}
Business Experience: ${application.businessExperienceYears} years
Pet Industry Experience: ${application.petIndustryExperience}

Documents:
${JSON.stringify(application.documents, null, 2)}

Professional Background:
${application.professionalBackground}

Please provide:
1. Risk Score (0-100, where 100 is lowest risk)
2. Summary of applicant's qualifications
3. Identified red flags or concerns
4. Recommendation (approve/reject/more info needed)

Format as JSON: {score, summary, flags[], recommendation}
`;
  
  const aiResponse = await gemini.generateContent(prompt);
  const analysis = JSON.parse(aiResponse.text);
  
  // Update application with AI review
  await db.update(franchiseApplications)
    .set({
      aiReviewStatus: 'reviewed',
      aiScore: analysis.score,
      aiSummary: analysis.summary,
      aiFlags: analysis.flags,
      aiReviewedAt: new Date()
    })
    .where(eq(franchiseApplications.id, applicationId));
    
  return analysis;
}
```

### 3. Document Verification (KYC)

```typescript
// Use Google Vision API for passport OCR
const passportData = await verifyPassport(documentUrl);

// Use external KYC service for background check
const kycResult = await performKYC({
  fullName: application.applicantName,
  passportNumber: passportData.passportNumber,
  country: application.requestedCountry
});

// Update application status
await db.update(franchiseApplications)
  .set({ kycStatus: kycResult.status })
  .where(eq(franchiseApplications.id, applicationId));
```

### 4. Franchise Creation

```typescript
// Once approved, create franchise entity
const franchise = await db.insert(franchiseEntities).values({
  franchiseCode: generateFranchiseCode(application.requestedCountry),
  legalName: application.applicantName + ' LLC',
  franchiseeUserId: application.applicantUserId,
  countryCode: application.requestedCountry,
  businessUnits: application.requestedBusinessUnits,
  status: 'approved',
  approvedBy: req.user.uid,
  approvedAt: new Date()
});

// Link application to franchise
await db.update(franchiseApplications)
  .set({ franchiseId: franchise.id })
  .where(eq(franchiseApplications.id, applicationId));

// Create initial franchise owner staff record
await db.insert(franchiseStaff).values({
  userId: application.applicantUserId,
  franchiseId: franchise.id,
  role: 'franchise_owner',
  permissions: {
    k9000: { view: true, operate: true, manage: true },
    'walk-my-pet': { dispatch: true, view: true },
    'sitter-suite': { dispatch: true, view: true },
    pettrek: { dispatch: true, view: true },
    reports: { view: true }
  },
  isActive: true
});
```

---

## Next Steps

### Phase 1: Data Model Implementation (Q1 2026)
- [ ] Create Drizzle schemas for all tables
- [ ] Run database migrations
- [ ] Add seed data for test franchises
- [ ] Build franchise application form
- [ ] Implement AI review service

### Phase 2: RBAC System (Q2 2026)
- [ ] Build role-based middleware
- [ ] Create permission checking utilities
- [ ] Implement franchise-scoped queries
- [ ] Add role management UI

### Phase 3: Franchise Dashboard (Q3 2026)
- [ ] Build franchise owner dashboard
- [ ] Implement IoT device management
- [ ] Create revenue reporting
- [ ] Add staff management interface

### Phase 4: Multi-Country Launch (Q4 2026)
- [ ] Configure country-specific compliance
- [ ] Implement multi-currency support
- [ ] Build localized UIs
- [ ] Launch in 3 pilot countries

---

*Document Version: 0.1 (Draft)*  
*Status: Planning Phase*  
*Next Review: January 2026*
