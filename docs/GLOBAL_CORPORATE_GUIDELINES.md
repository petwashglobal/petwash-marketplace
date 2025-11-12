# 🌍 Pet Wash™ - Global Corporate Guidelines

**Last Updated:** November 8, 2025  
**Version:** 2.0  
**Applies To:** All 8 Platforms, All Employees, All Contractors, All Partners

---

## 📋 **EXECUTIVE SUMMARY**

Pet Wash™ is the world's leading pet care ecosystem operating as a **SINGLE COMPANY** (Pet Wash™ Ltd, Israel) with **8 INTEGRATED PLATFORMS** serving global markets. This document establishes unified operational standards, governance structures, and compliance requirements for all business units.

### Quick Reference
- **Entity**: Pet Wash™ Ltd (Israel) - Single Company
- **Platforms**: 8 Integrated Services
- **Markets**: Israel (Active), Global Expansion (Planned)
- **Payment Gateway**: Nayax Israel (Exclusive)
- **Tax Structure**: Israeli VAT 18% on commission only
- **Escrow**: 72-hour hold for all marketplace transactions

---

## 🏢 **SINGLE COMPANY ARCHITECTURE**

### Legal Structure
**CRITICAL**: Pet Wash™ operates as a **SINGLE COMPANY** - Pet Wash™ Ltd (Israel)

❌ **INCORRECT**: Multiple subsidiaries, separate legal entities per platform  
✅ **CORRECT**: One company, multiple divisions/platforms

### Corporate Hierarchy
```
Pet Wash™ Ltd (Israel)
├── K9000™ Division (DIY Wash Stations)
├── Sitter Suite™ Division (Pet Sitting Marketplace)
├── Walk My Pet™ Division (Dog Walking Services)
├── PetTrek™ Division (Pet Transport)
├── Academy™ Division (Training & Education)
├── Plush Lab™ Division (Avatar Creator)
├── Main Wash Division (Professional Services)
└── Club™ Division (Social & Community)
```

### Financial Model
- **ALL invoices** show "Pet Wash™ Ltd" as seller
- **ALL payments** processed through Nayax Israel
- **ALL commission** subject to Israeli VAT 18%
- **ALL marketplace transactions** use 72-hour escrow
- **NO separate entities** per platform

---

## 💳 **PAYMENTS & LEDGER SYSTEM**

### Unified Payment Architecture

**Central Payments & Ledger Service**:
- All platforms integrate with central service
- NO direct Nayax integration by platforms
- Unified ledger for all transactions
- Automated VAT calculation and reporting

### Payment Flow
```
Customer Payment
    ↓
Nayax Israel Gateway
    ↓
72-Hour Escrow Hold
    ↓
Central Payments Service
    ↓
├── Platform Commission (18% VAT)
├── Contractor Payment (after escrow release)
└── Ledger Entry (immutable blockchain-style)
```

### Commission Structure

| Platform | Commission Rate | VAT | Escrow |
|----------|----------------|-----|--------|
| K9000™ | 0% (Direct) | N/A | No |
| Sitter Suite™ | 15% | 18% VAT | 72h |
| Walk My Pet™ | 12% | 18% VAT | 72h |
| PetTrek™ | 18% | 18% VAT | 72h |
| Academy™ | 20% | 18% VAT | 72h |
| Plush Lab™ | 0% (Direct) | N/A | No |
| Main Wash | 0% (Direct) | N/A | No |
| Club™ | Subscription | 18% VAT | No |
```

### Invoice Requirements

**ALL invoices MUST include**:
- Seller: "Pet Wash™ Ltd"
- VAT Number: IL-XXXXXXXXX
- Israeli VAT 18% (on commission only)
- Platform name as "Service Category"
- Escrow status (if applicable)

---

## 🔐 **AUTHENTICATION & IDENTITY**

### Identity Service V2.0

**OAuth 2.1/OIDC Standards**:
- Single Sign-On (SSO) across all platforms
- Biometric authentication (WebAuthn Level 2)
- Multi-factor authentication (MFA)
- Passkey support (Apple, Google, Windows Hello)

### Authentication Flow
```
User Registration
    ↓
