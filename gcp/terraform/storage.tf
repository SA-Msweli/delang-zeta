# DeLangZeta Google Cloud Storage Infrastructure
# Terraform configuration for secure storage architecture

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "alert_email" {
  description = "Email for monitoring alerts"
  type        = string
  default     = ""
}

# Local values
locals {
  bucket_prefix = "${var.project_id}-${var.environment}"
  
  buckets = {
    datasets    = "${local.bucket_prefix}-datasets"
    metadata    = "${local.bucket_prefix}-metadata"
    audit_logs  = "${local.bucket_prefix}-audit-logs"
  }
  
  service_accounts = {
    storage   = "delang-storage-sa-${var.environment}"
    functions = "delang-functions-sa-${var.environment}"
  }
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "storage.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudkms.googleapis.com",
    "secretmanager.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com"
  ])
  
  project = var.project_id
  service = each.value
  
  disable_dependent_services = false
  disable_on_destroy        = false
}

# KMS Key Ring
resource "google_kms_key_ring" "storage_keyring" {
  name     = "delang-storage-keyring-${var.environment}"
  location = var.region
  
  depends_on = [google_project_service.required_apis]
}

# KMS Crypto Key
resource "google_kms_crypto_key" "storage_key" {
  name     = "delang-storage-key-${var.environment}"
  key_ring = google_kms_key_ring.storage_keyring.id
  purpose  = "ENCRYPT_DECRYPT"
  
  version_template {
    algorithm = "GOOGLE_SYMMETRIC_ENCRYPTION"
  }
  
  lifecycle {
    prevent_destroy = true
  }
}

# Service Accounts
resource "google_service_account" "storage_sa" {
  account_id   = local.service_accounts.storage
  display_name = "DeLangZeta Storage Service Account (${var.environment})"
  description  = "Service account for secure storage operations"
}

resource "google_service_account" "functions_sa" {
  account_id   = local.service_accounts.functions
  display_name = "DeLangZeta Functions Service Account (${var.environment})"
  description  = "Service account for Cloud Functions"
}

