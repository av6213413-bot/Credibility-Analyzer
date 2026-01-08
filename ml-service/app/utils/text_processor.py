"""
Text processing utilities for the ML service.
"""
import re
from typing import List


def preprocess_text(text: str) -> str:
    """
    Preprocess text for analysis.
    
    - Removes excessive whitespace
    - Normalizes line breaks
    - Strips leading/trailing whitespace
    """
    # Normalize line breaks
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Replace multiple spaces with single space
    text = re.sub(r' +', ' ', text)
    
    # Replace multiple newlines with double newline
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()


def extract_sentences(text: str) -> List[str]:
    """
    Extract sentences from text.
    
    Returns a list of sentences.
    """
    # Simple sentence splitting on common terminators
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]
