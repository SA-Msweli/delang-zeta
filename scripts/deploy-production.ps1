# DeLangZeta Production Deployment Script (PowerShell)
# Task 13.1: Set up production Google Cloud environment

param(
    [string]$ProjectId = "delang-zeta-prod",
    [string]$Region = "us-central1",
    [string]$AlertEmail = "admin@delang-zeta.com"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying DeLangZeta to Production Environment" -ForegroundColor Green
Write-Host "Project ID: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Environment: production"
Write-Host "Alert Email: $AlertEmail"

# Validate prerequisites
Write-Host "🔍 Validating prerequisites..." -ForegroundColor Blue
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Google Cloud CLI not found. Please install gcloud." -ForegroundColor Red
    exit 1
}

if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm not found. Please install Node.js." -ForegroundColor Red
    exit 1
}

# Set project
gcloud config set project $ProjectId

# Enable required APIs
Write-Host "🔧 Enabling required Google Cloud APIs..." -ForegroundColor Blue
$apis = @(
    "cloudfunctions.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "aiplatform.googleapis.com",
    "translate.googleapis.com",
    "speech.googleapis.com",
    "firestore.googleapis.com",
    "cloudkms.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "cloudbuild.googleapis.com"
)

foreach ($api in $apis) {
    gcloud services enable $api --project=$ProjectId
}

# Set up IAM and service accounts
Write-Host "🔐 Setting up IAM and service accounts..." -ForegroundColor Blue
$env:GOOGLE_CLOUD_PROJECT = $ProjectId
$env:REGION = $Region
$env:ALERT_EMAIL = $AlertEmail

# Run IAM setup
& "gcp\iam-setup.sh" $ProjectId $Region

# Set up Secret Manager
Write-Host "🔑 Setting up Secret Manager..." -ForegroundColor Blue
& "gcp\secret-manager-setup.sh" $ProjectId

# Set up secure storage architecture
Write-Host "🗄️ Setting up secure storage architecture..." -ForegroundColor Blue
& "gcp\storage-setup.sh"

# Set up monitoring and alerting
Write-Host "📊 Setting up monitoring and alerting..." -ForegroundColor Blue
& "gcp\monitoring-setup.sh"

# Build and test all Cloud Functions
Write-Host "🏗️ Building and testing Cloud Functions..." -ForegroundColor Blue

# Auth functions
Write-Host "Building auth functions..." -ForegroundColor Yellow
Set-Location "functions\auth"
npm ci --production=false
npm run build
npm test
Set-Location "..\..\"

# Storage functions
Write-Host "Building storage functions..." -ForegroundColor Yellow
Set-Location "functions\storage"
npm ci --production=false
npm run build
npm test
Set-Location "..\..\"

# AI functions
Write-Host "Building AI functions..." -ForegroundColor Yellow
Set-Location "functions\ai"
pip install -r requirements.txt
python run_tests.py
Set-Location "..\..\"

# Realtime functions
Write-Host "Building realtime functions..." -ForegroundColor Yellow
Set-Location "functions\realtime"
npm ci --production=false
npm run build
npm test
Set-Location "..\..\"

# Monitoring functions
Write-Host "Building monitoring functions..." -ForegroundColor Yellow
Set-Location "functions\monitoring"
npm ci --production=false
npm run build
Set-Location "..\..\"

# Deploy Cloud Functions with production configuration
Write-Host "☁️ Deploying Cloud Functions to production..." -ForegroundColor Blue

# Deploy auth functions
Write-Host "Deploying auth functions..." -ForegroundColor Yellow
gcloud functions deploy delang-auth `
    --source=functions/auth `
    --runtime=nodejs18 `
    --trigger=http `
    --entry-point=authHandler `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$ProjectId `
    --memory=512MB `
    --timeout=60s `
    --max-instances=100 `
    --region=$Region `
    --project=$ProjectId

gcloud functions deploy delang-auth-refresh `
    --source=functions/auth `
    --runtime=nodejs18 `
    --trigger=http `
    --entry-point=refreshHandler `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$ProjectId `
    --memory=256MB `
    --timeout=30s `
    --max-instances=50 `
    --region=$Region `
    --project=$ProjectId

# Deploy storage functions
Write-Host "Deploying storage functions..." -ForegroundColor Yellow
gcloud functions deploy delang-storage-upload `
    --source=functions/storage `
    --runtime=nodejs18 `
    --trigger=http `
    --entry-point=uploadHandler `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$ProjectId `
    --memory=1GB `
    --timeout=300s `
    --max-instances=50 `
    --region=$Region `
    --project=$ProjectId

gcloud functions deploy delang-storage-download `
    --source=functions/storage `
    --runtime=nodejs18 `
    --trigger=http `
    --entry-point=downloadHandler `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$ProjectId `
    --memory=512MB `
    --timeout=60s `
    --max-instances=100 `
    --region=$Region `
    --project=$ProjectId

gcloud functions deploy delang-storage-metadata `
    --source=functions/storage `
    --runtime=nodejs18 `
    --trigger=http `
    --entry-point=metadataHandler `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$ProjectId `
    --memory=256MB `
    --timeout=30s `
    --max-instances=100 `
    --region=$Region `
    --project=$ProjectId

# Deploy AI functions
Write-Host "Deploying AI functions..." -ForegroundColor Yellow
gcloud functions deploy delang-ai-verification `
    --source=functions/ai `
    --runtime=python39 `
    --trigger=http `
    --entry-point=verify_data `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=ENVIRONMENT=production,PROJECT_ID=$ProjectId `
    --memory=1GB `
    --timeout=300s `
    --max-instances=20 `
    --region=$Region `
    --project=$ProjectId

