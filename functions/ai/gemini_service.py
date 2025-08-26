"""
Gemini 2.5 Flash API integration service
"""
import json
import time
import re
from typing import Dict, Any, Optional, List
import google.generativeai as genai
from google.cloud import storage
from PIL import Image
import io
from config import get_secure_config, AI_CONFIG
from middleware import check_cost_limits, log_audit_event, AuditLog, estimate_cost, get_current_timestamp
import logging

logger = logging.getLogger(__name__)

class TaskCriteria:
    def __init__(self, data: Dict[str, Any]):
        self.language = data.get('language', 'en')
        self.min_word_count = data.get('minWordCount')
        self.max_word_count = data.get('maxWordCount')
        self.min_duration = data.get('minDuration')
        self.max_duration = data.get('maxDuration')
        self.quality_threshold = data.get('qualityThreshold', 80)
        self.specific_requirements = data.get('specificRequirements', [])

class SecureVerificationRequest:
    def __init__(self, data: Dict[str, Any]):
        self.submission_id = data['submissionId']
        self.data_type = data['dataType']
        self.storage_url = data['storageUrl']
        self.language = data['language']
        self.task_criteria = TaskCriteria(data['taskCriteria'])
        self.user_token = data.get('userToken', '')

class SecureVerificationResponse:
    def __init__(self, submission_id: str, quality_score: int, language_detected: str,
                 issues: List[str], recommendations: List[str], confidence: float,
                 processing_time: int, cost_estimate: float, timestamp: str):
        self.submission_id = submission_id
        self.quality_score = quality_score
        self.language_detected = language_detected
        self.issues = issues
        self.recommendations = recommendations
        self.confidence = confidence
        self.processing_time = processing_time
        self.cost_estimate = cost_estimate
        self.timestamp = timestamp
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'submissionId': self.submission_id,
            'qualityScore': self.quality_score,
            'languageDetected': self.language_detected,
            'issues': self.issues,
            'recommendations': self.recommendations,
            'confidence': self.confidence,
            'processingTime': self.processing_time,
            'costEstimate': self.cost_estimate,
            'timestamp': self.timestamp
        }

