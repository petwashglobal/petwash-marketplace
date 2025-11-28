# Pet Wash™ Production Deployment Guide

**Last Updated**: November 20, 2025  
**Production Domain**: petwash.co.il  
**Deployment Platform**: Replit Cloud Run (Google Cloud Platform)  
**Firebase Project**: signinpetwash (Auth/DB/Storage ONLY)

---

## 🎯 Deployment Architecture

### Production Hosting
- **Platform**: Replit Deployments (Cloud Run on Google Cloud Platform)
- **Domain**: petwash.co.il
- **Build**: Vite production build → `dist/public`
- **Server**: Node.js Express (port 5000)

### Firebase Services (signinpetwash)
- **Firebase Authentication**: User login, WebAuthn/Passkeys
- **Firestore Database**: NoSQL data storage
- **Cloud Storage**: Biometric data, documents, images
- **NOT USED FOR HOSTING**: Firebase Hosting is disabled

---

## 📋 Pre-Deployment Checklist

### 1. Code Verification
- ✅ Latest luxury 2025 UI committed to GitHub
- ✅ All 6 languages working (en, he, ar, ru, fr, es)
- ✅ All platforms verified: Marketplace, Hub, Academy, Loyalty, Sitter, Transport
- ✅ K9000 IoT, backup scripts, compliance modules intact
- ✅ Firebase Auth/Firestore/Storage configured

### 2. PetWash 2025 Preflight Guardian (MANDATORY)
```bash
# Run comprehensive preflight guardian - blocks deployment if issues detected
npm run preflight

# Or use the alias:
npm run scan:ui

# Expected output:
# ✅ No issues found. Codebase looks clean and modern.
# You are safe to build, deploy and push to GitHub.
```

**The Preflight Guardian protects your production deployment by:**

1. **Legacy UI Detection** - Blocks old Apple package CSS, template code, placeholder content
2. **Brand Protection** - Detects wrong capitalization or trademark usage  
3. **Required Files Verification** - Ensures core 2025 luxury components exist:
   - LuxuryThemeWrapper.tsx
   - PetWashDivisions.tsx
   - GiftCards.tsx
   - PetWashHeaderNav.tsx
   - Footer.tsx
   - LuxuryPlatformShowcase.tsx
4. **Environment Config Checks** - Verifies GCS backup bucket configuration
5. **Git Sanity Check** - Ensures repository is connected to GitHub
6. **Detailed Reporting** - Categorizes issues by severity with file locations

**Automatically runs before `npm run build` via `prebuild` hook**

**If the scan fails:**
1. Review the categorized error output (CONFIG_ERROR, LEGACY_UI, BANNED_PATTERN, etc.)
2. Fix hard failures (CONFIG_ERROR, LEGACY_UI, BANNED_PATTERN) before deployment
3. Address warnings (CONFIG_WARNING, MISSING_REQUIRED_FILE) when possible
4. Re-run `npm run preflight` until clean or warnings-only
5. Only then proceed with deployment

### 3. Build Verification
```bash
# Run production build (automatically runs preflight guardian first)
npm run build

# Build process:
# 1. npm run preflight (scans codebase)
# 2. vite build (if preflight passes)
# 3. Output to dist/public/

# Verify output
ls -lh dist/public/index.html
ls -lh dist/public/brand/petwash-logo-official.png
find dist/public -type f | wc -l  # Should be 300+ files
```

### 4. Environment Variables
Ensure all secrets are configured in Replit Secrets:
- `FIREBASE_PROJECT_ID`: signinpetwash
- `GOOGLE_APPLICATION_CREDENTIALS`: Service account JSON
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `COOKIE_SECRET`
- `DATABASE_URL`: PostgreSQL connection string
- Other API keys as needed

---

## 🚀 Deployment Steps

### Option 1: Replit UI Deployment (Recommended)

1. **Open Deployment Tab**
   - Click "Deploy" button in Replit workspace
   - Select "Autoscale" or "Reserved VM" deployment type

2. **Configure Deployment**
   - Build command: `npm run build`
   - Run command: `npm run start`
   - Port: 5000

3. **Deploy**
   - Click "Deploy" button
   - Wait for deployment to complete (~2-5 minutes)
   - Replit will provide a `.replit.app` URL

4. **Add Custom Domain**
   - Go to Deployment settings
   - Add custom domain: `petwash.co.il`
   - Add custom domain: `www.petwash.co.il`
   - Follow DNS configuration instructions

