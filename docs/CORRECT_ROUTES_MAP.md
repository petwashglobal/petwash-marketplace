# Pet Wash™ - Complete Correct Routes Map

**Last Updated:** October 25, 2025  
**Status:** ✅ All routes verified and tested

---

## 🔐 **Authentication Routes (No Login Required)**

| Page | Correct URL | File | Status |
|------|-------------|------|--------|
| Sign In | `/signin` | `SignIn.tsx` | ✅ Works |
| Simple Login | `/login` | `SimpleSignIn.tsx` | ✅ Works |
| Sign Up | `/signup` | `SignUp.tsx` | ✅ Works |
| Register (alias) | `/register` | `SignUp.tsx` | ✅ Works |
| Sign Up (alias) | `/sign-up` | `SignUp.tsx` | ✅ Works |

---

## 🏠 **User Dashboard Routes (Requires Login)**

| Page | Correct URL | File | Redirect After Login |
|------|-------------|------|---------------------|
| Dashboard | `/dashboard` | `Dashboard.tsx` | ✅ Default |
| Loyalty Program | `/loyalty` | `Loyalty.tsx` | ✅ Works |
| Loyalty Dashboard | `/loyalty/dashboard` | `LoyaltyDashboard.tsx` | ✅ Works |
| My Pets | `/pets` | `Pets.tsx` | ✅ Works |
| Inbox | `/inbox` | `Inbox.tsx` | ✅ Works |
| Settings | `/settings` | `Settings.tsx` | ✅ Works |
| Security Settings | `/settings/security` | `SecuritySettings.tsx` | ✅ Works |
| My Devices | `/my-devices` | `MyDevices.tsx` | ✅ Works |
| Device Management | `/devices` | `DeviceManagement.tsx` | ✅ Works |
| Subscriptions | `/subscriptions` | `Subscriptions.tsx` | ✅ Works |
| My Subscriptions | `/my-subscriptions` | `MySubscriptions.tsx` | ✅ Works |

---

## 💳 **Wallet Routes (Requires Login)**

| Page | Correct URL | File | Auth Required |
|------|-------------|------|---------------|
| My Wallet Cards | `/my-wallet` | `MyWallet.tsx` | ✅ Yes |
| Public Wallet Download | `/wallet` | `WalletDownload.tsx` | ❌ No |
| Team Business Cards | `/team-cards` | `TeamCards.tsx` | ❌ No |

---

## 🏢 **Franchise Routes (Requires Franchise Login)**

| Page | Correct URL | File | Auth Required |
|------|-------------|------|---------------|
| Franchise Dashboard | `/franchise/dashboard` | `franchise/FranchiseDashboard.tsx` | ✅ Yes |
| Franchise Inbox | `/franchise/inbox` | `franchise/FranchiseInbox.tsx` | ✅ Yes |
| Franchise Reports | `/franchise/reports` | `franchise/FranchiseReports.tsx` | ✅ Yes |
| Franchise Support | `/franchise/support` | `franchise/FranchiseSupport.tsx` | ✅ Yes |
| Franchise Marketing | `/franchise/marketing` | `franchise/FranchiseMarketing.tsx` | ✅ Yes |

---

## 🔒 **Admin Routes (Requires Admin Login)**

| Page | Correct URL | File | Auth Required |
|------|-------------|------|---------------|
| Admin Login | `/admin/login` | `AdminLogin.tsx` | ❌ No |
| Admin Dashboard | `/admin/dashboard` | `AdminDashboard.tsx` | ✅ Yes |
| Admin Inbox | `/admin/inbox` | `AdminInbox.tsx` | ✅ Yes |
| Admin Users | `/admin/users` | `AdminUsers.tsx` | ✅ Yes |
| Admin Team | `/admin/team` | `AdminTeamInvitations.tsx` | ✅ Yes |
| Admin Stations | `/admin/stations` | `AdminStations.tsx` | ✅ Yes |
| Admin KYC | `/admin/kyc` | `AdminKYC.tsx` | ✅ Yes |
| Admin Financial | `/admin/financial` | `AdminFinancial.tsx` | ✅ Yes |
| Admin System Logs | `/admin/system-logs` | `AdminSystemLogs.tsx` | ✅ Yes |
| Admin Vouchers | `/admin/vouchers` | `AdminVouchers.tsx` | ✅ Yes |
| Admin Guide | `/admin/guide` | `AdminGuide.tsx` | ✅ Yes |
| Admin Help | `/admin/help` | `AdminHelpGuide.tsx` | ✅ Yes |
| Admin CRM | `/admin/crm` | `CrmDashboard.tsx` | ✅ Yes |
| Admin Customers | `/admin/customers` | `CustomerManagement.tsx` | ✅ Yes |
| Admin Documents | `/admin/k9000-documents` | `K9000Documents.tsx` | ✅ Yes |
| Admin Inventory | `/admin/inventory` | `InventoryManagement.tsx` | ✅ Yes |
| Admin Spare Parts | `/admin/spare-parts` | `SparePartsManagement.tsx` | ✅ Yes |

