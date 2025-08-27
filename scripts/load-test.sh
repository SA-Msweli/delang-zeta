#!/bin/bash

# DeLangZeta Load Testing Script
# Test serverless functions under various load conditions

set -e

# Configuration
PROJECT_ID=${1:-"delang-zeta-prod"}
REGION=${2:-"us-central1"}
CONCURRENT_USERS=${3:-10}
TEST_DURATION=${4:-60}

echo "🚀 Starting DeLangZeta Load Testing"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Test Duration: ${TEST_DURATION}s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function URLs
BASE_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net"
HEALTH_URL="$BASE_URL/delang-monitoring-health"
AUTH_URL="$BASE_URL/delang-auth"
STORAGE_UPLOAD_URL="$BASE_URL/delang-storage-upload"
STORAGE_DOWNLOAD_URL="$BASE_URL/delang-storage-download"
AI_VERIFICATION_URL="$BASE_URL/delang-ai-verification"

# Test results
TOTAL_REQUESTS=0
SUCCESSFUL_REQUESTS=0
FAILED_REQUESTS=0
TOTAL_RESPONSE_TIME=0

# Function to run load test
run_load_test() {
    local test_name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="${4:-}"
    local concurrent="${5:-$CONCURRENT_USERS}"
    local duration="${6:-$TEST_DURATION}"
    
    echo -e "${BLUE}🔥 Load Testing: $test_name${NC}"
    echo "URL: $url"
    echo "Method: $method"
    echo "Concurrent Users: $concurrent"
    echo "Duration: ${duration}s"
    
    # Create temporary files for results
    local results_file="/tmp/load_test_results_$$"
    local pids_file="/tmp/load_test_pids_$$"
    
    # Start load test workers
    for ((i=1; i<=concurrent; i++)); do
        {
            local worker_requests=0
            local worker_successful=0
            local worker_failed=0
            local worker_total_time=0
            
            local end_time=$(($(date +%s) + duration))
            
            while [ $(date +%s) -lt $end_time ]; do
                local start_time=$(date +%s%N)
                
                if [ "$method" = "POST" ] && [ -n "$data" ]; then
                    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url" --max-time 30 2>/dev/null || echo "000")
                else
                    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 30 2>/dev/null || echo "000")
                fi
                
                local end_time_ns=$(date +%s%N)
                local response_time=$(( (end_time_ns - start_time) / 1000000 ))
                
                worker_requests=$((worker_requests + 1))
                worker_total_time=$((worker_total_time + response_time))
                
                if [ "$response" = "200" ] || [ "$response" = "400" ] || [ "$response" = "401" ]; then
                    worker_successful=$((worker_successful + 1))
                else
                    worker_failed=$((worker_failed + 1))
                fi
                
                # Small delay to prevent overwhelming
                sleep 0.1
            done
            
            echo "$worker_requests $worker_successful $worker_failed $worker_total_time" >> "$results_file"
        } &
        echo $! >> "$pids_file"
    done
    
    # Wait for all workers to complete
    echo "Running load test..."
    while read -r pid; do
        wait "$pid"
    done < "$pids_file"
    
    # Aggregate results
    local test_total_requests=0
    local test_successful_requests=0
    local test_failed_requests=0
    local test_total_response_time=0
    
    while read -r requests successful failed total_time; do
        test_total_requests=$((test_total_requests + requests))
        test_successful_requests=$((test_successful_requests + successful))
        test_failed_requests=$((test_failed_requests + failed))
        test_total_response_time=$((test_total_response_time + total_time))
    done < "$results_file"
    
    # Calculate metrics
    local success_rate=0
    local avg_response_time=0
    local requests_per_second=0
    
    if [ $test_total_requests -gt 0 ]; then
        success_rate=$((test_successful_requests * 100 / test_total_requests))
        avg_response_time=$((test_total_response_time / test_total_requests))
        requests_per_second=$((test_total_requests / duration))
    fi
    
    # Update global counters
    TOTAL_REQUESTS=$((TOTAL_REQUESTS + test_total_requests))
    SUCCESSFUL_REQUESTS=$((SUCCESSFUL_REQUESTS + test_successful_requests))
    FAILED_REQUESTS=$((FAILED_REQUESTS + test_failed_requests))
    TOTAL_RESPONSE_TIME=$((TOTAL_RESPONSE_TIME + test_total_response_time))
    
    # Display results
    echo -e "${GREEN}📊 Results for $test_name:${NC}"
    echo "  Total Requests: $test_total_requests"
    echo "  Successful: $test_successful_requests"
    echo "  Failed: $test_failed_requests"
    echo "  Success Rate: $success_rate%"
    echo "  Average Response Time: ${avg_response_time}ms"
    echo "  Requests/Second: $requests_per_second"
    
    # Cleanup
    rm -f "$results_file" "$pids_file"
    
    echo ""
}

