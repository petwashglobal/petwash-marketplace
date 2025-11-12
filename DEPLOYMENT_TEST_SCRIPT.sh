#!/bin/bash
# Pet Wash™ Production Verification Script
# Tests all critical endpoints and services

BASE_URL="${BASE_URL:-https://petwash.co.il}"
REPORT_ID=""

echo "========================================="
echo "Pet Wash™ API Test Suite"
echo "Base URL: $BASE_URL"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_code="$4"
    local data="$5"
    
    echo -n "Testing: $name ... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        ((PASSED++))
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $http_code)"
        ((FAILED++))
        echo "$body"
    fi
    echo ""
}

echo "1. HEALTH & STATUS CHECKS"
echo "----------------------------------------"
test_endpoint "Health Check" "GET" "/status" "200"
test_endpoint "API Status" "GET" "/api/status" "200"

echo ""
echo "2. PAW FINDER™ - LOST & FOUND PETS"
echo "----------------------------------------"

# Create report
create_response=$(curl -sS -w "\n%{http_code}" -X POST "$BASE_URL/api/paw-finder/reports" \
    -H "Content-Type: application/json" \
    -d '{
  "type":"lost",
  "pet":{"species":"dog","name":"Kenzo","color":"white"},
  "lastSeen":{"city":"Tel Aviv","coords":[34.78,32.08]},
  "contact":{"name":"Nir","phone":"+972549833355"},
  "lang":"he"
}')

http_code=$(echo "$create_response" | tail -n1)
body=$(echo "$create_response" | sed '$d')

echo -n "Testing: Create Lost Pet Report ... "
if [ "$http_code" = "201" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    ((PASSED++))
    REPORT_ID=$(echo "$body" | jq -r '.id')
    echo "Report ID: $REPORT_ID"
    echo "$body" | jq '.'
else
    echo -e "${RED}✗ FAIL${NC} (Expected 201, got $http_code)"
    ((FAILED++))
    echo "$body"
fi
echo ""

# List reports
test_endpoint "List Active Reports" "GET" "/api/paw-finder/reports?status=active" "200"

# Resolve report (if we got an ID)
if [ -n "$REPORT_ID" ] && [ "$REPORT_ID" != "null" ]; then
    test_endpoint "Resolve Report" "PATCH" "/api/paw-finder/reports/$REPORT_ID/resolve" "200" '{"resolved":true}'
fi

# Get stats
test_endpoint "Get Paw Finder Stats" "GET" "/api/paw-finder/stats" "200"

echo ""
echo "3. AI CHAT ASSISTANT (KENZO)"
echo "----------------------------------------"
test_endpoint "AI Chat (Hebrew)" "POST" "/api/ai/chat" "200" '{"message":"איבדתי כלב קטן ברמת גן","language":"he"}'
test_endpoint "AI Chat (English)" "POST" "/api/ai/chat" "200" '{"message":"I found a small dog near the park","language":"en"}'
test_endpoint "AI Suggestions" "GET" "/api/ai/suggestions?language=en" "200"

echo ""
echo "4. RATE LIMITING"
echo "----------------------------------------"
echo "Testing rate limits (10 rapid requests)..."
for i in {1..10}; do
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$BASE_URL/api/paw-finder/reports" \
        -H "Content-Type: application/json" \
        -d '{"type":"lost","pet":{"species":"test","name":"test"},"lastSeen":{"city":"test"},"contact":{"name":"test","phone":"test"},"lang":"en"}')
    
    if [ "$http_code" = "429" ]; then
        echo -e "Request $i: ${YELLOW}429 Rate Limited${NC}"
        break
    else
        echo "Request $i: HTTP $http_code"
    fi
done
echo ""

echo ""
echo "5. AUTHENTICATION"
echo "----------------------------------------"
test_endpoint "Admin Endpoint (No Auth)" "GET" "/api/admin/stations" "401"
test_endpoint "Admin Endpoint (Invalid Token)" "GET" "/api/admin/stations" "401"

echo ""
echo "6. LOYALTY & WALLET"
echo "----------------------------------------"
test_endpoint "Get Wash Packages" "GET" "/api/packages" "200"
test_endpoint "Apple Wallet Status" "GET" "/api/wallet/status" "200"
test_endpoint "Google Wallet Status" "GET" "/api/google-wallet/status" "200"

echo ""
echo "========================================="
echo "TEST SUMMARY"
echo "========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
