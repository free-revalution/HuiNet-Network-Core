# HuiNet Network Core

Decentralized Agent-to-Agent (A2A) networking library with hybrid P2P architecture.

## Overview

HuiNet provides a robust peer-to-peer networking foundation for autonomous agents to communicate directly, featuring:

- **Hybrid P2P Architecture**: Three-layer design (Bootstrap → SuperNode → Data)
- **NAT Traversal**: Automatic traversal using UPnP → STUN → Reversal → Relay
- **Encrypted Messaging**: Ed25519 public-key cryptography for secure communication
- **Automatic Discovery**: mDNS + bootstrap node for peer finding
- **TypeScript**: Fully typed for development safety

## Installation

```bash
npm install @huinet/network
```

## Quick Start

```typescript
import { HuiNet } from '@huinet/network';

const node = await HuiNet.create({
  port: 3030,
  bootstrapNodes: ['bootstrap.huinet.net:3030']
});

await node.start();
```

## Architecture

### Three-Layer Design

1. **Bootstrap Layer**: Initial entry points to the network
2. **SuperNode Layer**: High-capacity nodes providing routing and relay services
3. **Data Layer**: Regular nodes exchanging application data

### NAT Traversal Strategy

The library automatically tries multiple NAT traversal techniques in order:
1. UPnP (port forwarding)
2. STUN (public address discovery)
3. Connection reversal
4. Relay through SuperNode

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch

# Lint
npm run lint
```

## Project Structure

```
src/
├── crypto/      # Cryptographic operations (Ed25519, encryption)
├── discovery/   # Peer discovery (mDNS, bootstrap)
├── nat/         # NAT traversal (UPnP, STUN, reversal)
├── routing/     # Packet routing and forwarding
├── transport/   # Network transport layer
└── types/       # TypeScript type definitions
```

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines.
