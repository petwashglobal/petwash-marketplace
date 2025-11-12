# 🎛️ K9000 Backend Dashboard Control Panel API
## Admin Endpoints for Real-Time Station Management

---

## 📋 **Overview**

Complete backend API for managing 4 K9000 wash bays remotely via cloud. **Admin-only access** with rate limiting and audit trail logging.

**Hardware:** 2x K9000 Twin Units = 4 Total Wash Bays
- K9000-TWIN-UNIT-1-BAY-1 (Main Station - Left Bay)
- K9000-TWIN-UNIT-1-BAY-2 (Main Station - Right Bay)
- K9000-TWIN-UNIT-2-BAY-1 (Secondary Station - Left Bay)
- K9000-TWIN-UNIT-2-BAY-2 (Secondary Station - Right Bay)

---

## 🔐 **Authentication**

All endpoints require **admin authentication**:
```http
Authorization: Bearer <admin-firebase-token>
Cookie: pw_session=<session-cookie>
```

Rate limit: **200 requests per 15 minutes** (admin limiter)

---

## 📊 **API Endpoints**

### **1. Get All Stations Status**
**Real-time dashboard overview of all K9000 wash bays**

```http
GET /api/k9000/dashboard/stations
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-10-28T10:00:00.000Z",
  "totalStations": 4,
  "stations": [
    {
      "stationId": "K9000-TWIN-UNIT-1-BAY-1",
      "unitNumber": 1,
      "bayNumber": 1,
      "location": "Main Station - Left Bay",
      "terminalId": "NAYAX_TERMINAL_K9000_U1_B1",
      "status": "washing",
      "lastSeen": "2025-10-28T09:58:30.000Z",
      "washesToday": 12,
      "supplyLevels": {
        "shampoo": 85,
        "conditioner": 72,
        "fleaRinse": 100,
        "disinfectant": 100,
        "salt": 25,
        "filterStatus": "clean"
      },
      "alerts": [],
      "telemetry": {
        "waterPressure": "6.2",
        "waterTemp": "35",
        "state": "washing",
        "errorCode": "0"
      }
    },
    {
      "stationId": "K9000-TWIN-UNIT-1-BAY-2",
      "status": "online",
      "washesToday": 8,
      "supplyLevels": {
        "shampoo": 15,
        "conditioner": 18,
        "salt": 3
      },
      "alerts": ["Low Shampoo", "Low Conditioner", "Low Salt - Water Softener"]
    }
  ],
  "summary": {
    "online": 2,
    "washing": 1,
    "offline": 1,
    "error": 0,
    "totalWashesToday": 35
  }
}
```

**Use Case:** Real-time dashboard - see which machines are on/off/washing/error

---

### **2. Emergency Stop Machine**
**Remotely stop a specific wash bay (emergency control)**

```http
POST /api/k9000/dashboard/stop
```

**Request Body:**
```json
{
  "stationId": "K9000-TWIN-UNIT-1-BAY-1",
  "reason": "Customer emergency / Malfunction detected / Maintenance required"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Station K9000-TWIN-UNIT-1-BAY-1 stopped successfully",
  "stationId": "K9000-TWIN-UNIT-1-BAY-1",
  "timestamp": "2025-10-28T10:00:00.000Z"
}
```

**What Happens:**
1. ✅ Sends stop command to K9000 hardware (via Nayax API)
2. ✅ Logs action to blockchain audit ledger
3. ✅ Sends SMS alert to technician (Twilio)
4. ✅ Records admin user, IP address, timestamp

**Use Case:** Emergency situations, customer complaints, mechanical issues

---

### **3. Get Salt & Supply Reports**
**Detailed chemical/salt levels for all stations**

