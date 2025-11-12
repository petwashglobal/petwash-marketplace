# Nayax Integration - Comprehensive Test Suite
**Pet Wash™ - Full Integration Testing**  
**Date**: October 28, 2025  
**Status**: Ready for Testing

---

## Test Environment Setup

### Required Credentials (Add to Replit Secrets)
```bash
NAYAX_API_KEY=your_api_key_here
NAYAX_TERMINAL_ID_MAIN=your_main_terminal_id
NAYAX_TERMINAL_ID_SECONDARY=your_secondary_terminal_id (optional)
ALERTS_SLACK_WEBHOOK=your_slack_webhook (optional)
```

### Test User Setup
```bash
# Firebase test user (already configured)
Email: test@petwash.co.il
UID: test-user-123
```

---

## Test Plan Overview

| # | Test Name | Endpoint | Method | Status |
|---|-----------|----------|--------|--------|
| 1 | Cortina Dynamic QR Webhook | `/api/payments/nayax/cortina/inquiry` | POST | 🟡 Pending |
| 2 | Loyalty Card Creation | `/api/payments/nayax/loyalty/create-card` | POST | 🟡 Pending |
| 3 | Static QR - FREE Type | `/api/payments/nayax/redeem-qr` | POST | 🟡 Pending |
| 4 | Static QR - VOUCHER Type | `/api/payments/nayax/redeem-qr` | POST | 🟡 Pending |
| 5 | Static QR - LOYALTY Type | `/api/payments/nayax/redeem-qr` | POST | 🟡 Pending |
| 6 | Static QR - GIFT Type | `/api/payments/nayax/redeem-qr` | POST | 🟡 Pending |
| 7 | Machine Status/Telemetry | `/api/payments/nayax/machine-status/:id` | GET | 🟡 Pending |
| 8 | Payment Flow - Authorize | `/api/payments/nayax/authorize` | POST | 🟡 Pending |
| 9 | Payment Flow - Remote Vend | `/api/payments/nayax/remote-vend` | POST | 🟡 Pending |
| 10 | Payment Flow - Settle | `/api/payments/nayax/settle` | POST | 🟡 Pending |
| 11 | Payment Flow - Void | `/api/payments/nayax/void` | POST | 🟡 Pending |
| 12 | QR Double-Spend Prevention | `/api/payments/nayax/redeem-qr` | POST | 🟡 Pending |

---

## Detailed Test Cases

### TEST 1: Cortina Dynamic QR Webhook (NEW!)
**Purpose**: Test real-time QR validation at K9000 machine  
**Endpoint**: `POST /api/payments/nayax/cortina/inquiry`  
**Auth**: None (webhook called by Nayax server)

**Test Case 1.1: Valid FREE wash QR**
```bash
curl -X POST http://localhost:5000/api/payments/nayax/cortina/inquiry \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "CORTINA-TEST-001",
    "qrCodeData": "FREE:premium:0",
    "amount": 120,
    "deviceId": "TERMINAL_001"
  }'
```

**Expected Response**:
```json
{
  "ResponseCode": "000",
  "TransactionStatus": "APPROVED",
  "AuthCode": "CORTINA-CORTINA-TEST-001"
}
```

**Test Case 1.2: Valid VOUCHER QR**
```bash
curl -X POST http://localhost:5000/api/payments/nayax/cortina/inquiry \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "CORTINA-TEST-002",
    "qrCodeData": "VOUCHER:PROMO50:50",
    "amount": 100,
    "deviceId": "TERMINAL_001"
  }'
```

**Expected Response**:
```json
{
  "ResponseCode": "000",
  "TransactionStatus": "APPROVED",
  "AuthCode": "CORTINA-CORTINA-TEST-002"
}
```

**Test Case 1.3: Invalid QR format**
```bash
curl -X POST http://localhost:5000/api/payments/nayax/cortina/inquiry \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "CORTINA-TEST-003",
    "qrCodeData": "INVALID",
    "amount": 100,
    "deviceId": "TERMINAL_001"
  }'
```

**Expected Response**:
```json
{
  "ResponseCode": "051",
  "TransactionStatus": "DECLINED",
  "StatusMessage": "Invalid QR code format"
}
```

**Test Case 1.4: Duplicate redemption (double-spend test)**
```bash
# First redemption - should succeed
curl -X POST http://localhost:5000/api/payments/nayax/cortina/inquiry \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "CORTINA-TEST-004A",
    "qrCodeData": "FREE:deluxe:0",
    "amount": 100,
    "deviceId": "TERMINAL_001"
  }'

# Second redemption - should fail
curl -X POST http://localhost:5000/api/payments/nayax/cortina/inquiry \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "CORTINA-TEST-004B",
    "qrCodeData": "FREE:deluxe:0",
    "amount": 100,
    "deviceId": "TERMINAL_001"
  }'
```

**Expected**: First = APPROVED, Second = DECLINED (already redeemed)

---

