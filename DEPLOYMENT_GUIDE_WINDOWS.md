# DeLangZeta Production Deployment Guide - Windows

This guide walks you through deploying and testing the DeLangZeta secure serverless infrastructure on Windows systems using PowerShell.

## Prerequisites

Before starting the deployment, ensure you have:

1. **PowerShell 5.1+** or **PowerShell Core 7+**
2. **Google Cloud CLI** installed and authenticated
3. **Node.js** (v18+) and npm installed
4. **Python** (3.9+) for AI functions
5. **curl** for testing endpoints (or use `Invoke-WebRequest`)
6. **Active Google Cloud Project** with billing enabled

### Installing Prerequisites on Windows

#### Google Cloud CLI
```powershell
# Download and install from: https://cloud.google.com/sdk/docs/install-windows
# Or use Chocolatey:
choco install gcloudsdk

# Authenticate
gcloud auth login
gcloud auth application-default login
```

#### Node.js
```powershell
# Download from: https://nodejs.org/
# Or use Chocolatey:
choco install nodejs

# Verify installation
node --version
npm --version
```

#### Python
```powershell
# Download from: https://python.org/
# Or use Chocolatey:
choco install python

# Verify installation
python --version
pip --version
```

#### curl (if not available)
```powershell
# Usually included in Windows 10+
# Or use Chocolatey:
choco install curl
```

## Quick Start

### Option 1: Complete Deployment and Testing (Recommended)

```powershell
# Run complete deployment with testing
.\scripts\deploy-and-test.ps1 -ProjectId "your-project-id" -Region "us-central1" -AlertEmail "your-email@domain.com"

# Or with custom settings
.\scripts\deploy-and-test.ps1 -ProjectId "delang-zeta-prod" -Region "us-central1" -AlertEmail "admin@delang-zeta.com"
```

### Option 2: Deployment Only (Skip Testing)

```powershell
# Deploy infrastructure only, skip security and load testing
.\scripts\deploy-and-test.ps1 -ProjectId "your-project-id" -Region "us-central1" -AlertEmail "your-email@domain.com" -SkipTests "true"
```

## Step-by-Step Deployment

If you prefer to run each phase separately:

### Phase 1: Infrastructure Deployment

```powershell
# Deploy all Google Cloud infrastructure
.\scripts\deploy-production.ps1 -ProjectId "your-project-id" -Region "us-central1" -AlertEmail "your-email@domain.com"
```

This will:
- Enable required Google Cloud APIs
- Set up IAM roles and service accounts
- Configure Secret Manager
- Create secure storage buckets with KMS encryption
- Deploy all Cloud Functions
- Set up monitoring and alerting

### Phase 2: Smart Contract Deployment

```powershell
# Deploy to ZetaChain testnet
.\scripts\deploy-contracts.ps1 -Network "testnet"

# Or deploy to mainnet (when ready)
$env:PRIVATE_KEY = "your-private-key"
.\scripts\deploy-contracts.ps1 -Network "mainnet"
```

### Phase 3: Validation

```powershell
# Validate complete deployment
.\scripts\validate-deployment.ps1 -ProjectId "your-project-id" -Region "us-central1"
```

### Phase 4: Security Testing

```powershell
# Run comprehensive security tests
.\scripts\security-test.ps1 -ProjectId "your-project-id" -Region "us-central1"
```

### Phase 5: Performance Testing

```powershell
# Run load and performance tests
.\scripts\load-test.ps1 -ProjectId "your-project-id" -Region "us-central1" -ConcurrentUsers 10 -TestDuration 60
```

## Configuration

### Required Secrets

After deployment, update Secret Manager with actual values:

```powershell
# Update API keys (replace with actual keys)
"your-actual-gemini-api-key" | gcloud secrets versions add gemini-api-key --data-file=-
"your-actual-translate-api-key" | gcloud secrets versions add translate-api-key --data-file=-
"your-actual-speech-api-key" | gcloud secrets versions add speech-to-text-api-key --data-file=-

# Update JWT signing key (generate a secure random key)
$jwtKey = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$jwtKey | gcloud secrets versions add jwt-signing-key --data-file=-

# Update ZetaChain private key (for server-side operations)
"your-zetachain-private-key" | gcloud secrets versions add zetachain-private-key --data-file=-
```

### Environment Variables

Create or update your frontend `.env` file with production endpoints:

```powershell
# Create .env file
@"
VITE_PROJECT_ID=your-project-id
VITE_REGION=us-central1
VITE_AUTH_URL=https://us-central1-your-project-id.cloudfunctions.net/delang-auth
VITE_STORAGE_UPLOAD_URL=https://us-central1-your-project-id.cloudfunctions.net/delang-storage-upload
VITE_AI_VERIFICATION_URL=https://us-central1-your-project-id.cloudfunctions.net/delang-ai-verification
"@ | Out-File -FilePath ".env" -Encoding UTF8
```

## Verification

### Health Check

Test that your deployment is working:

```powershell
# Check health endpoint using PowerShell
$healthUrl = "https://us-central1-your-project-id.cloudfunctions.net/delang-monitoring-health"
$response = Invoke-RestMethod -Uri $healthUrl -Method GET
Write-Host "Health Status: $($response.status)"

# Or using curl
curl https://us-central1-your-project-id.cloudfunctions.net/delang-monitoring-health
```

### Function URLs

After deployment, your Cloud Functions will be available at:

