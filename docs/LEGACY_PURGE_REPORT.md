# Legacy Purge Report — PR-W14 (Phase 1.1)

**Status:** READ-ONLY audit. No code changed by this PR. No money moved.
**Date:** 2026-05-05
**Scope:** every `washBalance` / `giftCardBalance` reference in the repo, plus every legacy wallet path / DB column / dormant function still on the floor.

This is the foundation for Phase 1 cleanup. Subsequent PRs (purge, dead-code removal, money-map) reference the line numbers and risk levels in this document.

---

## 0. Risk legend

| Symbol | Meaning |
|---|---|
| 🔴 **HIGH** | Active money writer to a legacy column, or path that could re-enable the bleed. **Zero remaining post-PR-W10/W11.** |
| 🟠 **MEDIUM** | Read path that uses a legacy value for business-logic decisions (analytics, UI gating, balance display). Not a money loss but customer-visible misinformation. |
| 🟡 **LOW** | Read path that returns the legacy column in a payload but does not drive logic. Display-only. |
| 🟢 **SAFE** | Schema definition, comment, test fixture, documentation, or `0`-initialisation. |
| ⚫ **DEAD** | Compiles but is never called from a registered route or runtime entry point. |

---

## 1. `washBalance` (column on `users` and `customers`)

### 1.1 Schema (DB columns still populated by historical writes)

| File:Line | Source | Risk | Notes |
|---|---|---|---|
| `shared/schema.ts:88` | `users.washBalance: integer("wash_balance").default(0).notNull()` | 🟢 SAFE | Schema definition. No drop in this PR. |
| `shared/schema.ts:364` | `customers.washBalance: integer("wash_balance").default(0)` | 🟢 SAFE | Schema definition. |

### 1.2 Active writers — **POST PR-W10 = ZERO**

| File:Line | Source | Risk | Notes |
|---|---|---|---|
| `server/registerFounder.ts:28` | `washBalance: 0` (initial value at user creation) | 🟢 SAFE | Initialises to zero — not a bleed. |

PR-W10 (commit `4f62e8d32`) removed both bleed sites:
- `server/routes/nayax-webhooks.ts:947-956` (was `users.washBalance += washCount`)
- `server/routes.ts (POST /api/wash-history)` (was `customers.washBalance += pkg.washCount`)

The pinning test in `server/tests/wash-pack-bleed-stop.test.ts` proves no new writer can land without failing CI.

### 1.3 Active readers — return the legacy column in a response

| File:Line | Source | Risk | Notes |
|---|---|---|---|
| `server/simpleAuth.ts:56` | `washBalance: customers.washBalance` (auth login response) | 🟡 LOW | Returns 0 for new customers. UI consumes via `useSimpleAuth`. |
| `server/customerAuth.ts:121` | `washBalance: customer.washBalance` (auth response) | 🟡 LOW | Same. |
| `server/routes.ts:1986` | `washBalance: user.washBalance` inside `/api/loyalty/user-profile` | 🟡 LOW | Display field. Customer's "you have N washes" UI may show stale value. |
| `server/routes.ts:4977` | `washBalance: founderUser.washBalance` (founder endpoint) | 🟡 LOW | Founder UI. |
| `server/routes.ts:8311` | `'washBalance', 'lastLogin', ...` (admin allowlist) | 🟡 LOW | Admin export field allowlist. |
| `server/routes.ts:8582` | `user.washBalance \|\| '0'` (admin export row) | 🟡 LOW | Admin CSV export. |
| `server/routes/admin.ts:1585-1591` | `SUM(users.washBalance)`, `SUM(customers.washBalance)` | 🟢 SAFE | The new `/api/admin/wallet/legacy-balance-report` endpoint (PR-W12) — **deliberately** reads the orphan column. |

### 1.4 Active readers — drive a business-logic decision

| File:Line | Source | Risk | Notes |
|---|---|---|---|
| `server/routes.ts:7065` | `const washCount = user.washBalance \|\| 0;` inside `/api/admin/customers` analytics — feeds an "engagement score" calculation. | 🟠 MEDIUM | Post-PR-W10 the value is 0 for new wash-pack purchases. Analytics will under-count engagement. **Not a money hazard** but operator dashboard shows wrong numbers. |

