# Nayax Cortina Dynamic QR Integration
**Pet Wash™ - Advanced QR Redemption with Real-Time Callbacks**  
**Date**: October 28, 2025  
**Source**: User-provided production code

---

## Overview

This document describes the **Cortina Dynamic QR API** approach, which differs from our static QR implementation. With Dynamic QR, the Nayax server calls YOUR server in real-time during the QR scan to validate and authorize the redemption.

---

## Comparison: Static vs Dynamic QR

### Static QR (Current Implementation)
- Customer scans QR → Mobile app → Our API → Validate → Remote vend
- QR code contains all info (TYPE:ID:AMOUNT)
- We control the entire flow
- Simple, fast, no Nayax callback dependency

### Dynamic QR (Cortina API - This File)
- Customer scans QR at machine → Nayax reads it → **Nayax calls OUR server** → We approve/decline → Nayax starts wash
- QR code contains only loyalty ID
- Nayax validates in real-time
- More secure, prevents offline redemptions
- Requires webhook endpoint

---

## Dynamic QR Flow

```
Customer scans QR at K9000
    ↓
Nayax Reader detects QR
    ↓
Nayax Server calls YOUR webhook
    ↓
Your Server:
  - Check loyalty DB
  - Validate balance
  - Approve/Decline
    ↓
Nayax receives response
    ↓
IF APPROVED → Start wash
IF DECLINED → Show error
```

---

## Implementation Code (From User)

### A. Dynamic QR Redemption Webhook

```python
# Configuration (Obtained from Nayax Developer Hub)
NAYAX_API_KEY = "YOUR_SECURE_API_KEY"
CORTINA_INQUIRY_URL = "https://api.nayax.com/cortina/dynamicqr/inquiry" 
K9000_LOYALTY_DB = connect_to_loyalty_database() 

def handle_nayax_qr_inquiry(request_data):
    """
    Function triggered by Nayax Server after a user scans a QR code.
    It checks our custom loyalty database for redemption and authorizes the vend.
    """
    transaction_id = request_data.get('transactionId')
    qr_code_id = request_data.get('qrCodeData') # This is the e-gift/loyalty ID
    requested_amount = request_data.get('amount')
    machine_id = request_data.get('deviceId')

    print(f"--- Received Inquiry for TX {transaction_id} on K9000 {machine_id} ---")

    # --- YOUR CUSTOM LOYALTY/E-GIFT LOGIC ---
    redemption_status, available_balance = K9000_LOYALTY_DB.check_balance(qr_code_id)
    
    # Authorization Logic
    if redemption_status == "VALID" and available_balance >= requested_amount:
        # Deduct from e-gift/loyalty balance
        K9000_LOYALTY_DB.process_deduction(qr_code_id, requested_amount)
        
        # Send Success Response back to Nayax (This starts the K9000 wash)
        nayax_response = {
            "ResponseCode": "000",
            "TransactionStatus": "APPROVED",
            "AuthCode": "LOYALTY-AUTH-" + str(transaction_id)
        }
        return nayax_response
    else:
        # Send Decline Response
        nayax_response = {
            "ResponseCode": "051", # Insufficient funds/Invalid
            "TransactionStatus": "DECLINED",
            "StatusMessage": "Insufficient Loyalty Balance or Invalid Coupon"
        }
        return nayax_response
```

### B. Enhanced Device Monitoring

```python
# API Endpoints for Reporting (Lynx API / Management APIs)
LYNX_GET_DEVICE_URL = "https://api.nayax.com/lynx/v1/devices/{device_id}" 
LYNX_GET_TRANSACTIONS_URL = "https://api.nayax.com/lynx/v1/transactions" 

def monitor_nayax_device_health(device_id):
    """
    Retrieves the physical health status of the Nayax Reader.
    """
    response = requests.get(LYNX_GET_DEVICE_URL.format(device_id=device_id), 
                            headers={"Authorization": f"Bearer {NAYAX_API_KEY}"})
    
    if response.status_code == 200:
        data = response.json()
        print(f"Device ID {device_id} Status: {data.get('ConnectionStatus')}")
        print(f"Last Firmware: {data.get('FirmwareVersion')}")
        if data.get('ConnectionStatus') != 'Online':
             send_alert_to_maintenance("Nayax Reader is offline!")
        return data
    else:
        print(f"Error retrieving device health: {response.text}")
        return None

def report_failed_transactions():
    """
    Pulls recent transactions to check for failed attempts.
    """
    response = requests.get(LYNX_GET_TRANSACTIONS_URL, 
                            params={'status': 'DECLINED', 'timeframe': '24h'},
                            headers={"Authorization": f"Bearer {NAYAX_API_KEY}"})
    
    if response.status_code == 200:
        declined_transactions = response.json()
        for tx in declined_transactions:
            reason_code = tx.get('declineReasonCode')
            if reason_code in ["005", "041", "043"]: # Do Not Honor, Lost Card, Stolen Card
                print(f"--- FRAUD ALERT --- Transaction ID {tx.get('id')} declined for security reason: {reason_code}")
        return len(declined_transactions)
    else:
        print("Error retrieving transaction report.")
        return 0
```

