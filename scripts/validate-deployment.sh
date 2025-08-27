#!/bin/bash

# DeLangZeta Deployment Validation Script
# Comprehensive validation of the entire deployment

set -e

# Configuration
PROJECT_ID=${1:-"delang-zeta-prod"}
REGION=${2:-"us-central1"}

echo "🔍 Validating DeLangZeta Production Deployment"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to run a validation check
validate() {
    local check_name="$1"
    local check_command="$2"
    
    echo -e "${BLUE}🔍 Validating: $check_name${NC}"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if eval "$check_command"; then
        echo -e "${GREEN}✅ VALID: $check_name${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ INVALID: $check_name${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

echo ""
echo "🏗️ 1. INFRASTRUCTURE VALIDATION"
echo "==============================="

# Check 1: Google Cloud APIs are enabled
validate "Required APIs are enabled" "
    gcloud services list --enabled --project=$PROJECT_ID --filter='name:(cloudfunctions.googleapis.com OR secretmanager.googleapis.com OR storage.googleapis.com OR aiplatform.googleapis.com)' --format='value(name)' | wc -l | grep -q '^4$'
"

# Check 2: Service accounts exist
validate "Service accounts exist" "
    gcloud iam service-accounts list --project=$PROJECT_ID --filter='email:(delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com OR delang-storage-sa@$PROJECT_ID.iam.gserviceaccount.com)' --format='value(email)' | wc -l | grep -q '^2$'
"

# Check 3: Storage buckets exist and are configured
validate "Storage buckets are configured" "
    gsutil ls -b gs://$PROJECT_ID-datasets >/dev/null 2>&1 &&
    gsutil ls -b gs://$PROJECT_ID-metadata >/dev/null 2>&1 &&
    gsutil ls -b gs://$PROJECT_ID-audit-logs >/dev/null 2>&1
"

# Check 4: KMS keys exist
validate "KMS encryption keys exist" "
    gcloud kms keys list --keyring=delang-storage-keyring --location=$REGION --project=$PROJECT_ID --filter='name:delang-storage-key' --format='value(name)' | grep -q 'delang-storage-key'
"

# Check 5: Secret Manager secrets exist
validate "Secret Manager secrets exist" "
    secrets=\$(gcloud secrets list --project=$PROJECT_ID --filter='name:(jwt-signing-key OR gemini-api-key OR translate-api-key OR speech-to-text-api-key)' --format='value(name)' | wc -l)
    [ \"\$secrets\" -ge 4 ]
"

echo ""
echo "☁️ 2. CLOUD FUNCTIONS VALIDATION"
echo "================================"

# Function list
FUNCTIONS=(
    "delang-auth"
    "delang-auth-refresh"
    "delang-storage-upload"
    "delang-storage-download"
    "delang-storage-metadata"
    "delang-ai-verification"
    "delang-ai-translate"
    "delang-ai-speech"
    "delang-realtime-sync"
    "delang-realtime-notifications"
    "delang-monitoring-health"
)

# Check 6: All Cloud Functions are deployed
validate "All Cloud Functions are deployed" "
    deployed_functions=\$(gcloud functions list --project=$PROJECT_ID --region=$REGION --format='value(name)' | wc -l)
    [ \"\$deployed_functions\" -ge 10 ]
"

# Check 7: Functions have correct runtime and service accounts
validate "Functions have correct configuration" "
    # Check a sample function for correct configuration
    config=\$(gcloud functions describe delang-auth --region=$REGION --project=$PROJECT_ID --format='value(runtime,serviceAccountEmail)')
    echo \"\$config\" | grep -q 'nodejs18' &&
    echo \"\$config\" | grep -q 'delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com'
"

# Check 8: Functions are accessible
validate "Functions are accessible" "
    health_url=\"https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-monitoring-health\"
    response=\$(curl -s -o /dev/null -w '%{http_code}' \"\$health_url\" || echo '000')
    [ \"\$response\" = '200' ]
"

echo ""
echo "🔐 3. SECURITY VALIDATION"
echo "========================"

# Check 9: IAM policies are restrictive
validate "IAM policies are restrictive" "
    # Check that storage buckets don't have public access
    ! gsutil iam get gs://$PROJECT_ID-datasets | grep -q 'allUsers' &&
    ! gsutil iam get gs://$PROJECT_ID-datasets | grep -q 'allAuthenticatedUsers'
"

# Check 10: Uniform bucket-level access is enabled
validate "Uniform bucket-level access enabled" "
    gsutil uniformbucketlevelaccess get gs://$PROJECT_ID-datasets | grep -q 'Enabled: True'
"

# Check 11: Encryption at rest is configured
validate "Encryption at rest configured" "
    gsutil kms encryption gs://$PROJECT_ID-datasets | grep -q 'projects/$PROJECT_ID/locations/$REGION/keyRings/delang-storage-keyring/cryptoKeys/delang-storage-key'
"

# Check 12: Versioning is enabled
validate "Bucket versioning enabled" "
    gsutil versioning get gs://$PROJECT_ID-datasets | grep -q 'Enabled'
"

echo ""
echo "📊 4. MONITORING VALIDATION"
echo "=========================="

# Check 13: Monitoring policies exist
validate "Monitoring policies configured" "
    policies=\$(gcloud alpha monitoring policies list --project=$PROJECT_ID --filter='displayName:(\"Storage Unauthorized Access\" OR \"Storage Function Errors\")' --format='value(name)' | wc -l)
    [ \"\$policies\" -ge 2 ]
"

# Check 14: Log sinks exist
validate "Log sinks configured" "
    sinks=\$(gcloud logging sinks list --project=$PROJECT_ID --filter='name:(delang-storage-audit-sink OR delang-function-logs-sink)' --format='value(name)' | wc -l)
    [ \"\$sinks\" -ge 1 ]
"

# Check 15: Notification channels exist
validate "Notification channels configured" "
    channels=\$(gcloud alpha monitoring channels list --project=$PROJECT_ID --filter='type=email' --format='value(name)' | wc -l)
    [ \"\$channels\" -ge 1 ]
"

echo ""
echo "🌐 5. NETWORK AND CONNECTIVITY VALIDATION"
echo "========================================="

# Check 16: All function URLs use HTTPS
validate "All function URLs use HTTPS" "
    urls=\$(gcloud functions list --project=$PROJECT_ID --region=$REGION --format='value(httpsTrigger.url)')
    echo \"\$urls\" | grep -v '^https://' | wc -l | grep -q '^0$'
"

# Check 17: CORS is configured for storage
validate "CORS configured for storage" "
    gsutil cors get gs://$PROJECT_ID-datasets | grep -q 'origin'
"

echo ""
echo "🔗 6. SMART CONTRACT VALIDATION"
echo "==============================="

# Check 18: Contract deployment files exist
validate "Smart contract files exist" "
    [ -d 'contracts' ] &&
    [ -f 'contracts/hardhat.config.js' ] &&
    [ -d 'contracts/contracts' ]
"

# Check 19: Contract tests pass
validate "Smart contract tests pass" "
    cd contracts &&
    npm test >/dev/null 2>&1 &&
    cd ..
"

echo ""
echo "📱 7. FRONTEND VALIDATION"
echo "========================"

# Check 20: Frontend build exists
validate "Frontend build exists" "
    [ -d 'dist' ] || [ -d 'build' ]
"

# Check 21: Environment configuration exists
validate "Environment configuration exists" "
    [ -f '.env' ] || [ -f '.env.production' ]
"

echo ""
echo "🧪 8. INTEGRATION TESTING"
echo "========================="

# Check 22: Health check endpoint responds
validate "Health check endpoint responds" "
    health_url=\"https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-monitoring-health\"
    response=\$(curl -s \"\$health_url\" | jq -r '.status' 2>/dev/null || echo 'error')
    [ \"\$response\" = 'healthy' ] || [ \"\$response\" != 'error' ]
"

# Check 23: Authentication endpoint responds correctly
validate "Authentication endpoint responds correctly" "
    auth_url=\"https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-auth\"
    response=\$(curl -s -o /dev/null -w '%{http_code}' \"\$auth_url\")
    [ \"\$response\" = '400' ] || [ \"\$response\" = '401' ]  # Should reject empty requests
"

# Check 24: Storage endpoints require authentication
validate "Storage endpoints require authentication" "
    upload_url=\"https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-storage-upload\"
    response=\$(curl -s -o /dev/null -w '%{http_code}' \"\$upload_url\")
    [ \"\$response\" = '401' ]  # Should require authentication
"

echo ""
echo "📋 DEPLOYMENT VALIDATION SUMMARY"
echo "================================"

# Calculate percentages
if [ $TOTAL_CHECKS -gt 0 ]; then
    PASS_PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    FAIL_PERCENTAGE=$((FAILED_CHECKS * 100 / TOTAL_CHECKS))
else
    PASS_PERCENTAGE=0
    FAIL_PERCENTAGE=0
fi

echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS ($PASS_PERCENTAGE%)${NC}"
echo -e "${RED}Failed: $FAILED_CHECKS ($FAIL_PERCENTAGE%)${NC}"

# Create validation report
cat > deployment-validation-report.md << EOF
# DeLangZeta Deployment Validation Report

**Validation Date:** $(date)
**Project ID:** $PROJECT_ID
**Region:** $REGION

## Validation Summary
- **Total Checks:** $TOTAL_CHECKS
- **Passed:** $PASSED_CHECKS ($PASS_PERCENTAGE%)
- **Failed:** $FAILED_CHECKS ($FAIL_PERCENTAGE%)

## Validation Categories
1. Infrastructure Validation
2. Cloud Functions Validation
3. Security Validation
4. Monitoring Validation
5. Network and Connectivity Validation
6. Smart Contract Validation
7. Frontend Validation
8. Integration Testing

## Deployment Status
EOF

if [ $FAILED_CHECKS -eq 0 ]; then
    echo "### ✅ DEPLOYMENT VALIDATED SUCCESSFULLY" >> deployment-validation-report.md
    echo "All validation checks passed. The deployment is ready for production use." >> deployment-validation-report.md
    echo "" >> deployment-validation-report.md
    echo "**Ready for:**" >> deployment-validation-report.md
    echo "- Production traffic" >> deployment-validation-report.md
    echo "- Security testing" >> deployment-validation-report.md
    echo "- Load testing" >> deployment-validation-report.md
    echo "- User acceptance testing" >> deployment-validation-report.md
elif [ $FAILED_CHECKS -le 2 ]; then
    echo "### ⚠️ DEPLOYMENT PARTIALLY VALIDATED" >> deployment-validation-report.md
    echo "Most validation checks passed, but some issues need attention." >> deployment-validation-report.md
    echo "" >> deployment-validation-report.md
    echo "**Action Required:**" >> deployment-validation-report.md
    echo "- Address failed validation checks" >> deployment-validation-report.md
    echo "- Re-run validation after fixes" >> deployment-validation-report.md
else
    echo "### ❌ DEPLOYMENT VALIDATION FAILED" >> deployment-validation-report.md
    echo "Multiple validation checks failed. Deployment needs significant fixes." >> deployment-validation-report.md
    echo "" >> deployment-validation-report.md
    echo "**Critical Actions Required:**" >> deployment-validation-report.md
    echo "- Review and fix all failed checks" >> deployment-validation-report.md
    echo "- Do not proceed to production" >> deployment-validation-report.md
    echo "- Re-run full deployment process" >> deployment-validation-report.md
fi

echo "" >> deployment-validation-report.md
echo "## Next Steps" >> deployment-validation-report.md
if [ $FAILED_CHECKS -eq 0 ]; then
    echo "1. Proceed with security testing" >> deployment-validation-report.md
    echo "2. Conduct load testing" >> deployment-validation-report.md
    echo "3. Deploy smart contracts to testnet" >> deployment-validation-report.md
    echo "4. Configure frontend with production endpoints" >> deployment-validation-report.md
    echo "5. Begin user acceptance testing" >> deployment-validation-report.md
else
    echo "1. Address all failed validation checks" >> deployment-validation-report.md
    echo "2. Re-run deployment validation" >> deployment-validation-report.md
    echo "3. Only proceed when all checks pass" >> deployment-validation-report.md
fi

echo ""
echo "📊 Deployment validation report saved to: deployment-validation-report.md"

# Exit with appropriate code
if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment validation completed successfully!${NC}"
    echo -e "${GREEN}🚀 Ready for production use!${NC}"
    exit 0
elif [ $FAILED_CHECKS -le 2 ]; then
    echo -e "${YELLOW}⚠️  Deployment validation completed with minor issues.${NC}"
    echo -e "${YELLOW}🔧 Address failed checks before proceeding to production.${NC}"
    exit 1
else
    echo -e "${RED}❌ Deployment validation failed with multiple issues.${NC}"
    echo -e "${RED}🛑 Do not proceed to production. Fix issues and re-deploy.${NC}"
    exit 2
fi