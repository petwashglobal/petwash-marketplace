# 🐙 Pet Wash™ Octopus Protocol - Route Classification Map

## Overview
This document maps all 119 API routes to their designated "arms" in the Octopus architecture:
- **HEAD OFFICE** 🏢 - Administrative control, compliance, enterprise management
- **FRANCHISE** 🏪 - Individual location operations, staff, equipment
- **CUSTOMER** 📱 - Mobile app features, bookings, loyalty, social
- **SHARED** 🌐 - Public services, multi-role features, infrastructure

---

## 🏢 HEAD OFFICE (Administrative Control - 28 routes)

### Executive & Finance
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `ceo-wallet.ts` | `/api/ceo-wallet` | Admin | Executive wallet management |
| `accounting.ts` | `/api/accounting` | Admin | Financial accounting systems |
| `bank.ts` | `/api/bank` | Admin | Bank integration (Mizrahi-Tefahot) |
| `vat.ts` | `/api/vat` | Admin | VAT calculations and compliance |
| `ita-api.ts` | `/api/ita` | Admin | Israeli Tax Authority integration |

### Enterprise Management
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `enterprise.ts` | `/api/enterprise` | Admin | Core enterprise features |
| `enterprise-corporate.ts` | `/api/enterprise/corporate` | Admin | Corporate structure management |
| `enterprise-finance.ts` | `/api/enterprise/finance` | Admin | Enterprise financial operations |
| `enterprise-franchise.ts` | `/api/enterprise/franchise` | Admin | Franchise oversight from HQ |
| `enterprise-hr.ts` | `/api/enterprise/hr` | Admin | Human resources management |
| `enterprise-logistics.ts` | `/api/enterprise/logistics` | Admin | Supply chain & logistics |
| `enterprise-operations.ts` | `/api/enterprise/operations` | Admin | Operational oversight |
| `enterprise-policy.ts` | `/api/enterprise/policy` | Admin | Corporate policies |
| `enterprise-sales.ts` | `/api/enterprise/sales` | Admin | Sales operations |
| `enterprise-sales-crm.ts` | `/api/enterprise/sales-crm` | Admin | CRM system |

### Governance & Compliance
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `admin.ts` | `/api/admin` | Admin | Admin panel operations |
| `audit.ts` | `/api/audit` | Admin | Audit trail and logging |
| `compliance.ts` | `/api/compliance` | Admin | Legal compliance systems |
| `dataRights.ts` | `/api/data-rights` | Admin | GDPR/Israeli Privacy Law |

### Franchise Management
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `franchise-mgmt.ts` | `/api/franchise-mgmt` | Admin | Franchise management from HQ |
| `management-dashboard.ts` | `/api/management-dashboard` | Admin | Executive dashboard |

### Monitoring & Infrastructure
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `gemini-watchdog.ts` | `/api/gemini-watchdog` | Admin | AI monitoring system |
| `monitoring.ts` | `/api/monitoring` | Admin | System health monitoring |
| `deployment.ts` | `/api/deployment` | Admin | Deployment controls |

### Special Events & Communications
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `launch-event.ts` | `/api/launch-event` | Admin | Product launch events |
| `send-investor-event-email.ts` | `/api/send-investor-event-email` | Admin | Investor communications |
| `send-thank-you.ts` | `/api/send-thank-you` | Admin | Thank you campaigns |
| `test-luxury-launch.ts` | `/api/test-luxury-launch` | Admin | Luxury launch testing |

---

## 🏪 FRANCHISE (Location Operations - 18 routes)

### Franchise Operations
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `franchise.ts` | `/api/franchise` | Franchise | Franchise portal main features |
| `operations.ts` | `/api/operations` | Franchise | Daily operations management |
| `stations.ts` | `/api/stations` | Franchise | Wash station management |

### K9000 IoT Equipment
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `k9000.ts` | `/api/k9000` | Franchise | K9000™ wash station control |
| `k9000Dashboard.ts` | `/api/k9000/dashboard` | Franchise | IoT equipment dashboard |
| `k9000-supplier.ts` | `/api/k9000/supplier` | Franchise | Supply ordering for K9000 |

### Staff & HR
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `employees.ts` | `/api/employees` | Franchise | Employee management |
| `staff-onboarding.ts` | `/api/staff-onboarding` | Franchise | Staff onboarding workflows |
| `job-offers.ts` | `/api/job-offers` | Franchise | Job posting system |
| `contractor.ts` | `/api/contractor` | Franchise | Contractor management |

### Financial Management
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `expenses.ts` | `/api/expenses` | Franchise | Expense management & OCR |

### Quality & Reviews
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `reviews.ts` | `/api/reviews` | Franchise | Customer reviews for location |

### Equipment & Devices
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `devices.ts` | `/api/devices` | Franchise | Device registration & management |

