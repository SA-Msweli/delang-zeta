# DeLangZeta Secure Google Cloud Storage Architecture

## Overview

This document describes the secure Google Cloud Storage architecture implemented for the DeLangZeta platform. The architecture provides enterprise-grade security, scalability, and compliance for handling sensitive language data and user-generated content.

## Architecture Components

### 1. Storage Buckets

#### Main Datasets Bucket (`delang-zeta-datasets`)
- **Purpose**: Primary storage for user-submitted language data
- **Structure**:
  ```
  submissions/
  ├── pending/          # Newly uploaded files awaiting verification
  │   └── {user-id}/
  │       └── {task-id}/
  │           └── {file-id}/
  │               └── {sanitized-filename}
  ├── processing/       # Files currently being processed
  │   └── {processing-id}/
  └── verified/         # Verified and approved files
      ├── text/         # Text-based language data
      ├── audio/        # Audio recordings
      ├── image/        # Image-based language data
      └── video/        # Video content
  training-ready/       # Datasets prepared for ML training
  └── {dataset-version}/
  ```

#### Metadata Bucket (`delang-zeta-metadata`)
- **Purpose**: Secure storage of file metadata and system information
- **Structure**:
  ```
  file-metadata/        # Individual file metadata
  └── {file-id}.json
  user-profiles/        # User profile data
  └── {user-id}.json
  task-definitions/     # Task specifications
  └── {task-id}.json
  ```

#### Audit Logs Bucket (`delang-zeta-audit-logs`)
- **Purpose**: Long-term storage of audit trails and security logs
- **Structure**:
  ```
  audit-logs/
  └── {date}/
      └── {timestamp}-{random}.json
  access-logs/          # File access logs
  security-events/      # Security-related events
  compliance-reports/   # Compliance and audit reports
  ```

### 2. Security Features

#### Encryption
- **Encryption at Rest**: All buckets use Google Cloud KMS encryption
- **Key Management**: Dedicated KMS key ring and crypto key per environment
- **Key Rotation**: Automatic key rotation enabled
- **Transit Encryption**: All data transfers use TLS 1.2+

#### Access Control
- **Uniform Bucket-Level Access**: Enabled for all buckets
- **IAM Policies**: Restrictive policies limiting access to service accounts only
- **Service Account Isolation**: Separate service accounts for different functions
- **Signed URLs**: Time-limited access for file operations
- **CORS Configuration**: Restricted to authorized domains only

#### Data Lifecycle
- **Versioning**: Enabled for all buckets to prevent data loss
- **Lifecycle Policies**:
  - Pending files: Deleted after 7 days if not processed
  - Standard files: Moved to Nearline after 30 days
  - Nearline files: Moved to Coldline after 90 days
  - Archive files: Moved to Archive after 365 days (audit logs only)
  - Retention: 7-year retention for audit logs

### 3. Service Accounts

#### Storage Service Account (`delang-storage-sa`)
- **Purpose**: Direct storage operations and bucket management
- **Permissions**:
  - `roles/storage.objectAdmin` - Full object management
  - `roles/cloudkms.cryptoKeyEncrypterDecrypter` - KMS operations

#### Functions Service Account (`delang-functions-sa`)
- **Purpose**: Cloud Functions execution and API access
- **Permissions**:
  - `roles/storage.objectAdmin` - Storage access
  - `roles/secretmanager.secretAccessor` - Secret access
  - `roles/cloudkms.cryptoKeyEncrypterDecrypter` - KMS operations

### 4. Monitoring and Alerting

#### Log-Based Metrics
- **Unauthorized Access**: Tracks access attempts without proper authentication
- **Large Uploads**: Monitors files exceeding 100MB threshold
- **Failed Operations**: Tracks storage operation failures
- **Security Events**: Monitors suspicious activities

#### Alerting Policies
- **Unauthorized Access Attempts**: Immediate alerts for security breaches
- **Large File Uploads**: Warnings for unusual upload patterns
- **Function Errors**: Alerts for Cloud Function failures
- **Storage Quota**: Warnings when approaching storage limits
- **Failed Operations**: Alerts for persistent operation failures

#### Dashboards
- **Storage Usage**: Real-time bucket usage and trends
- **Upload Rates**: File upload patterns and volumes
- **Function Performance**: Cloud Function metrics and errors
- **Security Events**: Security-related activities and alerts

### 5. Compliance and Governance

#### Data Governance
- **Data Classification**: Automatic classification based on content type
- **Retention Policies**: Automated data lifecycle management
- **Data Lineage**: Complete audit trail of data operations
- **Privacy Controls**: User-based access controls and data isolation

#### Compliance Features
- **Audit Logging**: Comprehensive logging of all operations
- **Data Residency**: Regional data storage compliance
- **Access Logging**: Detailed access patterns and user activities
- **Compliance Reports**: Automated generation of compliance reports

## Security Best Practices

