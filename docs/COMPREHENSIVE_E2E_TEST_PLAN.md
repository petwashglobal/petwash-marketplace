# Pet Wash™ Comprehensive E2E Test Plan
## 100-User Simulation - All Roles & Workflows

**Status**: READY FOR EXECUTION
**Priority Framework**: P0 (Critical) → P1 (Important) → P2 (Nice-to-Have)
**Nayax Integration**: Ready for API key arrival

---

## P0: CRITICAL FLOWS (MUST PASS BEFORE DEPLOYMENT)

### TEST 1: SUPER ADMIN - SYSTEM CONTROL
**Users**: Super Admin accounts (see secure credential vault)
**Credentials**: Contact system administrator for secure credentials

**Test Steps**:
1. Navigate to `/admin/login`
2. Login with Super Admin credentials (obtain from secure credential vault)
3. Verify dashboard loads with ALL sections accessible
4. Test access to:
   - `/admin/employees` - Employee management
   - `/admin/franchise-management` - Franchise dashboard
   - `/admin/finance` - Financial records
   - `/admin/hr` - HR dashboard
   - `/admin/stations` or `/k9000-dashboard` - K9000 management
   - `/admin/logs` - System logs
5. Verify RBAC Override: Can access ALL data across ALL franchises
6. Test critical actions: Approve expenses, modify permissions
7. Verify no permission denied errors

**Expected**: Full system access, no restrictions, all data visible

**Validation**:
- [ ] Login succeeds
- [ ] All dashboards accessible
- [ ] Can modify any user/franchise data
- [ ] System logs accessible
- [ ] No 404 or permission errors

---

### TEST 2: EMPLOYEE WORKFLOWS - HR & FINANCE
**Roles**: HR Manager, Finance Manager, Operations Manager

**Test Scenarios**:

#### A. HR Manager Flow
1. Login as HR user
2. Navigate to `/admin/hr` or `/hr-dashboard`
3. Test employee management:
   - View all employees
   - Add new employee
   - Modify employee roles
   - Process payroll
4. Review performance reviews
5. Check recruitment pipeline

**Expected**: Full HR access, no financial/franchise access

#### B. Finance Manager Flow
1. Login as Finance user
2. Navigate to `/admin/finance` or `/finance-dashboard`
3. Test financial operations:
   - View accounts payable
   - View accounts receivable
   - Access general ledger
   - Process Israeli VAT reclaim
4. Test expense approval workflow
5. Generate financial reports

**Expected**: Full financial access, no HR/operations access

#### C. Operations Manager Flow
1. Login as Operations user
2. Test station management
3. Monitor K9000 telemetry
4. Handle incidents
5. Track SLA compliance

**Expected**: Station access, operational data, no finance/HR

**Validation**:
- [ ] Role-based access working
- [ ] No permission leaks
- [ ] Each role sees only their data
- [ ] Actions succeed within permissions

---

### TEST 3: FRANCHISE MULTI-LOCATION MANAGEMENT
**User**: Franchisee account

**Test Steps**:
1. Login as franchisee
2. Navigate to `/franchisee-dashboard`
3. Verify sees ONLY assigned locations
4. Test multi-station management:
   - View all franchise stations
   - Check inventory across locations
   - Monitor K9000 telemetry
   - Review franchise-specific financials
5. Attempt to access other franchises (should FAIL)
6. Test operations dashboard
7. Review customer data (franchise-scoped)

**Expected**: Full access to assigned franchises ONLY, zero cross-franchise data leaks

**Validation**:
- [ ] Sees only assigned stations
- [ ] Cannot access other franchises
- [ ] Inventory tracking works
- [ ] Financial data franchise-scoped
- [ ] K9000 telemetry filtered correctly

---

### TEST 4: CUSTOMER FUNNEL - SIGNUP TO NAYAX CHECKOUT
**Critical Path**: Sign-up → Browse → Purchase → Payment → Voucher → Redeem

#### Phase 1: Registration & Authentication
1. Navigate to `/signup`
2. Register new customer account
3. Complete email verification
4. Test login at `/signin`
5. Verify session persists

#### Phase 2: Browse & Select
1. Navigate to `/packages` or homepage
2. Browse wash packages
3. Select "3 Wash Premium Package"
4. View package details
5. Click "Purchase" or "Buy Now"

#### Phase 3: Nayax Checkout (CRITICAL)
**Note**: Requires NAYAX_API_KEY (arriving tomorrow)

