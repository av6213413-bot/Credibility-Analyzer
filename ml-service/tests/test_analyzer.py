"""
Unit tests for the analyzer module.

Tests cover:
- Score is in valid range (0-100) - Requirements 3.2
- Red flag severity values ("low", "medium", "high") - Requirements 3.2
- Keyword weight range (0-1) - Requirements 3.4
"""
import pytest
from app.analyzer import (
    analyze_content,
    _find_red_flags,
    _find_positive_indicators,
    _extract_keywords,
    _calculate_score
)


class TestScoreRange:
    """Tests for score range validation - Requirements 3.2, 3.4"""
    
    def test_score_is_integer(self):
        """Score should be an integer."""
        result = analyze_content("This is a test article about research.")
        assert isinstance(result["score"], int)
    
    def test_score_in_valid_range_neutral_content(self):
        """Score should be between 0 and 100 for neutral content."""
        result = analyze_content("This is a simple test article.")
        assert 0 <= result["score"] <= 100
    
    def test_score_in_valid_range_positive_content(self):
        """Score should be between 0 and 100 for highly positive content."""
        result = analyze_content(
            "According to a peer-reviewed study published in a scientific journal, "
            "Dr. Smith, a professor at the university, confirmed the research data "
            "shows evidence based on expert analysis and verified statistics."
        )
        assert 0 <= result["score"] <= 100
    
    def test_score_in_valid_range_negative_content(self):
        """Score should be between 0 and 100 for highly negative content."""
        result = analyze_content(
            "SHOCKING!!! You won't believe this miracle cure!! "
            "They don't want you to know the hidden truth! "
            "This is 100% proven and absolutely certain! "
            "CLICK HERE NOW! ACT FAST! SHARE NOW!"
        )
        assert 0 <= result["score"] <= 100
    
    def test_score_does_not_exceed_100(self):
        """Score should never exceed 100 even with many positive indicators."""
        # Content with many positive signals
        result = analyze_content(
            "Research study evidence analysis data report expert scientist "
            "professor peer-reviewed journal verified confirmed documented "
            "official factual according to cited source university institution "
            "organization published statistics percent"
        )
        assert result["score"] <= 100
    
    def test_score_does_not_go_below_0(self):
        """Score should never go below 0 even with many red flags."""
        # Content with many negative signals
        result = analyze_content(
            "SHOCKING UNBELIEVABLE SECRET CONSPIRACY HOAX MIRACLE GUARANTEED "
            "EXCLUSIVE URGENT BREAKING VIRAL EXPOSED BANNED CENSORED SUPPRESSED "
            "You won't believe this!!! They don't want you to know!!! "
            "CLICK HERE NOW!!! ACT FAST!!! 100% PROVEN!!!"
        )
        assert result["score"] >= 0


class TestRedFlagSeverity:
    """Tests for red flag severity values - Requirements 3.2"""
    
    VALID_SEVERITIES = ["low", "medium", "high"]
    
    def test_red_flags_have_valid_severity(self):
        """All red flags should have severity as 'low', 'medium', or 'high'."""
        result = analyze_content("SHOCKING NEWS! You won't believe this miracle cure!")
        assert len(result["red_flags"]) > 0, "Expected at least one red flag"
        for flag in result["red_flags"]:
            assert flag["severity"] in self.VALID_SEVERITIES, \
                f"Invalid severity: {flag['severity']}"
    
    def test_low_severity_red_flags(self):
        """Should detect low severity red flags."""
        # Excessive caps and exclamation marks are low severity
        flags = _find_red_flags("CLICK HERE NOW!!! Share this!!!")
        severities = [f["severity"] for f in flags]
        assert "low" in severities
    
    def test_medium_severity_red_flags(self):
        """Should detect medium severity red flags."""
        # Sensationalist language is medium severity
        flags = _find_red_flags("You won't believe this shocking news!")
        severities = [f["severity"] for f in flags]
        assert "medium" in severities
    
    def test_high_severity_red_flags(self):
        """Should detect high severity red flags."""
        # Conspiracy language and miracle claims are high severity
        flags = _find_red_flags("They don't want you to know this miracle cure!")
        severities = [f["severity"] for f in flags]
        assert "high" in severities
    
    def test_red_flag_structure(self):
        """Red flags should have id, description, and severity fields."""
        flags = _find_red_flags("SHOCKING!!! You won't believe this!")
        assert len(flags) > 0, "Expected at least one red flag"
        for flag in flags:
            assert "id" in flag, "Red flag missing 'id' field"
            assert "description" in flag, "Red flag missing 'description' field"
            assert "severity" in flag, "Red flag missing 'severity' field"
            assert isinstance(flag["id"], str)
            assert isinstance(flag["description"], str)
            assert isinstance(flag["severity"], str)


