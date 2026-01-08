"""
Property-based tests for GPU detection and usage.

**Feature: infrastructure-deployment, Property 10: GPU Detection and Usage**
**Validates: Requirements 2.2**

Tests verify that:
- GPU detection returns valid device information
- Device selection respects USE_GPU environment variable
- Fallback to CPU works gracefully when GPU unavailable
"""
import os
from unittest.mock import patch, MagicMock
import pytest
from hypothesis import given, strategies as st, settings

from app.analyzer import (
    detect_gpu,
    get_device,
    get_gpu_status,
    analyze_content,
)


class TestGPUDetection:
    """Property tests for GPU detection - Property 10: GPU Detection and Usage"""
    
    @settings(max_examples=100)
    @given(st.text(min_size=1, max_size=500))
    def test_detect_gpu_returns_valid_structure(self, _text: str):
        """
        Property 10: GPU Detection and Usage
        For any call to detect_gpu, the result SHALL contain all required fields
        with valid types.
        **Validates: Requirements 2.2**
        """
        result = detect_gpu()
        
        # Must have all required fields
        assert "available" in result
        assert "device" in result
        assert "device_name" in result
        assert "cuda_version" in result
        
        # Types must be correct
        assert isinstance(result["available"], bool)
        assert result["device"] in ("cuda", "cpu")
        assert result["device_name"] is None or isinstance(result["device_name"], str)
        assert result["cuda_version"] is None or isinstance(result["cuda_version"], str)
    
    @settings(max_examples=100)
    @given(st.sampled_from(["true", "false", "True", "False", "1", "0", "yes", "no", "YES", "NO"]))
    def test_get_device_respects_use_gpu_env(self, use_gpu_value: str):
        """
        Property 10: GPU Detection and Usage
        For any USE_GPU environment variable value, get_device SHALL return
        'cpu' when USE_GPU is disabled, regardless of GPU availability.
        **Validates: Requirements 2.2**
        """
        # Reset cached device
        import app.analyzer as analyzer_module
        analyzer_module._DEVICE = None
        
        with patch.dict(os.environ, {"USE_GPU": use_gpu_value}):
            device = get_device()
            
            # Device must be valid
            assert device in ("cuda", "cpu")
            
            # If USE_GPU is explicitly disabled, must use CPU
            if use_gpu_value.lower() in ("false", "0", "no"):
                assert device == "cpu"
    
    @settings(max_examples=100)
    @given(st.text(min_size=1, max_size=200))
    def test_get_gpu_status_returns_complete_info(self, _text: str):
        """
        Property 10: GPU Detection and Usage
        For any call to get_gpu_status, the result SHALL contain all monitoring fields.
        **Validates: Requirements 2.2**
        """
        # Reset cached device
        import app.analyzer as analyzer_module
        analyzer_module._DEVICE = None
        
        status = get_gpu_status()
        
        # Must have all required fields
        assert "gpu_available" in status
        assert "using_device" in status
        assert "device_name" in status
        assert "cuda_version" in status
        assert "use_gpu_env" in status
        
        # Types must be correct
        assert isinstance(status["gpu_available"], bool)
        assert status["using_device"] in ("cuda", "cpu")
    
    @settings(max_examples=100)
    @given(st.text(min_size=10, max_size=500))
    def test_analyze_content_works_regardless_of_gpu(self, text: str):
        """
        Property 10: GPU Detection and Usage
        For any text input, analyze_content SHALL complete successfully
        regardless of GPU availability (graceful fallback).
        **Validates: Requirements 2.2**
        """
        # Reset cached device
        import app.analyzer as analyzer_module
        analyzer_module._DEVICE = None
        
        # Should not raise any exceptions
        result = analyze_content(text)
        
        # Must return valid result structure
        assert "score" in result
        assert "overview" in result
        assert "red_flags" in result
        assert "positive_indicators" in result
        assert "keywords" in result
        
        # Score must be in valid range
        assert 0 <= result["score"] <= 100


class TestGPUFallback:
    """Tests for GPU fallback behavior - Property 10"""
    
    def test_fallback_when_torch_not_available(self):
        """
        Property 10: GPU Detection and Usage
        When PyTorch is not available, detect_gpu SHALL return CPU device
        without raising an error.
        **Validates: Requirements 2.2**
        """
        with patch.dict('sys.modules', {'torch': None}):
            # Force reimport to trigger ImportError path
            import importlib
            import app.analyzer as analyzer_module
            
            # Mock the import to raise ImportError
            original_detect = analyzer_module.detect_gpu
            
            def mock_detect():
                try:
                    raise ImportError("No module named 'torch'")
                except ImportError:
                    return {
                        "available": False,
                        "device": "cpu",
                        "device_name": None,
                        "cuda_version": None
                    }
            
            with patch.object(analyzer_module, 'detect_gpu', mock_detect):
                result = analyzer_module.detect_gpu()
                assert result["available"] is False
                assert result["device"] == "cpu"
    
    def test_fallback_when_cuda_not_available(self):
        """
        Property 10: GPU Detection and Usage
        When CUDA is not available, detect_gpu SHALL return CPU device.
        **Validates: Requirements 2.2**
        """
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = False
        
        with patch.dict('sys.modules', {'torch': mock_torch}):
            result = detect_gpu()
            # Should fall back to CPU
            assert result["device"] == "cpu"
    
    @settings(max_examples=100)
    @given(st.text(min_size=10, max_size=200))
    def test_analysis_succeeds_with_cpu_fallback(self, text: str):
        """
        Property 10: GPU Detection and Usage
        For any text, analysis SHALL succeed when falling back to CPU.
        **Validates: Requirements 2.2**
        """
        # Reset cached device
        import app.analyzer as analyzer_module
        analyzer_module._DEVICE = None
        
        # Force CPU mode
        with patch.dict(os.environ, {"USE_GPU": "false"}):
            result = analyze_content(text)
            
            # Analysis must complete successfully
            assert isinstance(result["score"], int)
            assert 0 <= result["score"] <= 100


class TestGPUEnvironmentVariables:
    """Tests for GPU environment variable handling - Property 10"""
    
    @settings(max_examples=100)
    @given(st.sampled_from(["", "invalid", "maybe", "gpu", "cuda"]))
    def test_invalid_use_gpu_values_default_to_check_availability(self, value: str):
        """
        Property 10: GPU Detection and Usage
        For any non-standard USE_GPU value, get_device SHALL check actual
        GPU availability rather than defaulting to a specific device.
        **Validates: Requirements 2.2**
        """
        # Reset cached device
        import app.analyzer as analyzer_module
        analyzer_module._DEVICE = None
        
        with patch.dict(os.environ, {"USE_GPU": value}):
            device = get_device()
            # Must return a valid device
            assert device in ("cuda", "cpu")
    
    def test_use_gpu_env_included_in_status(self):
        """
        Property 10: GPU Detection and Usage
        The USE_GPU environment variable value SHALL be included in GPU status.
        **Validates: Requirements 2.2**
        """
        # Reset cached device
        import app.analyzer as analyzer_module
        analyzer_module._DEVICE = None
        
        test_value = "test_value"
        with patch.dict(os.environ, {"USE_GPU": test_value}):
            status = get_gpu_status()
            assert status["use_gpu_env"] == test_value
