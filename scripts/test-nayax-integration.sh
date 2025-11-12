#!/bin/bash
# Pet Wash™ - Nayax Integration Test Script
# Ready for API key arrival tomorrow

BASE_URL="${1:-http://localhost:5000}"
API_KEY="${NAYAX_API_KEY:-}"

echo "🇮🇱 Nayax Israel Payment Integration Test"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:10}... (${#API_KEY} chars)"
echo ""

if [ -z "$API_KEY" ]; then
  echo "⚠️  NAYAX_API_KEY not set - Testing in DEMO MODE"
  echo "   Set NAYAX_API_KEY environment variable for live testing"
  echo ""
else
  echo "✅ NAYAX_API_KEY configured - LIVE MODE"
  echo ""
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Test 1: Authorize Payment
echo "TEST 1: Payment Authorization"
echo "------------------------------"
curl -X POST "$BASE_URL/api/payments/nayax/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "customerToken": "test_encrypted_token_12345",
    "terminalId": "STATION_001",
    "externalTransactionId": "test_txn_001"
  }' \
  -s | jq '.' || echo "Response not JSON"

echo ""
echo ""

# Test 2: Complete Wash Cycle
echo "TEST 2: Complete Wash Initiation"
echo "---------------------------------"
curl -X POST "$BASE_URL/api/payments/nayax/initiate-wash" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 75,
    "customerUid": "test_customer_123",
    "customerToken": "test_encrypted_token_67890",
    "washType": "DOGWASH_PREMIUM",
    "stationId": "STATION_001",
    "terminalId": "TERM_001"
  }' \
  -s | jq '.' || echo "Response not JSON"

echo ""
echo ""

# Test 3: QR Code Redemption
echo "TEST 3: QR Code Redemption"
echo "-------------------------"
curl -X POST "$BASE_URL/api/payments/nayax/redeem-qr" \
  -H "Content-Type: application/json" \
  -d '{
    "qrCode": "PETWASH_TEST_QR_001",
    "customerUid": "test_customer_123",
    "stationId": "STATION_001",
    "terminalId": "TERM_001"
  }' \
  -s | jq '.' || echo "Response not JSON"

echo ""
echo ""

# Test 4: Transaction Status
echo "TEST 4: Machine Status Check"
echo "----------------------------"
curl -X POST "$BASE_URL/api/payments/nayax/status" \
  -H "Content-Type: application/json" \
  -d '{
    "terminalId": "TERM_001"
  }' \
  -s | jq '.' || echo "Response not JSON"

echo ""
echo ""

# Test 5: Settlement
echo "TEST 5: Transaction Settlement"
echo "------------------------------"
curl -X POST "$BASE_URL/api/payments/nayax/settle" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "test_txn_001",
    "amount": 50
  }' \
  -s | jq '.' || echo "Response not JSON"

echo ""
echo ""

# Test 6: Void Transaction
echo "TEST 6: Void Transaction"
echo "-----------------------"
curl -X POST "$BASE_URL/api/payments/nayax/void" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "test_txn_001"
  }' \
  -s | jq '.' || echo "Response not JSON"

echo ""
echo ""
echo "=========================================="
echo "✅ Nayax Integration Test Complete"
echo ""
echo "NEXT STEPS FOR TOMORROW:"
echo "1. Get NAYAX_API_KEY from Nayax Israel"
echo "2. Get NAYAX_SECRET from Nayax Israel"
echo "3. Set environment variables in Replit"
echo "4. Restart server: npm run dev"
echo "5. Re-run this script: ./scripts/test-nayax-integration.sh"
echo "6. Monitor first live transactions"
echo ""
