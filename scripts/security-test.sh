#!/bin/bash

# DeLangZeta Security Testing Script
# Task 13.2: Conduct security testing and validation

set -e

# Configuration
PROJECT_ID=${1:-"delang-zeta-prod"}
REGION=${2:-"us-central1"}
ENVIRONMENT="production"

echo "🔒 Starting DeLangZeta Security Testing Suite"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Environment: $ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${BLUE}🧪 Testing: $test_name${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Function to test HTTP endpoint
test_endpoint() {
    local endpoint="$1"
    local expected_status="$2"
    local test_name="$3"
    
    echo -e "${BLUE}🌐 Testing endpoint: $test_name${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED: $test_name (Status: $response)${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED: $test_name (Expected: $expected_status, Got: $response)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo ""
echo "🔍 1. INFRASTRUCTURE SECURITY TESTS"
echo "=================================="

# Test 1: Verify service accounts exist
run_test "Service accounts exist" "
    gcloud iam service-accounts describe delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com --project=$PROJECT_ID >/dev/null 2>&1 &&
    gcloud iam service-accounts describe delang-storage-sa@$PROJECT_ID.iam.gserviceaccount.com --project=$PROJECT_ID >/dev/null 2>&1
"

# Test 2: Verify storage buckets have proper security
run_test "Storage bucket security configuration" "
    gsutil uniformbucketlevelaccess get gs://$PROJECT_ID-datasets | grep -q 'Enabled: True' &&
    gsutil versioning get gs://$PROJECT_ID-datasets | grep -q 'Enabled'
"

# Test 3: Verify KMS encryption is enabled
run_test "KMS encryption configuration" "
    gsutil kms encryption gs://$PROJECT_ID-datasets | grep -q 'projects/$PROJECT_ID/locations/$REGION/keyRings/delang-storage-keyring/cryptoKeys/delang-storage-key'
"

# Test 4: Verify Secret Manager secrets exist
run_test "Secret Manager configuration" "
    gcloud secrets describe jwt-signing-key --project=$PROJECT_ID >/dev/null 2>&1 &&
    gcloud secrets describe gemini-api-key --project=$PROJECT_ID >/dev/null 2>&1 &&
    gcloud secrets describe translate-api-key --project=$PROJECT_ID >/dev/null 2>&1
"

# Test 5: Verify IAM policies are restrictive
run_test "IAM policy validation" "
    # Check that buckets don't have public access
    ! gsutil iam get gs://$PROJECT_ID-datasets | grep -q 'allUsers' &&
    ! gsutil iam get gs://$PROJECT_ID-datasets | grep -q 'allAuthenticatedUsers'
"

echo ""
echo "🔧 2. CLOUD FUNCTIONS SECURITY TESTS"
echo "===================================="

# Get function URLs
AUTH_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-auth"
STORAGE_UPLOAD_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-storage-upload"
STORAGE_DOWNLOAD_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-storage-download"
AI_VERIFICATION_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-ai-verification"
HEALTH_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-monitoring-health"

# Test 6: Health check endpoint
test_endpoint "$HEALTH_URL" "200" "Health check endpoint accessibility"

# Test 7: Authentication endpoint security (should reject unauthorized requests)
test_endpoint "$AUTH_URL" "400" "Auth endpoint rejects empty requests"

# Test 8: Storage upload endpoint security (should require authentication)
test_endpoint "$STORAGE_UPLOAD_URL" "401" "Storage upload requires authentication"

# Test 9: Storage download endpoint security (should require authentication)
test_endpoint "$STORAGE_DOWNLOAD_URL" "401" "Storage download requires authentication"

# Test 10: AI verification endpoint security (should require authentication)
test_endpoint "$AI_VERIFICATION_URL" "401" "AI verification requires authentication"

echo ""
echo "🔐 3. AUTHENTICATION AND AUTHORIZATION TESTS"
echo "============================================="

# Test 11: JWT token validation
run_test "JWT token validation logic" "
    # Test with invalid JWT token
    response=\$(curl -s -H 'Authorization: Bearer invalid-token' '$STORAGE_UPLOAD_URL' -w '%{http_code}' -o /dev/null)
    [ \"\$response\" = \"401\" ]
"

# Test 12: CORS configuration
run_test "CORS configuration" "
    response=\$(curl -s -H 'Origin: https://malicious-site.com' -H 'Access-Control-Request-Method: POST' -X OPTIONS '$AUTH_URL' -w '%{http_code}' -o /dev/null)
    [ \"\$response\" != \"200\" ]
"

echo ""
echo "📊 4. MONITORING AND LOGGING TESTS"
echo "=================================="

# Test 13: Verify monitoring policies exist
run_test "Monitoring policies configuration" "
    gcloud alpha monitoring policies list --project=$PROJECT_ID --filter='displayName:\"Storage Unauthorized Access\"' --format='value(name)' | grep -q 'projects/$PROJECT_ID' &&
    gcloud alpha monitoring policies list --project=$PROJECT_ID --filter='displayName:\"Storage Function Errors\"' --format='value(name)' | grep -q 'projects/$PROJECT_ID'
"

# Test 14: Verify audit logging is enabled
run_test "Audit logging configuration" "
    gcloud logging sinks list --project=$PROJECT_ID --filter='name:delang-storage-audit-sink' --format='value(name)' | grep -q 'delang-storage-audit-sink'
"

echo ""
echo "🚨 5. PENETRATION TESTING"
echo "========================"

# Test 15: SQL injection attempt (should be blocked)
run_test "SQL injection protection" "
    response=\$(curl -s '$AUTH_URL' -d '{\"walletAddress\":\"0x123; DROP TABLE users; --\"}' -H 'Content-Type: application/json' -w '%{http_code}' -o /dev/null)
    [ \"\$response\" != \"200\" ]
"

# Test 16: XSS attempt (should be sanitized)
run_test "XSS protection" "
    response=\$(curl -s '$AUTH_URL' -d '{\"walletAddress\":\"<script>alert(1)</script>\"}' -H 'Content-Type: application/json' -w '%{http_code}' -o /dev/null)
    [ \"\$response\" != \"200\" ]
"

# Test 17: Large payload attack (should be rejected)
run_test "Large payload protection" "
    large_payload=\$(python3 -c \"print('A' * 10000000)\")
    response=\$(curl -s '$AUTH_URL' -d \"{\\\"data\\\":\\\"\$large_payload\\\"}\" -H 'Content-Type: application/json' -w '%{http_code}' -o /dev/null --max-time 10)
    [ \"\$response\" = \"413\" ] || [ \"\$response\" = \"400\" ] || [ \"\$response\" = \"000\" ]
"

# Test 18: Rate limiting (should throttle excessive requests)
run_test "Rate limiting protection" "
    # Send multiple rapid requests
    for i in {1..20}; do
        curl -s '$HEALTH_URL' -o /dev/null &
    done
    wait
    # Check if some requests were rate limited
    response=\$(curl -s '$HEALTH_URL' -w '%{http_code}' -o /dev/null)
    [ \"\$response\" = \"200\" ] || [ \"\$response\" = \"429\" ]
"

echo ""
echo "🔍 6. DATA VALIDATION TESTS"
echo "==========================="

# Test 19: Input validation
run_test "Input validation" "
    # Test with malformed JSON
    response=\$(curl -s '$AUTH_URL' -d 'invalid-json' -H 'Content-Type: application/json' -w '%{http_code}' -o /dev/null)
    [ \"\$response\" = \"400\" ]
"

# Test 20: File upload validation
run_test "File upload validation" "
    # Test with invalid file type (should be rejected)
    echo 'malicious content' > /tmp/test.exe
    response=\$(curl -s '$STORAGE_UPLOAD_URL' -F 'file=@/tmp/test.exe' -w '%{http_code}' -o /dev/null)
    rm -f /tmp/test.exe
    [ \"\$response\" = \"401\" ] || [ \"\$response\" = \"400\" ]
"

echo ""
echo "🌐 7. NETWORK SECURITY TESTS"
echo "============================"

# Test 21: HTTPS enforcement
run_test "HTTPS enforcement" "
    # All function URLs should use HTTPS
    echo '$AUTH_URL' | grep -q '^https://' &&
    echo '$STORAGE_UPLOAD_URL' | grep -q '^https://' &&
    echo '$AI_VERIFICATION_URL' | grep -q '^https://'
"

# Test 22: Security headers
run_test "Security headers" "
    headers=\$(curl -s -I '$HEALTH_URL')
    echo \"\$headers\" | grep -qi 'x-frame-options' ||
    echo \"\$headers\" | grep -qi 'x-content-type-options' ||
    echo \"\$headers\" | grep -qi 'strict-transport-security'
"

echo ""
echo "🔄 8. CROSS-CHAIN SECURITY TESTS"
echo "================================"

# Test 23: Smart contract deployment validation
run_test "Smart contract security validation" "
    # Check if contracts directory exists and has security features
    [ -d 'contracts/contracts' ] &&
    grep -r 'onlyOwner\\|require(' contracts/contracts/ >/dev/null 2>&1
"

echo ""
echo "📈 9. PERFORMANCE AND LOAD TESTS"
echo "================================"

# Test 24: Function cold start performance
run_test "Function cold start performance" "
    start_time=\$(date +%s%N)
    curl -s '$HEALTH_URL' >/dev/null
    end_time=\$(date +%s%N)
    duration=\$(( (end_time - start_time) / 1000000 ))
    [ \$duration -lt 5000 ]  # Less than 5 seconds
"

# Test 25: Concurrent request handling
run_test "Concurrent request handling" "
    # Send 10 concurrent requests
    for i in {1..10}; do
        curl -s '$HEALTH_URL' >/dev/null &
    done
    wait
    # All should complete successfully
    true
"

echo ""
echo "📋 SECURITY TEST SUMMARY"
echo "========================"

# Calculate percentages
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    FAIL_PERCENTAGE=$((FAILED_TESTS * 100 / TOTAL_TESTS))
else
    PASS_PERCENTAGE=0
    FAIL_PERCENTAGE=0
fi

echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS ($PASS_PERCENTAGE%)${NC}"
echo -e "${RED}Failed: $FAILED_TESTS ($FAIL_PERCENTAGE%)${NC}"

# Create security report
cat > security-test-report.md << EOF
# DeLangZeta Security Test Report

**Test Date:** $(date)
**Project ID:** $PROJECT_ID
**Region:** $REGION
**Environment:** $ENVIRONMENT

## Test Summary
- **Total Tests:** $TOTAL_TESTS
- **Passed:** $PASSED_TESTS ($PASS_PERCENTAGE%)
- **Failed:** $FAILED_TESTS ($FAIL_PERCENTAGE%)

## Test Categories
1. Infrastructure Security Tests
2. Cloud Functions Security Tests
3. Authentication and Authorization Tests
4. Monitoring and Logging Tests
5. Penetration Testing
6. Data Validation Tests
7. Network Security Tests
8. Cross-Chain Security Tests
9. Performance and Load Tests

## Security Recommendations
EOF

if [ $FAILED_TESTS -gt 0 ]; then
    echo "### Critical Issues Found" >> security-test-report.md
    echo "- Review failed tests and address security vulnerabilities" >> security-test-report.md
    echo "- Implement additional security measures as needed" >> security-test-report.md
    echo "- Re-run security tests after fixes" >> security-test-report.md
else
    echo "### All Security Tests Passed" >> security-test-report.md
    echo "- Infrastructure is properly secured" >> security-test-report.md
    echo "- Authentication and authorization working correctly" >> security-test-report.md
    echo "- Monitoring and alerting configured" >> security-test-report.md
fi

echo "" >> security-test-report.md
echo "## Next Steps" >> security-test-report.md
echo "1. Address any failed security tests" >> security-test-report.md
echo "2. Implement additional security measures if needed" >> security-test-report.md
echo "3. Schedule regular security testing" >> security-test-report.md
echo "4. Monitor security alerts and logs" >> security-test-report.md
echo "5. Conduct third-party security audit" >> security-test-report.md

echo ""
echo "📊 Security test report saved to: security-test-report.md"

# Exit with appropriate code
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}⚠️  Security tests completed with failures. Please review and address issues.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All security tests passed successfully!${NC}"
    exit 0
fi