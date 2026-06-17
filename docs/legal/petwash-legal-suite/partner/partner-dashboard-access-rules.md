---
title: Partner Dashboard Access Rules
role: partner
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 1
gate: partner confidentiality + assigned-location
language: EN (Hebrew controlling once translated)
---

# Partner Dashboard Access Rules

Rules for partner access to the PetWash partner dashboard. **PET WASH LTD** (no. 517145033).

## 1. Personal login
Each partner user has a personal, named login with MFA. No shared partner accounts. The partner is accountable for actions under its login.

## 2. Assigned-location scoping (hard rule)
The dashboard shows **only the partner's assigned location(s)**. Server-side authorisation enforces this — a partner can never query, see, or export another location's data or any company-wide data. There is no "all locations" view for partners.

## 3. What a partner can see
- Their own station(s): status/online, fault reports.
- Their own revenue-share figures (per [Revenue-Share Report Rules](./revenue-share-report-rules.md)).
- Their own local incidents and maintenance tickets.

## 4. What a partner cannot see
- Customer personal data (none is exposed).
- Other partners' or company-wide financials.
- Platform secrets, source data, or admin tools.

## 5. No data export abuse
Bulk scraping/automated export beyond normal use is prohibited. Reasonable per-location reports/exports of the partner's own data are allowed.

## 6. Logging
Partner logins and sensitive views are logged. Anomalous access (attempts to reach other locations) is alerted and investigated.

## 7. Security duties
Partner safeguards its credentials, reports suspected compromise immediately, and does not share access with unauthorised persons.

## 8. Revocation
Access is revoked on termination of the hosting/operator relationship, or on misuse.