---

## 📱 **Mobile/Operations Routes**

| Page | Correct URL | File | Auth Required |
|------|-------------|------|---------------|
| Mobile Hub | `/m` | `MobileStationHub.tsx` | ✅ Yes |
| Mobile Ops | `/mobile/ops` | `MobileOpsHub.tsx` | ✅ Yes |
| Mobile Stations | `/mobile/stations` | `MobileStationSheet.tsx` | ✅ Yes |
| Ops Dashboard | `/ops` | `OpsDashboard.tsx` | ✅ Yes |
| Ops Today | `/ops/today` | `OpsTodayPage.tsx` | ✅ Yes |
| Station Detail | `/s/:id` | `MobileStationSheet.tsx` | ✅ Yes |

---

## 🏢 **Enterprise Routes**

| Page | Correct URL | File | Auth Required |
|------|-------------|------|---------------|
| Enterprise HQ | `/enterprise/hq` | `EnterpriseHQ.tsx` | ✅ Yes |
| Franchisee Dashboard | `/enterprise/franchisee/:id` | `FranchiseeDashboard.tsx` | ✅ Yes |
| Technician View | `/enterprise/technician/:id` | `TechnicianView.tsx` | ✅ Yes |
| Documents | `/documents` | `DocumentManagement.tsx` | ✅ Yes |

---

## 📄 **Public Pages (No Login Required)**

| Page | Correct URL | File | Status |
|------|-------------|------|--------|
| Home/Landing | `/` | `Landing.tsx` or `Home.tsx` | ✅ Works |
| About | `/about` | `About.tsx` | ✅ Works |
| Franchise Info | `/franchise` | `Franchise.tsx` | ✅ Works |
| Our Service | `/our-service` | `OurService.tsx` | ✅ Works |
| Contact | `/contact` | `Contact.tsx` | ✅ Works |
| Gallery | `/gallery` | `Gallery.tsx` | ✅ Works |
| Privacy Policy | `/privacy-policy` | `PrivacyPolicy.tsx` | ✅ Works |
| Privacy (alias) | `/privacy` | `Privacy.tsx` | ✅ Works |
| Terms | `/terms` | `Terms.tsx` | ✅ Works |
| Accessibility | `/accessibility-statement` | `AccessibilityStatement.tsx` | ✅ Works |
| Accessibility (alias) | `/accessibility` | `Accessibility.tsx` | ✅ Works |
| Backend Team | `/backend-team` | `BackendTeam.tsx` | ✅ Works |
| Locations | `/locations` | `Locations.tsx` | ✅ Works |
| Packages | `/packages` | `Packages.tsx` | ✅ Works |
| Company Reports | `/company-reports` | `CompanyReports.tsx` | ✅ Works |
| Reports (alias) | `/reports` | `CompanyReports.tsx` | ✅ Works |
| Investor Presentation | `/investor-presentation` | `InvestorPresentation.tsx` | ✅ Works |
| Pitch (alias) | `/pitch` | `InvestorPresentation.tsx` | ✅ Works |
| Investors (alias) | `/investors` | `InvestorPresentation.tsx` | ✅ Works |
| Status Dashboard | `/status/uptime` | `StatusDashboard.tsx` | ✅ Works |

---

## 💰 **Payment/Receipt Routes**

| Page | Correct URL | File | Status |
|------|-------------|------|--------|
| Receipt | `/receipt/:transactionId` | `ReceiptPage.tsx` | ✅ Works |
| Test Purchase | `/test-purchase` | `TestPurchase.tsx` | ✅ Works |
| Founder Member | `/founder-member` | `FounderMember.tsx` | ✅ Works |
| Claim Voucher | `/claim` | `ClaimVoucher.tsx` | ✅ Works |

---

## 🛠️ **Development/Debug Routes (Dev Only)**

