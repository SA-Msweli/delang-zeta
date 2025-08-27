#!/bin/bash

# DeLangZeta Production Deployment Script
# Task 13.1: Set up production Google Cloud environment

set -e

# Configuration
PROJECT_ID=${1:-"delang-zeta-prod"}
REGION=${2:-"us-central1"}
ENVIRONMENT="production"
ALERT_EMAIL=${3:-"admin@delang-zeta.com"}

echo "🚀 Deploying DeLangZeta to Production Environment"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Environment: $ENVIRONMENT"
echo "Alert Email: $ALERT_EMAIL"

# Validate prerequisites
echo "🔍 Validating prerequisites..."
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI not found. Please install gcloud."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js."
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable \
    cloudfunctions.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com \
    aiplatform.googleapis.com \
    translate.googleapis.com \
    speech.googleapis.com \
    firestore.googleapis.com \
    cloudkms.googleapis.com \
    logging.googleapis.com \
    monitoring.googleapis.com \
    cloudbuild.googleapis.com \
    --project=$PROJECT_ID

# Set up IAM and service accounts
echo "🔐 Setting up IAM and service accounts..."
export GOOGLE_CLOUD_PROJECT=$PROJECT_ID
export REGION=$REGION
export ALERT_EMAIL=$ALERT_EMAIL
chmod +x gcp/iam-setup.sh
./gcp/iam-setup.sh $PROJECT_ID $REGION

# Set up Secret Manager
echo "🔑 Setting up Secret Manager..."
chmod +x gcp/secret-manager-setup.sh
./gcp/secret-manager-setup.sh $PROJECT_ID

# Set up secure storage architecture
echo "🗄️ Setting up secure storage architecture..."
chmod +x gcp/storage-setup.sh
./gcp/storage-setup.sh

# Set up monitoring and alerting
echo "📊 Setting up monitoring and alerting..."
chmod +x gcp/monitoring-setup.sh
./gcp/monitoring-setup.sh

# Build and test all Cloud Functions
echo "🏗️ Building and testing Cloud Functions..."

# Auth functions
echo "Building auth functions..."
cd functions/auth
npm ci --production=false
npm run build
npm test
cd ../../

# Storage functions
echo "Building storage functions..."
cd functions/storage
npm ci --production=false
npm run build
npm test
cd ../../

# AI functions
echo "Building AI functions..."
cd functions/ai
pip install -r requirements.txt
python run_tests.py
cd ../../

# Realtime functions
echo "Building realtime functions..."
cd functions/realtime
npm ci --production=false
npm run build
npm test
cd ../../

# Monitoring functions
echo "Building monitoring functions..."
cd functions/monitoring
npm ci --production=false
npm run build
cd ../../

# Deploy Cloud Functions with production configuration
echo "☁️ Deploying Cloud Functions to production..."

# Deploy auth functions
echo "Deploying auth functions..."
gcloud functions deploy delang-auth \
    --source=functions/auth \
    --runtime=nodejs18 \
    --trigger=http \
    --entry-point=authHandler \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$PROJECT_ID \
    --memory=512MB \
    --timeout=60s \
    --max-instances=100 \
    --region=$REGION \
    --project=$PROJECT_ID

gcloud functions deploy delang-auth-refresh \
    --source=functions/auth \
    --runtime=nodejs18 \
    --trigger=http \
    --entry-point=refreshHandler \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$PROJECT_ID \
    --memory=256MB \
    --timeout=30s \
    --max-instances=50 \
    --region=$REGION \
    --project=$PROJECT_ID

# Deploy storage functions
echo "Deploying storage functions..."
gcloud functions deploy delang-storage-upload \
    --source=functions/storage \
    --runtime=nodejs18 \
    --trigger=http \
    --entry-point=uploadHandler \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$PROJECT_ID \
    --memory=1GB \
    --timeout=300s \
    --max-instances=50 \
    --region=$REGION \
    --project=$PROJECT_ID

gcloud functions deploy delang-storage-download \
    --source=functions/storage \
    --runtime=nodejs18 \
    --trigger=http \
    --entry-point=downloadHandler \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$PROJECT_ID \
    --memory=512MB \
    --timeout=60s \
    --max-instances=100 \
    --region=$REGION \
    --project=$PROJECT_ID

gcloud functions deploy delang-storage-metadata \
    --source=functions/storage \
    --runtime=nodejs18 \
    --trigger=http \
    --entry-point=metadataHandler \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$PROJECT_ID \
    --memory=256MB \
    --timeout=30s \
    --max-instances=100 \
    --region=$REGION \
    --project=$PROJECT_ID

# Deploy AI functions
echo "Deploying AI functions..."
gcloud functions deploy delang-ai-verification \
    --source=functions/ai \
    --runtime=python39 \
    --trigger=http \
    --entry-point=verify_data \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=ENVIRONMENT=production,PROJECT_ID=$PROJECT_ID \
    --memory=1GB \
    --timeout=300s \
    --max-instances=20 \
    --region=$REGION \
    --project=$PROJECT_ID