### 1.5 Client-side references (UI)

| File:Line | Source | Risk | Notes |
|---|---|---|---|
| `client/src/hooks/useSimpleAuth.tsx:29` | `washBalance?: number;` (type def) | 🟡 LOW | Shape used by auth response. |
| `client/src/pages/CustomerManagement.tsx:80` | `washBalance: number;` (type) | 🟡 LOW | Admin customer table. |
| `client/src/pages/CustomerManagement.tsx:599, :868` | `{customer.washBalance}` displayed in admin UI | 🟡 LOW | Admin sees stale/zero. |
| `client/src/pages/FounderMember.tsx:132` | `{founder.washBalance}` displayed | 🟡 LOW | Founder UI. |

### 1.6 Documentation, comments, tests

`server/routes.ts:4112`, `server/routes/nayax-webhooks.ts:950`, all `server/tests/legacy-balance-report.test.ts` and `server/tests/wash-pack-bleed-stop.test.ts` references — 🟢 SAFE (PR-W10/W12 audit anchors).

---

## 2. `giftCardBalance` (column on `users` and `customers`)

### 2.1 Schema (DB columns still populated)

| File:Line | Source | Risk |
|---|---|---|
| `shared/schema.ts:89` | `users.giftCardBalance: decimal(10,2).default("0").notNull()` | 🟢 SAFE |
| `shared/schema.ts:365` | `customers.giftCardBalance: decimal(10,2).default("0")` | 🟢 SAFE |

### 2.2 Active writers — **ZERO**

The legacy `POST /api/gift-cards/redeem` was disabled in PR #123 (`legacyGiftCardRedeemHandler` returns 410 GONE). The original code at `server/routes.ts:3625-3683` is preserved as a `/* */` comment block — does NOT execute.

| File:Line | Source | Risk |
|---|---|---|
| `server/registerFounder.ts:29` | `giftCardBalance: "0.00"` (initial value) | 🟢 SAFE |
| `server/routes.ts:3660` | `giftCardBalance: sql\`${customers.giftCardBalance} + ${addedAmount}\`` | ⚫ DEAD | Inside the `/* */` forensic block. Does NOT execute. |

### 2.3 Active readers — drive UI display

| File:Line | Source | Risk | Notes |
|---|---|---|---|
| `server/routes.ts:14706` | `parseFloat(user.giftCardBalance?.toString() \|\| '0')` inside `/api/loyalty/user-profile` → returned as `giftBalance` to client | 🟠 **MEDIUM** | Customer UI may show "you have ₪X gift balance" that the kiosk cannot honour. **Misleading customer UI.** |
| `server/routes/admin.ts:1496-1518, 1575-1581` | Admin orphan endpoints (PR-W12) | 🟢 SAFE | Deliberately reads the orphan column for the operator. |

### 2.4 Documentation / comments

| File:Line | Source | Risk |
|---|---|---|
| `server/lib/legacy-gift-card-redeem-handler.ts:6` | Comment block | 🟢 SAFE |
| `server/routes.ts:3602-3623, 3673` | Forensic comment block | 🟢 SAFE |

---

## 3. Legacy `gift_cards` table

**There is no separate `gift_cards` Postgres table.** The exported symbol `giftCards` in `shared/schema.ts` is **an alias of `eVouchers`**. All `storage.createGiftCard / getGiftCard / redeemGiftCard / getAllGiftCards / getGiftCardById` functions in `server/storage.ts:1763-1810` are thin wrappers around `eVouchers` operations. Naming hangover, not data hazard.

| File:Line | Source | Risk | Action |
|---|---|---|---|
| `server/storage.ts:1765` | `createGiftCard` → `createEVoucher` | 🟢 SAFE | Wrapper. |
| `server/storage.ts:1769` | `getGiftCard` → `getEVoucherByCodeHash` | 🟢 SAFE | Wrapper. |
| `server/storage.ts:1781` | `getGiftCardById` → `getEVoucher` | 🟢 SAFE | Wrapper. |
| `server/storage.ts:1785` | `getAllGiftCards` → `select from eVouchers` | 🟢 SAFE | Wrapper. |
| `server/storage.ts:1775` | `redeemGiftCard` → `claimVoucher` | ⚫ **DEAD** | Only caller is the now-410'd legacy `/redeem` handler. Safe to delete in a follow-up PR. |

