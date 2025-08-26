# DeLangZeta AI Services

This directory contains the Python-based Google Cloud Functions for AI services integration in the DeLangZeta platform.

## Services

### 1. Gemini 2.5 Flash Verification Service
- **Endpoint**: `/gemini/verify`
- **Purpose**: AI-powered verification of submitted language data
- **Features**:
  - Text, audio, and image content verification
  - Quality scoring and recommendation generation
  - Secure API key management through Secret Manager
  - Rate limiting and cost monitoring
  - Comprehensive audit logging

### 2. Google Translate Service
- **Endpoint**: `/translate`
- **Purpose**: Language detection and translation
- **Features**:
  - Text translation between supported languages
  - Language detection
  - Batch translation support
  - Cost monitoring and rate limiting

### 3. Speech-to-Text Service
- **Endpoint**: `/speech-to-text`
- **Purpose**: Audio transcription and analysis
- **Features**:
  - Audio file transcription from Google Cloud Storage
  - Multiple language support
  - Confidence scoring
  - Duration estimation and cost monitoring

### 4. AI Results Processor
- **Endpoint**: `/ai-results`
- **Purpose**: Process and validate AI verification results
- **Features**:
  - Smart contract integration (simulated)
  - Result caching and performance optimization
  - Circuit breaker pattern for error handling
  - Comprehensive retry mechanisms

## Architecture

### Security Features
- **JWT Authentication**: All endpoints require valid JWT tokens
- **Rate Limiting**: Per-user, per-service rate limiting
- **Cost Monitoring**: Daily cost limits to prevent abuse
- **Audit Logging**: Comprehensive logging of all operations
- **Secret Management**: Secure API key storage in Google Secret Manager

### Error Handling
- **Circuit Breaker**: Automatic failure detection and recovery
- **Retry Logic**: Exponential backoff for transient failures
- **Graceful Degradation**: Fallback mechanisms when services are unavailable
- **Comprehensive Logging**: Detailed error tracking and monitoring

## Setup

### Prerequisites
- Python 3.9+
- Google Cloud SDK
- Google Cloud Project with required APIs enabled:
  - Cloud Functions API
  - Secret Manager API
  - Cloud Storage API
  - Translate API
  - Speech-to-Text API
  - Vertex AI API (for Gemini)

### Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Set up Google Cloud authentication
gcloud auth application-default login

# Set project ID
export GOOGLE_CLOUD_PROJECT=your-project-id
```

### Configuration
1. Create secrets in Google Secret Manager:
   ```bash
   # Gemini API key
   gcloud secrets create gemini-api-key --data-file=gemini-key.txt
   
   # Translate API key (if using API key authentication)
   gcloud secrets create translate-api-key --data-file=translate-key.txt
   
   # Speech API key (if using API key authentication)
   gcloud secrets create speech-api-key --data-file=speech-key.txt
   
   # JWT signing key
   gcloud secrets create jwt-signing-key --data-file=jwt-key.txt
   ```

2. Set up IAM permissions:
   ```bash
   # Grant Cloud Functions access to secrets
   gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
     --member="serviceAccount:your-function-sa@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   
   # Grant access to Cloud Storage
   gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
     --member="serviceAccount:your-function-sa@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
     --role="roles/storage.objectViewer"
   ```

## Deployment

### Individual Functions
```bash
# Deploy Gemini verification function
gcloud functions deploy gemini-verification \
  --runtime python39 \
  --trigger http \
  --entry-point gemini_verification \
  --source . \
  --memory 512MB \
  --timeout 300s

# Deploy Translate function
gcloud functions deploy translate-service \
  --runtime python39 \
  --trigger http \
  --entry-point translate_text \
  --source . \
  --memory 256MB \
  --timeout 60s

# Deploy Speech-to-Text function
gcloud functions deploy speech-to-text \
  --runtime python39 \
  --trigger http \
  --entry-point speech_to_text \
  --source . \
  --memory 512MB \
  --timeout 300s

# Deploy AI Results Processor
gcloud functions deploy ai-results-processor \
  --runtime python39 \
  --trigger http \
  --entry-point process_ai_results \
  --source . \
  --memory 256MB \
  --timeout 60s
```

### All Functions
```bash
# Deploy all functions at once
./deploy.sh
```

## Testing

### Run Tests
```bash
# Install test dependencies
pip install pytest pytest-cov

