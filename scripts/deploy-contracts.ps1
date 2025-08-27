# DeLangZeta Smart Contract Deployment Script (PowerShell)
# Deploy Universal Smart Contract to ZetaChain testnet

param(
    [string]$Network = "testnet",
    [string]$PrivateKey = ""
)

$ErrorActionPreference = "Stop"

Write-Host "🔗 Deploying DeLangZeta Universal Smart Contract to ZetaChain" -ForegroundColor Green
Write-Host "Network: $Network"

# Validate prerequisites
if (!(Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npx not found. Please install Node.js." -ForegroundColor Red
    exit 1
}

if (!$PrivateKey -and !$env:PRIVATE_KEY) {
    Write-Host "⚠️  No private key provided. Using environment variable PRIVATE_KEY" -ForegroundColor Yellow
    if (!$env:PRIVATE_KEY) {
        Write-Host "❌ PRIVATE_KEY environment variable not set" -ForegroundColor Red
        Write-Host "Usage: .\scripts\deploy-contracts.ps1 [testnet|mainnet] [private_key]"
        Write-Host "   or: `$env:PRIVATE_KEY='your_key'; .\scripts\deploy-contracts.ps1 [testnet|mainnet]"
        exit 1
    }
}

# Navigate to contracts directory
if (!(Test-Path "contracts")) {
    Write-Host "❌ Contracts directory not found" -ForegroundColor Red
    exit 1
}

Set-Location "contracts"

# Install dependencies
Write-Host "📦 Installing contract dependencies..." -ForegroundColor Blue
npm install

# Compile contracts
Write-Host "🔨 Compiling smart contracts..." -ForegroundColor Blue
npx hardhat compile

# Run contract tests
Write-Host "🧪 Running contract tests..." -ForegroundColor Blue
npx hardhat test

# Deploy to ZetaChain
Write-Host "🚀 Deploying to ZetaChain $Network..." -ForegroundColor Blue

if ($Network -eq "testnet") {
    # Deploy to ZetaChain Athens testnet
    Write-Host "Deploying to ZetaChain Athens testnet..." -ForegroundColor Yellow
    npx hardhat run scripts/deploy.js --network zetachain-athens
    
    # Verify contract on testnet explorer
    Write-Host "📋 Contract deployed to ZetaChain Athens testnet" -ForegroundColor Green
    Write-Host "Explorer: https://athens.explorer.zetachain.com/" -ForegroundColor Blue
    
} elseif ($Network -eq "mainnet") {
    # Deploy to ZetaChain mainnet
    Write-Host "⚠️  Deploying to ZetaChain mainnet..." -ForegroundColor Yellow
    $confirm = Read-Host "Are you sure you want to deploy to mainnet? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Deployment cancelled" -ForegroundColor Yellow
        Set-Location ".."
        exit 0
    }
    
    npx hardhat run scripts/deploy.js --network zetachain-mainnet
    
    Write-Host "📋 Contract deployed to ZetaChain mainnet" -ForegroundColor Green
    Write-Host "Explorer: https://explorer.zetachain.com/" -ForegroundColor Blue
} else {
    Write-Host "❌ Invalid network. Use 'testnet' or 'mainnet'" -ForegroundColor Red
    Set-Location ".."
    exit 1
}

# Save deployment info
Write-Host "📝 Saving deployment information..." -ForegroundColor Blue

$explorerUrl = if ($Network -eq "testnet") { "https://athens.explorer.zetachain.com/" } else { "https://explorer.zetachain.com/" }

$deploymentInfo = @{
    network = $Network
    deploymentDate = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    contracts = @{
        DeLangZetaUniversal = @{
            address = "TBD"
            transactionHash = "TBD"
        }
    }
    explorer = $explorerUrl
} | ConvertTo-Json -Depth 3

$deploymentInfo | Out-File -FilePath "..\deployment-info.json" -Encoding UTF8

Set-Location ".."

Write-Host ""
Write-Host "✅ Smart contract deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Deployment Summary:" -ForegroundColor Blue
Write-Host "  Network: $Network"
Write-Host "  Contract: DeLangZetaUniversal"
Write-Host "  Deployment Info: deployment-info.json"
Write-Host ""
Write-Host "🔧 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update frontend configuration with contract address"
Write-Host "2. Test cross-chain functionality"
Write-Host "3. Verify contract on block explorer"
Write-Host "4. Set up contract monitoring"