- **Health Check**: `https://REGION-PROJECT_ID.cloudfunctions.net/delang-monitoring-health`
- **Authentication**: `https://REGION-PROJECT_ID.cloudfunctions.net/delang-auth`
- **Storage Upload**: `https://REGION-PROJECT_ID.cloudfunctions.net/delang-storage-upload`
- **AI Verification**: `https://REGION-PROJECT_ID.cloudfunctions.net/delang-ai-verification`

## Monitoring

### Google Cloud Console

Access your deployment through:

- **Project Dashboard**: `https://console.cloud.google.com/home/dashboard?project=PROJECT_ID`
- **Cloud Functions**: `https://console.cloud.google.com/functions/list?project=PROJECT_ID`
- **Storage Buckets**: `https://console.cloud.google.com/storage/browser?project=PROJECT_ID`
- **Monitoring**: `https://console.cloud.google.com/monitoring?project=PROJECT_ID`
- **Logs**: `https://console.cloud.google.com/logs?project=PROJECT_ID`

### Alerts

Monitoring alerts are automatically configured and will be sent to the email address you specified during deployment.

## Troubleshooting

### Common Windows-Specific Issues

1. **PowerShell Execution Policy**: Enable script execution
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. **Path Issues**: Ensure all tools are in your PATH
   ```powershell
   # Check if tools are available
   Get-Command gcloud, npm, python, curl
   ```

3. **Permission Denied**: Run PowerShell as Administrator if needed
   ```powershell
   # Right-click PowerShell and "Run as Administrator"
   ```

4. **Long Path Issues**: Enable long path support in Windows
   ```powershell
   # Run as Administrator
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```

### Authentication Issues

```powershell
# Re-authenticate with Google Cloud
gcloud auth login
gcloud auth application-default login

# Verify authentication
gcloud auth list
```

### Function Deployment Issues

```powershell
# Check function logs
gcloud functions logs read FUNCTION_NAME --region=REGION --project=PROJECT_ID

# List deployed functions
gcloud functions list --project=PROJECT_ID --region=REGION
```

### Storage Access Issues

```powershell
# Verify bucket permissions
gsutil iam get gs://PROJECT_ID-datasets

# List buckets
gsutil ls -p PROJECT_ID
```

### Getting Help

- Check deployment logs in `deployment-summary.md`
- Review security test results in `security-test-report.md`
- Check performance results in `load-test-report.md`
- View comprehensive report in `final-deployment-report.md`

## Windows-Specific Features

### PowerShell Advantages

- **Colored Output**: Scripts use PowerShell's color capabilities for better readability
- **Object Handling**: Better handling of JSON and structured data
- **Error Handling**: Comprehensive error handling with try-catch blocks
- **Progress Tracking**: Real-time progress indicators
- **Parallel Processing**: Uses PowerShell jobs for concurrent operations

### File Paths

All scripts use Windows-compatible file paths:
- Use backslashes (`\`) for local paths
- Use forward slashes (`/`) for URLs and cloud paths
- Handle both PowerShell and CMD environments

## Security Considerations

### Windows Security

- **Windows Defender**: May flag scripts - add exclusions if needed
- **Firewall**: Ensure outbound HTTPS connections are allowed
- **User Account Control (UAC)**: Some operations may require elevation
- **Antivirus**: Exclude project directory from real-time scanning during deployment

### Production Checklist

- [ ] All API keys updated in Secret Manager
- [ ] Service accounts have minimal required permissions
- [ ] Storage buckets have uniform bucket-level access enabled
- [ ] KMS encryption configured for all buckets
- [ ] Monitoring and alerting configured
- [ ] Security testing completed successfully
- [ ] Load testing shows acceptable performance
- [ ] Windows Defender exclusions configured (if needed)

## Next Steps

After successful deployment:

1. **Update API Keys**: Replace placeholder secrets with production keys
2. **Configure Frontend**: Update frontend with production endpoints
3. **Test Integration**: Perform end-to-end testing
4. **Deploy Smart Contracts**: Deploy to ZetaChain mainnet when ready
5. **User Acceptance Testing**: Begin UAT with stakeholders
6. **Go-Live Planning**: Plan production launch strategy

## Windows Development Environment

### Recommended Tools

- **Windows Terminal**: Modern terminal with tabs and themes
- **PowerShell Core 7+**: Latest PowerShell with cross-platform support
- **Visual Studio Code**: IDE with PowerShell extension
- **Git for Windows**: Version control with Bash emulation
- **Windows Subsystem for Linux (WSL)**: Optional Linux environment

### PowerShell Profile Setup

Create a PowerShell profile for easier development:

```powershell
# Create profile if it doesn't exist
if (!(Test-Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force
}

# Add useful aliases
Add-Content $PROFILE @"
# DeLangZeta aliases
function Deploy-DeLang { .\scripts\deploy-and-test.ps1 @args }
function Test-Security { .\scripts\security-test.ps1 @args }
function Test-Load { .\scripts\load-test.ps1 @args }

# Google Cloud aliases
function gcp { gcloud @args }
function gcf { gcloud functions @args }
function gcs { gsutil @args }
"@

# Reload profile
. $PROFILE
```

## Support

For deployment issues or questions:

1. Check the generated reports for detailed information
2. Review Google Cloud Console logs and monitoring
3. Verify all prerequisites are met
4. Ensure proper authentication and permissions
5. Check Windows-specific troubleshooting section

---

**Task 13 Status**: ✅ Complete - Secure serverless infrastructure deployed and tested on Windows