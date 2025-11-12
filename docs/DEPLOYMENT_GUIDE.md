# 🚀 PetWash™ - Production Deployment Guide

## **Overview**
This guide provides step-by-step instructions for deploying PetWash™ to production with 7-star performance and reliability.

---

## **1. PRE-DEPLOYMENT CHECKLIST**

### ✅ Code Quality
- [ ] All TypeScript errors resolved
- [ ] No console.errors in production code
- [ ] Code linting passed (ESLint)
- [ ] Type checking passed (tsc)
- [ ] All tests passed (Vitest)
- [ ] Security vulnerabilities addressed (npm audit)

### ✅ Environment Configuration
- [ ] Production environment variables set
- [ ] Firebase production project configured
- [ ] Database connection strings updated
- [ ] API keys rotated for production
- [ ] SMTP credentials configured
- [ ] Payment gateway in live mode

### ✅ Performance Optimization
- [ ] Images optimized (WebP format, lazy loading)
- [ ] JavaScript code split and minified
- [ ] CSS minified and purged (Tailwind)
- [ ] Service worker configured
- [ ] CDN configured for static assets
- [ ] Gzip/Brotli compression enabled

---

## **2. ENVIRONMENT VARIABLES**

### **Required Frontend Variables (Vite)**
```bash
VITE_GOOGLE_MAPS_API_KEY=your_production_key_here
VITE_GOOGLE_CLIENT_ID=your_production_client_id_here
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=signinpetwash
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

### **Required Backend Variables (Node.js)**
```bash
# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY=<base64_encoded_service_account_json>

# Google Services
GOOGLE_MAPS_API_KEY=your_production_key
GOOGLE_TRANSLATE_API_KEY=your_translate_key

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Email
SENDGRID_API_KEY=your_sendgrid_key

# Payment (Currently Disabled)
# NAYAX_API_KEY=disabled
# NAYAX_SECRET=disabled

# WhatsApp
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_VERIFY_SERVICE_SID=your_verify_sid

# Security
RECAPTCHA_SECRET_KEY=your_recaptcha_secret
SENTRY_DSN=your_sentry_dsn

# Domain
BASE_URL=https://www.petwash.co.il
```

---

## **3. DATABASE SETUP**

### **PostgreSQL (Neon Serverless)**
1. Create production database
2. Run migrations:
   ```bash
   npm run db:migrate
   ```
3. Seed initial data:
   ```bash
   npm run db:seed
   ```
4. Configure automated backups

### **Firestore (Firebase)**
1. Enable Firestore in production project
2. Configure security rules
3. Set up indexes for queries
4. Enable automated backups

---

## **4. DNS CONFIGURATION**

### **Primary Domain: www.petwash.co.il**
```
Type: CNAME
Name: www
Value: <replit_deployment_url>.replit.app
TTL: 3600
```

### **Root Domain: petwash.co.il**
```
Type: A
Name: @
Value: 35.226.206.236
TTL: 3600
```

### **SSL Certificate**
- Replit automatically provisions SSL via Let's Encrypt
- Verify HTTPS enforcement
- Test certificate validity: https://www.ssllabs.com/ssltest/

---

## **5. BUILD & DEPLOYMENT**

### **Build Production Assets**
```bash
# Install dependencies
npm install --production

# Build frontend
npm run build

# Test production build locally
npm run preview
```

### **Deploy to Replit**
1. Push code to Git repository
2. Connect Replit to Git repo
3. Configure environment secrets in Replit
4. Deploy and verify

### **Verify Deployment**
```bash
# Check server health
curl https://www.petwash.co.il/api/auth/health

# Check Firebase connection
curl https://www.petwash.co.il/api/config/firebase

