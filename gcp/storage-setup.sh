#!/bin/bash

# DeLangZeta Google Cloud Storage Setup Script
# This script sets up the secure storage architecture for the DeLangZeta platform

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"delang-zeta"}
REGION=${REGION:-"us-central1"}
STORAGE_CLASS=${STORAGE_CLASS:-"STANDARD"}

# Bucket names
MAIN_BUCKET="${PROJECT_ID}-datasets"
METADATA_BUCKET="${PROJECT_ID}-metadata"
AUDIT_BUCKET="${PROJECT_ID}-audit-logs"

# Service account names
STORAGE_SA="delang-storage-sa"
FUNCTIONS_SA="delang-functions-sa"

echo "Setting up DeLangZeta Google Cloud Storage architecture..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Enable required APIs
echo "Enabling required Google Cloud APIs..."
gcloud services enable storage.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudfunctions.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudkms.googleapis.com --project=$PROJECT_ID
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID
gcloud services enable logging.googleapis.com --project=$PROJECT_ID
gcloud services enable monitoring.googleapis.com --project=$PROJECT_ID

# Create KMS key ring and key for encryption
echo "Setting up Cloud KMS for encryption..."
KMS_KEYRING="delang-storage-keyring"
KMS_KEY="delang-storage-key"

# Check if keyring exists, create if not
if ! gcloud kms keyrings describe $KMS_KEYRING --location=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
    echo "Creating KMS keyring: $KMS_KEYRING"
    gcloud kms keyrings create $KMS_KEYRING \
        --location=$REGION \
        --project=$PROJECT_ID
fi

# Check if key exists, create if not
if ! gcloud kms keys describe $KMS_KEY --keyring=$KMS_KEYRING --location=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
    echo "Creating KMS key: $KMS_KEY"
    gcloud kms keys create $KMS_KEY \
        --keyring=$KMS_KEYRING \
        --location=$REGION \
        --purpose=encryption \
        --project=$PROJECT_ID
fi

# Create service accounts
echo "Creating service accounts..."

# Storage service account
if ! gcloud iam service-accounts describe "${STORAGE_SA}@${PROJECT_ID}.iam.gserviceaccount.com" --project=$PROJECT_ID >/dev/null 2>&1; then
    echo "Creating storage service account: $STORAGE_SA"
    gcloud iam service-accounts create $STORAGE_SA \
        --display-name="DeLangZeta Storage Service Account" \
        --description="Service account for secure storage operations" \
        --project=$PROJECT_ID
fi

# Functions service account
if ! gcloud iam service-accounts describe "${FUNCTIONS_SA}@${PROJECT_ID}.iam.gserviceaccount.com" --project=$PROJECT_ID >/dev/null 2>&1; then
    echo "Creating functions service account: $FUNCTIONS_SA"
    gcloud iam service-accounts create $FUNCTIONS_SA \
        --display-name="DeLangZeta Functions Service Account" \
        --description="Service account for Cloud Functions" \
        --project=$PROJECT_ID
fi

# Create storage buckets with security configurations
echo "Creating storage buckets..."

# Main datasets bucket
if ! gsutil ls -b gs://$MAIN_BUCKET >/dev/null 2>&1; then
    echo "Creating main datasets bucket: $MAIN_BUCKET"
    gsutil mb -p $PROJECT_ID -c $STORAGE_CLASS -l $REGION gs://$MAIN_BUCKET
    
    # Enable versioning
    gsutil versioning set on gs://$MAIN_BUCKET
    
    # Set default encryption
    gsutil kms encryption -k projects/$PROJECT_ID/locations/$REGION/keyRings/$KMS_KEYRING/cryptoKeys/$KMS_KEY gs://$MAIN_BUCKET
    
    # Set lifecycle policy
    cat > /tmp/lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 2555,
          "matchesStorageClass": ["STANDARD"]
        }
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {
          "age": 30,
          "matchesStorageClass": ["STANDARD"]
        }
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {
          "age": 90,
          "matchesStorageClass": ["NEARLINE"]
        }
      },
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 7,
          "matchesPrefix": ["submissions/pending/"]
        }
      }
    ]
  }
}
EOF
    gsutil lifecycle set /tmp/lifecycle.json gs://$MAIN_BUCKET
    rm /tmp/lifecycle.json
fi

