# PetWash™ Security & Fraud Prevention Systems
## Enterprise-Grade Protection for 2025

**Last Updated**: October 31, 2025  
**Document Version**: 1.0  
**Classification**: Internal - Technical Documentation

---

## 🛡️ Executive Summary

PetWash Ltd employs **8 layers of enterprise-grade security** and fraud prevention systems to protect customer data, financial transactions, and platform integrity. Our security architecture adheres to **2025 Israeli Privacy Law**, **GDPR compliance**, and **Payment Card Industry Data Security Standards (PCI DSS)**.

---

## 🔐 Multi-Layered Security Architecture

### 1. **Authentication & Identity Management**

#### Firebase Authentication
- **Provider**: Google Firebase Auth
- **Methods**: 
  - Email/Password (hashed with bcrypt)
  - Google OAuth 2.0
  - WebAuthn/Passkey (Biometric)
  - Mobile OAuth2
- **Session Management**: Firebase session cookies with secure HTTP-only flags
- **Password Security**: Industry-standard bcrypt hashing with salt

#### WebAuthn Level 2 (Passkeys)
- **Biometric Authentication**: Face ID, Touch ID, Windows Hello
- **FIDO2 Certified**: Public key cryptography
- **Device Registry**: Tracking all authenticated devices
- **Unusual Device Alerts**: Automatic notifications for new device logins

**Files**: 
- `server/webauthn/service.ts`
- `server/webauthn/deviceRegistry.ts`
- `server/services/UserDeviceService.ts`

---

### 2. **Rate Limiting & DDoS Protection**

#### Multi-Tier Rate Limiters
| Endpoint Type | Limit | Window | Purpose |
|--------------|-------|--------|---------|
| General API | 100 req | 15 min | Prevent API abuse |
| Admin Routes | 200 req | 15 min | Higher limit for ops |
| Payments | 5 req | 15 min | Financial transaction safety |
| File Uploads | 20 req | 1 hour | Prevent storage abuse |
| WebAuthn | 60 req | 1 min | Passkey security |
| Login Attempts | 5 attempts | 5 min | Brute force prevention |

#### Login Rate Limiting
- **Failed Login Tracking**: Redis/in-memory cache
- **Account Lockout**: 5 failed attempts = 5-minute block
- **LRU Cache**: 1000 user limit for efficiency
- **Automated Alerts**: Security team notified on burst attacks

**Files**:
- `server/middleware/rateLimiter.ts`
- `server/middleware/loginRateLimiter.ts`

---

### 3. **Fraud Detection System**

#### Real-Time Fraud Monitoring
- **Velocity Checks**: Detect unusual transaction patterns
- **IP Geolocation**: Block suspicious locations
- **Device Fingerprinting**: Track device behavior
- **Transaction Amount Analysis**: Flag unusually high amounts
- **Time-Pattern Analysis**: Detect automated attacks
- **Duplicate Transaction Detection**: Prevent double-spend

#### K9000 IoT Security
- **IP Whitelisting**: Restrict station access to authorized IPs
- **API Key Authentication**: Secure station-to-server communication
- **Emergency Stop Protocol**: Remote shutdown capability
- **Audit Logging**: All station actions recorded

**Files**:
- `server/middleware/fraudDetection.ts`
- `server/middleware/k9000Security.ts`

---

### 4. **Blockchain-Style Audit Trail**

#### Immutable Transaction Ledger
- **Cryptographic Hash Chaining**: Each transaction linked to previous via SHA-256
- **Tamper Detection**: Any modification breaks the chain
- **Double-Spend Prevention**: Validate all voucher/gift card redemptions
- **Customer Transaction History**: Complete immutable record

**Features**:
- Merkle tree snapshots (daily at 2 AM IST)
- Chain integrity verification
- 7-year data retention (Israeli law compliance)

**Files**:
- `server/services/AuditLedgerService.ts`
- `server/routes/audit.ts`

---

### 5. **AI-Powered Security Monitoring**

#### Automated Security Analysis
- **Biometric Security Monitor**: Track passkey usage, revocations, unusual patterns
- **Loyalty Activity Monitor**: Detect fraudulent loyalty abuse
- **OAuth Certificate Monitor**: Verify Google/Facebook cert validity
- **Notification Consent Monitor**: GDPR compliance tracking
- **Real-Time Alerts**: Slack notifications for critical events

**Monitoring Frequency**:
- Biometric: Every 5 minutes
- Loyalty: Hourly
- Certificates: Daily
- Consent: Daily

**Files**:
- `server/services/BiometricSecurityMonitor.ts`
- `server/services/LoyaltyActivityMonitor.ts`
- `server/services/AIMonitoringService.ts`

---

### 6. **Payment Security**

#### PCI DSS Compliance
- **Payment Processors**: Nayax (primary), Stripe (backup)
- **Tokenization**: No card data stored on our servers
- **SSL/TLS Encryption**: All payment data in transit encrypted
- **3D Secure**: Additional authentication for high-value transactions
- **Split Payments**: Secure marketplace commission handling (The Sitter Suite™, Walk My Pet™, PetTrek™)

