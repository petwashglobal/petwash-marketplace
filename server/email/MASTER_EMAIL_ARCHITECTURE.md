# PetWash™ Master Email Architecture
## Israel 2026 Compliance Blueprint

**Legal entity**: פט ווש בע"מ / PetWash Ltd  
**ח.פ.**: 516047073  
**FROM address**: noreply@petwash.co.il  
**Support**: support@petwash.co.il  
**Canonical brand name**: `Pet Wash™` (no RTL embedding characters in sender fields)

---

## 1. Full Email Inventory

### A. `server/emailService.ts` — EmailService (static class)

| # | Method | Purpose | Category | FROM Name | FROM Email | Reply-To | Legal Entity in Body | Languages | Unsubscribe | Legal Footer | Status |
|---|--------|---------|----------|-----------|------------|----------|---------------------|-----------|-------------|--------------|--------|
| 1 | `send()` | Generic internal wrapper (alerts, fallback) | Internal/Ops | configurable | noreply@petwash.co.il | none | none | EN | FORBIDDEN | None | ⚠️ No footer |
| 2 | `sendTaxInvoice()` | חשבונית מס to customer | Finance/Legal | `Pet Wash™` | noreply@petwash.co.il | support | via IsraeliTaxService | HE+EN | **FORBIDDEN** ✅ | Via invoice | ✅ Fixed |
| 3 | `sendTransactionReport()` | Transaction summary to ops | Internal/Ops | `Pet Wash™` | noreply@petwash.co.il | none | partial | EN | FORBIDDEN | Minimal | ⚠️ No ח.פ. |
| 4 | `sendRevenueReport()` | Daily/monthly/yearly revenue to ops | Internal/Ops | `Pet Wash™` | noreply@petwash.co.il | none | Pet Wash™ | EN | FORBIDDEN | Partial | ⚠️ No ח.פ. |
| 5 | `sendVATDeclarationNotification()` | Monthly VAT summary to CEO/CFO | Finance/Legal | `Pet Wash™` | noreply@petwash.co.il | none | פט ווש בע"מ ✅ + ח.פ. ✅ | HE | FORBIDDEN | None | ⚠️ No footer |
| 6 | `sendEmployeeExpenseNotification()` | Expense approval to supervisor | Internal/Ops | `Pet Wash™` | noreply@petwash.co.il | none | פט ווש בע"מ ✅ + ח.פ. ✅ | EN+HE | FORBIDDEN | Minimal ✅ | ✅ Fixed |
| 7 | `sendBlankExpenseFormDraft()` | Blank expense form to CEO/NOD | Internal/Ops | `Pet Wash™` | noreply@petwash.co.il | none | פט ווש בע"מ ✅ + ח.פ. ✅ | EN+HE | FORBIDDEN | Minimal ✅ | ✅ Fixed |
| 8 | `sendSampleVATSubmissionTaxAuthority()` | VAT demo to CEO/NOD | Internal/Ops | `Pet Wash™` | noreply@petwash.co.il | none | פט ווש בע"מ ✅ + ח.פ. ✅ | HE+EN | FORBIDDEN | Minimal ✅ | ✅ Fixed |
| 9 | `sendGiftCard()` | Legacy gift card delivery | Finance/Transactional | `Pet Wash™` | noreply@petwash.co.il | support | Pet Wash™ | EN | **FORBIDDEN** ✅ | None | ⚠️ Legacy template — supersede with egift |
| 10 | `sendPurchaseConfirmation()` | Purchase receipt (קבלה) | Finance/Transactional | `Pet Wash™` | noreply@petwash.co.il | support | Pet Wash™ | HE+EN | **FORBIDDEN** ✅ | None | ⚠️ No ח.פ., no full footer |
| 11 | `sendAppointmentReminder()` | Appointment reminder | Transactional | `Pet Wash™` | noreply@petwash.co.il | support | Pet Wash™ | HE | Permitted (service reminder) | None | ⚠️ No footer |
| 12 | `sendBirthdayDiscount()` | Birthday 10% discount | **Marketing** | `Pet Wash™` | noreply@petwash.co.il | support | Pet Wash™ | HE/EN | **REQUIRED** ✅ | None | ⚠️ No full footer |
| 13 | `sendVaccineReminder()` | Pet vaccine due reminder | Transactional | `Pet Wash™` | noreply@petwash.co.il | support | Pet Wash™ | HE/EN | Permitted (health reminder) | None | ⚠️ No footer |
| 14 | `sendWelcomeEmail()` | Welcome — Firestore template / luxury fallback | Transactional | `Pet Wash™` | noreply@petwash.co.il | support | פט ווש בע"מ + ח.פ. ✅ | HE/EN | FORBIDDEN | ✅ Full (fallback) | ✅ Fallback fixed |
| 15 | `sendVoucherPurchaseEmail()` | Voucher purchase confirmation | Finance/Transactional | `Pet Wash™` ✅ | noreply@petwash.co.il | support | Pet Wash™ | HE/EN | FORBIDDEN | None | ⚠️ No ח.פ., no footer |
| 16 | `sendVoucherClaimEmail()` | Voucher redemption confirmation | Finance/Transactional | `Pet Wash™` ✅ | noreply@petwash.co.il | support | Pet Wash™ | HE/EN | FORBIDDEN | None | ⚠️ No ח.פ., no footer |
| 17 | `sendLegalComplianceReminder()` | Legal compliance notice to provider | Support/Ops | `Pet Wash™ Legal` ✅ | noreply@petwash.co.il | support | Pet Wash™ | HE/EN | FORBIDDEN | None | ⚠️ No footer |
| 18 | `sendInternalInvitation()` | Internal team invitation | Internal | `Pet Wash™` ✅ | noreply@petwash.co.il | support | Pet Wash™ | EN | FORBIDDEN | None | ⚠️ No footer |
| 19 | `sendBookingConfirmation()` | Booking confirmation (class-level wrapper) | Finance/Transactional | `Pet Wash™` ✅ | noreply@petwash.co.il | support | Pet Wash™ | HE | FORBIDDEN | None | ⚠️ Superseded by BookingConfirmationEmailService |

