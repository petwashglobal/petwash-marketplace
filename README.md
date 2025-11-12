# 🐾 Pet Wash™ - Premium Pet Services Ecosystem

**Enterprise-grade multi-platform pet care marketplace** operating under **Pet Wash Ltd** with independent business units delivering Airbnb-level luxury experiences.

![License](https://img.shields.io/badge/license-Proprietary-red)
![Status](https://img.shields.io/badge/status-Production-success)
![Platform](https://img.shields.io/badge/platform-Replit-orange)

## 🌟 Overview

Pet Wash™ is a comprehensive pet services ecosystem featuring **6 independent business units**, each operating as a standalone marketplace with full booking, payments, dispatch, tracking, reviews, and messaging capabilities.

### Corporate Structure - Pet Wash Ltd

- 🛁 **K9000 Wash Stations** - Premium organic self-service IoT wash stations (flagship product)
- 🏠 **The Sitter Suite™** - Pet sitting marketplace (competing with Rover/Care.com)
- 🐕 **Walk My Pet™** - Dog walking marketplace (competing with Wag!/Rover)
- 🚗 **PetTrek™** - Pet transport marketplace (competing with Uber Pets)
- 🎨 **The Plush Lab™** - AI-powered pet avatar creator with multilingual TTS
- 🌐 **Multi-Platform Hub** - Unified enterprise infrastructure

## ✨ Key Features

### 🎨 Luxury Design System
- **Glassmorphism UI** - Premium frosted glass effects throughout
- **Purple/Pink/Amber Gradients** - High-end color palette
- **Apple-Level Polish** - Spring animations and smooth transitions
- **Responsive Design** - Mobile-first, works perfectly on all devices
- **Bilingual Support** - Hebrew (RTL) and English (LTR) with full translations

### 🛠 Technical Stack

**Frontend:**
- React 18 + TypeScript
- TailwindCSS + shadcn/ui components
- Wouter (routing)
- TanStack Query (state management)
- Vite (build tool)

**Backend:**
- Node.js + Express
- PostgreSQL (Neon serverless)
- Drizzle ORM
- Redis caching
- Firebase Authentication

**Integrations:**
- Google Gemini AI 2.5 Flash
- Firebase (Auth, Firestore, Storage)
- HubSpot CRM
- SendGrid Email
- DocuSeal E-Signature
- Google Cloud Vision (KYC/OCR)
- Google Maps API
- Apple Wallet & Google Wallet
- Nayax Payment Gateway

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Firebase project
- Environment secrets configured

### Installation

```bash
# Clone repository
git clone https://github.com/petwashglobal/petwash-marketplace.git
cd petwash-marketplace

# Install dependencies
npm install

# Set up database
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

Create `.env` file with:

```env
# Database
DATABASE_URL=your_postgresql_url

# Firebase
FIREBASE_API_KEY=your_api_key
FIREBASE_PROJECT_ID=your_project_id

# Secrets
COOKIE_SECRET=your_cookie_secret
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Google Services
GOOGLE_GEMINI_API_KEY=your_gemini_key
GOOGLE_CLOUD_VISION_API_KEY=your_vision_key
```

## 📦 Project Structure

```
petwash-marketplace/
├── client/                      # Frontend React application
│   ├── src/
│   │   ├── pages/              # Page components
│   │   │   ├── sitter-suite/   # The Sitter Suite™ marketplace
│   │   │   ├── walk-my-pet/    # Walk My Pet™ marketplace
│   │   │   └── pet-trek/       # PetTrek™ marketplace
│   │   ├── components/         # Reusable components
│   │   │   └── luxury/         # Luxury glassmorphism components
│   │   └── lib/                # Utilities and helpers
├── server/                      # Backend Express application
│   ├── routes/                 # API routes
│   │   ├── sitter-suite.ts     # Sitter Suite API
│   │   └── routes.ts           # Main routes
│   └── services/               # Business logic services
├── shared/                      # Shared types and schemas
│   └── schema.ts               # Drizzle database schemas
└── attached_assets/            # Static assets
```

## 🎯 Business Units

### 🏠 The Sitter Suite™
Premium pet sitting marketplace with:
- Browse verified sitters with luxury cards
- Detailed sitter profiles with reviews
- Real-time booking system
- Secure payments with service fees
- Owner and sitter dashboards

### 🐕 Walk My Pet™
Professional dog walking services with:
- GPS-tracked walks
- Real-time walker location
- Photo updates during walks
- Flexible scheduling

### 🚗 PetTrek™
Safe pet transportation with:
- Licensed drivers
- Climate-controlled vehicles
- Door-to-door service
- Live tracking

### 🎨 The Plush Lab™
AI-powered pet avatar creation:
- Google Vision landmark detection
- Multilingual text-to-speech
- Custom avatar generation
- Social media sharing

## 🔐 Security & Compliance

- ✅ Firebase App Check
- ✅ WebAuthn/Passkey support
- ✅ GDPR-compliant consent management
- ✅ Israeli Privacy Law 2025 compliance
- ✅ Blockchain-style audit trails
- ✅ KYC with passport verification
- ✅ Rate limiting and DDoS protection

## 📊 Enterprise Features

- **Multi-Franchise Management** - Per-location tracking and analytics
- **Automated Bookkeeping** - Google Vision OCR + Gemini AI
- **Israeli Tax Compliance** - VAT reclaim system
- **Bank Reconciliation** - Mizrahi-Tefahot integration
- **Performance Monitoring** - Grafana k6 load testing
- **AI Email Monitor** - Gemini quality validation

## 🌍 Internationalization

- **6 Languages Supported:**
  - English (Primary)
  - Hebrew (עברית - RTL)
  - Arabic (العربية - RTL)
  - Russian (Русский)
  - French (Français)
  - Spanish (Español)

- **Language Compliance:**
  - English can mix languages for luxury branding
  - Other languages must be 100% pure (except brand names)

## 🎨 Design Philosophy

Our luxury design system delivers **Airbnb-level marketplace quality**:

1. **Glassmorphism** - Premium frosted glass effects with blur
2. **Gradient Typography** - Purple/pink/amber gradient text
3. **Smooth Animations** - Apple-style spring animations
4. **Premium Cards** - Individual gradient themes per section
5. **Verified Badges** - Trust indicators with shield icons
6. **Luxury Buttons** - Gradient backgrounds with hover effects

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Load testing
npm run load-test
```

## 📱 Progressive Web App

- ✅ Service Worker
- ✅ Offline support
- ✅ Push notifications
- ✅ Badge API
- ✅ Background sync
- ✅ Wake Lock API

## 🤝 Contributing

This is a proprietary project for Pet Wash Ltd. Internal team members should:

1. Create feature branches from `main`
2. Follow luxury design guidelines
3. Maintain 100% language purity (non-English)
4. Test on multiple devices
5. Submit pull requests for review

## 📧 Contact

- **Email:** support@petwash.co.il
- **GitHub:** petwashglobal
- **Website:** Coming soon

## 📄 License

Proprietary - © 2025 Pet Wash Ltd. All rights reserved.

---

Built with 💜 by the Pet Wash team | Delivering Airbnb-level luxury for pets