### C. Loyalty Card Creation

```python
LYNX_CREATE_CARD_URL = "https://api.nayax.com/lynx/v1/cards"

def create_nayax_loyalty_id(customer_name, unique_loyalty_id):
    """
    Creates a new 'card' entry in the Nayax Core system to represent the loyalty ID.
    This ensures Nayax can recognize the ID when it's scanned.
    """
    card_data = {
        "CardHolderName": customer_name,
        "CardUniqueIdentifier": unique_loyalty_id,
        "CardType": 33, # Prepaid Card type
        "CardPhysicalType": 943237560 # QR Code type
    }
    
    response = requests.post(LYNX_CREATE_CARD_URL, 
                             json=card_data,
                             headers={"Authorization": f"Bearer {NAYAX_API_KEY}"})
    
    if response.status_code == 201:
        print(f"Successfully created Nayax ID for {customer_name}.")
        return response.json()
    else:
        print(f"Failed to create Nayax ID: {response.text}")
        return None
```

---

## Integration Recommendations

### What to Add to Pet Wash™

1. **Dynamic QR Webhook** (High Priority)
   - Add webhook endpoint: `POST /api/payments/nayax/cortina/inquiry`
   - Handle Nayax real-time callbacks
   - More secure than static QR for high-value redemptions

2. **Loyalty Card Creation** (Medium Priority)
   - Add service method to create Nayax loyalty IDs
   - Integrate with existing loyalty program
   - Enable QR-based loyalty at K9000 machines

3. **Enhanced Device Monitoring** (Low Priority - Already Implemented)
   - We already have basic telemetry
   - Can add firmware version tracking
   - Can add fraud detection based on decline codes

---

## TypeScript Implementation (Proposed)

### Dynamic QR Webhook Handler

```typescript
// server/routes/nayax-payments.ts

/**
 * POST /api/payments/nayax/cortina/inquiry
 * Webhook endpoint for Nayax Cortina Dynamic QR
 */
router.post('/cortina/inquiry', async (req, res) => {
  try {
    const {
      transactionId,
      qrCodeData,
      amount,
      deviceId,
    } = req.body;

    logger.info('[Nayax Cortina] Dynamic QR inquiry received', {
      transactionId,
      deviceId,
      amount,
    });

    // Check loyalty balance
    const loyaltyResult = await LoyaltyService.checkBalance(qrCodeData);

    if (loyaltyResult.isValid && loyaltyResult.balance >= amount) {
      // Deduct from balance
      await LoyaltyService.processDeduction(qrCodeData, amount);

      // Approve transaction
      res.json({
        ResponseCode: '000',
        TransactionStatus: 'APPROVED',
        AuthCode: `LOYALTY-AUTH-${transactionId}`,
      });
    } else {
      // Decline transaction
      res.json({
        ResponseCode: '051',
        TransactionStatus: 'DECLINED',
        StatusMessage: 'Insufficient Loyalty Balance or Invalid Coupon',
      });
    }
  } catch (error: any) {
    logger.error('[Nayax Cortina] Inquiry failed', { error: error.message });
    res.status(500).json({
      ResponseCode: '096',
      TransactionStatus: 'ERROR',
      StatusMessage: 'System error',
    });
  }
});
```

---

## Benefits of Dynamic QR

1. **More Secure**
   - Real-time validation at machine
   - Prevents offline QR code abuse
   - No QR code cloning risk

2. **Better UX**
   - Customer just scans at machine
   - No mobile app required
   - Instant wash start

3. **Fraud Prevention**
   - Balance checked in real-time
   - Can't use expired/invalid codes
   - Transaction logged immediately

---

## When to Use Static vs Dynamic

### Use Static QR (Current Implementation)
- Mobile app redemptions
- Pre-purchase vouchers
- Promotional campaigns
- Customer controls timing

### Use Dynamic QR (Cortina API)
- At-machine redemptions
- Loyalty program integration
- High-security redemptions
- No mobile app required

---

## Next Steps

1. **Test Static QR** (Current) - Works with mobile app
2. **Add Dynamic QR** (Cortina) - For at-machine use
3. **Implement Card Creation** - For loyalty program
4. **Both systems can coexist** - Different use cases

---

## Architect's Notes

This code reveals the **Cortina Dynamic QR API**, which complements our static QR implementation perfectly:

- **Static QR** = Mobile app flow (what we built)
- **Dynamic QR** = At-machine flow (what this adds)

Both are valuable and serve different use cases. The webhook approach is more secure for at-machine redemptions, while static QR is better for mobile-first experiences.

The loyalty card creation API is also valuable - we should integrate it to allow creating Nayax-compatible loyalty IDs that can be scanned at any K9000 machine.

**Recommendation**: Add Dynamic QR as Phase 2 enhancement after current implementation is tested.
