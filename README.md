# HuiNet Network Core

Decentralized Agent-to-Agent (A2A) networking library with hybrid P2P architecture.

## Features

- **Hybrid P2P Architecture**: Bootstrap nodes → Super nodes → Direct connections
- **Public Key Identity**: Ed25519-based node identification
- **NAT Traversal**: UPnP → STUN → Connection reversal → Relay fallback
- **Local Discovery**: mDNS-based local network discovery
- **Encrypted Messaging**: End-to-end encryption support
- **Connection Management**: Tiered connection strategy (Core/Active/On-demand)
- **TypeScript**: Fully typed for development safety

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

## Architecture

HuiNet uses a three-layer hybrid architecture:

1. **Bootstrap Layer**: Stable nodes for initial discovery
2. **Routing Layer**: Super nodes for location queries and relay
3. **Data Layer**: Direct P2P connections between agents

### Node Identity

Each node has a unique identity based on Ed25519 public key cryptography:

- **NodeID**: Base58-encoded SHA-256 hash of the public key
- **KeyPair**: Ed25519 key pair for signing and verification
- **Address**: Network address (IP:port) for connections

### NAT Traversal Strategy

The library automatically tries multiple NAT traversal techniques in order:
1. **UPnP**: Automatic port forwarding
2. **STUN**: Public address discovery
3. **Connection Reversal**: Outbound connection trick
4. **Relay**: Fall back to SuperNode relay

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

- **start()**: Start the network service
- **stop()**: Stop the network service
- **getNodeID()**: Get the node's unique identifier
- **getPublicKey()**: Get the node's public key
- **send(targetNodeID, message)**: Send a message to a specific node
- **getRoutingTable()**: Get the routing table instance
- **getConnectionPool()**: Get the connection pool instance

#### Events

- **ready**: Emitted when the node is ready
- **nodeDiscovered**: Emitted when a new node is discovered
- **peerConnected**: Emitted when a connection is established
- **peerDisconnected**: Emitted when a connection is closed

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

# Run example
npm run build
npx ts-node examples/basic-usage.ts
```

## Project Structure

```
src/
├── crypto/      # Cryptographic operations (Ed25519, encryption)
├── discovery/   # Peer discovery (mDNS, bootstrap)
├── nat/         # NAT traversal (UPnP, STUN, reversal)
├── protocol/    # Message protocol and encoding
├── routing/     # Routing table and node management
├── transport/   # Connection pool and transport layer
├── types/       # TypeScript type definitions
├── utils/       # Utility functions (Base58, etc.)
└── HuiNet.ts    # Main HuiNet class

examples/
└── basic-usage.ts  # Basic usage example
```

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines.
