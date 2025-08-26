#!/bin/bash

# DeLangZeta Google Cloud IAM Setup Script
# This script sets up the necessary IAM roles and service accounts

set -e

PROJECT_ID=${1:-"delang-zeta-project"}
REGION=${2:-"us-central1"}

echo "Setting up IAM for DeLangZeta project: $PROJECT_ID"

# Enable required APIs
echo "Enabling required Google Cloud APIs..."
gcloud services enable cloudfunctions.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  aiplatform.googleapis.com \
  translate.googleapis.com \
  speech.googleapis.com \
  firestore.googleapis.com \
  --project=$PROJECT_ID

# Create service accounts
echo "Creating service accounts..."

# Cloud Functions service account
gcloud iam service-accounts create delang-functions-sa \
  --display-name="DeLang Cloud Functions Service Account" \
  --description="Service account for DeLangZeta Cloud Functions" \
  --project=$PROJECT_ID

# Additional Cloud Functions service account (for specialized functions)
# Commented out as we're using single functions service account
# gcloud iam service-accounts create delang-additional-sa \
#   --display-name="DeLang Additional Functions Service Account" \
#   --description="Service account for additional DeLangZeta Cloud Functions" \
#   --project=$PROJECT_ID

# Storage service account
gcloud iam service-accounts create delang-storage-sa \
  --display-name="DeLang Storage Service Account" \
  --description="Service account for DeLangZeta storage operations" \
  --project=$PROJECT_ID

# Assign IAM roles
echo "Assigning IAM roles..."

# Cloud Functions permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Additional permissions for Cloud Functions (if needed)
# All permissions are now consolidated under delang-functions-sa

# Storage permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:delang-storage-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create storage buckets
echo "Creating storage buckets..."
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$PROJECT_ID-datasets
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$PROJECT_ID-temp

# Set bucket permissions
gsutil iam ch serviceAccount:delang-storage-sa@$PROJECT_ID.iam.gserviceaccount.com:objectAdmin gs://$PROJECT_ID-datasets
gsutil iam ch serviceAccount:delang-storage-sa@$PROJECT_ID.iam.gserviceaccount.com:objectAdmin gs://$PROJECT_ID-temp

echo "IAM setup complete for project: $PROJECT_ID"
echo "Service accounts created:"
echo "  - delang-functions-sa@$PROJECT_ID.iam.gserviceaccount.com (for all Cloud Functions)"
echo "  - delang-storage-sa@$PROJECT_ID.iam.gserviceaccount.com (for storage operations)"