---

### B. `server/email/luxury-email-service.ts` — Luxury Email Service

All functions use `FROM_EMAIL = noreply@petwash.co.il`, `FROM_NAME = 'Pet Wash™'` ✅, routed through `emailSpendGuard`.

| # | Function | Purpose | Category | Languages | Unsubscribe | ח.פ. | Template File | Status |
|---|----------|---------|----------|-----------|-------------|------|---------------|--------|
| 1 | `sendLuxuryEmail()` | Generic wrapper | Any | configurable | configurable | — | inline | ✅ |
| 2 | `sendBackendTeamInvitation()` | Backend team invite | Internal | EN | FORBIDDEN | No | backend-team-invitation-2025.ts | ⚠️ No ח.פ. |
| 3 | `sendLuxuryWelcomeCustomer()` | Customer welcome | Transactional | HE+EN | FORBIDDEN | No | welcome-luxury-2026.ts | ⚠️ No ח.פ. in template |
| 4 | `sendLuxuryWelcomeProvider()` | Provider welcome | Transactional | HE+EN | FORBIDDEN | No | welcome-luxury-2026.ts | ⚠️ No ח.פ. in template |
| 5 | `sendWelcomeEmail()` | Welcome alias | Transactional | HE+EN | FORBIDDEN | No | welcome-luxury-2026.ts | ⚠️ No ח.פ. in template |
| 6 | `sendPartnerInvitation()` | Partner invite | Marketing/BD | EN | Permitted | No | partner-invitation-2025.ts | ⚠️ No ח.פ. |
| 7 | `sendPartnerInvitationHebrew()` | Partner invite (Hebrew) | Marketing/BD | HE | Permitted | No | partner-invitation-hebrew-2025.ts | ⚠️ No ח.פ. |
| 8 | `sendWorkflowNotification()` | Internal workflow alert | Internal/Ops | EN | FORBIDDEN | No | workflow-notification-2025.ts | ⚠️ No ח.פ. |
| 9 | `sendLuxuryLaunchEmail()` | Launch announcement | Marketing | EN | **REQUIRED** | No | luxury-launch-2025.ts | ⚠️ No unsubscribe, no ח.פ. |
| 10 | `sendInvestorLaunchEventEmail()` | Investor event invite | Marketing/BD | EN | **REQUIRED** | No | luxury-investor-launch-event-2025.ts | ⚠️ No unsubscribe, no ח.פ. |
| 11 | `sendNewUserConfirmation()` | Registration confirmation | Transactional | HE+EN | FORBIDDEN | No | registration-confirmation-2025.ts | ⚠️ No ח.פ. |
| 12 | `sendLoyaltyEnrollmentConfirmation()` | Loyalty enrollment | Transactional | HE+EN | FORBIDDEN | No | registration-confirmation-2025.ts | ⚠️ No ח.פ. |
| 13 | `sendProviderEnrollmentConfirmation()` | Provider enrollment | Transactional | HE+EN | FORBIDDEN | No | registration-confirmation-2025.ts | ⚠️ No ח.פ. |
| 14 | `sendFranchiseApplicationConfirmation()` | Franchise application | Transactional | HE+EN | FORBIDDEN | No | welcome-franchise-application-2026.ts | ⚠️ No ח.פ. |
| 15 | `sendMembershipConfirmation()` | Membership confirmation | Transactional | HE+EN | FORBIDDEN | No | membership-confirmation-2026.ts | ⚠️ No ח.פ. |
| 16 | `sendEGiftActivation()` | E-gift activation code | Finance/Transactional | HE+EN | FORBIDDEN | No | egift-activation-2026.ts | ⚠️ No ח.פ. |
| 17 | `sendClubWelcomeEmail()` | Loyalty club welcome | Marketing/Transactional | HE+EN | Permitted | No | luxury-club-2026.ts | ⚠️ No ח.פ. |
| 18 | `sendTierUpgradeEmail()` | Tier upgrade notification | Transactional/Marketing | HE+EN | Permitted | No | luxury-club-2026.ts | ⚠️ No ח.פ. |
| 19 | `sendPurchaseRewardEmail()` | Points reward notification | Transactional | HE+EN | FORBIDDEN | No | luxury-club-2026.ts | ⚠️ No ח.פ. |
| 20 | `sendClubEventEmail()` | Club event invitation | Marketing | HE+EN | **REQUIRED** | No | luxury-club-2026.ts | ⚠️ No unsubscribe, no ח.פ. |

