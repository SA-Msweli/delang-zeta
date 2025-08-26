# DeLangZeta Storage Cloud Functions

Secure file storage Cloud Functions for the DeLangZeta platform, providing authenticated file upload, download, and metadata management with comprehensive audit logging.

## Features

- **Secure File Upload**: JWT-authenticated signed URL generation with content validation
- **Access Control**: User-based permissions and file ownership validation
- **Content Validation**: File type, size, and name validation with sanitization
- **Audit Logging**: Comprehensive logging of all file operations
- **Metadata Management**: Secure storage and retrieval of file metadata
- **Error Handling**: Robust error handling with detailed logging

## Cloud Functions

### 1. Upload Handler (`uploadHandler`)
- **Endpoint**: `/storage-upload`
- **Method**: POST
- **Authentication**: Required (JWT Bearer token)
- **Purpose**: Generate signed URLs for secure file uploads

**Request Body:**
```json
{
  "taskId": "string",
  "fileName": "string",
  "contentType": "string",
  "fileSize": number
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "string",
    "fileId": "string",
    "expiresAt": "ISO date string",
    "maxFileSize": number,
    "allowedContentTypes": ["string"]
  },
  "warnings": ["string"]
}
```

### 2. Download Handler (`downloadHandler`)
- **Endpoint**: `/storage-download`
- **Method**: POST
- **Authentication**: Required (JWT Bearer token)
- **Purpose**: Generate signed URLs for secure file downloads

**Request Body:**
```json
{
  "fileId": "string",
  "accessReason": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "string",
    "expiresAt": "ISO date string",
    "accessGranted": true,
    "fileName": "string",
    "fileSize": number
  }
}
```

### 3. Metadata Handler (`metadataHandler`)
- **Endpoint**: `/storage-metadata`
- **Methods**: GET, DELETE
- **Authentication**: Required (JWT Bearer token)
- **Purpose**: Manage file metadata and user files

**GET Request (List Files):**
Query Parameters:
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**DELETE Request (Delete File):**
Query Parameters:
- `fileId`: string (required)

## Security Features

### Authentication
- JWT token validation with Secret Manager integration
- User permissions and role-based access control
- Automatic token expiration handling

### File Validation
- File name sanitization and dangerous pattern detection
- Content type validation and mismatch detection
- File size limits and quota enforcement
- Extension whitelist validation

### Access Control
- User-based file ownership validation
- Permission-based operation authorization
- Rate limiting and abuse prevention
- Audit logging for all operations

### Storage Security
- Organized bucket structure with user isolation
- Signed URL generation with expiration
- Metadata encryption and secure storage
- Automatic file cleanup and lifecycle management

## Supported File Types

- **Text**: `.txt`, `.csv`, `.json`
- **Audio**: `.mp3`, `.wav`, `.ogg`, `.m4a`
- **Image**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
- **Video**: `.mp4`, `.webm`, `.mov`, `.avi`

## File Size Limits

- Default maximum file size: 100MB
- Configurable per user based on permissions
- Warning threshold at 80% of limit

## Storage Architecture

```
delang-zeta-datasets/
├── submissions/
│   ├── pending/
│   │   └── {user-id}/
│   │       └── {task-id}/
│   │           └── {file-id}/
│   │               └── {sanitized-filename}
│   └── processing/
│       └── {processing-id}/
├── verified/
│   ├── text/
│   ├── audio/
│   ├── image/
│   └── video/
└── training-ready/
    └── {dataset-version}/

delang-zeta-metadata/
└── file-metadata/
    └── {file-id}.json

delang-zeta-audit-logs/
└── audit-logs/
    └── {date}/
        └── {timestamp}-{random}.json
```

## Environment Variables

- `NODE_ENV`: Environment (development/production)
- `GOOGLE_CLOUD_PROJECT`: GCP project ID
- `JWT_SECRET_NAME`: Secret Manager secret name for JWT signing key

## Development

### Setup
```bash
cd functions/storage
npm install
```

### Build
```bash
npm run build
```

### Test
```bash
npm test
npm run test:watch
```

### Local Development
```bash
npm run dev
```

### Deploy
```bash
npm run deploy:upload
npm run deploy:download
npm run deploy:metadata
```

## Testing

The functions include comprehensive tests covering:
- Authentication and authorization flows
- File validation logic
- Error handling scenarios
- Security edge cases
- Audit logging functionality

Run tests with:
```bash
npm test
```

## Error Handling

### Authentication Errors (401)
- Missing or invalid JWT token
- Expired token
- Invalid token signature

### Authorization Errors (403)
- Insufficient permissions
- File access denied
- Upload/download limits exceeded

### Validation Errors (400)
- Invalid file name or content type
- File size exceeds limits
- Missing required fields

### Not Found Errors (404)
- File not found
- Invalid file ID

### Server Errors (500)
- Google Cloud Storage errors
- Secret Manager access failures
- Internal processing errors

## Audit Logging

All file operations are logged with:
- Timestamp and user information
- Action type and file details
- IP address and user agent
- Success/failure status
- Error messages and metadata

Logs are stored in Google Cloud Storage with automatic batching and retry logic.

## Security Considerations

1. **Input Validation**: All inputs are validated and sanitized
2. **Access Control**: Strict user-based file access controls
3. **Audit Trail**: Comprehensive logging of all operations
4. **Error Handling**: Secure error messages without information leakage
5. **Rate Limiting**: Protection against abuse and DoS attacks
6. **Content Security**: File type and content validation
7. **Encryption**: Data encrypted at rest and in transit