<div align="center">

  <pre>
██╗  ██╗██╗   ██╗██╗███╗   ██╗███████╗████████╗
██║  ██║██║   ██║██║████╗  ██║██╔════╝╚══██╔══╝
███████║██║   ██║██║██╔██╗ ██║█████╗     ██║   
██╔══██║██║   ██║██║██║╚██╗██║██╔══╝     ██║   
██║  ██║╚██████╔╝██║██║ ╚████║███████╗   ██║   
╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   
  </pre>

  **Decentralized Agent-to-Agent Networking**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
  [![Node Version](https://img.shields.io/badge/node-%3E=16.0.0-green)](https://nodejs.org/)
  [![codecov](https://codecov.io/gh/free-revalution/HuiNet-Network-Core/branch/main/graph/badge.svg)](https://codecov.io/gh/free-revalution/HuiNet-Network-Core)

  [Features](#features) • [Quick Start](#quick-start) • [Architecture](#architecture) • [API](#api-reference) • [Contributing](#contributing)

</div>

---

## Overview

**HuiNet** is a decentralized Agent-to-Agent (A2A) networking library designed for modern distributed applications. It provides a secure, scalable P2P communication layer with automatic NAT traversal, encrypted messaging, and intelligent node discovery.

Built with TypeScript and leveraging Ed25519 cryptography, HuiNet enables agents to communicate directly across network boundaries while maintaining security and performance.

## Features

- **Hybrid P2P Architecture**: Bootstrap nodes → Super nodes → Direct connections
- **Public Key Identity**: Ed25519-based node identification with cryptographically secure NodeIDs
- **NAT Traversal**: Multi-layered strategy (UPnP → STUN → Connection reversal → Relay fallback)
- **Local Discovery**: mDNS-based automatic peer discovery on local networks
- **Encrypted Messaging**: End-to-end encryption with Ed25519 signatures
- **Connection Management**: Tiered strategy (Core/Active/Known) with LRU eviction
- **TypeScript**: Fully typed with strict mode for maximum safety
- **Well Tested**: 100+ tests with 75%+ code coverage

## Installation

```bash
npm install @huinet/network
```

## Quick Start

```typescript
import { HuiNet } from '@huinet/network';

const huinet = new HuiNet({
  listenPort: 8000,
  enableMDNS: true,
});

huinet.on('ready', () => {
  console.log('NodeID:', huinet.getNodeID());
});

huinet.on('peerConnected', (nodeID) => {
  console.log('Connected to:', nodeID);
});

await huinet.start();
```

## Using the CLI Tool

HuiNet includes a built-in CLI tool for easy P2P communication without writing code.

### Start the CLI

```bash
# From the project directory
npm start

# Or with custom options
npm start -- "My Computer" --port 8001
```

### CLI Commands

```
huinet > help              # Show all commands
huinet > status            # Show node status
huinet > ls                # List discovered nodes
huinet > msg Alice Hello   # Send message to a node
huinet > quit              # Exit
```

### Natural Language Support

```
huinet > send a message to Alice saying hello
huinet > show me all nodes
huinet > what's my status
```

See [README_CLI.md](README_CLI.md) for complete CLI documentation.

## Architecture

HuiNet implements a three-layer hybrid architecture designed for scalability and resilience:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Bootstrap Layer    │    Super Nodes     │   Data Layer     │
│  (Discovery)        │    (Routing)       │   (P2P Mesh)     │
├─────────────────────────────────────────────────────────────┤
│              NAT Traversal (UPnP/STUN/Relay)                │
├─────────────────────────────────────────────────────────────┤
│         Transport (TCP)  │  Discovery (mDNS)                │
└─────────────────────────────────────────────────────────────┘
```

### Node Identity

Each node has a unique identity based on Ed25519 public key cryptography:

- **NodeID**: Base58-encoded SHA-256 hash of the public key
- **KeyPair**: Ed25519 key pair for signing and verification
- **Address**: Network address (IP:port) for connections

### NAT Traversal Strategy

The library automatically tries multiple NAT traversal techniques in order:

1. **UPnP**: Automatic port forwarding (if supported)
2. **STUN**: Public address discovery
3. **Connection Reversal**: Outbound connection trick
4. **Relay**: Fall back to SuperNode relay

### Connection Management

HuiNet maintains three tiers of connections:

- **Core Nodes**: Permanent connections to critical infrastructure
- **Active Nodes**: Frequently-used peers with automatic reconnection
- **Known Nodes**: Discovered peers available for on-demand connections

## API Reference

### HuiNet Class

Main class for creating and managing a HuiNet node.

#### Constructor Options

```typescript
interface HuiNetConfig {
  keyPair?: KeyPair;              // Optional: Ed25519 key pair (auto-generated if not provided)
  listenPort?: number;            // Optional: Port to listen on (default: 8000)
  listenHost?: string;            // Optional: Host to bind to (default: '0.0.0.0')
  bootstrapNodes?: string[];      // Optional: Bootstrap node addresses
  maxCoreConnections?: number;    // Optional: Max core connections (default: 10)
  maxActiveConnections?: number;  // Optional: Max active connections (default: 50)
  enableMDNS?: boolean;           // Optional: Enable mDNS discovery (default: true)
}
```

#### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start the network service |
| `stop()` | Stop the network service |
| `getNodeID()` | Get the node's unique identifier |
| `getPublicKey()` | Get the node's public key |
| `send(targetNodeID, message)` | Send a message to a specific node |
| `getRoutingTable()` | Get the routing table instance |
| `getConnectionPool()` | Get the connection pool instance |

#### Events

| Event | Description |
|-------|-------------|
| `ready` | Emitted when the node is ready |
| `nodeDiscovered` | Emitted when a new node is discovered |
| `peerConnected` | Emitted when a connection is established |
| `peerDisconnected` | Emitted when a connection is closed |

## Examples

### Basic Usage

```typescript
import { HuiNet } from '@huinet/network';

const huinet = new HuiNet({
  listenPort: 8000,
  enableMDNS: true,
});

huinet.on('ready', () => {
  console.log('HuiNet ready! NodeID:', huinet.getNodeID());
});

huinet.on('peerConnected', (nodeID) => {
  console.log('Connected to:', nodeID);
});

await huinet.start();
```

### Sending Messages

```typescript
// Send a message to a specific node
await huinet.send(targetNodeID, {
  type: 'greeting',
  data: 'Hello from HuiNet!'
});
```

### Custom Key Pair

```typescript
import { generateKeyPair } from '@huinet/network';

const myKeyPair = generateKeyPair();

const huinet = new HuiNet({
  keyPair: myKeyPair,
  listenPort: 8000,
});

await huinet.start();
```

## Development

```bash
# Clone the repository
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Run example
npm run build
npx ts-node examples/basic-usage.ts
```

## Project Structure

```
HuiNet-Network-Core/
├── src/
│   ├── crypto/          # Cryptographic operations (Ed25519, signatures)
│   ├── discovery/       # Peer discovery (mDNS, bootstrap)
│   ├── protocol/        # Message protocol and varint encoding
│   ├── routing/         # Routing table (Core/Active/Known)
│   ├── transport/       # Connection pool with LRU eviction
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions (Base58, etc.)
│   └── HuiNet.ts        # Main orchestrating class
├── examples/            # Usage examples
├── __tests__/           # Test suites (108 tests, 75% coverage)
├── docs/                # Additional documentation (gitignored)
└── package.json
```

## Testing

HuiNet maintains comprehensive test coverage:

- **108 tests** across 9 test suites
- **75%+ code coverage** (statements, branches, functions, lines)
- Tests cover all core functionality including crypto, encoding, routing, and networking

## Security

HuiNet takes security seriously:

- **Ed25519 Cryptography**: Industry-standard public-key cryptography
- **Input Validation**: All inputs are validated with size limits
- **Buffer Overflow Protection**: Bounds checking on all binary operations
- **DoS Mitigation**: Message size limits (10MB) and connection pooling

See [SECURITY.md](SECURITY.md) for security policies and vulnerability reporting.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Code of Conduct

Please read and follow our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [TweetNaCl](https://tweetnacl.cr.yp.to/) for cryptographic operations
- Uses [multicast-dns](https://github.com/mafintosh/multicast-dns) for local discovery
- Inspired by modern P2P networks and agent communication protocols

---

<div align="center">

  **Built with ❤️ for the decentralized future**

  [GitHub](https://github.com/free-revalution/HuiNet-Network-Core) • [Issues](https://github.com/free-revalution/HuiNet-Network-Core/issues) • [Discussions](https://github.com/free-revalution/HuiNet-Network-Core/discussions)

</div>
