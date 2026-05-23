# VAT attribution matrix — 2026-05-23

**Purpose:** answer the CEO's question precisely — *מי משלם מע״מ, מתי, ואיך*
(who pays VAT, when, and how) — for each PetWash money flow, so we
never lose money to misclassified VAT.

## 1. The two PetWash business models

PetWash operates two distinct models with different VAT attribution.

### Model A — K9000 self-service stations (PetWash owns the revenue)

- Customer scans the Nayax DOT code reader at a dual-bay K9000 station.
- Customer is charged the wash price by Nayax (the payment rail).
- **PetWash Ltd is the legal seller** of the wash service.
- PetWash receives 100% of the wash revenue.
- PetWash's costs against this revenue: site rent, water, electricity,
  shampoo/consumables, hardware maintenance.

**VAT attribution (Model A):**
- PetWash owes output VAT (מע״מ עסקאות) = wash_price × 18% to ITA
- PetWash reclaims input VAT (מע״מ תשומות) on rent + utilities +
  consumables + hardware
- Net VAT owed = output VAT − input VAT
- Per booking: SUMIT issues a קבלה / חשבונית מס to the customer in
  PetWash's name.

### Model B — Marketplace bookings (15% commission)

- Customer books a sitter / walker / groomer via the platform.
- Customer pays the full booking amount to PetWash (Tranzila / Nayax).
- **PetWash retains 15% commission**; provider receives 85%.
- The "who is the legal seller?" question is the AGENT_MODEL_POLICY in
  `shared/israel-compliance-config.ts` — still pending CPA sign-off.

**VAT attribution (Model B) depends on the agent model:**

