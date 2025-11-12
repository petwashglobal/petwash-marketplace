#!/bin/bash
###
# Pet Wash™ Phase 1 Load Testing Suite
# Tests individual services for baseline performance
###

echo "🚀 Pet Wash™ - Phase 1 Load Testing Suite"
echo "=========================================="
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 is not installed"
    echo "📥 Install k6: https://k6.io/docs/getting-started/installation/"
    echo ""
    echo "Quick install (Linux/macOS):"
    echo "  brew install k6  (macOS)"
    echo "  sudo snap install k6  (Linux)"
    exit 1
fi

# Create results directory
mkdir -p results

# Set base URL
BASE_URL="${BASE_URL:-http://localhost:5000}"
echo "🌐 Testing against: $BASE_URL"
echo ""

# Array to track results
declare -a results

# Function to run test
run_test() {
    local test_name=$1
    local test_file=$2
    
    echo "▶️  Running: $test_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if k6 run --env BASE_URL="$BASE_URL" "$test_file"; then
        echo "✅ $test_name: PASSED"
        results+=("✅ $test_name")
    else
        echo "❌ $test_name: FAILED"
        results+=("❌ $test_name")
    fi
    
    echo ""
    sleep 2
}

# Run all Phase 1 tests
echo "📊 Starting Phase 1 Tests (7 minute total runtime)"
echo ""

run_test "Auth Service" "phase1-auth-test.js"
run_test "Booking Services" "phase1-booking-test.js"
run_test "Payment Processing" "phase1-payments-test.js"
run_test "GPS Tracking" "phase1-gps-test.js"
run_test "K9000 IoT" "phase1-k9000-iot-test.js"

# Print summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 PHASE 1 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for result in "${results[@]}"; do
    echo "$result"
done
echo ""
echo "📁 Detailed results saved in: results/"
echo ""
echo "🎉 Phase 1 testing complete!"
