"""
Flask application entry point for the ML Service.
"""
import os
from flask import Flask
from flask_cors import CORS

from .routes import register_routes
from .monitoring import init_sentry


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Initialize Sentry error tracking (before other middleware)
    init_sentry()
    
    # Configure CORS
    CORS(app, origins=os.getenv("CORS_ORIGINS", "*").split(","))
    
    # Register routes
    register_routes(app)
    
    return app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
