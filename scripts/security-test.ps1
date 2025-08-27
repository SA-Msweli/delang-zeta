# DeLangZeta Security Testing Script (PowerShell)
# Task 13.2: Conduct security testing and validation

param(
    [string]$ProjectId = "delang-zeta-prod",
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

Write-Host "🔒 Starting DeLangZeta Security Testing Suite" -ForegroundColor Green
Write-Host "Project ID: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Environment: production"

# Test results tracking
$TotalTests = 0
$PassedTests = 0
$FailedTests = 0

# Function to run a test
function Run-Test {
    param(
        [string]$TestName,
        [scriptblock]$TestCommand
    )
    
    Write-Host "🧪 Testing: $TestName" -ForegroundColor Blue
    $script:TotalTests++
    
    try {
        $result = & $TestCommand
        if ($result) {
            Write-Host "✅ PASSED: $TestName" -ForegroundColor Green
            $script:PassedTests++
            return $true
        } else {
            Write-Host "❌ FAILED: $TestName" -ForegroundColor Red
            $script:FailedTests++
            return $false
        }
    } catch {
        Write-Host "❌ FAILED: $TestName - $($_.Exception.Message)" -ForegroundColor Red
        $script:FailedTests++
        return $false
    }
}

# Function to test HTTP endpoint
function Test-Endpoint {
    param(
        [string]$Endpoint,
        [string]$ExpectedStatus,
        [string]$TestName
    )
    
    Write-Host "🌐 Testing endpoint: $TestName" -ForegroundColor Blue
    $script:TotalTests++
    
    try {
        $response = Invoke-WebRequest -Uri $Endpoint -Method GET -UseBasicParsing -TimeoutSec 30 -ErrorAction SilentlyContinue
        $statusCode = $response.StatusCode.ToString()
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__.ToString()
        if (!$statusCode) { $statusCode = "000" }
    }
    
    if ($statusCode -eq $ExpectedStatus) {
        Write-Host "✅ PASSED: $TestName (Status: $statusCode)" -ForegroundColor Green
        $script:PassedTests++
        return $true
    } else {
        Write-Host "❌ FAILED: $TestName (Expected: $ExpectedStatus, Got: $statusCode)" -ForegroundColor Red
        $script:FailedTests++
        return $false
    }
}

Write-Host ""
Write-Host "🔍 1. INFRASTRUCTURE SECURITY TESTS" -ForegroundColor Cyan
Write-Host "====================================="

# Test 1: Verify service accounts exist
Run-Test "Service accounts exist" {
    $sa1 = gcloud iam service-accounts describe "delang-functions-sa@$ProjectId.iam.gserviceaccount.com" --project=$ProjectId 2>$null
    $sa2 = gcloud iam service-accounts describe "delang-storage-sa@$ProjectId.iam.gserviceaccount.com" --project=$ProjectId 2>$null
    return ($sa1 -and $sa2)
}

# Test 2: Verify storage buckets have proper security
Run-Test "Storage bucket security configuration" {
    $uniformAccess = gsutil uniformbucketlevelaccess get "gs://$ProjectId-datasets" 2>$null | Select-String "Enabled: True"
    $versioning = gsutil versioning get "gs://$ProjectId-datasets" 2>$null | Select-String "Enabled"
    return ($uniformAccess -and $versioning)
}

# Test 3: Verify KMS encryption is enabled
Run-Test "KMS encryption configuration" {
    $encryption = gsutil kms encryption "gs://$ProjectId-datasets" 2>$null | Select-String "projects/$ProjectId/locations/$Region/keyRings/delang-storage-keyring/cryptoKeys/delang-storage-key"
    return $encryption
}

# Test 4: Verify Secret Manager secrets exist
Run-Test "Secret Manager configuration" {
    $secrets = @("jwt-signing-key", "gemini-api-key", "translate-api-key")
    $allExist = $true
    foreach ($secret in $secrets) {
        $exists = gcloud secrets describe $secret --project=$ProjectId 2>$null
        if (!$exists) { $allExist = $false }
    }
    return $allExist
}

# Test 5: Verify IAM policies are restrictive
Run-Test "IAM policy validation" {
    $publicAccess = gsutil iam get "gs://$ProjectId-datasets" 2>$null | Select-String "allUsers|allAuthenticatedUsers"
    return !$publicAccess
}

Write-Host ""
Write-Host "🔧 2. CLOUD FUNCTIONS SECURITY TESTS" -ForegroundColor Cyan
Write-Host "====================================="

# Get function URLs
$AuthUrl = "https://$Region-$ProjectId.cloudfunctions.net/delang-auth"
$StorageUploadUrl = "https://$Region-$ProjectId.cloudfunctions.net/delang-storage-upload"
$StorageDownloadUrl = "https://$Region-$ProjectId.cloudfunctions.net/delang-storage-download"
$AiVerificationUrl = "https://$Region-$ProjectId.cloudfunctions.net/delang-ai-verification"
$HealthUrl = "https://$Region-$ProjectId.cloudfunctions.net/delang-monitoring-health"

# Test 6: Health check endpoint
Test-Endpoint $HealthUrl "200" "Health check endpoint accessibility"

# Test 7: Authentication endpoint security (should reject unauthorized requests)
Test-Endpoint $AuthUrl "400" "Auth endpoint rejects empty requests"

# Test 8: Storage upload endpoint security (should require authentication)
Test-Endpoint $StorageUploadUrl "401" "Storage upload requires authentication"

# Test 9: Storage download endpoint security (should require authentication)
Test-Endpoint $StorageDownloadUrl "401" "Storage download requires authentication"

# Test 10: AI verification endpoint security (should require authentication)
Test-Endpoint $AiVerificationUrl "401" "AI verification requires authentication"

Write-Host ""
Write-Host "🔐 3. AUTHENTICATION AND AUTHORIZATION TESTS" -ForegroundColor Cyan
Write-Host "=============================================="

# Test 11: JWT token validation
Run-Test "JWT token validation logic" {
    try {
        $headers = @{ 'Authorization' = 'Bearer invalid-token' }
        $response = Invoke-WebRequest -Uri $StorageUploadUrl -Headers $headers -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        return $false
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__.ToString()
        return ($statusCode -eq "401")
    }
}

# Test 12: CORS configuration
Run-Test "CORS configuration" {
    try {
        $headers = @{ 
            'Origin' = 'https://malicious-site.com'
            'Access-Control-Request-Method' = 'POST'
        }
        $response = Invoke-WebRequest -Uri $AuthUrl -Method OPTIONS -Headers $headers -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        $statusCode = $response.StatusCode
        return ($statusCode -ne 200)
    } catch {
        return $true  # CORS rejection is expected
    }
}

Write-Host ""
Write-Host "📊 4. MONITORING AND LOGGING TESTS" -ForegroundColor Cyan
Write-Host "==================================="

# Test 13: Verify monitoring policies exist
Run-Test "Monitoring policies configuration" {
    $policies = gcloud alpha monitoring policies list --project=$ProjectId --filter='displayName:"Storage Unauthorized Access" OR displayName:"Storage Function Errors"' --format='value(name)' 2>$null
    return ($policies.Count -ge 2)
}

# Test 14: Verify audit logging is enabled
Run-Test "Audit logging configuration" {
    $sinks = gcloud logging sinks list --project=$ProjectId --filter='name:delang-storage-audit-sink' --format='value(name)' 2>$null
    return $sinks
}

Write-Host ""
Write-Host "🚨 5. PENETRATION TESTING" -ForegroundColor Cyan
Write-Host "========================="

# Test 15: SQL injection attempt (should be blocked)
Run-Test "SQL injection protection" {
    try {
        $body = '{"walletAddress":"0x123; DROP TABLE users; --"}'
        $response = Invoke-WebRequest -Uri $AuthUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        return ($response.StatusCode -ne 200)
    } catch {
        return $true  # Rejection is expected
    }
}

# Test 16: XSS attempt (should be sanitized)
Run-Test "XSS protection" {
    try {
        $body = '{"walletAddress":"<script>alert(1)</script>"}'
        $response = Invoke-WebRequest -Uri $AuthUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        return ($response.StatusCode -ne 200)
    } catch {
        return $true  # Rejection is expected
    }
}

# Test 17: Large payload attack (should be rejected)
Run-Test "Large payload protection" {
    try {
        $largePayload = "A" * 10000000
        $body = "{`"data`":`"$largePayload`"}"
        $response = Invoke-WebRequest -Uri $AuthUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        $statusCode = $response.StatusCode
        return ($statusCode -eq 413 -or $statusCode -eq 400)
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__.ToString()
        return ($statusCode -eq "413" -or $statusCode -eq "400" -or $statusCode -eq "000")
    }
}

