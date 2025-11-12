# 🚀 Nayax Spark API Integration - Production Implementation
**Pet Wash™ - Real Payment Processing Integration**
**Date**: October 28, 2025

---

## 📋 Overview

This document captures the **production-ready Nayax Spark API integration** provided by the user, which replaces our previous Firestore-only simulation with real payment processing capabilities.

---

## 🎯 User's Production Code (Reference)

### Swift iOS Customer App

```swift
// --- MOBILE APP CLIENT (Swift for iOS) ---

struct WashResponse: Decodable {
    let success: Bool
    let message: String
}

func initiateWashFromApp(amount: Double, token: String, washType: String) {
    // 1. Prepare data to send to your Backend Server
    guard let url = URL(string: "https://yourserver.com/api/startWash") else { return }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body: [String: Any] = [
        "amount": amount,
        "customerToken": token,
        "washType": washType,
    ]
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)

    // 2. Call your Backend API
    URLSession.shared.dataTask(with: request) { data, response, error in
        if let data = data {
            if let result = try? JSONDecoder().decode(WashResponse.self, from: data) {
                DispatchQueue.main.async {
                    if result.success {
                        print("Wash cycle successfully requested.")
                        // Update UI: Show timer or 'Washing in progress'
                    } else {
                        print("Error: \(result.message)")
                        // Update UI: Show decline message
                    }
                }
            }
        }
    }.resume()
}

// Function to use QR reader for loyalty redemption
func scanQrCode(code: String) {
    // Call a separate backend function to handle the redemption logic
    // ... call backend API: /api/redeemQr ...
}
```

### Node.js Nayax Spark API Backend

```javascript
// --- BACKEND SERVER MODULE (Node.js) ---

const NAYAX_API_URL = "https://api.nayax.com/spark/v1"; // Example URL, check Nayax docs
const API_KEY = "YOUR_NAYAX_API_KEY";
const TERMINAL_ID = "YOUR_VPOS_TERMINAL_ID"; // The ID of the terminal on the K9000

// Function 1: Authorize Payment and Start the Wash (using Spark/Lynx)
async function startWashCycle(amount, customerToken, washType) {
    console.log(`Attempting to authorize ${amount} and start wash type: ${washType}`);

    // Step A: Initiate Payment Authorization via Spark API
    const authResponse = await fetch(`${NAYAX_API_URL}/payment/authorize`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            TerminalId: TERMINAL_ID,
            Amount: amount,
            Currency: "ILS",
            Token: customerToken, // Use a token for secure payment (stored after initial card swipe)
            ExternalTransactionId: Date.now()
        })
    });

    const authData = await authResponse.json();

    if (authData.Status === 'AUTHORIZED') {
        const transactionId = authData.TransactionId;

        // Step B: Send Remote Command (Remote Vend) to the Nayax Terminal
        // The terminal will communicate with the K9000 machine (e.g., via MDB or Marshall)
        const vendResponse = await fetch(`${NAYAX_API_URL}/device/remotevend`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                TerminalId: TERMINAL_ID,
                ProductCode: washType, // E.g., 'DOGWASH_PREMIUM'
                TransactionId: transactionId
            })
        });

        const vendData = await vendResponse.json();

        if (vendData.Status === 'SUCCESS') {
            // Step C: Confirm the transaction (Capture the fund)
            await fetch(`${NAYAX_API_URL}/payment/settle`, { /* ... */ });
            return { success: true, message: "Wash started successfully!" };
        } else {
            // If vend fails, must void/reverse the authorization (Step A)
            await fetch(`${NAYAX_API_URL}/payment/void`, { /* ... */ });
            return { success: false, message: "Payment authorized but machine failed to start." };
        }
    } else {
        return { success: false, message: "Payment Declined: " + authData.DeclineReason };
    }
}

// Function 2: Check Machine Status (using Lynx for Telemetry)
async function getMachineStatus() {
    const statusResponse = await fetch(`${NAYAX_API_URL}/device/status/${TERMINAL_ID}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const statusData = await statusResponse.json();
    return {
        isAvailable: statusData.State === 'Idle',
        temperature: statusData.Telemetry.WaterTemp
    };
}

// --- Loyalty/QR Redemption (using Cortina Logic via Server) ---
async function redeemQrCode(qrCode, terminalId) {
    // 1. Send QR code to your backend
    // 2. Your backend validates the QR code against your database
    // 3. If valid, send a command via Nayax API (e.g., Remote Vend or custom Cortina command)
    //    to the terminal to start the free/discounted wash.
    console.log(`Validating and initiating service via QR code ${qrCode}`);
    // ... API call to Nayax ...
}
```

---

## 🏗️ Architecture Analysis

### What This Provides That We Don't Have:

1. **Real Nayax Spark API Integration**
   - Actual authorize → remotevend → settle/void flow
   - Production payment processing (not simulation)
   - Proper transaction lifecycle management

2. **Customer Mobile App**
   - Swift iOS customer-facing app
   - QR code scanning for redemptions
   - Wash purchase interface

3. **Machine Telemetry**
   - Real-time status via Lynx API
   - Temperature monitoring
   - Availability checking

4. **Payment Flow Best Practices**
   - Authorize-first pattern
   - Auto-void on failure
   - External transaction tracking

---

## 🎯 Implementation Strategy (Per Architect)

### Phase 1: Backend Integration (TypeScript)

**Create**: `server/services/NayaxSparkService.ts`

Responsibilities:
- Authorize payment via Spark API
- Execute remote vend commands
- Settle successful transactions
- Void failed transactions
- Poll machine telemetry
- Handle QR redemptions

**Key Methods**:
```typescript
class NayaxSparkService {
  async authorizePayment(amount, customerToken, washType, stationId)
  async executeRemoteVend(transactionId, productCode, terminalId)
  async settleTransaction(transactionId)
  async voidTransaction(transactionId)
  async getMachineStatus(terminalId)
  async redeemQrCode(qrCode, terminalId)
}
```

### Phase 2: API Routes

**Create**: `server/routes/nayax-payments.ts`

Endpoints:
- `POST /api/payments/nayax/authorize` - Authorize payment
- `POST /api/payments/nayax/remote-vend` - Execute vend
- `POST /api/payments/nayax/capture` - Settle transaction
- `POST /api/payments/nayax/void` - Cancel transaction
- `GET /api/payments/nayax/status/:terminalId` - Machine status
- `POST /api/payments/nayax/redeem-qr` - QR redemption

### Phase 3: Database Schema

**Add to Firestore**:

```typescript
// Collection: nayax_transactions
interface NayaxTransaction {
  id: string;
  externalTransactionId: string;
  nayaxTransactionId?: string;
  status: 'initiated' | 'authorized' | 'vend_pending' | 'vend_success' | 'settled' | 'voided' | 'failed';
  amount: number;
  currency: 'ILS';
  washType: string;
  stationId: string;
  terminalId: string;
  customerUid: string;
  customerToken: string;
  createdAt: Timestamp;
  authorizedAt?: Timestamp;
  vendAttemptedAt?: Timestamp;
  settledAt?: Timestamp;
  voidedAt?: Timestamp;
  declineReason?: string;
  errorMessage?: string;
}

