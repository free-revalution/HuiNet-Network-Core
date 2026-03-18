# Security Policy

## Supported Versions

Security updates are applied only to the latest version of HuiNet.

## Reporting a Vulnerability

If you discover a security vulnerability, please do not open a public issue. Instead, report it privately through GitHub's Security Advisories:

1. Visit: https://github.com/free-revalution/HuiNet-Network-Core/security/advisories
2. Click "Report a vulnerability"
3. Fill in the details including:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Version affected

We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

## Security Best Practices

### Key Management

- Never hardcode private keys or secrets
- Use environment variables for sensitive configuration
- Rotate keys regularly

### Network Security

- Validate all inputs
- Use HTTPS/TLS for network communication
- Implement rate limiting for API endpoints

### Dependencies

We regularly update dependencies to address security vulnerabilities. Please report any security issues in dependencies.

## Disclosure Policy

* We will disclose vulnerabilities within 7 days of being notified
- We will provide a patch within 14 days for critical vulnerabilities
- Security advisories will be published at https://github.com/free-revalution/HuiNet-Network-Core/security/advisories

## Security Best Practices for Users

- Keep dependencies updated
- Review security advisories
- Use strong authentication
- Monitor network traffic for anomalies
