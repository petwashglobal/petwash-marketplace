# 🧪 Manual Testing Guide - 32 Critical Fixes

**Pre-requisite**: Fix .replit port configuration (see REPLIT_502_FIX_REQUIRED.md)  
**Status**: Ready to execute once 502 error resolved  
**Estimated Time**: 30-45 minutes

---

## 🚀 PRE-TEST SETUP

### 1. Fix Replit 502 Error
```bash
# Edit .replit file manually in Replit UI
# Keep only these lines at the end:
[[ports]]
localPort = 5000
externalPort = 80

# Delete all other [[ports]] entries (lines 42-101)
# Save file and restart workflow
```

### 2. Verify Server Status
```bash
# Check server is running
curl -I http://localhost:5000/
# Expected: HTTP/1.1 200 OK

# Check public URL
# Open: https://[your-repl-url].repl.co
# Expected: Pet Wash™ homepage loads
```

### 3. Prepare Test Data
- Email address for testing: Your real email (to verify notifications)
- Phone number: Israeli format (e.g., 050-1234567)
- Browser: Chrome/Firefox with Developer Tools open

---

## 🔒 SECURITY TESTS (14 Fixes)

### Test 1: Admin Endpoint Protection
**Fixes Verified**: #2-14

**Steps**:
1. Open browser in incognito/private mode (not logged in)
2. Try to access: `/api/wallet/telemetry/stats`
3. **Expected**: 401 Unauthorized or redirect to login
4. **Fail If**: Wallet statistics data displayed without authentication

**Other Endpoints to Test**:
- `/api/franchise/all` - Should return 401/403
- `/api/global-forms/contact-submissions` - Should return 401/403
- `/api/reviews/flagged` - Should return 401/403
- `/api/k9000/supplier/orders` - Should return 401/403

**Pass Criteria**: ✅ All endpoints require authentication

---

### Test 2: Password Logging Eliminated
**Fix Verified**: #1

**Steps**:
1. Open server logs in Replit console
2. Attempt to login with test credentials
3. Search logs for password strings
4. **Expected**: No passwords visible in logs
5. **Fail If**: Plain text passwords appear in server output

**Pass Criteria**: ✅ No sensitive data logged

---

## 💾 DATABASE TESTS (5 Fixes)

### Test 3: Franchise Dashboard Real Data
**Fixes Verified**: #15-16

**Steps**:
1. Access franchise dashboard (requires franchise owner login)
2. Navigate to: Dashboard → Statistics
3. Check revenue figures, wash counts, transaction lists
4. **Expected**: 
   - Numbers are realistic (not all zeros)
   - Revenue totals match transaction history
   - VAT calculations correct (17% Israeli rate)
5. **Fail If**: 
   - All fields show zero
   - Revenue values are NaN
   - Totals don't match detail rows

**Pass Criteria**: ✅ Dashboard shows accurate PostgreSQL data

---

### Test 4: Financial Reports Export
**Fixes Verified**: #17-18

**Steps**:
1. Access: Reports → Financial Reports
2. Select date range: Last 7 days
3. Click "Export to Excel"
4. Open downloaded Excel file
5. **Expected**:
   - Transaction list with real booking IDs
   - Revenue calculations accurate
   - VAT column shows 17% of subtotal
   - Total row matches dashboard
6. Repeat for PDF export

**Pass Criteria**: ✅ Exports contain real transaction data

---

### Test 5: Review Trust Score
**Fix Verified**: #19

**Steps**:
1. Navigate to provider profile page
2. Check trust score badge
3. **Expected**:
   - Score based on actual completed bookings
   - Experience bonus shown for >50 or >100 bookings
   - Total bookings count is accurate
4. **Fail If**:
   - Booking count is always zero
   - Trust score doesn't change with experience

**Pass Criteria**: ✅ Trust scores reflect real booking history

---

### Test 6: Alphanumeric Franchise IDs
**Critical Bug Fix**