class GeminiVerificationService:
    def __init__(self):
        self.model = None
        self.storage_client = None
        self.initialized = False
    
    def initialize(self):
        """Initialize the Gemini service"""
        if self.initialized:
            return
        
        try:
            config = get_secure_config()
            genai.configure(api_key=config.gemini_api_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
            self.storage_client = storage.Client()
            self.initialized = True
            logger.info("Gemini service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini service: {e}")
            raise ValueError("Gemini service initialization failed")
    
    def verify_submission(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Verify a submission using Gemini 2.5 Flash"""
        start_time = int(time.time() * 1000)  # milliseconds
        
        try:
            self.initialize()
            request = SecureVerificationRequest(request_data)
            
            # Check cost limits
            estimated_cost = self._estimate_verification_cost(request)
            if not check_cost_limits(request.user_token, 'GEMINI', estimated_cost):
                raise ValueError('Daily cost limit exceeded for Gemini API')
            
            # Download and validate file from Google Cloud Storage
            file_content = self._download_file(request.storage_url)
            
            # Perform AI verification based on data type
            if request.data_type == 'text':
                result = self._verify_text_content(request, file_content.decode('utf-8'))
            elif request.data_type == 'audio':
                result = self._verify_audio_content(request, file_content)
            elif request.data_type == 'image':
                result = self._verify_image_content(request, file_content)
            else:
                raise ValueError(f"Unsupported data type: {request.data_type}")
            
            processing_time = int(time.time() * 1000) - start_time
            
            # Create response
            response = SecureVerificationResponse(
                submission_id=result['submissionId'],
                quality_score=result['qualityScore'],
                language_detected=result['languageDetected'],
                issues=result['issues'],
                recommendations=result['recommendations'],
                confidence=result['confidence'],
                processing_time=processing_time,
                cost_estimate=estimated_cost,
                timestamp=get_current_timestamp()
            )
            
            # Log successful verification
            log_audit_event(AuditLog(
                user_id=request.user_token,
                action='gemini_verification',
                endpoint='/gemini/verify',
                timestamp=get_current_timestamp(),
                request_id=request.submission_id,
                success=True,
                metadata={
                    'dataType': request.data_type,
                    'qualityScore': response.quality_score,
                    'processingTime': processing_time,
                    'costEstimate': estimated_cost
                }
            ))
            
            return response.to_dict()
            
        except Exception as e:
            processing_time = int(time.time() * 1000) - start_time
            
            # Log failed verification
            log_audit_event(AuditLog(
                user_id=request_data.get('userToken', 'unknown'),
                action='gemini_verification',
                endpoint='/gemini/verify',
                timestamp=get_current_timestamp(),
                request_id=request_data.get('submissionId', 'unknown'),
                success=False,
                error=str(e),
                metadata={
                    'dataType': request_data.get('dataType'),
                    'processingTime': processing_time
                }
            ))
            
            raise
    
    def _verify_text_content(self, request: SecureVerificationRequest, content: str) -> Dict[str, Any]:
        """Verify text content using Gemini"""
        prompt = self._build_text_verification_prompt(content, request.task_criteria)
        
        try:
            response = self.model.generate_content(prompt)
            analysis_text = response.text
            
            return self._parse_verification_response(request.submission_id, analysis_text, content)
            
        except Exception as e:
            logger.error(f"Gemini text verification failed: {e}")
            raise ValueError("AI text verification failed")
    
    def _verify_audio_content(self, request: SecureVerificationRequest, audio_buffer: bytes) -> Dict[str, Any]:
        """Verify audio content (simplified implementation)"""
        # For audio, we would typically need to transcribe first
        # This is a simplified implementation
        try:
            # In a real implementation, you'd convert audio to a format Gemini can process
            # For now, we'll return a basic response
            return {
                'submissionId': request.submission_id,
                'qualityScore': 75,  # Placeholder score
                'languageDetected': request.language,
                'issues': ['Audio verification requires additional processing'],
                'recommendations': ['Consider using Speech-to-Text API first'],
                'confidence': 0.6
            }
        except Exception as e:
            logger.error(f"Gemini audio verification failed: {e}")
            raise ValueError("AI audio verification failed")
    
    def _verify_image_content(self, request: SecureVerificationRequest, image_buffer: bytes) -> Dict[str, Any]:
        """Verify image content using Gemini"""
        prompt = self._build_image_verification_prompt(request.task_criteria)
        
        try:
            # Convert image buffer to PIL Image
            image = Image.open(io.BytesIO(image_buffer))
            
            # Generate content with image
            response = self.model.generate_content([prompt, image])
            analysis_text = response.text
            
            return self._parse_verification_response(request.submission_id, analysis_text)
            
        except Exception as e:
            logger.error(f"Gemini image verification failed: {e}")
            raise ValueError("AI image verification failed")
    
    def _build_text_verification_prompt(self, content: str, criteria: TaskCriteria) -> str:
        """Build prompt for text verification"""
        return f"""
Analyze the following text submission for a language data collection task:

CONTENT:
{content}

TASK CRITERIA:
- Target Language: {criteria.language}
- Quality Threshold: {criteria.quality_threshold}%
- Min Word Count: {criteria.min_word_count or 'Not specified'}
- Max Word Count: {criteria.max_word_count or 'Not specified'}
- Specific Requirements: {', '.join(criteria.specific_requirements) if criteria.specific_requirements else 'None'}

Please provide a detailed analysis in the following JSON format:
{{
  "qualityScore": <number 0-100>,
  "languageDetected": "<language>",
  "issues": ["<issue1>", "<issue2>"],
  "recommendations": ["<rec1>", "<rec2>"],
  "confidence": <number 0-1>,
  "wordCount": <number>,
  "grammarScore": <number 0-100>,
  "relevanceScore": <number 0-100>
}}

Focus on:
1. Language accuracy and grammar
2. Content relevance to task requirements
3. Text quality and readability
4. Compliance with specified criteria
5. Potential issues or improvements
"""
    
    def _build_image_verification_prompt(self, criteria: TaskCriteria) -> str:
        """Build prompt for image verification"""
        return f"""
Analyze this image submission for a language data collection task:

TASK CRITERIA:
- Target Language: {criteria.language}
- Quality Threshold: {criteria.quality_threshold}%
- Specific Requirements: {', '.join(criteria.specific_requirements) if criteria.specific_requirements else 'None'}

If the image contains text, analyze the text quality and language.
If it's a visual representation, assess its relevance to language learning.
Provide detailed feedback on quality and compliance in JSON format:

{{
  "qualityScore": <number 0-100>,
  "languageDetected": "<language>",
  "issues": ["<issue1>", "<issue2>"],
  "recommendations": ["<rec1>", "<rec2>"],
  "confidence": <number 0-1>
}}
"""
    
    def _parse_verification_response(self, submission_id: str, analysis_text: str, 
                                   original_content: Optional[str] = None) -> Dict[str, Any]:
        """Parse Gemini response into structured format"""
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', analysis_text)
            if json_match:
                analysis = json.loads(json_match.group())
                return {
                    'submissionId': submission_id,
                    'qualityScore': analysis.get('qualityScore', 0),
                    'languageDetected': analysis.get('languageDetected', 'unknown'),
                    'issues': analysis.get('issues', []),
                    'recommendations': analysis.get('recommendations', []),
                    'confidence': analysis.get('confidence', 0)
                }
        except (json.JSONDecodeError, AttributeError) as e:
            logger.warning(f"Failed to parse Gemini response as JSON: {e}")
        
        # Fallback to basic analysis if JSON parsing fails
        return {
            'submissionId': submission_id,
            'qualityScore': self._calculate_basic_quality_score(analysis_text, original_content),
            'languageDetected': 'unknown',
            'issues': ['Unable to parse detailed analysis'],
            'recommendations': ['Manual review recommended'],
            'confidence': 0.5
        }
    
    def _calculate_basic_quality_score(self, analysis_text: str, content: Optional[str] = None) -> int:
        """Calculate basic quality score based on analysis text and content"""
        score = 50  # Base score
        
        analysis_lower = analysis_text.lower()
        
        # Positive indicators
        if any(word in analysis_lower for word in ['good', 'excellent', 'high quality', 'well written']):
            score += 20
        if any(word in analysis_lower for word in ['clear', 'coherent', 'accurate']):
            score += 10
        
        # Negative indicators
        if any(word in analysis_lower for word in ['poor', 'bad', 'low quality', 'errors']):
            score -= 20
        if any(word in analysis_lower for word in ['unclear', 'incoherent', 'mistakes']):
            score -= 10
        
        # Content length bonus
        if content and len(content) > 100:
            score += 10
        
        return max(0, min(100, score))
    
    def _download_file(self, storage_url: str) -> bytes:
        """Download file from Google Cloud Storage"""
        try:
            # Parse Google Cloud Storage URL
            if not storage_url.startswith('gs://'):
                raise ValueError("Invalid storage URL format")
            
            url_parts = storage_url.replace('gs://', '').split('/', 1)
            if len(url_parts) != 2:
                raise ValueError("Invalid storage URL format")
            
            bucket_name, file_name = url_parts
            
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(file_name)
            
            return blob.download_as_bytes()
            
        except Exception as e:
            logger.error(f"Failed to download file from storage: {e}")
            raise ValueError("Unable to access submitted file")
    
    def _estimate_verification_cost(self, request: SecureVerificationRequest) -> float:
        """Estimate cost for verification based on data type"""
        return estimate_cost('GEMINI', request.data_type)
    
    def get_current_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        return get_current_timestamp()