```http
GET /api/k9000/dashboard/salt-report
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-10-28T10:00:00.000Z",
  "stations": [
    {
      "stationId": "K9000-TWIN-UNIT-1-BAY-1",
      "location": "Main Station - Left Bay",
      "timestamp": "2025-10-28T09:58:30.000Z",
      "supplies": {
        "shampoo": {
          "level": 85,
          "unit": "%",
          "status": "ok",
          "estimatedDaysLeft": 59
        },
        "conditioner": {
          "level": 72,
          "unit": "%",
          "status": "ok",
          "estimatedDaysLeft": 50
        },
        "salt": {
          "level": 25,
          "unit": "kg",
          "status": "ok",
          "estimatedDaysLeft": 87
        },
        "fleaRinse": {
          "level": 100,
          "unit": "%",
          "status": "ok",
          "estimatedDaysLeft": 30
        },
        "disinfectant": {
          "level": 100,
          "unit": "%",
          "status": "ok",
          "estimatedDaysLeft": 30
        }
      },
      "filterStatus": {
        "status": "clean",
        "lastReplacement": "2025-10-21T00:00:00.000Z",
        "nextReplacementDue": "2025-11-20T00:00:00.000Z"
      }
    },
    {
      "stationId": "K9000-TWIN-UNIT-1-BAY-2",
      "supplies": {
        "shampoo": {
          "level": 15,
          "status": "low",
          "estimatedDaysLeft": 10
        },
        "salt": {
          "level": 3,
          "status": "critical",
          "estimatedDaysLeft": 10
        }
      }
    }
  ],
  "alerts": [
    {
      "stationId": "K9000-TWIN-UNIT-1-BAY-2",
      "location": "Main Station - Right Bay",
      "issues": ["Low Shampoo", "Low Conditioner", "CRITICAL: Low Salt"]
    }
  ]
}
```

**Use Case:** Inventory management, order supplies before they run out

---

### **4. Apply Discount to Station**
**Apply promotional discount or one-off coupon to specific hardware unit**

```http
POST /api/k9000/dashboard/apply-discount
```

**Request Body:**
```json
{
  "stationId": "K9000-TWIN-UNIT-1-BAY-1",
  "discountType": "percentage",
  "discountValue": 20,
  "expiresAt": "2025-11-28T23:59:59.000Z",
  "oneTimeCode": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Discount applied successfully",
  "discount": {
    "id": "disc_abc123",
    "stationId": "K9000-TWIN-UNIT-1-BAY-1",
    "discountType": "percentage",
    "discountValue": 20,
    "couponCode": "K9000-A7B9C2D1",
    "expiresAt": "2025-11-28T23:59:59.000Z",
    "active": true,
    "createdAt": "2025-10-28T10:00:00.000Z",
    "createdBy": "admin_uid_123"
  },
  "couponCode": "K9000-A7B9C2D1"
}
```

**Discount Types:**
- `percentage` - Discount by percentage (e.g., 20% off)
- `fixed_amount` - Fixed amount off (e.g., ₪10 off)
- `free_wash` - Completely free wash (₪0)

**Use Cases:**
- Grand opening promotions
- Birthday vouchers
- Compensation for service issues
- One-time redemption codes

---

### **5. Get Station Statistics**
**Cloud-based vital stats (revenue, washes, uptime)**

```http
GET /api/k9000/dashboard/stats?period=24h
```

**Query Params:**
- `period`: `1h` | `24h` | `7d` | `30d` (default: `24h`)

**Response:**
```json
{
  "success": true,
  "period": "24h",
  "startTime": "2025-10-27T10:00:00.000Z",
  "endTime": "2025-10-28T10:00:00.000Z",
  "stations": [
    {
      "stationId": "K9000-TWIN-UNIT-1-BAY-1",
      "location": "Main Station - Left Bay",
      "period": "24h",
      "metrics": {
        "totalWashes": 12,
        "revenue": 480,
        "avgWashDuration": 12,
        "uptimePercent": 98.5,
        "utilizationRate": 12
      }
    }
  ],
  "aggregated": {
    "totalWashes": 35,
    "totalRevenue": 1400,
    "avgUptimePercent": 97.8
  }
}
```

**Use Case:** Performance monitoring, revenue tracking, capacity planning

---

### **6. Send Maintenance Alert**
**Push notification for maintenance issues (SMS + future FCM)**

```http
POST /api/k9000/dashboard/send-maintenance-alert
```

**Request Body:**
```json
{
  "stationId": "K9000-TWIN-UNIT-1-BAY-1",
  "alertType": "filter_clogged",
  "message": "Triple hair filtration showing high backpressure - needs immediate cleaning",
  "severity": "critical"
}
```

**Severity Levels:**
- `critical` 🚨 - Immediate action required
- `warning` ⚠️ - Should be addressed soon
- `info` ℹ️ - Informational only

**Response:**
```json
{
  "success": true,
  "message": "Alert sent successfully",
  "alertType": "filter_clogged",
  "timestamp": "2025-10-28T10:00:00.000Z"
}
```

**What Happens:**
1. ✅ Sends SMS to technician (Twilio)
2. ✅ (Future) Sends push notification via Firebase Cloud Messaging
3. ✅ Logs to audit trail
4. ✅ Records timestamp and severity