#### Financial Safeguards
- **Amount Limits**: Configurable per-transaction maximums
- **Refund Verification**: Admin approval required
- **Automated Reconciliation**: Daily bank statement matching (Mizrahi-Tefahot Bank)
- **Invoice Compliance**: Israeli Tax Authority (ITA) API integration

**Files**:
- `server/routes/nayax-payments.ts`
- `server/enterprise/mizrahiBank.ts`
- `server/enterprise/israeliTax.ts`

---

### 7. **Data Protection & Privacy**

#### Israeli Privacy Law 2025 Compliance
- **Data Encryption**: AES-256 for data at rest, TLS 1.3 for data in transit
- **GDPR Rights**: Data export, deletion, rectification, portability
- **Consent Management**: Firebase-based audit trail
- **DPO System**: Data Protection Officer oversight
- **Breach Notification**: Automated incident reporting (72-hour window)
- **7-Year Log Retention**: Security monitoring data archived

#### Biometric Data Protection
- **Passkey Storage**: Only public keys stored (private keys on device)
- **Biometric Redaction**: Logs never contain biometric templates
- **KYC Security**: Government ID verification with encrypted storage

**Files**:
- `server/compliance/israeli-privacy-2025.ts`
- `server/services/EncryptionService.ts`
- `server/enterprise/userDeletion.ts`

---

### 8. **WhatsApp Business Security**

#### Employee Communication Security
- **Twilio-Powered**: Enterprise-grade WhatsApp Business API
- **Message Templates**: Pre-approved anti-spam compliance
- **Phone Validation**: E.164 format enforcement (+972XXXXXXXXX)
- **Privacy Protection**: Partial phone numbers in logs
- **Bilingual Support**: Hebrew/English messages

**Use Cases**:
- Expense approval notifications (CEO/supervisors)
- Launch event invitations
- Team notifications

**Files**:
- `server/services/WhatsAppService.ts`
- `server/routes/launch-event.ts`

---

## 🚨 Security Incident Response

### Automated Alert System
- **Slack Integration**: Real-time alerts to ALERTS_SLACK_WEBHOOK
- **Email Notifications**: Security team via SendGrid
- **Sentry Error Tracking**: Production error monitoring
- **Device Security Alerts**: Unusual login notifications

### Monitoring & Logging
- **Winston Logger**: Structured JSON logging
- **7-Year Retention**: Compliance with Israeli regulations
- **Log Cleanup**: Automated daily cleanup of expired logs
- **Penetration Test Tracking**: Regular security audits documented

---

## 📊 Security Metrics & KPIs

### Real-Time Monitoring
- Failed login attempts per hour
- Rate limit violations
- Fraud detection triggers
- WebAuthn failures
- Payment anomalies
- API error rates

### Monthly Security Reports
- Penetration test results
- Security incident count
- GDPR data requests handled
- Failed authentication analysis
- Fraud prevention effectiveness

---

## 🔧 Security Configuration

### Environment Variables (Secrets)
```bash
# Firebase
VITE_FIREBASE_API_KEY
VITE_FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_KEY

# Twilio WhatsApp
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID

# Security Monitoring
ALERTS_SLACK_WEBHOOK
SENTRY_DSN
METRICS_AUTH_TOKEN

# Encryption
KYC_SALT
VOUCHER_SALT
MOBILE_LINK_SECRET
```

### Security Headers
- Content-Security-Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security (HSTS)
- X-XSS-Protection: 1; mode=block

**File**: `server/middleware/securityHeaders.ts`

---

## 🎯 Best Practices for Developers

### ✅ DO
- Always validate user input (Zod schemas)
- Use parameterized queries (Drizzle ORM)
- Log security events
- Apply rate limiters to new endpoints
- Encrypt sensitive data at rest
- Use Firebase Auth middleware for protected routes
- Implement CSRF protection for state-changing operations

### ❌ DON'T
- Log sensitive data (passwords, tokens, credit cards)
- Hardcode secrets in code
- Bypass authentication checks
- Disable security middleware in production
- Store PII without encryption
- Use HTTP for sensitive operations

---

## 📞 Security Contacts

### Internal Team
- **CEO**: Nir Hadad (nirhadad1@gmail.com)
- **Security Team**: Via Slack webhook alerts
- **DPO**: privacy@petwash.co.il

### External Partners
- **Firebase**: Google Cloud Support
- **Nayax**: Merchant support portal
- **Twilio**: WhatsApp Business support
- **Sentry**: Error tracking platform

---

## 📚 Related Documentation

- `/docs/CORPORATE_STRUCTURE.md` - Legal entity structure
- `/server/compliance/israeli-privacy-2025.ts` - Privacy law implementation
- `/server/webauthn/config.ts` - WebAuthn configuration
- `/server/middleware/` - All security middleware
- `/server/services/` - Security monitoring services

---

## 🔄 Document Updates

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-31 | 1.0 | Initial security documentation | System |

---

**© 2025 PetWash Ltd. Confidential & Proprietary.**  
**Do not distribute outside the organization.**
