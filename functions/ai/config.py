"""
Configuration management for AI services
"""
import os
from typing import Dict, Any
from google.cloud import secretmanager
from cachetools import TTLCache
import logging

logger = logging.getLogger(__name__)

# Cache for secrets to avoid repeated API calls
secret_cache = TTLCache(maxsize=100, ttl=300)  # 5 minutes TTL

class SecretConfig:
    def __init__(self):
        self.gemini_api_key = None
        self.translate_api_key = None
        self.speech_to_text_api_key = None
        self.jwt_signing_key = None

def get_secure_config() -> SecretConfig:
    """Retrieve secure configuration from Google Secret Manager"""
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT', 'delang-zeta')
    
    try:
        client = secretmanager.SecretManagerServiceClient()
        
        config = SecretConfig()
        
        # Retrieve all secrets
        secrets = {
            'gemini_api_key': f'projects/{project_id}/secrets/gemini-api-key/versions/latest',
            'translate_api_key': f'projects/{project_id}/secrets/translate-api-key/versions/latest',
            'speech_to_text_api_key': f'projects/{project_id}/secrets/speech-api-key/versions/latest',
            'jwt_signing_key': f'projects/{project_id}/secrets/jwt-signing-key/versions/latest'
        }
        
        for attr_name, secret_name in secrets.items():
            try:
                secret_value = get_secret(client, secret_name)
                setattr(config, attr_name, secret_value)
            except Exception as e:
                logger.error(f"Failed to retrieve secret {secret_name}: {e}")
                raise
        
        return config
        
    except Exception as e:
        logger.error(f"Failed to retrieve secrets: {e}")
        raise ValueError("Configuration error: Unable to access required secrets")

def get_secret(client: secretmanager.SecretManagerServiceClient, secret_name: str) -> str:
    """Get a single secret with caching"""
    # Check cache first
    if secret_name in secret_cache:
        return secret_cache[secret_name]
    
    try:
        response = client.access_secret_version(request={"name": secret_name})
        secret_value = response.payload.data.decode("UTF-8")
        
        if not secret_value:
            raise ValueError(f"Empty secret value for {secret_name}")
        
        # Cache the secret
        secret_cache[secret_name] = secret_value
        
        return secret_value
        
    except Exception as e:
        logger.error(f"Failed to access secret {secret_name}: {e}")
        raise

# AI Service Configuration
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
    },
    'TIMEOUTS': {
        'GEMINI': 30.0,  # 30 seconds
        'TRANSLATE': 10.0,  # 10 seconds
        'SPEECH': 60.0  # 60 seconds
    },
    'RETRY': {
        'MAX_ATTEMPTS': 3,
        'BACKOFF_MULTIPLIER': 2,
        'INITIAL_DELAY': 1.0
    },
    'COST_ESTIMATES': {
        'GEMINI': {
            'text': 0.01,
            'audio': 0.05,
            'image': 0.03
        },
        'TRANSLATE': {
            'per_character': 0.00002  # $20 per million characters
        },
        'SPEECH': {
            'per_minute': 0.024  # $0.024 per minute
        }
    }
}

def get_service_config(service: str) -> Dict[str, Any]:
    """Get configuration for a specific service"""
    if service not in AI_CONFIG['RATE_LIMITS']:
        raise ValueError(f"Unknown service: {service}")
    
    return {
        'rate_limits': AI_CONFIG['RATE_LIMITS'][service],
        'timeout': AI_CONFIG['TIMEOUTS'][service],
        'retry': AI_CONFIG['RETRY'],
        'cost_estimates': AI_CONFIG['COST_ESTIMATES'].get(service, {})
    }