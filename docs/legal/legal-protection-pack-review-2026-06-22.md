# PetWash Ltd — Legal Protection Pack: Pre‑Counsel Review & Redline Brief (2026‑06‑22)

**Purpose.** Senior expert gap‑analysis of the 12‑document draft legal pack (`petwash_legal_protection_pack_2026`), prepared so the **licensed Israeli lawyer** reviews and hardens, rather than drafts from zero. **This is not legal advice**; the pack itself is marked "for Israeli lawyer review." Hand this brief to counsel alongside the drafts.

**Structural note.** The pack is outline‑level (1–2 page bullet summaries, English‑only, with a generic "Customer/Provider/Host/Booker" signature block on every doc — so no document is scoped to a defined counterparty). Strategic instinct is sound (15% not 20% ✓, not‑insurance positioning, contractor independence, place‑of‑service segmentation). The work is drafting + hardening, not redesign.

---

## 🔴 CRITICAL — must be cleared BEFORE launch

### C2 — Payments / stored‑value licensing (the #1 existential risk)
**Docs:** 01 §6; pack otherwise silent.
**Issue.** Wallet + e‑gift + booking escrow **hold customer money**, and wallet funds **pay third‑party providers** (open‑loop). Under the **Regulation of Payment Services and Payment Initiation Law, 5783‑2023**, issuing a payment instrument and holding/transferring client funds can be a licensable payment service (Bank of Israel / CMISA supervision). The "not a bank deposit/credit card" disclaimer in 01 §6 does **not** cure this. Amplifier: refunds are **manual** (no automated rail), i.e. real customer money moved by hand.
**Fix direction.** Get a definitive fintech‑regulatory opinion. Architect so funds are **held by the licensed PSP** (Nayax/SUMIT/UPay) or a **segregated trust account**, not PetWash's own account; characterise the wallet narrowly (closed‑loop, single‑merchant) — noting the marketplace's third‑party payouts push it toward open‑loop e‑money. Draft a **standalone Wallet/Stored‑Value & E‑Gift Terms** doc.

### C4 — "Not Insurance" disclaimer reads like insurance
**Doc:** 03.
**Issue.** Doc 03 sets out claim conditions, deadlines, required evidence, and exclusions — which reads **exactly like a policy** under the **Supervision of Financial Services (Insurance) Law, 5741‑1981**. Substance governs, not the "we are not insurance" label. The doc never states the two things that actually keep it onside: **no premium / no separate charge**, and **genuine unfettered discretion** (not an enforceable entitlement).
**Fix direction.** Pick one lane: **(i) pure goodwill** — no premium, no entitlement, fully discretionary; drop the policy‑like claim architecture; or **(ii) insurer‑backed** — a real licensed‑insurer group policy, PetWash as facilitator. Add: *"No premium or separate charge is collected for this program; it confers no contractual entitlement and is provided at PetWash's sole discretion."* Must not promise payouts the manual refund rail can't deliver.

### C1 — §17a all‑inclusive price (the Wolt ₪3.75M class action)
**Docs:** 01 §4, 07, 11.
**Issue.** Docs say "show price + VAT"; **§17a** requires the **single final, VAT‑included, all‑mandatory‑fees‑included total** shown **before** the consumer commits — not assembled from line items.
**Fix direction.** Bind in Terms (01) + Shop (11): *"The price displayed at the point of order is the final, total, VAT‑included price payable, inclusive of all mandatory fees (incl. delivery), shown before the customer confirms."* Enforce in checkout so displayed total == charged total.

### C3 — Contractor re‑classification holes
**Docs:** 02, 09.
**Issue.** Mostly on the right side of the labour‑court gig tests, but: (1) 02 §4 lets PetWash set a **"minimum price"** + "reject/hide/review pricing" (control = subordination factor); (2) **no non‑exclusivity** clause (the strongest independence evidence); (3) **no re‑classification offset/indemnity** fallback.
**Fix direction.** Add explicit **non‑exclusivity** ("Provider may offer services through any other platform or directly"); soften "minimum price" to a *suggested* floor / brand‑integrity guardrail; add a **re‑classification offset** clause; affirm provider supplies own tools and bears own business risk. Keep the 6‑month tax reconfirmation (good artifact).

---

## 🟠 HIGH

