"""
Core credibility analysis logic.

This module implements a hybrid NLP credibility analysis pipeline that combines:
1. Transformer-based sentiment analysis (DistilBERT) for ML-powered scoring
2. Heuristic pattern matching for domain-specific red flag and indicator detection

The hybrid approach provides both the nuance of ML models and the interpretability
of rule-based analysis. Supports GPU acceleration when CUDA is available.
"""
import os
import re
import uuid
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


def detect_gpu() -> Dict[str, Any]:
    """
    Detect GPU availability and return device information.
    
    Returns:
        Dictionary containing:
        - available: bool indicating if GPU is available
        - device: 'cuda' or 'cpu'
        - device_name: Name of the GPU device (if available)
        - cuda_version: CUDA version (if available)
    """
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        
        if cuda_available:
            device_name = torch.cuda.get_device_name(0)
            cuda_version = torch.version.cuda
            return {
                "available": True,
                "device": "cuda",
                "device_name": device_name,
                "cuda_version": cuda_version
            }
        else:
            return {
                "available": False,
                "device": "cpu",
                "device_name": None,
                "cuda_version": None
            }
    except ImportError:
        # PyTorch not installed
        return {
            "available": False,
            "device": "cpu",
            "device_name": None,
            "cuda_version": None
        }
    except Exception:
        # Any other error - fall back to CPU
        return {
            "available": False,
            "device": "cpu",
            "device_name": None,
            "cuda_version": None
        }


def get_device() -> str:
    """
    Get the appropriate device for inference.
    
    Checks USE_GPU environment variable and CUDA availability.
    Falls back to CPU gracefully if GPU is not available.
    
    Returns:
        'cuda' if GPU is available and enabled, 'cpu' otherwise
    """
    use_gpu_env = os.environ.get("USE_GPU", "false").lower()
    
    # If USE_GPU is explicitly disabled, use CPU
    if use_gpu_env in ("false", "0", "no"):
        return "cpu"
    
    # Check if GPU is actually available
    gpu_info = detect_gpu()
    return gpu_info["device"]


# Cache the device selection at module load
_DEVICE = None
# Cache the sentiment analysis pipeline
_SENTIMENT_PIPELINE = None


def _get_cached_device() -> str:
    """Get cached device selection, initializing if needed."""
    global _DEVICE
    if _DEVICE is None:
        _DEVICE = get_device()
    return _DEVICE


def _get_sentiment_pipeline():
    """
    Lazy-load and cache the transformer sentiment analysis pipeline.

    Uses distilbert-base-uncased-finetuned-sst-2-english for fast,
    lightweight sentiment classification. Falls back gracefully if
    the model cannot be loaded (e.g., no internet on first run).
    """
    global _SENTIMENT_PIPELINE
    if _SENTIMENT_PIPELINE is not None:
        return _SENTIMENT_PIPELINE

    try:
        from transformers import pipeline
        device_str = _get_cached_device()
        device_arg = 0 if device_str == "cuda" else -1

        _SENTIMENT_PIPELINE = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            device=device_arg,
            truncation=True,
            max_length=512,
        )
        logger.info("Transformer sentiment pipeline loaded successfully on %s", device_str)
        return _SENTIMENT_PIPELINE
    except Exception as e:
        logger.warning("Could not load transformer model, using heuristics only: %s", e)
        return None


def _get_ml_sentiment_score(text: str) -> Optional[Dict[str, Any]]:
    """
    Run transformer-based sentiment analysis on the text.

    Returns a dict with:
        - label: "POSITIVE" or "NEGATIVE"
        - score: confidence (0-1)
        - credibility_adjustment: points to add/subtract from base score

    Returns None if the ML model is unavailable.
    """
    pipe = _get_sentiment_pipeline()
    if pipe is None:
        return None

    try:
        # Truncate very long text to avoid OOM; model handles 512 tokens
        truncated = text[:2048]
        result = pipe(truncated)[0]

        label = result["label"]       # "POSITIVE" or "NEGATIVE"
        confidence = result["score"]  # 0.0 – 1.0

        # Map sentiment to credibility adjustment:
        # POSITIVE sentiment with high confidence -> boost credibility
        # NEGATIVE/sensational sentiment -> reduce credibility
        if label == "POSITIVE":
            adjustment = int(confidence * 15)   # up to +15 points
        else:
            adjustment = -int(confidence * 15)  # up to -15 points

        return {
            "label": label,
            "score": round(confidence, 4),
            "credibility_adjustment": adjustment,
        }
    except Exception as e:
        logger.warning("ML sentiment analysis failed: %s", e)
        return None