# Function to test cold starts
test_cold_starts() {
    echo -e "${BLUE}🧊 Testing Cold Start Performance${NC}"
    
    local cold_start_times=()
    
    for i in {1..5}; do
        echo "Cold start test $i/5..."
        
        # Wait to ensure function is cold
        sleep 30
        
        local start_time=$(date +%s%N)
        response=$(curl -s "$HEALTH_URL" --max-time 30 2>/dev/null || echo "error")
        local end_time=$(date +%s%N)
        
        local cold_start_time=$(( (end_time - start_time) / 1000000 ))
        cold_start_times+=($cold_start_time)
        
        echo "  Cold start $i: ${cold_start_time}ms"
    done
    
    # Calculate average cold start time
    local total_cold_start=0
    for time in "${cold_start_times[@]}"; do
        total_cold_start=$((total_cold_start + time))
    done
    local avg_cold_start=$((total_cold_start / ${#cold_start_times[@]}))
    
    echo -e "${GREEN}📊 Cold Start Results:${NC}"
    echo "  Average Cold Start Time: ${avg_cold_start}ms"
    echo "  Cold Start Times: ${cold_start_times[*]}ms"
    echo ""
}

# Function to test memory and CPU under load
test_resource_usage() {
    echo -e "${BLUE}💾 Testing Resource Usage Under Load${NC}"
    
    # Start monitoring in background
    {
        for i in {1..60}; do
            # Make requests to trigger function execution
            curl -s "$HEALTH_URL" >/dev/null 2>&1 &
            curl -s "$AUTH_URL" >/dev/null 2>&1 &
            sleep 1
        done
    } &
    
    local monitor_pid=$!
    
    echo "Monitoring resource usage for 60 seconds..."
    sleep 60
    
    # Stop monitoring
    kill $monitor_pid 2>/dev/null || true
    wait $monitor_pid 2>/dev/null || true
    
    echo -e "${GREEN}📊 Resource monitoring completed${NC}"
    echo "  Check Google Cloud Console for detailed metrics"
    echo ""
}

echo ""
echo "🏁 Starting Load Tests..."
echo "========================"

# Test 1: Health Check Endpoint
run_load_test "Health Check Endpoint" "$HEALTH_URL" "GET" "" 5 30

# Test 2: Authentication Endpoint (with invalid data)
run_load_test "Authentication Endpoint" "$AUTH_URL" "POST" '{"walletAddress":"test"}' 3 30

# Test 3: Storage Upload Endpoint (should fail auth)
run_load_test "Storage Upload Endpoint" "$STORAGE_UPLOAD_URL" "POST" '{"taskId":"test"}' 3 30

# Test 4: High Concurrency Test
echo -e "${BLUE}🚀 High Concurrency Test${NC}"
run_load_test "High Concurrency Health Check" "$HEALTH_URL" "GET" "" 20 60

# Test 5: Cold Start Performance
test_cold_starts

# Test 6: Resource Usage Under Load
test_resource_usage

# Test 7: Sustained Load Test
echo -e "${BLUE}⏱️ Sustained Load Test${NC}"
run_load_test "Sustained Load" "$HEALTH_URL" "GET" "" 10 300

echo ""
echo "📊 LOAD TEST SUMMARY"
echo "===================="

# Calculate overall metrics
OVERALL_SUCCESS_RATE=0
OVERALL_AVG_RESPONSE_TIME=0
OVERALL_RPS=0

if [ $TOTAL_REQUESTS -gt 0 ]; then
    OVERALL_SUCCESS_RATE=$((SUCCESSFUL_REQUESTS * 100 / TOTAL_REQUESTS))
    OVERALL_AVG_RESPONSE_TIME=$((TOTAL_RESPONSE_TIME / TOTAL_REQUESTS))
    OVERALL_RPS=$((TOTAL_REQUESTS / (TEST_DURATION * 7)))  # 7 tests
fi

echo -e "Total Requests: $TOTAL_REQUESTS"
echo -e "${GREEN}Successful: $SUCCESSFUL_REQUESTS${NC}"
echo -e "${RED}Failed: $FAILED_REQUESTS${NC}"
echo -e "Overall Success Rate: $OVERALL_SUCCESS_RATE%"
echo -e "Overall Average Response Time: ${OVERALL_AVG_RESPONSE_TIME}ms"
echo -e "Overall Requests/Second: $OVERALL_RPS"

# Create load test report
cat > load-test-report.md << EOF
# DeLangZeta Load Test Report

**Test Date:** $(date)
**Project ID:** $PROJECT_ID
**Region:** $REGION
**Test Configuration:**
- Concurrent Users: $CONCURRENT_USERS
- Test Duration: ${TEST_DURATION}s per test

## Overall Results
- **Total Requests:** $TOTAL_REQUESTS
- **Successful Requests:** $SUCCESSFUL_REQUESTS
- **Failed Requests:** $FAILED_REQUESTS
- **Success Rate:** $OVERALL_SUCCESS_RATE%
- **Average Response Time:** ${OVERALL_AVG_RESPONSE_TIME}ms
- **Requests per Second:** $OVERALL_RPS

## Test Categories
1. Health Check Endpoint Load Test
2. Authentication Endpoint Load Test
3. Storage Upload Endpoint Load Test
4. High Concurrency Test (20 concurrent users)
5. Cold Start Performance Test
6. Resource Usage Under Load
7. Sustained Load Test (5 minutes)

## Performance Analysis
EOF

if [ $OVERALL_SUCCESS_RATE -ge 95 ] && [ $OVERALL_AVG_RESPONSE_TIME -le 2000 ]; then
    echo "### ✅ EXCELLENT PERFORMANCE" >> load-test-report.md
    echo "- Success rate above 95%" >> load-test-report.md
    echo "- Average response time under 2 seconds" >> load-test-report.md
    echo "- System handles load well" >> load-test-report.md
elif [ $OVERALL_SUCCESS_RATE -ge 90 ] && [ $OVERALL_AVG_RESPONSE_TIME -le 5000 ]; then
    echo "### ⚠️ ACCEPTABLE PERFORMANCE" >> load-test-report.md
    echo "- Success rate above 90%" >> load-test-report.md
    echo "- Average response time under 5 seconds" >> load-test-report.md
    echo "- Consider optimization for better performance" >> load-test-report.md
else
    echo "### ❌ PERFORMANCE ISSUES DETECTED" >> load-test-report.md
    echo "- Success rate below 90% or response time above 5 seconds" >> load-test-report.md
    echo "- Significant performance optimization needed" >> load-test-report.md
    echo "- Review function configuration and resource allocation" >> load-test-report.md
fi

echo "" >> load-test-report.md
echo "## Recommendations" >> load-test-report.md
if [ $OVERALL_SUCCESS_RATE -ge 95 ] && [ $OVERALL_AVG_RESPONSE_TIME -le 2000 ]; then
    echo "1. Performance is excellent - ready for production" >> load-test-report.md
    echo "2. Monitor performance in production" >> load-test-report.md
    echo "3. Set up auto-scaling policies" >> load-test-report.md
else
    echo "1. Optimize function memory allocation" >> load-test-report.md
    echo "2. Implement connection pooling" >> load-test-report.md
    echo "3. Add caching layers" >> load-test-report.md
    echo "4. Review function timeout settings" >> load-test-report.md
    echo "5. Consider pre-warming critical functions" >> load-test-report.md
fi

echo "" >> load-test-report.md
echo "## Next Steps" >> load-test-report.md
echo "1. Review detailed metrics in Google Cloud Console" >> load-test-report.md
echo "2. Optimize any performance bottlenecks" >> load-test-report.md
echo "3. Set up production monitoring and alerting" >> load-test-report.md
echo "4. Plan for auto-scaling based on load patterns" >> load-test-report.md

echo ""
echo "📊 Load test report saved to: load-test-report.md"

# Exit with appropriate code
if [ $OVERALL_SUCCESS_RATE -ge 90 ] && [ $OVERALL_AVG_RESPONSE_TIME -le 5000 ]; then
    echo -e "${GREEN}✅ Load testing completed successfully!${NC}"
    echo -e "${GREEN}🚀 System performance is acceptable for production!${NC}"
    exit 0
else
    echo -e "${RED}❌ Load testing revealed performance issues.${NC}"
    echo -e "${RED}🔧 Optimize performance before production deployment.${NC}"
    exit 1
fi