**Steps**:
1. Create test franchise with ID: "FR-TEST-ABC123"
2. Create station linked to this franchise
3. Access franchise dashboard with this ID
4. **Expected**:
   - Dashboard loads successfully
   - Revenue data displays correctly
   - No "Invalid franchise ID" errors
   - Reports show accurate data
5. **Fail If**:
   - Dashboard shows all zeros
   - Error: "NaN" in console
   - Queries fail silently

**Pass Criteria**: ✅ Alphanumeric franchise IDs work identically to numeric IDs

---

## 🔔 EMAIL NOTIFICATION TESTS (9 Fixes)

### Test 7: Contact Form Email
**Fix Verified**: #20

**Steps**:
1. Navigate to: Contact Us page
2. Fill form:
   - Name: "Test User"
   - Email: [your-email@example.com]
   - Subject: "Testing Email Integration"
   - Message: "This is a test notification"
   - Platform: "K9000"
3. Submit form
4. **Expected**:
   - Success message displayed
   - Email received at `Support@PetWash.co.il` within 2 minutes
   - Email contains all form fields
5. Check your inbox for confirmation email (if configured)

**Pass Criteria**: ✅ Support team receives contact form email

---

### Test 8: Franchise Inquiry Email
**Fix Verified**: #21

**Steps**:
1. Navigate to: Franchise Opportunities page
2. Fill inquiry form:
   - Name: "Potential Franchisee"
   - Email: [your-email@example.com]
   - Country: "United States"
   - City: "New York"
   - Investment Budget: "$100,000-$250,000"
   - Timeline: "3-6 months"
3. Submit form
4. **Expected**:
   - Email to `franchise@petwash.co.il`
   - Contains all franchise inquiry details
   - Formatted professionally

**Pass Criteria**: ✅ Franchise team receives inquiry with all details

---

### Test 9: Supplier Order Email
**Fix Verified**: #22

**Steps**:
1. Access: K9000 Admin → Supplier Orders
2. Create new supplier order:
   - Product: "Premium Pet Shampoo"
   - Quantity: 50
   - Supplier: "Test Supplier Ltd"
3. Submit order
4. **Expected**:
   - Email to `supplier@petwash.co.il`
   - Order details included
   - Purchase order number generated

**Pass Criteria**: ✅ Supplier receives order notification

---

### Test 10: Low Stock Alert
**Fix Verified**: #23-24

**Steps**:
1. Access: Inventory Management
2. Set product stock below minimum:
   - Product: "Pet Towels"
   - Current: 5 units
   - Minimum: 20 units
3. Trigger low stock check (automatic or manual)
4. **Expected**:
   - Email to `supplier@petwash.co.il`
   - Lists products below threshold
   - Recommended order quantity

**Pass Criteria**: ✅ Low stock alerts sent automatically

---

### Test 11: Inbox Message Notifications
**Fixes Verified**: #25-26

**Steps**:
1. Send message to franchise inbox
2. **Expected** (Franchise Owner):
   - Email notification of new message
   - Message preview included
   - Link to view full message
3. **Expected** (Customer):
   - Confirmation email that message sent
   - Copy of message for records

**Pass Criteria**: ✅ Both parties receive appropriate notifications

---

### Test 12: Flagged Review Alerts
**Fixes Verified**: #27-28

**Steps**:
1. Find any review on platform
2. Click "Flag as Inappropriate"
3. Select reason: "Spam"
4. Submit flag
5. **Expected**:
   - Email to `Support@PetWash.co.il`
   - Review content and reason included
   - Flagging user info provided
6. Test review response:
   - Business responds to review
   - Original reviewer gets notification email

**Pass Criteria**: ✅ Moderation team alerted + reviewers notified of responses

---

## 🔐 ACCESS CONTROL TESTS (4 Fixes)

### Test 13: Franchise Inbox Access Control
**Fixes Verified**: #29-30

**Steps**:
1. Create two test users:
   - User A: Franchise owner
   - User B: Unrelated user
2. User A: Access their franchise inbox
   - **Expected**: ✅ Access granted, messages displayed
3. User B: Try to access User A's franchise inbox
   - **Expected**: ❌ 403 Forbidden error
4. Check server logs for access denial

