#!/bin/bash
set -e

echo "🔍 Pet Wash™ Authentication Verification Script"
echo "================================================"
echo ""

BASE_URL="${BASE_URL:-https://petwash.co.il}"

# Test 1: Firebase Auth Handler
echo "✅ Test 1: Firebase Auth Handler"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/__/auth/handler")
if [ "$STATUS" = "200" ]; then
  echo "   ✅ PASS: Firebase auth handler accessible"
else
  echo "   ❌ FAIL: Got HTTP $STATUS (expected 200)"
  exit 1
fi

# Test 2: WebAuthn Registration Options
echo "✅ Test 2: WebAuthn Registration Endpoint"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/webauthn/register/options")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "200" ]; then
  echo "   ✅ PASS: WebAuthn endpoint responding"
else
  echo "   ❌ FAIL: Got HTTP $STATUS"
  exit 1
fi

# Test 3: CORS Headers
echo "✅ Test 3: CORS Configuration"
CORS=$(curl -s -I -H "Origin: $BASE_URL" "$BASE_URL/api/health" | grep -i "access-control")
if [ -n "$CORS" ]; then
  echo "   ✅ PASS: CORS headers present"
else
  echo "   ⚠️  WARN: No CORS headers found"
fi

# Test 4: Environment Variables Check
echo "✅ Test 4: Critical Environment Variables"
echo "   (Run this on the server, not from external client)"
echo "   Check for: WEBAUTHN_COOKIE_SECRET, VITE_FIREBASE_AUTH_DOMAIN, VITE_WEBAUTHN_RP_ID"

echo ""
echo "================================================"
echo "✅ Verification Complete"
echo ""
echo "To run against different environment:"
echo "  BASE_URL=https://www.petwash.co.il ./scripts/verify-auth.sh"
echo "  BASE_URL=https://your-preview.replit.dev ./scripts/verify-auth.sh"
