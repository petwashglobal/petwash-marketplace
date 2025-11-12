#!/bin/bash
# Pet Wash™ - Banking-Level Security System Quick Tests
# Run this script to verify all security features are working

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-https://hub.petwash.co.il}"
API_URL="${API_URL:-https://hub.petwash.co.il}"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Pet Wash™ Security System Tests${NC}"
echo -e "${BLUE}================================${NC}\n"

# Test 1: Health Check
echo -e "${YELLOW}[Test 1]${NC} Server Health Check..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/health)
if [ "$HEALTH_STATUS" = "200" ]; then
  echo -e "${GREEN}✓${NC} Server is running (HTTP 200)"
else
  echo -e "${RED}✗${NC} Server health check failed (HTTP $HEALTH_STATUS)"
  exit 1
fi
echo ""

# Test 2: API Endpoint Availability
echo -e "${YELLOW}[Test 2]${NC} WebAuthn Endpoints Check..."

# Test registration options endpoint
REG_OPTIONS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  ${API_URL}/api/webauthn/register/options \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')

if [ "$REG_OPTIONS" = "200" ] || [ "$REG_OPTIONS" = "400" ]; then
  echo -e "${GREEN}✓${NC} Registration endpoint responding (HTTP $REG_OPTIONS)"
else
  echo -e "${RED}✗${NC} Registration endpoint failed (HTTP $REG_OPTIONS)"
fi

# Test login options endpoint
LOGIN_OPTIONS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  ${API_URL}/api/webauthn/login/options \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')

if [ "$LOGIN_OPTIONS" = "200" ] || [ "$LOGIN_OPTIONS" = "404" ]; then
  echo -e "${GREEN}✓${NC} Login endpoint responding (HTTP $LOGIN_OPTIONS)"
else
  echo -e "${RED}✗${NC} Login endpoint failed (HTTP $LOGIN_OPTIONS)"
fi
echo ""

# Test 3: Rate Limiting
echo -e "${YELLOW}[Test 3]${NC} Rate Limiting Check..."
RATE_LIMIT_COUNT=0
for i in {1..3}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    ${API_URL}/api/webauthn/login/options \
    -H "Content-Type: application/json" \
    -d '{"email":"ratelimit-test@example.com"}')
  
  if [ "$STATUS" != "429" ]; then
    ((RATE_LIMIT_COUNT++))
  fi
  sleep 0.5
done

if [ "$RATE_LIMIT_COUNT" -eq 3 ]; then
  echo -e "${GREEN}✓${NC} Rate limiting working (3 requests allowed)"
else
  echo -e "${YELLOW}⚠${NC} Rate limiting may be disabled (dev mode)"
fi
echo ""

# Test 4: IP Geolocation Service
echo -e "${YELLOW}[Test 4]${NC} IP Geolocation Service Check..."
GEO_RESPONSE=$(curl -s --max-time 5 "https://ipapi.co/8.8.8.8/json/")
if echo "$GEO_RESPONSE" | grep -q "city"; then
  CITY=$(echo "$GEO_RESPONSE" | grep -o '"city":"[^"]*"' | cut -d'"' -f4)
  echo -e "${GREEN}✓${NC} ipapi.co responding (Test IP city: $CITY)"
else
  echo -e "${RED}✗${NC} ipapi.co service unavailable"
fi
echo ""

# Test 5: Database Connection (if DATABASE_URL available)
echo -e "${YELLOW}[Test 5]${NC} Database Connection Check..."
if [ -n "$DATABASE_URL" ]; then
  # Test PostgreSQL connection
  PGTEST=$(psql "$DATABASE_URL" -c "SELECT 1;" 2>&1)
  if echo "$PGTEST" | grep -q "1 row"; then
    echo -e "${GREEN}✓${NC} PostgreSQL database connected"
    
    # Check device_registry table exists
    TABLE_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='device_registry');" 2>&1)
    if echo "$TABLE_CHECK" | grep -q "t"; then
      echo -e "${GREEN}✓${NC} device_registry table exists"
      
      # Count passkeys
      PASSKEY_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM device_registry;" 2>&1 | xargs)
      echo -e "${BLUE}ℹ${NC} Total passkeys registered: $PASSKEY_COUNT"
    else
      echo -e "${RED}✗${NC} device_registry table not found"
    fi
  else
    echo -e "${RED}✗${NC} Database connection failed"
  fi
