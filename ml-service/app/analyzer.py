"""
Core credibility analysis logic.

This module provides a simplified credibility analysis for MVP.
It uses heuristic-based analysis that can be enhanced with actual ML models later.
Supports GPU acceleration when CUDA is available.
"""
import os
import re
import uuid
from typing import Optional, Dict, Any


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


def _get_cached_device() -> str:
    """Get cached device selection, initializing if needed."""
    global _DEVICE
    if _DEVICE is None:
        _DEVICE = get_device()
    return _DEVICE


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


def _calculate_score(red_flags: list, positive_indicators: list, keywords: list) -> int:
    """
    Calculate credibility score based on analysis components.
    
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
    
    Uses GPU for inference when available and enabled, falls back to CPU gracefully.
    
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
    """
    # Get the device for inference (GPU or CPU)
    device = _get_cached_device()
    
    # Perform analysis (current implementation is heuristic-based,
    # but device is available for future ML model inference)
    red_flags = _find_red_flags(text)
    positive_indicators = _find_positive_indicators(text)
    keywords = _extract_keywords(text)
    
    # Calculate score
    score = _calculate_score(red_flags, positive_indicators, keywords)
    
    # Generate overview
    overview = _generate_overview(score, red_flags, positive_indicators)
    
    return {
        "score": score,
        "overview": overview,
        "red_flags": red_flags,
        "positive_indicators": positive_indicators,
        "keywords": keywords
    }
