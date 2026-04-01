# PetWash Platform — Complete Product Specification
**Version:** 2.0 | **Last Updated:** April 2026 | **Classification:** Internal Engineering Reference

> **Read this before writing any code.**
> If you misunderstand this document, you will build the wrong system.

---

## Table of Contents

1. [Ecosystem Overview](#1-ecosystem-overview)
2. [Platform Separation Rules](#2-platform-separation-rules)
3. [User Types and Roles](#3-user-types-and-roles)
4. [Role-Based Access Matrix](#4-role-based-access-matrix)
5. [Route Map and Permission Gates](#5-route-map-and-permission-gates)
6. [Provider Application Workflow](#6-provider-application-workflow)
7. [Dashboard Specifications by Role](#7-dashboard-specifications-by-role)
8. [File Handling Architecture](#8-file-handling-architecture)
9. [Communication System](#9-communication-system)
10. [Management Analytics](#10-management-analytics)
11. [Responsive Design Strategy](#11-responsive-design-strategy)
12. [Security Architecture](#12-security-architecture)
13. [What Is Built vs What Is Missing](#13-what-is-built-vs-what-is-missing)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [Google Tools Usage Rules](#15-google-tools-usage-rules)

---

## 1. Ecosystem Overview

PetWash is **not one app**. It is a multi-platform business with separate user types, permissions, and behaviors — all connected to a single backend.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ONE BACKEND (Node.js + PostgreSQL)           │
│                    The backend is the brain. Everything else is UI.  │
└───────────┬───────────┬───────────┬──────────────┬──────────────────┘
            │           │           │              │
   ┌────────▼──┐  ┌─────▼────┐  ┌──▼──────┐  ┌───▼──────────┐
   │ PetWash   │  │  Kiosk   │  │Internal │  │  PetTrek     │
   │ .co.il    │  │ Platform │  │  SaaS   │  │  (FROZEN)    │
   │ (CORE)    │  │(physical)│  │(staff)  │  │ Coming Soon  │
   └───────────┘  └──────────┘  └─────────┘  └──────────────┘
```

### What PetWash.co.il (Core Platform) Contains
- User app (mobile + web) — pet owners
- Provider onboarding + KYC workflow
- Wallet + loyalty club
- Marketplace (grooming, walking, sitting, training)
- Admin dashboards (support + management)
- Kiosk integration

### System of Record Rules
| Layer | Owner | Rule |
|-------|-------|------|
| Data | PostgreSQL | All records live here |
| Files | Firebase/GCS Object Storage | All uploads live here |
| Decisions | Backend (Node.js) | Backend is always the authority |
| Review | Admin Dashboard | Human review lives here |
| Google Sheets | Export only | Async write-only log, never read-from |
| Google Drive | Archive only | Backup copies, never operational |
| Google Forms | Optional intake | Never the system of record |

---

## 2. Platform Separation Rules

### NEVER mix these concerns:

| Platform | Purpose | What it can do | What it must NOT do |
|----------|---------|----------------|---------------------|
| PetWash.co.il | Core system of record | All logic | Nothing restricted |
| Physical Kiosks | Payment + session trigger | Pay, start session | Make any decision |
| Internal SaaS | Operations + management | Review, analytics | Be visible to public |
| PetTrek | Coming soon only | Show "Coming Soon" | Accept any feature work |
| Google Forms | Optional intake fallback | Capture leads | Be a source of truth |
| Google Sheets | Reporting + exports | Read aggregates, receive exports | Drive decisions |
| Google Drive | Backup + archive | Store exports | Replace object storage |

### Current Implementation Status
- ✅ PostgreSQL = system of record
- ✅ GCS/Firebase Storage = file storage with signed URLs
- ✅ Backend = decision authority (KYC, approve/reject)
- ⚠️ Google Sheets — **used as an async export log on application submit** (fire-and-forget, no-await, acceptable as export; must never be changed to a decision path)
- ✅ PetTrek — shows "Coming Soon" (frozen)

---

## 3. User Types and Roles

The system has **five distinct user types** that must never overlap:

### 3.1 Clients (Pet Owners)
**Who:** Public users, pet owners  
**KYC:** None required  
**What they can do:**
- Register (quick, no ID required)
- Use kiosks
- Buy packages
- Manage wallet (5% base discount, some get 10% manual approval)
- View loyalty status, credits, redemptions

**What they must NEVER see:**
- Provider application flow
- Admin dashboards
- Internal flags or scores
- Other users' data

**Auth level:** `public` → `client` after registration

---

### 3.2 Providers (Professionals)
**Who:** Groomers, walkers, sitters, trainers, mobile service providers  
**KYC:** Mandatory (selfie + government ID)  
**Trust level:** HIGH — full identity verification required

**Before approval — can access:**
- Application submission form
- Own application status page
- Own message thread (provider-visible messages only)
- Resubmission upload form

**After approval — can access:**
- Provider OS (jobs, calendar, wallet, profile, services)
- Provider tools

**What they must NEVER see:**
- Internal flags, fraud scores, admin notes
- Other applicants' data
- Management analytics

---

### 3.3 Trainees (Beginner Providers)
**Who:** New/junior providers pending full trust  
**KYC:** Same as providers  
**Trust level:** PARTIAL — may need extra review

**Specific rules:**
- Limited permissions relative to full providers
- May require manual upgrade by admin
- System must support gradual trust escalation
- Role tier: between `client` and `provider`

**Status:** Role tier exists in auth system; upgrade workflow not yet built.

---

### 3.4 Support / Operations Staff
**Who:** Company employees handling daily operations  
**Auth level:** `staff`

**Can do:**
- View and work the review queue
- Approve, reject, request resubmission on applications
- Communicate with applicants (email + internal notes)
- Assign queue items to self or others
- See individual application detail (all KYC data)
- View audit trail per application

**Cannot do:**
- Change system configuration or logic
- Access management-level aggregate analytics
- See other dashboards (management, loyalty)

---

### 3.5 Management
**Who:** Executive / management layer  
**Auth level:** `management`

**Can do:**
- View strategic aggregate dashboards
- See approval/rejection trends
- Monitor fraud patterns and spikes
- See queue aging and reviewer workload
- Monitor system health (processing failures, email failures)

**Cannot do:**
- Manually review individual applications (that's Support's job)
- Approve or reject individual cases
- Access the operational queue

---

## 4. Role-Based Access Matrix

| Feature | client | provider (unapproved) | provider (approved) | trainee | staff | management | admin | super_admin |
|---------|--------|----------------------|--------------------|---------|----|---|---|---|
| View own wallet | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Submit provider application | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View own application status | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Resubmit documents (via token) | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View provider OS | ❌ | ❌ | ✅ | ⚠️ limited | ❌ | ❌ | ✅ | ✅ |
| Review queue (ops) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Approve / reject applications | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| View individual KYC detail | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Send messages to applicants | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Management aggregate dashboard | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Fraud analytics | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| System health dashboard | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Full admin access | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 5. Route Map and Permission Gates

### 5.1 Applicant-Facing Routes (public/provider)

| Route | Page | Auth Required | Permission |
|-------|------|--------------|-----------|
| `/provider-application` | Application form (Step 1-3) | Firebase Auth | Any authenticated user |
| `/provider-application/status` | Own application status | Firebase Auth | Own UID matches application |
| `/provider-application/resubmit?token=` | Document resubmission upload | Token-based (no auth needed) | Valid non-expired token |
| `/my/messages` | (API only) Provider-visible messages | Firebase Auth Bearer | Own UID |

### 5.2 Support / Operations Routes

| Route | Page | Auth Required | Permission |
|-------|------|--------------|-----------|
| `/admin/provider-review` | Review queue + badge | Admin token or x-admin-secret | `staff`/`admin`/`super_admin` |
| `/admin/providers/review/:applicationId` | Application detail (3-tab) | Admin token | `staff`/`admin`/`super_admin` |

**Missing (to build):**
| Route | Page | Permission |
|-------|------|-----------|
| `/ops/kyc/queue` | Dedicated Ops queue with filters | `staff` only (NOT management) |
| `/ops/kyc/inbox` | Unified inbox across all applications | `staff` only |

### 5.3 Management Routes

| Route | Page | Auth Required | Permission |
|-------|------|--------------|-----------|
| (not yet built) | `/mgmt/kyc/overview` | Admin token | `management`/`admin`/`super_admin` |
| (not yet built) | `/mgmt/kyc/fraud` | Admin token | `management`/`admin`/`super_admin` |
| (not yet built) | `/mgmt/kyc/reviewer-workload` | Admin token | `management`/`admin`/`super_admin` |
| (not yet built) | `/mgmt/system-health` | Admin token | `management`/`admin`/`super_admin` |

### 5.4 Provider OS Routes (post-approval)

| Route | Page | Permission |
|-------|------|-----------|
| `/provider-os` | Provider dashboard | `provider` role (approved) |
| `/provider-os/jobs` | Jobs calendar | `provider` |
| `/provider-os/wallet` | Earnings wallet | `provider` |
| `/provider-os/profile` | Profile + services | `provider` |

### 5.5 Loyalty Member Routes

| Route | Page | Permission |
|-------|------|-----------|
| `/loyalty/dashboard` | Loyalty overview | Authenticated client |
| `/loyalty/wallet` | Smart wallet | Authenticated client |
| `/loyalty/credits` | Credit history | Authenticated client |
| `/member/wallet` | Smart wallet | Authenticated client |
| `/prestige-club` | Prestige membership | Authenticated client |

---

## 6. Provider Application Workflow

### 6.1 State Machine (8 states)

```
                         ┌─────────────┐
                         │  submitted  │ ← User submits form
                         └──────┬──────┘
                                │ (async KYC2026 starts)
                         ┌──────▼──────┐
                         │ processing  │ ← KYC engine running
                         └──────┬──────┘
                    ┌───────────┼───────────┐
           ┌────────▼──┐  ┌────▼────┐  ┌───▼──────────────┐
           │ approved  │  │rejected │  │  pending_review   │
           │(auto-pass)│  │(auto-   │  │ (flags raised,    │
           └───────────┘  │reject)  │  │  human needed)    │
                          └─────────┘  └──────┬────────────┘
                                              │
                               ┌──────────────▼──────────────┐
                               │     Human review (Support)   │
                               └──┬──────────┬───────────────┘
                          ┌───────▼──┐  ┌────▼──────────────┐
                          │ approved │  │     rejected       │
                          └──────────┘  └────────────────────┘
                                              │ (if resubmit requested)
                                    ┌─────────▼───────────┐
                                    │ pending_resubmission │ ← Token sent
                                    └─────────┬───────────┘
                                              │ (applicant uploads)
                                         back to processing
                                    
   ┌──────────┐   ┌──────────┐
   │ expired  │   │withdrawn │ ← Can happen from most states
   └──────────┘   └──────────┘
```

### 6.2 KYC Decision Engine Rules

| Condition | System Decision |
|-----------|----------------|
| face ≥ 78 AND liveness ≥ 70 AND ocr ≥ 70 AND no fraud flags | `approved` |
| face < 30 OR liveness < 30 | `rejected` |
| 0 quality flags, face 55-78 | `pending_review` |
| ≥ 2 quality flags AND face ≥ 55 | `pending_resubmission` |
| face 30-55 OR (1 quality flag AND liveness ok) | `pending_review` |
| fraud score > 80 | `rejected` |
| fraud score 40-80 | `pending_review` + fraud flag |

### 6.3 Resubmission Rules
- Maximum 3 resubmission requests per application
- Each request generates a secure 32-byte base64url token
- Token expires in 5 days
- On resubmission: `resubmission_count++`, status back to `processing`
- Admin can see version history (previous vs latest uploads)

---

## 7. Dashboard Specifications by Role

### 7.1 Support / Operations Dashboard (`/admin/provider-review`)

**Current state:** Basic list with fraud badges and links — functional but not fully spec'd.

**Required columns/fields:**
| Field | Display | Sorting |
|-------|---------|---------|
| Application ID | Font-mono badge | — |
| Full name | Bold | Alpha |
| Provider type | Pill badge | Filter |
| Email + phone | Secondary text | — |
| Status | Color-coded badge | Filter |
| Face score | Numeric + color | ✅ |
| Liveness score | Numeric + color | ✅ |
| OCR confidence | Numeric + color | ✅ |
| Fraud risk | Badge (low/medium/high/critical) | Filter |
| KYC flags | Count badge | Filter |
| Unread messages | Unread count dot | ✅ |
| Assigned reviewer | Avatar/name | Filter (mine/all) |
| Age of application | Relative time | ✅ |
| SLA due | Countdown / overdue badge | ✅ |
| Queue priority | Urgent/Normal/Low | Filter |

**Required actions:**
- Filter by: status, type, fraud level, assigned reviewer, priority, date range
- Sort by: age, score, priority
- Assign to self
- Quick links: open detail, send message
- Badge count in nav (open + urgent)
- 60-second auto-poll (already implemented)

---

### 7.2 Application Detail Page (`/admin/providers/review/:id`)

**Current state:** 3-tab (Review | Messages | Audit Trail) — largely complete.

**Missing from current implementation:**
1. **File section improvements:**
   - Zoom / open full-screen for selfie and ID photos
   - Download original button
   - Version compare (if resubmission exists: "Previous" vs "Latest" side-by-side)
   - Inline PDF preview if document is PDF
   - File metadata (upload timestamp, file size, type)

2. **Layout:**
   - Desktop: 3 columns (files | extracted data + scores | actions + inbox)
   - Mobile: stacked cards + sticky action bar (approve/reject/resubmit)
   - iPad: 2-column

3. **Assign reviewer panel** (currently missing in the UI — route exists)

4. **Extracted fields from OCR:**
   - Extracted name (if available from raw SQL columns)
   - Extracted DOB
   - Extracted expiry
   - Extracted country
   - Document number last 4

---

### 7.3 Management Dashboard (NOT YET BUILT)

**Route:** `/mgmt/kyc/overview` (pending)  
**Permission:** `management` + `admin` + `super_admin` only  
**Key constraint:** Management sees NO individual application details — aggregate only.

**Required KPIs:**

| KPI | Calculation | Visualization |
|-----|-------------|---------------|
| Total applications (all time) | COUNT | Number card |
| Applications this week | COUNT WHERE created ≥ 7d | Number card + trend |
| Pending review now | COUNT WHERE status = pending_review | Number card + urgency |
| Pending resubmission | COUNT WHERE status = pending_resubmission | Number card |
| Approval rate (30d) | approved / total × 100 | Percentage + sparkline |
| Rejection rate (30d) | rejected / total × 100 | Percentage + sparkline |
| Average review time | AVG(reviewed_at - submitted_at) for decided | Hours/days + histogram |
| Queue aging | Distribution by days in queue | Stacked bar chart |
| Fraud spikes | fraud_flags count by day | Line chart |
| KYC processing failures | status=error or stuck processing | Alert count |
| Email delivery failures | delivery_status=failed in messages | Count by day |
| Reviewer workload | COUNT per assigned_to | Bar chart |

**Query sources:**
- `provider_applications` — status, timestamps
- `provider_review_queue` — queue entries, assignment, priority
- `provider_review_audit` — audit events with timestamps
- `provider_workflow_events` — processing failures, timing
- `provider_application_messages` — delivery status failures

---

### 7.4 Provider Dashboard (Applicant-Facing)

**Route:** `/provider-application/status`  
**Current state:** Built (ProviderApplicationStatus.tsx) — functional but minimal.

**Required elements:**
- Progress stepper (Submitted → Processing → Under Review → Approved) ✅
- Per-status contextual cards ✅
- Message thread (provider-visible only) ✅
- Withdraw button (pending/processing/pending_review) ✅
- Resubmission upload link when pending_resubmission ✅
- 30-second auto-refresh ✅

**Missing:**
- After approval: access to Provider OS (button/link to `/provider-os`)
- Uploaded file preview (show what they submitted)
- Resubmission version history (what they uploaded each time)

---

### 7.5 Loyalty Member Dashboard

**Routes:** `/loyalty/dashboard`, `/loyalty/wallet`, `/member/wallet`  
**Current state:** Exists in codebase.

**Critical separation rule:** No provider workflow logic must appear here. Loyalty members must never see:
- Application status
- KYC scores or flags
- Admin review notes
- Any provider onboarding UI element

---

## 8. File Handling Architecture

### 8.1 Storage Rules
- All files stored in Firebase/GCS (never public URLs)
- Access via signed URLs with short TTL (30 minutes)
- Signed URL generation happens server-side in the admin detail route
- Files never directly accessible without going through the signed URL broker

### 8.2 Required File Viewer Features

| Feature | Status | Priority |
|---------|--------|----------|
| Signed URL generation (selfie + ID) | ✅ Built | — |
| Inline image preview | ✅ Built (img tag) | — |
| Image zoom / pan | ❌ Missing | HIGH |
| Open full-screen | ❌ Missing | HIGH |
| Download original | ❌ Missing | HIGH |
| Inline PDF preview | ❌ Missing | MEDIUM |
| Version history list | ❌ Missing | MEDIUM |
| Side-by-side compare (prev vs latest) | ❌ Missing | HIGH |
| File metadata (size, type, uploaded_at) | ❌ Missing | LOW |

### 8.3 Version Compare Architecture

When an applicant resubmits, the system must:
1. Store new file URLs in `provider_application_resubmissions` table (already has this table)
2. Keep the original URLs in `provider_applications.selfie_photo_url` and `government_id_url`
3. The admin review page must:
   - Detect if `resubmission_count > 0`
   - Fetch previous file URLs from `provider_application_resubmissions`
   - Show a "Previous / Latest" toggle or side-by-side layout

### 8.4 File Viewer Component Design

```
┌─────────────────────────────────────┐
│  [Selfie]              [Government ID] │
│  ┌──────────────┐  ┌──────────────┐   │
│  │              │  │              │   │
│  │   [image]    │  │   [image]    │   │
│  │              │  │              │   │
│  └──────────────┘  └──────────────┘   │
│  [🔍 Zoom] [⬇ Download] [⛶ Full]    │
│  [← Previous] [Latest →]  (if resub) │
└─────────────────────────────────────┘
```

---

## 9. Communication System

### 9.1 Thread Architecture (Already Built)

Every application gets a thread (`provider_application_threads`).

Thread messages (`provider_application_messages`) have:
- `direction`: `outbound` | `inbound` | `internal_note`
- `channel`: `email` | `sms` | `system` | `internal_note`
- `provider_visible`: boolean
- `delivery_status`: `queued` | `sent` | `failed` | `delivered` | `opened`
- `sent_by`: who sent it

### 9.2 What's Built
- ✅ Thread creation on queue entry
- ✅ Admin sends internal notes
- ✅ Admin sends outbound email (via SendGrid)
- ✅ System messages logged automatically
- ✅ Unread count tracking
- ✅ Admin reads thread (marks read)
- ✅ Applicant reads provider-visible messages

### 9.3 What's Missing
| Feature | Priority |
|---------|----------|
| Applicant can reply (inbound message) | HIGH |
| SendGrid webhook → update delivery_status to `delivered`/`opened` | MEDIUM |
| Unread count badge on admin queue per row | MEDIUM |
| Inbox view across all applications (unified) | LOW |
| SMS channel (Twilio) | LOW |

### 9.4 Applicant Email Templates
All emails sent from `noreply@petwash.co.il`:
- Submission confirmation (on submit)
- Processing complete / pending review (on status change)
- Resubmission request (with upload link)
- Approval confirmation (with provider ID)
- Rejection notification

---

## 10. Management Analytics

### 10.1 Data Sources (All Already Exist)

| Table | What it provides |
|-------|-----------------|
| `provider_applications` | Status, timestamps, assigned reviewer, fraud level |
| `provider_review_queue` | Queue entries, assignment, priority, completion time |
| `provider_review_audit` | Every status change event, who did what, when |
| `provider_workflow_events` | Processing milestones, failures, durations |
| `provider_application_messages` | Delivery status, failure counts |
| `provider_application_resubmissions` | Resubmission counts, token usage |

### 10.2 Required Analytics Queries

```sql
-- Approval / rejection rates (last 30 days)
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as pct
FROM provider_applications
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND status IN ('approved', 'rejected')
GROUP BY status;

-- Average review time
SELECT
  AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600) as avg_hours
FROM provider_applications
WHERE reviewed_at IS NOT NULL AND submitted_at IS NOT NULL;

-- Queue aging buckets
SELECT
  CASE
    WHEN NOW() - submitted_at < INTERVAL '1 day' THEN '0-24h'
    WHEN NOW() - submitted_at < INTERVAL '3 days' THEN '1-3d'
    WHEN NOW() - submitted_at < INTERVAL '7 days' THEN '3-7d'
    ELSE '7d+'
  END as bucket,
  COUNT(*) as count
FROM provider_applications
WHERE status IN ('pending_review', 'pending_resubmission')
GROUP BY bucket;

-- Reviewer workload
SELECT
  assigned_to,
  COUNT(*) as assigned,
  COUNT(CASE WHEN completed_at IS NULL THEN 1 END) as open
FROM provider_review_queue
GROUP BY assigned_to;

-- Fraud spikes (by day)
SELECT
  DATE(created_at) as day,
  COUNT(*) as fraud_flags_raised
FROM provider_review_audit
WHERE event_type = 'fraud_detected'
GROUP BY day
ORDER BY day DESC;
```

### 10.3 API Endpoints to Build

```
GET /api/provider-onboarding/mgmt/overview
  → totals, trends, rates, avg_time

GET /api/provider-onboarding/mgmt/aging
  → queue aging distribution

GET /api/provider-onboarding/mgmt/reviewer-workload
  → per-reviewer open/completed counts

GET /api/provider-onboarding/mgmt/fraud-trend?days=30
  → fraud flag counts by day

GET /api/provider-onboarding/mgmt/system-health
  → processing failures, email delivery failures, stuck items
```

**Permission:** All `/mgmt/*` routes require `management` or higher role.

---

## 11. Responsive Design Strategy

### 11.1 Application Detail Page Layout

**Mobile (< 768px):**
```
┌──────────────────────┐
│ ← Back    [STATUS]  │  ← Sticky header
├──────────────────────┤
│ [Name + App ID]      │
│ [Status badge]       │
├──────────────────────┤
│ [Selfie]             │  ← Full width
│ [ID Photo]           │  ← Full width, collapsible
├──────────────────────┤
│ [KYC Scores]         │  ← 3-col grid
├──────────────────────┤
│ [OCR Fields]         │  ← Collapsible
│ [Review Flags]       │
│ [Fraud Anomalies]    │
├──────────────────────┤
│ [Messages/Audit tab] │
├──────────────────────┤
│ [APPROVE] [REJECT]   │  ← Sticky bottom action bar
│ [REQUEST RESUBMIT]   │
└──────────────────────┘
```

**iPad (768–1024px):** 2-column: photos left | data right; actions at bottom

**Desktop (≥ 1024px):**
```
┌────────────┬──────────────────┬─────────────────┐
│  PHOTOS    │  EXTRACTED DATA  │  ACTIONS        │
│  (selfie)  │  + KYC SCORES    │  + INBOX        │
│  (ID)      │  + FLAGS         │  + AUDIT TRAIL  │
│  [zoom]    │  + ANOMALIES     │                 │
│  [compare] │                  │                 │
└────────────┴──────────────────┴─────────────────┘
```

### 11.2 Queue List (Support Dashboard) — Responsive

**Mobile:** Card-based stack (not table), with swipe-to-assign gesture
**Desktop:** Full data table with sortable columns and inline quick-actions

---

## 12. Security Architecture

### 12.1 Auth Patterns

```typescript
// Backend auth: admin routes
x-admin-secret: $ADMIN_SECRET   // machine-to-machine
Authorization: Bearer <firebase_token>  // verified with auth.verifyIdToken(token, true)

// Role check
requireAdmin middleware → sets req.body.adminUid + req.body.adminEmail
```

### 12.2 Signed URL Rules
- All file URLs must go through the backend signed URL broker
- TTL: 30 minutes for review, 5 minutes for download
- Never expose raw GCS/Firebase storage paths to any frontend
- Signed URLs are generated per-request in the admin detail endpoint

### 12.3 Token-Based Resubmission
- 32-byte base64url token, stored in `provider_application_resubmissions`
- Expires in 5 days
- Single-use concept (mark `fulfilled_at` on successful upload)
- No auth required to use (token IS the auth)

### 12.4 Critical Security Rules
- RBAC enforced server-side, never frontend-only
- Row-level isolation: applicant routes only return own UID's data
- No cross-role data leakage: management endpoints must never return individual case data
- Audit every status transition (already built)
- Rate limit resubmission upload endpoint (not yet built)

---

## 13. What Is Built vs What Is Missing

### 13.1 ✅ Fully Built

| Component | Location |
|-----------|----------|
| 8-state backend state machine | `server/routes/provider-onboarding.ts` |
| KYC decision engine | `server/services/providerDecisionEngine.ts` |
| Review queue service | `server/services/providerQueue.ts` |
| Audit trail service | `server/services/providerAudit.ts` |
| Message log service | `server/services/providerMessageLog.ts` |
| Monitoring event service | `server/services/providerMonitoring.ts` |
| 7 new DB tables (raw SQL) | Applied via code_execution |
| 12 new columns on provider_applications | Applied via code_execution |
| Resubmission request route (token + email) | `POST /admin/applications/:id/resubmit-request` |
| Queue list route + badge count | `GET /admin/applications/queue` |
| Assign route | `POST /admin/applications/:numericId/assign` |
| Audit trail route | `GET /admin/applications/:numericId/audit` |
| Message thread routes | `GET/POST /admin/applications/:numericId/messages` |
| Applicant status route | `GET /my/status` |
| Applicant messages route | `GET /my/messages` |
| Admin review page (3-tab) | `ProviderKycReview.tsx` |
| Applicant status page | `ProviderApplicationStatus.tsx` |
| Google Sheets async export log | Fire-and-forget on submission (compliant) |

---

### 13.2 ⚠️ Partially Built

| Component | Gap |
|-----------|-----|
| Admin review layout | Desktop 3-column not implemented |
| File viewer | No zoom, fullscreen, download, or PDF preview |
| Version compare | DB table exists, UI missing |
| Applicant status page | Missing post-approval Provider OS link |
| Queue list UI | Missing SLA countdown, unread count column |
| Role separation | `requireAdmin` covers all admin; Support vs Management split not enforced in provider routes |

---

### 13.3 ❌ Not Yet Built

| Component | Priority |
|-----------|----------|
| Management analytics dashboard | HIGH |
| Management API endpoints (`/mgmt/*`) | HIGH |
| File zoom / fullscreen viewer component | HIGH |
| Resubmission version compare (side-by-side) | HIGH |
| Responsive 3-column review layout | HIGH |
| Mobile sticky action bar on review page | HIGH |
| Applicant reply channel (inbound messages) | MEDIUM |
| SendGrid delivery webhook (update delivery_status) | MEDIUM |
| Trainee role + upgrade workflow | MEDIUM |
| Queue assign via UI (assign button on queue list) | MEDIUM |
| Unread count per row in queue list | MEDIUM |
| Unified inbox view across all applications | LOW |
| PDF inline preview | LOW |
| File metadata display | LOW |
| Rate limiting on resubmission upload | LOW |

---

## 14. Implementation Roadmap

### Phase 1: Security Hardening + Role Separation (IMMEDIATE)
**Goal:** Ensure no role leakage before adding more features.

1. Create `requireManagement` middleware that checks Firebase custom claims for `management`/`admin`/`super_admin`
2. Create `requireSupport` middleware that checks for `staff`/`admin`/`super_admin`
3. Protect all `/mgmt/*` routes with `requireManagement`
4. Protect all ops review routes with `requireSupport`
5. Verify applicant routes (`/my/status`, `/my/messages`) can only return own UID data

---

### Phase 2: File Review UX (HIGH VALUE)
**Goal:** Make document review actually usable.

1. Build `FileViewer` React component:
   - Image with zoom (CSS transform + scroll, or react-medium-image-zoom)
   - Full-screen modal
   - Download original button (proxy through signed URL)
   - "Previous / Latest" toggle when resubmission exists
2. Fetch resubmission file history from `provider_application_resubmissions` table
3. Side-by-side compare panel for selfie + ID across submissions

---

### Phase 3: Responsive Review Layout
**Goal:** Review works on iPhone, iPad, and management screens.

1. Implement 3-column desktop grid in `ProviderKycReview.tsx`
2. Implement mobile stacked cards with sticky action bar
3. Implement iPad 2-column collapse

---

### Phase 4: Management Analytics Dashboard
**Goal:** Give management strategic visibility without operational access.

1. Add `/mgmt/*` backend routes with aggregate queries
2. Build `ManagementKycDashboard.tsx` page
3. Register at `/admin/providers/analytics` (management-only route)
4. Components: KPI cards, approval trend chart, queue aging chart, reviewer workload bar, fraud spike line

---

### Phase 5: Communication Completion
**Goal:** Complete the full two-way communication loop.

1. Applicant reply endpoint (provider writes inbound message)
2. SendGrid webhook receiver → update delivery_status in messages table
3. Unread count column in support queue list

---

### Phase 6: Queue UI Improvements
**Goal:** Make the support queue fully operational.

1. SLA countdown/overdue badge per row
2. Unread message count dot per row
3. Assign-to-self button on queue
4. Filter by: assigned to me, unread, overdue, fraud level

---

## 15. Google Tools Usage Rules

### Current Correct Usage

| Integration | How it's used | Compliant? |
|-------------|--------------|-----------|
| Google Sheets | `GoogleSheetsService.logProviderApplication()` — called **without await** on submission as an async export | ✅ YES — fire-and-forget export, not a decision point |
| Google Sheets | Management summary reports | ✅ YES — if used |
| Google Drive | Backup copies of exports | ✅ YES — if used |

### Prohibited Uses (These Must Never Be Added)

| Prohibited Pattern | Why |
|-------------------|-----|
| Reading from Google Sheets to make KYC decisions | Sheets is not the system of record |
| Blocking on Google Sheets write (with `await`) | Creates operational dependency |
| Using Google Forms as intake system of record | Forms cannot track statuses, audit, or messages |
| Storing approval decisions in Sheets | PostgreSQL is the authority |
| Using Sheets as the queue | The real queue is in `provider_review_queue` |

### Rule of Thumb
> "Write to Google tools to inform humans. Never read from them to make decisions."

---

## Appendix A: Database Tables Reference

### Core Tables (Drizzle ORM)
- `provider_applications` — main application record
- `users` — platform users

### New Tables (Raw SQL, not in Drizzle schema)
- `provider_review_queue` — one row per application in queue
- `provider_application_threads` — one thread per application
- `provider_application_messages` — all messages in threads
- `provider_application_resubmissions` — per-resubmission request records + tokens
- `provider_review_audit` — immutable audit event log
- `provider_workflow_events` — processing milestones + failures
- `provider_application_files` — file version history

### New Columns on `provider_applications` (Raw SQL)
- `sub_status` — human-readable sub-status label
- `extracted_name`, `extracted_dob`, `extracted_document_number_last4`, `extracted_expiry`, `extracted_country` — OCR fields
- `fraud_flags` (JSONB) — detected fraud indicators
- `resubmission_count` — 0-3 counter
- `last_requested_resubmission_at`, `last_resubmitted_at` — timestamps
- `communication_thread_id` — FK to thread
- `manual_decision_reason` — admin override reason

---

## Appendix B: API Naming Conventions

All provider-onboarding routes are mounted at `/api/provider-onboarding/`:

| Prefix | Audience | Auth |
|--------|----------|------|
| `/api/provider-onboarding/admin/` | All admins (staff + management + super) | `requireAdmin` |
| `/api/provider-onboarding/mgmt/` | Management only | `requireManagement` (to build) |
| `/api/provider-onboarding/ops/` | Support/ops only | `requireSupport` (to build) |
| `/api/provider-onboarding/my/` | Authenticated applicant | Firebase Bearer token |
| `/api/provider-onboarding/` (root) | Public (submit, resubmit) | Firebase Bearer or token-based |

---

*End of PetWash Product Specification v2.0*
