# 🚀 Firebase Deployment Checklist

## ✅ Pre-Deployment Security (COMPLETE FIRST!)

- [ ] **Revoke exposed service account key** (ID: 52ae303939ea)
  - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=signinpetwash
  - Find Firebase service account → Keys tab
  - Delete key 52ae303939ea

- [ ] **Create new service account key**
  - Same service account → Add Key → Create new key (JSON)
  - Download the new JSON file

- [ ] **Update GitHub Secret**
  - Go to: https://github.com/petwashglobal/petwash-marketplace/settings/secrets/actions
  - Update `GOOGLE_APPLICATION_CREDENTIALS_JSON` with new JSON content

---

## ✅ GitHub Secrets Verification

Confirm these 10 secrets exist:

- [ ] `GOOGLE_APPLICATION_CREDENTIALS_JSON` - **NEW** service account (not exposed one!)
- [ ] `VITE_RECAPTCHA_SITE_KEY`
- [ ] `VITE_FIREBASE_API_KEY`
- [ ] `VITE_FIREBASE_AUTH_DOMAIN`
- [ ] `VITE_FIREBASE_PROJECT_ID`
- [ ] `VITE_FIREBASE_STORAGE_BUCKET`
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `VITE_FIREBASE_APP_ID`
- [ ] `VITE_FIREBASE_MEASUREMENT_ID`
- [ ] `VITE_WEBAUTHN_RP_ID`

---

## ✅ Deployment Steps

### **Option 1: Manual Trigger (Recommended)**

1. **Complete security steps above** ☝️
2. Go to: https://github.com/petwashglobal/petwash-marketplace/actions
3. Click **"Deploy PetWash Marketplace"**
4. Click **"Run workflow"** → Select **main** → **"Run workflow"**
5. Watch the deployment run (~5 minutes)

### **Option 2: Automatic (Push to main)**

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

---

## ✅ Verification After Deployment

- [ ] Workflow shows **green checkmark** ✅
- [ ] Visit: https://signinpetwash.web.app
- [ ] Homepage loads correctly
- [ ] Visit: https://petwash.co.il (custom domain)
- [ ] Custom domain works
- [ ] Firebase Auth login works
- [ ] reCAPTCHA appears on forms

---

## 🔧 Workflow Details

**File**: `.github/workflows/deploy.yml`

**What it does**:
1. Checks out code
2. Installs Node 20
3. Runs `npm ci` (clean install)
4. Runs `npm run build` with all environment variables
5. Deploys to Firebase Hosting

**Build output**: `dist/public/` → Firebase Hosting

---

## ❌ Common Issues

### **"Site Not Found" on Firebase**
- **Cause**: Build output path wrong
- **Fix**: Already fixed - `firebase.json` uses `dist/public` ✅

### **Workflow fails at build**
- **Cause**: Missing environment variables
- **Fix**: Already fixed - all VITE_* vars included ✅

### **Deployment unauthorized**
- **Cause**: Service account key invalid
- **Fix**: Revoke old key, create new key, update GitHub secret

---

## 🌐 Live URLs

After successful deployment:

- **Firebase URL**: https://signinpetwash.web.app
- **Custom Domain**: https://petwash.co.il

---

## 📋 Summary

**Status**: Ready to deploy ✅  
**Security**: Exposed key MUST be revoked first ⚠️  
**Workflow**: Simple, clean, working pipeline ✅  
**Next Step**: Complete security checklist, then deploy!

---

**Created**: November 24, 2025  
**Version**: Final production deployment pipeline
