"""
Tests for middleware functions
"""
import pytest
import jwt
import time
from unittest.mock import Mock, patch, MagicMock
from flask import Flask, request
from middleware import (
    authenticate_token, rate_limiter, check_cost_limits, 
    log_audit_event, AuditLog, estimate_cost
)

class TestMiddleware:
    
    def setup_method(self):
        """Set up test fixtures"""
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        
    def test_audit_log_creation(self):
        """Test AuditLog class creation"""
        log = AuditLog(
            user_id='user123',
            action='test_action',
            endpoint='/test',
            timestamp='2024-01-01T00:00:00.000Z',
            request_id='req123',
            success=True,
            metadata={'key': 'value'}
        )
        
        assert log.user_id == 'user123'
        assert log.action == 'test_action'
        assert log.success is True
        assert log.metadata == {'key': 'value'}
    
    @patch('middleware.log_audit_event')
    def test_log_audit_event(self, mock_log):
        """Test audit event logging"""
        log = AuditLog(
            user_id='user123',
            action='test',
            endpoint='/test',
            timestamp='2024-01-01T00:00:00.000Z',
            request_id='req123',
            success=True
        )
        
        log_audit_event(log)
        mock_log.assert_called_once_with(log)
    
    def test_estimate_cost_gemini(self):
        """Test cost estimation for Gemini service"""
        assert estimate_cost('GEMINI', 'text') == 0.01
        assert estimate_cost('GEMINI', 'audio') == 0.05
        assert estimate_cost('GEMINI', 'image') == 0.03
        assert estimate_cost('GEMINI', 'unknown') == 0.02  # default
    
    def test_estimate_cost_translate(self):
        """Test cost estimation for Translate service"""
        cost = estimate_cost('TRANSLATE', content_length=1000)
        expected = 1000 * 0.00002  # $20 per million characters
        assert cost == expected
    
    def test_estimate_cost_speech(self):
        """Test cost estimation for Speech service"""
        cost = estimate_cost('SPEECH', duration=120.0)  # 2 minutes
        expected = (120.0 / 60.0) * 0.024  # $0.024 per minute
        assert cost == expected
    
    def test_estimate_cost_unknown_service(self):
        """Test cost estimation for unknown service"""
        cost = estimate_cost('UNKNOWN_SERVICE')
        assert cost == 0.01  # default small cost
    
    @patch('middleware.TTLCache')
    def test_check_cost_limits_within_limit(self, mock_cache):
        """Test cost limits check when within limits"""
        mock_cache_instance = Mock()
        mock_cache_instance.get.return_value = None  # No existing cost data
        mock_cache.return_value = mock_cache_instance
        
        result = check_cost_limits('user123', 'GEMINI', 5.0)
        
        assert result is True
        mock_cache_instance.set.assert_called_once()
    
    @patch('middleware.TTLCache')
    def test_check_cost_limits_exceeds_limit(self, mock_cache):
        """Test cost limits check when exceeding limits"""
        mock_cache_instance = Mock()
        mock_cost_data = Mock()
        mock_cost_data.cost = 98.0  # Close to $100 limit
        mock_cost_data.request_count = 50
        mock_cache_instance.get.return_value = mock_cost_data
        mock_cache.return_value = mock_cache_instance
        
        result = check_cost_limits('user123', 'GEMINI', 5.0)  # Would exceed limit
        
        assert result is False
    
    @patch('middleware.TTLCache')
    def test_check_cost_limits_error_handling(self, mock_cache):
        """Test cost limits check error handling"""
        mock_cache.side_effect = Exception('Cache error')
        
        result = check_cost_limits('user123', 'GEMINI', 5.0)
        
        assert result is True  # Should allow request if monitoring fails

class TestAuthenticateToken:
    
    def setup_method(self):
        """Set up test fixtures"""
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        
        @self.app.route('/test')
        @authenticate_token
        def test_endpoint():
            return {'message': 'success', 'user_id': request.user_id}
        
        self.client = self.app.test_client()
    
    @patch('middleware.get_secure_config')
    @patch('middleware.jwt.decode')
    def test_authenticate_valid_token(self, mock_jwt_decode, mock_config):
        """Test authentication with valid token"""
        mock_config.return_value.jwt_signing_key = 'test-secret'
        mock_jwt_decode.return_value = {
            'userId': 'user123',
            'address': '0x123...'
        }
        
        with self.app.test_client() as client:
            response = client.get('/test', headers={
                'Authorization': 'Bearer valid-token'
            })
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['user_id'] == 'user123'
    
    def test_authenticate_missing_token(self):
        """Test authentication without token"""
        with self.app.test_client() as client:
            response = client.get('/test')
            
            assert response.status_code == 401
            data = response.get_json()
            assert data['error'] == 'Access token required'
    
    def test_authenticate_malformed_header(self):
        """Test authentication with malformed header"""
        with self.app.test_client() as client:
            response = client.get('/test', headers={
                'Authorization': 'InvalidFormat'
            })
            
            assert response.status_code == 401
            data = response.get_json()
            assert data['error'] == 'Access token required'
    
    @patch('middleware.get_secure_config')
    @patch('middleware.jwt.decode')
    def test_authenticate_expired_token(self, mock_jwt_decode, mock_config):
        """Test authentication with expired token"""
        mock_config.return_value.jwt_signing_key = 'test-secret'
        mock_jwt_decode.side_effect = jwt.ExpiredSignatureError('Token expired')
        
        with self.app.test_client() as client:
            response = client.get('/test', headers={
                'Authorization': 'Bearer expired-token'
            })
            
            assert response.status_code == 403
            data = response.get_json()
            assert data['error'] == 'Token expired'
    
    @patch('middleware.get_secure_config')
    @patch('middleware.jwt.decode')
    def test_authenticate_invalid_token(self, mock_jwt_decode, mock_config):
        """Test authentication with invalid token"""
        mock_config.return_value.jwt_signing_key = 'test-secret'
        mock_jwt_decode.side_effect = jwt.InvalidTokenError('Invalid token')
        
        with self.app.test_client() as client:
            response = client.get('/test', headers={
                'Authorization': 'Bearer invalid-token'
            })
            
            assert response.status_code == 403
            data = response.get_json()
            assert data['error'] == 'Invalid or expired token'