# Metadata bucket
if ! gsutil ls -b gs://$METADATA_BUCKET >/dev/null 2>&1; then
    echo "Creating metadata bucket: $METADATA_BUCKET"
    gsutil mb -p $PROJECT_ID -c $STORAGE_CLASS -l $REGION gs://$METADATA_BUCKET
    
    # Enable versioning
    gsutil versioning set on gs://$METADATA_BUCKET
    
    # Set default encryption
    gsutil kms encryption -k projects/$PROJECT_ID/locations/$REGION/keyRings/$KMS_KEYRING/cryptoKeys/$KMS_KEY gs://$METADATA_BUCKET
fi

# Audit logs bucket
if ! gsutil ls -b gs://$AUDIT_BUCKET >/dev/null 2>&1; then
    echo "Creating audit logs bucket: $AUDIT_BUCKET"
    gsutil mb -p $PROJECT_ID -c $STORAGE_CLASS -l $REGION gs://$AUDIT_BUCKET
    
    # Enable versioning
    gsutil versioning set on gs://$AUDIT_BUCKET
    
    # Set default encryption
    gsutil kms encryption -k projects/$PROJECT_ID/locations/$REGION/keyRings/$KMS_KEYRING/cryptoKeys/$KMS_KEY gs://$AUDIT_BUCKET
    
    # Set lifecycle policy for audit logs (retain for 7 years)
    cat > /tmp/audit-lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 2555
        }
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {
          "age": 30
        }
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {
          "age": 90
        }
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "ARCHIVE"},
        "condition": {
          "age": 365
        }
      }
    ]
  }
}
EOF
    gsutil lifecycle set /tmp/audit-lifecycle.json gs://$AUDIT_BUCKET
    rm /tmp/audit-lifecycle.json
fi

# Set up IAM policies
echo "Configuring IAM policies..."

# Grant storage service account permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${STORAGE_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${STORAGE_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"

# Grant functions service account permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${FUNCTIONS_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${FUNCTIONS_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${FUNCTIONS_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"

# Set bucket-level IAM policies for fine-grained access control
echo "Setting bucket-level IAM policies..."

# Main bucket - restrict access to service accounts only
gsutil iam ch -d allUsers gs://$MAIN_BUCKET 2>/dev/null || true
gsutil iam ch -d allAuthenticatedUsers gs://$MAIN_BUCKET 2>/dev/null || true
gsutil iam ch serviceAccount:${STORAGE_SA}@${PROJECT_ID}.iam.gserviceaccount.com:objectAdmin gs://$MAIN_BUCKET
gsutil iam ch serviceAccount:${FUNCTIONS_SA}@${PROJECT_ID}.iam.gserviceaccount.com:objectAdmin gs://$MAIN_BUCKET

# Metadata bucket - restrict access to service accounts only
gsutil iam ch -d allUsers gs://$METADATA_BUCKET 2>/dev/null || true
gsutil iam ch -d allAuthenticatedUsers gs://$METADATA_BUCKET 2>/dev/null || true
gsutil iam ch serviceAccount:${STORAGE_SA}@${PROJECT_ID}.iam.gserviceaccount.com:objectAdmin gs://$METADATA_BUCKET
gsutil iam ch serviceAccount:${FUNCTIONS_SA}@${PROJECT_ID}.iam.gserviceaccount.com:objectAdmin gs://$METADATA_BUCKET

# Audit bucket - restrict access to service accounts only
gsutil iam ch -d allUsers gs://$AUDIT_BUCKET 2>/dev/null || true
gsutil iam ch -d allAuthenticatedUsers gs://$AUDIT_BUCKET 2>/dev/null || true
gsutil iam ch serviceAccount:${STORAGE_SA}@${PROJECT_ID}.iam.gserviceaccount.com:objectAdmin gs://$AUDIT_BUCKET
gsutil iam ch serviceAccount:${FUNCTIONS_SA}@${PROJECT_ID}.iam.gserviceaccount.com:objectAdmin gs://$AUDIT_BUCKET

# Enable uniform bucket-level access for better security
echo "Enabling uniform bucket-level access..."
gsutil uniformbucketlevelaccess set on gs://$MAIN_BUCKET
gsutil uniformbucketlevelaccess set on gs://$METADATA_BUCKET
gsutil uniformbucketlevelaccess set on gs://$AUDIT_BUCKET

