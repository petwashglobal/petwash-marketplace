# Pet Wash™ Load Testing Suite

Comprehensive load testing framework for validating Pet Wash™ platform performance with 500+ concurrent users.

## 📋 Overview

This testing suite implements the **3-phase load testing strategy**:
- **Phase 1**: Individual service baseline testing (100 RPS per service)
- **Phase 2**: Multi-role realistic user simulation (500 concurrent users)
- **Phase 3**: Full browser E2E testing with Playwright

## 🛠️ Prerequisites

### Install k6
```bash
# macOS
brew install k6

# Linux (Ubuntu/Debian)
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## 🚀 Running Tests

### Phase 1: Individual Services (Current)

Run all Phase 1 tests:
```bash
chmod +x load-tests/run-all-phase1.sh
./load-tests/run-all-phase1.sh
```

Run individual tests:
```bash
k6 run load-tests/phase1-auth-test.js
k6 run load-tests/phase1-booking-test.js
k6 run load-tests/phase1-payments-test.js
k6 run load-tests/phase1-gps-test.js
k6 run load-tests/phase1-k9000-iot-test.js
```

### Custom base URL:
```bash
BASE_URL=https://your-domain.com ./load-tests/run-all-phase1.sh
```

## 📊 Test Specifications

### Phase 1 Tests

#### 1. Auth Service (`phase1-auth-test.js`)
- **Target**: 100 RPS
- **Duration**: 7 minutes
- **Endpoints**:
  - `/api/config/firebase` - Firebase configuration
  - `/api/auth/firebase-admin-test` - Admin auth validation
- **Thresholds**:
  - P95 response time < 500ms
  - Error rate < 5%

#### 2. Booking Services (`phase1-booking-test.js`)
- **Target**: 100 RPS
- **Duration**: 7 minutes
- **Endpoints**:
  - `/api/k9000/stations` - K9000 wash stations
  - `/api/sitter-suite/sitters` - Pet sitter profiles
  - `/api/walk-my-pet/walkers` - Dog walker profiles
- **Thresholds**:
  - P95 response time < 500ms
  - Error rate < 5%

#### 3. Payment Processing (`phase1-payments-test.js`)
- **Target**: 50 RPS (more resource-intensive)
- **Duration**: 7 minutes
- **Endpoints**:
  - `/api/nayax-payments/config` - Payment configuration
  - `/api/loyalty/tiers` - Loyalty program tiers
- **Thresholds**:
  - P95 response time < 1000ms (payments can take longer)
  - Error rate < 5%

#### 4. GPS Tracking (`phase1-gps-test.js`)
- **Target**: 100 RPS (real-time)
- **Duration**: 7 minutes
- **Endpoints**:
  - `/api/walk-my-pet/active-walks` - Active dog walks
  - `/api/pettrek/active-trips` - Active transport trips
- **Thresholds**:
  - P95 response time < 100ms (real-time must be fast!)
  - Error rate < 5%

#### 5. K9000 IoT Monitoring (`phase1-k9000-iot-test.js`)
- **Target**: 50 RPS (IoT polling)
- **Duration**: 7 minutes
- **Endpoints**:
  - `/api/k9000/stations/status` - Station status
  - `/api/k9000/telemetry` - Real-time telemetry
  - `/api/k9000/supplies` - Supply reports
- **Thresholds**:
  - P95 response time < 200ms
  - Error rate < 5%

## 📈 Performance Goals

### Response Time Targets
- **Page loads**: < 2 seconds
- **API responses**: < 500ms (P95)
- **Database queries**: < 100ms (average)
- **WebSocket updates**: < 50ms latency
- **Real-time GPS**: < 100ms (P95)

### Reliability Targets
- **Error rate**: < 5%
- **Checkout completion**: > 95%
- **System uptime**: 99.9%

## 📁 Results

Test results are saved in `load-tests/results/`:
- `phase1-auth-results.json`
- `phase1-booking-results.json`
- `phase1-payments-results.json`
- `phase1-gps-results.json`
- `phase1-k9000-results.json`

## 🔍 Reading Results

Each JSON result file contains:
- **HTTP metrics**: Request duration (avg, min, max, P95, P99)
- **Request counts**: Total requests, requests/second
- **Error rates**: Failed requests percentage
- **Check results**: Pass/fail for each test assertion

### Key Metrics to Monitor:
1. **http_req_duration (P95)**: Should be under threshold
2. **http_req_failed (rate)**: Should be < 0.05 (5%)
3. **checks**: All should pass
4. **iterations**: Total test iterations completed

## 🚦 Next Phases

### Phase 2: Multi-Role Simulation (Coming Soon)
- 500 concurrent users across 6 roles
- Realistic usage patterns
- Staggered arrival rates
- Shared session/context
- Full transaction flows

### Phase 3: Browser E2E Testing (Coming Soon)
- Playwright-powered real browser tests
- Complete user journeys
- Registration → Booking → Payment flows
- WebAuthn/biometric sign-in
- E-gift card purchases

## 🐛 Troubleshooting

### k6 not found
Install k6 using the commands above.

### Connection refused
Ensure your Pet Wash™ server is running:
```bash
npm run dev
```

### High error rates
Check server logs for issues:
```bash
# View workflow logs in Replit
# Or check console output
```

## 📞 Support

For questions about load testing:
- Review the architect's comprehensive plan in the project documentation
- Check server logs for performance bottlenecks
- Monitor database connection pool usage
- Verify Redis cache hit rates

## ✅ Acceptance Criteria

Phase 1 tests PASS when:
- ✅ All services handle 50-100 RPS
- ✅ P95 response times under thresholds
- ✅ Error rates < 5%
- ✅ No server crashes or memory leaks
- ✅ Database performs well under load

---

**Note**: These tests simulate API-level load. Full browser testing (Phase 3) will provide end-to-end validation with real user interactions.
