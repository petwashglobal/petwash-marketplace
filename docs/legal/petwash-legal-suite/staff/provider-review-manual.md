---
title: Provider Review Manual
role: staff
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 1
gate: requireAdminPermission("provider.review")
language: EN (Hebrew controlling once translated)
---

# Provider Review Manual

Operational manual for provider-reviewers at **PET WASH LTD** (no. 517145033).

## 1. Scope & boundary
You verify provider eligibility and documents. You **cannot approve payouts** — that is a separate finance role (separation of duties).

## 2. What to verify
- **Identity / KYC:** ID document matches the applicant.
- **Business compliance:** osek (exempt/licensed) details where required before any payout eligibility.
- **Insurance / health docs** (e.g. groomer health/insurance): present, in date, and legible (see #800/#804 gate — clearance gates payout).
- **Declarations:** signed provider declaration / e-signature on file.

## 3. Reason + log
Opening provider KYC/insurance documents requires a stated reason and is logged. View only what you need.

## 4. Decision
- **Verify:** mark verified; this clears the compliance gate, not the payout itself.
- **Reject / request more:** state the specific deficiency; notify the provider in-platform.
- Record the decision, reasons, and which documents were relied on.

## 5. Separation of duties
The reviewer who verifies a provider must not approve that provider's payout. Payout clearance is enforced at both rails (contractor_earnings by Firebase UID; super_app_payouts by numeric provider id).

## 6. Sensitive data
National IDs and health documents are sensitive personal data. Do not export, screenshot, or share. Signed links are short-lived.

## 7. Re-verification
Insurance/health docs are time-limited. Flag for re-verification before expiry; expired docs re-close the payout gate.

## 8. Escalation
Suspected fraud or forged documents → incident process + CLO. Do not approve when in doubt.
