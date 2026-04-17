# PROVIDER_DEPRECATION_PLAN.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD)  
> Generated: 2026-04-17 from 8-agent platform recovery audit  
> Status: ANALYSIS ONLY — no routes changed in this file

---

## Route Truth (Current Branch HEAD)

| Route | Component | Destination | Status |
|---|---|---|---|
| `/become-provider` | BecomeProvider.tsx | Redirects to `/provider-onboarding?type=<type>` | CANONICAL ENTRY |
| `/provider-onboarding` | ProviderOnboarding.tsx | Submits to `POST /api/provider-onboarding/apply` | CANONICAL SUBMIT |
| `/provider-os` | ProviderOS.tsx | Post-approval dashboard | CANONICAL DASHBOARD |
| `/join/walker` | — | `<Redirect to="/become-provider?type=walker" />` | REDIRECT (safe) |
| `/join/sitter` | — | `<Redirect to="/become-provider?type=sitter" />` | REDIRECT (safe) |
| `/join/trainer` | — | `<Redirect to="/become-provider?type=trainer" />` | REDIRECT (safe) |
| `/apply-provider` | — | `<Redirect to="/become-provider" />` | REDIRECT (safe) |
| `/join-team` | — | `<Redirect to="/become-provider" />` | REDIRECT (safe) |

**File references:** client/src/App.tsx:1115-1123, 2065-2091

---

## Provider Tables — Classification

| Table | schema.ts Line | Status | Notes |
|---|---|---|---|
| `providerApplications` | 5027 | **CANONICAL** | Single source for all provider intake; KYC2026 async verification |
| `walkerProfiles` | 4562 | **CANONICAL** | Walker-specific profile; currently created by legacy `/api/walk-my-pet/walkers` |
| `sitterProfiles` | 3996 | **CANONICAL** | Sitter-specific profile; created by legacy `/api/sitter-suite/sitters` |
| `trainers` | 6915 | **CANONICAL** | Trainer profile; admin-only creation via `/api/academy/admin/trainers` |
| `providerProfiles` | 12283 | **DENORMALIZED** | Computed from booking_requests for search/ranking; NOT written by onboarding |
| `pettrekProviders` | 5415 | **LEGACY** | Driver system; not integrated with providerApplications approval flow |
| `octopusProviders` | 11805 | **ABANDONED** | Never written by modern flows |
| `providerIntakeQueue` | 5145 | **LEGACY** | Google Forms manual intake; optional |
| `providerApplicants` | schema-enterprise.ts | **DEPRECATED** | Written only by deprecated `/api/provider-applications`; telemetry active |

---

## Submit Endpoints — Classification

| Endpoint | File | Table | Status |
|---|---|---|---|
| `POST /api/provider-onboarding/apply` | provider-onboarding.ts:400 | providerApplications | **CANONICAL** |
| `POST /api/provider-applications` | provider-applications.ts:270 | providerApplicants | **DEPRECATED** — `logDeprecatedCall()` + RFC 8594 headers active |
| `POST /api/walk-my-pet/walkers` | walk-my-pet.ts | walkerProfiles | LEGACY BYPASS — creates walkerProfiles directly |
| `POST /api/sitter-suite/sitters` | sitter-suite.ts:348 | sitterProfiles | LEGACY BYPASS — creates sitterProfiles directly |
| `POST /api/academy/admin/trainers` | academy.ts:660 | trainers | ADMIN-ONLY — admin creates trainer profiles |

---

## Provider State Machine

```
providerApplications.status:
  draft → pending → under_review → approved | rejected | pending_resubmission | withdrawn
  
  pending_review = awaiting admin after KYC flags fraud risk

Post-approval:
  Firebase custom claims set: role='provider', providerType, providerId
  providerApplications.approvedAsProviderId = generated ID
  
CRITICAL GAP: Approval does NOT auto-create walkerProfiles/sitterProfiles/trainers
  → Provider is "approved" in providerApplications but has no profile row
  → First booking or legacy endpoint call creates the profile row
```

---

## Provider Type Mapping

| Type | Application Table | Profile Table | Post-Approval Gap |
|---|---|---|---|
| walker | providerApplications (providerType='walker') | walkerProfiles | Profile NOT auto-created |
| sitter | providerApplications (providerType='sitter') | sitterProfiles | Profile NOT auto-created |
| trainer | providerApplications (providerType='trainer') | trainers | Profile NOT auto-created, admin required |
| driver | providerApplications (providerType='driver') | pettrekProviders | SEPARATE SYSTEM, not integrated |
| station_operator | providerApplications (providerType='station_operator') | None | Metadata in internalNotes |

---

## Deprecation Plan (SAFE EXECUTION ORDER)

### Phase 1 — Already Done ✓
- `POST /api/provider-applications` deprecated with telemetry (`logDeprecatedCall()` + RFC 8594 headers)
- All frontend `/join/*` routes redirect to canonical `/become-provider`

### Phase 2 — Verify with Telemetry (30 days)
- [ ] Monitor `logDeprecatedCall()` logs for `/api/provider-applications` — if zero real callers → safe to remove
- [ ] Monitor `/api/walk-my-pet/walkers` usage — is it still used by new provider onboarding or only legacy?
- [ ] Monitor `/api/sitter-suite/sitters` creation — same question

### Phase 3 — Profile Auto-Creation on Approval (Repair)
- After approval in `provider-onboarding.ts:1436`, automatically create the profile row:
  - `walkerProfiles` INSERT for `providerType='walker'`
  - `sitterProfiles` INSERT for `providerType='sitter'`
  - `trainers` INSERT for `providerType='trainer'` (remove admin-only gate)
- No breaking changes to existing data

### Phase 4 — Remove Deprecated Endpoints (After Proof)
- Remove `POST /api/provider-applications` and related routes only after telemetry proves zero callers for 30 days
- Remove `pettrekProviders` and `octopusProviders` tables only after confirming zero writes

### DO NOT DO
- ❌ Do not drop providerApplicants table before telemetry proves zero writes
- ❌ Do not merge walkerProfiles/sitterProfiles/trainers until profile auto-creation is proven working
- ❌ Do not change the frontend onboarding flow UI (separate PR, separate decision)
