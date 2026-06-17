---
title: Admin Document Viewing Rules
role: staff
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 2
gate: requireAdminPermission("admin.documents.view")
language: EN (Hebrew controlling once translated)
---

# Admin Document Viewing Rules

Rules for viewing stored documents (ID/passport scans, invoices, receipts, provider KYC, insurance/health docs, contracts) at **PET WASH LTD** (no. 517145033).

## 1. Reason required
Opening any stored document requires the admin to **enter a reason** (free text + category) before the document is rendered. No reason = no access.

## 2. Audit log on every view
Each view records: admin identity, document ID, document type, customer/provider reference, reason, timestamp, and IP. The log is immutable and retained 7 years.

## 3. Permission gating
- ID/national-ID scans, provider KYC, insurance/health docs → `requireAdminPermission("documents.kyc.view")`.
- Tax invoices/receipts → `requireAdminPermission("documents.tax.view")` (finance only).
- Support staff may view **only** non-financial booking documents.

## 4. Time-boxed access
Document URLs are short-lived signed links (minutes, not a year). No permanent or sharable links. Bulk download is disabled by default.

## 5. No re-disclosure
Viewed documents must not be downloaded, screenshotted, printed, forwarded, or stored outside Company systems. Disclosure to third parties requires legal approval and a lawful basis.

## 6. National ID & sensitive data
National ID numbers and health documents are sensitive personal data under the Protection of Privacy Law (incl. Amendment 13). Viewing is restricted, logged, and subject to periodic review.

## 7. Review
The CLO/DPO reviews document-view logs periodically for anomalous access patterns. Unexplained access is investigated as a potential breach.
