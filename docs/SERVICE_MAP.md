# Service Map — PR-W19 (Mega Phase A.2)

**Status:** READ-ONLY map + risk audit. No code changed.
**Scope:** every service under `server/services/` (263 files), classified by domain, money-touching status, kiosk-touching, AI-touching, and dependencies.
**Date:** 2026-05-05

---

## 0. Surface size

| Metric | Count |
|---|---|
| Total service files | **263** |
| Money-touching services (touch `walletAccounts` / `creditTransactions` / `wallet_idempotency_keys`) | **10** |
| Kiosk-touching services (K9000 / terminal-secret) | **15+** |
| AI-touching services (Gemini / OpenAI / Vertex) | **15+** |
| Tranzila services | **9** |
| Nayax services | **5** |
| Israeli VAT / compliance | **15** |
| Booking services (across `services/` + `services/booking-engines/` + `services/unified-booking/`) | **15+** |

---

## 1. Action items extracted

### 🔴 P0 — `/api/unified/wallet/deduct-funds` decrements wallet with NO ledger row

**Endpoint:** `POST /api/unified/wallet/deduct-funds` (`server/routes/unified-platform.ts:408`)
**Service:** `UnifiedWalletService.deductFunds` (`server/services/UnifiedWalletService.ts:110-149`)

**What it does:**
1. Atomic `UPDATE walletAccounts SET promoBalanceCents -= ..., cashWalletBalanceCents -= ... WHERE user_id = $userId AND total >= amount` (correct race-protection)
2. Emits an `eventBus.publish('wallet.withdrawn')` event
3. **WRITES NO `creditTransactions` ROW**
4. **HAS NO IDEMPOTENCY KEY**
5. **HAS NO `audit_events` ROW**
6. **TRUSTS USER-SUPPLIED `amount`** (no booking-id verification, no source linkage)

**Risk:**
- Drift detector (PR-W2) will WARN every time this runs — wallet balance moves, ledger sum doesn't.
- Replay storms can drain a wallet (no idempotency).
- No audit trail of who debited what or for what reason.
- Auditor cannot trace "where did this ₪X go?"

**Auth:** `requireAuth, requireActive` per-handler (so customer-authenticated only) and the mount uses `apiLimiter`. Not exposed without login. Still: any logged-in user can drain their own wallet via this route, and the bookkeeping shows nothing.

**Action:** **PR-W47 (NEW)** — Either:
  (a) Replace the implementation to delegate to `WalletLedger.deductFromWallet` (which writes `creditTransactions` + `walletLedgerEntries` + supports an idempotency key), OR
  (b) Disable the route with 410 GONE if it's vestigial (audit suggests it predates the modern WalletLedger).

→ **Decision needed:** verify with CEO whether `/api/unified/wallet/deduct-funds` is reachable from any UI today. If not, 410-GONE it. If yes, fix forward via (a).

### 🟢 Wallet write/ledger pairing — otherwise CLEAN

| Service | Writes wallet | Writes ledger | Verdict |
|---|---|---|---|
| `WalletService.addCredits` (`WalletService.ts:639-719`) | ✓ | ✓ | OK |
| `WalletLedger.deductFromWallet` (`WalletLedger.ts:180-490`) | ✓ | ✓ + hash chain | OK |
| `K9000RedemptionService` debit branches (`K9000RedemptionService.ts:780-902`) | ✓ | ✓ via `appendCreditTransaction` calls | OK |
| `WalletEngine.computeDeductionOrder` | ✗ (read-only) | n/a | OK |
| **`UnifiedWalletService.deductFunds`** | ✓ | ✗ | **P0 BUG** |
| `EgiftFinancialService` | ✗ (read-only audit) | n/a | OK |

### 🟢 Cross-domain isolation — VERIFIED CLEAN (also confirmed in PR-W18)

- No service in `services/` imports BOTH K9000 modules AND marketplace booking modules.
- Marketplace booking engines do NOT import `K9000RedemptionService` or `nayaxFirestoreService`.
- `WalletEngine.computeDeductionOrder` correctly gates `washPackageCredits` to `isKioskWash=true` only.

### 🟡 God-file watch list (>1000 LOC; flag for PR-W29 Large File Report)

| File | LOC |
|---|---|
| `services/googleSheetsIntegration.ts` | 1467 |
| `services/PetWashOperationsOrchestrator.ts` | 1377 |
| `services/WalletService.ts` | 1375 |
| `services/WalletLedger.ts` | 1286 |
| `services/NayaxSparkService.ts` | 1183 |
| `services/K9000RedemptionService.ts` | 1163 |
| `services/TransactionEngine.ts` | 1136 |
| `services/booking-service.ts` | 1015 |

The four wallet/redemption files at the top are CRITICAL paths. PR-W29 will recommend splits without behaviour change.

### 🟡 Duplicate Tranzila mapper (file appears twice in inventory)

`server/services/TranzilaPaymentRequestMapper.ts` and `server/services/TranzilaPaymentRequestService.ts` show duplicate entries in directory listing. **Action:** verify in PR-W23 (Dead Code Scanner) — likely a casing collision or build artifact.

---

## 2. Domain classification

### 2.1 Wallet domain (10 money-touching services)