---

### C. Standalone Services

| Service | Method | Purpose | Category | FROM | Languages | Unsubscribe | ח.פ. | Status |
|---------|--------|---------|----------|------|-----------|-------------|------|--------|
| `egiftEmailService.ts` | `sendEGiftConfirmationEmail()` | E-gift sender confirm + recipient delivery | Finance/Transactional | `Pet Wash™` via mailService ✅ | HE/EN (auto) | **FORBIDDEN** ✅ | No | ⚠️ No ח.פ. in template |
| `luxuryActivationEmail.ts` | `buildActivationEmail()` | Account activation link | Transactional | not set (caller sets) | HE/EN | FORBIDDEN | No | ⚠️ No ח.פ., FROM not set |
| `BookingConfirmationEmailService.ts` | `send()` | Booking + payment confirm (customer + provider) | Finance/Transactional | `Pet Wash™` ✅ | HE (primary) | FORBIDDEN | ✅ COMPANY_TAX_ID shown | ✅ Most compliant |

---

### D. Provider Onboarding Inline Emails — `server/routes/provider-onboarding.ts`

All use `noreply@petwash.co.il`. All now use correct FROM_NAME variants ✅.

| # | Trigger | Recipient | FROM Name | Purpose | Category | ח.פ. | Legal Footer | Status |
|---|---------|-----------|-----------|---------|----------|------|--------------|--------|
| 1 | Application submitted | Applicant | `Pet Wash™ Providers` | Welcome / received | Transactional | No | None | ⚠️ No footer |
| 2 | Enters review queue | Admin | `Pet Wash™ Providers` | Admin review ACTION REQUIRED | Internal/Ops | No | None | ⚠️ No footer |
| 3 | Docs needed | Applicant | `Pet Wash™` | Additional documents needed | Support | No | None | ⚠️ No footer |
| 4 | Approved (KYC path) | Applicant | `Pet Wash™` | Application approved | Transactional | No | None | ⚠️ No footer |
| 5 | Rejected (KYC path) | Applicant | `Pet Wash™` | Application update | Support | No | None | ⚠️ No footer |
| 6 | Approved (admin path) | Applicant | `Pet Wash™` | Application approved | Transactional | No | None | ⚠️ No footer |
| 7 | Rejected (admin path) | Applicant | `Pet Wash™` | Application update | Support | No | None | ⚠️ No footer |
| 8 | Resubmission requested | Applicant | `Pet Wash™` | Documents needed + upload token | Support | No | None | ⚠️ No footer |
| 9 | Admin support message | Applicant | `Pet Wash™ Support` | Custom message from admin | Support | No | None | ⚠️ No footer |
| 10 | Documents received | Applicant | `Pet Wash™` | Acknowledgment of resubmission | Transactional | No | None | ⚠️ No footer |

---

## 2. Email Family Rules

### Family 1 — Transactional
*Account activation, welcome, booking confirmation, registration confirmation, enrollment confirmation, appointment reminders, vaccine reminders, resubmission acknowledgments*