gcloud functions deploy delang-ai-translate \
    --source=functions/ai \
    --runtime=python39 \
    --trigger=http \
    --entry-point=translate_text \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=ENVIRONMENT=production,PROJECT_ID=$PROJECT_ID \
    --memory=512MB \
    --timeout=60s \
    --max-instances=50 \
    --region=$REGION \
    --project=$PROJECT_ID

gcloud functions deploy delang-ai-speech \
    --source=functions/ai \
    --runtime=python39 \
    --trigger=http \
    --entry-point=transcribe_audio \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=ENVIRONMENT=production,PROJECT_ID=$PROJECT_ID \
    --memory=1GB \
    --timeout=300s \
    --max-instances=20 \
    --region=$REGION \
    --project=$PROJECT_ID

# Deploy realtime functions
echo "Deploying realtime functions..."
gcloud functions deploy delang-realtime-sync \
    --source=functions/realtime \
    --runtime=nodejs18 \
    --trigger=http \
    --entry-point=syncHandler \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$PROJECT_ID \
    --memory=512MB \
    --timeout=60s \
    --max-instances=100 \
    --region=$REGION \
    --project=$PROJECT_ID

gcloud functions deploy delang-realtime-notifications \
    --source=functions/realtime \
    --runtime=nodejs18 \
    --trigger=http \
    --entry-point=notificationHandler \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$PROJECT_ID \
    --memory=256MB \
    --timeout=30s \
    --max-instances=200 \
    --region=$REGION \
    --project=$PROJECT_ID

# Deploy monitoring functions
echo "Deploying monitoring functions..."
gcloud functions deploy delang-monitoring-health \
    --source=functions/monitoring \
    --runtime=nodejs18 \
    --trigger=http \
    --entry-point=healthHandler \
    --service-account=delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$PROJECT_ID \
    --memory=256MB \
    --timeout=30s \
    --max-instances=10 \
    --region=$REGION \
    --project=$PROJECT_ID

# Build frontend for production
echo "🌐 Building frontend for production..."
npm ci --production=false
npm run build

# Create deployment summary
echo "📋 Creating deployment summary..."
cat > deployment-summary.md << EOF
# DeLangZeta Production Deployment Summary

**Deployment Date:** $(date)
**Project ID:** $PROJECT_ID
**Region:** $REGION
**Environment:** $ENVIRONMENT

## Deployed Cloud Functions

### Authentication Functions
- \`delang-auth\`: Main authentication handler
- \`delang-auth-refresh\`: Token refresh handler

### Storage Functions
- \`delang-storage-upload\`: Secure file upload handler
- \`delang-storage-download\`: Secure file download handler
- \`delang-storage-metadata\`: File metadata handler

### AI Functions
- \`delang-ai-verification\`: Gemini 2.5 Flash verification
- \`delang-ai-translate\`: Google Translate integration
- \`delang-ai-speech\`: Speech-to-Text processing

### Realtime Functions
- \`delang-realtime-sync\`: Real-time data synchronization
- \`delang-realtime-notifications\`: Push notifications

### Monitoring Functions
- \`delang-monitoring-health\`: Health check endpoint

## Infrastructure Components

### Storage Buckets
- \`$PROJECT_ID-datasets\`: Main data storage
- \`$PROJECT_ID-metadata\`: Metadata storage
- \`$PROJECT_ID-audit-logs\`: Audit logging

### Security Features
- ✅ Cloud KMS encryption
- ✅ IAM service accounts with minimal permissions
- ✅ Secret Manager for API keys
- ✅ Uniform bucket-level access
- ✅ Audit logging enabled

### Monitoring & Alerting
- ✅ Comprehensive monitoring dashboard
- ✅ Security alert policies
- ✅ Performance monitoring
- ✅ Cost monitoring

## Next Steps
1. Update Secret Manager with actual API keys
2. Deploy smart contracts to ZetaChain testnet
3. Run security testing suite
4. Configure frontend with production endpoints
5. Perform load testing

## Function URLs
EOF

# Get function URLs and add to summary
echo "### Function URLs" >> deployment-summary.md
for func in delang-auth delang-auth-refresh delang-storage-upload delang-storage-download delang-storage-metadata delang-ai-verification delang-ai-translate delang-ai-speech delang-realtime-sync delang-realtime-notifications delang-monitoring-health; do
    url=$(gcloud functions describe $func --region=$REGION --project=$PROJECT_ID --format="value(httpsTrigger.url)" 2>/dev/null || echo "Not deployed")
    echo "- \`$func\`: $url" >> deployment-summary.md
done

echo ""
echo "✅ Production deployment completed successfully!"
echo ""
echo "📊 Deployment Summary:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Environment: $ENVIRONMENT"
echo "  Functions Deployed: 11"
echo "  Storage Buckets: 3"
echo "  Service Accounts: 2"
echo ""
echo "📋 Deployment summary saved to: deployment-summary.md"
echo ""
echo "🔧 Next Steps:"
echo "1. Update Secret Manager with actual API keys:"
echo "   gcloud secrets versions add gemini-api-key --data-file=path/to/key"
echo "2. Deploy smart contracts to ZetaChain testnet"
echo "3. Run security testing: ./scripts/security-test.sh $PROJECT_ID"
echo "4. Configure frontend with production endpoints"
echo ""
echo "🌐 Health Check URL:"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/delang-monitoring-health"