**Alert Types:**
- `filter_clogged` - Hair filtration needs cleaning
- `low_supplies` - Chemical levels critical
- `pump_failure` - Pump maintenance required
- `water_pressure_low` - Water system issue
- `temperature_high` - Overheating detected

---

### **7. Get Station Details by ID**
**Complete info for specific station (telemetry, transactions, lifetime stats)**

```http
GET /api/k9000/dashboard/station/:stationId
```

**Example:**
```http
GET /api/k9000/dashboard/station/K9000-TWIN-UNIT-1-BAY-1
```

**Response:**
```json
{
  "success": true,
  "station": {
    "stationId": "K9000-TWIN-UNIT-1-BAY-1",
    "unitNumber": 1,
    "bayNumber": 1,
    "location": "Main Station - Left Bay",
    "terminalId": "NAYAX_TERMINAL_K9000_U1_B1",
    "status": "online",
    "identification": {
      "uniqueId": "K9000-TWIN-UNIT-1-BAY-1",
      "unitNumber": 1,
      "bayNumber": 1,
      "terminalId": "NAYAX_TERMINAL_K9000_U1_B1"
    },
    "lifetimeStats": {
      "totalWashes": 1247,
      "totalRevenue": 49880,
      "firstWash": "2025-01-15T08:30:00.000Z"
    },
    "recentTelemetry": [
      {
        "timestamp": "2025-10-28T09:58:30.000Z",
        "waterPressure": "6.2",
        "waterTemp": "35",
        "shampooLevel": "85",
        "conditionerLevel": "72",
        "state": "idle",
        "errorCode": "0"
      }
    ],
    "recentTransactions": [
      {
        "id": "tx_abc123",
        "amount": 40,
        "status": "settled",
        "createdAt": "2025-10-28T09:45:00.000Z",
        "program": "standard"
      }
    ]
  }
}
```

**Use Case:** Deep dive into specific station performance, troubleshooting

---

## 🚀 **IoT Hardware Endpoints (Machine-to-Server)**

These endpoints are called **by the K9000 hardware** (IP-whitelisted):

### **Start Wash Cycle**
```http
POST /api/k9000/wash/start_cycle
```

**Request (from K9000 controller):**
```json
{
  "machineId": "K9000-TWIN-UNIT-1-BAY-1",
  "transactionId": "tx_nayax_123",
  "selectedProgram": "standard",
  "qrCode": "LOYALTY_GOLD_user123",
  "customerUid": "firebase_uid_abc"
}
```

**Security:**
1. ✅ IP whitelist validation (only K9000 IPs allowed)
2. ✅ Machine secret key validation
3. ✅ Payment verification via Nayax
4. ✅ Loyalty tier check & discount application

**Response:**
```json
{
  "success": true,
  "message": "Wash cycle started successfully",
  "washId": "wash_xyz789",
  "discount": {
    "applied": true,
    "type": "loyalty",
    "tier": "gold",
    "discountPercent": 15,
    "originalPrice": 40,
    "finalPrice": 34,
    "savings": 6
  },
  "estimatedDuration": 12
}
```

---

### **Get Station Status (Real-Time)**
```http
GET /api/k9000/status/:machineId
```

**Response:**
```json
{
  "success": true,
  "machineId": "K9000-TWIN-UNIT-1-BAY-1",
  "status": "washing",
  "currentProgram": "standard",
  "timeRemaining": 480,
  "telemetry": {
    "waterPressure": 6.2,
    "waterTemp": 35,
    "pumpStatus": "running",
    "errorCode": 0
  }
}
```

---

## 🎁 **QR E-Gift Redemption (Public-Facing)**

### **Redeem E-Gift at Station**
```http
POST /api/k9000/redeem-gift
```

**Request (scanned QR code):**
```json
{
  "qrCode": "EGIFT-ABC123-XYZ789",
  "stationId": "K9000-TWIN-UNIT-1-BAY-1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "E-gift redeemed successfully! Enjoy your free wash!",
  "giftType": "birthday_voucher",
  "value": 40,
  "washProgram": "premium",
  "washId": "wash_free_123"
}
```

**What Happens:**
1. ✅ Validates QR code authenticity
2. ✅ Checks expiration date
3. ✅ Prevents double-redemption (blockchain audit)
4. ✅ Immediately triggers wash cycle (no payment)
5. ✅ Logs to audit trail for fraud prevention

---

## 🔒 **Security Features**