| Rule | Value |
|------|-------|
| FROM name | `Pet Wash™` |
| FROM email | `noreply@petwash.co.il` |
| Reply-To | `support@petwash.co.il` |
| Unsubscribe | **FORBIDDEN** — these are triggered by user action or service delivery |
| Legal footer | **REQUIRED** — company name, ח.פ., privacy link, terms link, accessibility link |
| ח.פ. in body | Required |
| Branding | Premium white luxury system (see Section 6) |
| Logging | Log to CRM communication log on send + on delivery webhook |
| Language | User's registered language preference (he/en), fallback HE |
| RTL | `dir="rtl"` on `<html>` for Hebrew, `lang="he"` attribute |

---

### Family 2 — Support / Operational
*Legal compliance reminders, provider workflow notifications, admin review alerts, internal invitations, expense notifications, revenue reports, VAT declarations*

| Rule | Value |
|------|-------|
| FROM name | `Pet Wash™` / `Pet Wash™ Support` / `Pet Wash™ Providers` / `Pet Wash™ Legal` (per stream) |
| FROM email | `noreply@petwash.co.il` |
| Reply-To | `support@petwash.co.il` (or none for internal-only) |
| Unsubscribe | **FORBIDDEN** — operational communications cannot be opted out of |
| Legal footer | Required for all customer-facing support emails. Optional for purely internal (CEO/CFO). |
| ח.פ. in body | Required when customer-facing |
| Branding | Premium white luxury for customer-facing. Clean black-on-white table layout for internal finance. |
| Logging | INFO log on send. No CRM log required for internal. |
| Language | Customer-facing: user preference. Internal: English primary with Hebrew annotations on financial figures. |

---

### Family 3 — Finance / Legal Document
*Tax invoices (חשבונית מס), receipts (קבלה), wallet confirmations, booking receipts, e-gift delivery, purchase confirmations, voucher confirmations*

| Rule | Value |
|------|-------|
| FROM name | `Pet Wash™ Finance` (preferred) or `Pet Wash™` |
| FROM email | `noreply@petwash.co.il` |
| Reply-To | `support@petwash.co.il` |
| Unsubscribe | **ABSOLUTELY FORBIDDEN** — including List-Unsubscribe header. Adding unsubscribe misrepresents a legal document as marketing and may invalidate it under VAT Law 5735-1975. |
| Legal footer | **MANDATORY** — must include: פט ווש בע"מ, PetWash Ltd, ח.פ. 516047073, privacy, terms, accessibility |
| ח.פ. in body | **MANDATORY** — must appear prominently near document type label |
| Legal entity display | Must show BOTH: `פט ווש בע"מ` (Hebrew) AND `PetWash Ltd` (English) |
| Document format | See Finance/Legal Matrix (Section 3) |
| BCC | `support@petwash.co.il` on all legal documents for immutable record |
| Logging | **Full CRM audit trail required**: send timestamp, recipient, document ID, delivery status, bounce if any |
| Emoji in body | **FORBIDDEN** for חשבונית מס, קבלה, VAT reports — these are legal/financial records |
| Language | Bilingual HE+EN side-by-side. Hebrew is always primary (mandatory for Israeli consumers). |

---

### Family 4 — Marketing
*Birthday discounts, loyalty club events, tier upgrades, launch announcements, investor event invitations, partner invitations, club event emails*

| Rule | Value |
|------|-------|
| FROM name | `Pet Wash™` |
| FROM email | `noreply@petwash.co.il` |
| Reply-To | `support@petwash.co.il` |
| Unsubscribe | **REQUIRED** — one-click List-Unsubscribe header + visible link in body per Israeli Spam Law 5768-2008 |
| Consent check | **REQUIRED** — must pass `checkEmailConsent(email, 'marketing')` before send |
| Legal footer | Required — with prominent unsubscribe link |
| ח.פ. in body | Recommended but not mandatory for pure marketing |
| Branding | Premium white luxury. No cheap gradients. |
| Time restriction | Israeli business hours only (08:00–21:00 Asia/Jerusalem) per `sendBirthdayDiscount()` pattern |
| Logging | Log to CRM. Track open/click only with user tracking consent. |

---

## 3. Finance / Legal Document Matrix