# IAM bindings for service accounts
resource "google_project_iam_member" "storage_sa_permissions" {
  for_each = toset([
    "roles/storage.objectAdmin",
    "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.storage_sa.email}"
}

resource "google_project_iam_member" "functions_sa_permissions" {
  for_each = toset([
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.functions_sa.email}"
}

# Storage Buckets
resource "google_storage_bucket" "datasets" {
  name          = local.buckets.datasets
  location      = var.region
  storage_class = "STANDARD"
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  encryption {
    default_kms_key_name = google_kms_crypto_key.storage_key.id
  }
  
  lifecycle_rule {
    condition {
      age = 2555 # 7 years
      matches_storage_class = ["STANDARD"]
    }
    action {
      type = "Delete"
    }
  }
  
  lifecycle_rule {
    condition {
      age = 30
      matches_storage_class = ["STANDARD"]
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
  
  lifecycle_rule {
    condition {
      age = 90
      matches_storage_class = ["NEARLINE"]
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }
  
  lifecycle_rule {
    condition {
      age                   = 7
      matches_prefix        = ["submissions/pending/"]
    }
    action {
      type = "Delete"
    }
  }
  
  cors {
    origin          = ["https://delang-zeta.web.app", "https://delang-zeta.firebaseapp.com", "http://localhost:3000"]
    method          = ["GET", "PUT", "POST", "HEAD"]
    response_header = ["Content-Type", "x-goog-resumable"]
    max_age_seconds = 3600
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_storage_bucket" "metadata" {
  name          = local.buckets.metadata
  location      = var.region
  storage_class = "STANDARD"
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  encryption {
    default_kms_key_name = google_kms_crypto_key.storage_key.id
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_storage_bucket" "audit_logs" {
  name          = local.buckets.audit_logs
  location      = var.region
  storage_class = "STANDARD"
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  encryption {
    default_kms_key_name = google_kms_crypto_key.storage_key.id
  }
  
  lifecycle_rule {
    condition {
      age = 2555 # 7 years
    }
    action {
      type = "Delete"
    }
  }
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }
  
  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

# Bucket IAM bindings
resource "google_storage_bucket_iam_member" "datasets_storage_sa" {
  bucket = google_storage_bucket.datasets.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.storage_sa.email}"
}

resource "google_storage_bucket_iam_member" "datasets_functions_sa" {
  bucket = google_storage_bucket.datasets.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.functions_sa.email}"
}

resource "google_storage_bucket_iam_member" "metadata_storage_sa" {
  bucket = google_storage_bucket.metadata.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.storage_sa.email}"
}

resource "google_storage_bucket_iam_member" "metadata_functions_sa" {
  bucket = google_storage_bucket.metadata.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.functions_sa.email}"
}

resource "google_storage_bucket_iam_member" "audit_logs_storage_sa" {
  bucket = google_storage_bucket.audit_logs.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.storage_sa.email}"
}

resource "google_storage_bucket_iam_member" "audit_logs_functions_sa" {
  bucket = google_storage_bucket.audit_logs.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.functions_sa.email}"
}

# Create directory structure with placeholder objects
resource "google_storage_bucket_object" "directory_placeholders" {
  for_each = toset([
    "submissions/pending/.placeholder",
    "submissions/processing/.placeholder",
    "verified/text/.placeholder",
    "verified/audio/.placeholder",
    "verified/image/.placeholder",
    "verified/video/.placeholder",
    "training-ready/.placeholder"
  ])
  
  name    = each.value
  bucket  = google_storage_bucket.datasets.name
  content = "Directory structure placeholder"
}

resource "google_storage_bucket_object" "metadata_placeholder" {
  name    = "file-metadata/.placeholder"
  bucket  = google_storage_bucket.metadata.name
  content = "Directory structure placeholder"
}

resource "google_storage_bucket_object" "audit_placeholder" {
  name    = "audit-logs/.placeholder"
  bucket  = google_storage_bucket.audit_logs.name
  content = "Directory structure placeholder"
}

# Log-based metrics for monitoring
resource "google_logging_metric" "unauthorized_access" {
  name   = "storage_unauthorized_access_${var.environment}"
  filter = "resource.type=\"gcs_bucket\" AND protoPayload.authenticationInfo.principalEmail=\"\" AND protoPayload.methodName=\"storage.objects.get\""
  
  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "INT64"
    display_name = "Unauthorized Storage Access Attempts"
  }
}

resource "google_logging_metric" "large_uploads" {
  name   = "storage_large_uploads_${var.environment}"
  filter = "resource.type=\"gcs_bucket\" AND protoPayload.methodName=\"storage.objects.create\" AND protoPayload.request.object.size>104857600"
  
  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "INT64"
    display_name = "Large File Uploads (>100MB)"
  }
}

# Monitoring notification channel (if email provided)
resource "google_monitoring_notification_channel" "email" {
  count = var.alert_email != "" ? 1 : 0
  
  display_name = "DeLangZeta Storage Alerts (${var.environment})"
  type         = "email"
  
  labels = {
    email_address = var.alert_email
  }
}

# Outputs
output "bucket_names" {
  description = "Names of created storage buckets"
  value = {
    datasets   = google_storage_bucket.datasets.name
    metadata   = google_storage_bucket.metadata.name
    audit_logs = google_storage_bucket.audit_logs.name
  }
}

output "service_account_emails" {
  description = "Email addresses of created service accounts"
  value = {
    storage   = google_service_account.storage_sa.email
    functions = google_service_account.functions_sa.email
  }
}

output "kms_key_id" {
  description = "ID of the KMS encryption key"
  value       = google_kms_crypto_key.storage_key.id
}

output "bucket_urls" {
  description = "URLs of created storage buckets"
  value = {
    datasets   = "gs://${google_storage_bucket.datasets.name}"
    metadata   = "gs://${google_storage_bucket.metadata.name}"
    audit_logs = "gs://${google_storage_bucket.audit_logs.name}"
  }
}