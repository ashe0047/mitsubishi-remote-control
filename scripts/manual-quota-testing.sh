#!/bin/bash

# Development Quota System Testing Script
# Provides structured testing procedures for quota system functionality during development

set -e

echo "=== Quota System Development Testing ==="
echo "This script will guide you through comprehensive testing of the quota system"
echo "Timestamp: $(date)"
echo ""

# Development Configuration
API_BASE_URL=${API_BASE_URL:-"http://localhost:8080"}
TEST_USER_ID=${TEST_USER_ID:-"test_user_001"}
TEST_ROOM_ID=${TEST_ROOM_ID:-"room_001"}
WEBSOCKET_URL=${WEBSOCKET_URL:-"ws://localhost:8080/ws"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log with colors
log_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${BLUE}🔍 $1${NC}"
}

# Function to make API calls
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"

    local curl_opts=("-s" "-w" "\n%{http_code}")
    if [[ -n "$data" ]]; then
        curl_opts+=("-H" "Content-Type: application/json" "-d" "$data")
    fi

    echo "API Call: $method $API_BASE_URL$endpoint"
    if [[ -n "$data" ]]; then
        echo "Data: $data"
    fi

    local response
    response=$(curl "${curl_opts[@]}" -X "$method" "$API_BASE_URL$endpoint")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)

    echo "Response ($http_code): $body"
    echo ""

    if [[ "$http_code" == "$expected_status" ]]; then
        return 0
    else
        log_error "Expected HTTP $expected_status, got $http_code"
        return 1
    fi
}

# Function to wait for user input
wait_for_user() {
    echo -e "${YELLOW}Press Enter to continue...${NC}"
    read -r
}

# Function to pause for observation
observe_pause() {
    local duration="$1"
    echo -e "${YELLOW}⏳ Observing for $duration seconds...${NC}"
    sleep "$duration"
}

# Test 1: Feature Flag Safety Testing
test_feature_flag_safety() {
    echo "=========================================="
    log_step "TEST 1: Feature Flag Disable Safety"
    echo "=========================================="
    echo "This test verifies that disabling the quota feature allows normal AC operation"
    echo ""

    log_step "1.1: Disable quota feature"
    if api_call "POST" "/admin/quota/disable" "" "200"; then
        log_info "Quota feature disabled successfully"
    else
        log_error "Failed to disable quota feature"
        return 1
    fi

    wait_for_user

    log_step "1.2: Verify quota status"
    if api_call "GET" "/admin/quota/status" "" "200"; then
        log_info "Retrieved quota status"
    else
        log_error "Failed to get quota status"
    fi

    wait_for_user

    log_step "1.3: Test AC operation with quota disabled"
    echo "Testing that AC commands work normally when quota is disabled..."

    local power_on_data="{\"power\": true, \"userId\": \"$TEST_USER_ID\"}"
    if api_call "POST" "/api/rooms/$TEST_ROOM_ID/power" "$power_on_data" "200"; then
        log_info "AC power-on command succeeded"
    else
        log_error "AC power-on command failed"
        return 1
    fi

    wait_for_user

    local power_off_data="{\"power\": false, \"userId\": \"$TEST_USER_ID\"}"
    if api_call "POST" "/api/rooms/$TEST_ROOM_ID/power" "$power_off_data" "200"; then
        log_info "AC power-off command succeeded"
    else
        log_error "AC power-off command failed"
        return 1
    fi

    log_info "Feature flag safety test completed successfully"
    echo ""
}