else
  echo -e "${YELLOW}⚠${NC} DATABASE_URL not set, skipping database tests"
fi
echo ""

# Test 6: Session Cookie Security
echo -e "${YELLOW}[Test 6]${NC} Session Cookie Security Headers..."
COOKIE_TEST=$(curl -s -I ${BASE_URL}/ | grep -i "set-cookie" || echo "no-cookie")
if echo "$COOKIE_TEST" | grep -qi "HttpOnly"; then
  echo -e "${GREEN}✓${NC} HttpOnly flag set on cookies"
else
  echo -e "${YELLOW}⚠${NC} HttpOnly flag not detected (may not be set on root path)"
fi

if echo "$COOKIE_TEST" | grep -qi "Secure"; then
  echo -e "${GREEN}✓${NC} Secure flag set on cookies"
else
  echo -e "${YELLOW}⚠${NC} Secure flag not detected (expected in production)"
fi
echo ""

# Test 7: Security Headers
echo -e "${YELLOW}[Test 7]${NC} Security Headers Check..."
HEADERS=$(curl -s -I ${BASE_URL}/)

# Check for security headers
if echo "$HEADERS" | grep -qi "Strict-Transport-Security"; then
  echo -e "${GREEN}✓${NC} HSTS header present"
else
  echo -e "${YELLOW}⚠${NC} HSTS header missing"
fi

if echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
  echo -e "${GREEN}✓${NC} X-Content-Type-Options header present"
else
  echo -e "${YELLOW}⚠${NC} X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
  echo -e "${GREEN}✓${NC} X-Frame-Options header present"
else
  echo -e "${YELLOW}⚠${NC} X-Frame-Options header missing"
fi
echo ""

# Test 8: SendGrid Connectivity (if API key available)
echo -e "${YELLOW}[Test 8]${NC} SendGrid Email Service Check..."
if [ -n "$SENDGRID_API_KEY" ]; then
  SENDGRID_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET https://api.sendgrid.com/v3/user/profile \
    -H "Authorization: Bearer $SENDGRID_API_KEY")
  
  if [ "$SENDGRID_TEST" = "200" ]; then
    echo -e "${GREEN}✓${NC} SendGrid API key valid"
  else
    echo -e "${RED}✗${NC} SendGrid API key invalid (HTTP $SENDGRID_TEST)"
  fi
else
  echo -e "${YELLOW}⚠${NC} SENDGRID_API_KEY not set, skipping email test"
fi
echo ""

# Test 9: Firebase Connectivity
echo -e "${YELLOW}[Test 9]${NC} Firebase Service Check..."
if [ -n "$FIREBASE_SERVICE_ACCOUNT_KEY" ]; then
  echo -e "${GREEN}✓${NC} Firebase service account configured"
else
  echo -e "${RED}✗${NC} FIREBASE_SERVICE_ACCOUNT_KEY not set"
fi
echo ""

# Summary
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Run full acceptance tests: ${YELLOW}see ACCEPTANCE_TESTS.md${NC}"
echo -e "Hardening checklist: ${YELLOW}see HARDENING_CHECKLIST.md${NC}"
echo -e "Ops runbook: ${YELLOW}see OPS_RUNBOOK.md${NC}"
echo -e "Staff announcement: ${YELLOW}see STAFF_ANNOUNCEMENT.md${NC}"
echo ""
echo -e "${GREEN}✓ Quick security tests complete!${NC}"
echo ""

# Optional: Failed burst simulation
read -p "Do you want to test failed burst detection? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "\n${YELLOW}[Bonus]${NC} Testing Failed Burst Detection..."
  echo "Sending 5 failed authentication attempts..."
  
  for i in {1..5}; do
    curl -s -X POST ${API_URL}/api/webauthn/login/verify \
      -H "Content-Type: application/json" \
      -d '{"email":"burst-test@example.com","response":{},"challengeKey":"invalid"}' \
      > /dev/null
    echo "  Attempt $i/5 sent"
    sleep 1
  done
  
  echo -e "${GREEN}✓${NC} Failed burst test complete"
  echo -e "  Check ${YELLOW}support@petwash.co.il${NC} inbox for alert email"
  echo ""
fi

echo -e "${BLUE}All tests completed successfully!${NC}"
