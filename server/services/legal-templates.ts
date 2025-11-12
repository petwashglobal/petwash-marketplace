/**
 * Legal Document Templates
 * 
 * Comprehensive legal documents for staff onboarding
 * Modeled after Airbnb, Uber, Booking.com best practices
 * 
 * Templates include:
 * 1. Independent Contractor Agreement
 * 2. Background Check Authorization
 * 3. Non-Disclosure Agreement (NDA)
 * 4. Code of Conduct & Ethics
 * 5. Safety & Training Certification
 * 6. W-9 Tax Form
 * 7. Insurance & Liability Waiver
 * 8. Vehicle Inspection Checklist
 * 9. Property/Host Agreement
 * 10. Anti-Fraud & Compliance Agreement
 */

export const legalTemplates = {
  /**
   * 1. Independent Contractor Agreement
   * Based on Uber/Airbnb independent contractor models
   */
  independentContractorAgreement: {
    name: 'Independent Contractor Agreement',
    type: 'contract',
    description: 'Agreement establishing contractor relationship',
    content: `
# INDEPENDENT CONTRACTOR AGREEMENT

**This Independent Contractor Agreement** ("Agreement") is entered into as of {{DATE}} by and between:

**Pet Wash™** ("Company")  
Business Address: {{COMPANY_ADDRESS}}  
Israel Business Registration: {{COMPANY_REG}}

and

**{{CONTRACTOR_NAME}}** ("Contractor")  
Address: {{CONTRACTOR_ADDRESS}}  
Tax ID/SSN: {{TAX_ID}}

## 1. INDEPENDENT CONTRACTOR STATUS

1.1 The Contractor is an independent contractor, not an employee. The Contractor:
- Retains the right to control the manner and means of performing services
- May accept or decline opportunities at their discretion
- Is responsible for their own taxes, insurance, and benefits
- May provide services to other companies

1.2 Nothing in this Agreement creates an employment, partnership, or joint venture relationship.

## 2. SERVICES

2.1 The Contractor agrees to provide {{SERVICE_TYPE}} services including:
{{#if SITTER}}
- Pet sitting and care services
- Following Pet Wash™ safety protocols
- Maintaining communication with pet owners
{{/if}}
{{#if WALKER}}
- Dog walking services per Pet Wash™ standards
- GPS tracking of walks
- Photo documentation of completed walks
{{/if}}
{{#if DRIVER}}
- Pet transportation services
- Vehicle maintenance and insurance compliance
- Safe handling and transport of pets
{{/if}}

## 3. COMPENSATION

3.1 The Contractor shall receive:
- {{COMMISSION_RATE}}% commission on completed bookings
- Payment processed within {{PAYMENT_DAYS}} days of service completion
- All payments subject to applicable tax withholding

3.2 The Contractor is responsible for:
- All business expenses (fuel, supplies, equipment)
- Tax obligations including self-employment tax
- Professional liability insurance

## 4. TERM AND TERMINATION

4.1 This Agreement begins on {{START_DATE}} and continues until terminated by either party.

4.2 Either party may terminate this Agreement:
- With {{NOTICE_DAYS}} days written notice
- Immediately for cause (fraud, safety violations, breach of terms)

## 5. CONFIDENTIALITY AND NON-DISCLOSURE

5.1 The Contractor agrees to protect Pet Wash™ confidential information including:
- Customer data and contact information
- Business processes and pricing strategies
- Proprietary technology and software

5.2 Confidentiality obligations survive termination.

## 6. COMPLIANCE AND CONDUCT

6.1 The Contractor agrees to:
- Comply with all applicable laws and regulations
- Maintain required licenses, certifications, and insurance
- Follow Pet Wash™ Code of Conduct and Safety Standards
- Submit to periodic background checks as required

6.2 The Contractor shall NOT:
- Engage in fraudulent activity or misrepresentation
- Solicit customers directly outside the Pet Wash™ platform
- Disclose confidential information to third parties

## 7. INSURANCE AND LIABILITY

7.1 The Contractor maintains adequate insurance coverage including:
{{#if DRIVER}}
- Commercial auto insurance with minimum {{MIN_COVERAGE}} coverage
{{/if}}
- General liability insurance
- Professional liability/errors & omissions insurance

7.2 The Contractor indemnifies Pet Wash™ from claims arising from Contractor's negligence or misconduct.

## 8. DISPUTE RESOLUTION

8.1 Disputes shall be resolved through:
1. Good faith negotiation
2. Mediation in {{JURISDICTION}}
3. Binding arbitration if mediation fails

## 9. GOVERNING LAW

This Agreement is governed by the laws of {{JURISDICTION}}.

---

**SIGNATURES:**

**Contractor:**  
Signature: _______________________  
Name: {{CONTRACTOR_NAME}}  
Date: {{DATE}}

**Pet Wash™:**  
Signature: _______________________  
Name: {{COMPANY_REP_NAME}}  
Title: {{COMPANY_REP_TITLE}}  
Date: {{DATE}}
`,
  },

  /**
   * 2. Background Check Authorization
   * Based on Uber's background check consent
   */
  backgroundCheckAuthorization: {
    name: 'Background Check Authorization & Consent',
    type: 'policy',
    description: 'Authorization for criminal and driving record checks',
    content: `
# BACKGROUND CHECK AUTHORIZATION & CONSENT

**I, {{CONTRACTOR_NAME}}**, hereby authorize Pet Wash™ and its designated agents (including but not limited to Checkr, HireRight, or similar services) to conduct comprehensive background checks including:

## 1. SCOPE OF BACKGROUND CHECK

✓ Criminal history (7-year lookback period)  
✓ Motor vehicle records (for drivers)  
✓ Identity verification  
✓ Employment history verification  
✓ Sex offender registry search  
✓ Global watchlist screening  
✓ Credit history (where legally permissible)

## 2. INFORMATION AUTHORIZATION

I authorize the release of information from:
- Law enforcement agencies
- Courts and correctional institutions
- Motor vehicle departments
- Previous employers
- Educational institutions

## 3. CONSENT AND UNDERSTANDING

I understand and agree that:

✓ Background checks will be conducted prior to approval and may be repeated periodically  
✓ Adverse findings may result in disqualification or termination  
✓ I have the right to dispute inaccurate information  
✓ A copy of the background check report will be provided upon request  
✓ I have reviewed the Summary of Rights under the Fair Credit Reporting Act (FCRA)

## 4. ONGOING AUTHORIZATION

This authorization remains valid for:
- Initial background check
- Annual re-screening
- Incident-triggered additional checks

## 5. PERSONAL INFORMATION

**Full Legal Name:** {{FULL_NAME}}  
**Date of Birth:** {{DOB}}  
**Social Security Number:** {{SSN_LAST_4}} (last 4 digits)  
**Driver's License #:** {{DRIVERS_LICENSE}} (if applicable)  
**Current Address:** {{ADDRESS}}  
**Previous Addresses (last 7 years):** {{PREVIOUS_ADDRESSES}}

---

**SIGNATURE:**

I certify that the information provided is accurate and complete. I understand that providing false information may result in immediate disqualification or termination.

Signature: _______________________  
Name: {{CONTRACTOR_NAME}}  
Date: {{DATE}}
`,
  },

  /**
   * 3. Non-Disclosure Agreement
   * Based on Booking.com/Airbnb NDAs
   */
  nda: {
    name: 'Non-Disclosure Agreement (NDA)',
    type: 'nda',
    description: 'Protection of confidential business information',
    content: `
# NON-DISCLOSURE AGREEMENT (NDA)

**WHEREAS**, {{CONTRACTOR_NAME}} ("Recipient") will receive confidential information from Pet Wash™ ("Discloser") in connection with providing services;

**NOW THEREFORE**, in consideration of access to Confidential Information, the parties agree:

## 1. DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" includes but is not limited to:

**Customer Data:**
- Names, addresses, contact information
- Pet information and medical records
- Booking history and preferences
- Payment information

**Business Information:**
- Pricing strategies and commission structures
- Marketing plans and customer acquisition methods
- Financial data and revenue reports
- Trade secrets and proprietary processes

**Technology:**
- Software, algorithms, and source code
- Technical documentation and specifications
- API keys and system credentials

## 2. OBLIGATIONS

The Recipient agrees to:

✓ Maintain strict confidentiality of all Confidential Information  
✓ Use Confidential Information ONLY for authorized services  
✓ NOT disclose to any third party without prior written consent  
✓ Protect information with at least the same care as own confidential data  
✓ Return or destroy all Confidential Information upon termination

## 3. EXCEPTIONS

This Agreement does NOT apply to information that:
- Is publicly available through no fault of Recipient
- Was known to Recipient prior to disclosure
- Is independently developed by Recipient
- Is required to be disclosed by law or court order

## 4. CUSTOMER DATA PROTECTION (GDPR/Israeli Privacy Law)

Recipient acknowledges that customer data is subject to:
- EU General Data Protection Regulation (GDPR)
- Israeli Privacy Protection Law, 5741-1981
- California Consumer Privacy Act (CCPA)

Recipient agrees to:
✓ Process data only as instructed by Pet Wash™  
✓ Implement appropriate technical and organizational security measures  
✓ Report any data breaches within 24 hours  
✓ NOT transfer data outside authorized jurisdictions

## 5. DURATION

Confidentiality obligations:
- Begin immediately upon signing
- Continue for {{DURATION_YEARS}} years after termination
- Survive indefinitely for trade secrets

## 6. REMEDIES

Recipient acknowledges that breach of this NDA may cause irreparable harm. Pet Wash™ may seek:
- Immediate injunctive relief
- Monetary damages and legal fees
- Termination of contractor relationship

---

**SIGNATURES:**

**Recipient:**  
Signature: _______________________  
Name: {{CONTRACTOR_NAME}}  
Date: {{DATE}}

**Pet Wash™:**  
Signature: _______________________  
Name: {{COMPANY_REP_NAME}}  
Date: {{DATE}}
`,
  },

  /**
   * 10. Anti-Fraud & Compliance Agreement
   * Custom for Israel operations - prevents fake receipts, time theft
   */
  antiFraudAgreement: {
    name: 'Anti-Fraud & Compliance Agreement',
    type: 'policy',
    description: 'Prevention of expense fraud and time theft',
    content: `
# ANTI-FRAUD & COMPLIANCE AGREEMENT

**Pet Wash™** operates with zero tolerance for fraudulent activity. This agreement outlines prohibited conduct and fraud prevention measures.

## 1. PROHIBITED FRAUDULENT ACTIVITIES

The Contractor agrees to NEVER engage in:

### Expense Fraud
❌ Submitting fake or altered receipts  
❌ Double-submitting the same expense  
❌ Inflating prices or amounts  
❌ Claiming personal expenses as business expenses  
❌ Using AI-generated or template receipts

### Time Theft
❌ Falsifying work hours or GPS locations  
❌ Clock-in from incorrect locations  
❌ Reporting services not actually performed  
❌ Submitting inaccurate logbook entries

### Customer Solicitation
❌ Contacting customers outside the Pet Wash™ platform  
❌ Accepting payments directly from customers  
❌ Directing customers to competing services

## 2. FRAUD DETECTION MEASURES

I understand that Pet Wash™ employs:

✓ **AI Receipt Verification** - Google Vision OCR + Gemini AI analyze all receipts  
✓ **GPS Tracking** - Real-time location verification for all logged activities  
✓ **Duplicate Detection** - Automatic detection of duplicate receipt submissions  
✓ **Pattern Analysis** - AI monitoring for suspicious expense patterns  
✓ **Manager Review** - All expenses require manager approval  
✓ **Audit Trail** - Immutable blockchain-style ledger of all transactions

## 3. RECEIPT SUBMISSION REQUIREMENTS

All expense receipts must:

✓ Be original, unaltered photographs of actual receipts  
✓ Clearly show: merchant name, date, items, total, tax (VAT)  
✓ Match claimed amount within ₪5  
✓ Include Israeli VAT (18%) where applicable  
✓ Be submitted within {{RECEIPT_DAYS}} days of purchase

❌ PROHIBITED:
- Screenshots or digital copies without originals
- Receipts with whited-out or obscured information
- Round-number amounts without itemization (₪100, ₪200, etc.)
- Receipts from suspicious or non-existent merchants

## 4. GPS VERIFICATION REQUIREMENTS

For all logged work activities:

✓ GPS location must be captured at start and end  
✓ Location must match customer address ±50 meters  
✓ Movement distance must be reasonable for claimed activity  
✓ GPS accuracy must be <30 meters

## 5. CONSEQUENCES OF FRAUD

**First Offense:**
- Immediate suspension
- Forfeiture of pending payments
- Mandatory fraud prevention training

**Second Offense / Serious Fraud:**
- Immediate termination
- Ban from Pet Wash™ platform (all markets)
- Legal action including criminal charges
- Collection of damages + legal fees

## 6. FRAUD REPORTING OBLIGATIONS

I agree to:
✓ Report suspected fraud by other contractors  
✓ Cooperate fully with fraud investigations  
✓ Provide documentation upon request

## 7. ACKNOWLEDGMENT

I certify that:

✅ I have read and understand this Anti-Fraud Agreement  
✅ I will comply with all expense and logbook requirements  
✅ I understand the fraud detection measures in place  
✅ I acknowledge the severe consequences of fraudulent activity  
✅ I agree to submit only legitimate, accurate expenses and time records

---

**SIGNATURE:**

By signing below, I acknowledge that I have read, understand, and agree to comply with this Anti-Fraud & Compliance Agreement.

Signature: _______________________  
Name: {{CONTRACTOR_NAME}}  
Date: {{DATE}}  
Employee/Contractor ID: {{CONTRACTOR_ID}}

**Witness (Pet Wash™ Representative):**

Signature: _______________________  
Name: {{WITNESS_NAME}}  
Date: {{DATE}}
`,
  },
};

export function getLegalTemplateByType(type: string): typeof legalTemplates[keyof typeof legalTemplates] | null {
  const templates: Record<string, any> = legalTemplates;
  return templates[type] || null;
}

export function getAllLegalTemplates() {
  return Object.values(legalTemplates);
}

export function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template;
  
  // Simple variable substitution
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, value || '');
  }
  
  // Remove unfilled variables
  rendered = rendered.replace(/{{[A-Z_]+}}/g, '[TO BE FILLED]');
  
  return rendered;
}
