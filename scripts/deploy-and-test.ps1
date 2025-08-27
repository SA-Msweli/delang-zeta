# DeLangZeta Master Deployment and Testing Script (PowerShell)
# Task 13: Deploy and test secure serverless infrastructure

param(
    [string]$ProjectId = "delang-zeta-prod",
    [string]$Region = "us-central1",
    [string]$AlertEmail = "admin@delang-zeta.com",
    [string]$SkipTests = "false"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 DeLangZeta Master Deployment and Testing" -ForegroundColor Green
Write-Host "============================================"
Write-Host "Project ID: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Alert Email: $AlertEmail"
Write-Host "Skip Tests: $SkipTests"
Write-Host ""

# Track deployment progress
$DeploymentSteps = 0
$CompletedSteps = 0
$FailedSteps = 0

# Function to run deployment step
function Run-Step {
    param(
        [string]$StepName,
        [scriptblock]$StepCommand,
        [bool]$Required = $true
    )
    
    Write-Host "📋 Step $($DeploymentSteps + 1): $StepName" -ForegroundColor Blue
    $script:DeploymentSteps++
    
    try {
        $result = & $StepCommand
        if ($result -ne $false) {
            Write-Host "✅ Completed: $StepName" -ForegroundColor Green
            $script:CompletedSteps++
            Write-Host ""
            return $true
        } else {
            throw "Step returned false"
        }
    } catch {
        Write-Host "❌ Failed: $StepName - $($_.Exception.Message)" -ForegroundColor Red
        $script:FailedSteps++
        
        if ($Required) {
            Write-Host "🛑 Critical step failed. Stopping deployment." -ForegroundColor Red
            exit 1
        } else {
            Write-Host "⚠️  Optional step failed. Continuing..." -ForegroundColor Yellow
        }
        Write-Host ""
        return $false
    }
}

Write-Host "🏗️ PHASE 1: INFRASTRUCTURE DEPLOYMENT" -ForegroundColor Cyan
Write-Host "====================================="

# Step 1: Validate prerequisites
Run-Step "Validate deployment prerequisites" {
    $gcloudAuth = gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>$null | Select-Object -First 1
    if (!$gcloudAuth -or !$gcloudAuth.Contains("@")) {
        throw "Google Cloud authentication required"
    }
    
    if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
        throw "Google Cloud CLI not found"
    }
    
    if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm not found"
    }
    
    if (!(Get-Command curl -ErrorAction SilentlyContinue)) {
        throw "curl not found"
    }
    
    return $true
}

# Step 2: Set Google Cloud project
Run-Step "Set Google Cloud project" {
    gcloud config set project $ProjectId
    gcloud config set compute/region $Region
    return $true
}

# Step 3: Run production deployment
Run-Step "Deploy production infrastructure" {
    & ".\scripts\deploy-production.ps1" -ProjectId $ProjectId -Region $Region -AlertEmail $AlertEmail
    return $LASTEXITCODE -eq 0
}

Write-Host ""
Write-Host "🔗 PHASE 2: SMART CONTRACT DEPLOYMENT" -ForegroundColor Cyan
Write-Host "====================================="

# Step 4: Deploy smart contracts to testnet
Run-Step "Deploy smart contracts to ZetaChain testnet" {
    & ".\scripts\deploy-contracts.ps1" -Network "testnet"
    return $LASTEXITCODE -eq 0
} -Required $false

Write-Host ""
Write-Host "🔍 PHASE 3: DEPLOYMENT VALIDATION" -ForegroundColor Cyan
Write-Host "================================="

# Step 5: Validate deployment
Run-Step "Validate complete deployment" {
    & ".\scripts\validate-deployment.ps1" -ProjectId $ProjectId -Region $Region
    return $LASTEXITCODE -eq 0
}