| Document | Legal Status | Notification or Document | Issuer identity | ח.פ. Required | Delivery Method | Legal Wording Required |
|----------|-------------|--------------------------|-----------------|--------------|----------------|------------------------|
| **Tax Invoice** (חשבונית מס) | Legal fiscal document under VAT Law 5735-1975 | Document | פט ווש בע"מ / PetWash Ltd | **YES** | Rendered inline HTML via `IsraeliTaxService.formatInvoiceHTML()` + BCC to support. PDF attachment **strongly recommended** for future. | Must state: issuer name, address, ח.פ., VAT reg number, invoice number, date, line items, tax amount |
| **Receipt** (קבלה) | Legal document confirming payment | Document | פט ווש בע"מ / PetWash Ltd | **YES** | Rendered inline. Should also offer PDF link. | Must state: payment amount, date, method, reference number |
| **Booking Confirmation** | Required consumer notification + payment receipt | Notification + Document | פט ווש בע"מ / PetWash Ltd | **YES** ✅ (BookingConfirmationEmailService) | Rich HTML rendered inline. `FinancialDocumentService` creates DB record. | Booking number, service, pet, provider, date/time, total paid, breakdown |
| **Wallet Confirmation** | Transaction notification | Notification | פט ווש בע"מ / PetWash Ltd | YES | Rendered inline | Credit/debit amount, balance, transaction ID, timestamp |
| **E-Gift Delivery** (sender confirm) | Payment confirmation | Notification | פט ווש בע"מ / PetWash Ltd | YES | Rendered inline | Gift card ID, value, recipient, tier, expiry, serial number |
| **E-Gift Delivery** (recipient) | Gift delivery | Notification + entitlement | פט ווש בע"מ / PetWash Ltd | YES | Rendered inline with redemption code | Redemption code, value, expiry, eligible services |
| **Voucher Purchase** | Receipt | Notification + Document | פט ווש בע"מ / PetWash Ltd | YES | Rendered inline | Voucher code, value, purchase date |
| **Voucher Claim** | Redemption confirmation | Notification | פט ווש בע"מ / PetWash Ltd | YES | Rendered inline | Voucher code, amount applied, remaining |
| **VAT Declaration** | Internal operational | Notification to CEO/CFO | פט ווש בע"מ / PetWash Ltd | **YES** | Rendered inline. Official declaration goes to Tax Authority separately. | Draft status clearly marked. Period, output/input VAT, net amount |
| **Revenue Report** | Internal operational | Notification | פט ווש בע"מ / PetWash Ltd | YES | HTML + CSV attachment | Report period, breakdown, totals |
| **Employee Expense** | Internal operational | Notification | פט ווש בע"מ / PetWash Ltd | YES | Rendered inline | Expense ID, category, amount, employee, vendor |

### Finance Document Policy — send vs attach vs link

| Method | When to use | Current state |
|--------|-------------|---------------|
| **Rendered inline HTML** | All current templates | ✅ All do this |
| **PDF attachment** | Tax invoices — required for legal archiving in IL | ⚠️ Not yet implemented. Priority for next sprint. |
| **Hosted document link** | Wallet statements, annual summaries | ⚠️ Not yet implemented |
| **BCC to support** | All finance/legal document sends | ✅ Tax invoice BCC implemented. ⚠️ Others pending |

---

## 4. Language Policy

### Template Language Assignments

| Category | Language | Templates |
|----------|----------|-----------|
| **Hebrew only** | `he` | `sendVATDeclarationNotification()` (body HE, header bilingual), `sendAppointmentReminder()` |
| **English only** | `en` | `sendTransactionReport()`, `sendRevenueReport()`, `sendEmployeeExpenseNotification()`, `sendBlankExpenseFormDraft()`, `sendInternalInvitation()`, `backend-team-invitation-2025.ts`, `partner-invitation-2025.ts`, `luxury-launch-2025.ts`, `workflow-notification-2025.ts` |
| **Bilingual HE+EN** | `he` + `en` variants | `sendWelcomeEmail()`, `sendBirthdayDiscount()`, `sendVaccineReminder()`, `sendGiftCard()`, `sendPurchaseConfirmation()`, `sendVoucherPurchaseEmail()`, `sendVoucherClaimEmail()`, all luxury templates, `egiftEmailService`, `BookingConfirmationEmailService`, `luxuryActivationEmail` |
| **Bilingual in single email** | Both shown together | `BookingConfirmationEmailService` (HE primary), `sendWelcomeEmail` fallback (HE primary), all finance footers |

### Language Selection Rules

1. **Registered users**: Use `user.language` field from Firestore/DB. Fall back to `'he'` if not set.
2. **New/anonymous recipients** (e-gift recipient, partner invitations): Use document language if specified, default to `'he'` for Israeli-domiciled operations.
3. **Internal emails** (CEO, CFO, ops): English primary with Hebrew annotations on financial figures.
4. **Finance/legal documents**: Always bilingual — Hebrew is the legally required primary language for Israeli consumers. English is always present for foreign investors/employees.