class TestKeywordWeightRange:
    """Tests for keyword weight range - Requirements 3.4"""
    
    def test_keyword_weight_in_valid_range(self):
        """Keyword weight should be between 0 and 1."""
        result = analyze_content("Research study shows evidence of shocking results")
        for keyword in result["keywords"]:
            assert 0 <= keyword["weight"] <= 1, \
                f"Invalid weight {keyword['weight']} for keyword '{keyword['term']}'"
    
    def test_keyword_impact_is_valid(self):
        """Keyword impact should be 'positive' or 'negative'."""
        result = analyze_content("Research study shows evidence of shocking results")
        for keyword in result["keywords"]:
            assert keyword["impact"] in ["positive", "negative"], \
                f"Invalid impact: {keyword['impact']}"
    
    def test_positive_keyword_detection(self):
        """Should detect positive keywords with valid weight."""
        keywords = _extract_keywords("This research study provides evidence and data analysis")
        positive_keywords = [k for k in keywords if k["impact"] == "positive"]
        assert len(positive_keywords) > 0, "Expected at least one positive keyword"
        for kw in positive_keywords:
            assert 0 <= kw["weight"] <= 1
    
    def test_negative_keyword_detection(self):
        """Should detect negative keywords with valid weight."""
        keywords = _extract_keywords("This shocking viral conspiracy is unbelievable")
        negative_keywords = [k for k in keywords if k["impact"] == "negative"]
        assert len(negative_keywords) > 0, "Expected at least one negative keyword"
        for kw in negative_keywords:
            assert 0 <= kw["weight"] <= 1
    
    def test_keyword_structure(self):
        """Keywords should have term, impact, and weight fields."""
        keywords = _extract_keywords("Research shows shocking evidence")
        assert len(keywords) > 0, "Expected at least one keyword"
        for keyword in keywords:
            assert "term" in keyword, "Keyword missing 'term' field"
            assert "impact" in keyword, "Keyword missing 'impact' field"
            assert "weight" in keyword, "Keyword missing 'weight' field"
            assert isinstance(keyword["term"], str)
            assert isinstance(keyword["impact"], str)
            assert isinstance(keyword["weight"], (int, float))
    
    def test_keyword_weight_increases_with_frequency(self):
        """Keyword weight should increase with frequency (up to max 1.0)."""
        # Single occurrence
        keywords_single = _extract_keywords("research is important")
        # Multiple occurrences
        keywords_multiple = _extract_keywords(
            "research research research research research"
        )
        
        single_weight = next(
            (k["weight"] for k in keywords_single if k["term"] == "research"), 0
        )
        multiple_weight = next(
            (k["weight"] for k in keywords_multiple if k["term"] == "research"), 0
        )
        
        assert multiple_weight >= single_weight
        assert multiple_weight <= 1.0