1. Proceed to checkout
2. Enter customer details
3. Initiate Nayax payment:
   - Test endpoint: `POST /api/payments/nayax/initiate-wash`
   - Verify authorize step
   - Verify remote-vend step
   - Verify settle step
4. Complete payment
5. Receive voucher code
6. Download to Apple/Google Wallet

#### Phase 4: Voucher Management
1. View voucher in `/my-wallet`
2. Check voucher details
3. Verify QR code generation
4. Test voucher sharing

#### Phase 5: K9000 Redemption
1. Navigate to station (or simulate with QR)
2. Scan QR code at K9000 station
3. Redeem voucher:
   - Test endpoint: `POST /api/payments/nayax/redeem-qr`
4. Verify wash activation
5. Check remaining balance
6. Test partial redemption

**Expected**: Smooth flow from signup to wash, zero payment failures

**Nayax Test Checklist**:
- [ ] Authorization succeeds
- [ ] Remote vend executes
- [ ] Settlement completes
- [ ] Voucher generated with QR
- [ ] Wallet integration works
- [ ] QR redemption succeeds
- [ ] Balance tracking accurate
- [ ] Webhooks fire correctly

---

### TEST 5: K9000 STATION OPERATIONS & QR REDEMPTION
**Focus**: Physical station simulation

#### Scenario A: QR Scan & Wash Activation
1. Customer approaches K9000 station
2. Scans QR code from wallet
3. Nayax validates voucher
4. Station activates wash cycle
5. Wash completes
6. Balance deducted correctly

#### Scenario B: Direct Payment at Station
1. Customer at station (no voucher)
2. Select wash type on terminal
3. Nayax payment authorization
4. Payment processed
5. Wash cycle starts

#### Scenario C: Station Monitoring
1. Admin monitors station status
2. View real-time telemetry
3. Check supply levels
4. Review maintenance alerts
5. Test remote diagnostics

**Expected**: All station operations work, telemetry accurate, payments process correctly

**Validation**:
- [ ] QR redemption instant
- [ ] Payment authorization <3s
- [ ] Wash activation confirmed
- [ ] Telemetry updates real-time
- [ ] No stuck transactions
- [ ] Balance deducted correctly

---

## P1: IMPORTANT FLOWS

### TEST 6: WALK MY PET™ MARKETPLACE
**Workflow**: Customer books → Walker accepts → Service → Payment

1. Customer navigates to `/walk-my-pet`
2. Browse available walkers
3. Select walker and time slot
4. Book walking session
5. Payment processing via Nayax
6. Walker receives notification
7. Walker accepts booking
8. Navigate to `/walker-dashboard`
9. Start walk session
10. Complete walk with GPS tracking
11. Customer approves service
12. Escrow payment released to walker

**Validation**:
- [ ] Booking flow complete
- [ ] Payment held in escrow
- [ ] GPS tracking works
- [ ] Walker notifications sent
- [ ] Payment released correctly

---

### TEST 7: SITTER SUITE™ MARKETPLACE
**Workflow**: Owner requests → Sitter accepts → Service → Review

1. Navigate to `/sitter-suite`
2. Request sitter booking
3. Select dates and pet details
4. Nayax prepayment
5. Sitter reviews request
6. Sitter accepts
7. Service period tracking
8. Complete service
9. Owner review
10. Payment settlement

**Validation**:
- [ ] Booking system works
- [ ] Prepayment processed
- [ ] Sitter dashboard functional
- [ ] Reviews save correctly

---

### TEST 8: PETTREK™ TRANSPORT
**Workflow**: Transport booking with driver assignment

1. Navigate to `/pettrek`
2. Enter pickup/dropoff locations
3. Select pet transport type
4. Calculate price
5. Book transport
6. Driver assignment
7. GPS tracking
8. Complete trip
9. Payment release

**Validation**:
- [ ] Booking accepts locations
- [ ] Pricing calculates correctly
- [ ] Driver receives assignment
- [ ] GPS tracking active
- [ ] Payment settles

---

### TEST 9: CONTRACTOR ONBOARDING (E-SIGNATURE & BIOMETRIC)
**Workflow**: Application → Background Check → E-Sign → Biometric → Approval

1. Navigate to `/provider-onboarding` or contractor signup
2. Complete application form
3. Upload documents
4. Background check initiation
5. DocuSeal e-signature workflow
6. Biometric verification (WebAuthn/Passkey)
7. GPS-verified logbook setup
8. Admin approval
9. Contractor dashboard access