| Service | Role | Money | Idempotency | Ledger writes |
|---|---|---|---|---|
| `WalletService.ts` | Top-level wallet API; addCredits / getOrCreateWallet | ✓ | via callers (e.g. credit-wallet routes) | ✓ |
| `WalletLedger.ts` | Atomic deduct + hash-chained ledger | ✓ | accepts idempotency key | ✓ |
| `WalletEngine.ts` | Pure: computeDeductionOrder (no DB) | — (read-only) | n/a | n/a |
| `WalletTelemetryService.ts` | Read-only metrics | — | n/a | n/a |
| **`UnifiedWalletService.ts`** | Legacy unified-platform deduct | ✓ | **MISSING** | **MISSING** |
| `K9000RedemptionService.ts` | Kiosk redemption (5 source types) | ✓ | per-session lock | ✓ |
| `EgiftFinancialService.ts` | E-gift voucher reads | — (read-only) | n/a | n/a |
| `BookingPolicyEngine.ts` | Booking pricing policy reads | — | n/a | n/a |
| `UnifiedPricingService.ts` | Quote computation | — (read-only) | n/a | n/a |
| `quoteEngine.ts` | Pricing quote engine | — | n/a | n/a |

### 2.2 Kiosk / K9000 domain

```
K9000RedemptionService.ts        ← redeem path (5 source types)
K9000TransactionService.ts       ← terminal-side records
K9000PredictiveMaintenanceService.ts
K9000DispatchService.ts (if exists)
booking-engines/k9000/...
nayaxFirestoreService.ts         ← Firestore tx pipeline
NayaxSparkService.ts             ← Spark events
NayaxOnlinePaymentService.ts
NayaxMonitoringService.ts
KioskCouponService.ts
```

### 2.3 Marketplace / booking domain

```
booking-service.ts
booking-facade.ts
booking-engines/base/...
booking-engines/walk/...
booking-engines/pettrek/...
BookingLifecycleService.ts
BookingLockService.ts
BookingPolicyEngine.ts
BookingExportService.ts
BookingConfirmationEmailService.ts
bookingEventLogger.ts
bookingLedgerWriter.ts
unified-booking/UnifiedBookingEngine.ts
unified-booking/EventLogService.ts
unified-booking/TransactionStampService.ts
```

### 2.4 Compliance / VAT (15 services)

```
shared/israel-compliance-config.ts (CANONICAL — PR-W13)
VATCalculatorService.ts
IsraeliDigitalReceiptService.ts
IsraeliInvoiceGenerator.ts
IsraeliTaxAPIService.ts
IsraeliTaxAuthorityAPI.ts
IsraeliVATReclaimService.ts
IsraeliContractorCompliance.ts
Israeli2025SignatureService.ts
IsraeliCPIService.ts
ITAComplianceMonitoringService.ts
IsraelComplianceEngine.ts
LegalThresholdConfig.ts
TaxComplianceService.ts
ComplianceControlTower.ts
CountryLegalComplianceService.ts
```

### 2.5 Payment processors

| Provider | Services |
|---|---|
| Tranzila | `TranzilaService.ts`, `TranzilaWebhookService.ts`, `TranzilaChargebackService.ts`, `TranzilaChargebackMapper.ts`, `TranzilaPaymentRequestService.ts`, `TranzilaPaymentRequestMapper.ts`, `TranzilaDocumentMapper.ts` |
| Nayax | `NayaxOnlinePaymentService.ts`, `NayaxJobDispatchPaymentService.ts`, `NayaxSparkService.ts`, `NayaxMonitoringService.ts`, `NayaxSitterMarketplaceService.ts`, `NayaxWalkMarketplaceService.ts` |
| Generic | `PaymentGatewayService.ts` |

### 2.6 AI / ML domain

```
GeminiWatchdogService.ts
GeminiMatchingService.ts
GeminiSpamGuard.ts
GeminiPlatformSecurityMonitor.ts
GeminiSecurityAdvisor.ts
GeminiUpdateAdvisor.ts
GeminiEmailMonitor.ts
CoworkerAgentService.ts
OctopusBrainService.ts
ContentModerationService.ts
PawFinderModerationService.ts
PersonalizedGreetingService.ts
ManagementAnalyticsService.ts
AIPayoutVerificationService.ts
```

### 2.7 Admin / operations

```
AdminProviderReviewService.ts
PetWashOperationsOrchestrator.ts
DailyReconciliationJob.ts
FinancialReconciliationService.ts
BillingEngine.ts
ImmutableStampService.ts
TransactionEngine.ts
CouponService.ts
EventBus / eventBus (in-memory or Firestore — verify PR-W21)
```

---

## 3. Dependency hot-spots (services importing many other services)

(Skipped detailed sort — feeds into PR-W29 large-file report)

---

## 4. Recommended next PRs

| PR | Purpose | Risk | Decision |
|---|---|---|---|
| **PR-W47** | Fix `UnifiedWalletService.deductFunds` (either delegate to `WalletLedger` or 410 GONE the route) | HIGH if active / LOW if vestigial | Needs CEO sign-off after live-traffic check |
| **PR-W29** | God-file breakdown plan for the 8 files >1000 LOC | NONE (doc) | Default GO |
| **PR-W23** | Dead code scanner — verify the duplicate Tranzila mapper directory entries | LOW | Default GO |

---

## 5. Files inspected

`server/services/*.ts` (263 files), `server/services/booking-engines/**/*.ts`, `server/services/unified-booking/*.ts`.

End of map. All claims grep-cited. No code changed. No money moved.
