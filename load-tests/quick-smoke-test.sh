#!/bin/bash
# Quick smoke test - 30 second version of Phase 1 tests

echo "🚀 Pet Wash™ - Quick Smoke Test"
echo "Testing each service for 30 seconds to validate infrastructure"
echo ""

mkdir -p results

# Run auth test with minimal duration
echo "▶️ Auth Service (30s)..."
k6 run --env BASE_URL="http://localhost:5000" \
  --stage "10s:10,20s:10,30s:0" \
  --summary-export=results/smoke-auth.json \
  phase1-auth-test.js 2>&1 | grep -E "(http_req_duration|http_reqs|Failed)" | tail -5

echo "✅ Auth test complete"
echo ""

# Run one booking test
echo "▶️ Booking Service (30s)..."
k6 run --env BASE_URL="http://localhost:5000" \
  --stage "10s:10,20s:10,30s:0" \
  --summary-export=results/smoke-booking.json \
  phase1-booking-test.js 2>&1 | grep -E "(http_req_duration|http_reqs|Failed)" | tail -5

echo "✅ Booking test complete"
echo ""

echo "🎉 Smoke tests complete! Full load tests can be run with ./run-all-phase1.sh"
