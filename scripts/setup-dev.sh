#!/bin/bash

# DeLangZeta Development Setup Script
set -e

echo "🛠️ Setting up DeLangZeta development environment..."

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install Cloud Functions dependencies
echo "☁️ Installing Cloud Functions dependencies..."
cd functions/auth
npm install
npm run build
cd ../../

# Install additional Cloud Functions dependencies
echo "☁️ Installing additional Cloud Functions dependencies..."
for func_dir in functions/*/; do
  if [ -d "$func_dir" ] && [ -f "$func_dir/package.json" ]; then
    echo "Installing dependencies for $(basename "$func_dir")..."
    cd "$func_dir"
    npm install
    if [ -f "package.json" ] && grep -q '"build"' package.json; then
      npm run build
    fi
    cd ../../
  fi
done

# Run tests
echo "🧪 Running tests..."
npm test

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file from template..."
  cp .env.example .env
  echo "⚠️  Please update .env with your actual configuration values"
fi

echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your configuration"
echo "2. Set up Google Cloud project: ./gcp/iam-setup.sh your-project-id"
echo "3. Set up Secret Manager: ./gcp/secret-manager-setup.sh your-project-id"
echo "4. Start development server: npm run dev"