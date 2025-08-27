#!/bin/bash

# DeLangZeta Smart Contract Deployment Script
# Deploy Universal Smart Contract to ZetaChain testnet

set -e

# Configuration
NETWORK=${1:-"testnet"}
PRIVATE_KEY=${2:-""}

echo "🔗 Deploying DeLangZeta Universal Smart Contract to ZetaChain"
echo "Network: $NETWORK"

# Validate prerequisites
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js."
    exit 1
fi

if [ -z "$PRIVATE_KEY" ]; then
    echo "⚠️  No private key provided. Using environment variable PRIVATE_KEY"
    if [ -z "$PRIVATE_KEY" ]; then
        echo "❌ PRIVATE_KEY environment variable not set"
        echo "Usage: $0 [testnet|mainnet] [private_key]"
        echo "   or: PRIVATE_KEY=your_key $0 [testnet|mainnet]"
        exit 1
    fi
fi

# Navigate to contracts directory
cd contracts

# Install dependencies
echo "📦 Installing contract dependencies..."
npm install

# Compile contracts
echo "🔨 Compiling smart contracts..."
npx hardhat compile

# Run contract tests
echo "🧪 Running contract tests..."
npx hardhat test

# Deploy to ZetaChain testnet
echo "🚀 Deploying to ZetaChain $NETWORK..."

if [ "$NETWORK" = "testnet" ]; then
    # Deploy to ZetaChain Athens testnet
    echo "Deploying to ZetaChain Athens testnet..."
    npx hardhat run scripts/deploy.js --network zetachain-athens
    
    # Verify contract on testnet explorer
    echo "📋 Contract deployed to ZetaChain Athens testnet"
    echo "Explorer: https://athens.explorer.zetachain.com/"
    
elif [ "$NETWORK" = "mainnet" ]; then
    # Deploy to ZetaChain mainnet
    echo "⚠️  Deploying to ZetaChain mainnet..."
    read -p "Are you sure you want to deploy to mainnet? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Deployment cancelled"
        exit 0
    fi
    
    npx hardhat run scripts/deploy.js --network zetachain-mainnet
    
    echo "📋 Contract deployed to ZetaChain mainnet"
    echo "Explorer: https://explorer.zetachain.com/"
else
    echo "❌ Invalid network. Use 'testnet' or 'mainnet'"
    exit 1
fi

# Save deployment info
echo "📝 Saving deployment information..."
cat > ../deployment-info.json << EOF
{
  "network": "$NETWORK",
  "deploymentDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {
    "DeLangZetaUniversal": {
      "address": "$(cat deployments/$NETWORK/DeLangZetaUniversal.json | jq -r '.address' 2>/dev/null || echo 'TBD')",
      "transactionHash": "$(cat deployments/$NETWORK/DeLangZetaUniversal.json | jq -r '.transactionHash' 2>/dev/null || echo 'TBD')"
    }
  },
  "explorer": "$([ "$NETWORK" = "testnet" ] && echo "https://athens.explorer.zetachain.com/" || echo "https://explorer.zetachain.com/")"
}
EOF

cd ..

echo ""
echo "✅ Smart contract deployment completed!"
echo ""
echo "📊 Deployment Summary:"
echo "  Network: $NETWORK"
echo "  Contract: DeLangZetaUniversal"
echo "  Deployment Info: deployment-info.json"
echo ""
echo "🔧 Next Steps:"
echo "1. Update frontend configuration with contract address"
echo "2. Test cross-chain functionality"
echo "3. Verify contract on block explorer"
echo "4. Set up contract monitoring"