### **IP Whitelisting (K9000 Hardware)**
Only requests from these IPs are allowed for IoT endpoints:
```
203.0.113.10  # K9000 Twin Unit 1 (Bays 1 & 2)
203.0.113.20  # K9000 Twin Unit 2 (Bays 1 & 2)
```

### **Audit Trail Logging**
Every action is logged to blockchain-style immutable ledger:
- Who: Admin user UID
- What: Action taken (stop_machine, apply_discount, etc.)
- When: Timestamp (ISO 8601)
- Where: IP address, user agent
- Why: Reason/details

### **Rate Limiting**
- Admin endpoints: 200 req/15min
- Public endpoints: 100 req/15min
- IoT endpoints: No limit (trusted IPs only)

---

## 📱 **Maintenance Push Notifications**

### **SMS Alerts (Twilio)**
Automatically sent to technician for:
- 🚨 **CRITICAL**: Pump failure imminent (AI prediction)
- ⚠️ **WARNING**: Low supplies (salt, shampoo, conditioner)
- ℹ️ **INFO**: Filter needs replacement (30-day cycle)

### **Future: Firebase Cloud Messaging (FCM)**
Push notifications to technician mobile app:
- Real-time alerts
- Rich media (photos, videos)
- Two-way communication
- Acknowledgment tracking

---

## 💰 **Discount & Coupon System**

### **Discount Application Methods**

1. **Loyalty Tier Discounts** (Automatic)
   - Silver: 10% off (5+ washes)
   - Gold: 15% off (15+ washes)
   - Platinum: 20% off (30+ washes)
   - Diamond: 25% off (50+ washes)

2. **Station-Specific Discounts**
   - Apply to specific K9000 bay
   - Time-limited (expiration date)
   - One-time or multi-use

3. **One-Off Coupon Codes**
   - Unique 8-character code: `K9000-A7B9C2D1`
   - Single redemption only
   - Tracked in blockchain audit ledger
   - Prevents fraud & double-spending

---

## 🆔 **Unique Station Identification**

Each K9000 wash bay has:
- **Station ID**: `K9000-TWIN-UNIT-{1|2}-BAY-{1|2}`
- **Unit Number**: 1 or 2 (which Twin unit)
- **Bay Number**: 1 or 2 (left or right bay)
- **Terminal ID**: Nayax QR reader identifier
- **IP Address**: Static IP for security (optional)

**Cloud Sync:** All station data stored in PostgreSQL with real-time telemetry updates

---

## 📊 **Example Dashboard Workflow**

### **Morning Routine: Check All Stations**
```bash
# 1. Get overview
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://petwash.co.il/api/k9000/dashboard/stations

# 2. Check salt levels
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://petwash.co.il/api/k9000/dashboard/salt-report

# 3. Review yesterday's stats
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://petwash.co.il/api/k9000/dashboard/stats?period=24h
```

### **Emergency: Stop Malfunctioning Machine**
```bash
curl -X POST https://petwash.co.il/api/k9000/dashboard/stop \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "K9000-TWIN-UNIT-1-BAY-2",
    "reason": "Pump making unusual noise - customer reported"
  }'
```

### **Promotion: Apply 50% Discount**
```bash
curl -X POST https://petwash.co.il/api/k9000/dashboard/apply-discount \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "K9000-TWIN-UNIT-1-BAY-1",
    "discountType": "percentage",
    "discountValue": 50,
    "expiresAt": "2025-10-29T23:59:59.000Z",
    "oneTimeCode": true
  }'
```

---

## 🎯 **Next Steps**

1. **Configure K9000 IP Addresses**
   - Add to Replit Secrets: `ALLOWED_MACHINE_IPS=203.0.113.10,203.0.113.20`
   - Generate machine secret: `MACHINE_SECRET_KEY=<random-hex-32>`

2. **Set Up Technician Alerts**
   - Add to Replit Secrets: `TECH_PHONE_NUMBER=+972555551234`
   - Test SMS delivery with Twilio

3. **Test Dashboard Access**
   - Log in as admin
   - Access: `https://petwash.co.il/api/k9000/dashboard/stations`
   - Verify real-time data

4. **Enable QR Redemption**
   - Generate test e-gift QR codes
   - Scan at Nayax reader
   - Confirm wash activation

---

## 📞 **Support**

- **API Issues**: Support@petwash.co.il
- **Hardware Issues**: +972-54-9833355 (Pet Wash™ Tech Line)
- **Emergency Stop**: Available 24/7 via dashboard

**Your K9000 fleet is now fully cloud-managed!** 🚀
