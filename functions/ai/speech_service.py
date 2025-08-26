"""
Google Speech-to-Text API integration service
"""
import time
from typing import Dict, Any, Optional
from google.cloud import speech
from google.cloud import storage
from config import get_secure_config
from middleware import check_cost_limits, log_audit_event, AuditLog, estimate_cost, get_current_timestamp
import logging

logger = logging.getLogger(__name__)

class SpeechToTextRequest:
    def __init__(self, data: Dict[str, Any]):
        self.audio_url = data['audioUrl']
        self.language = data.get('language', 'en-US')
        self.user_token = data.get('userToken', '')

class SpeechToTextResponse:
    def __init__(self, transcript: str, confidence: float, language_detected: str, 
                 duration: float, processing_time: int):
        self.transcript = transcript
        self.confidence = confidence
        self.language_detected = language_detected
        self.duration = duration
        self.processing_time = processing_time
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'transcript': self.transcript,
            'confidence': self.confidence,
            'languageDetected': self.language_detected,
            'duration': self.duration,
            'processingTime': self.processing_time
        }

class SpeechToTextService:
    def __init__(self):
        self.client = None
        self.storage_client = None
        self.initialized = False
    
    def initialize(self):
        """Initialize the Speech-to-Text service"""
        if self.initialized:
            return
        
        try:
            self.client = speech.SpeechClient()
            self.storage_client = storage.Client()
            self.initialized = True
            logger.info("Speech-to-Text service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Speech-to-Text service: {e}")
            raise ValueError("Speech-to-Text service initialization failed")
    
    def transcribe_audio(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transcribe audio using Google Speech-to-Text API"""
        start_time = int(time.time() * 1000)  # milliseconds
        
        try:
            self.initialize()
            request = SpeechToTextRequest(request_data)
            
            # Validate audio URL
            if not request.audio_url or not request.audio_url.startswith('gs://'):
                raise ValueError("Valid Google Cloud Storage audio URL is required")
            
            # Download audio to estimate duration and cost
            audio_data = self._download_audio_file(request.audio_url)
            estimated_duration = self._estimate_audio_duration(audio_data)
            
            # Check cost limits
            estimated_cost = estimate_cost('SPEECH', duration=estimated_duration)
            if not check_cost_limits(request.user_token, 'SPEECH', estimated_cost):
                raise ValueError('Daily cost limit exceeded for Speech-to-Text API')
            
            # Perform transcription
            result = self._perform_transcription(request, audio_data)
            
            processing_time = int(time.time() * 1000) - start_time
            
            # Create response
            response = SpeechToTextResponse(
                transcript=result['transcript'],
                confidence=result['confidence'],
                language_detected=result['languageDetected'],
                duration=result['duration'],
                processing_time=processing_time
            )
            
            # Log successful transcription
            log_audit_event(AuditLog(
                user_id=request.user_token,
                action='speech_to_text',
                endpoint='/speech-to-text',
                timestamp=get_current_timestamp(),
                request_id=f"speech_{int(time.time())}",
                success=True,
                metadata={
                    'audioUrl': request.audio_url,
                    'language': request.language,
                    'duration': response.duration,
                    'confidence': response.confidence,
                    'processingTime': processing_time,
                    'costEstimate': estimated_cost
                }
            ))
            
            return response.to_dict()
            
        except Exception as e:
            processing_time = int(time.time() * 1000) - start_time
            
            # Log failed transcription
            log_audit_event(AuditLog(
                user_id=request_data.get('userToken', 'unknown'),
                action='speech_to_text',
                endpoint='/speech-to-text',
                timestamp=get_current_timestamp(),
                request_id=f"speech_{int(time.time())}",
                success=False,
                error=str(e),
                metadata={
                    'audioUrl': request_data.get('audioUrl', ''),
                    'processingTime': processing_time
                }
            ))
            
            raise
    
    def _perform_transcription(self, request: SpeechToTextRequest, audio_data: bytes) -> Dict[str, Any]:
        """Perform the actual transcription"""
        try:
            # Configure recognition
            audio = speech.RecognitionAudio(content=audio_data)
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=16000,
                language_code=request.language,
                enable_automatic_punctuation=True,
                enable_word_confidence=True,
                enable_word_time_offsets=True,
                model='latest_long'  # Use latest model for better accuracy
            )
            
            # For longer audio files, use long_running_recognize
            if len(audio_data) > 1024 * 1024:  # 1MB threshold
                operation = self.client.long_running_recognize(
                    config=config, 
                    audio=audio
                )
                response = operation.result(timeout=300)  # 5 minute timeout
            else:
                response = self.client.recognize(config=config, audio=audio)
            
            # Process results
            if not response.results:
                return {
                    'transcript': '',
                    'confidence': 0.0,
                    'languageDetected': request.language,
                    'duration': 0.0
                }
            
            # Combine all alternatives and calculate average confidence
            transcript_parts = []
            confidences = []
            total_duration = 0.0
            
            for result in response.results:
                if result.alternatives:
                    alternative = result.alternatives[0]  # Best alternative
                    transcript_parts.append(alternative.transcript)
                    confidences.append(alternative.confidence)
                    
                    # Calculate duration from word time offsets
                    if alternative.words:
                        last_word = alternative.words[-1]
                        if hasattr(last_word, 'end_time'):
                            total_duration = max(total_duration, last_word.end_time.total_seconds())
            
            transcript = ' '.join(transcript_parts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            return {
                'transcript': transcript,
                'confidence': avg_confidence,
                'languageDetected': request.language,
                'duration': total_duration
            }
            
        except Exception as e:
            logger.error(f"Speech-to-Text API call failed: {e}")
            raise ValueError(f"Transcription failed: {str(e)}")
    
    def _download_audio_file(self, audio_url: str) -> bytes:
        """Download audio file from Google Cloud Storage"""
        try:
            # Parse Google Cloud Storage URL
            url_parts = audio_url.replace('gs://', '').split('/', 1)
            if len(url_parts) != 2:
                raise ValueError("Invalid storage URL format")
            
            bucket_name, file_name = url_parts
            
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(file_name)
            
            # Check file size (limit to 10MB for direct processing)
            blob.reload()
            if blob.size > 10 * 1024 * 1024:  # 10MB
                raise ValueError("Audio file too large (max 10MB for direct processing)")
            
            return blob.download_as_bytes()
            
        except Exception as e:
            logger.error(f"Failed to download audio file: {e}")
            raise ValueError("Unable to access audio file")
    
    def _estimate_audio_duration(self, audio_data: bytes) -> float:
        """Estimate audio duration (simplified implementation)"""
        # This is a very basic estimation
        # In a real implementation, you'd use audio processing libraries
        # to get accurate duration
        
        # Rough estimation: assume 16kHz, 16-bit, mono
        # 2 bytes per sample, 16000 samples per second
        bytes_per_second = 16000 * 2
        estimated_duration = len(audio_data) / bytes_per_second
        
        return max(1.0, estimated_duration)  # Minimum 1 second
    
    def transcribe_streaming(self, audio_stream) -> Dict[str, Any]:
        """Transcribe streaming audio (for real-time applications)"""
        try:
            self.initialize()
            
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=16000,
                language_code='en-US',
                enable_automatic_punctuation=True
            )
            
            streaming_config = speech.StreamingRecognitionConfig(
                config=config,
                interim_results=True
            )
            
            # This would be used with a streaming audio source
            # Implementation depends on the specific streaming setup
            
            return {
                'message': 'Streaming transcription not fully implemented',
                'status': 'placeholder'
            }
            
        except Exception as e:
            logger.error(f"Streaming transcription failed: {e}")
            raise ValueError(f"Streaming transcription failed: {str(e)}")
    
    def get_supported_languages(self) -> Dict[str, Any]:
        """Get list of supported languages for speech recognition"""
        # Common languages supported by Google Speech-to-Text
        supported_languages = [
            {'code': 'en-US', 'name': 'English (United States)'},
            {'code': 'en-GB', 'name': 'English (United Kingdom)'},
            {'code': 'es-ES', 'name': 'Spanish (Spain)'},
            {'code': 'es-US', 'name': 'Spanish (United States)'},
            {'code': 'fr-FR', 'name': 'French (France)'},
            {'code': 'de-DE', 'name': 'German (Germany)'},
            {'code': 'it-IT', 'name': 'Italian (Italy)'},
            {'code': 'pt-BR', 'name': 'Portuguese (Brazil)'},
            {'code': 'ru-RU', 'name': 'Russian (Russia)'},
            {'code': 'ja-JP', 'name': 'Japanese (Japan)'},
            {'code': 'ko-KR', 'name': 'Korean (South Korea)'},
            {'code': 'zh-CN', 'name': 'Chinese (Simplified)'},
            {'code': 'zh-TW', 'name': 'Chinese (Traditional)'},
            {'code': 'ar-SA', 'name': 'Arabic (Saudi Arabia)'},
            {'code': 'hi-IN', 'name': 'Hindi (India)'}
        ]
        
        return {
            'languages': supported_languages,
            'total': len(supported_languages)
        }