# Test meeting scheduler
curl -X POST https://www.petwash.co.il/api/meetings/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"Test","date":"2025-11-02T10:00:00Z","location":"Tel Aviv"}'
```

---

## **6. MONITORING & ALERTING**

### **Application Monitoring**
- **Sentry:** Error tracking and performance monitoring
- **Google Analytics 4:** User behavior and conversions
- **Microsoft Clarity:** Session recordings and heatmaps

### **Server Monitoring**
- **Uptime Robot:** 24/7 uptime monitoring
- **Slack Webhooks:** Alert notifications
- **Custom Health Checks:** `/api/auth/health`

### **Performance Monitoring**
- **Core Web Vitals:** LCP, FID, CLS
- **Real User Monitoring (RUM):** Actual user performance
- **Lighthouse CI:** Automated performance audits

---

## **7. BACKUP & DISASTER RECOVERY**

### **Database Backups**
- **PostgreSQL:** Daily automated backups (Neon)
- **Firestore:** Daily exports to Google Cloud Storage
- **Retention:** 30 days

### **Code Backups**
- **Git Repository:** Primary source control
- **Google Cloud Storage:** Weekly code snapshots
- **Retention:** 90 days

### **Recovery Time Objective (RTO)**
- Database restore: < 1 hour
- Full system restore: < 4 hours

---

## **8. SECURITY HARDENING**

### **API Security**
- Rate limiting enabled (100 req/15min)
- CORS configured for production domains
- CSRF protection enabled
- Input validation on all endpoints
- SQL injection prevention
- XSS protection headers

### **Authentication**
- Firebase session cookies (httpOnly, secure)
- WebAuthn/Passkey support
- Rate limiting on login (5 attempts/5min)
- Password strength requirements

### **Data Protection**
- HTTPS enforced everywhere
- Sensitive data encrypted at rest
- PII field-level encryption for KYC
- GDPR-compliant data handling

---

## **9. PERFORMANCE TARGETS**

### **Core Web Vitals**
| Metric | Target | Good | Needs Improvement |
|--------|--------|------|-------------------|
| LCP    | < 2.5s | ✅   | 2.5s - 4.0s      |
| FID    | < 100ms| ✅   | 100ms - 300ms    |
| CLS    | < 0.1  | ✅   | 0.1 - 0.25       |

### **API Response Times**
| Endpoint | Target | Max Acceptable |
|----------|--------|----------------|
| `/api/auth/*` | < 200ms | 500ms |
| `/api/meetings/*` | < 300ms | 1000ms |
| `/api/checkout` | < 500ms | 2000ms |

---

## **10. POST-DEPLOYMENT VERIFICATION**

### **Smoke Tests**
```bash
# Run automated smoke tests
npm run test:smoke

# Manual verification
1. Sign up new user
2. Login existing user
3. Schedule a meeting
4. Browse services
5. Test mobile menu
6. Verify Google Places autocomplete
7. Test date/time pickers
```

### **User Acceptance Testing (UAT)**
- [ ] Internal team testing (2 hours)
- [ ] Beta user group testing (24 hours)
- [ ] Final stakeholder approval

---

## **11. ROLLBACK PLAN**

### **If Critical Issues Detected**
1. Revert to previous Git commit
2. Redeploy previous version
3. Notify stakeholders
4. Investigate root cause
5. Fix and redeploy

### **Database Rollback**
```bash
# Restore from backup (if needed)
pg_restore -d production_db backup_file.dump
```

---

## **12. LAUNCH ANNOUNCEMENT**

### **Communication Channels**
- [ ] Email to existing users
- [ ] Social media posts (Instagram, Facebook, TikTok)
- [ ] Press release to Israeli media
- [ ] Blog post on www.petwash.co.il

### **Marketing Campaign**
- [ ] Google Ads campaign activated
- [ ] Facebook Ads campaign activated
- [ ] Instagram influencer partnerships
- [ ] TikTok viral content strategy

---

## **13. SUPPORT & MAINTENANCE**

### **24/7 Support**
- **Email:** Support@PetWash.co.il
- **WhatsApp:** +972-XX-XXX-XXXX
- **Phone:** Business hours (8 AM - 8 PM IST)

### **Maintenance Windows**
- **Scheduled:** Sundays 2 AM - 4 AM IST
- **Emergency:** As needed with notifications

---

## **✅ FINAL DEPLOYMENT APPROVAL**

**Sign-off Required:**
- [ ] **CTO/Tech Lead:** Technical approval
- [ ] **QA Manager:** Testing complete
- [ ] **Security Officer:** Security audit passed
- [ ] **CEO/Founder (Nir Hadad):** Business approval

**Deployment Date:** _________________  
**Deployment Time:** _________________  
**Deployed By:** _________________  

---

**Document Version:** 1.0.0  
**Last Updated:** November 1, 2025  
**Next Review:** December 1, 2025

---

🎉 **Ready for 7-Star Launch!** 🎉