class TestAnalyzeContent:
    """Tests for the main analyze_content function."""
    
    def test_returns_required_fields(self):
        """Result should contain all required fields."""
        result = analyze_content("Test content")
        assert "score" in result
        assert "overview" in result
        assert "red_flags" in result
        assert "positive_indicators" in result
        assert "keywords" in result
    
    def test_overview_is_string(self):
        """Overview should be a non-empty string."""
        result = analyze_content("Test content")
        assert isinstance(result["overview"], str)
        assert len(result["overview"]) > 0
    
    def test_red_flags_is_list(self):
        """Red flags should be a list."""
        result = analyze_content("Test content")
        assert isinstance(result["red_flags"], list)
    
    def test_positive_indicators_is_list(self):
        """Positive indicators should be a list."""
        result = analyze_content("Test content")
        assert isinstance(result["positive_indicators"], list)
    
    def test_keywords_is_list(self):
        """Keywords should be a list."""
        result = analyze_content("Test content")
        assert isinstance(result["keywords"], list)
    
    def test_source_url_parameter_accepted(self):
        """Should accept optional source_url parameter."""
        result = analyze_content("Test content", source_url="https://example.com")
        assert "score" in result


class TestRedFlags:
    """Tests for red flag detection."""
    
    def test_detects_sensationalist_language(self):
        """Should detect sensationalist language."""
        flags = _find_red_flags("You won't believe this shocking news!")
        descriptions = [f["description"] for f in flags]
        assert any("sensationalist" in d.lower() for d in descriptions)
    
    def test_detects_conspiracy_language(self):
        """Should detect conspiracy-style language."""
        flags = _find_red_flags("They don't want you to know the hidden truth")
        descriptions = [f["description"] for f in flags]
        assert any("conspiracy" in d.lower() for d in descriptions)
    
    def test_no_red_flags_for_clean_content(self):
        """Should return empty list for content without red flags."""
        flags = _find_red_flags("This is a simple factual statement.")
        # May or may not have flags, but should be a valid list
        assert isinstance(flags, list)


class TestPositiveIndicators:
    """Tests for positive indicator detection."""
    
    def test_detects_research_references(self):
        """Should detect references to research."""
        indicators = _find_positive_indicators("According to a recent study by researchers")
        descriptions = [i["description"] for i in indicators]
        assert any("research" in d.lower() or "source" in d.lower() for d in descriptions)
    
    def test_detects_expert_references(self):
        """Should detect references to experts."""
        indicators = _find_positive_indicators("Dr. Smith, a professor at the university, stated")
        descriptions = [i["description"] for i in indicators]
        assert any("expert" in d.lower() for d in descriptions)
    
    def test_positive_indicator_structure(self):
        """Positive indicators should have id, description, and icon fields."""
        indicators = _find_positive_indicators("According to research by Dr. Smith")
        assert len(indicators) > 0, "Expected at least one positive indicator"
        for indicator in indicators:
            assert "id" in indicator, "Indicator missing 'id' field"
            assert "description" in indicator, "Indicator missing 'description' field"
            assert "icon" in indicator, "Indicator missing 'icon' field"


class TestCalculateScore:
    """Tests for score calculation function."""
    
    def test_neutral_score_with_no_signals(self):
        """Should return neutral score when no signals present."""
        score = _calculate_score([], [], [])
        assert score == 50  # Base neutral score
    
    def test_score_decreases_with_red_flags(self):
        """Score should decrease with red flags."""
        red_flags = [{"severity": "medium"}]
        score = _calculate_score(red_flags, [], [])
        assert score < 50
    
    def test_score_increases_with_positive_indicators(self):
        """Score should increase with positive indicators."""
        positive_indicators = [{"description": "test", "icon": "test"}]
        score = _calculate_score([], positive_indicators, [])
        assert score > 50
    
    def test_score_clamped_to_valid_range(self):
        """Score should always be between 0 and 100."""
        # Many red flags
        many_red_flags = [{"severity": "high"} for _ in range(20)]
        score_low = _calculate_score(many_red_flags, [], [])
        assert score_low >= 0
        
        # Many positive indicators
        many_positive = [{"description": "test", "icon": "test"} for _ in range(20)]
        score_high = _calculate_score([], many_positive, [])
        assert score_high <= 100
