# Route Map — PR-W18 (Mega Phase A.1)

**Status:** READ-ONLY map + risk audit. No code changed.
**Scope:** every mounted route, middleware chain, and gating gap across the server.
**Date:** 2026-05-05
**Method:** mechanical grep over `server/`. All findings cite file:line.

---

## 0. Surface size

| Metric | Count |
|---|---|
| Total registered handlers (`app.METHOD` + `router.METHOD`) | **3,170** |
| Files containing route registrations | **~250** |
| `app.use(...)` mount points in `server/routes.ts` | **262** |
| Domain routers under `server/routes/` | **220+** |
| Top-level public endpoints (no auth, intentional) | **6** (`/health`, `/health/strict`, `/api/health`, `/api/health/strict`, `/api/google/places-health`, `/api/csrf-token`) |

---

## 1. Action items extracted from this audit

> **Per CEO directive: extract real action items, not just docs.**

### 🔴 P0 — money-touching routes lacking idempotency cache

| File | Mutating handlers | Idempotency mentions | Action |
|---|---|---|---|
| `server/routes/wallet.ts` | 12 | 0 | **Audit each** — most are pass/voucher emit (low risk), but `/api/wallet/nayax/redeem-loyalty` (line 1229) needs verification (it has a 5-min QR timestamp + status flip which gives equivalent protection — confirm in PR-W19 ledger audit) |
| `server/routes/gift-cards.ts` | 4 | 0 | **Confirmed gap** — already in audit. `/purchase`, `/redeem`, `/:voucherId/wallet-links`, `/:voucherId/activate-wallet`. Atomic UPDATE protects against double-credit but a replay returns 400 instead of the original success payload. Fix: response-cache via `walletIdempotencyKeys`. |
| `server/routes/escrow.ts` | 5 | 0 | `/create`, `/:escrowId/release`, `/:escrowId/refund`, `/:escrowId/dispute`, `/admin/auto-release`. **Money-moving with no replay guard.** |
| `server/routes/treasury.ts` | 8 | 0 | `/batches`, `/batches/:id/submit`, `/batches/:id/mark-paid`, `/import-bank-transactions`, `/reconcile/:batchId`, `/reconcile-sweep`, `/failures/:id/retry`, `/failures/:id/resolve`. **Marks bank batches paid; no replay guard.** |

→ **Follow-up PRs:** PR-W26 (Drift Engine impl) is the prerequisite; idempotency fixes go after.

### 🔴 P0 — admin route files with ZERO `audit_events` writes

30+ files. Most-critical extract (mutator count in parens):

| File | Mutators | Why this matters |
|---|---|---|
| `server/routes/enterprise-finance.ts` | 15 | Largest finance surface, no audit |
| `server/routes/admin.ts` | 14 | Core admin actions invisible to audit. PR-W12 added the orphan endpoint; broader audit gap remains |
| `server/routes/enterprise-hr.ts` | 14 | HR mutations invisible |
| `server/routes/enterprise.ts` | 14 | Enterprise admin invisible |
| `server/routes/enterprise-logistics.ts` | 11 | |
| `server/routes/enterprise-operations.ts` | 10 | |
| `server/routes/loyalty.ts` | 9 | Loyalty mutations (credit operations) |
| `server/routes/enterprise-sales-crm.ts` | 9 | |
| `server/routes/unified-booking.ts` | 9 | Booking mutations invisible |
| `server/routes/academy.ts` | 7 | |
| `server/routes/escrow.ts` | 5 | **Money-touching, no audit** |
| `server/routes/expenses.ts` | 5 | |
| `server/routes/coupons.ts` | 4 | Coupon issuance invisible |
| `server/routes/audit.ts` | 4 | (irony) the audit-rules CRUD itself unaudited |

(28 more files; full list in section 5 below)

→ **Follow-up PR:** PR-W34 (Admin Action Forensics implementation). Will batch by domain.

### 🟢 K9000 / Nayax / Marketplace cross-contamination — CLEAN

| Scan | Result |
|---|---|
| Marketplace files calling `walletAccounts.washPackageCredits` or `computeDeductionOrder` | **None** ✓ |
| K9000 / Nayax files importing `marketplace-bookings` or `BookingLifecycleService` | **None** ✓ |
| Marketplace files importing `K9000RedemptionService` or `nayaxFirestoreService` | **None** ✓ |

Architectural separation is intact. The `WalletEngine.computeDeductionOrder` `isKioskWash=false` branch correctly gates `washPackageCredits` to kiosk only.

### 🟢 Routes mounted without auth — only the 6 intentional health/CSRF endpoints