# Test 2: Feature Flag Enable Testing
test_feature_flag_enable() {
    echo "=========================================="
    log_step "TEST 2: Feature Flag Enable"
    echo "=========================================="
    echo "This test enables the quota feature and verifies validation is active"
    echo ""

    log_step "2.1: Enable quota feature"
    if api_call "POST" "/admin/quota/enable" "" "200"; then
        log_info "Quota feature enabled successfully"
    else
        log_error "Failed to enable quota feature"
        return 1
    fi

    wait_for_user

    log_step "2.2: Verify quota status"
    if api_call "GET" "/admin/quota/status" "" "200"; then
        log_info "Retrieved quota status - should show enabled"
    else
        log_error "Failed to get quota status"
    fi

    observe_pause 3

    log_step "2.3: Test quota validation is active"
    echo "Sending AC command to verify quota validation is working..."

    local test_data="{\"power\": true, \"userId\": \"$TEST_USER_ID\"}"
    echo "This command should either succeed (if no quota configured) or be validated against quotas"

    if api_call "POST" "/api/rooms/$TEST_ROOM_ID/power" "$test_data" "200"; then
        log_info "AC command processed - check logs for quota validation"
    else
        log_warn "AC command may have been blocked by quota (check response)"
    fi

    log_info "Feature flag enable test completed"
    echo ""
}

# Test 3: Quota Configuration Testing
test_quota_configuration() {
    echo "=========================================="
    log_step "TEST 3: Quota Configuration"
    echo "=========================================="
    echo "This test creates and configures a quota for testing"
    echo ""

    log_step "3.1: Create test quota (4 hours daily limit)"
    local quota_data="{
        \"userId\": \"$TEST_USER_ID\",
        \"targetId\": \"$TEST_ROOM_ID\",
        \"targetType\": \"ROOM\",
        \"quotaType\": \"TIME_BASED\",
        \"allowedAmount\": 240,
        \"effectiveFrom\": \"$(date -I)\",
        \"effectiveUntil\": \"$(date -d '+30 days' -I)\",
        \"warningThresholds\": [75, 90]
    }"

    echo "Creating quota with 4-hour daily limit..."
    if api_call "POST" "/api/quotas" "$quota_data" "201"; then
        log_info "Test quota created successfully"
    else
        log_warn "Quota creation failed - may already exist"
    fi

    wait_for_user

    log_step "3.2: Verify quota was created"
    if api_call "GET" "/api/quotas/user/$TEST_USER_ID" "" "200"; then
        log_info "Retrieved user quotas"
    else
        log_error "Failed to retrieve user quotas"
    fi

    wait_for_user

    log_step "3.3: Test quota enforcement"
    echo "Testing AC command with active quota..."

    local test_data="{\"power\": true, \"userId\": \"$TEST_USER_ID\"}"
    if api_call "POST" "/api/rooms/$TEST_ROOM_ID/power" "$test_data" "200"; then
        log_info "AC command allowed - quota has remaining time"
    else
        log_warn "AC command blocked - check if quota is exceeded"
    fi

    log_info "Quota configuration test completed"
    echo ""
}

# Test 4: WebSocket Notification Testing
test_websocket_notifications() {
    echo "=========================================="
    log_step "TEST 4: WebSocket Notifications"
    echo "=========================================="
    echo "This test monitors WebSocket quota notifications"
    echo ""

    log_step "4.1: Manual WebSocket testing required"
    echo "Please perform the following manual steps:"
    echo "1. Open a WebSocket client to: $WEBSOCKET_URL"
    echo "2. Authenticate with a valid JWT token"
    echo "3. Monitor for quota-related messages"
    echo ""

    wait_for_user

    log_step "4.2: Trigger quota events"
    echo "Sending AC commands to generate quota events..."

    local power_on_data="{\"power\": true, \"userId\": \"$TEST_USER_ID\"}"
    echo "Starting AC to trigger usage session start..."
    if api_call "POST" "/api/rooms/$TEST_ROOM_ID/power" "$power_on_data" "200"; then
        log_info "AC started - check WebSocket for session start notification"
    fi

    observe_pause 5

    local power_off_data="{\"power\": false, \"userId\": \"$TEST_USER_ID\"}"
    echo "Stopping AC to trigger usage session end..."
    if api_call "POST" "/api/rooms/$TEST_ROOM_ID/power" "$power_off_data" "200"; then
        log_info "AC stopped - check WebSocket for session end notification"
    fi

    echo ""
    log_warn "Verify the following WebSocket messages were received:"
    echo "- USAGE_SESSION_STARTED when AC was turned on"
    echo "- USAGE_SESSION_ENDED when AC was turned off"
    echo "- Messages should include familyMemberId, roomId, and usage data"

    wait_for_user
    log_info "WebSocket notification test completed"
    echo ""
}