**Validation**:
- [ ] Form submission works
- [ ] DocuSeal integration functional
- [ ] Biometric auth succeeds
- [ ] Background check triggers
- [ ] Admin approval workflow
- [ ] Dashboard access granted

---

### TEST 10: LOYALTY WALLET & APPLE/GOOGLE WALLET
**Workflow**: Earn points → Tier progression → Wallet integration

1. Customer makes purchases
2. Points accumulated
3. Tier progression (New → Bronze → Silver → Gold → Diamond)
4. Discount calculation
5. Add loyalty card to Apple Wallet
6. Add loyalty card to Google Wallet
7. Test wallet pass updates
8. Redeem points for rewards

**Validation**:
- [ ] Points track accurately
- [ ] Tier upgrades automatic
- [ ] Discounts apply correctly
- [ ] Apple Wallet pass works
- [ ] Google Wallet pass works
- [ ] Pass updates push correctly

---

## P2: NICE-TO-HAVE (ANALYTICS & OPTIONAL)

### TEST 11: ANALYTICS DASHBOARDS
- Revenue analytics
- Customer behavior tracking
- Station performance metrics
- Employee productivity
- Franchise comparisons

### TEST 12: MOBILE PWA FEATURES
- Offline mode
- Push notifications
- App install prompt
- Badge API notifications
- Background sync

---

## 100-USER SIMULATION MATRIX

### User Personas (10 Types × 10 Variations = 100 Users)

#### Internal Users (50)
1. **Super Admins** (2): CEO, Director
2. **HR Managers** (5): Different regions
3. **Finance Managers** (5): Different departments
4. **Operations Managers** (5): Station clusters
5. **Franchisees** (10): Multi-location owners
6. **Employees** (15): Walkers, Sitters, Station staff
7. **Contractors** (8): Onboarding pipeline

#### External Users (50)
8. **New Customers** (10): First-time users
9. **Regular Customers** (15): Bronze/Silver tiers
10. **VIP Customers** (15): Gold/Diamond tiers
11. **Guest Browsers** (10): Not logged in

### Test Variations Per Persona
1. **Device**: Desktop, Tablet, Mobile
2. **Browser**: Chrome, Safari, Firefox, Edge
3. **Locale**: Hebrew (RTL), English (LTR), Russian, Arabic, French, Spanish
4. **Connection**: 4G, WiFi, 3G (slow)
5. **Permission State**: First visit, Returning, Logged out
6. **Time of Day**: Peak hours, Off-peak, Maintenance window
7. **Location**: Tel Aviv, Jerusalem, Haifa, International
8. **Actions**: Browse, Purchase, Cancel, Support, Review

### Concurrent Load Test Scenarios
- **Wave 1**: 10 users (baseline)
- **Wave 2**: 25 users (normal load)
- **Wave 3**: 50 users (peak hour)
- **Wave 4**: 75 users (stress test)
- **Wave 5**: 100 users (maximum capacity)

---

## NAYAX INTEGRATION READINESS

### Pre-API Key Checklist (DO NOW)
- [x] Nayax Service implemented (`server/services/NayaxSparkService.ts`)
- [x] Payment routes configured (`server/routes/nayax-payments.ts`)
- [x] Demo mode active (fallback working)
- [x] Webhook handlers ready
- [ ] Test with demo/sandbox mode
- [ ] Validate all payment endpoints
- [ ] Verify error handling
- [ ] Test void/refund flows

### Post-API Key Checklist (TOMORROW)
1. Set environment variable: `NAYAX_API_KEY=<key_from_israel>`
2. Set `NAYAX_SECRET=<secret_from_israel>`
3. Restart server: `npm run dev`
4. Test authorization endpoint
5. Test remote-vend endpoint
6. Test settlement endpoint
7. Verify webhook signature validation
8. Test complete wash cycle
9. Monitor transactions in Nayax dashboard
10. Verify reconciliation with database

