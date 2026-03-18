# Changelog

All notable changes to HuiNet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Project documentation and setup
- GitHub issue and PR templates
- Security policy and code of conduct

## [0.1.0] - 2026-03-18

### Added
- Initial release of HuiNet P2P networking library
- mDNS-based local network discovery
- Ed25519 public-key cryptography for secure messaging
- Three-layer routing table for efficient message routing
- TCP-based P2P transport with connection pooling
- WebSocket interface for agent communication
- HTTP proxy support for agents
- CLI commands:
  - `huinet network create/join/list/status`
  - `huinet agent add/list/remove`
  - `huinet run <agent-id>`
  - `huinet doctor`
- Network key authentication (32-character hex keys)
- Machine ID generation for unique identification
- Agent launcher with environment variable injection
- Configuration management for agents and networks
- Comprehensive test suite (331 tests passing)
- TypeScript type definitions

### Documentation
- Complete README with architecture diagrams
- API reference documentation
- Usage examples for single machine, local network, and cross-network scenarios
- Troubleshooting guide
- Contributing guidelines

[Unreleased]: https://github.com/free-revalution/HuiNet-Network-Core/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/free-revalution/HuiNet-Network-Core/releases/tag/v0.1.0