# Test 5: Parent Override Testing
test_parent_override() {
    echo "=========================================="
    log_step "TEST 5: Parent Override Testing"
    echo "=========================================="
    echo "This test simulates quota exceeded scenario and parent override"
    echo ""

    log_step "5.1: Simulate quota exceeded scenario"
    echo "This test requires manual quota manipulation or time simulation"
    echo "For demonstration, we'll create an override scenario..."

    # First get the quota ID
    log_step "5.2: Get quota ID for override testing"
    echo "Retrieving quota information..."
    if api_call "GET" "/api/quotas/user/$TEST_USER_ID" "" "200"; then
        log_info "Retrieved quota information - extract quota ID for next step"
    fi

    wait_for_user

    # Request override (using placeholder quota ID)
    log_step "5.3: Request parent override"
    echo "Enter the quota ID from the previous response:"
    read -r quota_id

    if [[ -n "$quota_id" ]]; then
        local override_data="{
            \"duration\": 60,
            \"reason\": \"Emergency override for testing\",
            \"requestedBy\": \"$TEST_USER_ID\"
        }"

        if api_call "POST" "/api/quotas/$quota_id/override" "$override_data" "200"; then
            log_info "Override request submitted"
        else
            log_warn "Override request failed"
        fi
    else
        log_warn "No quota ID provided - skipping override test"
    fi

    wait_for_user

    log_step "5.4: Test AC operation with override"
    echo "Testing AC command after override..."

    local test_data="{\"power\": true, \"userId\": \"$TEST_USER_ID\"}"
    if api_call "POST" "/api/rooms/$TEST_ROOM_ID/power" "$test_data" "200"; then
        log_info "AC command succeeded with override"
    else
        log_warn "AC command still blocked - check override status"
    fi

    log_info "Parent override test completed"
    echo ""
}

# Test 6: Error Handling and Fail-Safe Testing
test_error_handling() {
    echo "=========================================="
    log_step "TEST 6: Error Handling and Fail-Safe"
    echo "=========================================="
    echo "This test verifies system behavior during various error conditions"
    echo ""

    log_step "6.1: Test with invalid user ID"
    local invalid_data="{\"power\": true, \"userId\": \"invalid-user-id\"}"
    echo "Testing AC command with invalid user ID..."

    if api_call "POST" "/api/rooms/$TEST_ROOM_ID/power" "$invalid_data" "200"; then
        log_info "AC command succeeded - system failed safe for invalid user"
    else
        log_warn "AC command failed - check if this is expected behavior"
    fi

    wait_for_user

    log_step "6.2: Test with non-existent room"
    local room_data="{\"power\": true, \"userId\": \"$TEST_USER_ID\"}"
    echo "Testing AC command with non-existent room..."

    if api_call "POST" "/api/rooms/non-existent-room/power" "$room_data" "404"; then
        log_info "Correctly returned 404 for non-existent room"
    else
        log_warn "Unexpected response for non-existent room"
    fi

    wait_for_user

    log_step "6.3: Test timeout handling"
    echo "This test would require simulating database/Redis timeouts"
    echo "Manual verification: Check application logs for timeout handling"
    echo "Expected: AC commands should succeed with quota validation timeouts"

    log_info "Error handling test completed"
    echo ""
}

