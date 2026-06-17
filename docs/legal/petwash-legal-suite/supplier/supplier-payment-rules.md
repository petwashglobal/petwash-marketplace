---
title: Supplier Payment Rules
role: supplier
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 2
gate: requireSupplierPaymentApproval(...) before payment — all gates must pass
language: EN (Hebrew controlling once translated)
---

# Supplier Payment Rules

Issued by **PET WASH LTD / פט וואש בע״מ**, company no. **517145033**, Israel.

## 1. Payment is gated — no exceptions
PetWash will **not** release any payment to a Supplier unless **all** of the following are present and valid. This is enforced by `requireSupplierPaymentApproval(...)`. If any one is missing or fails, **payment is blocked**:

1. **Declarations** — signed Truth, Tax/Business, Invoice-Truth, Duplicate-Invoice, Bank-Ownership, and Document-Upload declarations.
2. **Tax status** — verified Osek/company classification with consistent VAT treatment (Patur charges no VAT; Murshe/Chevra charge 18%); valid withholding certificate or withholding applied.
3. **Bank verification** — account owned by the Supplier in its legal name, ownership proof verified.
4. **Invoice match** — invoice amount, VAT, and line items match the approved order/PO and the delivery.
5. **Duplicate-invoice check** — no previously paid or pending invoice with the same number/amount; passed automated and manual check.
6. **Admin approval** — a human PetWash admin has reviewed and approved the payment; the approval is recorded in the audit log.

## 2. No manual bypass
No PetWash employee may bypass these gates, pay outside the system, or approve their own related-party invoice. Every approval and payment is logged with actor, action, target, and amount.

## 3. Order-first
Payment is made only against a valid PO or written authorisation. Unordered deliveries are not payable.

## 4. Terms and method
Approved invoices are paid on the agreed terms (e.g. Shotef+30) to the **verified** bank account only. PetWash pays in ILS unless otherwise agreed in writing.

## 5. Withholding
Where Israeli law requires, PetWash withholds tax at source and pays the net amount. Withholding does not reduce the Supplier's reporting duties.

## 6. Holds, reversals, set-off
PetWash may hold or reverse payment for a failed gate, suspected fraud, duplicate, defective supply, or false declaration, and may set off amounts the Supplier owes PetWash.

## 7. Disputes
Invoice disputes are raised in writing to **suppliers@petwash.co.il**; the undisputed portion may be paid while a dispute is resolved.

## 8. Records
Payment, approval, and gate-check records are kept for the period Israeli law requires.

## 9. Governing law
These Rules are governed by Israeli law. This English version is for convenience; the Hebrew version controls once issued.
