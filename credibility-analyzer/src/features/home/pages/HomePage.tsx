import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/shared/hooks';
import { ROUTES } from '@/constants/routes';
import { createHomePageStyles } from './HomePage.styles';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: '🔍',
    title: 'URL Analysis',
    description: 'Submit any URL to analyze the credibility of web content. Get instant feedback on trustworthiness.',
  },
  {
    icon: '📝',
    title: 'Text Analysis',
    description: 'Paste text directly to check for credibility indicators. Supports up to 10,000 characters.',
  },
  {
    icon: '📊',
    title: 'Detailed Scores',
    description: 'Receive a credibility score from 0-100 with color-coded indicators and detailed explanations.',
  },
  {
    icon: '🚩',
    title: 'Red Flag Detection',
    description: 'Identify suspicious patterns and red flags that may indicate unreliable content.',
  },
  {
    icon: '✅',
    title: 'Positive Indicators',
    description: 'Discover trust signals and positive indicators that support content credibility.',
  },
  {
    icon: '📜',
    title: 'Analysis History',
    description: 'Track your previous analyses with filtering, sorting, and export capabilities.',
  },
];

export const HomePage: React.FC = () => {
  const { themeConfig } = useTheme();
  const styles = createHomePageStyles(themeConfig);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [isCtaHovered, setIsCtaHovered] = useState(false);

  return (
    <div style={styles.container}>
      <section style={styles.hero}>
        <h1 style={styles.title}>Credibility Analyzer</h1>
        <p style={styles.subtitle}>
          Analyze web content for trustworthiness. Get detailed credibility scores, 
          identify red flags, and make informed decisions about the content you consume.
        </p>
        <Link
          to={ROUTES.ANALYSIS}
          style={{
            ...styles.ctaButton,
            ...(isCtaHovered ? styles.ctaButtonHover : {}),
          }}
          onMouseEnter={() => setIsCtaHovered(true)}
          onMouseLeave={() => setIsCtaHovered(false)}
        >
          Start Analyzing →
        </Link>
      </section>

      <section style={styles.featuresSection}>
        <h2 style={styles.featuresTitle}>Features</h2>
        <div style={styles.featuresGrid}>
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              style={{
                ...styles.featureCard,
                ...(hoveredFeature === index ? styles.featureCardHover : {}),
              }}
              onMouseEnter={() => setHoveredFeature(index)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <div style={styles.featureIcon}>{feature.icon}</div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
