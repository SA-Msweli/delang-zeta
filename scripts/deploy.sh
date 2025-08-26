#!/bin/bash

# DeLangZeta Deployment Script
set -e

PROJECT_ID=${1:-"delang-zeta-project"}
REGION=${2:-"us-central1"}

echo "🚀 Deploying DeLangZeta to Google Cloud Project: $PROJECT_ID"

# Build frontend
echo "📦 Building frontend..."
npm run build

# Deploy Cloud Functions
echo "☁️ Deploying Cloud Functions..."
cd functions/auth
npm run build
gcloud functions deploy auth-function \
  --runtime nodejs18 \
  --trigger http \
  --allow-unauthenticated \
  --region $REGION \
  --project $PROJECT_ID \
  --source .

cd ../../

# Deploy additional Cloud Functions
echo "☁️ Deploying additional Cloud Functions..."
for func_dir in functions/*/; do
  if [ -d "$func_dir" ] && [ -f "$func_dir/package.json" ]; then
    func_name=$(basename "$func_dir")
    echo "Deploying $func_name function..."
    cd "$func_dir"
    if [ -f "package.json" ] && grep -q '"build"' package.json; then
      npm run build
    fi
    gcloud functions deploy "$func_name" \
      --runtime nodejs18 \
      --trigger http \
      --allow-unauthenticated \
      --region $REGION \
      --project $PROJECT_ID \
      --source .
    cd ../../
  fi
done

# Deploy frontend to Firebase Hosting (optional)
echo "🌐 Frontend built and ready for deployment"
echo "To deploy frontend, configure Firebase Hosting and run: firebase deploy"

echo "✅ Deployment complete!"
echo "Cloud Functions: https://$REGION-$PROJECT_ID.cloudfunctions.net/"