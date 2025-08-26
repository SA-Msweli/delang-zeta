# DeLangZeta Authentication & Authorization System

This Cloud Function provides secure authentication and authorization services for the DeLangZeta platform.

## Features

### Authentication (Task 2.1 ✅)
- **Wallet-based Authentication**: Users authenticate using their Web3 wallet signatures
- **Nonce-based Challenge-Response**: Prevents replay attacks with cryptographic nonces
- **JWT Token System**: Secure access and refresh token generation
- **Multi-endpoint Support**: Separate endpoints for challenge, authentication, refresh, and validation
- **Security Headers**: Comprehensive security headers on all responses

### Authorization (Task 2.2 ✅)
- **Role-Based Access Control (RBAC)**: Four user roles with specific permissions
- **Permission Validation**: Middleware to check user permissions
- **Rate Limiting**: Per-user and IP-based rate limiting with configurable windows
- **Audit Logging**: Comprehensive logging of all authentication and authorization events
- **Suspicious Activity Detection**: Automatic detection and blocking of suspicious behavior

## API Endpoints

### POST /challenge
Generate an authentication challenge for a wallet address.

**Request:**
```json
{
  "walletAddress": "0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF"
}
```

**Response:**
```json
{
  "challenge": "DeLangZeta Authentication Challenge\n\nWallet: 0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF\nNonce: abc123...\nTimestamp: 1234567890\n\nSign this message to authenticate with DeLangZeta.",
  "nonce": "abc123...",
  "expiresAt": 1234567890
}
```

### POST /authenticate
Authenticate with a signed challenge.

**Request:**
```json
{
  "walletAddress": "0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF",
  "signature": "0x...",
  "message": "DeLangZeta Authentication Challenge...",
  "nonce": "abc123...",
  "chainId": 1
}
```

**Response:**
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 3600,
  "permissions": ["read", "write", "upload"]
}
```

### POST /refresh
Refresh an access token using a refresh token.

**Request:**
```json
{
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Response:**
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 3600,
  "permissions": ["read", "write", "upload"]
}
```

### GET /validate
Validate an access token.

**Headers:**
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

**Response:**
```json
{
  "valid": true,
  "walletAddress": "0x742d35cc6634c0532925a3b8d0c9c0e3c5d5c8ef",
  "permissions": ["read", "write", "upload"],
  "expiresAt": 1234567890
}
```

## User Roles & Permissions

### Contributor
- `read`: View public data
- `write`: Submit data contributions
- `upload`: Upload files to the platform

### Validator
- All Contributor permissions
- `validate`: Validate submitted data

### Organization
- `read`: View public data
- `write`: Create organizational content
- `create_task`: Create data collection tasks
- `purchase_license`: Purchase data licenses

### Admin
- All permissions from all roles
- `admin`: Administrative functions
- `manage_users`: User management

## Security Features

### Authentication Security
- **Cryptographic Nonces**: 256-bit random nonces prevent replay attacks
- **Time-based Expiry**: Challenges expire after 5 minutes
- **Signature Verification**: Ethereum signature verification using ethers.js
- **JWT Security**: Tokens signed with HS256 algorithm and proper claims

### Authorization Security
- **Rate Limiting**: Configurable per-user and IP-based limits
- **Audit Logging**: All security events logged with timestamps and context
- **Suspicious Activity Detection**: Automatic detection of:
  - Multiple failed authentication attempts (>10 in 1 hour)
  - Rate limit violations (>5 in 1 hour)
- **Security Headers**: HSTS, XSS protection, content type options, frame options

### Data Protection
- **Secret Manager Integration**: JWT signing keys stored securely
- **Token Validation**: Comprehensive JWT validation with issuer/audience checks
- **Permission Isolation**: Users can only access resources they have permissions for

## Middleware Usage

### Authentication Middleware
```typescript
import { authenticate } from './authorization';

app.use('/api/protected', authenticate());
```

### Authorization Middleware
```typescript
import { authorize, Permission } from './authorization';

app.use('/api/admin', authorize([Permission.ADMIN]));
app.use('/api/upload', authorize([Permission.UPLOAD]));
```

### Rate Limiting Middleware
```typescript
import { rateLimit } from './authorization';

app.use('/api', rateLimit({
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests'
}));
```

### Role-based Middleware
```typescript
import { requireRole, UserRole } from './authorization';

app.use('/api/validate', requireRole(UserRole.VALIDATOR));
app.use('/api/admin', requireRole(UserRole.ADMIN));
```

## Testing

The system includes comprehensive tests covering:

### Authentication Tests (`auth-simple.test.ts`)
- JWT token generation and validation
- Signature verification
- Nonce generation and validation
- Address validation
- Security headers

### Authorization Tests (`authorization-simple.test.ts`)
- Role-based permissions
- Permission checking logic
- Rate limiting logic
- Audit logging structure
- Suspicious activity detection

Run tests:
```bash
npm test
```

## Deployment

### Prerequisites
1. Google Cloud Project with Secret Manager enabled
2. JWT signing key stored in Secret Manager as `jwt-signing-key`
3. Cloud Functions runtime permissions

### Deploy
```bash
npm run build
npm run deploy
```

### Environment Variables
- `GOOGLE_CLOUD_PROJECT`: Your Google Cloud project ID

## Security Considerations

1. **JWT Signing Key**: Must be at least 256 bits and stored securely in Secret Manager
2. **Rate Limiting**: Adjust limits based on expected traffic patterns
3. **Audit Logs**: In production, store in a persistent database or logging service
4. **Nonce Storage**: In production, use Redis or Firestore instead of in-memory storage
5. **HTTPS Only**: Ensure all traffic uses HTTPS in production
6. **CORS Configuration**: Configure CORS appropriately for your frontend domains

## Monitoring

The system logs all security events including:
- Authentication attempts (success/failure)
- Authorization checks
- Rate limit violations
- Suspicious activity detection
- Token validation failures

Monitor these logs for security incidents and adjust rate limits as needed.