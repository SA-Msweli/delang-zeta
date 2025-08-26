"""
Tests for Gemini verification service
"""
import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from gemini_service import GeminiVerificationService, SecureVerificationRequest, TaskCriteria

class TestGeminiVerificationService:
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = GeminiVerificationService()
        
        self.mock_request_data = {
            'submissionId': 'test-submission-123',
            'dataType': 'text',
            'storageUrl': 'gs://test-bucket/test-file.txt',
            'language': 'en',
            'taskCriteria': {
                'language': 'en',
                'minWordCount': 10,
                'maxWordCount': 1000,
                'qualityThreshold': 80,
                'specificRequirements': ['grammatically correct', 'native-like fluency']
            },
            'userToken': 'test-user-token'
        }
    
    @patch('gemini_service.get_secure_config')
    @patch('google.generativeai.configure')
    @patch('google.generativeai.GenerativeModel')
    @patch('gemini_service.storage.Client')
    def test_initialize_success(self, mock_storage, mock_model, mock_configure, mock_config):
        """Test successful service initialization"""
        mock_config.return_value.gemini_api_key = 'test-api-key'
        
        self.service.initialize()
        
        assert self.service.initialized is True
        mock_configure.assert_called_once_with(api_key='test-api-key')
        mock_model.assert_called_once_with('gemini-2.0-flash-exp')
    
    @patch('gemini_service.get_secure_config')
    def test_initialize_failure(self, mock_config):
        """Test service initialization failure"""
        mock_config.side_effect = Exception('API key invalid')
        
        with pytest.raises(ValueError, match='Gemini service initialization failed'):
            self.service.initialize()
    
    @patch.object(GeminiVerificationService, 'initialize')
    @patch('gemini_service.check_cost_limits')
    @patch.object(GeminiVerificationService, '_download_file')
    @patch.object(GeminiVerificationService, '_verify_text_content')
    @patch('gemini_service.log_audit_event')
    def test_verify_submission_text_success(self, mock_log, mock_verify, mock_download, 
                                          mock_cost_check, mock_init):
        """Test successful text verification"""
        mock_cost_check.return_value = True
        mock_download.return_value = b'Test content for verification'
        mock_verify.return_value = {
            'submissionId': 'test-submission-123',
            'qualityScore': 85,
            'languageDetected': 'en',
            'issues': [],
            'recommendations': ['Great work!'],
            'confidence': 0.9
        }
        
        result = self.service.verify_submission(self.mock_request_data)
        
        assert result['submissionId'] == 'test-submission-123'
        assert result['qualityScore'] == 85
        assert result['languageDetected'] == 'en'
        assert 'processingTime' in result
        assert 'timestamp' in result
        mock_log.assert_called()
    
    @patch.object(GeminiVerificationService, 'initialize')
    @patch('gemini_service.check_cost_limits')
    def test_verify_submission_cost_limit_exceeded(self, mock_cost_check, mock_init):
        """Test verification with cost limit exceeded"""
        mock_cost_check.return_value = False
        
        with pytest.raises(ValueError, match='Daily cost limit exceeded'):
            self.service.verify_submission(self.mock_request_data)
    
    def test_verify_submission_unsupported_data_type(self):
        """Test verification with unsupported data type"""
        invalid_request = self.mock_request_data.copy()
        invalid_request['dataType'] = 'video'
        
        with pytest.raises(ValueError, match='Unsupported data type: video'):
            self.service.verify_submission(invalid_request)
    
    @patch('gemini_service.storage.Client')
    def test_download_file_success(self, mock_storage_client):
        """Test successful file download"""
        mock_bucket = Mock()
        mock_blob = Mock()
        mock_blob.download_as_bytes.return_value = b'test file content'
        mock_bucket.blob.return_value = mock_blob
        mock_storage_client.return_value.bucket.return_value = mock_bucket
        
        self.service.storage_client = mock_storage_client.return_value
        
        result = self.service._download_file('gs://test-bucket/test-file.txt')
        
        assert result == b'test file content'
        mock_storage_client.return_value.bucket.assert_called_with('test-bucket')
        mock_bucket.blob.assert_called_with('test-file.txt')
    
    def test_download_file_invalid_url(self):
        """Test file download with invalid URL"""
        with pytest.raises(ValueError, match='Invalid storage URL format'):
            self.service._download_file('https://invalid-url.com/file.txt')
    
    @patch.object(GeminiVerificationService, 'model')
    def test_verify_text_content_success(self, mock_model):
        """Test successful text content verification"""
        mock_response = Mock()
        mock_response.text = json.dumps({
            'qualityScore': 85,
            'languageDetected': 'en',
            'issues': [],
            'recommendations': ['Great work!'],
            'confidence': 0.9,
            'wordCount': 150,
            'grammarScore': 90,
            'relevanceScore': 80
        })
        mock_model.generate_content.return_value.text = mock_response.text
        
        self.service.model = mock_model
        
        request = SecureVerificationRequest(self.mock_request_data)
        result = self.service._verify_text_content(request, 'Test content')
        
        assert result['submissionId'] == 'test-submission-123'
        assert result['qualityScore'] == 85
        assert result['languageDetected'] == 'en'
    
    @patch.object(GeminiVerificationService, 'model')
    def test_verify_text_content_api_failure(self, mock_model):
        """Test text verification with API failure"""
        mock_model.generate_content.side_effect = Exception('API quota exceeded')
        self.service.model = mock_model
        
        request = SecureVerificationRequest(self.mock_request_data)
        
        with pytest.raises(ValueError, match='AI text verification failed'):
            self.service._verify_text_content(request, 'Test content')
    
    def test_verify_audio_content(self):
        """Test audio content verification (placeholder)"""
        request = SecureVerificationRequest(self.mock_request_data)
        result = self.service._verify_audio_content(request, b'fake-audio-data')
        
        assert result['submissionId'] == 'test-submission-123'
        assert result['qualityScore'] == 75
        assert 'Audio verification requires additional processing' in result['issues']
    
    @patch.object(GeminiVerificationService, 'model')
    @patch('gemini_service.Image')
    def test_verify_image_content_success(self, mock_image, mock_model):
        """Test successful image content verification"""
        mock_pil_image = Mock()
        mock_image.open.return_value = mock_pil_image
        
        mock_response = Mock()
        mock_response.text = json.dumps({
            'qualityScore': 75,
            'languageDetected': 'en',
            'issues': ['Image quality could be improved'],
            'recommendations': ['Use higher resolution'],
            'confidence': 0.7
        })
        mock_model.generate_content.return_value.text = mock_response.text
        
        self.service.model = mock_model
        
        # Mock PNG image buffer
        png_header = bytes([0x89, 0x50, 0x4E, 0x47])
        mock_image_buffer = png_header + b'\x00' * 100
        
        request = SecureVerificationRequest(self.mock_request_data)
        result = self.service._verify_image_content(request, mock_image_buffer)
        
        assert result['submissionId'] == 'test-submission-123'
        assert result['qualityScore'] == 75
    
    def test_parse_verification_response_valid_json(self):
        """Test parsing valid JSON response"""
        analysis_text = '''
        Here is the analysis:
        {
            "qualityScore": 85,
            "languageDetected": "en",
            "issues": [],
            "recommendations": ["Great work!"],
            "confidence": 0.9
        }
        Additional text here.
        '''
        
        result = self.service._parse_verification_response('test-123', analysis_text)
        
        assert result['submissionId'] == 'test-123'
        assert result['qualityScore'] == 85
        assert result['languageDetected'] == 'en'
        assert result['confidence'] == 0.9
    
    def test_parse_verification_response_invalid_json(self):
        """Test parsing invalid JSON response"""
        analysis_text = 'This is not JSON format but contains good quality indicators'
        
        result = self.service._parse_verification_response('test-123', analysis_text, 'original content')
        
        assert result['submissionId'] == 'test-123'
        assert result['qualityScore'] > 50  # Should get bonus for 'good'
        assert result['languageDetected'] == 'unknown'
        assert 'Unable to parse detailed analysis' in result['issues']
    
    def test_calculate_basic_quality_score(self):
        """Test basic quality score calculation"""
        # Test positive indicators
        good_analysis = 'This is excellent work with good quality'
        score = self.service._calculate_basic_quality_score(good_analysis, 'long content here' * 20)
        assert score > 70
        
        # Test negative indicators
        bad_analysis = 'This is poor quality work with many errors'
        score = self.service._calculate_basic_quality_score(bad_analysis, 'short')
        assert score < 50
    
    def test_estimate_verification_cost(self):
        """Test cost estimation for different data types"""
        text_request = SecureVerificationRequest({
            **self.mock_request_data,
            'dataType': 'text'
        })
        assert self.service._estimate_verification_cost(text_request) == 0.01
        
        audio_request = SecureVerificationRequest({
            **self.mock_request_data,
            'dataType': 'audio'
        })
        assert self.service._estimate_verification_cost(audio_request) == 0.05
        
        image_request = SecureVerificationRequest({
            **self.mock_request_data,
            'dataType': 'image'
        })
        assert self.service._estimate_verification_cost(image_request) == 0.03
    
    def test_build_text_verification_prompt(self):
        """Test text verification prompt building"""
        criteria = TaskCriteria(self.mock_request_data['taskCriteria'])
        content = 'This is test content for verification'
        
        prompt = self.service._build_text_verification_prompt(content, criteria)
        
        assert 'Target Language: en' in prompt
        assert 'Quality Threshold: 80%' in prompt
        assert content in prompt
        assert 'JSON format' in prompt
    
    def test_build_image_verification_prompt(self):
        """Test image verification prompt building"""
        criteria = TaskCriteria(self.mock_request_data['taskCriteria'])
        
        prompt = self.service._build_image_verification_prompt(criteria)
        
        assert 'Target Language: en' in prompt
        assert 'Quality Threshold: 80%' in prompt
        assert 'JSON format' in prompt

if __name__ == '__main__':
    pytest.main([__file__])