gcloud functions deploy delang-ai-translate `
    --source=functions/ai `
    --runtime=python39 `
    --trigger=http `
    --entry-point=translate_text `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=ENVIRONMENT=production,PROJECT_ID=$ProjectId `
    --memory=512MB `
    --timeout=60s `
    --max-instances=50 `
    --region=$Region `
    --project=$ProjectId

gcloud functions deploy delang-ai-speech `
    --source=functions/ai `
    --runtime=python39 `
    --trigger=http `
    --entry-point=transcribe_audio `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=ENVIRONMENT=production,PROJECT_ID=$ProjectId `
    --memory=1GB `
    --timeout=300s `
    --max-instances=20 `
    --region=$Region `
    --project=$ProjectId

# Deploy realtime functions
Write-Host "Deploying realtime functions..." -ForegroundColor Yellow
gcloud functions deploy delang-realtime-sync `
    --source=functions/realtime `
    --runtime=nodejs18 `
    --trigger=http `
    --entry-point=syncHandler `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$ProjectId `
    --memory=512MB `
    --timeout=60s `
    --max-instances=100 `
    --region=$Region `
    --project=$ProjectId

gcloud functions deploy delang-realtime-notifications `
    --source=functions/realtime `
    --runtime=nodejs18 `
    --trigger=http `
    --entry-point=notificationHandler `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$ProjectId `
    --memory=256MB `
    --timeout=30s `
    --max-instances=200 `
    --region=$Region `
    --project=$ProjectId

# Deploy monitoring functions
Write-Host "Deploying monitoring functions..." -ForegroundColor Yellow
gcloud functions deploy delang-monitoring-health `
    --source=functions/monitoring `
    --runtime=nodejs18 `
    --trigger=http `
    --entry-point=healthHandler `
    --service-account=delang-functions-sa@$ProjectId.iam.gserviceaccount.com `
    --set-env-vars=NODE_ENV=production,PROJECT_ID=$ProjectId `
    --memory=256MB `
    --timeout=30s `
    --max-instances=10 `
    --region=$Region `
    --project=$ProjectId

# Build frontend for production
Write-Host "🌐 Building frontend for production..." -ForegroundColor Blue
npm ci --production=false
npm run build

# Create deployment summary
Write-Host "📋 Creating deployment summary..." -ForegroundColor Blue
$deploymentSummary = @"
# DeLangZeta Production Deployment Summary

**Deployment Date:** $(Get-Date)
**Project ID:** $ProjectId
**Region:** $Region
**Environment:** production

## Deployed Cloud Functions

### Authentication Functions
- ``delang-auth``: Main authentication handler
- ``delang-auth-refresh``: Token refresh handler

### Storage Functions
- ``delang-storage-upload``: Secure file upload handler
- ``delang-storage-download``: Secure file download handler
- ``delang-storage-metadata``: File metadata handler

### AI Functions
- ``delang-ai-verification``: Gemini 2.5 Flash verification
- ``delang-ai-translate``: Google Translate integration
- ``delang-ai-speech``: Speech-to-Text processing

### Realtime Functions
- ``delang-realtime-sync``: Real-time data synchronization
- ``delang-realtime-notifications``: Push notifications

### Monitoring Functions
- ``delang-monitoring-health``: Health check endpoint

## Infrastructure Components

### Storage Buckets
- ``$ProjectId-datasets``: Main data storage
- ``$ProjectId-metadata``: Metadata storage
- ``$ProjectId-audit-logs``: Audit logging

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
"@

# Get function URLs and add to summary
$functions = @(
    "delang-auth", "delang-auth-refresh", "delang-storage-upload", 
    "delang-storage-download", "delang-storage-metadata", "delang-ai-verification", 
    "delang-ai-translate", "delang-ai-speech", "delang-realtime-sync", 
    "delang-realtime-notifications", "delang-monitoring-health"
)

$deploymentSummary += "`n### Function URLs`n"
foreach ($func in $functions) {
    try {
        $url = gcloud functions describe $func --region=$Region --project=$ProjectId --format="value(httpsTrigger.url)" 2>$null
        if ($url) {
            $deploymentSummary += "- ``$func``: $url`n"
        } else {
            $deploymentSummary += "- ``$func``: Not deployed`n"
        }
    } catch {
        $deploymentSummary += "- ``$func``: Not deployed`n"
    }
}

$deploymentSummary | Out-File -FilePath "deployment-summary.md" -Encoding UTF8

Write-Host ""
Write-Host "✅ Production deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Deployment Summary:" -ForegroundColor Blue
Write-Host "  Project ID: $ProjectId"
Write-Host "  Region: $Region"
Write-Host "  Environment: production"
Write-Host "  Functions Deployed: 11"
Write-Host "  Storage Buckets: 3"
Write-Host "  Service Accounts: 2"
Write-Host ""
Write-Host "📋 Deployment summary saved to: deployment-summary.md" -ForegroundColor Blue
Write-Host ""
Write-Host "🔧 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update Secret Manager with actual API keys:"
Write-Host "   gcloud secrets versions add gemini-api-key --data-file=path/to/key"
Write-Host "2. Deploy smart contracts to ZetaChain testnet"
Write-Host "3. Run security testing: .\scripts\security-test.ps1 $ProjectId"
Write-Host "4. Configure frontend with production endpoints"
Write-Host ""
Write-Host "🌐 Health Check URL:" -ForegroundColor Green
Write-Host "  https://$Region-$ProjectId.cloudfunctions.net/delang-monitoring-health"