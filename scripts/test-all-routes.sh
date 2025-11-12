#!/bin/bash
# Pet Wash™ - Route Verification Script
# Tests all critical routes for 200 OK responses

BASE_URL="${1:-http://localhost:5000}"

echo "🧪 Testing all routes on: $BASE_URL"
echo "=========================================="

# Color codes
GREEN='\033[0.32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

test_route() {
  local route=$1
  local expected=${2:-200}
  
  status=$(curl -o /dev/null -s -w "%{http_code}" "$BASE_URL$route")
  
  if [ "$status" -eq "$expected" ]; then
    echo -e "${GREEN}✓${NC} $route → $status"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $route → $status (expected $expected)"
    ((FAILED++))
  fi
}

echo ""
echo "📍 PUBLIC ROUTES"
test_route "/"
test_route "/about"
test_route "/contact"
test_route "/pricing"
test_route "/franchise"
test_route "/privacy"
test_route "/terms"

echo ""
echo "🔐 AUTH ROUTES"
test_route "/signin"
test_route "/signup"
test_route "/admin/login"

echo ""
echo "💳 PAYMENT & WALLET ROUTES"
test_route "/wallet"
test_route "/loyalty"
test_route "/packages"
test_route "/buy-gift-card"
test_route "/claim-voucher"

echo ""
echo "🐾 SERVICE ROUTES"
test_route "/walk-my-pet"
test_route "/sitter-suite"
test_route "/pettrek"
test_route "/plush-lab"
test_route "/pet-care-planner"

echo ""
echo "🔧 FIXED ROUTES (Recent Bug Fixes)"
test_route "/pet-wash-circle"  # NEW: Added today
test_route "/petwash-circle"   # ORIGINAL: Always existed

echo ""
echo "🏢 ENTERPRISE ROUTES"
test_route "/franchisee-dashboard"
test_route "/finance-dashboard"
test_route "/hr-dashboard"
test_route "/admin-dashboard"

echo ""
echo "=========================================="
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL ROUTES WORKING PERFECTLY!"
  exit 0
else
  echo "❌ SOME ROUTES FAILED - INVESTIGATE"
  exit 1
fi
