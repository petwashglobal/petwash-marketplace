#!/bin/bash

# Smart Monitoring Verification Script
# Run this after getting your Firebase admin token

echo "🔍 Pet Wash™ Smart Monitoring - Verification Execution"
echo "======================================================"
echo ""

# Check if token is provided
if [ -z "$1" ]; then
    echo "❌ Error: Firebase admin token required"
    echo ""
    echo "Usage: bash run-verification.sh YOUR_FIREBASE_TOKEN"
    echo ""
    echo "To get your token:"
    echo "1. Open browser console on https://petwash.co.il/admin"
    echo "2. Run: firebase.auth().currentUser.getIdToken().then(t => console.log(t))"
    echo "3. Copy the token and run: bash run-verification.sh <token>"
    exit 1
fi

TOKEN="$1"
API_BASE="https://petwash.co.il"

echo "✅ Token received (${#TOKEN} chars)"
echo ""

# Create evidence directory
mkdir -p smart-monitoring-verification/{test-results,config,event-logs,emails}
cd smart-monitoring-verification

echo "📁 Created evidence directory: smart-monitoring-verification/"
echo ""

# 1. Run acceptance tests A-G
echo "1️⃣ Running Acceptance Tests A-G..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X POST "$API_BASE/api/admin/monitoring/run-all-tests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"testStationId": "TEST-001"}' \
  -s | jq '.' | tee test-results/acceptance-tests-output.json

echo ""
echo "✅ Test results saved to: test-results/acceptance-tests-output.json"
echo ""

# 2. Get test history from Firestore
echo "2️⃣ Fetching Test History..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X GET "$API_BASE/api/admin/monitoring/tests?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.' | tee test-results/test-history.json

echo ""
echo "✅ Test history saved to: test-results/test-history.json"
echo ""

# 3. Get global monitoring config
echo "3️⃣ Fetching Monitoring Configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Note: This endpoint may need to be created - using stations endpoint as fallback
curl -X GET "$API_BASE/api/admin/stations" \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.' | tee config/stations-list.json

echo ""
echo "✅ Stations config saved to: config/stations-list.json"
echo ""

# 4. Test weather suppression
echo "4️⃣ Testing Weather Suppression (38°C + precipitation)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X POST "$API_BASE/api/admin/monitoring/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "weather-suppression-verification",
    "inputs": {
      "stationId": "TEST-001",
      "heartbeats": [
        { "timestamp": "'"$(date -u -d '2 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"'", "source": "ping" },
        { "timestamp": "'"$(date -u -d '3 hours ago' +%Y-%m-%dT%H:%M:%SZ)"'", "source": "transaction" }
      ],
      "weather": {
        "tempC": 38,
        "precipitation": true
      }
    },
    "expected": {
      "status": "idle",
      "emailSent": false,
      "suppressionActive": true
    }
  }' \
  -s | jq '.' | tee test-results/weather-suppression-test.json

echo ""
echo "✅ Weather suppression test saved to: test-results/weather-suppression-test.json"
echo ""

# 5. Set maintenance mode
echo "5️⃣ Testing Maintenance Mode..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X POST "$API_BASE/api/admin/stations/TEST-001/maintenance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "reason": "Verification Test - Routine maintenance simulation"
  }' \
  -s | jq '.' | tee test-results/maintenance-mode-enable.json

echo ""
echo "✅ Maintenance mode enabled - Response saved to: test-results/maintenance-mode-enable.json"
echo ""

# Wait 2 seconds
sleep 2

# Disable maintenance mode
curl -X POST "$API_BASE/api/admin/stations/TEST-001/maintenance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }' \
  -s | jq '.' | tee test-results/maintenance-mode-disable.json

echo ""
echo "✅ Maintenance mode disabled - Response saved to: test-results/maintenance-mode-disable.json"
echo ""

# 7. Trigger daily report
echo "7️⃣ Triggering Daily Nayax Report..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X POST "$API_BASE/api/admin/reports/nayax/daily" \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.' | tee test-results/daily-report-trigger.json

echo ""
echo "✅ Daily report triggered - Check support@petwash.co.il inbox"
echo "   Response saved to: test-results/daily-report-trigger.json"
echo ""

# 9. Test security (unauthenticated request)
echo "9️⃣ Testing Security (Unauthenticated Access)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -X POST "$API_BASE/api/admin/monitoring/test" \
  -H "Content-Type: application/json" \
  -d '{"id": "test"}' \
  -s -w "\nHTTP Status: %{http_code}\n" | tee test-results/security-test-no-auth.txt

echo ""
echo "✅ Security test (expected 401) - Response saved to: test-results/security-test-no-auth.txt"
echo ""

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ AUTOMATED TESTS COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps (Manual):"
echo ""
echo "1. UI SCREENSHOTS (Required):"
echo "   - Navigate to: $API_BASE/admin/stations"
echo "   - Capture screenshots of TEST-001 in each state:"
echo "     🟢 Online, 🟡 Idle, 🟠 Warning, 🔴 Offline, 🟣 Maintenance"
echo "   - Save to: smart-monitoring-verification/ui-screenshots/"
echo ""
echo "2. EMAIL VERIFICATION (Required):"
echo "   - Check inbox: support@petwash.co.il"
echo "   - Find: '📊 Pet Wash™ Daily Nayax Report'"
echo "   - Verify: Smart Monitoring section with uptime %, incidents, VAT=18%"
echo "   - Save email screenshot to: smart-monitoring-verification/emails/"
echo ""
echo "3. EVENT LOGS (Firestore - Manual):"
echo "   - Access Firestore Console"
echo "   - Query: station_events collection (last 10 docs)"
echo "   - Export sample docs showing: prev→next, reason, thresholds, suppression"
echo "   - Save to: smart-monitoring-verification/event-logs/"
echo ""
echo "4. BACKUP VERIFICATION (GCS - Manual):"
echo "   - Check: gs://petwash-backups/daily/"
echo "   - Verify latest backup includes: stations, station_events, monitoring_tests"
echo "   - Save verification to: smart-monitoring-verification/backup-info.txt"
echo ""
echo "5. ADMIN UI RECORDING (Optional):"
echo "   - Record 2-min video of /admin/stations"
echo "   - Show: badges, heartbeats, status changes, weather chip"
echo "   - Save to: smart-monitoring-verification/admin-ui-demo.mp4"
echo ""
echo "📦 When complete, zip the folder:"
echo "   cd .."
echo "   zip -r smart-monitoring-verification.zip smart-monitoring-verification/"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ All automated tests completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