| Page | Correct URL | File | Environment |
|------|-------------|------|-------------|
| Auth Test | `/auth-test` | `AuthTest.tsx` | Dev Only |
| Firebase Debug | `/firebase-debug` | `FirebaseDebug.tsx` | Dev Only |

---

## 🔗 **API Endpoints**

### Authentication APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/session` | POST | Create session cookie from ID token |
| `/api/auth/health` | GET | Auth system health check |
| `/api/auth/track-error` | POST | Track client-side auth errors |

### Simple Auth APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/simple-auth/signup` | POST | Register new customer |
| `/api/simple-auth/login` | POST | Login with email/password |
| `/api/simple-auth/logout` | POST | Logout and clear session |
| `/api/simple-auth/me` | GET | Get current user profile |

### Wallet APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallet/vip-card` | POST | Generate VIP loyalty card (.pkpass) |
| `/api/wallet/my-business-card` | POST | Generate personal business card |
| `/api/wallet/business-card` | POST | Generate team business card |
| `/api/wallet/e-voucher` | POST | Generate e-voucher card |
| `/api/wallet/email-cards` | POST | Email wallet cards with direct links |
| `/api/wallet/pass/:linkId` | GET | Direct download link for .pkpass |
| `/api/wallet/update-vip` | POST | Update VIP card (points/tier) |

### Admin APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/*` | Various | Admin-only endpoints |
| `/api/enterprise/*` | Various | Enterprise management |
| `/api/stations/*` | Various | Station management |
| `/api/loyalty/*` | Various | Loyalty program |

---

## ❌ **Routes That Don't Exist (Common Errors)**

| Wrong URL | Correct URL | Note |
|-----------|-------------|------|
| `/loyalty-dashboard` | `/loyalty/dashboard` | Use slash, not dash |
| `/wallet-download` | `/wallet` | Wrong format |
| `/admin-dashboard` | `/admin/dashboard` | Use slash, not dash |
| `/my-devices/security` | `/settings/security` | Wrong path |
| `/admin/crm-dashboard` | `/admin/crm` | No dash |

---

## 🔄 **Redirect Rules**

### After Successful Login:
**Default redirect:** `/dashboard`

**Special cases:**
- If came from `/signin?redirect=/loyalty` → redirect to `/loyalty`
- If came from protected route → redirect back to that route
- If user is admin → can access `/admin/*` routes
- If user is CEO (Nir Hadad) → special permissions

### After Logout:
**Redirect to:** `/` (Landing page)

### 401 Unauthorized:
**Redirect to:** `/signin`

---

## 🎯 **URL Aliases (Multiple URLs → Same Page)**

| Aliases | Resolves To | Reason |
|---------|-------------|--------|
| `/signup`, `/sign-up`, `/register` | `SignUp.tsx` | User convenience |
| `/signin`, `/login` | Login pages | Different auth methods |
| `/privacy`, `/privacy-policy` | Privacy pages | SEO |
| `/accessibility`, `/accessibility-statement` | Accessibility pages | SEO |
| `/reports`, `/company-reports` | Reports page | Shortcut |
| `/pitch`, `/investors`, `/investor-presentation` | Investor page | Multiple names |

---

## 📱 **iOS Wallet Download Flow**

1. User visits: `https://petwash.co.il/my-wallet`
2. User logs in (if not authenticated)
3. User clicks "📧 Email Cards" button
4. Email sent to user with direct links
5. Email contains URLs like:
   ```
   https://petwash.co.il/api/wallet/pass/ABC123?token=XYZ
   ```
6. User taps link on iOS → `.pkpass` file downloads
7. iOS prompts: "Add to Apple Wallet"
8. Card appears in Wallet app

**Link expires:** 60 minutes after email sent  
**Retry limit:** 3 downloads per link

---

## 🐛 **Common Navigation Bugs Fixed**

1. ✅ Fixed: `/loyalty-dashboard` → `/loyalty/dashboard`
2. ✅ Fixed: Window.location.href used instead of navigate()
3. ✅ Fixed: Missing authentication checks before redirects
4. ✅ Fixed: Inconsistent redirect URLs after login
5. ✅ Fixed: Broken links in email templates

---

## 🔍 **How to Verify Routes**

```bash
# Test route exists
curl -I https://petwash.co.il/dashboard

# Test API endpoint
curl -X GET https://petwash.co.il/api/health

# Test authenticated route (will get 401 if not logged in)
curl -I https://petwash.co.il/my-wallet
```

---

**Document Owner:** Pet Wash™ Engineering Team  
**Review Schedule:** After any route changes  
**Last Verified:** October 25, 2025
