"""
Sentry error tracking configuration for ML Service.

Provides centralized error tracking and reporting for the Flask application.

Requirements: 7.1
"""
import os
from typing import Optional

import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration


def init_sentry(
    dsn: Optional[str] = None,
    environment: Optional[str] = None,
    release: Optional[str] = None,
    traces_sample_rate: float = 0.1,
) -> bool:
    """
    Initialize Sentry error tracking for the ML service.

    Args:
        dsn: Sentry DSN (Data Source Name). If not provided, reads from SENTRY_DSN env var.
        environment: Deployment environment (e.g., "production", "staging").
                    If not provided, reads from SENTRY_ENVIRONMENT env var.
        release: Application release version. If not provided, reads from SENTRY_RELEASE env var.
        traces_sample_rate: Sample rate for performance monitoring (0.0 to 1.0).

    Returns:
        True if Sentry was initialized successfully, False otherwise.
    """
    # Get configuration from environment if not provided
    sentry_dsn = dsn or os.environ.get("SENTRY_DSN")
    sentry_environment = environment or os.environ.get("SENTRY_ENVIRONMENT", "development")
    sentry_release = release or os.environ.get("SENTRY_RELEASE")

    # Skip initialization if no DSN is configured
    if not sentry_dsn:
        return False

    try:
        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=sentry_environment,
            release=sentry_release,
            traces_sample_rate=traces_sample_rate,
            integrations=[
                FlaskIntegration(
                    transaction_style="url",
                ),
            ],
            # Filter out health check endpoints from performance monitoring
            traces_sampler=_traces_sampler,
            # Capture request data for debugging
            send_default_pii=False,
            # Set max breadcrumbs
            max_breadcrumbs=50,
            # Attach stack traces to messages
            attach_stacktrace=True,
            # Before send hook for filtering
            before_send=_before_send,
        )
        return True
    except Exception:
        return False


def _traces_sampler(sampling_context: dict) -> float:
    """
    Custom traces sampler to filter out health check endpoints.

    Args:
        sampling_context: Context containing transaction information.

    Returns:
        Sample rate (0.0 to 1.0) for the transaction.
    """
    # Get the transaction name (URL path)
    transaction_context = sampling_context.get("transaction_context", {})
    name = transaction_context.get("name", "")

    # Don't trace health check or metrics endpoints
    if name in ("/health", "/metrics", "/gpu-status"):
        return 0.0

    # Use default sample rate for other endpoints
    return 0.1


def _before_send(event: dict, hint: dict) -> Optional[dict]:
    """
    Filter events before sending to Sentry.

    Args:
        event: The event to be sent.
        hint: Additional context about the event.

    Returns:
        The event to send, or None to drop it.
    """
    # Filter out certain exception types if needed
    if "exc_info" in hint:
        exc_type, exc_value, _ = hint["exc_info"]
        
        # Don't report client disconnection errors
        if exc_type.__name__ in ("ConnectionResetError", "BrokenPipeError"):
            return None

    return event


def capture_exception(error: Exception, context: Optional[dict] = None) -> None:
    """
    Capture an exception and send it to Sentry.

    Args:
        error: The exception to capture.
        context: Optional additional context to attach to the event.
    """
    with sentry_sdk.push_scope() as scope:
        if context:
            for key, value in context.items():
                scope.set_extra(key, value)
        sentry_sdk.capture_exception(error)


def capture_message(message: str, level: str = "info", context: Optional[dict] = None) -> None:
    """
    Capture a message and send it to Sentry.

    Args:
        message: The message to capture.
        level: Log level ("debug", "info", "warning", "error", "fatal").
        context: Optional additional context to attach to the event.
    """
    with sentry_sdk.push_scope() as scope:
        if context:
            for key, value in context.items():
                scope.set_extra(key, value)
        sentry_sdk.capture_message(message, level=level)


def set_user(user_id: Optional[str] = None, ip_address: Optional[str] = None) -> None:
    """
    Set user context for Sentry events.

    Args:
        user_id: Optional user identifier (anonymized).
        ip_address: Optional IP address (will be anonymized by Sentry).
    """
    sentry_sdk.set_user({
        "id": user_id,
        "ip_address": ip_address,
    })


def add_breadcrumb(
    message: str,
    category: str = "custom",
    level: str = "info",
    data: Optional[dict] = None,
) -> None:
    """
    Add a breadcrumb for debugging context.

    Args:
        message: Description of the breadcrumb.
        category: Category for grouping breadcrumbs.
        level: Log level for the breadcrumb.
        data: Optional additional data to attach.
    """
    sentry_sdk.add_breadcrumb(
        message=message,
        category=category,
        level=level,
        data=data or {},
    )