### Nayax Test Endpoints
```bash
# Authorization
POST /api/payments/nayax/authorize
{
  "amount": 50,
  "customerToken": "encrypted_token",
  "terminalId": "STATION_001"
}

# Remote Vend
POST /api/payments/nayax/remote-vend
{
  "terminalId": "STATION_001",
  "productCode": "DOGWASH_PREMIUM",
  "transactionId": "txn_abc123"
}

# Settle
POST /api/payments/nayax/settle
{
  "transactionId": "txn_abc123",
  "amount": 50
}

# Complete Wash Cycle
POST /api/payments/nayax/initiate-wash
{
  "amount": 50,
  "customerUid": "user_123",
  "customerToken": "encrypted_token",
  "washType": "DOGWASH_PREMIUM",
  "stationId": "STATION_001",
  "terminalId": "TERM_001"
}
```

---

## REGRESSION TESTS (CRITICAL FOR PRODUCTION)

### Issues Fixed Today - MUST NOT REGRESS
1. **Route 404 Errors**: All routes return 200, no 404s
2. **Duplicate Social Icons**: Only 6 floating buttons (not 12)
3. **Old Social Handles**: Only @petwashltd (no @petwash.israel)
4. **Email Consistency**: Only Support@PetWash.co.il (no hello@ or info@)
5. **Cache Busting**: HTML files not cached, fresh content served

### Regression Test Commands
```bash
# Test all critical routes
curl -o /dev/null -s -w "%{http_code}\n" https://petwash.co.il/
curl -o /dev/null -s -w "%{http_code}\n" https://petwash.co.il/pet-wash-circle
curl -o /dev/null -s -w "%{http_code}\n" https://petwash.co.il/wallet
curl -o /dev/null -s -w "%{http_code}\n" https://petwash.co.il/loyalty
curl -o /dev/null -s -w "%{http_code}\n" https://petwash.co.il/franchise

# Verify social media links
curl -s https://petwash.co.il/ | grep -o "petwashltd" | wc -l  # Should be >0
curl -s https://petwash.co.il/ | grep -o "petwash.israel" | wc -l  # Should be 0

# Verify email addresses
curl -s https://petwash.co.il/ | grep -o "Support@PetWash.co.il" | wc -l  # Should be >0
curl -s https://petwash.co.il/ | grep -o "hello@petwash" | wc -l  # Should be 0
```

---

## PRODUCTION DEPLOYMENT CHECKLIST

### Before Deployment
- [ ] All P0 tests pass
- [ ] Nayax integration tested with API key
- [ ] 100-user simulation completed
- [ ] Regression tests pass
- [ ] No console errors
- [ ] All routes return 200
- [ ] Social media links correct
- [ ] Email addresses consistent
- [ ] Cache-busting active

### During Deployment
- [ ] Trigger deployment
- [ ] Monitor build process
- [ ] Verify deployment success
- [ ] Wait 3 minutes for cache clear

### Post-Deployment Validation
- [ ] Test homepage loads
- [ ] Test all critical routes
- [ ] Verify Nayax checkout works
- [ ] Check admin dashboard
- [ ] Validate mobile responsiveness
- [ ] Test in 3+ browsers
- [ ] Verify Hebrew RTL layout
- [ ] Test payment flow end-to-end

---

## EXECUTION TIMELINE

**TODAY** (Pre-API Key):
1. ✅ All routes fixed
2. ✅ Duplicates removed
3. ✅ Social media cleaned
4. ✅ Emails normalized
5. ⏳ Execute P0 tests manually
6. ⏳ Run 100-user simulation (non-payment flows)

**TOMORROW** (Post-API Key):
1. Configure Nayax credentials
2. Test payment authorization
3. Test complete wash cycles
4. Verify QR redemption
5. Monitor first live transactions
6. Complete P1 marketplace tests

**ONGOING**:
- Monitor production metrics
- Track Nayax transaction success rate
- Review user feedback
- Optimize performance

---

## SUCCESS CRITERIA

### P0 Success Metrics
- ✅ 100% route success (no 404s)
- ✅ 100% Nayax transaction success
- ✅ Zero RBAC permission leaks
- ✅ All admin functions accessible
- ✅ Customer checkout <30 seconds

### P1 Success Metrics
- ✅ Marketplace bookings complete
- ✅ Wallet integration works
- ✅ Contractor onboarding smooth

### Overall Success
- **100 users tested**: All personas validated
- **Zero critical bugs**: No P0 failures
- **Payment success**: >99.5% Nayax transactions succeed
- **User satisfaction**: No frustrated user reports
- **Production stable**: No 404s, no cache issues

---

**READY FOR COMPREHENSIVE TESTING** 🚀

Contact: Support@PetWash.co.il for issues