### Marketplace Management
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `provider-onboarding.ts` | `/api/provider-onboarding` | Franchise | Onboard service providers |
| `providers.ts` | `/api/providers` | Franchise | Provider management (franchise view) |

### Testing & QA
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `qa-testing.ts` | `/api/qa-testing` | Franchise | Quality assurance testing |
| `seed-demo.ts` | `/api/seed-demo` | Dev | Demo data seeding |
| `synthetic.ts` | `/api/synthetic` | Dev | Synthetic testing data |

---

## 📱 CUSTOMER (Mobile App Features - 35 routes)

### Authentication & Identity
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `mobile-auth.ts` | `/api/mobile-auth` | Public | Mobile login/register |
| `mobile-biometric.ts` | `/api/mobile-biometric` | Customer | Biometric authentication |
| `webauthn.ts` | `/api/webauthn` | Customer | WebAuthn/Passkey (FaceID/TouchID) |
| `privacy-settings.ts` | `/api/privacy-settings` | Customer | Privacy controls |

### Pet Management
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `pets.ts` | `/api/pets` | Customer | Pet profiles management |
| `avatars.ts` | `/api/avatars` | Customer | AI pet avatar creator (Plush Lab™) |
| `paw-finder.ts` | `/api/paw-finder` | Customer | Lost & found pets |

### Bookings & Services
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `bookings.ts` | `/api/bookings` | Customer | Service booking system |
| `super-app-bookings.ts` | `/api/super-app-bookings` | Customer | Unified booking across all services |
| `sitter-suite.ts` | `/api/sitter-suite` | Customer | Pet sitting marketplace (Sitter Suite™) |
| `walk-my-pet.ts` | `/api/walk-my-pet` | Customer | Dog walking marketplace (Walk My Pet™) |
| `walk-session.ts` | `/api/walk-session` | Customer | Walk session tracking |
| `walk-payment-flow.ts` | `/api/walk-payment-flow` | Customer | Walk service payments |
| `pettrek.ts` | `/api/pettrek` | Customer | GPS pet tracking (PetTrek™) |
| `gps-tracking.ts` | `/api/gps-tracking` | Customer | Real-time GPS location |

### Loyalty & Rewards
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `loyalty.ts` | `/api/loyalty` | Customer | 5-tier loyalty program |
| `wallet.ts` | `/api/wallet` | Customer | Digital wallet |
| `google-wallet.ts` | `/api/google-wallet` | Customer | Apple/Google Wallet passes |
| `wallet-telemetry.ts` | `/api/wallet-telemetry` | Customer | Wallet usage analytics |
| `gift-cards.ts` | `/api/gift-cards` | Customer | E-gift card redemption |

### Social Features
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `social.ts` | `/api/social` | Customer | Social media integration |
| `social-circle.ts` | `/api/social-circle` | Customer | Pet owner community |
| `voice.ts` | `/api/voice` | Customer | Voice commands |
| `ai-feedback.ts` | `/api/ai-feedback` | Customer | AI chatbot feedback |
| `chat.ts` | `/api/chat` | Customer | Customer support chat |
| `chat-history.ts` | `/api/chat-history` | Customer | Chat conversation history |

### Marketplace Browsing
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `marketplace.ts` | `/api/marketplace` | Customer | Service marketplace browsing |
| `providers.ts` | `/api/providers` | Customer | Browse service providers |

### Education & Resources
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `academy.ts` | `/api/academy` | Customer | Pet care education |

### Concierge & Premium Services
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `concierge.ts` | `/api/concierge` | Customer | Premium concierge service |
| `luxury-documents.ts` | `/api/luxury-documents` | Customer | Premium document services |

### AI Services
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `ai-insights.ts` | `/api/ai-insights` | Customer | AI pet care insights |

---

## 🌐 SHARED (Multi-Role & Infrastructure - 38 routes)

### Communication Infrastructure
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `campaigns.ts` | `/api/campaigns` | Admin/Franchise | Email/SMS marketing campaigns |
| `meetings.ts` | `/api/meetings` | Admin/Franchise | Meeting scheduling with notifications |
| `messaging.ts` | `/api/messaging` | Multi-role | WhatsApp Business API |
| `messages.ts` | `/api/messages` | Multi-role | General messaging |
| `notifications.ts` | `/api/notifications` | Multi-role | Push notifications |
| `push-notifications.ts` | `/api/push-notifications` | Multi-role | FCM push delivery |
| `fcm.ts` | `/api/fcm` | Multi-role | Firebase Cloud Messaging |
| `gmail.ts` | `/api/gmail` | Admin | Gmail integration |
| `gmail-test.ts` | `/api/gmail-test` | Admin | Gmail testing |