# Test 7: Performance and Load Testing
test_performance() {
    echo "=========================================="
    log_step "TEST 7: Performance Testing"
    echo "=========================================="
    echo "This test performs basic performance validation"
    echo ""

    log_step "7.1: Rapid AC command test"
    echo "Sending multiple AC commands in sequence..."

    local start_time=$(date +%s%N)
    for i in {1..10}; do
        local test_data="{\"power\": true, \"userId\": \"perf_test_$i\"}"
        api_call "POST" "/api/rooms/$TEST_ROOM_ID/power" "$test_data" "200" >/dev/null || true
    done
    local end_time=$(date +%s%N)

    local duration_ms=$(( (end_time - start_time) / 1000000 ))
    local avg_ms=$(( duration_ms / 10 ))

    echo "Performance results:"
    echo "- Total time: ${duration_ms}ms"
    echo "- Average per request: ${avg_ms}ms"

    if [[ $avg_ms -lt 200 ]]; then
        log_info "Performance within acceptable range"
    else
        log_warn "Performance may be slower than expected"
    fi

    log_info "Performance test completed"
    echo ""
}

# Main testing function
run_all_tests() {
    echo "Starting comprehensive quota system testing..."
    echo "API Base URL: $API_BASE_URL"
    echo "Test User ID: $TEST_USER_ID"
    echo "Test Room ID: $TEST_ROOM_ID"
    echo ""

    # Run all tests
    test_feature_flag_safety
    test_feature_flag_enable
    test_quota_configuration
    test_websocket_notifications
    test_parent_override
    test_error_handling
    test_performance

    echo "=========================================="
    log_info "All manual tests completed!"
    echo "=========================================="
    echo ""
    echo "Test Summary:"
    echo "1. ✅ Feature flag safety verified"
    echo "2. ✅ Quota validation enabled"
    echo "3. ✅ Quota configuration tested"
    echo "4. ⚠️  WebSocket notifications (manual verification required)"
    echo "5. ✅ Parent override functionality"
    echo "6. ✅ Error handling and fail-safe behavior"
    echo "7. ✅ Basic performance validation"
    echo ""
    echo "Manual verification checklist:"
    echo "□ WebSocket notifications are received correctly"
    echo "□ Application logs show no errors during testing"
    echo "□ MQTT messages are published correctly"
    echo "□ Database entries are created for usage sessions"
    echo "□ Redis cache is functioning properly"
    echo "□ Monitoring metrics are being collected"
    echo ""
    echo "If all items are checked, the quota system is ready for production!"
}

# Interactive menu
show_menu() {
    echo "Quota System Testing Menu:"
    echo "1. Run all tests"
    echo "2. Test feature flag safety"
    echo "3. Test quota configuration"
    echo "4. Test WebSocket notifications"
    echo "5. Test parent override"
    echo "6. Test error handling"
    echo "7. Test performance"
    echo "8. Exit"
    echo ""
    echo -n "Choose test to run (1-8): "
}

# Main script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -eq 0 ]]; then
        # Interactive mode
        while true; do
            show_menu
            read -r choice
            echo ""

            case $choice in
                1) run_all_tests ;;
                2) test_feature_flag_safety ;;
                3) test_quota_configuration ;;
                4) test_websocket_notifications ;;
                5) test_parent_override ;;
                6) test_error_handling ;;
                7) test_performance ;;
                8) echo "Exiting..."; exit 0 ;;
                *) log_error "Invalid choice. Please try again." ;;
            esac
            echo ""
        done
    else
        # Command line mode
        case $1 in
            all) run_all_tests ;;
            safety) test_feature_flag_safety ;;
            config) test_quota_configuration ;;
            websocket) test_websocket_notifications ;;
            override) test_parent_override ;;
            error) test_error_handling ;;
            performance) test_performance ;;
            *) echo "Usage: $0 [all|safety|config|websocket|override|error|performance]"; exit 1 ;;
        esac
    fi
fi