Email Verification (Firebase)
    ↓
Biometric Enrollment (Optional)
    ↓
Gmail Integration (Optional)
    ↓
Welcome Consent Page ← YOU ARE HERE
    ↓
Platform Access Granted
```

### Zero-Error Tolerance
- **NO password recovery issues**
- **NO account lockouts** without recovery path
- **NO data loss** during authentication
- **100% uptime** for auth services

---

## 📊 **CONTRACTOR LIFECYCLE MANAGEMENT**

### Complete Lifecycle
```
Registration → KYC Verification → Onboarding → Active Service → Performance Review → Trust Score Updates → Payments → Retention/Termination
```

### Contractor Tiers

| Tier | Trust Score | Benefits |
|------|-------------|----------|
| Bronze | 0-499 | Standard commission, 5 active listings |
| Silver | 500-749 | -2% commission, 10 active listings, Priority support |
| Gold | 750-899 | -5% commission, 20 active listings, Featured placement |
| Platinum | 900-999 | -7% commission, Unlimited listings, VIP support, Early access |

### KYC Requirements
- **Passport verification** (Google Vision API + MRZ parsing)
- **Biometric data** (encrypted, 7-year retention)
- **Background check** (Israel-specific)
- **Admin approval** required

### Violation System
- **Minor Violations**: Warning, performance review
- **Major Violations**: Suspension, escrow hold
- **Critical Violations**: Immediate termination, permanent ban

---

## 🌐 **MULTI-LANGUAGE & LOCALIZATION**

### Supported Languages
1. **Hebrew** (Primary - Israel market)
2. **English** (Global standard)
3. **Arabic** (Regional)
4. **Russian** (Immigrant community)
5. **French** (Global expansion)
6. **Spanish** (Global expansion)

### Language Compliance Rules

**CRITICAL**: 100% Pure Translations

✅ **CORRECT**:
- Hebrew: "הירשם" (Sign Up)
- Arabic: "تسجيل" (Sign Up)
- Russian: "Регистрация" (Sign Up)

❌ **INCORRECT**:
- Hebrew: "Sign In" (English in Hebrew page)
- Arabic: "Dashboard" (English in Arabic page)
- Russian: "Loading..." (English in Russian page)

**EXCEPTION**: Brand names only
- Pet Wash™ (keep in English)
- K9000™ (keep in English)
- Nayax (keep in English)

### Translation Services
- **Google Cloud Translation API** for real-time
- **Professional translators** for legal/marketing
- **Cultural localization** for each market

---

## 📞 **COMMUNICATION PROTOCOLS**

### WhatsApp Business Integration

**Employee Communication**:
- Expense approval notifications
- Shift schedules and updates
- Emergency alerts
- Document requests

**Customer Communication**:
- Booking confirmations
- Service updates
- Payment receipts
- Support tickets

### Email Communications

**SendGrid Templates**:
- Welcome emails (7-star luxury design)
- Booking confirmations
- Payment invoices
- Monthly reports

**Gmail Integration** (Optional for users):
- Personalized updates
- Real-time notifications
- Digital invoices

### Language Strategy
- **Israeli Market**: Primarily Hebrew with English brand touches
- **Global Markets**: Local language primary, English secondary
- **Franchise Materials**: ONLY international markets (Canada, USA, Australia, England)

---

## 🛡️ **SECURITY & COMPLIANCE**

### Data Protection

**GDPR Compliance** (EU customers):
- Right to access
- Right to deletion
- Right to portability
- Consent management

**Israeli Privacy Law 2025**:
- Biometric data protection
- 7-year data retention for legal documents
- Encryption at rest and in transit
- DPO (Data Protection Officer) system

### Security Monitoring

**AI-Powered 24/7 Monitoring**:
- Biometric security events
- Loyalty activity anomalies
- OAuth certificate validation
- Notification consent tracking

**Retention**: 7 years for all security logs

### Blockchain-Style Audit Trail
- Immutable transaction ledger
- Cryptographic hash chaining
- Fraud prevention
- Compliance verification

---

## 🎨 **BRAND STANDARDS**

### Logo Usage

**MANDATORY**: Only official Pet Wash™ logo
- File: `/brand/petwash-logo-official.png`
- **MUST include TM trademark symbol**
- Never create custom logos
- Never remove TM symbol

### Design Language

**7-Star Luxury Standards**:
- Neomorphism design system
- Premium animations (Apple-style spring)
- Glassmorphism effects
- Consistent layout across all languages

**CRITICAL**: Never change layout without approval
- Hamburger menu: ALWAYS top-right
- Mobile sheet: ALWAYS slides from right
- Logo position: FIXED across all languages
- Social icons: CONSISTENT positioning

---

## 📱 **PLATFORM-SPECIFIC OPERATIONS**

### K9000™ DIY Wash Stations

**Business Model**: Direct sales (no commission)  
**IoT Integration**: Cloud-based K9000 Twin management  
**Payment**: Nayax Spark/Lynx API  
**Operations**: 
- Station health monitoring
- Supply tracking
- Predictive maintenance (AI-powered)
- Real-time status dashboards

---

### The Sitter Suite™ Pet Sitting Marketplace

**Business Model**: Commission 15% + VAT 18%  
**Escrow**: 72-hour hold  
**KYC**: Required for all sitters  
**AI Triage**: Gemini-powered booking matching

**Operations**:
- Background checks
- Trust score system
- Real-time GPS check-in
- Photo updates
- Emergency escalation

---

### Walk My Pet™ Dog Walking Services

**Business Model**: Commission 12% + VAT 18%  
**Escrow**: 72-hour hold  
**Real-time GPS**: Live walk tracking  
**Blockchain Audit**: Immutable walk records

**Operations**:
- Walker verification
- Route optimization
- Emergency contact system
- Photo updates during walk
- Performance analytics

---

### PetTrek™ Pet Transport

**Business Model**: Commission 18% + VAT 18%  
**Escrow**: 72-hour hold  
**Uber-style**: Dynamic pricing  
**Real-time GPS**: Live trip tracking

**Operations**:
- Driver background checks
- Vehicle verification
- Pet safety protocols
- Temperature monitoring
- Emergency vet network

---

### Pet Wash Academy™ Training & Education

**Business Model**: Commission 20% + VAT 18%  
**Escrow**: 72-hour hold  
**Certification**: Trainer verification  

**Operations**:
- Curriculum approval
- Session scheduling
- Progress tracking
- Certificate issuance
- Review system

---

### The Plush Lab™ Avatar Creator

**Business Model**: Direct sales (no commission)  
**AI Technology**: Google Vision API landmark detection  
**Multilingual TTS**: Voice customization

**Operations**:
- Photo processing pipeline
- Avatar generation
- Custom voice creation
- Digital asset delivery

---

### Main Wash Professional Services

**Business Model**: Direct sales (no commission)  
**Services**: Full-service grooming  

**Operations**:
- Appointment scheduling
- Service packages
- Quality assurance
- Customer reviews

---

### Pet Wash Club™ Social Platform

**Business Model**: Subscription-based + VAT 18%  
**Features**: Instagram-style social network  
**AI Moderation**: Gemini-powered content filtering

**Operations**:
- Content moderation
- Community guidelines
- User engagement
- Premium features

---

## 🚀 **FRANCHISE OPERATIONS**

### Geographic Restrictions

**CRITICAL**: Franchise marketing rules

✅ **ALLOWED**: Canada, USA, Australia, England  
❌ **PROHIBITED**: Israel (not yet open for franchising)

**Currency Requirements**:
- CAD for Canadian examples
- USD for American examples
- AUD for Australian examples
- GBP for English examples
- **NO Israeli Shekels (₪) in franchise materials**

### Franchise Support

**Google Business Profile API Integration**:
- Automated location management
- Review response automation
- Hours and info updates
- Multi-location dashboard

---

## 📞 **CUSTOMER SUPPORT**

### Support Channels

**Tier 1** (Self-Service):
- Kenzo AI Chat Assistant (Gemini 2.5 Flash)
- FAQ & Help Center
- Video Tutorials

**Tier 2** (Human Support):
- Email: Support@PetWash.co.il
- WhatsApp: +972-XX-XXX-XXXX
- Live Chat (business hours)

**Tier 3** (Emergency):
- 24/7 Emergency hotline
- Platform-specific emergency protocols
- Escalation to management

### Response Times

| Priority | First Response | Resolution |
|----------|---------------|------------|
| Critical (Safety) | 15 minutes | 1 hour |
| High (Payment issue) | 1 hour | 4 hours |
| Medium (Service issue) | 4 hours | 24 hours |
| Low (General inquiry) | 24 hours | 48 hours |

---

## 🌱 **SUSTAINABILITY & SOCIAL RESPONSIBILITY**

### Environmental Commitment
- Organic pet care products only
- Water conservation technology
- Biodegradable packaging
- Carbon-neutral operations (goal: 2026)

### Social Responsibility
- 5% of profits to pet shelters
- Free services for shelter animals
- Employee volunteer programs
- Community education initiatives

---

## 📈 **REPORTING & ANALYTICS**

### Management Dashboards

**Enterprise HQ Dashboard**:
- Real-time revenue across all platforms
- Contractor performance metrics
- Customer satisfaction scores
- Operational KPIs

**Platform-Specific Reports**:
- Bookings and revenue
- Contractor earnings
- Customer retention
- Service quality metrics

**Financial Reports**:
- Automated P&L per platform
- VAT calculation and filing
- Bank reconciliation
- Monthly invoicing

---

## 🔄 **CONTINUOUS IMPROVEMENT**

### Version Control
- All platform updates reviewed by CTO
- Quarterly security audits
- Monthly performance reviews
- Annual strategic planning

### Feedback Loops
- Customer satisfaction surveys
- Contractor feedback sessions
- Employee town halls
- Partner advisory board

---

## ✅ **COMPLIANCE CHECKLIST**

Before launching any feature or platform:

- [ ] Single company architecture verified
- [ ] Nayax Israel payment integration
- [ ] 72-hour escrow for marketplaces
- [ ] Israeli VAT 18% on commission
- [ ] Identity Service V2.0 integration
- [ ] KYC verification (if contractor-facing)
- [ ] Multi-language support (6 languages)
- [ ] GDPR + Israeli Privacy Law compliance
- [ ] AI security monitoring enabled
- [ ] Blockchain audit trail implemented
- [ ] Brand standards followed
- [ ] Documentation updated
- [ ] Testing completed
- [ ] Management approval obtained

---

## 📚 **RELATED DOCUMENTATION**

| Document | Purpose |
|----------|---------|
| `docs/GOOGLE_APIS_COMPLETE_INVENTORY.md` | All Google Cloud APIs |
| `docs/UNIFIED_GOOGLE_SERVICES_ARCHITECTURE.md` | Google services integration |
| `docs/LANGUAGE_COMPLIANCE_RULES.md` | Translation guidelines |
| `shared/schema-enterprise.ts` | Database schemas |
| `server/services/` | All service implementations |

---

## 🎯 **KEY TAKEAWAYS**

1. **ONE COMPANY** - Pet Wash™ Ltd (Israel), no subsidiaries
2. **8 PLATFORMS** - Integrated ecosystem, not separate businesses
3. **ONE PAYMENT GATEWAY** - Nayax Israel exclusive
4. **ONE TAX SYSTEM** - Israeli VAT 18% on commission
5. **ONE IDENTITY SYSTEM** - OAuth 2.1/OIDC across all platforms
6. **ZERO-ERROR TOLERANCE** - Authentication, payments, data integrity
7. **GLOBAL STANDARDS** - Brand consistency across all markets

---

## 📞 **CONTACTS**

**General Inquiries**: Support@PetWash.co.il  
**Franchise Opportunities**: franchise@petwash.co.il  
**Technical Support**: tech@petwash.co.il  
**Media Relations**: press@petwash.co.il

---

**© 2025 Pet Wash™ Ltd. All Rights Reserved.**  
**Version 2.0 - November 8, 2025**