### Routes using these wrappers (still active)

| Route | File:Line | Wrapper | Risk |
|---|---|---|---|
| `POST /api/gift-cards` | `server/routes.ts:3585` | `createGiftCard` | 🟢 SAFE — admin-only, writes to eVouchers. |
| `GET /api/gift-cards/:id` | `server/routes.ts:3697` | `getGiftCardById` | 🟢 SAFE — read-only. |
| `GET /api/gift-cards` | `server/routes.ts:3744` | `getAllGiftCards` | 🟢 SAFE — admin paginated list. |
| `GET /api/admin/vouchers` | `server/routes.ts:5825` | `getAllGiftCards` | 🟢 SAFE. |
| `GET /api/admin/vouchers/export` | `server/routes.ts:5920` | `getAllGiftCards` | 🟢 SAFE — admin CSV. |

---

## 4. Dead code identified by this audit

| Item | File:Line | Why dead | Safe to delete? |
|---|---|---|---|
| `storage.redeemGiftCard` body | `server/storage.ts:1775-1779` | Only caller is the 410-disabled legacy `/api/gift-cards/redeem` handler (`server/routes.ts:3625-3683` is a `/* */` block). | ✅ **safe delete** in follow-up PR. |
| Forensic comment block in `routes.ts` | `server/routes.ts:3620-3684` | CEO-directed forensic preservation per PR #123 comment. | ⏳ **keep until orphan migration ships** (Phase 2 of the wallet plan). Then delete. |
| `washBalance` field in admin export allowlist | `server/routes.ts:8311` | Field is now always 0 for new customers. | 🟡 **needs runtime verification** — operator may still want stale legacy values exported for reconciliation. Don't auto-delete. |

---

## 5. Risk roll-up

| Risk | Count | Action required |
|---|---|---|
| 🔴 HIGH | **0** | Bleed sealed by PR-W10. |
| 🟠 MEDIUM | **2** | Two read paths leak legacy values into customer-visible UI: `/api/loyalty/user-profile` (`giftBalance`) and the admin engagement-score analytics. Fix path: switch reads to `walletAccounts.*`. Tracked as future PR-W15 (read-side migration). |
| 🟡 LOW | ~10 | Display-only legacy reads. Fold into PR-W15. |
| 🟢 SAFE | many | Schema, tests, comments, initialisations. |
| ⚫ DEAD | 2 (named) | `storage.redeemGiftCard` body + forensic comment block. Safe-delete after orphan migration. |

---

## 6. Recommended next PRs (do NOT execute as part of this audit)

| PR | Purpose | Risk |
|---|---|---|
| **PR-W15** | Read-side migration: replace `user.washBalance` / `user.giftCardBalance` reads with `walletAccounts.washPackageCredits` / `walletAccounts.egiftBalanceCents` reads in: `/api/loyalty/user-profile`, auth response payloads, admin analytics, customer UI. **No schema change.** | MEDIUM — display-only paths but high test coverage required. |
| **PR-W16** | Orphan balance migration (per the dry-run plan in the audit). Drains legacy columns to `walletAccounts.*` per CEO sign-off. | MEDIUM — money movement; CEO approval required. |
| **PR-W17** | Delete dead legacy code: `storage.redeemGiftCard` body, forensic comment block. Renames the gift-cards storage wrappers to use `eVoucher*` names for clarity (no behaviour change). | LOW — refactor only. |

---

## 7. Files inspected

```
server/customerAuth.ts
server/lib/legacy-gift-card-redeem-handler.ts
server/registerFounder.ts
server/routes.ts
server/routes/admin.ts
server/routes/nayax-webhooks.ts
server/services/giftOrchestrationService.ts
server/simpleAuth.ts
server/storage.ts
server/tests/legacy-balance-report.test.ts
server/tests/legacy-gift-card-redeem.test.ts
server/tests/wash-pack-bleed-stop.test.ts
shared/schema.ts
client/src/hooks/useSimpleAuth.tsx
client/src/pages/CustomerManagement.tsx
client/src/pages/FounderMember.tsx
```

End of report. All claims grep-cited. No DB connection opened. No code changed. No money moved.