### Option 2: GitHub Actions CI/CD

**Automated Deployment Protection**

The repository includes `.github/workflows/petwash-ci.yml` which automatically:
1. Runs `npm run preflight` on every push to main/production
2. Blocks merges if preflight fails (legacy UI, banned patterns, config errors)
3. Verifies production build succeeds  
4. Ensures only clean luxury 2025 code reaches production

This workflow runs automatically on GitHub - no manual setup required.

**CI/CD Environment Variables Required:**
- `GCS_BACKUP_BUCKET` (GitHub Secrets)
- `GCS_BACKUP_PROJECT_ID` (GitHub Secrets)

---

## 🌐 DNS Configuration for petwash.co.il

Once Replit deployment is live, update DNS records:

### Step 1: Get Deployment URL
- Example: `petwash-production.replit.app`

### Step 2: Update DNS Records
In your domain registrar (Google Domains, Cloudflare, etc.):

```dns
Type    Name              Value                           TTL
A       @                 [Replit IP Address]             3600
CNAME   www               petwash-production.replit.app   3600
TXT     @                 [Verification token]            3600
```

Replit will provide the exact values in the custom domain setup flow.

---

## ✅ Post-Deployment Verification

### 1. Health Check
```bash
curl https://petwash.co.il/health
# Expected: {"status":"ONLINE","system":"Pet Wash System v2.0",...}
```

### 2. Frontend Verification
- Open https://petwash.co.il in browser
- Verify luxury 2025 UI loads correctly
- Check all gradients, glassmorphism effects visible
- Test language switcher (6 languages)
- Verify logo and brand assets load
- Check browser console for errors (should be clean)

### 3. Firebase Integration
- Test user login/registration
- Verify Firestore data loads
- Check Cloud Storage images load

### 4. Platform Features
- K9000 station map loads
- Loyalty program displays correctly
- Booking system functional
- Payment gateway initialized

---

## 🔄 Update/Redeploy Process

### For Code Changes:

1. **Develop in Replit**
   ```bash
   npm run dev  # Test locally on port 5000
   ```

2. **Commit to GitHub**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

3. **Redeploy to Production**
   - Option A: Click "Deploy" in Replit UI
   - Option B: GitHub Actions auto-deploys (if configured)

### For Database Changes:
```bash
# Update schema in shared/schema.ts
npm run db:push --force  # Sync to production DB
```

---

## 🔐 Security Notes

- All secrets managed via Replit Secrets (encrypted)
- Firebase Admin SDK uses service account authentication
- HTTPS enforced on production domain
- Rate limiting active on all API endpoints
- CORS restricted to petwash.co.il domain

---

## 📊 Monitoring

### Replit Deployment Dashboard
- Real-time logs
- CPU/Memory usage
- Request analytics
- Error tracking

### Firebase Console
- Authentication metrics
- Firestore usage
- Storage bandwidth
- Security rules logs

---

## 🆘 Troubleshooting

### Build Fails
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Production 404 Errors
- Check SPA fallback in server/index.ts (line ~289)
- Verify dist/public/index.html exists after build

### Firebase Auth Not Working
- Verify FIREBASE_PROJECT_ID matches signinpetwash
- Check service account permissions in Firebase Console

### Domain Not Resolving
- Allow 24-48 hours for DNS propagation
- Verify DNS records match Replit's requirements
- Use `dig petwash.co.il` to check DNS resolution

---

## 📝 Maintenance Schedule

### Daily
- Monitor deployment health
- Check error logs

### Weekly  
- Review performance metrics
- Update dependencies if needed

### Monthly
- Backup database
- Review security logs
- Update SSL certificates (auto-renewed by Replit)

---

## 🎉 Success Criteria

Production deployment is successful when:
- ✅ https://petwash.co.il loads luxury 2025 UI
- ✅ All 6 languages work correctly
- ✅ Firebase Auth login functional
- ✅ K9000 stations display on map
- ✅ Payment gateway initialized
- ✅ No console errors
- ✅ Mobile responsive design works
- ✅ SSL certificate valid
- ✅ Health endpoint returns 200 OK

---

## 📞 Support

For deployment issues:
1. Check Replit deployment logs
2. Review Firebase Console for service errors
3. Consult this guide's troubleshooting section
4. Contact Replit support for platform issues
