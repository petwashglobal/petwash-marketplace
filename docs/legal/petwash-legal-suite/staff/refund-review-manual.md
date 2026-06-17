---
title: Refund Review Manual
role: staff
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 1
gate: requireAdminPermission("refund.review")
language: EN (Hebrew controlling once translated)
---

# Refund Review Manual

Operational manual for reviewing and issuing refunds at **PET WASH LTD** (no. 517145033).

## 1. Legal baseline
Refunds follow the Consumer Protection Law, 5741-1981 and the Company's published cancellation/refund policy. Where the law grants a cancellation right, honour it regardless of internal cap.

## 2. Authority caps (four-eyes)
| Amount | Authority |
|--------|-----------|
| Within agent cap | Support agent may issue directly |
| Above agent cap | Requires a second approver (four-eyes); the issuer and approver must be different people |
| Disputed / large / fraud-suspected | Escalate to finance + CLO |

Support agents cannot approve their own above-cap refunds (separation of duties).

## 3. Refund to original instrument
- Refund to the **original payment method/instrument** where possible (card, wallet, voucher).
- Promotional credit / vouchers must **not** be laundered into cash; refund promo value as promo, cash value as cash.
- Wallet/voucher refunds use the atomic refund path to avoid double-refund.

## 4. Cancellation fees
Apply the correct cancellation tier; do not default to 100% refund where a fee applies, and do not charge a fee where the law forbids it. Check the booking's cancellation window.

## 5. Reason + log
Every refund records: booking/order, amount, instrument, reason, agent, and (if above cap) approver. This is auditable.

## 6. Tax/receipt consequences
Refunds that affect an issued tax invoice/receipt must trigger a credit document via the official issuer (SUMIT). Do not silently reverse without the corresponding tax document. Route to finance if unsure.

## 7. Fraud signals
Repeated refund requests, cancel-to-avoid-fee patterns, or voucher re-spend attempts → flag, do not auto-approve, escalate.

## 8. Communication
Confirm the refund amount, instrument, and timing to the customer in-platform. No guarantees beyond policy.
