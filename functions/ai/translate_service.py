"""
Google Translate API integration service
"""
import time
from typing import Dict, Any, Optional
from google.cloud import translate_v2 as translate
from config import get_secure_config
from middleware import check_cost_limits, log_audit_event, AuditLog, estimate_cost, get_current_timestamp
import logging

logger = logging.getLogger(__name__)

class TranslateRequest:
    def __init__(self, data: Dict[str, Any]):
        self.text = data['text']
        self.target_language = data.get('targetLanguage')
        self.source_language = data.get('sourceLanguage')
        self.user_token = data.get('userToken', '')

class TranslateResponse:
    def __init__(self, translated_text: str, detected_language: str, confidence: float, processing_time: int):
        self.translated_text = translated_text
        self.detected_language = detected_language
        self.confidence = confidence
        self.processing_time = processing_time
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'translatedText': self.translated_text,
            'detectedLanguage': self.detected_language,
            'confidence': self.confidence,
            'processingTime': self.processing_time
        }

class TranslateService:
    def __init__(self):
        self.client = None
        self.initialized = False
    
    def initialize(self):
        """Initialize the Translate service"""
        if self.initialized:
            return
        
        try:
            # Google Translate client uses default credentials
            self.client = translate.Client()
            self.initialized = True
            logger.info("Translate service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Translate service: {e}")
            raise ValueError("Translate service initialization failed")
    
    def translate_text(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Translate text using Google Translate API"""
        start_time = int(time.time() * 1000)  # milliseconds
        
        try:
            self.initialize()
            request = TranslateRequest(request_data)
            
            # Validate input
            if not request.text or not request.text.strip():
                raise ValueError("Text content is required")
            
            if len(request.text) > 10000:  # Reasonable limit
                raise ValueError("Text too long (max 10,000 characters)")
            
            # Check cost limits
            estimated_cost = estimate_cost('TRANSLATE', content_length=len(request.text))
            if not check_cost_limits(request.user_token, 'TRANSLATE', estimated_cost):
                raise ValueError('Daily cost limit exceeded for Translate API')
            
            # Perform translation
            result = self._perform_translation(request)
            
            processing_time = int(time.time() * 1000) - start_time
            
            # Create response
            response = TranslateResponse(
                translated_text=result['translatedText'],
                detected_language=result['detectedLanguage'],
                confidence=result['confidence'],
                processing_time=processing_time
            )
            
            # Log successful translation
            log_audit_event(AuditLog(
                user_id=request.user_token,
                action='translate_text',
                endpoint='/translate',
                timestamp=get_current_timestamp(),
                request_id=f"translate_{int(time.time())}",
                success=True,
                metadata={
                    'textLength': len(request.text),
                    'sourceLanguage': request.source_language,
                    'targetLanguage': request.target_language,
                    'detectedLanguage': response.detected_language,
                    'processingTime': processing_time,
                    'costEstimate': estimated_cost
                }
            ))
            
            return response.to_dict()
            
        except Exception as e:
            processing_time = int(time.time() * 1000) - start_time
            
            # Log failed translation
            log_audit_event(AuditLog(
                user_id=request_data.get('userToken', 'unknown'),
                action='translate_text',
                endpoint='/translate',
                timestamp=get_current_timestamp(),
                request_id=f"translate_{int(time.time())}",
                success=False,
                error=str(e),
                metadata={
                    'textLength': len(request_data.get('text', '')),
                    'processingTime': processing_time
                }
            ))
            
            raise
    
    def _perform_translation(self, request: TranslateRequest) -> Dict[str, Any]:
        """Perform the actual translation"""
        try:
            # If no target language specified, just detect language
            if not request.target_language:
                detection = self.client.detect_language(request.text)
                return {
                    'translatedText': request.text,  # No translation performed
                    'detectedLanguage': detection['language'],
                    'confidence': detection['confidence']
                }
            
            # Perform translation
            result = self.client.translate(
                request.text,
                target_language=request.target_language,
                source_language=request.source_language
            )
            
            return {
                'translatedText': result['translatedText'],
                'detectedLanguage': result['detectedSourceLanguage'],
                'confidence': 0.9  # Google Translate doesn't provide confidence scores
            }
            
        except Exception as e:
            logger.error(f"Translation API call failed: {e}")
            raise ValueError(f"Translation failed: {str(e)}")
    
    def detect_language(self, text: str) -> Dict[str, Any]:
        """Detect language of given text"""
        try:
            self.initialize()
            
            if not text or not text.strip():
                raise ValueError("Text content is required")
            
            result = self.client.detect_language(text)
            
            return {
                'language': result['language'],
                'confidence': result['confidence']
            }
            
        except Exception as e:
            logger.error(f"Language detection failed: {e}")
            raise ValueError(f"Language detection failed: {str(e)}")
    
    def get_supported_languages(self) -> Dict[str, Any]:
        """Get list of supported languages"""
        try:
            self.initialize()
            
            languages = self.client.get_languages()
            
            return {
                'languages': [
                    {
                        'code': lang['language'],
                        'name': lang.get('name', lang['language'])
                    }
                    for lang in languages
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get supported languages: {e}")
            raise ValueError(f"Failed to get supported languages: {str(e)}")
    
    def batch_translate(self, texts: list, target_language: str, source_language: Optional[str] = None) -> Dict[str, Any]:
        """Translate multiple texts in batch"""
        try:
            self.initialize()
            
            if not texts or len(texts) == 0:
                raise ValueError("Text list is required")
            
            if len(texts) > 100:  # Reasonable batch limit
                raise ValueError("Too many texts in batch (max 100)")
            
            results = []
            total_chars = 0
            
            for text in texts:
                if not text or not text.strip():
                    results.append({
                        'translatedText': '',
                        'detectedLanguage': 'unknown',
                        'confidence': 0.0
                    })
                    continue
                
                total_chars += len(text)
                
                result = self.client.translate(
                    text,
                    target_language=target_language,
                    source_language=source_language
                )
                
                results.append({
                    'translatedText': result['translatedText'],
                    'detectedLanguage': result['detectedSourceLanguage'],
                    'confidence': 0.9
                })
            
            return {
                'results': results,
                'totalCharacters': total_chars,
                'batchSize': len(texts)
            }
            
        except Exception as e:
            logger.error(f"Batch translation failed: {e}")
            raise ValueError(f"Batch translation failed: {str(e)}")