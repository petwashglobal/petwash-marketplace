---
name: petwash-provider-onboarding
description: Design or review PetWash provider onboarding, KYC intake, document collection, risk checks, and approval — for Pet Sitter / Walk My Pet / Academy providers. Use before changing provider application flow, KYC/identity handling, document storage, approval gating, or payout eligibility. A human always approves providers; AI only collects, validates, and flags. Raw KYC never leaves the encrypted vault.
---

# PetWash Provider Onboarding & KYC Skill

Provider onboarding is a **controlled marketplace-risk workflow** — strict, human-gated, and completely separate from Prestige/customer loyalty (see `petwash-prestige-loyalty`). One person can be both a member and a provider on the **same account**, but with **separate status, separate permissions, separate risk**.

## 0. What already exists — extend, don't rebuild
- **Application + status machine:** `server/routes/provider-applications.ts` (statuses: `pending / under_review / approved / rejected / on_hold / pending_resubmission / draft`), admin review via `requireStaffApproved`.
- **KYC + document security:** `server/kyc.ts`, `server/document-security-2025.ts` (encrypted document handling — the Identity Vault).
- **Account model:** `dashboardsAllowed` / `ROLE_DASHBOARDS` — provider is an *application on top of* a member account; the post-login decider auto-upgrades role on approval (see the both-roles work). Provider suspension must NOT delete the person's member/loyalty account.

## 1. The hard rules (never violate)
1. **A HUMAN approves providers — never AI.** AI/agents may collect, validate, dedupe, score, and flag for review. The `approved` transition is a human admin action, logged with `approved_by` + `approved_at`. No auto-approval, ever.
2. **Raw KYC lives ONLY in the encrypted vault.** ID images, selfie/liveness, bank, insurance, tax docs are encrypted before upload and decrypted only inside the hardened vault service. Elsewhere store only **verification result + reference id**, never the raw document. Prefer an external verifier (Persona/Veriff/Trulioo) and keep only the result — do not store biometric templates without counsel sign-off.
3. **Broken-glass access.** Every view of a KYC document is access-controlled, justified, logged, and alertable. No casual admin browsing of ID/selfie/bank.
4. **18+ is a hard gate** (age_18_confirmed) — enforced server-side, not just a checkbox.
5. **Address privacy:** never expose a provider's private home address publicly, and never expose the customer's exact address to the provider before paid + accepted + fraud-checks-passed (see `petwash-booking-architect`).
6. **No booking activation or payout before approval.** An un-approved provider cannot receive bookings or a payout. Payout gating is its own machine (hold until completed + cleared + no dispute + KYC complete + bank verified).

## 2. Onboarding order (map to the existing status machine)
apply → mobile OTP + email verified → 18+ → legal + display name → ID/passport/permit (vault) → selfie/liveness (vault) → address → service type + pet-experience declaration → insurance/cert (vault, where relevant) → tax status → bank details (vault) → **provider agreement signature** → safety training → **human review** → `approved_limited` (first jobs monitored) → `approved_full`. Suspicious/incomplete → `on_hold` / `manual_review`, never a silent pass.

## 3. Risk flags to surface (Tower Control → Provider Trust & Safety)
duplicate identity · duplicate bank · duplicate phone/device · off-platform-payment attempt · insurance expired · tax missing · high refund/cancellation · complaint cluster · incident report · chargeback risk. These feed the existing watchdogs (Compliance-Hound = expiring docs/insurance; Welfare-Guard = welfare/complaints; Ledger-Keeper = financial fraud; Sentinel = auth anomalies). AI flags → human resolves.

## 4. Tax model is explicit (never guessed)
A provider booking is **DISCLOSED_AGENT_MARKETPLACE** (settled #1222 — VAT on PetWash's 15% commission). `PETWASH_PRINCIPAL` only if the CPA explicitly chose it for a service. Don't invent tax/payout logic (CPA order #1); the SUMIT per-class mapping already encodes it.

## 5. Legal wording (independent providers, not employees)
Providers are **independent providers, not employees** (Israeli misclassification risk) — they choose availability, may decline, may work elsewhere. Never write "employee/shift/salary/must accept". Public claims must pass `petwash-marketing-legal` (no "all providers background-checked" guarantees → "reasonable verification").

## Definition of done
Human approval enforced · raw KYC only in the encrypted vault with broken-glass logging · 18+ server-enforced · address privacy respected · no booking/payout before approval · risk flags surfaced for human review · tax model explicit · member account untouched by provider suspension.