- **H1 — Privacy (06) misses Amendment 13 (in force 2025).** Add: per‑purpose **lawful basis**; **breach‑notification** clause; **DPO** appointment (or documented why none — note sensitive data: pet medical, national ID, selfie/ID‑match, GPS); concrete **data‑subject‑rights** channel + statutory response window; **separate, unbundled, opt‑in marketing consent** with one‑click unsubscribe (Communications/Spam Law §30A — **₪1,000/message** statutory damages, a class‑action vehicle). Reference the existing consent‑ledger/hash‑chain infra.
- **H2 — Cancellation/Refund (07) doesn't state the statutory floor.** Add: *"Notwithstanding any policy below, where the law grants a cooling‑off/cancellation right, the customer may cancel and any fee will not exceed the lower of 5% or ₪100"* (Consumer Protection Law §14C + Cancellation Regulations). The "strict / no‑refund once dispatched" tiers can be **unlawful** within cooling‑off. Add correct **service‑timing** rule and **custom/perishable** carve‑outs with citations. Map refunds to the **14‑day** statutory refund.
- **H3 — VAT 18% + disclosed‑agent model appear in NO doc.** Add a VAT/agency clause: VAT at the statutory rate (currently **18%**); marketplace services — PetWash is **disclosed agent** for independent providers who issue the tax invoice; PetWash's own sales (station, shop, e‑gift) — PetWash is seller of record.
- **H4 — Premises addenda (04, 05) one‑directional + no recording clause.** Add mutual indemnities + "PetWash not a party to the premises / no premises liability"; add a **recording/privacy clause** (no audio recording without consent — Wiretap Law; video only with disclosure); require host premises insurance + landlord/municipal indemnity.
- **H5 — Incident form (10) risks liability admissions.** Add an **"internal assessment only, without admission of liability"** header on the admin section; add a **consent/notice** line for collecting evidence + third‑party data; reference retention/legal‑hold.
- **H6 — Custom non‑returnability (08/11) over‑reaches.** Split into three buckets: **personalised/engraved** (exempt from change‑of‑mind; defect rights preserved), **perishable/consumable** treats/food (perishable exemption), **standard stock** (full statutory return rights). Keep the engraving confirmation tick‑box.

---

## 🟡 MEDIUM
- **M1 — Entity block missing.** No doc states the **company number** (confirm **515673247 vs 517145033**) or registered address (**עוזי חיטמן 8, ראש העין**). Add a verified entity block to every customer/provider‑facing doc.
- **M2 — Governing law (01 §8) is a drafting note, not operative.** Replace with: Israeli law governs; competent Israeli courts; *without prejudice to mandatory consumer‑protection forum rights*.
- **M3 — No e‑signature/electronic‑records clause** (Electronic Signature Law 5761‑2001). Add to each signed doc; rely on the existing consent‑ledger.
- **M4 — Wallet freeze/revoke (01 §6)** may be an unfair term (Standard Contracts Law 5743‑1982). Limit to fraud/security, with notice + appeal, **preserving the monetary value** (freeze access, not funds).
- **M5 — Self‑booking/self‑review prohibition** is in the manual but not the operative contracts. Add as a term.

---

## TOP 5 — what the lawyer MUST fix before go‑live
1. **C2 — payments/stored‑value licensing opinion + fund‑holding re‑architecture.** Existential.
2. **C4 — re‑engineer "Not Insurance"** (no‑premium discretionary OR insurer‑backed).
3. **C1 — §17a all‑in price** bound in Terms/Shop/checkout.
4. **H1 — Privacy to Amendment 13** + separate marketing opt‑in (Spam Law).
5. **H2 — cancellation to the statutory floor** + **C3** contractor hardening.

## Missing documents the pack still needs
Walking‑safety terms · Transport addendum · K9000 station terms (machine warnings, fault/refund, CCTV signage) · standalone Wallet/e‑gift terms · sub‑processor DPAs (Nayax, SUMIT/UPay, cloud, support) · cookie/tracking notice · marketing‑consent/unsubscribe spec · insurer group‑policy docs (if C4 option ii).

## Single biggest regulatory exposure
**Payments/stored‑value licensing (C2)** — implicates Bank of Israel / CMISA, is criminal‑adjacent if unlicensed, sits on top of a manual refund rail, and structurally affects how every transaction is built. **Fix the fund‑holding architecture first.** "Not‑insurance" (C4) is the close second.

## Cross‑check vs PetWash facts (verified in the pack)
- 15% commission — correctly stated (00/02/09), **never 20%** ✓
- VAT 18% — **stated nowhere** (H3)
- Discounts K9000‑only / 10% cap — **not addressed** (should appear in Shop/Terms)
- Manual‑only refund rail — amplifies C2/C4/H2
- Company number — unconfirmed, **stated in no doc** (no contradiction yet; fill the verified number)
- Registered address עוזי חיטמן 8 ראש העין — **absent from all docs** (M1)