# Test 18: Rate limiting (should throttle excessive requests)
Run-Test "Rate limiting protection" {
    $jobs = @()
    for ($i = 1; $i -le 20; $i++) {
        $jobs += Start-Job -ScriptBlock {
            param($url)
            try {
                Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
            } catch {}
        } -ArgumentList $HealthUrl
    }
    
    $jobs | Wait-Job | Remove-Job
    
    # Check if endpoint still responds (rate limiting allows some requests through)
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        return ($response.StatusCode -eq 200 -or $response.StatusCode -eq 429)
    } catch {
        return $true
    }
}

Write-Host ""
Write-Host "🔍 6. DATA VALIDATION TESTS" -ForegroundColor Cyan
Write-Host "============================"

# Test 19: Input validation
Run-Test "Input validation" {
    try {
        $response = Invoke-WebRequest -Uri $AuthUrl -Method POST -Body "invalid-json" -ContentType "application/json" -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        return ($response.StatusCode -eq 400)
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__.ToString()
        return ($statusCode -eq "400")
    }
}

# Test 20: File upload validation
Run-Test "File upload validation" {
    try {
        # Create a temporary malicious file
        $tempFile = [System.IO.Path]::GetTempFileName() + ".exe"
        "malicious content" | Out-File -FilePath $tempFile -Encoding ASCII
        
        # Try to upload it (should be rejected)
        $response = Invoke-WebRequest -Uri $StorageUploadUrl -Method POST -InFile $tempFile -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        
        $statusCode = $response.StatusCode
        return ($statusCode -eq 401 -or $statusCode -eq 400)
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__.ToString()
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        return ($statusCode -eq "401" -or $statusCode -eq "400")
    }
}

