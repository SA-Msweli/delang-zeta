# DeLangZeta Deployment Validation Script (PowerShell)
# Comprehensive validation of the entire deployment

param(
    [string]$ProjectId = "delang-zeta-prod",
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

Write-Host "🔍 Validating DeLangZeta Production Deployment" -ForegroundColor Green
Write-Host "Project ID: $ProjectId"
Write-Host "Region: $Region"

# Test results tracking
$TotalChecks = 0
$PassedChecks = 0
$FailedChecks = 0

# Function to run a validation check
function Validate {
    param(
        [string]$CheckName,
        [scriptblock]$CheckCommand
    )
    
    Write-Host "🔍 Validating: $CheckName" -ForegroundColor Blue
    $script:TotalChecks++
    
    try {
        $result = & $CheckCommand
        if ($result) {
            Write-Host "✅ VALID: $CheckName" -ForegroundColor Green
            $script:PassedChecks++
            return $true
        } else {
            Write-Host "❌ INVALID: $CheckName" -ForegroundColor Red
            $script:FailedChecks++
            return $false
        }
    } catch {
        Write-Host "❌ INVALID: $CheckName - $($_.Exception.Message)" -ForegroundColor Red
        $script:FailedChecks++
        return $false
    }
}

Write-Host ""
Write-Host "🏗️ 1. INFRASTRUCTURE VALIDATION" -ForegroundColor Cyan
Write-Host "================================"

# Check 1: Google Cloud APIs are enabled
Validate "Required APIs are enabled" {
    $apis = gcloud services list --enabled --project=$ProjectId --filter='name:(cloudfunctions.googleapis.com OR secretmanager.googleapis.com OR storage.googleapis.com OR aiplatform.googleapis.com)' --format='value(name)' 2>$null
    return ($apis.Count -ge 4)
}

# Check 2: Service accounts exist
Validate "Service accounts exist" {
    $serviceAccounts = gcloud iam service-accounts list --project=$ProjectId --filter='email:(delang-functions-sa@ OR delang-storage-sa@)' --format='value(email)' 2>$null
    return ($serviceAccounts.Count -ge 2)
}

# Check 3: Storage buckets exist and are configured
Validate "Storage buckets are configured" {
    $bucket1 = gsutil ls -b "gs://$ProjectId-datasets" 2>$null
    $bucket2 = gsutil ls -b "gs://$ProjectId-metadata" 2>$null
    $bucket3 = gsutil ls -b "gs://$ProjectId-audit-logs" 2>$null
    return ($bucket1 -and $bucket2 -and $bucket3)
}

Write-Host ""
Write-Host "☁️ 2. CLOUD FUNCTIONS VALIDATION" -ForegroundColor Cyan
Write-Host "================================="

# Check 4: All Cloud Functions are deployed
Validate "All Cloud Functions are deployed" {
    $functions = gcloud functions list --project=$ProjectId --region=$Region --format='value(name)' 2>$null
    return ($functions.Count -ge 10)
}

Write-Host ""
Write-Host "🔐 3. SECURITY VALIDATION" -ForegroundColor Cyan
Write-Host "========================="

# Check 5: IAM policies are restrictive
Validate "IAM policies are restrictive" {
    $publicAccess = gsutil iam get "gs://$ProjectId-datasets" 2>$null | Select-String "allUsers|allAuthenticatedUsers"
    return !$publicAccess
}

Write-Host ""
Write-Host "📊 DEPLOYMENT VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "================================="

# Calculate percentages
$PassPercentage = if ($TotalChecks -gt 0) { [math]::Round(($PassedChecks * 100) / $TotalChecks) } else { 0 }
$FailPercentage = if ($TotalChecks -gt 0) { [math]::Round(($FailedChecks * 100) / $TotalChecks) } else { 0 }

Write-Host "Total Checks: $TotalChecks"
Write-Host "Passed: $PassedChecks ($PassPercentage%)" -ForegroundColor Green
Write-Host "Failed: $FailedChecks ($FailPercentage%)" -ForegroundColor Red

# Exit with appropriate code
if ($FailedChecks -eq 0) {
    Write-Host "✅ Deployment validation completed successfully!" -ForegroundColor Green
    Write-Host "🚀 Ready for production use!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Deployment validation failed with issues." -ForegroundColor Red
    Write-Host "🛑 Address issues before proceeding to production." -ForegroundColor Red
    exit 1
}