# Credibility indicators - words/phrases that affect credibility score
POSITIVE_INDICATORS_PATTERNS = [
    {"pattern": r"\b(study|studies|research)\b", "description": "References scientific research", "icon": "science"},
    {"pattern": r"\b(according to|cited|source)\b", "description": "Cites sources", "icon": "verified"},
    {"pattern": r"\b(expert|professor|doctor|dr\.)\b", "description": "References expert opinions", "icon": "expert"},
    {"pattern": r"\b(peer[- ]reviewed|journal|published)\b", "description": "References peer-reviewed content", "icon": "academic"},
    {"pattern": r"\b(data|statistics|percent|%)\b", "description": "Uses data and statistics", "icon": "chart"},
    {"pattern": r"\b(university|institution|organization)\b", "description": "References institutions", "icon": "institution"},
]

RED_FLAG_PATTERNS = [
    {"pattern": r"\b(shocking|unbelievable|you won't believe)\b", "description": "Uses sensationalist language", "severity": "medium"},
    {"pattern": r"\b(they don't want you to know|secret|hidden truth)\b", "description": "Conspiracy-style language", "severity": "high"},
    {"pattern": r"\b(miracle|cure[- ]all|guaranteed)\b", "description": "Makes unrealistic claims", "severity": "high"},
    {"pattern": r"\b(click here|share now|act fast)\b", "description": "Uses urgency tactics", "severity": "low"},
    {"pattern": r"[A-Z]{5,}", "description": "Excessive use of capital letters", "severity": "low"},
    {"pattern": r"!{2,}", "description": "Excessive exclamation marks", "severity": "low"},
    {"pattern": r"\b(fake news|mainstream media lies)\b", "description": "Attacks credible sources", "severity": "medium"},
    {"pattern": r"\b(100% proven|absolutely certain)\b", "description": "Uses absolute claims", "severity": "medium"},
]

POSITIVE_KEYWORDS = [
    "research", "study", "evidence", "analysis", "data", "report",
    "expert", "scientist", "professor", "peer-reviewed", "journal",
    "verified", "confirmed", "documented", "official", "factual"
]

NEGATIVE_KEYWORDS = [
    "shocking", "unbelievable", "secret", "conspiracy", "hoax",
    "miracle", "guaranteed", "exclusive", "urgent", "breaking",
    "viral", "exposed", "banned", "censored", "suppressed"
]


def _generate_id() -> str:
    """Generate a unique ID for analysis components."""
    return str(uuid.uuid4())[:8]


def _find_red_flags(text: str) -> list:
    """
    Identify red flags in the text.
    
    Returns list of red flags with id, description, and severity.
    Severity must be one of: "low", "medium", "high"
    """
    red_flags = []
    text_lower = text.lower()
    
    for pattern_info in RED_FLAG_PATTERNS:
        if re.search(pattern_info["pattern"], text, re.IGNORECASE):
            red_flags.append({
                "id": f"rf-{_generate_id()}",
                "description": pattern_info["description"],
                "severity": pattern_info["severity"]
            })
    
    return red_flags


def _find_positive_indicators(text: str) -> list:
    """
    Identify positive credibility indicators in the text.
    
    Returns list of indicators with id, description, and icon.
    """
    indicators = []
    
    for pattern_info in POSITIVE_INDICATORS_PATTERNS:
        if re.search(pattern_info["pattern"], text, re.IGNORECASE):
            indicators.append({
                "id": f"pi-{_generate_id()}",
                "description": pattern_info["description"],
                "icon": pattern_info["icon"]
            })
    
    return indicators


def _extract_keywords(text: str) -> list:
    """
    Extract significant keywords from the text.
    
    Returns list of keywords with term, impact ("positive" or "negative"),
    and weight (0-1).
    """
    keywords = []
    text_lower = text.lower()
    words = re.findall(r'\b[a-z]+\b', text_lower)
    word_freq = {}
    
    for word in words:
        if len(word) > 3:
            word_freq[word] = word_freq.get(word, 0) + 1
    
    # Find positive keywords
    for keyword in POSITIVE_KEYWORDS:
        if keyword in word_freq:
            freq = word_freq[keyword]
            weight = min(1.0, 0.3 + (freq * 0.1))
            keywords.append({
                "term": keyword,
                "impact": "positive",
                "weight": round(weight, 2)
            })
    
    # Find negative keywords
    for keyword in NEGATIVE_KEYWORDS:
        if keyword in word_freq:
            freq = word_freq[keyword]
            weight = min(1.0, 0.3 + (freq * 0.1))
            keywords.append({
                "term": keyword,
                "impact": "negative",
                "weight": round(weight, 2)
            })
    
    return keywords[:10]  # Limit to top 10 keywords