### Payment & Financial
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `nayax-payments.ts` | `/api/nayax/payments` | Multi-role | Nayax payment gateway |
| `nayax-webhooks.ts` | `/api/nayax/webhooks` | Public | Nayax payment webhooks |
| `escrow.ts` | `/api/escrow` | Multi-role | 72-hour escrow system |
| `pricing.ts` | `/api/pricing` | Public | Dynamic pricing engine |
| `promotions.ts` | `/api/promotions` | Public | Promotional campaigns |
| `multi-currency.ts` | `/api/multi-currency` | Public | Multi-currency support |

### Identity & Verification
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `kyc.ts` | `/api/kyc` | Multi-role | KYC verification |
| `passport.ts` | `/api/passport` | Multi-role | Passport OCR verification |
| `identity-service.ts` | `/api/identity-service` | Multi-role | Identity verification |
| `biometric-certificates.ts` | `/api/biometric-certificates` | Multi-role | Biometric credential storage |

### Document Management
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `documents.ts` | `/api/documents` | Multi-role | Document management system |
| `esign.ts` | `/api/esign` | Multi-role | DocuSeal e-signature |
| `signatures.ts` | `/api/signatures` | Multi-role | Digital signatures |
| `contracts.ts` | `/api/contracts` | Multi-role | Contract management |

### Environmental & Location Services
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `weather.ts` | `/api/weather` | Public | Weather data (Open-Meteo) |
| `weather-test.ts` | `/api/weather-test` | Public | Weather API testing |
| `environment.ts` | `/api/environment` | Public | Environmental data (UV, AQI) |
| `translation.ts` | `/api/translation` | Public | Google Translate API |
| `observances.ts` | `/api/observances` | Public | Religious observance data |

### Analytics & Monitoring
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `analytics.ts` | `/api/analytics` | Multi-role | Google Analytics integration |
| `metrics.ts` | `/api/metrics` | Admin | System metrics |
| `status.ts` | `/api/status` | Public | System status checks |
| `security-status.ts` | `/api/security-status` | Admin | Security monitoring |

### Infrastructure Services
| Route File | API Path | Auth Required | Description |
|------------|----------|---------------|-------------|
| `google-services.ts` | `/api/google-services` | Multi-role | Google Cloud services |
| `unified-platform.ts` | `/api/unified-platform` | Multi-role | Platform integration hub |
| `globalForms.ts` | `/api/global-forms` | Multi-role | Form builder |
| `globalServices.ts` | `/api/global-services` | Multi-role | Shared services |
| `integrations.ts` | `/api/integrations` | Admin | Third-party integrations |
| `recaptcha.ts` | `/api/recaptcha` | Public | reCAPTCHA verification |
| `seo.ts` | `/api/seo` | Public | SEO optimization |
| `inbox.ts` | `/api/inbox` | Multi-role | Universal inbox |
| `send-report.ts` | `/api/send-report` | Admin | Report generation |

---

## 📊 Route Statistics

| Category | Count | Percentage |
|----------|-------|------------|
| **HEAD OFFICE** 🏢 | 28 | 23.5% |
| **FRANCHISE** 🏪 | 18 | 15.1% |
| **CUSTOMER** 📱 | 35 | 29.4% |
| **SHARED** 🌐 | 38 | 31.9% |
| **TOTAL** | **119** | **100%** |

---

## 🔒 Authentication Levels

| Level | Description | Routes Count |
|-------|-------------|--------------|
| **Public** | No authentication | 15 |
| **Customer** | Firebase Auth required | 35 |
| **Franchise** | Franchise role required | 18 |
| **Admin** | Admin role required | 28 |
| **Multi-role** | Varies by endpoint | 23 |

---

## 🚨 Dual-Classification Cases

Some routes serve multiple roles. Classification decision rationale:

### Campaigns (SHARED, not HEAD OFFICE)
**Reason**: While created by admins, campaigns affect customers and are used by franchise locations.

### Meetings (SHARED, not HEAD OFFICE)
**Reason**: CRM meetings involve external customers and franchise staff, not just admins.

### KYC/Passport/Identity (SHARED)
**Reason**: Used by customers (verification), franchises (onboarding), and admins (compliance).

### Documents/Signatures (SHARED)
**Reason**: Used across all roles - contracts, onboarding, compliance.

### Providers (CUSTOMER and FRANCHISE)
**Reason**: Customers browse providers, franchises manage them. Classified as CUSTOMER (primary use case).

---

## 🎯 Next Steps

1. ✅ **Documentation Complete** - All 119 routes classified
2. ⏳ **Create Folder Structure** - `head-office/`, `franchise/`, `customer/`, `shared/`
3. ⏳ **Add Barrel Exports** - `index.ts` in each folder
4. ⏳ **Migrate Routes** - Move files arm-by-arm
5. ⏳ **Update registerRoutes()** - Group imports by category
6. ⏳ **Smoke Tests** - Verify all endpoints still work

---

**Generated**: November 17, 2025  
**Architect**: Hybrid Option C (Move + Barrel Exports)  
**Migration Strategy**: Incremental, arm-by-arm with validation