**Pass Criteria**: ✅ Only authorized users access franchise inbox

---

### Test 14: Wallet Telemetry Admin Access
**Fix Verified**: #31

**Steps**:
1. Login as regular user (not admin)
2. Try to access: `/api/wallet/telemetry/stats`
3. **Expected**: 403 Forbidden (not admin)
4. Login as admin user
5. Access same endpoint
6. **Expected**: 200 OK, statistics displayed

**Pass Criteria**: ✅ Only admins see wallet telemetry

---

### Test 15: Review Moderation Admin Only
**Fix Verified**: #32

**Steps**:
1. Find flagged review in admin panel
2. Try to moderate as regular user
3. **Expected**: 403 Forbidden
4. Login as admin
5. Approve or reject review
6. **Expected**: Review status updated

**Pass Criteria**: ✅ Only admins can moderate reviews

---

## 📊 TEST RESULTS TEMPLATE

Copy this to track your testing progress:

```markdown
## Test Results - [Date]

### Security Tests (14 fixes)
- [ ] Test 1: Admin endpoint protection - PASS/FAIL
- [ ] Test 2: Password logging eliminated - PASS/FAIL

### Database Tests (5 fixes)
- [ ] Test 3: Franchise dashboard real data - PASS/FAIL
- [ ] Test 4: Financial reports export - PASS/FAIL
- [ ] Test 5: Review trust score - PASS/FAIL
- [ ] Test 6: Alphanumeric franchise IDs - PASS/FAIL

### Email Notification Tests (9 fixes)
- [ ] Test 7: Contact form email - PASS/FAIL
- [ ] Test 8: Franchise inquiry email - PASS/FAIL
- [ ] Test 9: Supplier order email - PASS/FAIL
- [ ] Test 10: Low stock alert - PASS/FAIL
- [ ] Test 11: Inbox message notifications - PASS/FAIL
- [ ] Test 12: Flagged review alerts - PASS/FAIL

### Access Control Tests (4 fixes)
- [ ] Test 13: Franchise inbox access control - PASS/FAIL
- [ ] Test 14: Wallet telemetry admin access - PASS/FAIL
- [ ] Test 15: Review moderation admin only - PASS/FAIL

**Overall Status**: ___/15 tests passed
**Ready for Production**: YES / NO
```

---

## 🐛 TROUBLESHOOTING

### Email Not Received?
1. Check spam folder
2. Verify EmailService configuration in server logs
3. Check SendGrid dashboard for delivery status
4. Confirm recipient email in route code

### 403 Forbidden Errors?
1. Check user authentication token
2. Verify user role in Firestore
3. Check server logs for auth middleware output
4. Confirm super admin list includes test user

### Dashboard Shows Zeros?
1. Verify test data exists in database
2. Check franchiseId format (alphanumeric supported)
3. Look for "NaN" in browser console
4. Check server logs for query errors

### Can't Access Admin Endpoints?
1. Confirm logged in as admin
2. Check Firebase token validity
3. Verify role assignment in Firestore users collection
4. Try logging out and back in

---

## ✅ SUCCESS CRITERIA

### All 32 Fixes Verified When:
- ✅ 15/15 manual tests pass
- ✅ No security vulnerabilities found
- ✅ All emails delivered successfully
- ✅ Database queries return real data
- ✅ Access control prevents unauthorized access
- ✅ Alphanumeric franchise IDs work correctly

### Production Ready When:
- ✅ All tests pass
- ✅ No critical bugs found
- ✅ Email delivery confirmed
- ✅ Performance acceptable
- ✅ Security audit clean

---

## 📝 NEXT STEPS AFTER TESTING

1. **If All Tests Pass**:
   - Document test results
   - Deploy to production
   - Monitor for 24 hours
   - Celebrate! 🎉

2. **If Tests Fail**:
   - Document failures
   - Report to development team
   - Include screenshots and error messages
   - Retest after fixes applied

---

**Testing Owner**: [Your Name]  
**Test Date**: ___________  
**Environment**: Development/Staging/Production  
**Status**: Pending / In Progress / Complete