### RTL Implementation Standard

```html
<!-- Correct bilingual email HTML structure -->
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8">
  </head>
  <body dir="rtl">
    <!-- Hebrew content: text-align: right via dir="rtl" -->
    <p>תוכן בעברית</p>
    <!-- English inline: wrap in explicit dir -->
    <span dir="ltr" style="unicode-bidi: embed;">English content</span>
  </body>
</html>
```

**Rules:**
- Set `dir="rtl"` on `<html>` and `<body>` for Hebrew-primary emails
- Set `lang="he"` on `<html>` for screen-reader/mail-client detection
- Wrap English text in `<span dir="ltr">` when embedded inside RTL body
- Do NOT rely on CSS `direction` alone — use HTML `dir` attribute for email client compatibility
- Table-based layouts must set `dir` on outer `<table>`, not just CSS

---

## 5. Delivery and Audit

### Current Delivery Architecture

```
send request
  → EmailSpendGuard (budget check)        — server/services/EmailSpendGuard.ts
  → checkEmailConsent()                   — checks DB/Firestore suppression list
  → checkRateLimit()                      — in-memory rate limiter (100/hr, 500/day per recipient)
  → createMailService().send()            — SendGrid MailService
  → Gmail fallback                        — server/services/gmail.ts (on SendGrid failure)
  → logger.info() on success/failure
```

### Delivery Status Logging — Current State

| Log Type | Where | What is logged |
|----------|-------|----------------|
| Send success | `logger.info()` | recipient, subject |
| Send failure | `logger.error()` | recipient, subject, error |
| Guard block | `logger.error()` | reason, recipient |
| Consent block | `logger.info()` | recipient, message type |
| Rate limit block | `logger.info()` | recipient, count |
| CRM log | `storage.createCommunicationLog()` | **⚠️ Incomplete** — called in comments only (`// TODO`) |

### Delivery Status Logging — Required

For **Finance/Legal document emails** (tax invoices, booking receipts, vouchers), delivery must be **provably logged**:

```typescript
// Required after every finance document send:
await storage.createCommunicationLog({
  userId: recipientUserId,
  communicationType: 'email',
  subject: msg.subject,
  recipientEmail: msg.to,
  documentType: 'tax_invoice' | 'booking_receipt' | 'wallet_confirmation',
  documentReference: invoice.invoiceNumber,
  sentAt: new Date(),
  deliveryStatus: 'sent', // updated to 'delivered' or 'bounced' via webhook
  externalMessageId: sendgridMessageId, // from response headers
});
```

### Bounce Handling — Current State

**⚠️ NOT IMPLEMENTED.** SendGrid bounce/spam webhooks are not wired.

### Bounce Handling — Required

1. Register `POST /webhooks/sendgrid` route
2. Handle events: `delivered`, `bounce`, `spamreport`, `unsubscribe`, `open`, `click`
3. On `bounce`: add to suppression list, log, alert ops
4. On `spamreport`: immediate suppression, flag user, alert compliance
5. On `unsubscribe`: write to user `communicationPreferences.email.marketing = false`
6. On `delivered`: update CRM `deliveryStatus = 'delivered'`

### Retry Policy

- **Current**: Single-attempt with Gmail fallback. No exponential retry.
- **Required for finance/legal**: Implement retry queue (max 3 attempts, 5-min backoff) for tax invoices and booking receipts. Use async job table `provider_workflow_events` pattern already established.

### Proof Trail for Finance/Legal Emails

**Minimum required audit record per finance email:**

| Field | Required |
|-------|---------|
| Document type | ✅ |
| Document ID / invoice number | ✅ |
| Recipient email | ✅ |
| Recipient UID | Required |
| Sender identity (FROM) | ✅ |
| Send timestamp | ✅ |
| SendGrid message ID | ⚠️ Not captured |
| Delivery status | ⚠️ Not implemented |
| Bounce timestamp | ⚠️ Not implemented |
| Legal entity shown | ✅ |

---

## 6. Design System — Premium White Luxury

**Governing principle**: PetWash is a 7-star premium brand. Every customer-facing email must feel like a luxury boutique communication — clean, editorial, confident. Finance/legal documents must feel precise and institutional, not playful.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `white` | `#ffffff` | Email body background. Pure white. Never off-white or grey. |
| `black` | `#1a1a1a` | Header background, primary text, CTA button |
| `gold` | `#c9a96e` | Brand accent, CTA text on black, document type label, dividers |
| `grey` | `#6b7280` | Secondary text, subheadings |
| `light-grey` | `#9ca3af` | Tertiary text, footnotes |
| `divider` | `#f0f0f0` | Horizontal rules, table dividers |
| `paper` | `#f5f5f0` | Email outer background (the "envelope") |
| `danger` | `#dc2626` | Error states, rejection notices only |

