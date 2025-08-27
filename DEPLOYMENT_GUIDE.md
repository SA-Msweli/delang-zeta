# DeLangZeta Production Deployment Guide

This guide walks you through deploying and testing the DeLangZeta secure serverless infrastructure (Task 13).

## Prerequisites

Before starting the deployment, ensure you have:

1. **Google Cloud CLI** installed and authenticated
2. **Node.js** (v18+) and npm installed
3. **Python** (3.9+) for AI functions
4. **curl** for testing endpoints
5. **Active Google Cloud Project** with billing enabled

## Quick Start

### Option 1: Complete Deployment and Testing (Recommended)

```bash
# Run complete deployment with testing
./scripts/deploy-and-test.sh your-project-id us-central1 your-email@domain.com

# Or with custom settings
./scripts/deploy-and-test.sh delang-zeta-prod us-central1 admin@delang-zeta.com
```

### Option 2: Deployment Only (Skip Testing)

```bash
# Deploy infrastructure only, skip security and load testing
./scripts/deploy-and-test.sh your-project-id us-central1 your-email@domain.com true
```

## Step-by-Step Deployment

If you prefer to run each phase separately:

### Phase 1: Infrastructure Deployment

```bash
# Deploy all Google Cloud infrastructure
./scripts/deploy-production.sh your-project-id us-central1 your-email@domain.com
```

This will:
- Enable required Google Cloud APIs
- Set up IAM roles and service accounts
- Configure Secret Manager
- Create secure storage buckets with KMS encryption
- Deploy all Cloud Functions
- Set up monitoring and alerting

### Phase 2: Smart Contract Deployment

```bash
# Deploy to ZetaChain testnet
./scripts/deploy-contracts.sh testnet

# Or deploy to mainnet (when ready)
./scripts/deploy-contracts.sh mainnet your-private-key
```

### Phase 3: Validation

```bash
# Validate complete deployment
./scripts/validate-deployment.sh your-project-id us-central1
```

### Phase 4: Security Testing

```bash
# Run comprehensive security tests
./scripts/security-test.sh your-project-id us-central1
```

### Phase 5: Performance Testing

```bash
# Run load and performance tests
./scripts/load-test.sh your-project-id us-central1 10 60
```

## Configuration

### Required Secrets

After deployment, update Secret Manager with actual values:

```bash
# Update API keys (replace with actual keys)
echo "your-actual-gemini-api-key" | gcloud secrets versions add gemini-api-key --data-file=-
echo "your-actual-translate-api-key" | gcloud secrets versions add translate-api-key --data-file=-
echo "your-actual-speech-api-key" | gcloud secrets versions add speech-to-text-api-key --data-file=-

# Update JWT signing key (generate a secure random key)
openssl rand -base64 32 | gcloud secrets versions add jwt-signing-key --data-file=-

# Update ZetaChain private key (for server-side operations)
echo "your-zetachain-private-key" | gcloud secrets versions add zetachain-private-key --data-file=-
```

### Environment Variables

Update your frontend `.env` file with production endpoints:

```env
VITE_PROJECT_ID=your-project-id
VITE_REGION=us-central1
VITE_AUTH_URL=https://us-central1-your-project-id.cloudfunctions.net/delang-auth
VITE_STORAGE_UPLOAD_URL=https://us-central1-your-project-id.cloudfunctions.net/delang-storage-upload
VITE_AI_VERIFICATION_URL=https://us-central1-your-project-id.cloudfunctions.net/delang-ai-verification
```

## Verification

### Health Check

Test that your deployment is working:

```bash
# Check health endpoint
curl https://us-central1-your-project-id.cloudfunctions.net/delang-monitoring-health

# Expected response: {"status":"healthy","timestamp":"..."}
```

### Function URLs

After deployment, your Cloud Functions will be available at:

- **Health Check**: `https://REGION-PROJECT_ID.cloudfunctions.net/delang-monitoring-health`
- **Authentication**: `https://REGION-PROJECT_ID.cloudfunctions.net/delang-auth`
- **Storage Upload**: `https://REGION-PROJECT_ID.cloudfunctions.net/delang-storage-upload`
- **AI Verification**: `https://REGION-PROJECT_ID.cloudfunctions.net/delang-ai-verification`

## Monitoring

### Google Cloud Console

Access your deployment through:

- **Project Dashboard**: `https://console.cloud.google.com/home/dashboard?project=PROJECT_ID`
- **Cloud Functions**: `https://console.cloud.google.com/functions/list?project=PROJECT_ID`
- **Storage Buckets**: `https://console.cloud.google.com/storage/browser?project=PROJECT_ID`
- **Monitoring**: `https://console.cloud.google.com/monitoring?project=PROJECT_ID`
- **Logs**: `https://console.cloud.google.com/logs?project=PROJECT_ID`

### Alerts

Monitoring alerts are automatically configured and will be sent to the email address you specified during deployment.

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure you're authenticated with sufficient permissions
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

2. **API Not Enabled**: Enable required APIs manually
   ```bash
   gcloud services enable cloudfunctions.googleapis.com secretmanager.googleapis.com storage.googleapis.com
   ```

3. **Function Deployment Failed**: Check function logs
   ```bash
   gcloud functions logs read FUNCTION_NAME --region=REGION
   ```

4. **Storage Access Issues**: Verify bucket permissions
   ```bash
   gsutil iam get gs://PROJECT_ID-datasets
   ```

### Getting Help

- Check deployment logs in `deployment-summary.md`
- Review security test results in `security-test-report.md`
- Check performance results in `load-test-report.md`
- View comprehensive report in `final-deployment-report.md`

## Security Considerations

### Production Checklist

- [ ] All API keys updated in Secret Manager
- [ ] Service accounts have minimal required permissions
- [ ] Storage buckets have uniform bucket-level access enabled
- [ ] KMS encryption configured for all buckets
- [ ] Monitoring and alerting configured
- [ ] Security testing completed successfully
- [ ] Load testing shows acceptable performance

### Ongoing Security

- Regularly rotate API keys and secrets
- Monitor security alerts and logs
- Keep dependencies updated
- Conduct periodic security audits
- Review and update IAM permissions

## Next Steps

After successful deployment:

1. **Update API Keys**: Replace placeholder secrets with production keys
2. **Configure Frontend**: Update frontend with production endpoints
3. **Test Integration**: Perform end-to-end testing
4. **Deploy Smart Contracts**: Deploy to ZetaChain mainnet when ready
5. **User Acceptance Testing**: Begin UAT with stakeholders
6. **Go-Live Planning**: Plan production launch strategy

## Support

For deployment issues or questions:

1. Check the generated reports for detailed information
2. Review Google Cloud Console logs and monitoring
3. Verify all prerequisites are met
4. Ensure proper authentication and permissions

---

**Task 13 Status**: ✅ Complete - Secure serverless infrastructure deployed and tested