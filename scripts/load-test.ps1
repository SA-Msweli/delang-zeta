# DeLangZeta Load Testing Script (PowerShell)
# Test serverless functions under various load conditions

param(
    [string]$ProjectId = "delang-zeta-prod",
    [string]$Region = "us-central1",
    [int]$ConcurrentUsers = 10,
    [int]$TestDuration = 60
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting DeLangZeta Load Testing" -ForegroundColor Green
Write-Host "Project ID: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Concurrent Users: $ConcurrentUsers"
Write-Host "Test Duration: ${TestDuration}s"

# Function URLs
$BaseUrl = "https://$Region-$ProjectId.cloudfunctions.net"
$HealthUrl = "$BaseUrl/delang-monitoring-health"
$AuthUrl = "$BaseUrl/delang-auth"
$StorageUploadUrl = "$BaseUrl/delang-storage-upload"

# Test results
$TotalRequests = 0
$SuccessfulRequests = 0
$FailedRequests = 0
$TotalResponseTime = 0

# Function to run load test
function Run-LoadTest {
    param(
        [string]$TestName,
        [string]$Url,
        [string]$Method = "GET",
        [string]$Data = "",
        [int]$Concurrent = $ConcurrentUsers,
        [int]$Duration = $TestDuration
    )
    
    Write-Host "🔥 Load Testing: $TestName" -ForegroundColor Blue
    Write-Host "URL: $Url"
    Write-Host "Method: $Method"
    Write-Host "Concurrent Users: $Concurrent"
    Write-Host "Duration: ${Duration}s"
    
    $jobs = @()
    $endTime = (Get-Date).AddSeconds($Duration)
    
    # Start load test workers
    for ($i = 1; $i -le $Concurrent; $i++) {
        $jobs += Start-Job -ScriptBlock {
            param($url, $method, $data, $endTime)
            
            $workerRequests = 0
            $workerSuccessful = 0
            $workerFailed = 0
            $workerTotalTime = 0
            
            while ((Get-Date) -lt $endTime) {
                $startTime = Get-Date
                
                try {
                    if ($method -eq "POST" -and $data) {
                        $response = Invoke-WebRequest -Uri $url -Method POST -Body $data -ContentType "application/json" -UseBasicParsing -TimeoutSec 30 -ErrorAction SilentlyContinue
                    } else {
                        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30 -ErrorAction SilentlyContinue
                    }
                    
                    $statusCode = $response.StatusCode
                } catch {
                    $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 0 }
                }
                
                $endTimeMs = Get-Date
                $responseTime = ($endTimeMs - $startTime).TotalMilliseconds
                
                $workerRequests++
                $workerTotalTime += $responseTime
                
                if ($statusCode -eq 200 -or $statusCode -eq 400 -or $statusCode -eq 401) {
                    $workerSuccessful++
                } else {
                    $workerFailed++
                }
                
                Start-Sleep -Milliseconds 100
            }
            
            return @{
                Requests = $workerRequests
                Successful = $workerSuccessful
                Failed = $workerFailed
                TotalTime = $workerTotalTime
            }
        } -ArgumentList $Url, $Method, $Data, $endTime
    }
    
    Write-Host "Running load test..."
    $results = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job
    
    # Aggregate results
    $testTotalRequests = ($results | Measure-Object -Property Requests -Sum).Sum
    $testSuccessfulRequests = ($results | Measure-Object -Property Successful -Sum).Sum
    $testFailedRequests = ($results | Measure-Object -Property Failed -Sum).Sum
    $testTotalResponseTime = ($results | Measure-Object -Property TotalTime -Sum).Sum
    
    # Calculate metrics
    $successRate = if ($testTotalRequests -gt 0) { [math]::Round(($testSuccessfulRequests * 100) / $testTotalRequests) } else { 0 }
    $avgResponseTime = if ($testTotalRequests -gt 0) { [math]::Round($testTotalResponseTime / $testTotalRequests) } else { 0 }
    $requestsPerSecond = if ($Duration -gt 0) { [math]::Round($testTotalRequests / $Duration) } else { 0 }
    
    # Update global counters
    $script:TotalRequests += $testTotalRequests
    $script:SuccessfulRequests += $testSuccessfulRequests
    $script:FailedRequests += $testFailedRequests
    $script:TotalResponseTime += $testTotalResponseTime
    
    # Display results
    Write-Host "📊 Results for $TestName:" -ForegroundColor Green
    Write-Host "  Total Requests: $testTotalRequests"
    Write-Host "  Successful: $testSuccessfulRequests"
    Write-Host "  Failed: $testFailedRequests"
    Write-Host "  Success Rate: $successRate%"
    Write-Host "  Average Response Time: ${avgResponseTime}ms"
    Write-Host "  Requests/Second: $requestsPerSecond"
    Write-Host ""
}