### 1. Access Control
- **Principle of Least Privilege**: Minimal required permissions
- **Service Account Keys**: No downloadable keys, use workload identity
- **Regular Access Reviews**: Periodic review of access permissions
- **Multi-Factor Authentication**: Required for administrative access

### 2. Data Protection
- **Encryption Everywhere**: Data encrypted at rest and in transit
- **Key Management**: Centralized key management with rotation
- **Data Loss Prevention**: Versioning and backup strategies
- **Secure Deletion**: Proper data sanitization procedures

### 3. Monitoring and Response
- **Real-Time Monitoring**: Continuous monitoring of all activities
- **Automated Alerting**: Immediate notification of security events
- **Incident Response**: Defined procedures for security incidents
- **Regular Audits**: Periodic security assessments and reviews

## Deployment Instructions

### Prerequisites
- Google Cloud Project with billing enabled
- `gcloud` CLI installed and authenticated
- Appropriate IAM permissions for resource creation

### Automated Setup
```bash
# Set environment variables
export GOOGLE_CLOUD_PROJECT="your-project-id"
export REGION="us-central1"
export ALERT_EMAIL="admin@example.com"

# Run setup script
chmod +x gcp/storage-setup.sh
./gcp/storage-setup.sh

# Set up monitoring
chmod +x gcp/monitoring-setup.sh
./gcp/monitoring-setup.sh
```

### Terraform Deployment
```bash
cd gcp/terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Plan deployment
terraform plan

# Apply configuration
terraform apply
```

### Manual Verification
```bash
# Verify buckets
gsutil ls -L gs://your-project-datasets
gsutil ls -L gs://your-project-metadata
gsutil ls -L gs://your-project-audit-logs

# Check IAM policies
gsutil iam get gs://your-project-datasets

# Verify encryption
gsutil kms encryption gs://your-project-datasets
```

## Maintenance and Operations

### Regular Tasks
- **Monitor Storage Usage**: Track bucket usage and costs
- **Review Access Logs**: Analyze access patterns for anomalies
- **Update Lifecycle Policies**: Adjust based on usage patterns
- **Key Rotation**: Ensure KMS keys are rotated regularly
- **Security Reviews**: Periodic security assessments

### Troubleshooting
- **Access Denied Errors**: Check IAM policies and service account permissions
- **Upload Failures**: Verify CORS configuration and signed URL validity
- **Performance Issues**: Monitor function execution times and storage latency
- **Cost Optimization**: Review storage classes and lifecycle policies

### Backup and Recovery
- **Versioning**: Enabled for all critical buckets
- **Cross-Region Replication**: Consider for disaster recovery
- **Point-in-Time Recovery**: Use versioning for data recovery
- **Disaster Recovery Plan**: Documented procedures for major incidents

## Cost Optimization

### Storage Classes
- **Standard**: For frequently accessed data
- **Nearline**: For data accessed less than once per month
- **Coldline**: For data accessed less than once per quarter
- **Archive**: For long-term retention (audit logs)

### Lifecycle Management
- **Automatic Transitions**: Based on access patterns
- **Deletion Policies**: Remove temporary and expired data
- **Compression**: Use compression for text-based data
- **Deduplication**: Identify and remove duplicate files

### Monitoring Costs
- **Budget Alerts**: Set up budget notifications
- **Usage Reports**: Regular analysis of storage costs
- **Optimization Recommendations**: Act on Google Cloud recommendations
- **Reserved Capacity**: Consider for predictable workloads

## Security Incident Response

### Detection
- **Automated Alerts**: Real-time security event notifications
- **Log Analysis**: Regular review of audit logs
- **Anomaly Detection**: Unusual access patterns or volumes
- **User Reports**: Security concerns reported by users

### Response Procedures
1. **Immediate Assessment**: Evaluate the scope and impact
2. **Containment**: Isolate affected resources
3. **Investigation**: Analyze logs and determine root cause
4. **Remediation**: Fix vulnerabilities and restore services
5. **Documentation**: Record incident details and lessons learned
6. **Follow-up**: Implement preventive measures

### Communication
- **Internal Notifications**: Alert relevant teams immediately
- **User Communications**: Inform users if their data is affected
- **Regulatory Reporting**: Comply with data breach notification requirements
- **Post-Incident Review**: Conduct thorough post-mortem analysis

## Future Enhancements

### Planned Improvements
- **Multi-Region Replication**: Enhanced disaster recovery
- **Advanced Threat Detection**: ML-based anomaly detection
- **Data Loss Prevention**: Automated sensitive data detection
- **Enhanced Encryption**: Customer-managed encryption keys
- **Performance Optimization**: CDN integration for global access

### Scalability Considerations
- **Auto-scaling**: Dynamic resource allocation
- **Load Balancing**: Distribute traffic across regions
- **Caching Strategies**: Reduce storage access costs
- **Archive Strategies**: Long-term data retention optimization