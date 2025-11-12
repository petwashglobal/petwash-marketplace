# Israeli VAT Reclaim System Documentation

## Overview
Automatic VAT (Value Added Tax) calculation and declaration system for **PetWash Ltd (חברת פטוואש בע"מ)** compliant with Israeli Tax Authority regulations.

## Features

### 1. Automatic VAT Calculation
- **Output VAT (מע״מ עסקאות)**: VAT collected from customers on sales
- **Input VAT (מע״מ תשומות)**: VAT paid on approved business expenses  
- **Net VAT Position**: Automatically determines payment due or refund eligible

### 2. Israeli Tax Authority API Integration
- **OAuth2 Authentication**: Secure connection to government API
- **Automatic Submission**: Optional automatic filing to Tax Authority
- **Real-time Status**: Track submission status and reference numbers
- **Direct Debit**: Support for automatic payment via bank authorization

### 3. Monthly Automation
- **Schedule**: 1st of each month at 10:30 AM Israel time
- **Email Notifications**: Automatic alerts to CEO (Nir) and National Operations Director (Ido Shakarzi)
- **Duplicate Prevention**: Idempotent - won't generate duplicate declarations

## System Architecture

### Database Tables

#### `israeli_expenses`
Tracks all business expenses with VAT breakdown:
```sql
- expense_id: Unique ID (EXP-YYYY-MM-NNNN)
- category: utilities, supplies, rent, maintenance, marketing, etc.
- amount_before_vat: Expense amount excluding VAT
- vat_amount: VAT paid on expense
- total_amount: Total expense including VAT
- vat_rate: VAT rate applied (default 18%)
- tax_year, tax_month: Period for VAT filing
- status: pending, approved, rejected
- approved_by: Admin user who approved expense
```

#### `israeli_vat_declarations`
Monthly VAT declarations submitted to Tax Authority:
```sql
- declaration_id: Unique ID (VAT-YYYY-MM-NNNNNN)
- tax_year, tax_month: Reporting period
- output_vat_*: Revenue and VAT collected
- input_vat_*: Expenses and VAT paid
- net_vat_position: Amount to pay or reclaim
- submitted_to_tax_authority: Boolean flag
- tax_authority_reference: Government reference number
- tax_authority_response: Full API response
```

### Services

#### `IsraeliVATReclaimService`
Core VAT calculation engine:
- `calculateMonthlyVAT(year, month)`: Calculate VAT position
- `generateMonthlyDeclaration(year, month)`: Create declaration record
- `submitToTaxAuthority(declarationId, autoSubmit)`: Submit to government
- `generateVATReportHTML(calculation)`: Generate Hebrew report

#### `IsraeliTaxAuthorityAPI`
Government API integration:
- `submitVATDeclaration(report)`: Submit to Tax Authority
- `getVATSubmissionStatus(submissionId)`: Check submission status
- `testConnection()`: Verify API connectivity
- `isConfigured()`: Check if credentials are set

### Background Jobs
Monthly automated job in `backgroundJobs.ts`:
```javascript
// Runs: 1st of month at 10:30 AM Israel time
cron.schedule('30 10 1 * *', async () => {
  await generateMonthlyVATDeclaration();
}, { timezone: 'Asia/Jerusalem' });
```

## Setup Instructions

### Step 1: Database Tables
Already created and configured ✅

### Step 2: Israeli Tax Authority API Registration

**IMPORTANT**: To enable automatic submission, you must:

1. **Register Software** at https://govextra.gov.il/taxes/innovation/home/api/
   - CEO or authorized representative must complete registration
   - Register PetWash Ltd software with Tax Authority developer portal
   - This is a government requirement for API access

2. **Obtain OAuth2 Credentials**:
   - After registration approval, you'll receive:
     - Client ID
     - Client Secret
   - These are required for API authentication

3. **Set Environment Secrets in Replit**:
   ```bash
   ISRAELI_TAX_API_CLIENT_ID=<your_client_id>
   ISRAELI_TAX_API_CLIENT_SECRET=<your_client_secret>
   ISRAELI_COMPANY_ID=PETWASH_LTD
   ```

4. **Configure Direct Debit Authorization** (הרשאה לחיוב חשבון):
   - Set up automatic payment authorization with company bank account
   - Required for automatic VAT payment processing
   - Configure through Tax Authority portal

### Step 3: Email Notifications
Already configured to send to:
- **CEO**: nir.h@petwash.co.il
- **National Operations Director**: ido.s@petwash.co.il

## Usage

### Automatic Mode (Recommended)
The system runs automatically on the 1st of each month:
1. Calculates previous month's VAT position
2. Generates declaration in database
3. Sends email notification to CEO/National Operations Director
4. **Manual submission required** unless `autoSubmit=true` is enabled

### Manual Generation
From admin dashboard or API:
```javascript
// Generate declaration for specific month
const declarationId = await IsraeliVATReclaimService.generateMonthlyDeclaration(2024, 10);

// Submit to Tax Authority (requires API credentials)
const result = await IsraeliVATReclaimService.submitToTaxAuthority(declarationId, true);
```

### API Endpoints

#### Calculate VAT
```
POST /api/accounting/vat/calculate
Authorization: CEO or National Operations Director
Body: { year: 2024, month: 10 }
```

#### Generate Declaration
```
POST /api/accounting/vat/generate
Authorization: CEO or National Operations Director
Body: { year: 2024, month: 9 }
```

#### Get VAT Report (HTML)
```
GET /api/accounting/vat/report/:year/:month
Authorization: CEO or National Operations Director
```

## VAT Calculation Logic

### Israeli VAT Rate
**18%** (0.18) - Standard rate as of 2025

### Formula
```
Net VAT = Output VAT - Input VAT

Output VAT = VAT collected from customers
Input VAT = VAT paid on approved expenses

If Net VAT > 0: Payment due to Tax Authority
If Net VAT < 0: Refund eligible from Tax Authority
If Net VAT = 0: Balanced (no payment or refund)
```

### Example (October 2024)
```
Output VAT (Sales):
  Total Revenue: ₪0.00
  VAT Collected: ₪0.00
  Transactions: 0

Input VAT (Expenses):
  Total Expenses: ₪13,724.10
  VAT Paid: ₪1,994.10
  Expense Count: 6

Net VAT Position:
  Amount: ₪-1,994.10
  Status: REFUND ELIGIBLE
  Refund Amount: ₪1,994.10
```

## Compliance

### Israeli Tax Authority Requirements
- **Filing Frequency**: Monthly or bi-monthly (based on business size)
- **Deadline**: 15th of following month
- **VAT Rate**: 18% (standard rate)
- **Currency**: Israeli Shekel (₪)
- **Language**: Hebrew (primary), English (secondary)

### Security
- OAuth2 authentication with Tax Authority API
- Role-based access control (CEO/National Operations Director only)
- Audit logging of all VAT submissions
- Encrypted storage of Tax Authority responses

### Data Retention
- Declarations stored permanently in PostgreSQL
- 7-year retention for compliance purposes
- Audit trail maintained via blockchain-style ledger

## Monitoring & Notifications

### Email Notifications
Sent automatically when declaration is generated:
- Declaration ID and period
- Output VAT, Input VAT, Net Position
- Payment amount or refund eligibility
- Direct link to view Hebrew report

### Logging
All VAT operations logged with:
```
[VAT Reclaim] prefix
- Calculation start/complete
- Declaration generation
- Tax Authority submission
- Errors and warnings
```

## Troubleshooting

### "Tax Authority API not configured"
**Solution**: Set environment secrets:
- `ISRAELI_TAX_API_CLIENT_ID`
- `ISRAELI_TAX_API_CLIENT_SECRET`

### "Manual submission required"
**Cause**: `autoSubmit` is disabled by default for safety
**Solution**: Explicitly enable by calling:
```javascript
await IsraeliVATReclaimService.submitToTaxAuthority(declarationId, true);
```

### "Declaration already exists"
**Cause**: Duplicate prevention - declaration already created for this period
**Solution**: This is normal behavior. Check existing declaration in database.

### Firestore revenue index error
**Cause**: Composite index not created in Firestore
**Solution**: Click the link in warning logs to create index automatically

## Future Enhancements

### Planned Features
1. **National Insurance Declarations** (ביטוח לאומי)
2. **Income Tax Declarations** (מס הכנסה)
3. **Automated Monthly Financial Package** submission
4. **Real-time bank reconciliation** with Mizrahi-Tefahot Bank
5. **AI-powered expense categorization** using Google Vision OCR

### Israeli Tax Authority APIs Available
- ✅ VAT Reporting & Payment (implemented)
- ⏳ Withholding Tax Reporting
- ⏳ Advance Income Tax Payment
- ⏳ Invoice Allocation Numbers (e-invoicing clearance)
- ⏳ Donation Receipt Numbers
- ⏳ Employee Stock Allocation Reporting
- ⏳ Capital Declarations

## References

### Official Documentation
- **Tax Authority API Portal**: https://govextra.gov.il/taxes/innovation/home/api/
- **VAT API Manual**: https://www.gov.il/BlobFolder/generalpage/hor-software-other/he/IncomeTax_software-houses-130525-1.pdf
- **Registration Guide**: Follow link on API portal homepage

### Related Files
- `server/services/IsraeliVATReclaimService.ts` - Core VAT logic
- `server/services/IsraeliTaxAuthorityAPI.ts` - Government API integration
- `server/backgroundJobs.ts` - Monthly automation
- `server/routes/accounting.ts` - API endpoints
- `shared/schema.ts` - Database schema definitions

### Support
For technical issues with Tax Authority API integration:
- **Contact**: Israeli Tax Authority Help Desk
- **Portal**: https://www.gov.il/en/departments/israel_tax_authority

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Status**: ✅ System Active & Operational