### TEST 2: Loyalty Card Creation (NEW!)
**Purpose**: Create Nayax-compatible loyalty ID  
**Endpoint**: `POST /api/payments/nayax/loyalty/create-card`  
**Auth**: Required (Firebase)

**Test Case 2.1: Create new loyalty card**
```bash
# First get Firebase auth token
curl -X POST http://localhost:5000/api/payments/nayax/loyalty/create-card \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "customerName": "John Doe",
    "loyaltyId": "PETWASH-VIP-001",
    "customerUid": "test-user-123"
  }'
```

**Expected Response** (with real credentials):
```json
{
  "success": true,
  "message": "Loyalty card created successfully",
  "nayaxCardId": "CARD_123456"
}
```

**Test Case 2.2: Duplicate loyalty ID**
```bash
# Try to create same ID twice
curl -X POST http://localhost:5000/api/payments/nayax/loyalty/create-card \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "customerName": "Jane Smith",
    "loyaltyId": "PETWASH-VIP-001",
    "customerUid": "test-user-456"
  }'
```

**Expected**: Error (duplicate ID not allowed)

---

### TEST 3-6: Static QR Redemption (All 4 Types)

**Test Case 3.1: FREE type QR**
```bash
curl -X POST http://localhost:5000/api/payments/nayax/redeem-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "qrCode": "FREE:premium:0",
    "stationId": "station-test-1",
    "customerUid": "test-user-123"
  }'
```

**Expected**: Full amount discounted, remote vend triggered

**Test Case 3.2: VOUCHER type QR**
```bash
curl -X POST http://localhost:5000/api/payments/nayax/redeem-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "qrCode": "VOUCHER:SAVE30:30",
    "stationId": "station-test-1",
    "customerUid": "test-user-123",
    "totalAmount": 100
  }'
```

**Expected**: ₪30 discounted, charge ₪70

**Test Case 3.3: LOYALTY type QR**
```bash
curl -X POST http://localhost:5000/api/payments/nayax/redeem-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "qrCode": "LOYALTY:gold:15",
    "stationId": "station-test-1",
    "customerUid": "test-user-123",
    "totalAmount": 100
  }'
```

**Expected**: 15% discount = ₪15 off, charge ₪85

**Test Case 3.4: GIFT type QR**
```bash
curl -X POST http://localhost:5000/api/payments/nayax/redeem-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "qrCode": "GIFT:CARD100:100",
    "stationId": "station-test-1",
    "customerUid": "test-user-123",
    "totalAmount": 80
  }'
```

**Expected**: ₪80 redeemed from ₪100 gift card, ₪20 remaining

---

### TEST 7: Machine Status/Telemetry

**Test Case 7.1: Get machine status**
```bash
curl -X GET http://localhost:5000/api/payments/nayax/machine-status/TERMINAL_001 \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Expected Response**:
```json
{
  "isAvailable": true,
  "state": "Idle",
  "temperature": 38.5,
  "pressure": 2.1,
  "shampooLevel": 75,
  "conditionerLevel": 60,
  "firmwareVersion": "v2.4.1",
  "connectionStatus": "Online"
}
```

**Test Case 7.2: Offline machine detection**
```bash
# Check after machine has been offline
curl -X GET http://localhost:5000/api/payments/nayax/machine-status/TERMINAL_OFFLINE \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Expected**: 
- Slack alert sent
- Database record shows `isOnline: false`

---

### TEST 8-11: Complete Payment Flow

**Test Case 8: Full payment cycle**
```bash
# Step 1: Authorize
curl -X POST http://localhost:5000/api/payments/nayax/authorize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "amount": 120,
    "terminalId": "TERMINAL_001",
    "customerUid": "test-user-123",
    "washType": "premium"
  }'

# Response: { "success": true, "transactionId": "TX123", "authCode": "AUTH789" }

# Step 2: Remote Vend (start wash)
curl -X POST http://localhost:5000/api/payments/nayax/remote-vend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "transactionId": "TX123"
  }'

# Response: { "success": true, "vendStatus": "STARTED" }

# Step 3: Settle (after wash completes)
curl -X POST http://localhost:5000/api/payments/nayax/settle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "transactionId": "TX123"
  }'

# Response: { "success": true, "status": "SETTLED", "settlementId": "SETTLE456" }
```

**Expected Flow**:
1. Authorization succeeds → Transaction created in DB
2. Remote vend triggers → Machine starts wash
3. Settlement completes → Transaction marked SETTLED
4. Blockchain audit entry created

**Test Case 9: Void transaction**
```bash
# Authorize
curl -X POST http://localhost:5000/api/payments/nayax/authorize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "amount": 100,
    "terminalId": "TERMINAL_001",
    "customerUid": "test-user-123",
    "washType": "basic"
  }'

# Void instead of settling
curl -X POST http://localhost:5000/api/payments/nayax/void \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "transactionId": "TX124"
  }'
```

**Expected**: Transaction marked VOIDED, no charge to customer

