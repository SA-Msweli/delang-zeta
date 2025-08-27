# DeLangZeta Security Checklist

## 🔒 Files That Should NEVER Be Committed

### Critical Security Files
- [ ] Private keys (`.pem`, `.key`, `private-key.txt`)
- [ ] Service account JSON files (`*-key.json`, `service-account*.json`)
- [ ] Environment files with secrets (`.env.production`, `.env.staging`)
- [ ] API keys in plain text files
- [ ] Database connection strings
- [ ] Wallet mnemonics or seed phrases
- [ ] SSL certificates and private keys

### Deployment Artifacts
- [ ] Deployment reports (contain function URLs and sensitive info)
- [ ] Security test results
- [ ] Load test reports
- [ ] Deployment configuration with secrets

### Development Files
- [ ] Local configuration overrides
- [ ] Test data with real user information
- [ ] Backup files containing sensitive data
- [ ] IDE workspace files with local paths

## ✅ What's Protected by .gitignore

### Environment & Configuration
```
.env*
*.local
config/production.json
config/staging.json
local.config.*
```

### Sensitive Credentials
```
*.pem
*.key
*.p12
*.pfx
private-keys/
secrets/
*-key.json
service-account*.json
```

### Deployment Artifacts
```
deployment-summary.md
security-test-report.md
load-test-report.md
deployment-info.json
```

### Build & Dependencies
```
node_modules/
dist/
build/
coverage/
__pycache__/
```

## 🛡️ Additional Security Measures

### 1. Environment Variables
Instead of files, use environment variables for secrets:
```bash
export GEMINI_API_KEY="your-key-here"
export DATABASE_URL="your-connection-string"
```

### 2. Google Secret Manager
Store all production secrets in Google Secret Manager:
```bash
echo "your-secret" | gcloud secrets create secret-name --data-file=-
```

### 3. Local Development
Use `.env.example` files with placeholder values:
```
# .env.example
GEMINI_API_KEY=your-gemini-api-key-here
DATABASE_URL=your-database-url-here
PRIVATE_KEY=your-private-key-here
```

### 4. Git Hooks
Consider adding a pre-commit hook to scan for secrets:
```bash
#!/bin/sh
# Check for potential secrets before commit
if git diff --cached --name-only | xargs grep -l "sk-\|pk-\|-----BEGIN"; then
    echo "⚠️  Potential secret detected in staged files!"
    exit 1
fi
```

## 🔍 How to Check for Accidentally Committed Secrets

### 1. Search Git History
```bash
# Search for API keys
git log --all --full-history -- "*.env*"
git log --all --full-history -S "api_key" --source --all

# Search for private keys
git log --all --full-history -S "BEGIN PRIVATE KEY" --source --all
git log --all --full-history -S "BEGIN RSA PRIVATE KEY" --source --all
```

### 2. Use Git Secrets Tool
```bash
# Install git-secrets
brew install git-secrets  # macOS
# or
sudo apt-get install git-secrets  # Ubuntu

# Set up git-secrets
git secrets --register-aws
git secrets --install
git secrets --scan
```

### 3. Manual File Check
```bash
# Check for common secret patterns
grep -r "sk-" . --exclude-dir=node_modules
grep -r "pk-" . --exclude-dir=node_modules
grep -r "BEGIN PRIVATE KEY" . --exclude-dir=node_modules
find . -name "*.json" -exec grep -l "private_key\|secret\|password" {} \;
```

## 🚨 If You Accidentally Commit Secrets

### 1. Immediate Actions
1. **Revoke the compromised credentials immediately**
2. **Generate new credentials**
3. **Update all systems using the old credentials**

### 2. Remove from Git History
```bash
# Remove file from all commits
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/secret/file' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DANGEROUS - coordinate with team)
git push origin --force --all
git push origin --force --tags
```

### 3. Alternative: BFG Repo-Cleaner
```bash
# Install BFG
brew install bfg  # macOS

# Remove secrets
bfg --delete-files "*.key"
bfg --replace-text passwords.txt  # file with old passwords

# Clean up
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

## 📋 Pre-Deployment Security Checklist

### Before Each Deployment
- [ ] All secrets stored in Google Secret Manager
- [ ] No hardcoded credentials in code
- [ ] Environment files not committed
- [ ] Service account keys not in repository
- [ ] Deployment scripts don't contain secrets
- [ ] Test data doesn't contain real user information

### Production Deployment
- [ ] Production secrets different from development
- [ ] API keys have appropriate scopes/permissions
- [ ] Database credentials use least privilege
- [ ] SSL certificates properly secured
- [ ] Monitoring configured for security events

### Post-Deployment
- [ ] Verify no secrets in deployment logs
- [ ] Check Cloud Console for exposed credentials
- [ ] Monitor for unauthorized access attempts
- [ ] Rotate secrets regularly

## 🔧 Tools for Secret Management

### Recommended Tools
1. **Google Secret Manager** - For production secrets
2. **HashiCorp Vault** - For complex secret management
3. **AWS Secrets Manager** - If using AWS services
4. **Azure Key Vault** - If using Azure services
5. **1Password CLI** - For development secrets
6. **Bitwarden CLI** - Alternative password manager

### Development Workflow
```bash
# Use secret manager for development
gcloud secrets versions access latest --secret="dev-api-key"

# Or use environment variables
export API_KEY=$(gcloud secrets versions access latest --secret="dev-api-key")
```

## 📞 Emergency Contacts

If you discover a security breach:

1. **Immediately revoke all potentially compromised credentials**
2. **Contact your security team**
3. **Document the incident**
4. **Update this checklist based on lessons learned**

---

**Remember**: It's better to be overly cautious with secrets than to risk a security breach!