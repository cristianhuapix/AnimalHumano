"""
Animal Humano - Flask Backend (BFF)
Main application entry point
"""

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Import blueprints
from routes.auth import auth_bp
from routes.pets import pets_bp
from routes.providers import providers_bp
from routes.appointments import appointments_bp
from routes.breeding import breeding_bp
from routes.walks import walks_bp
from routes.lost_pets import lost_pets_bp
from routes.conversations import conversations_bp
from routes.notifications import notifications_bp
from routes.qr import qr_bp
from routes.admin import admin_bp
from routes.data import data_bp
from routes.vaccines import vaccines_bp
from routes.services import services_bp
from routes.medical_records import medical_records_bp
from routes.species_breed_requests import species_breed_requests_bp

# Import middleware
from middleware.auth import auth_middleware
from middleware.rate_limit import rate_limit_middleware

def create_app():
    """Create and configure Flask app"""
    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
    app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'True') == 'True'

    # Disable strict slashes to handle routes with or without trailing slash
    app.url_map.strict_slashes = False

    # CORS configuration
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:4200').split(',')
    CORS(app, origins=cors_origins, supports_credentials=True)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(pets_bp, url_prefix='/api/pets')
    app.register_blueprint(providers_bp, url_prefix='/api/providers')
    app.register_blueprint(appointments_bp, url_prefix='/api/appointments')
    app.register_blueprint(breeding_bp, url_prefix='/api/breeding')
    app.register_blueprint(walks_bp, url_prefix='/api/walks')
    app.register_blueprint(lost_pets_bp, url_prefix='/api/lost-pets')
    app.register_blueprint(conversations_bp, url_prefix='/api/conversations')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
    app.register_blueprint(qr_bp, url_prefix='/api/qr')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(data_bp, url_prefix='/api/data')
    app.register_blueprint(vaccines_bp, url_prefix='/api')
    app.register_blueprint(services_bp, url_prefix='/api/services')
    app.register_blueprint(medical_records_bp, url_prefix='/api')
    app.register_blueprint(species_breed_requests_bp, url_prefix='/api/species-breed-requests')

    # Register middleware
    app.before_request(auth_middleware)
    app.before_request(rate_limit_middleware)

    # Health check endpoint
    @app.route('/health')
    def health():
        return {'status': 'ok', 'service': 'animal-humano-api'}

    # Root endpoint
    @app.route('/')
    def root():
        return {
            'name': 'Animal Humano API',
            'version': '1.0.0',
            'endpoints': {
                'auth': '/api/auth',
                'pets': '/api/pets',
                'providers': '/api/providers',
                'appointments': '/api/appointments',
                'breeding': '/api/breeding',
                'walks': '/api/walks',
                'lost_pets': '/api/lost-pets',
                'conversations': '/api/conversations',
                'notifications': '/api/notifications',
                'qr': '/api/qr',
                'admin': '/api/admin',
                'data': '/api/data',
                'vaccines': '/api'
            }
        }

    # Error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return {'error': 'Bad Request', 'message': str(e)}, 400

    @app.errorhandler(401)
    def unauthorized(e):
        return {'error': 'Unauthorized', 'message': 'Authentication required'}, 401

    @app.errorhandler(403)
    def forbidden(e):
        return {'error': 'Forbidden', 'message': str(e)}, 403

    @app.errorhandler(404)
    def not_found(e):
        return {'error': 'Not Found', 'message': str(e)}, 404

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return {'error': 'Too Many Requests', 'message': 'Rate limit exceeded'}, 429

    @app.errorhandler(500)
    def internal_error(e):
        return {'error': 'Internal Server Error', 'message': 'An error occurred'}, 500

    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=app.config['DEBUG'])