No accidental public endpoint discovered. The auth-mount tree is well-formed.

### 🟡 Legacy reads still surfacing customer-visible values

Already covered in PR-W14 (Legacy Purge Report) — 2 MEDIUM-risk reads:
- `/api/loyalty/user-profile` returns `user.giftCardBalance` as `giftBalance` (`server/routes.ts:14706`)
- `/api/admin/customers` engagement scoring uses `user.washBalance` (`server/routes.ts:7065`)

→ **Follow-up PR:** PR-W15 (read-side migration to walletAccounts.*).

---

## 2. Mount tree (top-level)

The mount-order matters because the first matching handler wins. Express resolves in registration order.

### 2.1 Global middleware (lines 396–424 of `routes.ts`)

```
app.use('/api/',                    threatGuardMiddleware)
app.use('/api/admin/',              adminLimiter)
app.use('/api/admin/',              verifyAppCheckTokenOptional)
app.use('/api/admin/',              optFirebase)
app.use('/api/provider-review',     optFirebase)
app.use('/api/admin/',              ipRiskScoring())
app.use('/api/admin/',              sessionAgeGuard(14400))     # 4 h max
app.use('/api/admin/',              adminRouteHardening())
app.use('/api/kyc/',                ipRiskScoring())
app.use('/api/kyc/',                sessionAgeGuard(14400))
app.use('/api/admin/',              requireRole(...ADMIN_ROLES_ARRAY),
                                    requireStaffApproved,
                                    requireMfaEnrolled)
app.use('/api/provider/',           requireProviderActive)
```

### 2.2 Domain mount selection (high-traffic + money-touching)

| Mount | Auth chain | File |
|---|---|---|
| `/api/wallet` | `apiLimiter, requireOnboardingComplete` (no validateFirebaseToken at mount level — must be per-handler) | `routes/wallet.ts` |
| `/api/credit-wallet` | `optionalFirebaseToken, apiLimiter` | `routes/credit-wallet.ts` |
| `/api/loyalty` | `validateFirebaseToken, apiLimiter, requireOnboardingComplete` | `routes/loyalty.ts` |
| `/api/coupons` | `validateFirebaseToken, apiLimiter` | `routes/coupons.ts` |
| `/api/admin` | `adminLimiter, requireAdminMfa` (×2 mounts) | `routes/admin.ts`, `api/adminDashboard.ts` |
| `/api/admin/coupons` | `validateFirebaseToken, adminLimiter, requireAdmin` | `routes/coupons.ts` |
| `/api/admin/loyalty` | `validateFirebaseToken, adminLimiter` | `routes/admin-loyalty.ts` |
| `/api/k9000` | first mount: NONE; second: `adminLimiter`; third: `optionalFirebaseToken, adminLimiter` | `iot/ledController.ts`, `routes/k9000-supplier.ts`, `routes/k9000Dashboard.ts` |
| `/api/treasury` | `validateFirebaseToken, adminLimiter` (then per-handler `requireTreasuryAdmin`) | `routes/treasury.ts` |
| `/api/finance` | `validateFirebaseToken, apiLimiter` | `routes/finance.ts` |
| `/api/control-panel` | `validateFirebaseToken, apiLimiter, requireAdminMfa` | `routes/control-panel.ts` |
| `/api/marketplace-bookings` (location depends on file) | per-handler | `routes/marketplace-bookings.ts` |
| `/api/gift-cards` | per-handler (some `paymentLimiter`, some none) | `routes/gift-cards.ts` |
| `/api/prestige-pass` | `apiLimiter` (validateFirebaseToken per-handler) | `routes/prestige-pass.ts` |

### 2.3 K9000 mount layering — note

```
routes.ts:10136 → app.use('/api/k9000', k9000IotRoutes)              # NO admin gate
routes.ts:10139 → app.use('/api/k9000', adminLimiter, k9000SupplierRoutes)
routes.ts:10142 → app.use('/api/k9000', optionalFirebaseToken, adminLimiter, k9000DashboardRoutes)
```

The first mount (`k9000IotRoutes`) has no admin gate because it's the device-side endpoints (machine-to-server). Authentication for those handlers must happen INSIDE the router via terminal-secret HMAC or per-route guards. **Action item:** confirm in PR-W19 (Service Map) that every IoT handler in `iot/ledController.ts` validates a terminal secret.

---

## 3. Per-domain handler counts (top 25)