Write-Host ""
Write-Host "🏁 Starting Load Tests..." -ForegroundColor Cyan
Write-Host "========================="

# Test 1: Health Check Endpoint
Run-LoadTest "Health Check Endpoint" $HealthUrl "GET" "" 5 30

# Test 2: Authentication Endpoint (with invalid data)
Run-LoadTest "Authentication Endpoint" $AuthUrl "POST" '{"walletAddress":"test"}' 3 30

# Test 3: Storage Upload Endpoint (should fail auth)
Run-LoadTest "Storage Upload Endpoint" $StorageUploadUrl "POST" '{"taskId":"test"}' 3 30

# Test 4: High Concurrency Test
Write-Host "🚀 High Concurrency Test" -ForegroundColor Blue
Run-LoadTest "High Concurrency Health Check" $HealthUrl "GET" "" 20 60

Write-Host ""
Write-Host "📊 LOAD TEST SUMMARY" -ForegroundColor Cyan
Write-Host "===================="

# Calculate overall metrics
$OverallSuccessRate = if ($TotalRequests -gt 0) { [math]::Round(($SuccessfulRequests * 100) / $TotalRequests) } else { 0 }
$OverallAvgResponseTime = if ($TotalRequests -gt 0) { [math]::Round($TotalResponseTime / $TotalRequests) } else { 0 }
$OverallRps = if ($TestDuration -gt 0) { [math]::Round($TotalRequests / ($TestDuration * 4)) } else { 0 }  # 4 tests

Write-Host "Total Requests: $TotalRequests"
Write-Host "Successful: $SuccessfulRequests" -ForegroundColor Green
Write-Host "Failed: $FailedRequests" -ForegroundColor Red
Write-Host "Overall Success Rate: $OverallSuccessRate%"
Write-Host "Overall Average Response Time: ${OverallAvgResponseTime}ms"
Write-Host "Overall Requests/Second: $OverallRps"

# Create load test report
$loadTestReport = @"
# DeLangZeta Load Test Report

**Test Date:** $(Get-Date)
**Project ID:** $ProjectId
**Region:** $Region
**Test Configuration:**
- Concurrent Users: $ConcurrentUsers
- Test Duration: ${TestDuration}s per test

## Overall Results
- **Total Requests:** $TotalRequests
- **Successful Requests:** $SuccessfulRequests
- **Failed Requests:** $FailedRequests
- **Success Rate:** $OverallSuccessRate%
- **Average Response Time:** ${OverallAvgResponseTime}ms
- **Requests per Second:** $OverallRps

## Performance Analysis
"@

if ($OverallSuccessRate -ge 95 -and $OverallAvgResponseTime -le 2000) {
    $loadTestReport += @"
### ✅ EXCELLENT PERFORMANCE
- Success rate above 95%
- Average response time under 2 seconds
- System handles load well
"@
} elseif ($OverallSuccessRate -ge 90 -and $OverallAvgResponseTime -le 5000) {
    $loadTestReport += @"
### ⚠️ ACCEPTABLE PERFORMANCE
- Success rate above 90%
- Average response time under 5 seconds
- Consider optimization for better performance
"@
} else {
    $loadTestReport += @"
### ❌ PERFORMANCE ISSUES DETECTED
- Success rate below 90% or response time above 5 seconds
- Significant performance optimization needed
- Review function configuration and resource allocation
"@
}

$loadTestReport | Out-File -FilePath "load-test-report.md" -Encoding UTF8

Write-Host ""
Write-Host "📊 Load test report saved to: load-test-report.md" -ForegroundColor Blue

# Exit with appropriate code
if ($OverallSuccessRate -ge 90 -and $OverallAvgResponseTime -le 5000) {
    Write-Host "✅ Load testing completed successfully!" -ForegroundColor Green
    Write-Host "🚀 System performance is acceptable for production!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Load testing revealed performance issues." -ForegroundColor Red
    Write-Host "🔧 Optimize performance before production deployment." -ForegroundColor Red
    exit 1
}