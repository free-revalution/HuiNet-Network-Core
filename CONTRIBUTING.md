# Contributing to HuiNet

Thank you for your interest in contributing to HuiNet! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Submitting Changes](#submitting-changes)

## Code of Conduct

Our pledge to make participation in our community a harassment-free experience for everyone.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- Clear description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node version)
- Relevant logs or screenshots

### Suggesting Enhancements

Feature requests are welcome. Please provide:

- Clear use case
- Proposed solution
- Alternative approaches considered
- Potential impact

### Pull Requests

We welcome pull requests! Before submitting:

1. Fork the repository
2. Create a branch for your work (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Ensure tests pass (`npm test`)
5. Commit your changes (`git commit -m "Add some amazing feature"`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 16+ or higher
- npm or yarn package manager

### Installation

```bash
# Clone your fork
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Coding Standards

- Follow TypeScript best practices
- Use ESLint for code quality (`npm run lint`)
- Write tests for new features
- Keep functions small and focused
- Add JSDoc comments for public APIs

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add STUN protocol for NAT traversal
fix: prevent buffer overflow in Base58 decode
docs: update API documentation
```

## Submitting Changes

### Before Submitting

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Self-review your changes
- [ ] Update documentation if needed

### After Submitting

- Respond to review feedback promptly
- Keep your PR focused and manageable
- Address CI failures quickly

## Getting Help

- Open an issue for bugs or feature requests
- Ask questions in PR discussions
- Check existing issues and documentation

Thank you for contributing to HuiNet!
