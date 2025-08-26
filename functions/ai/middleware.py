"""
Middleware for authentication, rate limiting, and monitoring
"""
import jwt
import time
import json
from functools import wraps
from typing import Dict, Any, Optional
from flask import request, jsonify, g
from cachetools import TTLCache
from config import get_secure_config, AI_CONFIG
import logging

logger = logging.getLogger(__name__)

# Cache instances
rate_limit_cache = TTLCache(maxsize=10000, ttl=3600)  # 1 hour TTL
cost_cache = TTLCache(maxsize=10000, ttl=86400)  # 24 hour TTL
audit_cache = TTLCache(maxsize=50000, ttl=86400)  # 24 hour TTL

class RateLimitInfo:
    def __init__(self, user_id: str, endpoint: str, request_count: int, window_start: int, limit: int):
        self.user_id = user_id
        self.endpoint = endpoint
        self.request_count = request_count
        self.window_start = window_start
        self.limit = limit

class CostMonitoring:
    def __init__(self, user_id: str, service: str, cost: float, request_count: int, timestamp: int):
        self.user_id = user_id
        self.service = service
        self.cost = cost
        self.request_count = request_count
        self.timestamp = timestamp

class AuditLog:
    def __init__(self, user_id: str, action: str, endpoint: str, timestamp: str, 
                 request_id: str, success: bool, error: Optional[str] = None, 
                 metadata: Optional[Dict[str, Any]] = None):
        self.user_id = user_id
        self.action = action
        self.endpoint = endpoint
        self.timestamp = timestamp
        self.request_id = request_id
        self.success = success
        self.error = error
        self.metadata = metadata or {}

