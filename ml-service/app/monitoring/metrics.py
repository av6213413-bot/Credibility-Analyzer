"""
Prometheus metrics for ML Service.

Defines prediction metrics (predictions_total, prediction_confidence)
and model metrics (inference_duration_seconds) for monitoring ML service performance.

Requirements: 2.1, 10.2
"""
import time
from contextlib import contextmanager
from typing import Generator

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST,
    REGISTRY,
)


# Create a custom registry for ML service metrics
metrics_registry = CollectorRegistry()

# Prediction metrics
predictions_total = Counter(
    name="predictions_total",
    documentation="Total number of predictions made by the ML service",
    labelnames=["status", "input_type"],
    registry=metrics_registry,
)

prediction_confidence = Histogram(
    name="prediction_confidence",
    documentation="Distribution of prediction confidence scores (0-100)",
    buckets=[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    registry=metrics_registry,
)

# Model metrics
inference_duration_seconds = Histogram(
    name="inference_duration_seconds",
    documentation="Time taken for model inference in seconds",
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    registry=metrics_registry,
)


def record_prediction(
    score: int,
    duration_seconds: float,
    status: str = "success",
    input_type: str = "text",
) -> None:
    """
    Record metrics for a prediction.

    Args:
        score: The credibility score (0-100)
        duration_seconds: Time taken for inference in seconds
        status: Status of the prediction ("success" or "failure")
        input_type: Type of input ("text" or "url")
    """
    predictions_total.labels(status=status, input_type=input_type).inc()
    
    if status == "success":
        prediction_confidence.observe(score)
    
    inference_duration_seconds.observe(duration_seconds)


@contextmanager
def measure_inference_time() -> Generator[None, None, None]:
    """
    Context manager to measure inference time.

    Usage:
        with measure_inference_time() as timer:
            result = model.predict(input)
        duration = timer.duration
    """
    start_time = time.perf_counter()
    timer = InferenceTimer()
    try:
        yield timer
    finally:
        timer.duration = time.perf_counter() - start_time


class InferenceTimer:
    """Helper class to store inference duration."""
    
    def __init__(self) -> None:
        self.duration: float = 0.0


def get_metrics() -> bytes:
    """
    Get all metrics in Prometheus exposition format.

    Returns:
        Bytes containing metrics in Prometheus format
    """
    return generate_latest(metrics_registry)


def get_content_type() -> str:
    """
    Get the content type for Prometheus metrics response.

    Returns:
        Content type string for Prometheus exposition format
    """
    return CONTENT_TYPE_LATEST