**Forbidden colors:**
- Purple/violet gradients (`#667eea`, `#764ba2`) — removed ✅
- Blue gradients (`#007AFF`, `#0056b3`) — pending removal in revenue report
- Any gradient in finance/legal emails

### Typography

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Brand lockup | `'Helvetica Neue', Helvetica, Arial` | 12px | 700 | `#c9a96e` on black |
| H1 / greeting | Same stack | 28px | 300 (light) | `#1a1a1a` |
| H2 / section head | Same stack | 18px | 600 | `#1a1a1a` |
| Body copy | Same stack | 15-16px | 400 | `#4a4a4a` |
| Data table values | `'Courier New', monospace` | 13px | 400 | `#1a1a1a` |
| Legal footnotes | Same stack | 10-11px | 400 | `#bbb` |
| Category label | Same stack | 11px | 600 | `#c9a96e`, letter-spacing 2px, uppercase |

### Email Shell Structure

```
┌────────────────────────────────────┐  ← paper background #f5f5f0
│  ┌──────────────────────────────┐  │
│  │  BLACK HEADER (28px pad)     │  │  ← #1a1a1a background
│  │  [PET WASH™] logo lockup     │  │  ← gold border box
│  │  company identity line       │  │  ← 10px, #555
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  WHITE BODY (40px pad)       │  │  ← #ffffff
│  │  Gold category label         │  │
│  │  H1 greeting (300 weight)    │  │
│  │  Body copy                   │  │
│  │  [BLACK CTA BUTTON]          │  │  ← gold text, uppercase
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  LEGAL FOOTER                │  │  ← border-top #f0f0f0
│  │  Pet Wash™ — פט ווש בע"מ    │  │  ← 11px, #bbb
│  │  ח.פ. 516047073              │  │
│  │  petwash.co.il · support@   │  │
│  │  [Accessibility · Privacy · Terms] │
│  │  © 2026 פט ווש בע"מ        │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### CTA Button

```css
/* Standard CTA */
background: #1a1a1a;
color: #c9a96e;
padding: 14px 32px;
font-size: 12px;
font-weight: 600;
letter-spacing: 2px;
text-transform: uppercase;
border: none;
border-radius: 0;  /* squared corners — premium editorial style */
```

**Forbidden CTA styles:**
- Rounded pill (`border-radius: 50px`)
- Gradient backgrounds
- Emoji in button text

### Logo Treatment

The brand mark is a typographic lockup — not an image logo:

```html
<div style="display:inline-block; padding:8px 16px; border:1px solid #333; border-radius:2px;">
  <span style="font-family:'Helvetica Neue',sans-serif; font-size:12px; font-weight:700;
               letter-spacing:3px; color:#c9a96e; text-transform:uppercase;">
    PET WASH™
  </span>
</div>
```

Below the lockup (in the header), show the legal identity line:

```html
<div style="font-size:10px; color:#555; margin-top:6px;">
  פט ווש בע"מ | PetWash Ltd | ח.פ. 516047073
</div>
```

### Finance/Legal Document Specific Rules

- **No emoji anywhere in the email** — no 🐾, no ✅, no 💳
- **No decorative dividers** — only `border-top: 1px solid #f0f0f0` for data tables
- **Document type label** shown in gold uppercase at top: `חשבונית מס / Tax Invoice`
- **Document number** in `Courier New` monospace: `#INV-2026-00421`
- **Monetary amounts**: Right-aligned (RTL context), in `#1a1a1a`, `font-size:15px; font-weight:600`
- **VAT breakdown**: always show pre-tax, VAT (18%), and total as three separate lines
- **Watermark for drafts/samples**: centered, `color:#999`, `font-size:12px`, `font-weight:bold`

### Mobile Rules

- Max content width: `600px`
- Outer table width: `100%`
- All font sizes: minimum 11px (footer) to 28px (H1)
- No CSS `@media` queries required — table-based layout is inherently responsive
- Tap targets (CTA links): minimum `48px` height
- Text: `line-height: 1.8` for all body copy

---

## 7. Files Changed and Pending Work

### Files Changed in This Session