| Agent model | Legal seller to customer | PetWash output VAT | Provider output VAT | PetWash input VAT |
|---|---|---|---|---|
| **Disclosed** (recommended) | Provider | On 15% commission only | On 85% (provider's own books) | On 15% commission cost (none, since PetWash itself charged it) |
| **Undisclosed** | PetWash | On full booking amount | On 85% billed to PetWash | On the 85% invoice from provider |

The **undisclosed model is materially riskier** for cash flow because
PetWash pays VAT on the gross before reclaiming input VAT — a working
capital gap. The **disclosed model needs the provider to be properly
classified** (per §2 below) so PetWash isn't accidentally bearing the
provider's VAT liability.

→ **Decision required from CEO + CPA**: lock the agent model. Until
then, every marketplace VAT calculation must defer to whichever value
is in `AGENT_MODEL_POLICY.model` at runtime.

## 2. Three supplier classifications

Suppliers and providers we pay come in three Israeli tax flavours:

| Classification | Charges VAT? | Reclaims VAT? | Issues | PetWash receives |
|---|---|---|---|---|
| **עוסק פטור** (patur) | NO | NO | קבלה only | קבלה without VAT |
| **עוסק מורשה** (murshe) | YES (18%) | YES | חשבונית מס + קבלה | חשבונית מס with VAT we can reclaim |
| **חברה בע״מ** (chevra) | YES (18%) | YES | חשבונית מס + קבלה | חשבונית מס with VAT we can reclaim |

**The trap (the "לא להפסיד כסף" risk):**
- An Osek Patur supplier sending an invoice with VAT > 0 means either
  (a) they mistakenly billed VAT they shouldn't have, or (b) someone is
  trying to charge us non-existent VAT.
- If we approve it and pay, we lose that VAT — we cannot reclaim it
  because the supplier was never authorised to charge it.
- **PR-S5c blocks this case** with a `osek_vat_mismatch` HARD FAIL
  (score 85) that pushes the invoice into RED.

**The secondary trap:**
- A murshe or chevra supplier sending an invoice with VAT = 0 on a
  positive base could be a zero-rated export (legitimate) OR a supplier
  error. PR-S5c flags this as a YELLOW warning so finance reviews.

**The tertiary trap:**
- A supplier classified as `unknown` blocks approval entirely (warning
  +20 + finance must classify) so we never approve an invoice from an
  unverified party.

## 3. Concrete VAT examples (Israeli 18% rate)

### Example 1 — K9000 wash at ₪50
- Customer pays ₪50 inc-VAT
- Base = 50 / 1.18 = ₪42.37
- Output VAT to ITA = ₪7.63
- Costs (rent share + water + shampoo): ₪25 base + ₪4.50 VAT input
- **PetWash net VAT to ITA = 7.63 − 4.50 = ₪3.13**

### Example 2 — Marketplace sitter booking ₪200 (disclosed model)
- Customer pays ₪200 to provider (via PetWash as agent)
- Provider's output VAT on ₪200 = ₪200 × 18/118 = ₪30.51 (provider books this)
- PetWash's commission = ₪200 × 15% = ₪30
- PetWash output VAT on commission = ₪30 × 18/118 = ₪4.58 (PetWash books this)
- **PetWash net VAT to ITA = ₪4.58 (provider handles their own)**

### Example 3 — Marketplace sitter booking ₪200 (undisclosed model)
- Customer pays ₪200 to PetWash (legal seller)
- PetWash output VAT = ₪200 × 18/118 = ₪30.51 (PetWash books)
- Provider invoices PetWash ₪170 (85% of gross) — and if provider is
  murshe/chevra they bill VAT on that 170: PetWash reclaims ₪25.93
  input VAT
- **PetWash net VAT to ITA = 30.51 − 25.93 = ₪4.58**
- Same net result as disclosed, BUT cash-flow gap because PetWash
  remits the gross VAT and waits to reclaim the input VAT.

### Example 4 — Supplier invoice from Osek Patur (the trap)
- Supplier (patur) invoices PetWash for ₪500 shampoo
- Invoice incorrectly shows VAT = ₪90, total = ₪590
- If we pay ₪590 and try to reclaim ₪90 input VAT → ITA rejects
- **PR-S5c blocks this**: `osek_vat_mismatch` (fail, 85) → RED → blocked
- Loss prevented: ₪90 per such invoice.

### Example 5 — Clearing fee as expense (עמלת סליקה זה הוצאה)
- Booking ₪200, Tranzila/Nayax fee 1.75% = ₪3.50
- The fee is an EXPENSE (not a reduction of revenue):
  - PetWash revenue line: ₪200
  - PetWash expense line: ₪3.50 + input VAT on it (₪0.63 if processor
    is murshe-equivalent) = ₪4.13 expense booked in SUMIT
- Net result: ₪196.50 retained, but full ₪200 + ₪0.63 input VAT
  visible in the books for honest reporting.

## 4. What stays in PetWash code vs. SUMIT

| Logic | Where it lives | Why |
|---|---|---|
| Compute base/VAT/total per booking | PetWash (`shared/israeliTax.ts`) | Cross-check SUMIT's calculation |
| Decide which agent model applies | PetWash (`AGENT_MODEL_POLICY`) | Policy, not arithmetic |
| Decide who the legal seller is per booking | PetWash | Driven by AGENT_MODEL_POLICY |
| Validate supplier's classification matches invoice VAT | PetWash (`supplierInvoiceScreening.ts`) | Pre-SUMIT screening |
| Issue the legal Israeli document (קבלה / חשבונית מס / זיכוי) | SUMIT | They own the legal form |
| Request SHAAM allocation from ITA | SUMIT | Only authorised parties can call ITA |
| Compute output VAT on the document | SUMIT | They own it once we send the body |
| Book input VAT in our chart of accounts | SUMIT | Bookkeeping side |
| Decide to refund / cancel / release escrow | PetWash | Business decision |

## 5. Action items (per CEO's "be careful" instruction)

1. **PR-S5c (this PR)** — Osek classification field + VAT mismatch
   screening. Blocks the patur+VAT-charged trap.
2. **CPA decision on AGENT_MODEL_POLICY** — currently
   `pendingCpaSignoff: true` in `israel-compliance-config.ts`. Until
   resolved, marketplace VAT calculations cannot be considered final.
3. **Classify every existing supplier** — finance ops task. Each
   supplier row defaults to `unknown` after PR-S5c lands; no incoming
   invoice from an unknown supplier can be approved.
4. **PR-S5d (later)** — book clearing fees as expense lines in SUMIT,
   not netted out of revenue. Mapped in roadmap doc.
5. **PR-S5g (later)** — escrow lifecycle ↔ SUMIT documents. Requires
   AGENT_MODEL_POLICY decision first.

## 6. References

- `shared/israel-compliance-config.ts` — VAT rate, SHAAM thresholds,
  Osek Patur ceiling, AGENT_MODEL_POLICY (pending CPA sign-off)
- `shared/israeliTax.ts` — invoice/receipt generation logic
- `docs/finance/sumit-integration-roadmap-2026-05-23.md` — companion roadmap
- `docs/finance/sumit-readiness-check-2026-05-23.md` — single-invoice send plan
- `migrations/0027_suppliers_osek_classification.sql` — schema change