def _calculate_score(
    red_flags: list,
    positive_indicators: list,
    keywords: list,
    ml_adjustment: int = 0,
) -> int:
    """
    Calculate credibility score based on analysis components.

    Combines heuristic signals with ML model adjustment for a hybrid score.
    Returns a score between 0 and 100 inclusive.
    """
    # Start with a neutral score
    base_score = 50

    # Adjust for red flags (negative impact)
    severity_weights = {"low": 5, "medium": 10, "high": 15}
    for flag in red_flags:
        base_score -= severity_weights.get(flag["severity"], 5)

    # Adjust for positive indicators (positive impact)
    base_score += len(positive_indicators) * 8

    # Adjust for keywords
    for keyword in keywords:
        if keyword["impact"] == "positive":
            base_score += keyword["weight"] * 5
        else:
            base_score -= keyword["weight"] * 5

    # Apply ML model adjustment (transformer sentiment signal)
    base_score += ml_adjustment

    # Ensure score is within 0-100 range
    return max(0, min(100, int(base_score)))


def _generate_overview(score: int, red_flags: list, positive_indicators: list) -> str:
    """Generate a human-readable overview of the analysis."""
    if score >= 80:
        credibility = "high"
        assessment = "This content appears to be highly credible."
    elif score >= 60:
        credibility = "moderate"
        assessment = "This content shows moderate credibility."
    elif score >= 40:
        credibility = "mixed"
        assessment = "This content has mixed credibility signals."
    elif score >= 20:
        credibility = "low"
        assessment = "This content shows low credibility."
    else:
        credibility = "very low"
        assessment = "This content appears to have very low credibility."
    
    details = []
    if positive_indicators:
        details.append(f"Found {len(positive_indicators)} positive indicator(s)")
    if red_flags:
        details.append(f"identified {len(red_flags)} red flag(s)")
    
    if details:
        detail_str = " and ".join(details)
        return f"{assessment} {detail_str.capitalize()}."
    
    return assessment


def get_gpu_status() -> Dict[str, Any]:
    """
    Get current GPU status for health checks and monitoring.
    
    Returns:
        Dictionary containing GPU availability and device information.
    """
    gpu_info = detect_gpu()
    device = _get_cached_device()
    
    return {
        "gpu_available": gpu_info["available"],
        "using_device": device,
        "device_name": gpu_info["device_name"],
        "cuda_version": gpu_info["cuda_version"],
        "use_gpu_env": os.environ.get("USE_GPU", "false")
    }


def analyze_content(text: str, source_url: Optional[str] = None) -> dict:
    """
    Perform credibility analysis on the provided text.

    Uses a hybrid pipeline:
    1. Transformer-based sentiment analysis (DistilBERT) for ML scoring
    2. Heuristic pattern matching for red flags and positive indicators
    3. Keyword extraction and impact classification

    Uses GPU for inference when available and enabled, falls back to CPU.

    Args:
        text: The content to analyze
        source_url: Optional URL source for context

    Returns:
        Dictionary containing:
        - score: Credibility score (0-100)
        - overview: Human-readable summary
        - red_flags: List of identified red flags
        - positive_indicators: List of positive credibility signals
        - keywords: List of significant keywords with impact classification
        - ml_signals: ML model outputs (sentiment label, confidence)
    """
    # Heuristic analysis
    red_flags = _find_red_flags(text)
    positive_indicators = _find_positive_indicators(text)
    keywords = _extract_keywords(text)

    # ML model analysis (transformer sentiment)
    ml_result = _get_ml_sentiment_score(text)
    ml_adjustment = ml_result["credibility_adjustment"] if ml_result else 0

    # Calculate hybrid score
    score = _calculate_score(red_flags, positive_indicators, keywords, ml_adjustment)

    # Generate overview
    overview = _generate_overview(score, red_flags, positive_indicators)

    result = {
        "score": score,
        "overview": overview,
        "red_flags": red_flags,
        "positive_indicators": positive_indicators,
        "keywords": keywords,
    }

    # Include ML signals when available
    if ml_result:
        result["ml_signals"] = {
            "sentiment": ml_result["label"],
            "confidence": ml_result["score"],
            "model": "distilbert-base-uncased-finetuned-sst-2-english",
        }

    return result
