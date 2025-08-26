#!/bin/bash

# DeLangZeta Secret Manager Setup Script
# This script creates the necessary secrets in Google Secret Manager

set -e

PROJECT_ID=${1:-"delang-zeta-project"}

echo "Setting up Secret Manager for DeLangZeta project: $PROJECT_ID"

# Create secrets (with placeholder values - replace with actual values)
echo "Creating secrets..."

# JWT signing key
echo "jwt-signing-key-placeholder" | gcloud secrets create jwt-signing-key \
  --data-file=- \
  --project=$PROJECT_ID

# Gemini API key
echo "gemini-api-key-placeholder" | gcloud secrets create gemini-api-key \
  --data-file=- \
  --project=$PROJECT_ID

# Google Translate API key
echo "translate-api-key-placeholder" | gcloud secrets create translate-api-key \
  --data-file=- \
  --project=$PROJECT_ID

# Speech-to-Text API key
echo "speech-to-text-api-key-placeholder" | gcloud secrets create speech-to-text-api-key \
  --data-file=- \
  --project=$PROJECT_ID

# Database credentials
echo '{"host":"localhost","user":"placeholder","password":"placeholder"}' | gcloud secrets create database-credentials \
  --data-file=- \
  --project=$PROJECT_ID

# ZetaChain private key (for server-side operations)
echo "zetachain-private-key-placeholder" | gcloud secrets create zetachain-private-key \
  --data-file=- \
  --project=$PROJECT_ID

echo "Secret Manager setup complete!"
echo "Created secrets:"
echo "  - jwt-signing-key"
echo "  - gemini-api-key"
echo "  - translate-api-key"
echo "  - speech-to-text-api-key"
echo "  - database-credentials"
echo "  - zetachain-private-key"
echo ""
echo "IMPORTANT: Replace placeholder values with actual secrets using:"
echo "  gcloud secrets versions add SECRET_NAME --data-file=path/to/secret"