"""
Main entry point for AI services Cloud Functions
"""
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from gemini_service import GeminiVerificationService
from translate_service import TranslateService
from speech_service import SpeechToTextService
from results_processor import AIResultsProcessor
from middleware import authenticate_token, rate_limiter, error_handler
from config import get_secure_config
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configure CORS
allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
CORS(app, origins=allowed_origins, supports_credentials=True)

# Initialize services
gemini_service = GeminiVerificationService()
translate_service = TranslateService()
speech_service = SpeechToTextService()
results_processor = AIResultsProcessor()

@app.route('/gemini/verify', methods=['POST'])
@authenticate_token
@rate_limiter('GEMINI')
def gemini_verification():
    """Gemini 2.5 Flash verification endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['submissionId', 'dataType', 'storageUrl', 'language', 'taskCriteria']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                'error': 'Missing required fields',
                'required': required_fields,
                'missing': missing_fields
            }), 400
        
        # Validate data type
        if data['dataType'] not in ['text', 'audio', 'image']:
            return jsonify({
                'error': 'Invalid data type',
                'allowed': ['text', 'audio', 'image']
            }), 400
        
        # Validate storage URL format
        if not data['storageUrl'].startswith('gs://'):
            return jsonify({
                'error': 'Invalid storage URL format',
                'expected': 'gs://bucket-name/file-path'
            }), 400
        
        # Add user info from middleware
        data['userToken'] = request.user_id
        
        # Perform verification
        result = gemini_service.verify_submission(data)
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except ValueError as e:
        if 'cost limit' in str(e).lower():
            return jsonify({
                'error': 'Cost limit exceeded',
                'message': str(e)
            }), 429
        elif 'unable to access' in str(e).lower():
            return jsonify({
                'error': 'File not found',
                'message': str(e)
            }), 404
        else:
            return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Gemini verification error: {e}")
        return error_handler(e)

@app.route('/gemini/health', methods=['GET'])
def gemini_health():
    """Health check for Gemini service"""
    try:
        gemini_service.initialize()
        return jsonify({
            'status': 'healthy',
            'service': 'gemini-verification',
            'timestamp': gemini_service.get_current_timestamp()
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'gemini-verification',
            'error': str(e),
            'timestamp': gemini_service.get_current_timestamp()
        }), 503

@app.route('/translate', methods=['POST'])
@authenticate_token
@rate_limiter('TRANSLATE')
def translate_text():
    """Google Translate API endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'text' not in data:
            return jsonify({
                'error': 'Missing required field: text'
            }), 400
        
        # Add user info from middleware
        data['userToken'] = request.user_id
        
        result = translate_service.translate_text(data)
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return error_handler(e)

@app.route('/speech-to-text', methods=['POST'])
@authenticate_token
@rate_limiter('SPEECH')
def speech_to_text():
    """Google Speech-to-Text API endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'audioUrl' not in data:
            return jsonify({
                'error': 'Missing required field: audioUrl'
            }), 400
        
        # Add user info from middleware
        data['userToken'] = request.user_id
        
        result = speech_service.transcribe_audio(data)
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except Exception as e:
        logger.error(f"Speech-to-text error: {e}")
        return error_handler(e)

@app.route('/ai-results', methods=['POST'])
@authenticate_token
@rate_limiter('GEMINI')  # Use GEMINI rate limits for results processing
def process_ai_results():
    """AI results processing endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['submissionId', 'verificationResults']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                'error': 'Missing required fields',
                'required': required_fields,
                'missing': missing_fields
            }), 400
        
        # Add user info from middleware
        data['userToken'] = request.user_id
        
        result = results_processor.process_results(data)
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except Exception as e:
        logger.error(f"Results processing error: {e}")
        return error_handler(e)

@app.route('/health', methods=['GET'])
def health_check():
    """Overall health check"""
    try:
        # Check all services
        services_status = {
            'gemini': 'unknown',
            'translate': 'unknown',
            'speech': 'unknown',
            'results': 'unknown'
        }
        
        try:
            gemini_service.initialize()
            services_status['gemini'] = 'healthy'
        except:
            services_status['gemini'] = 'unhealthy'
        
        try:
            translate_service.initialize()
            services_status['translate'] = 'healthy'
        except:
            services_status['translate'] = 'unhealthy'
        
        try:
            speech_service.initialize()
            services_status['speech'] = 'healthy'
        except:
            services_status['speech'] = 'unhealthy'
        
        services_status['results'] = 'healthy'  # Results processor doesn't need initialization
        
        overall_healthy = all(status == 'healthy' for status in services_status.values())
        
        return jsonify({
            'status': 'healthy' if overall_healthy else 'degraded',
            'services': services_status,
            'timestamp': gemini_service.get_current_timestamp()
        }), 200 if overall_healthy else 503
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': gemini_service.get_current_timestamp()
        }), 503

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': 'Method not allowed'}), 405

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))