# Run all tests
python run_tests.py

# Run specific test file
pytest test_gemini_service.py -v

# Run with coverage
pytest --cov=. --cov-report=html
```

### Test Coverage
The test suite covers:
- ✅ Service initialization and configuration
- ✅ Authentication and authorization
- ✅ Rate limiting and cost monitoring
- ✅ AI service integrations
- ✅ Error handling and circuit breakers
- ✅ Audit logging and monitoring
- ✅ File operations and storage access

## Monitoring

### Health Checks
- **Individual Service Health**: `GET /gemini/health`, `/translate/health`, etc.
- **Overall Health**: `GET /health`

### Metrics
- Request counts and response times
- Error rates and types
- Cost tracking per user and service
- Rate limit violations
- Circuit breaker status

### Logging
All operations are logged with:
- User identification
- Request/response details
- Processing times
- Error information
- Cost estimates

## Configuration

### Rate Limits
```python
AI_CONFIG = {
    'RATE_LIMITS': {
        'GEMINI': {
            'REQUESTS_PER_MINUTE': 60,
            'REQUESTS_PER_HOUR': 1000,
            'COST_LIMIT_PER_DAY': 100.0  # USD
        },
        'TRANSLATE': {
            'REQUESTS_PER_MINUTE': 100,
            'REQUESTS_PER_HOUR': 2000,
            'COST_LIMIT_PER_DAY': 50.0
        },
        'SPEECH': {
            'REQUESTS_PER_MINUTE': 30,
            'REQUESTS_PER_HOUR': 500,
            'COST_LIMIT_PER_DAY': 75.0
        }
    }
}
```

### Timeouts
- **Gemini**: 30 seconds
- **Translate**: 10 seconds
- **Speech**: 60 seconds

### Retry Logic
- **Max Attempts**: 3
- **Backoff Multiplier**: 2
- **Initial Delay**: 1 second

## API Documentation

### Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

### Gemini Verification
```http
POST /gemini/verify
Content-Type: application/json

{
  "submissionId": "submission-123",
  "dataType": "text",
  "storageUrl": "gs://bucket/file.txt",
  "language": "en",
  "taskCriteria": {
    "language": "en",
    "qualityThreshold": 80,
    "minWordCount": 10,
    "maxWordCount": 1000,
    "specificRequirements": ["grammatically correct"]
  }
}
```

### Translation
```http
POST /translate
Content-Type: application/json

{
  "text": "Hello, world!",
  "targetLanguage": "es",
  "sourceLanguage": "en"
}
```

### Speech-to-Text
```http
POST /speech-to-text
Content-Type: application/json

{
  "audioUrl": "gs://bucket/audio.wav",
  "language": "en-US"
}
```

### AI Results Processing
```http
POST /ai-results
Content-Type: application/json

{
  "submissionId": "submission-123",
  "verificationResults": {
    "submissionId": "submission-123",
    "qualityScore": 85,
    "languageDetected": "en",
    "confidence": 0.9,
    "issues": [],
    "recommendations": ["Great work!"]
  }
}
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify JWT token is valid and not expired
   - Check JWT signing key in Secret Manager

2. **Rate Limiting**
   - Check current usage against configured limits
   - Wait for rate limit window to reset

3. **Cost Limits**
   - Monitor daily spending per service
   - Adjust limits in configuration if needed

4. **API Failures**
   - Check Google Cloud service status
   - Verify API keys and permissions
   - Review error logs for specific issues

5. **File Access Issues**
   - Verify Google Cloud Storage permissions
   - Check file exists and is accessible
   - Validate storage URL format

### Logs
View function logs:
```bash
gcloud functions logs read gemini-verification --limit 50
```

### Debug Mode
Set environment variable for detailed logging:
```bash
export DEBUG=true
```

## Security Considerations

- **API Keys**: Never expose API keys in code or logs
- **JWT Tokens**: Use strong signing keys and appropriate expiration times
- **Rate Limiting**: Implement per-user limits to prevent abuse
- **Input Validation**: Validate all inputs before processing
- **Error Messages**: Don't expose sensitive information in error responses
- **Audit Logging**: Log all security-relevant events
- **Network Security**: Use HTTPS for all communications
- **Access Control**: Implement least-privilege access patterns