| File | Changes Made |
|------|-------------|
| `server/email/brand-identity.ts` | **NEW** — Canonical constants, `buildLegalFooter()`, `buildFinanceHeader()`, `wrapEmailShell()` |
| `server/emailService.ts` | Removed List-Unsubscribe from sendTaxInvoice, sendGiftCard, sendPurchaseConfirmation; fixed SUPPORT_EMAIL casing; standardised company names; added ח.פ. to VAT/expense/blank-form emails; fixed expense/blank-form purple gradient; replaced welcome fallback with luxury white; promoted checkEmailConsent/checkRateLimit to public; removed RTL embedding chars from FROM_NAME |
| `server/services/egiftEmailService.ts` | Replaced raw `sgMail.send()` with `createMailService()`; added EmailService.checkEmailConsent + checkRateLimit guards for sender and recipient; corrected FROM_NAME |
| `server/email/luxury-email-service.ts` | Fixed FROM_NAME `'Pet Wash™ Team'` → `'Pet Wash™'` |
| `server/routes/provider-onboarding.ts` | Standardised 9 FROM_NAME occurrences (`'PetWash'` / `'PetWash Provider Onboarding'` / `'PetWash Support'` → `'Pet Wash™'` / `'Pet Wash™ Providers'` / `'Pet Wash™ Support'`) |
| `server/services/BookingConfirmationEmailService.ts` | Removed RTL embedding chars from FROM_NAME |

### Templates Pending Rewrite (Priority Order)

| Priority | Template / Method | Issue | Action Required |
|----------|------------------|-------|----------------|
| P1 | `sendTaxInvoice()` | No PDF attachment, no ח.פ. in rendered HTML (only in IsraeliTaxService) | Add PDF attachment + verify ח.פ. in `formatInvoiceHTML()` |
| P1 | `sendPurchaseConfirmation()` | No ח.פ., no legal footer | Add ח.פ. + `buildLegalFooter()` |
| P1 | `sendVoucherPurchaseEmail()` | No ח.פ., no legal footer | Add ח.פ. + `buildLegalFooter()` |
| P1 | `sendVoucherClaimEmail()` | No ח.פ., no legal footer | Add ח.פ. + `buildLegalFooter()` |
| P1 | All provider-onboarding inline emails | No legal footer in any | Add `buildLegalFooter()` to all 10 |
| P2 | `welcome-luxury-2026.ts` | No ח.פ. in template | Add to template footer |
| P2 | `sendTransactionReport()` | Blue gradient, no ח.פ. | Replace gradient + add ח.פ. |
| P2 | `sendRevenueReport()` | Blue gradient, no ח.פ. | Replace gradient + add ח.פ. |
| P2 | `sendAppointmentReminder()` | No legal footer | Add `buildLegalFooter()` |
| P2 | `sendVaccineReminder()` | No legal footer | Add `buildLegalFooter()` |
| P2 | `sendLegalComplianceReminder()` | No legal footer | Add `buildLegalFooter()` |
| P2 | `sendBirthdayDiscount()` | No legal footer (unsubscribe present ✅) | Add `buildLegalFooter({includeUnsubscribe:true})` |
| P3 | `egiftEmailService` HTML templates | No ח.פ. in body | Add to footer section |
| P3 | `luxuryActivationEmail.ts` | FROM not set by caller, no ח.פ. | Add ח.פ. + standardise caller |
| P3 | `sendLuxuryLaunchEmail()` | Missing required unsubscribe (marketing) | Add `List-Unsubscribe` header |
| P3 | `sendInvestorLaunchEventEmail()` | Missing required unsubscribe (marketing) | Add `List-Unsubscribe` header |
| P3 | `sendClubEventEmail()` | Missing required unsubscribe (marketing) | Add `List-Unsubscribe` header |
| P3 | All `registration-confirmation-2025.ts` | No ח.פ. | Add to template |
| P4 | `sendGiftCard()` | Legacy template superseded by egift | Deprecate, route to `sendEGiftConfirmationEmail()` |
| P4 | `BookingConfirmationEmailService` | Instagram link has inline gradient | Replace with plain text link |

### Infrastructure Still Required

| Item | Description | Priority |
|------|-------------|----------|
| `POST /webhooks/sendgrid` | Bounce/delivery/spam event processing | P1 |
| `storage.createCommunicationLog()` | Implement all the `// TODO` hooks in emailService | P1 |
| SendGrid message ID capture | Save X-Message-Id from response for finance proof | P1 |
| PDF attachment for tax invoices | Attach PDF to חשבונית מס emails | P2 |
| Finance email retry queue | Max 3 attempts on failure for tax/booking emails | P2 |
| Email preference center | `/email-preferences?token=` page for marketing opt-out | P2 |
| Suppression list webhook sync | Auto-sync SendGrid suppression list → DB | P3 |
