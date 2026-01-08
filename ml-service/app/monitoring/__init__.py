"""
Monitoring module for ML Service.

Provides Prometheus metrics collection and Sentry error tracking.
"""
from .metrics import (
    metrics_registry,
    predictions_total,
    prediction_confidence,
    inference_duration_seconds,
    record_prediction,
    get_metrics,
    get_content_type,
)
from .sentry_config import (
    init_sentry,
    capture_exception,
    capture_message,
    set_user,
    add_breadcrumb,
)

__all__ = [
    # Metrics
    "metrics_registry",
    "predictions_total",
    "prediction_confidence",
    "inference_duration_seconds",
    "record_prediction",
    "get_metrics",
    "get_content_type",
    # Sentry
    "init_sentry",
    "capture_exception",
    "capture_message",
    "set_user",
    "add_breadcrumb",
]
