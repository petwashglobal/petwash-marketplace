# Pricing Display Audit — PetWash, 2026-05-31

**Author:** CTO (Claude Code, desktop)
**Status:** Initial scan — Tier 1 surfaces audited, Tier 2/3 catalogued
**Precedent:** Wolt class action 53918-06-23 (Olifant v Wolt, 2025, settled for 3,750,000 ₪)
**Reference rule:** `.claude/skills/petwash-platform/SKILL.md` §2 — pricing disclosure rule (added in PR #511)

## Question this answers

Are PetWash's consumer-facing pricing displays compliant with Israeli Consumer Protection Law 1981 §17a (total-price disclosure)?

## TL;DR

**Mostly OK, one HIGH-RISK pattern found in marketplace booking modal.** The flagship surfaces (homepage packages, gift cards) show clean totals. The marketplace booking confirmation modal shows the exact Wolt-precedent pattern (`Subtotal + Service fee` split lines) at checkout — needs remediation before national launch.

| Tier | Surface | Status | Action |
|---|---|---|---|
| 1 | Homepage `WashPackages` | ✅ Compliant | None |
| 1 | Homepage `GiftCards` | ✅ Compliant | None |
| 1 | eGift purchase (`/egift`) | ✅ Compliant | None |
| 1 | Marketplace `BookingPaymentModal` | 🔴 **HIGH RISK** | Remediate before paid launch |
| 1 | Sitter / Walker booking checkout | ⚠️ Needs verification | Audit in follow-up |
| 2 | Wallet top-up | ⚠️ Needs verification | Audit |
| 2 | PetTrek booking | ⚠️ Needs verification | Audit |
| 2 | Subscription / Prestige | ⚠️ Needs verification | Audit |
| 3 | Admin / internal pricing | N/A | B2B exempt from §17a |

---

## 1. Methodology

Scope = "consumer-facing surfaces that show a ₪ price the consumer might pay."

For each surface, three questions:
1. **Total upfront?** — Is the inclusive total visible before the user commits?
2. **Breakdown shown?** — Are all components disclosed (even if collapsed)?
3. **Surprise?** — Could the user reasonably feel ambushed at the final click?

Pass = all three Y/Y/N. Fail = any one of (N / N / Y).

Compliant ≠ "no breakdown ever shown" — breakdowns are FINE if the total leads. Wolt's mistake was showing components separately AND not showing the inclusive total upfront.

## 2. Tier 1 — flagship consumer surfaces

### 2.1 Homepage `WashPackages` (`client/src/components/WashPackages.tsx`)
**Status: ✅ Compliant**

The 4 wash packages on the homepage display:
- Top: tier label (Classic / Popular / Premium / Maison)
- Card image
- **₪ {total price} per package**
- "per wash" calculation
- "Add to Bag" CTA

The price shown IS the total. No "delivery fee" or "service fee" separately. VAT-inclusive (Israeli market default).

After PR #512, the Hebrew "Maison" label no longer says "food." This surface is launch-ready.

### 2.2 Homepage `GiftCards` (`client/src/components/GiftCards.tsx`)
**Status: ✅ Compliant**

Same structure as WashPackages. Card displays:
- Tier label
- Card image
- **₪ {total value}** (₪100 / ₪250 / ₪500 / ₪1,000)
- "E-Gift" / "שובר מתנה" label
- "Send Gift" CTA

The gift card value IS the price. No hidden processing fee. Compliant.

After PR #512, Hebrew "Maison" tier no longer says "food." Launch-ready.

### 2.3 eGift purchase flow (`client/src/pages/EGift.tsx`)
**Status: ✅ Compliant**

User selects tier → sees ₪{amount} prominently → checkout shows that same amount as the charge.
No service-fee surprise. The amount the customer chooses IS the amount charged.

⚠️ **Watchpoint:** When SUMIT auto-invoicing ships (PR-S4), ensure the invoice line items match what was displayed. If SUMIT splits "wash credit ₪95.73 + VAT ₪16.27 = ₪112" but the customer saw "₪112", that's fine — same total, just a backend breakdown. Compliance is on what the CONSUMER sees pre-purchase, not what the tax doc shows after.

### 2.4 Marketplace `BookingPaymentModal` (`client/src/components/marketplace/BookingPaymentModal.tsx`)
**Status: 🔴 HIGH RISK — Wolt-precedent pattern**

Lines 216-233 of the modal show the cost block AT CHECKOUT:

```
Subtotal              ₪X
Service fee           ₪Y          ← "עמלת שירות" — same pattern Wolt was sued for
─────────────────────────
Total                 ₪Z
```

**Why this is risky:**
The "Service fee" (`booking.serviceFeeCents`) appears here at the final confirm step.
If this fee was NOT disclosed on the earlier provider-listing / booking-selection page,
that's the EXACT pattern that lost Wolt 3.75M ₪.

**Three possible remediation paths (pick one):**

**Option A — Fold into displayed price (preferred):**
The provider listing card and booking selection page should display the
INCLUSIVE total (`booking.totalCents`), not just the provider's base rate.
The customer sees the all-in price from the first moment they consider booking.
The "Subtotal + Service fee" breakdown remains in the modal as a transparency
view — but it's not new information at that point.

**Option B — Disclose fee upfront with badge:**
On every provider listing and booking flow step, show: "₪{subtotal} + ₪{fee}
service fee = ₪{total}." This is verbose but explicit. Less LVMH, more defensive.

**Option C — Remove the separate "Service fee" line at checkout:**
Show only "Total: ₪Z" with a (i) tooltip that expands to show the breakdown
on hover/tap. The fee is still disclosed but the headline IS the total.

**Recommendation:** Option A. Matches LVMH brand discipline (one clean number)
AND closes the legal exposure (total disclosed upfront).

**Remediation owner:** Chrome Claude (UI text + display) + CTO (backend
totalCents calculation if not already including fee).

### 2.5 Sitter / Walker / Groomers booking checkout
**Status: ⚠️ Needs verification — likely same pattern as 2.4**

These flows use similar marketplace-booking architecture. High probability
they share the `BookingPaymentModal` or have their own variants with the same
Subtotal / Service-fee / Total split.

Files to audit in follow-up:
- `client/src/pages/SitterBooking.tsx`
- `client/src/pages/WalkerBooking.tsx`
- `client/src/pages/GroomersBook.tsx`
- `client/src/components/marketplace/ProviderSearch.tsx` (listing cards)

## 3. Tier 2 — moderate-risk surfaces (catalogued, not yet audited)

| Surface | File | Risk hypothesis |
|---|---|---|
| Wallet top-up | `client/src/pages/MyWallet.tsx` | Possible "processing fee" pattern |
| PetTrek BookTrip | `client/src/pages/pettrek/BookTrip.tsx` | Distance-based pricing — check for hidden surcharges |
| Subscription / Prestige | `client/src/pages/PrestigeClub.tsx` | Monthly/annual pricing — check for ex-VAT display |
| Service landing | `client/src/pages/ServiceLandingPage.tsx` | Public-facing — high impact if non-compliant |
| Daycare calculator | `client/src/pages/DaycareCalculator.tsx` | Calculator — check final price equals quoted price |

**Recommended:** schedule Tier 2 audit in a follow-up CTO session (~2 hours).

## 4. Tier 3 — admin / internal surfaces (B2B exempt)

The Israeli pricing-disclosure law §17a applies to B2C transactions. The following
surfaces serve internal admins, providers (B2B), or finance staff — they may show
ex-VAT prices, technical breakdowns, and component-level details freely.

- `AdminCompensation.tsx`, `AdminFinancial.tsx`, `AdminWalletDashboard.tsx`
- `FinanceDashboard.tsx`, `FinanceProfitability.tsx`, `BoardPack.tsx`
- `EmployeeExpenses.tsx`, `ApproveExpenses.tsx`
- `ProviderTimeline.tsx`, `ProviderBookingsDashboard.tsx`, `SitterDashboard.tsx`
- `LeadManagement.tsx`, `MobileOpsHub.tsx`
- Supplier invoice screens

**No remediation required for these surfaces.** Confirm via auth-gate inspection
that none of them leak into customer view via unprotected routes.

## 5. Inventory by the numbers

- 167 client files reference `₪`
- 963 lines display a price somewhere
- ~30 of those are consumer-facing (Tier 1 + 2)
- ~140 are admin/internal (Tier 3 — exempt)

## 6. Risk callouts

- **Marketplace listing cards:** Need to verify the provider rate shown on the
  card is the inclusive price the customer ends up paying. Right now the
  `serviceFeeCents` is calculated server-side and added later. If the customer
  comparison-shops at the listing level on one number and pays a different
  number at checkout, that's the legal trap.

- **Coupon / discount flows:** PetWash supports promo codes. Adding value at
  checkout (discount) is fine. Adding new costs at checkout (fee that didn't
  appear earlier) is the trap.

- **PetTrek transport:** Distance-based pricing creates legitimate variance.
  Show a quote upfront, lock it at confirm. Don't allow the price to creep up
  between quote and confirm without the user re-acknowledging.

- **Stations physical signage (K9000):** Out of scope for this code audit but
  flagged for operational: the price sticker on the physical kiosk must include
  VAT and any platform fee.

## 7. Recommended remediation sequence

| Priority | Action | Owner | Effort |
|---|---|---|---|
| 🔴 P0 | Fix `BookingPaymentModal` to show inclusive total upfront (Option A) | CTO + Chrome Claude | 4 hours |
| 🔴 P0 | Audit Sitter / Walker / Groomers booking pages, same fix | CTO + Chrome Claude | 4 hours |
| 🟠 P1 | Audit Tier 2 surfaces (wallet, PetTrek, subscriptions) | CTO | 2 hours |
| 🟡 P2 | Confirm admin pages don't leak into customer routes | CTO | 1 hour |
| 🟢 P3 | Add automated CI test that grep-fails on `serviceFeeCents` rendered separately on a consumer-route component | CTO | 4 hours |

## 8. Pre-launch gate (recommended)

Before paid marketing or national launch:
- Tier 1 surfaces: 🟢 100% compliant (currently 4/5 — fix #2.4)
- Tier 2 surfaces: 🟢 100% compliant (currently 0/5 — not yet audited)
- Tier 3 surfaces: 🟢 confirmed B2B-only routes

Until then: soft launch only, friends + family + K9000 station beta users.

## 9. Update log

| Date | What | By |
|---|---|---|
| 2026-05-31 | Initial Tier 1 audit + Tier 2/3 catalogue | CTO |

## 10. Related docs

- `.claude/skills/petwash-platform/SKILL.md` §2 — pricing disclosure rule (PR #511)
- `docs/finance/sumit-readiness-check-2026-05-23.md` — SUMIT integration status
- `docs/finance/runbook-sumit-tax-authority-error.md` — gov.il authorization runbook
- `docs/architecture/AGENT-OWNERSHIP.md` — agent boundary rules (for follow-up PR routing)