if ($SkipTests -ne "true") {
    Write-Host ""
    Write-Host "🔒 PHASE 4: SECURITY TESTING" -ForegroundColor Cyan
    Write-Host "============================"
    
    # Step 6: Run security tests
    Run-Step "Run comprehensive security tests" {
        & ".\scripts\security-test.ps1" -ProjectId $ProjectId -Region $Region
        return $LASTEXITCODE -eq 0
    } -Required $false
    
    Write-Host ""
    Write-Host "🚀 PHASE 5: PERFORMANCE TESTING" -ForegroundColor Cyan
    Write-Host "==============================="
    
    # Step 7: Run load tests
    Run-Step "Run load and performance tests" {
        & ".\scripts\load-test.ps1" -ProjectId $ProjectId -Region $Region -ConcurrentUsers 5 -TestDuration 30
        return $LASTEXITCODE -eq 0
    } -Required $false
} else {
    Write-Host ""
    Write-Host "⏭️  Skipping testing phases as requested" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📊 DEPLOYMENT SUMMARY" -ForegroundColor Cyan
Write-Host "===================="

# Calculate success rate
$SuccessRate = if ($DeploymentSteps -gt 0) { [math]::Round(($CompletedSteps * 100) / $DeploymentSteps) } else { 0 }

Write-Host "Total Steps: $DeploymentSteps"
Write-Host "Completed: $CompletedSteps" -ForegroundColor Green
Write-Host "Failed: $FailedSteps" -ForegroundColor Red
Write-Host "Success Rate: $SuccessRate%"

# Create comprehensive deployment report
$finalReport = @"
# DeLangZeta Final Deployment Report

**Deployment Date:** $(Get-Date)
**Project ID:** $ProjectId
**Region:** $Region
**Environment:** Production

## Deployment Summary
- **Total Steps:** $DeploymentSteps
- **Completed Steps:** $CompletedSteps
- **Failed Steps:** $FailedSteps
- **Success Rate:** $SuccessRate%

## Access Information

### Function URLs
- **Health Check:** https://$Region-$ProjectId.cloudfunctions.net/delang-monitoring-health
- **Authentication:** https://$Region-$ProjectId.cloudfunctions.net/delang-auth
- **Storage Upload:** https://$Region-$ProjectId.cloudfunctions.net/delang-storage-upload
- **AI Verification:** https://$Region-$ProjectId.cloudfunctions.net/delang-ai-verification

### Google Cloud Console
- **Project:** https://console.cloud.google.com/home/dashboard?project=$ProjectId
- **Functions:** https://console.cloud.google.com/functions/list?project=$ProjectId
- **Storage:** https://console.cloud.google.com/storage/browser?project=$ProjectId
- **Monitoring:** https://console.cloud.google.com/monitoring?project=$ProjectId

## Next Steps
"@

if ($SuccessRate -eq 100) {
    $finalReport += @"
### 🚀 Ready for Production
1. Update Secret Manager with production API keys
2. Configure frontend with production endpoints
3. Deploy smart contracts to mainnet (when ready)
4. Begin user acceptance testing
5. Set up production monitoring and alerting
6. Plan go-live strategy
"@
} elseif ($SuccessRate -ge 80) {
    $finalReport += @"
### ⚠️ Minor Issues to Address
1. Review and fix failed deployment steps
2. Re-run validation after fixes
3. Complete security and performance testing
4. Address any security or performance issues
"@
} else {
    $finalReport += @"
### ❌ Significant Issues Require Attention
1. Review all failed deployment steps
2. Fix critical infrastructure issues
3. Re-run complete deployment process
4. Do not proceed to production until all issues resolved
"@
}

$finalReport | Out-File -FilePath "final-deployment-report.md" -Encoding UTF8

Write-Host ""
Write-Host "📋 Final deployment report saved to: final-deployment-report.md" -ForegroundColor Blue

# Final status
if ($SuccessRate -eq 100) {
    Write-Host "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "✅ All systems deployed and validated" -ForegroundColor Green
    Write-Host "🚀 Ready for production use" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🔧 IMMEDIATE NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. Update Secret Manager with production API keys:"
    Write-Host "   gcloud secrets versions add gemini-api-key --data-file=path/to/key --project=$ProjectId"
    Write-Host "2. Test health endpoint:"
    Write-Host "   curl https://$Region-$ProjectId.cloudfunctions.net/delang-monitoring-health"
    Write-Host "3. Configure frontend with production endpoints"
    
    exit 0
} elseif ($SuccessRate -ge 80) {
    Write-Host "⚠️  DEPLOYMENT COMPLETED WITH MINOR ISSUES" -ForegroundColor Yellow
    Write-Host "🔧 Address failed steps before production use" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "❌ DEPLOYMENT FAILED" -ForegroundColor Red
    Write-Host "🛑 Critical issues prevent production deployment" -ForegroundColor Red
    exit 2
}