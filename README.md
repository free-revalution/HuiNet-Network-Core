<div align="center">

  <pre>
██╗  ██╗██╗   ██╗██╗███╗   ██╗███████╗████████╗
██║  ██║██║   ██║██║████╗  ██║██╔════╝╚══██╔══╝
███████║██║   ██║██║██╔██╗ ██║█████╗     ██║
██╔══██║██║   ██║██║██║╚██╗██║██╔══╝     ██║
██║  ██║╚██████╔╝██║██║ ╚████║███████╗   ██║
╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝
  </pre>

  **P2P Agent Networking**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
  [![Node Version](https://img.shields.io/badge/node-%3E=16.0.0-green)](https://nodejs.org/)
  [![Tests](https://img.shields.io/badge/tests-282%20passed-success)](https://github.com/free-revalution/HuiNet-Network-Core)

  [Status](#project-status) • [Architecture](#architecture) • [SDK](#sdk-usage)

</div>

---

## HuiNet

**HuiNet** is a decentralized P2P networking library that enables AI agents (Claude Code, OpenClaw, CodeX, etc.) to communicate directly across networks.

### Current Status: 🚧 Under Refactoring

We are refactoring HuiNet to focus on **Agent-to-Agent (A2A) communication** as the core function.

**What's changing:**
- ✅ **Keeping**: P2P networking core (mDNS, TCP transport, routing, encryption)
- ❌ **Removing**: HTTP/WebSocket API proxy (major agents won't integrate via API)
- 🔄 **Building**: Agent wrapper with one-command startup

**Target Experience:**
```bash
# One command to start an agent with HuiNet
huinet run claude-code
```

See [Refactoring Plan](docs/plans/2026-03-18-huinet-refactor-plan.md) for details.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   User Computer A                            │
│  ┌────────────────┐      ┌─────────────────────────────┐   │
│  │  Agent         │◄─────►│  HuiNet (P2P Network)       │   │
│  │  - Claude Code  │ WS    │  - mDNS Discovery           │   │
│  │  - OpenClaw     │       │  - TCP Transport            │   │
│  │  - CodeX        │       │  - Ed25519 Encryption       │   │
│  └────────────────┘      │  - 3-Layer Routing           │   │
│                           └─────────────────────────────┘   │└─────────────────────────────────────────────────────────────┘
                              │ P2P Network (TCP)
                              │
┌─────────────────────────────────────────────────────────────┐
│                   User Computer B                            │
│              (Same architecture)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## SDK Usage

The core networking library is available as an npm package:

### Installation

```bash
npm install @huinet/network
```

### Quick Start

```typescript
import { HuiNet } from '@huinet/network';

// Create HuiNet instance
const huinet = new HuiNet({
  listenPort: 8000,
  enableMDNS: true,
});

// Start the network
await huinet.start();

// Send message to another node
await huinet.send(targetNodeID, { data: 'Hello World' });

// Listen for incoming messages
huinet.on('message', (fromNodeID, message) => {
  console.log(`Received from ${fromNodeID}:`, message);
});

// Get routing table statistics
const stats = huinet.getRoutingStats();
console.log(`Core: ${stats.coreCount}, Active: ${stats.activeCount}, Known: ${stats.knownCount}`);
```

---

## Core Features

### P2P Networking
- **Auto Discovery**: mDNS for local network discovery
- **Direct P2P**: TCP connections between agents
- **Cross-Network**: Bootstrap nodes for NAT traversal
- **Encrypted**: Ed25519 public-key cryptography

### Routing Table
Three-layer connection management:
- **Core Layer**: Persistent connections (up to 10 nodes)
- **Active Layer**: Frequently used nodes (up to 50 nodes)
- **Known Layer**: Discovered nodes (unlimited)

### Message Protocol
- Handshake protocol for secure connections
- Heartbeat for connection health
- Message signing for authenticity

---

## Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| P2P Core | ✅ Complete | 282 tests passing |
| CLI (old) | 🔄 Refactoring | Removing REPL, NLP features |
| HTTP Proxy | ❌ Removed | Not suitable for mainstream agents |
| Agent Wrapper | 🚧 Planned | Phase 2-4 of refactor |

---

## Development

```bash
# Clone repository
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run CLI (temporarily shows placeholder commands)
npm run cli
```

### Test Coverage
- **Total Tests**: 282 ✅
- **Coverage**: Core modules, utilities, protocol handlers
- **Test Framework**: Jest

---

## Documentation

- [Refactoring Plan](docs/plans/2026-03-18-huinet-refactor-plan.md) - Current roadmap
- [Codebase Analysis](docs/plans/2026-03-18-codebase-analysis.md) - What's kept/removed
- [API Reference](docs/api-reference.md) - SDK documentation

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

[GitHub](https://github.com/free-revalution/HuiNet-Network-Core) • [Issues](https://github.com/free-revalution/HuiNet-Network-Core/issues) • **282 Tests Passing**

</div>
