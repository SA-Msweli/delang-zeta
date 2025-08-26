#!/bin/bash

# DeLangZeta AI Services Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"delang-zeta"}
REGION=${REGION:-"us-central1"}
RUNTIME="python39"

echo -e "${GREEN}🚀 Deploying DeLangZeta AI Services${NC}"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Runtime: $RUNTIME"
echo ""

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ Not authenticated with gcloud. Run 'gcloud auth login'${NC}"
    exit 1
fi

# Set project
echo -e "${YELLOW}📋 Setting project to $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required APIs${NC}"
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable translate.googleapis.com
gcloud services enable speech.googleapis.com
gcloud services enable aiplatform.googleapis.com

# Deploy Gemini Verification Function
echo -e "${YELLOW}📦 Deploying Gemini Verification Function${NC}"
gcloud functions deploy gemini-verification \
    --runtime $RUNTIME \
    --trigger http \
    --entry-point gemini_verification \
    --source . \
    --memory 512MB \
    --timeout 300s \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Gemini Verification Function deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy Gemini Verification Function${NC}"
    exit 1
fi

# Deploy Translate Service Function
echo -e "${YELLOW}📦 Deploying Translate Service Function${NC}"
gcloud functions deploy translate-service \
    --runtime $RUNTIME \
    --trigger http \
    --entry-point translate_text \
    --source . \
    --memory 256MB \
    --timeout 60s \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Translate Service Function deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy Translate Service Function${NC}"
    exit 1
fi

# Deploy Speech-to-Text Function
echo -e "${YELLOW}📦 Deploying Speech-to-Text Function${NC}"
gcloud functions deploy speech-to-text \
    --runtime $RUNTIME \
    --trigger http \
    --entry-point speech_to_text \
    --source . \
    --memory 512MB \
    --timeout 300s \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Speech-to-Text Function deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy Speech-to-Text Function${NC}"
    exit 1
fi

# Deploy AI Results Processor Function
echo -e "${YELLOW}📦 Deploying AI Results Processor Function${NC}"
gcloud functions deploy ai-results-processor \
    --runtime $RUNTIME \
    --trigger http \
    --entry-point process_ai_results \
    --source . \
    --memory 256MB \
    --timeout 60s \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ AI Results Processor Function deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy AI Results Processor Function${NC}"
    exit 1
fi

# Get function URLs
echo -e "${YELLOW}🔗 Getting function URLs${NC}"
echo ""

GEMINI_URL=$(gcloud functions describe gemini-verification --region=$REGION --format="value(httpsTrigger.url)")
TRANSLATE_URL=$(gcloud functions describe translate-service --region=$REGION --format="value(httpsTrigger.url)")
SPEECH_URL=$(gcloud functions describe speech-to-text --region=$REGION --format="value(httpsTrigger.url)")
RESULTS_URL=$(gcloud functions describe ai-results-processor --region=$REGION --format="value(httpsTrigger.url)")

echo "📍 Function URLs:"
echo "   Gemini Verification: $GEMINI_URL"
echo "   Translate Service:   $TRANSLATE_URL"
echo "   Speech-to-Text:      $SPEECH_URL"
echo "   AI Results Processor: $RESULTS_URL"
echo ""

# Test health endpoints
echo -e "${YELLOW}🏥 Testing health endpoints${NC}"

test_health() {
    local url=$1
    local name=$2
    
    echo -n "Testing $name... "
    if curl -s -f "$url/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi
}

test_health "$GEMINI_URL" "Gemini"
test_health "$TRANSLATE_URL" "Translate"
test_health "$SPEECH_URL" "Speech"
test_health "$RESULTS_URL" "Results"

echo ""
echo -e "${GREEN}🎉 All AI Services deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Set up secrets in Secret Manager:"
echo "   gcloud secrets create gemini-api-key --data-file=gemini-key.txt"
echo "   gcloud secrets create jwt-signing-key --data-file=jwt-key.txt"
echo ""
echo "2. Configure IAM permissions for service accounts"
echo ""
echo "3. Update frontend configuration with function URLs"
echo ""
echo "4. Run integration tests to verify functionality"