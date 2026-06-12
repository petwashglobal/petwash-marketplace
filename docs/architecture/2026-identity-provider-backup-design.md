# PetWash — Smart Identity, Provider Onboarding, Data Fan-out & Legal Backup

| | |
|---|---|
| **Date** | 2026-06-12 |
| **Status** | DESIGN for CEO approval. Grounded in (a) the 2026-06-12 codebase audit and (b) the 2026 Israel legal brief. No money/DB/tax code is written until this is approved. |
| **Author** | Claude (acting CTO/CLO) |
| **Replaces guessing with** | what already exists in the repo + sourced Israeli law |

> Plain-English summary first, then the technical plan. Every legal claim is tagged CONFIRMED / UNVERIFIED per the operating standard. UNVERIFIED items must be confirmed with an Israeli adviser before they go live.

---

## 0. The one principle (why Rover & Wolt win)
**Make it effortless to START; verify before you PAY.** Low friction in → more good people in → then qualify the serious ones. We already half-did this consolidation; this design finishes it lawfully.

---

## 1. One identity, many roles (your Uber insight) — FEASIBLE, foundation exists
- **What exists:** `identity_accounts` table (links Google/Apple/phone/passkey to one person); `ProviderOnboarding.tsx` (canonical apply funnel) + `provider-os/ProviderOS.tsx` (canonical provider console); customer `Dashboard.tsx`. Roles live in `schema-enterprise.ts`.
- **The model:** one login → system reads the person's roles → routes them:
  - Member → customer dashboard
  - Provider → ProviderOS
  - Admin → Octopus control panel
- A person can hold **both** Member + Provider on one login and switch — exactly Uber rider/driver.
- **Build:** a clean role-switch in the header + a `post-login coordinator` that already exists (`lib/postLoginCoordinator.ts`) returning the right `nextUrl`. Mostly wiring, not new tables.

---

## 2. Provider identity — what's there vs. the legal gaps
**Already in `providers` table:** KYC columns (`kyc_status`, face-match, doc type/country), insurance fields, background-check, `payout_enabled`. Good bones.

**Legally load-bearing identifier (CONFIRMED):** the provider's **osek number** (business tax registration — Osek Patur / Osek Murshe). You need it to be paid lawfully and for your own bookkeeping; the provider issues you a tax invoice with it.

**Net-new fields to add (the "perfect legal" set):**
| Field | Why | Legal basis |
|---|---|---|
| `osek_number` (business TIN) | required to pay & to receive their tax invoice | CONFIRMED (deel/rippling/Wolt IL) |
| `osek_type` (patur / murshe / zair) | drives VAT handling | CONFIRMED |
| `bituach_leumi_status` | self-employed National Insurance | CONFIRMED |
| `bank_account` + `bank_ownership_confirmed` | lawful payout; Wolt requires ownership proof | CONFIRMED |
| `provider_code` (e.g. `PW-PRV-2026-0042`) | **operational only** (support/UX, like Wolt courier ID) — NOT a legal need | operational |

**Flag:** payout columns are **Stripe** (`stripe_connect_account_id`) but our rail is **UPay/SUMIT**. The Stripe fields are vestigial — real payout wiring is UPay/SUMIT (blocked on UPay activation + SUMIT creds). Don't build new Stripe logic.

**Provider code generator:** follow the existing `stationCode` (`K9000-TLV-001`) and voucher `serialNumber` (`PWV-2026-A3B7C2D1`) patterns already in the repo — prefix + year + zero-padded sequence. Add column + generator + backfill.

---