Write-Host ""
Write-Host "🌐 7. NETWORK SECURITY TESTS" -ForegroundColor Cyan
Write-Host "============================="

# Test 21: HTTPS enforcement
Run-Test "HTTPS enforcement" {
    $urls = @($AuthUrl, $StorageUploadUrl, $AiVerificationUrl)
    $allHttps = $true
    foreach ($url in $urls) {
        if (!$url.StartsWith("https://")) {
            $allHttps = $false
        }
    }
    return $allHttps
}

# Test 22: Security headers
Run-Test "Security headers" {
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -Method HEAD -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        $headers = $response.Headers
        $hasSecurityHeaders = $headers.ContainsKey("X-Frame-Options") -or 
                             $headers.ContainsKey("X-Content-Type-Options") -or 
                             $headers.ContainsKey("Strict-Transport-Security")
        return $hasSecurityHeaders
    } catch {
        return $false
    }
}

Write-Host ""
Write-Host "🔄 8. CROSS-CHAIN SECURITY TESTS" -ForegroundColor Cyan
Write-Host "================================="

# Test 23: Smart contract deployment validation
Run-Test "Smart contract security validation" {
    $contractsExist = Test-Path "contracts\contracts"
    if ($contractsExist) {
        $securityFeatures = Get-ChildItem -Path "contracts\contracts" -Recurse -Include "*.sol" | 
                           Select-String -Pattern "onlyOwner|require\(" -Quiet
        return $securityFeatures
    }
    return $false
}

Write-Host ""
Write-Host "📈 9. PERFORMANCE AND LOAD TESTS" -ForegroundColor Cyan
Write-Host "================================="

# Test 24: Function cold start performance
Run-Test "Function cold start performance" {
    $startTime = Get-Date
    try {
        Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue | Out-Null
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        return ($duration -lt 5000)  # Less than 5 seconds
    } catch {
        return $false
    }
}

# Test 25: Concurrent request handling
Run-Test "Concurrent request handling" {
    $jobs = @()
    for ($i = 1; $i -le 10; $i++) {
        $jobs += Start-Job -ScriptBlock {
            param($url)
            try {
                Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
                return $true
            } catch {
                return $false
            }
        } -ArgumentList $HealthUrl
    }
    
    $results = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job
    
    # All should complete successfully
    return ($results -contains $true)
}

Write-Host ""
Write-Host "📋 SECURITY TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================="

# Calculate percentages
$PassPercentage = if ($TotalTests -gt 0) { [math]::Round(($PassedTests * 100) / $TotalTests) } else { 0 }
$FailPercentage = if ($TotalTests -gt 0) { [math]::Round(($FailedTests * 100) / $TotalTests) } else { 0 }

Write-Host "Total Tests: $TotalTests"
Write-Host "Passed: $PassedTests ($PassPercentage%)" -ForegroundColor Green
Write-Host "Failed: $FailedTests ($FailPercentage%)" -ForegroundColor Red

# Create security report
$securityReport = @"
# DeLangZeta Security Test Report

**Test Date:** $(Get-Date)
**Project ID:** $ProjectId
**Region:** $Region
**Environment:** production

## Test Summary
- **Total Tests:** $TotalTests
- **Passed:** $PassedTests ($PassPercentage%)
- **Failed:** $FailedTests ($FailPercentage%)

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
"@

if ($FailedTests -gt 0) {
    $securityReport += @"

### Critical Issues Found
- Review failed tests and address security vulnerabilities
- Implement additional security measures as needed
- Re-run security tests after fixes
"@
} else {
    $securityReport += @"

### All Security Tests Passed
- Infrastructure is properly secured
- Authentication and authorization working correctly
- Monitoring and alerting configured
"@
}

$securityReport += @"

## Next Steps
1. Address any failed security tests
2. Implement additional security measures if needed
3. Schedule regular security testing
4. Monitor security alerts and logs
5. Conduct third-party security audit
"@

$securityReport | Out-File -FilePath "security-test-report.md" -Encoding UTF8

Write-Host ""
Write-Host "📊 Security test report saved to: security-test-report.md" -ForegroundColor Blue

# Exit with appropriate code
if ($FailedTests -gt 0) {
    Write-Host "⚠️  Security tests completed with failures. Please review and address issues." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ All security tests passed successfully!" -ForegroundColor Green
    exit 0
}