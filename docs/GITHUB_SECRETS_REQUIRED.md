# 🔐 GitHub Secrets Required for Production Deployment

## Overview
This document lists all GitHub Secrets required for the production build and deployment workflow.

## 🔑 Required Secrets

### **1. Service Account (Firebase Deployment)**
- **Name**: `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- **Value**: Full JSON content of your Firebase service account key
- **Source**: Download from Firebase Console → Project Settings → Service Accounts

---

### **2. reCAPTCHA Bot Protection**
- **Name**: `VITE_RECAPTCHA_SITE_KEY`
- **Value**: Your reCAPTCHA v2 Site Key (starts with `6L...`)
- **Source**: https://www.google.com/recaptcha/admin

---

### **3. Firebase Configuration (9 secrets)**

#### Firebase API Key
- **Name**: `VITE_FIREBASE_API_KEY`
- **Value**: From Firebase Console → Project Settings → General → Web API Key

#### Firebase Auth Domain
- **Name**: `VITE_FIREBASE_AUTH_DOMAIN`
- **Value**: `signinpetwash.firebaseapp.com` (or your project domain)

#### Firebase Project ID
- **Name**: `VITE_FIREBASE_PROJECT_ID`
- **Value**: `signinpetwash` (or your project ID)

#### Firebase Storage Bucket
- **Name**: `VITE_FIREBASE_STORAGE_BUCKET`
- **Value**: `signinpetwash.firebasestorage.app` (or your bucket)

#### Firebase Messaging Sender ID
- **Name**: `VITE_FIREBASE_MESSAGING_SENDER_ID`
- **Value**: From Firebase Console → Cloud Messaging

#### Firebase App ID
- **Name**: `VITE_FIREBASE_APP_ID`
- **Value**: From Firebase Console → Project Settings → App ID

#### Firebase Measurement ID (Google Analytics)
- **Name**: `VITE_FIREBASE_MEASUREMENT_ID`
- **Value**: `G-XXXXXXXXXX` from Firebase Analytics

---

### **4. WebAuthn/Passkey Configuration**
- **Name**: `VITE_WEBAUTHN_RP_ID`
- **Value**: `petwash.co.il` (your production domain)

---

## 📋 How to Add Secrets to GitHub

1. Go to: `https://github.com/petwashglobal/petwash-marketplace/settings/secrets/actions`
2. Click **"New repository secret"**
3. Enter the **Name** and **Value** from above
4. Click **"Add secret"**
5. Repeat for all secrets

---

## ✅ Verification Checklist

- [ ] `GOOGLE_APPLICATION_CREDENTIALS_JSON` - Service account for deployment
- [ ] `VITE_RECAPTCHA_SITE_KEY` - reCAPTCHA site key
- [ ] `VITE_FIREBASE_API_KEY` - Firebase API key
- [ ] `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- [ ] `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- [ ] `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID` - FCM sender ID
- [ ] `VITE_FIREBASE_APP_ID` - Firebase app ID
- [ ] `VITE_FIREBASE_MEASUREMENT_ID` - GA measurement ID
- [ ] `VITE_WEBAUTHN_RP_ID` - WebAuthn domain

---

## 🚨 Important Notes

1. **Never commit secrets to Git** - they go in GitHub Secrets only
2. **Replit secrets are for development only** - production uses GitHub Secrets
3. **Firebase config is public** - these can be exposed in frontend code
4. **Service account JSON is private** - never share or commit this
5. **All VITE_ variables** are baked into the frontend bundle during build

---

## 🔄 Where These Are Used

- **Build Time**: All `VITE_` variables are embedded in the frontend during `npm run build`
- **Deploy Time**: `GOOGLE_APPLICATION_CREDENTIALS_JSON` is used to authenticate with Firebase
- **Runtime**: Frontend bundle contains the baked-in environment variables

---

**Created**: November 23, 2025  
**Status**: ✅ Production deployment configuration  
**Next Step**: Add all secrets to GitHub, then push to deploy
