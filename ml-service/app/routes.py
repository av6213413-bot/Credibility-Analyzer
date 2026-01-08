"""
API routes for the ML Service.

Includes health check, analysis, and Prometheus metrics endpoints.
"""
import time
from flask import Flask, request, jsonify, Response

from .analyzer import analyze_content, get_gpu_status
from .monitoring import (
    record_prediction,
    get_metrics,
    get_content_type,
)


def register_routes(app: Flask):
    """Register all routes with the Flask application."""
    
    @app.route("/health", methods=["GET"])
    def health():
        """Health check endpoint with GPU status."""
        gpu_status = get_gpu_status()
        return jsonify({
            "status": "healthy",
            "service": "ml-service",
            "gpu": gpu_status
        })
    
    @app.route("/gpu-status", methods=["GET"])
    def gpu_status():
        """Get detailed GPU status information."""
        return jsonify(get_gpu_status())
    
    @app.route("/metrics", methods=["GET"])
    def metrics():
        """
        Prometheus metrics endpoint.
        
        Returns metrics in Prometheus exposition format.
        Requirements: 10.2
        """
        metrics_data = get_metrics()
        return Response(
            metrics_data,
            mimetype=get_content_type(),
        )
    
    @app.route("/analyze", methods=["POST"])
    def analyze():
        """
        Analyze content for credibility.
        
        Request body:
        {
            "text": "string",
            "source_url": "string | null"  # Optional
        }
        
        Response:
        {
            "score": number (0-100),
            "overview": "string",
            "red_flags": [...],
            "positive_indicators": [...],
            "keywords": [...]
        }
        """
        data = request.get_json()
        
        if not data:
            return jsonify({
                "error": "INVALID_REQUEST",
                "message": "Request body is required"
            }), 400
        
        text = data.get("text")
        if not text or not text.strip():
            return jsonify({
                "error": "EMPTY_INPUT",
                "message": "Text content is required"
            }), 400
        
        source_url = data.get("source_url")
        input_type = "url" if source_url else "text"
        
        start_time = time.perf_counter()
        
        try:
            result = analyze_content(text, source_url)
            duration = time.perf_counter() - start_time
            
            # Record successful prediction metrics
            record_prediction(
                score=result["score"],
                duration_seconds=duration,
                status="success",
                input_type=input_type,
            )
            
            return jsonify(result)
        except Exception as e:
            duration = time.perf_counter() - start_time
            
            # Record failed prediction metrics
            record_prediction(
                score=0,
                duration_seconds=duration,
                status="failure",
                input_type=input_type,
            )
            
            return jsonify({
                "error": "ANALYSIS_FAILED",
                "message": str(e)
            }), 500