// Collection: nayax_telemetry
interface NayaxTelemetry {
  terminalId: string;
  state: 'Idle' | 'InUse' | 'OutOfService';
  waterTemp?: number;
  lastPingAt: Timestamp;
}

// Collection: customer_tokens (for secure payment)
interface CustomerToken {
  uid: string;
  nayaxToken: string;
  lastFourDigits: string;
  cardType: string;
  createdAt: Timestamp;
}
```

### Phase 4: Mobile Client Extension

**Extend React Native App** (not build Swift yet):

Add customer mode to `mobile-app/`:
- Wash purchase screen
- QR code scanner (react-native-camera)
- Receipt history
- Payment method management

Reuse existing API client patterns.

---

## 🔐 Security Considerations

### Environment Variables Needed:

```bash
NAYAX_API_URL=https://api.nayax.com/spark/v1
NAYAX_API_KEY=<secret>
NAYAX_TERMINAL_ID_MAIN=<terminal-id>
NAYAX_TERMINAL_ID_SECONDARY=<terminal-id>
```

### Security Requirements:
- ✅ API credentials server-side only (never exposed to clients)
- ✅ Customer tokens encrypted in database
- ✅ All payment state transitions logged to audit trail
- ✅ Device/customer token validation
- ✅ Rate limiting on payment endpoints
- ✅ Fraud detection integration

---

## 📊 Payment Flow Diagram

```
Customer App → Backend → Nayax Spark API → K9000 Terminal

1. Customer initiates wash
   ↓
2. Backend: Authorize payment (Spark API)
   ↓
3. If AUTHORIZED:
   - Backend: Execute remote vend (Spark API)
   - K9000: Start wash cycle
   ↓
4. If vend SUCCESS:
   - Backend: Settle transaction
   - Customer: Wash in progress
   
5. If vend FAILED:
   - Backend: Void authorization
   - Customer: Show error, refund issued
```

---

## 🧪 Testing Strategy

### Sandbox Testing:
1. Get Nayax sandbox credentials
2. Test authorize → vend → settle flow
3. Test authorize → vend fail → void flow
4. Test QR redemption
5. Test telemetry polling

### Production Testing:
1. Small-value test transactions
2. Monitor transaction logs
3. Verify settlement reconciliation
4. Test failure scenarios

---

## 📝 Migration from Current System

### Current State:
- ❌ Nayax loyalty tokens (Firestore simulation only)
- ❌ No real payment processing
- ❌ No machine telemetry

### After Implementation:
- ✅ Real Nayax Spark API integration
- ✅ Production payment processing
- ✅ Machine status monitoring
- ✅ QR redemption flow
- ✅ Customer mobile interface

---

## 🎯 Decision: React Native vs Swift

**Recommendation**: Extend React Native first

**Reasons**:
1. ✅ Code reuse (90% shared between employee/customer)
2. ✅ Single codebase for iOS/Android
3. ✅ Faster development
4. ✅ Existing auth/API client

**Future Consideration**:
- Build Swift app if App Store-specific needs arise
- User's Swift code informs native layer design
- Performance constraints may require native

---

## 📁 Files to Create/Modify

### New Files:
1. `server/services/NayaxSparkService.ts`
2. `server/routes/nayax-payments.ts`
3. `mobile-app/src/screens/customer/WashPurchaseScreen.tsx`
4. `mobile-app/src/screens/customer/QRScannerScreen.tsx`
5. `mobile-app/src/screens/customer/ReceiptHistoryScreen.tsx`

### Modified Files:
1. `server/routes.ts` - Register payment routes
2. `mobile-app/App.tsx` - Add customer routes
3. `mobile-app/src/api/petWashApi.ts` - Add payment methods

---

## ✅ Implementation Checklist

- [ ] Store user's code in documentation (this file)
- [ ] Design Firestore schema for transactions
- [ ] Implement NayaxSparkService
- [ ] Create payment API routes
- [ ] Add telemetry endpoint
- [ ] Integrate QR redemption
- [ ] Extend React Native for customer mode
- [ ] Test with Nayax sandbox
- [ ] Deploy to production

---

**Status**: ✅ User's code documented, ready for implementation

**Next Step**: Implement NayaxSparkService.ts with real Spark API integration

**Created**: October 28, 2025  
**Version**: 1.0.0