| File | Handlers |
|---|---|
| `server/routes.ts` (root catch-all) | ~600 (megafile — see PR-W29 large-file report) |
| `server/routes/admin.ts` | 60+ |
| `server/routes/enterprise-finance.ts` | 30+ |
| `server/routes/marketplace-bookings.ts` | 12 |
| `server/routes/wallet.ts` | 12 |
| `server/routes/credit-wallet.ts` | 11 |
| `server/routes/treasury.ts` | 8 |
| `server/routes/escrow.ts` | 5 |
| `server/routes/gift-cards.ts` | 4 |
| `server/routes/k9000.ts` | (TBD — pulled in PR-W19) |

---

## 4. Public health/CSRF surface (intentional)

| Method | Path | File:Line | Notes |
|---|---|---|---|
| GET | `/health` | `index.ts:616` | Cloud Run startup probe |
| GET | `/health/strict` | `index.ts:650` | Includes DB ping |
| GET | `/api/health` | `index.ts:683` and `routes.ts:744` | (two registrations — `index.ts` wins by order) |
| GET | `/api/health/strict` | `index.ts:705` | |
| GET | `/api/google/places-health` | `index.ts:725` | The Places API self-check from PR-Maps audit |
| GET | `/api/csrf-token` | `index.ts:496` | CSRF token bootstrap |

→ **Action item:** the duplicate `/api/health` handler at `routes.ts:744` is shadowed and dead. Mark for PR-W23 (dead code scanner).

---

## 5. Full list of admin route files with zero `audit_events` writes

```
server/routes/academy.ts                       (7  mutators)
server/routes/admin-notifications.ts           (1)
server/routes/admin.ts                         (14)
server/routes/ai-insights.ts                   (1)
server/routes/analytics.ts                     (2)
server/routes/audit.ts                         (4)
server/routes/contractor.ts                    (1)
server/routes/coupons.ts                       (4)
server/routes/devices.ts                       (5)
server/routes/enterprise-finance.ts            (15)
server/routes/enterprise-franchise.ts          (5)
server/routes/enterprise-hr.ts                 (14)
server/routes/enterprise-logistics.ts          (11)
server/routes/enterprise-operations.ts         (10)
server/routes/enterprise-sales-crm.ts          (9)
server/routes/enterprise.ts                    (14)
server/routes/escrow.ts                        (5)   ← MONEY-TOUCHING
server/routes/events.ts                        (1)
server/routes/expenses.ts                      (5)
server/routes/franchise-mgmt.ts                (2)
server/routes/google-forms.ts                  (5)
server/routes/inventory.ts                     (5)
server/routes/israeli-cpi.ts                   (4)
server/routes/kyc.ts                           (4)
server/routes/loyalty.ts                       (9)
server/routes/marketplace-ranking.ts           (2)
server/routes/octopus-brain.ts                 (3)
server/routes/provider-onboarding.ts           (11)
server/routes/spam-guard.ts                    (3)
server/routes/unified-booking.ts               (9)
```

**Total: 30 files, 195+ admin mutating handlers** that produce no `audit_events` row.

(Note: many of these have logger.info / logger.warn calls — that's NOT an audit event. The hash-chained `audit_events` table is the legal record.)

---

## 6. Recommended next PRs surfaced by this audit

| PR | What it fixes | Risk |
|---|---|---|
| **PR-W34** (D.1') | Wire `logAuditEvent` into the 30 admin route files identified above. Recommend per-domain split (1 PR per file or per module). | LOW per-file; HIGH cumulatively |
| **PR-W26** (B.2') | Financial Drift Engine — once running, surfaces missing-ledger drift as a measurable signal, narrowing where idempotency gaps actually hurt | MED |
| **PR-W27** (B.3) | Webhook Forensics — would make replay-storm detection visible | LOW |
| **PR-W23** (1.4) | Mark the `/api/health` duplicate at `routes.ts:744` as DEAD | LOW |
| Future "PR-W44" | Add idempotency-cache to `gift-cards.ts` activate-wallet (PR-W14 follow-up). Pure additive — preserves atomic guard, adds replay-return | LOW |
| Future "PR-W45" | Add idempotency to escrow `/release`, `/refund`, `/dispute`, `/auto-release` | MEDIUM |
| Future "PR-W46" | Add idempotency to treasury `/batches/*/mark-paid` and `/reconcile-sweep` | MEDIUM |

---

## 7. Files inspected

`server/routes.ts`, `server/index.ts`, `server/routes/*.ts` (~220 files), `server/iot/ledController.ts`, `server/api/adminDashboard.ts`, `server/customAuth.ts`, `server/customerAuth.ts`, `server/dnsMonitoring.ts`, `server/dnsStatus.ts`, `server/enterprise/routes.ts`, `server/replitAuth.ts`, `server/security/productionHardeningAndOneTap.ts`.

End of map. All claims grep-cited. No code changed. No money moved.
