# PetWash™ 2025 - Deployment Architecture

## 🚨 CRITICAL DEPLOYMENT RULES

### Replit = DEVELOPMENT ONLY
**Replit is a DEVELOPMENT ENVIRONMENT ONLY. Replit must NEVER deploy to production.**

Production deployments MUST go through:
**GitHub → Google Cloud (Firebase Hosting / Cloud Run)**

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT (Replit)                      │
│                                                              │
│  - Write code                                               │
│  - Test locally                                             │
│  - Run dev server (npm run dev)                             │
│  - Preflight scan                                           │
│  - Push to GitHub                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ git push
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   SOURCE CONTROL (GitHub)                    │
│                                                              │
│  Repository: petwashglobal/petwash-marketplace              │
│                                                              │
│  GitHub Actions CI/CD Pipeline:                             │
│  1. Checkout code                                           │
│  2. Install dependencies                                    │
│  3. Preflight Guardian (Luxury Scan)                        │
│  4. Run tests                                               │
│  5. Build application                                       │
│  6. Deploy to Google Cloud                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ auto deploy
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              PRODUCTION (Google Cloud)                       │
│                                                              │
│  Firebase Project: signinpetwash                   │
│  Domain: petwash.co.il                                      │
│                                                              │
│  Services:                                                  │
│  - Firebase Hosting (static assets)                         │
│  - Cloud Run (API server)                                   │
│  - Firebase Auth                                            │
│  - Firestore Database                                       │
│  - Cloud Storage                                            │
│  - Cloud Monitoring & Logging                               │
│  - Backup Bucket: petwash-backups-93383                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Replit Configuration

### Port Configuration (MANDATORY)
Replit MUST use **ONLY ONE PORT**:

```toml
[[ports]]
localPort = 5000
externalPort = 80
```

**Remove ALL other port entries.** Multiple ports will cause deployment failures.

### Deployment Blocker
The `scripts/block-replit-deploy.ts` script prevents any production deployment from Replit:

```bash
npm run deploy:replit  # ❌ Will fail with error message
```

This ensures the official deployment pipeline is always used.

---

## Preflight Guardian

The **Preflight Guardian** (`scripts/petwash-preflight.ts`) runs before EVERY build and enforces:

### ✅ Luxury 2025 UI Standards
- 7-Star animations
- Premium typography
- Full platform hamburger menu
- Luxury components (LuxuryThemeWrapper, GiftCards, etc.)

### ❌ Blocked Content
- Legacy UI (old CSS, old screens, old templates)
- Public/build fallback directories
- Missing TM trademark usage
- Incorrect PetWash/PETWASH formats
- Files under `legacy/`, `old/`, `template/`, `experiments/`

### Required Files
All luxury layout components must exist:
- `client/src/components/LuxuryThemeWrapper.tsx`
- `client/src/components/GiftCards.tsx`
- `client/src/components/PetWashHeaderNav.tsx`
- `client/src/components/Footer.tsx`
- `client/src/components/PetWashDivisions.tsx`
- `client/src/components/LuxuryPlatformShowcase.tsx`

**If preflight fails, the build is BLOCKED.**

---

## GitHub Actions CI/CD

Located at: `.github/workflows/petwash-ci.yml`

### Pipeline Steps

1. **Checkout** - Clone the repository
2. **Install** - `npm ci` (clean install)
3. **Preflight** - Run luxury compliance scan
4. **Build** - `npm run build` (Vite production build)
5. **Deploy** - Push to Firebase Hosting (main branch only)

### Required GitHub Secrets
- `GCP_SA_KEY` - Google Cloud Service Account key
- `PROJECT_ID` - Firebase project ID (signinpetwash)

---

## Platform Architecture

### All Platforms Connect to Main Brain

Each platform is a stand-alone module but connects to central infrastructure:

- **PetWash™** - Stations, sessions, LEDs, K9000 automation
- **PetSitter™** - Pet sitting marketplace
- **PetTransport™** - Pet transportation services
- **PetWalk™** - Dog walking marketplace
- **PetWash Academy™** - Training and certification
- **Loyalty & VIP** - 7-tier loyalty system
- **Owners Dashboard** - Customer portal
- **Technicians Dashboard** - Field operations
- **Control Panel HQ** - Enterprise orchestration

### Luxury Booking Flow (2025 Standard)

1. Select platform
2. Select service
3. Choose location
4. Choose time
5. Price preview (with loyalty discount)
6. Payment (Apple/Google Pay, cards, Nayax)
7. Confirmation + loyalty points

**ALL booking flows must use luxury 2025 UI.**

---

## Production Services (Google Cloud)

### Firebase Auth
- User authentication
- Passkey/WebAuthn support
- Social logins (Google, Apple)
- Phone authentication

### Firestore
- Real-time database
- User profiles
- Pet data
- Booking records
- Compliance documents

### Cloud Storage
- User uploads
- Pet photos
- Documents
- Backup files

### Cloud Run
- API server hosting
- Auto-scaling
- Health checks
- Monitoring

### Monitoring & Logging
- Cloud Logging
- Performance monitoring
- Error tracking (Sentry)
- Analytics (GA4)

### Backup Service
- Bucket: `petwash-backups-93383`
- Service Account: `petwash-backup-service@signinpetwash.iam.gserviceaccount.com`
- Daily automated backups

---

## NO OTHER DEPLOYMENT PATHS ALLOWED

The ONLY valid deployment path is:
**Replit (dev) → GitHub → Google Cloud (production)**

Any attempt to deploy directly from Replit to production will:
1. Be blocked by `scripts/block-replit-deploy.ts`
2. Fail preflight guardian checks
3. Not have proper security configurations
4. Not have proper monitoring

---

## Contact & Support

- **Production Domain**: https://petwash.co.il
- **Firebase Console**: https://console.firebase.google.com/project/signinpetwash
- **GitHub Repository**: https://github.com/petwashglobal/petwash-marketplace

For deployment issues, check:
1. GitHub Actions logs
2. Firebase Hosting deployment logs
3. Cloud Run logs
4. Preflight guardian output