def authenticate_token(f):
    """Decorator for JWT token authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        token = auth_header.split(' ')[1] if auth_header and auth_header.startswith('Bearer ') else None
        
        if not token:
            log_audit_event(AuditLog(
                user_id='unknown',
                action='authenticate',
                endpoint=request.path,
                timestamp=get_current_timestamp(),
                request_id=request.headers.get('X-Request-ID', 'unknown'),
                success=False,
                error='Access token required'
            ))
            return jsonify({'error': 'Access token required'}), 401
        
        try:
            config = get_secure_config()
            decoded = jwt.decode(token, config.jwt_signing_key, algorithms=['HS256'])
            
            # Add user info to request context
            request.user_id = decoded.get('userId')
            request.user_address = decoded.get('address')
            
            # Log successful authentication
            log_audit_event(AuditLog(
                user_id=request.user_id,
                action='authenticate',
                endpoint=request.path,
                timestamp=get_current_timestamp(),
                request_id=request.headers.get('X-Request-ID', 'unknown'),
                success=True
            ))
            
            return f(*args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            log_audit_event(AuditLog(
                user_id='unknown',
                action='authenticate',
                endpoint=request.path,
                timestamp=get_current_timestamp(),
                request_id=request.headers.get('X-Request-ID', 'unknown'),
                success=False,
                error='Token expired'
            ))
            return jsonify({'error': 'Token expired'}), 403
            
        except jwt.InvalidTokenError as e:
            log_audit_event(AuditLog(
                user_id='unknown',
                action='authenticate',
                endpoint=request.path,
                timestamp=get_current_timestamp(),
                request_id=request.headers.get('X-Request-ID', 'unknown'),
                success=False,
                error='Invalid token'
            ))
            return jsonify({'error': 'Invalid or expired token'}), 403
            
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return jsonify({'error': 'Authentication service unavailable'}), 500
    
    return decorated_function

def rate_limiter(service: str):
    """Decorator for rate limiting based on service type"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = getattr(request, 'user_id', None)
            if not user_id:
                return jsonify({'error': 'Authentication required for rate limiting'}), 401
            
            endpoint = request.path
            now = int(time.time())
            window_start = (now // 60) * 60  # 1-minute window
            hourly_window = (now // 3600) * 3600  # 1-hour window
            
            rate_limit_key = f"{user_id}:{service}:{window_start}"
            hourly_key = f"{user_id}:{service}:hourly:{hourly_window}"
            
            try:
                config = AI_CONFIG['RATE_LIMITS'][service]
                
                # Check minute-based rate limit
                minute_limit = rate_limit_cache.get(rate_limit_key)
                if minute_limit and minute_limit.request_count >= config['REQUESTS_PER_MINUTE']:
                    return jsonify({
                        'error': 'Rate limit exceeded',
                        'retryAfter': 60 - (now - window_start)
                    }), 429
                
                # Check hourly rate limit
                hourly_limit = rate_limit_cache.get(hourly_key)
                if hourly_limit and hourly_limit.request_count >= config['REQUESTS_PER_HOUR']:
                    return jsonify({
                        'error': 'Hourly rate limit exceeded',
                        'retryAfter': 3600 - (now - hourly_window)
                    }), 429
                
                # Update counters
                minute_count = minute_limit.request_count + 1 if minute_limit else 1
                hourly_count = hourly_limit.request_count + 1 if hourly_limit else 1
                
                rate_limit_cache[rate_limit_key] = RateLimitInfo(
                    user_id=user_id,
                    endpoint=endpoint,
                    request_count=minute_count,
                    window_start=window_start,
                    limit=config['REQUESTS_PER_MINUTE']
                )
                
                rate_limit_cache[hourly_key] = RateLimitInfo(
                    user_id=user_id,
                    endpoint=endpoint,
                    request_count=hourly_count,
                    window_start=hourly_window,
                    limit=config['REQUESTS_PER_HOUR']
                )
                
                return f(*args, **kwargs)
                
            except KeyError:
                logger.error(f"Unknown service for rate limiting: {service}")
                return jsonify({'error': 'Service configuration error'}), 500
            except Exception as e:
                logger.error(f"Rate limiting error: {e}")
                return jsonify({'error': 'Rate limiting service unavailable'}), 500
        
        return decorated_function
    return decorator

def check_cost_limits(user_id: str, service: str, estimated_cost: float) -> bool:
    """Check if user is within daily cost limits"""
    today = time.strftime('%Y-%m-%d')
    cost_key = f"{user_id}:{service}:{today}"
    
    try:
        config = AI_CONFIG['RATE_LIMITS'][service]
        daily_cost = cost_cache.get(cost_key)
        current_cost = daily_cost.cost if daily_cost else 0.0
        
        if current_cost + estimated_cost > config['COST_LIMIT_PER_DAY']:
            return False
        
        # Update cost tracking
        new_cost = current_cost + estimated_cost
        new_count = (daily_cost.request_count + 1) if daily_cost else 1
        
        cost_cache[cost_key] = CostMonitoring(
            user_id=user_id,
            service=service,
            cost=new_cost,
            request_count=new_count,
            timestamp=int(time.time())
        )
        
        return True
        
    except Exception as e:
        logger.error(f"Cost monitoring error: {e}")
        return True  # Allow request if monitoring fails

def log_audit_event(event: AuditLog) -> None:
    """Log audit event"""
    try:
        audit_key = f"{event.user_id}:{int(time.time())}"
        audit_cache[audit_key] = event
        
        # In production, this would also write to Cloud Logging
        logger.info(f"Audit Event: {json.dumps({
            'userId': event.user_id,
            'action': event.action,
            'endpoint': event.endpoint,
            'timestamp': event.timestamp,
            'requestId': event.request_id,
            'success': event.success,
            'error': event.error,
            'metadata': event.metadata
        })}")
        
    except Exception as e:
        logger.error(f"Audit logging error: {e}")

def error_handler(error: Exception):
    """Global error handler"""
    user_id = getattr(request, 'user_id', 'unknown')
    
    log_audit_event(AuditLog(
        user_id=user_id,
        action='error',
        endpoint=request.path,
        timestamp=get_current_timestamp(),
        request_id=request.headers.get('X-Request-ID', 'unknown'),
        success=False,
        error=str(error),
        metadata={'error_type': type(error).__name__}
    ))
    
    return jsonify({
        'error': 'Internal server error',
        'requestId': request.headers.get('X-Request-ID')
    }), 500

def get_current_timestamp() -> str:
    """Get current timestamp in ISO format"""
    return time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())

def estimate_cost(service: str, data_type: str = None, content_length: int = 0, duration: float = 0.0) -> float:
    """Estimate cost for AI service usage"""
    try:
        cost_config = AI_CONFIG['COST_ESTIMATES'][service]
        
        if service == 'GEMINI':
            return cost_config.get(data_type, 0.02)  # Default cost
        elif service == 'TRANSLATE':
            return content_length * cost_config['per_character']
        elif service == 'SPEECH':
            return (duration / 60.0) * cost_config['per_minute']  # Convert seconds to minutes
        else:
            return 0.01  # Default small cost
            
    except Exception as e:
        logger.error(f"Cost estimation error: {e}")
        return 0.01  # Default small cost