class TestRateLimiter:
    
    def setup_method(self):
        """Set up test fixtures"""
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        
        @self.app.route('/test')
        @authenticate_token
        @rate_limiter('GEMINI')
        def test_endpoint():
            return {'message': 'success'}
        
        self.client = self.app.test_client()
    
    @patch('middleware.get_secure_config')
    @patch('middleware.jwt.decode')
    @patch('middleware.TTLCache')
    def test_rate_limiter_within_limits(self, mock_cache, mock_jwt_decode, mock_config):
        """Test rate limiter when within limits"""
        # Mock authentication
        mock_config.return_value.jwt_signing_key = 'test-secret'
        mock_jwt_decode.return_value = {'userId': 'user123', 'address': '0x123...'}
        
        # Mock cache
        mock_cache_instance = Mock()
        mock_cache_instance.get.return_value = None  # No existing rate limit
        mock_cache.return_value = mock_cache_instance
        
        with self.app.test_client() as client:
            response = client.get('/test', headers={
                'Authorization': 'Bearer valid-token'
            })
            
            assert response.status_code == 200
            # Should set both minute and hourly counters
            assert mock_cache_instance.set.call_count == 2
    
    @patch('middleware.get_secure_config')
    @patch('middleware.jwt.decode')
    @patch('middleware.TTLCache')
    def test_rate_limiter_exceeds_minute_limit(self, mock_cache, mock_jwt_decode, mock_config):
        """Test rate limiter when exceeding minute limit"""
        # Mock authentication
        mock_config.return_value.jwt_signing_key = 'test-secret'
        mock_jwt_decode.return_value = {'userId': 'user123', 'address': '0x123...'}
        
        # Mock cache with rate limit exceeded
        mock_cache_instance = Mock()
        mock_rate_limit = Mock()
        mock_rate_limit.request_count = 60  # At GEMINI minute limit
        mock_cache_instance.get.return_value = mock_rate_limit
        mock_cache.return_value = mock_cache_instance
        
        with self.app.test_client() as client:
            response = client.get('/test', headers={
                'Authorization': 'Bearer valid-token'
            })
            
            assert response.status_code == 429
            data = response.get_json()
            assert data['error'] == 'Rate limit exceeded'
            assert 'retryAfter' in data
    
    @patch('middleware.get_secure_config')
    @patch('middleware.jwt.decode')
    @patch('middleware.TTLCache')
    def test_rate_limiter_exceeds_hourly_limit(self, mock_cache, mock_jwt_decode, mock_config):
        """Test rate limiter when exceeding hourly limit"""
        # Mock authentication
        mock_config.return_value.jwt_signing_key = 'test-secret'
        mock_jwt_decode.return_value = {'userId': 'user123', 'address': '0x123...'}
        
        # Mock cache with hourly limit exceeded
        mock_cache_instance = Mock()
        mock_hourly_limit = Mock()
        mock_hourly_limit.request_count = 1000  # At GEMINI hourly limit
        mock_cache_instance.get.side_effect = [None, mock_hourly_limit]  # No minute limit, but hourly exceeded
        mock_cache.return_value = mock_cache_instance
        
        with self.app.test_client() as client:
            response = client.get('/test', headers={
                'Authorization': 'Bearer valid-token'
            })
            
            assert response.status_code == 429
            data = response.get_json()
            assert data['error'] == 'Hourly rate limit exceeded'
    
    def test_rate_limiter_without_authentication(self):
        """Test rate limiter without authentication"""
        with self.app.test_client() as client:
            response = client.get('/test')
            
            assert response.status_code == 401  # Should fail at authentication first
    
    @patch('middleware.get_secure_config')
    @patch('middleware.jwt.decode')
    def test_rate_limiter_unknown_service(self, mock_jwt_decode, mock_config):
        """Test rate limiter with unknown service"""
        # Mock authentication
        mock_config.return_value.jwt_signing_key = 'test-secret'
        mock_jwt_decode.return_value = {'userId': 'user123', 'address': '0x123...'}
        
        # Create endpoint with unknown service
        @self.app.route('/test-unknown')
        @authenticate_token
        @rate_limiter('UNKNOWN_SERVICE')
        def test_unknown_endpoint():
            return {'message': 'success'}
        
        with self.app.test_client() as client:
            response = client.get('/test-unknown', headers={
                'Authorization': 'Bearer valid-token'
            })
            
            assert response.status_code == 500
            data = response.get_json()
            assert data['error'] == 'Service configuration error'

if __name__ == '__main__':
    pytest.main([__file__])