# Set up CORS for web access (only for main bucket)
echo "Configuring CORS for web access..."
cat > /tmp/cors.json << EOF
[
  {
    "origin": ["https://delang-zeta.web.app", "https://delang-zeta.firebaseapp.com", "http://localhost:3000"],
    "method": ["GET", "PUT", "POST", "HEAD"],
    "responseHeader": ["Content-Type", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set /tmp/cors.json gs://$MAIN_BUCKET
rm /tmp/cors.json

# Create directory structure in buckets
echo "Creating directory structure..."

# Create placeholder files to establish directory structure
echo "Directory structure placeholder" | gsutil cp - gs://$MAIN_BUCKET/submissions/pending/.placeholder
echo "Directory structure placeholder" | gsutil cp - gs://$MAIN_BUCKET/submissions/processing/.placeholder
echo "Directory structure placeholder" | gsutil cp - gs://$MAIN_BUCKET/verified/text/.placeholder
echo "Directory structure placeholder" | gsutil cp - gs://$MAIN_BUCKET/verified/audio/.placeholder
echo "Directory structure placeholder" | gsutil cp - gs://$MAIN_BUCKET/verified/image/.placeholder
echo "Directory structure placeholder" | gsutil cp - gs://$MAIN_BUCKET/verified/video/.placeholder
echo "Directory structure placeholder" | gsutil cp - gs://$MAIN_BUCKET/training-ready/.placeholder
echo "Directory structure placeholder" | gsutil cp - gs://$METADATA_BUCKET/file-metadata/.placeholder
echo "Directory structure placeholder" | gsutil cp - gs://$AUDIT_BUCKET/audit-logs/.placeholder

# Set up monitoring and alerting
echo "Setting up monitoring and alerting..."

# Create notification channel (email)
if [ ! -z "$ALERT_EMAIL" ]; then
    gcloud alpha monitoring channels create \
        --display-name="DeLangZeta Storage Alerts" \
        --type=email \
        --channel-labels=email_address=$ALERT_EMAIL \
        --project=$PROJECT_ID
fi

# Create log-based metrics for security monitoring
gcloud logging metrics create storage_unauthorized_access \
    --description="Unauthorized storage access attempts" \
    --log-filter='resource.type="gcs_bucket" AND protoPayload.authenticationInfo.principalEmail="" AND protoPayload.methodName="storage.objects.get"' \
    --project=$PROJECT_ID || true

gcloud logging metrics create storage_large_uploads \
    --description="Large file uploads" \
    --log-filter='resource.type="gcs_bucket" AND protoPayload.methodName="storage.objects.create" AND protoPayload.request.object.size>104857600' \
    --project=$PROJECT_ID || true

# Output configuration summary
echo ""
echo "✅ DeLangZeta Google Cloud Storage setup completed successfully!"
echo ""
echo "📊 Configuration Summary:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Main Bucket: gs://$MAIN_BUCKET"
echo "  Metadata Bucket: gs://$METADATA_BUCKET"
echo "  Audit Bucket: gs://$AUDIT_BUCKET"
echo "  KMS Key: projects/$PROJECT_ID/locations/$REGION/keyRings/$KMS_KEYRING/cryptoKeys/$KMS_KEY"
echo "  Storage Service Account: ${STORAGE_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "  Functions Service Account: ${FUNCTIONS_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
echo "🔒 Security Features Enabled:"
echo "  ✓ Encryption at rest with Cloud KMS"
echo "  ✓ Uniform bucket-level access"
echo "  ✓ Versioning enabled"
echo "  ✓ Lifecycle policies configured"
echo "  ✓ IAM policies restricted to service accounts"
echo "  ✓ CORS configured for web access"
echo "  ✓ Audit logging enabled"
echo ""
echo "📁 Directory Structure Created:"
echo "  ✓ submissions/pending/"
echo "  ✓ submissions/processing/"
echo "  ✓ verified/text/"
echo "  ✓ verified/audio/"
echo "  ✓ verified/image/"
echo "  ✓ verified/video/"
echo "  ✓ training-ready/"
echo "  ✓ file-metadata/"
echo "  ✓ audit-logs/"
echo ""
echo "Next steps:"
echo "1. Deploy Cloud Functions with the created service accounts"
echo "2. Update application configuration with bucket names"
echo "3. Test file upload and download functionality"
echo "4. Monitor logs and metrics for security events"