## 3. Apply-light → Maya/Ido call → "Approve" → verify-before-pay
Your idea, mapped to what exists:
1. **Apply-light:** provider fills a tiny form — name, phone, city, service. (Trim `ProviderOnboarding.tsx`'s heavy upfront steps to this.)
2. **Follow-up:** **Maya WhatsApps them** (exists: `MayaService`, `maya/whatsappResponder.ts`) or **Ido/staff call**. Collects the rest conversationally: osek, Bituach Leumi, bank, declarations (license/insurance + add **tax + Bituach Leumi** declarations to the existing `PROVIDER_DECLARATION_TEXT`).
   - Honest gap: **Maya real phone-call is a stub** (`voice/StubVoiceProvider.ts`). WhatsApp ships now; outbound voice needs Twilio Voice wired later.
3. **"Approve" button:** in the Octopus/admin panel, staff click **Approve** → provider goes live for bookings.
4. **verify-before-PAY:** the osek/bank/Bituach gate is enforced at **first payout**, not at signup (Wolt pattern, CONFIRMED). `payout_enabled` already exists for this.

---

## 4. Data fan-out (your "send to support@ + Drive/Sheets/Calendar") — PARTLY BUILT
- **Already exists:** `server/routes/backup.ts` pushes to **Google Drive, Sheets, and Docs**; a daily Drive export runs.
- **Add:** on provider signup/approval, fire one event that:
  - 📧 emails the legal pack to **support@petwash.co.il**
  - 📁 files documents to **Google Drive**
  - 📊 appends a row to a **master provider Sheet**
  - 📅 books the Maya/Ido **callback in Calendar**
  - 🧾 records the fiscal entity in **SUMIT** (on activation)
- All connectors are available. This is the "octopus" backbone — visible in the admin panel.

---

## 5. Loyalty join-light (Amendment 13) — DECISION NEEDED
**CONFIRMED law:** Amendment 13 (in force 14 Aug 2025) = data-minimization. Lawful minimum for a loyalty membership = **name + one contact (email or mobile) + consent.** Collecting **ID number / passport / DOB / home address at signup** is exactly what it targets — administrative fines reportedly up to ~₪320k (UNVERIFIED exact bands; PPA has begun enforcing, ₪70–75k fines cited).

**This conflicts with your earlier request** (passport/license/ID + DOB + full address + unit at loyalty signup). My CLO recommendation: collect those **only at a real trigger** (tax invoice, payout KYC, age-gated product) — *progressive* collection. **Your call as CEO** — see the decision at the end.

---

## 6. Backups — 7-year, integrity-preserving, logged
**CONFIRMED:** tax records (invoices/receipts/financials) must be kept **7 years from end of tax year**. Personal/loyalty data = keep only while purpose lives + **annual review/purge**. No data-residency wall (EU/US cloud fine with a transfer clause).

**Legal bar for backups (CONFIRMED, Data Security Regs 2017):** restorable + **integrity-preserving** + **logged restores** (who/when). **Immutable/WORM is NOT a named mandate** — it's the cleanest *way* to evidence the integrity duty (best-practice).

**What exists:** daily Firestore snapshot, **~30-day** retention + Drive export. **Gap:** 7-year tier + restore logging + integrity guarantee.
**Build:** two retention clocks (tax=7yr hard, PII=purpose-bound) as a per-record-type field; add restore-audit logging; adopt object-lock/immutable storage as best-practice; document the cross-border transfer basis.

---

## 7. Recommended build order
1. ✅ **Dead-version cleanup** — DONE (PR #691 merged).
2. **Provider code + Israeli tax-identity fields** (additive schema; safe). Net-new, no data loss.
3. **Apply-light onboarding + Maya WhatsApp follow-up + admin "Approve" button.**
4. **Data fan-out** (extend existing Drive/Sheets to provider-signup event).
5. **7-year / integrity / logged backup tier.**
6. **Multi-role switch** (member ⇄ provider on one login).
7. *(Later, needs Twilio Voice)* Maya outbound phone calls.

---

## 8. Open legal items to confirm with an Israeli adviser (do NOT ship as settled)
- Exact disclosed-agent VAT section + document flow (UNVERIFIED)
- Current-year Osek Patur threshold figure (UNVERIFIED)
- Whether our DB lands in the "high-security" tier of the 2017 regs (UNVERIFIED)
- Precise statutory cite for the 7-year bookkeeping clause (7yr norm CONFIRMED by multiple sources; sub-section UNVERIFIED)
- Exact Amendment 13 fine bands (UNVERIFIED)

---

## 9. The decision for the CEO
**Loyalty signup fields** — pick one:
- **(A) Lawful minimum** (recommended): name + contact + consent at signup; collect ID/DOB/address only when a real trigger needs it. Lowest fine risk.
- **(B) Full collection at signup** (your earlier ask): ID/passport/license + DOB + address + unit upfront. Higher Amendment 13 exposure; needs explicit risk acceptance + strong justification per field.

Plus: **`nirhadad1@gmail.com`** — you wanted it as your **backend admin** login (because `nir.h@` is down). That means you'll need a *different* email to test the *loyalty member* experience (one account can't cleanly be both the super-admin and a test member). Confirm which.