---

### TEST 12: QR Double-Spend Prevention

**Test Case 12.1: Same QR redeemed twice**
```bash
# First redemption
QR_CODE="FREE:test-unique-$(date +%s):0"

curl -X POST http://localhost:5000/api/payments/nayax/redeem-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d "{
    \"qrCode\": \"$QR_CODE\",
    \"stationId\": \"station-test-1\",
    \"customerUid\": \"test-user-123\"
  }"

# Second redemption (should fail)
curl -X POST http://localhost:5000/api/payments/nayax/redeem-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d "{
    \"qrCode\": \"$QR_CODE\",
    \"stationId\": \"station-test-1\",
    \"customerUid\": \"test-user-456\"
  }"
```

**Expected**: 
- First redemption: SUCCESS
- Second redemption: DECLINED (QR already redeemed)
- Database constraint prevents duplicate hash

**Test Case 12.2: Verify blockchain audit trail**
```bash
# Check redemption is logged in blockchain
curl -X GET http://localhost:5000/api/blockchain/audit/recent \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Expected**: Redemption entry with SHA-256 hash, immutable chain

---

## Background Monitoring Tests

### TEST 13: Pending Transaction Auto-Void
**Purpose**: Verify stuck transactions are auto-voided after 30min

**Setup**:
```bash
# Create a transaction but don't settle it
curl -X POST http://localhost:5000/api/payments/nayax/authorize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "amount": 100,
    "terminalId": "TERMINAL_001",
    "customerUid": "test-user-123",
    "washType": "basic"
  }'

# Wait 30+ minutes (or manually trigger monitoring job)
```

**Expected**:
- After 30min: NayaxMonitoringService auto-voids transaction
- Slack alert sent: "⚠️ 1 stuck transaction auto-voided"
- Database: Transaction status = VOIDED

---

### TEST 14: Offline Station Detection
**Purpose**: Verify hourly offline checks work

**Expected Behavior**:
- Every hour: Check all terminal statuses
- If offline: Send Slack alert "🔴 2 Nayax stations offline"
- Log to database with `isOnline: false`

---

### TEST 15: Daily Transaction Report
**Purpose**: Verify daily 7 AM report generation

**Expected Output** (Slack):
```
📊 Nayax Daily Report (Oct 28, 2025)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Settled: 127 transactions
💰 Revenue: ₪10,450
❌ Failed: 3 transactions
⚠️ Voided: 2 transactions
🔄 Pending: 0 transactions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Database Validation Tests

### TEST 16: Verify Schema Integrity
```sql
-- Check nayaxRedemptions table has uniqueness constraint
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'nayax_redemptions' 
  AND constraint_type = 'UNIQUE';

-- Should return constraint on redemption_hash
```

### TEST 17: Verify Audit Trail
```sql
-- Check blockchain audit entries exist
SELECT COUNT(*) 
FROM blockchain_audit_trail 
WHERE operation_type = 'nayax_redemption';

-- Should have entries for all redemptions
```

---

## Success Criteria

### All Tests Must Pass:
- ✅ Cortina webhook responds correctly (APPROVED/DECLINED)
- ✅ Loyalty cards created in Nayax system
- ✅ All 4 QR types redeem correctly
- ✅ Double-spend prevention works (database constraint)
- ✅ Machine telemetry includes firmware version
- ✅ Complete payment flow (authorize → vend → settle)
- ✅ Void transactions work correctly
- ✅ Background monitoring runs on schedule
- ✅ Slack alerts sent for offline/stuck transactions
- ✅ Daily reports generated accurately

### Performance Benchmarks:
- QR redemption: < 500ms response time
- Machine status check: < 1s response time
- Payment authorization: < 2s response time

### Security Validation:
- QR hashes are SHA-256
- Database constraints prevent duplicates
- All endpoints require auth (except Cortina webhook)
- Blockchain audit trail immutable

---

## Test Execution Log

### Run 1: October 28, 2025
- **Tester**: Automated test suite
- **Environment**: Development (localhost:5000)
- **Nayax Credentials**: Not yet configured
- **Status**: Ready to execute

**Results**:
```
[ ] TEST 1: Cortina Dynamic QR Webhook
[ ] TEST 2: Loyalty Card Creation
[ ] TEST 3-6: Static QR Redemption (4 types)
[ ] TEST 7: Machine Status/Telemetry
[ ] TEST 8-11: Payment Flow
[ ] TEST 12: Double-Spend Prevention
[ ] TEST 13-15: Background Monitoring
[ ] TEST 16-17: Database Validation
```

---

## Next Steps

1. **Add Nayax credentials** to Replit Secrets
2. **Run automated test suite** (use provided curl commands)
3. **Verify all tests pass**
4. **Review with architect**
5. **Deploy to production**

---

## Notes
- Some tests require real Nayax credentials to execute
- Mock responses are provided for development testing
- Slack webhook is optional but recommended
- All tests can be automated with a shell script
