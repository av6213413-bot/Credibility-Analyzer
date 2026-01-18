# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Credibility Analyzer, please report it responsibly by emailing **security@credibility-analyzer.dev** instead of using the public issue tracker.

### What to Include

- Description of the vulnerability
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- **Initial response**: Within 48 hours
- **Fix release**: Within 7-14 days (depending on severity)
- **Public disclosure**: After fix is released

## Security Best Practices

When using Credibility Analyzer:

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Rotate credentials regularly** - Change MongoDB and API keys periodically
3. **Use HTTPS only** - Always deploy with SSL/TLS certificates
4. **Keep dependencies updated** - Run `npm audit` and `pip audit` regularly
5. **Restrict database access** - Use IP whitelisting in MongoDB Atlas

## Supported Versions

| Version | Status | Support Until |
|---------|--------|---------------|
| 1.0.x   | Active | 2027-01-01    |

## Dependencies

We use the following security tools:

- **npm audit** - Scans Node.js dependencies
- **pip audit** - Scans Python dependencies
- **GitHub CodeQL** - Static code analysis
- **Dependabot** - Automated dependency updates

## Contact

For security inquiries, contact: **security@credibility-analyzer.dev**

---

**Last Updated**: January 2026
