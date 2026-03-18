<div align="center">

  <pre>
██╗  ██╗██╗   ██╗██╗███╗   ██╗███████╗████████╗
██║  ██║██║   ██║██║████╗  ██║██╔════╝╚══██╔══╝
███████║██║   ██║██║██╔██╗ ██║█████╗     ██║
██╔══██║██║   ██║██║██║╚██╗██║██╔══╝     ██║
██║  ██║╚██████╔╝██║██║ ╚████║███████╗   ██║
╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝
  </pre>

  **Decentralized P2P Agent Networking**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
  [![Node Version](https://img.shields.io/badge/node-%3E=16.0.0-green)](https://nodejs.org/)
  [![Tests](https://img.shields.io/badge/tests-282%20passed-success)](https://github.com/free-revalution/HuiNet-Network-Core)

  [Install](#installation) • [Quick Start](#quick-start) • [API Reference](#api-reference) • [Proxy Server](#proxy-server)

</div>

---

## HuiNet

**HuiNet** is a decentralized P2P networking library for Agent-to-Agent (A2A) communication. It enables AI agents to discover each other and communicate directly across networks with automatic discovery and encrypted messaging.

## Features

### Core Networking
- **Auto Discovery**: Automatically finds other HuiNet nodes via mDNS
- **P2P Communication**: Direct agent-to-agent messaging without central servers
- **Encrypted**: Ed25519 public-key cryptography for secure communication
- **Cross-Network**: Works across different networks with bootstrap nodes
- **Connection Pool**: Intelligent connection management with Core/Active/Known layers

### Advanced Features
- **Message Protocol**: Handshake, heartbeat, and disconnect protocols for reliable connections
- **Message Signing**: Built-in signature verification for message authenticity
- **Network Utilities**: IP address detection, subnet comparison, network info
- **Configuration Validation**: Automatic config validation with sanitization
- **Auto-Reconnection**: Automatic reconnection on connection failure
- **Node Promotion**: Automatic promotion of frequently-used nodes to Core layer

### Agent Integration
- **Proxy Server**: HTTP/WebSocket API for easy integration
- **CLI Tool**: Command-line interface for testing and debugging
- **SDK**: Simple TypeScript/JavaScript API for direct integration

## Installation

### As a Library

```bash
npm install @huinet/network
```

### CLI Tool

```bash
# Clone repository
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# Install dependencies
npm install

# Build project
npm run build

# Optional: Create global link
npm link
```

## Quick Start

### Using the CLI

```bash
# Start HuiNet
huinet

# You'll see the welcome screen with your NodeID
huinet > ls              # List discovered nodes
huinet > msg Alice Hi!   # Send a message
huinet > status          # Show connection status
```

### Using the SDK

```typescript
import { HuiNet } from '@huinet/network';

// Create HuiNet instance with configuration
const huinet = new HuiNet({
  listenPort: 8000,
  enableMDNS: true,
  // Optional: Routing table configuration
  promoteToActiveThreshold: 3,    // Promote to Active after 3 connections
  promoteToCoreThreshold: 10,     // Promote to Core after 10 connections
  routingCleanupInterval: 300000, // Cleanup interval (5 minutes)
  maxNodeAge: 3600000,            // Max node age (1 hour)
});

await huinet.start();

// Send message to another node
await huinet.send(targetNodeID, { data: 'Hello World' });

// Listen for incoming messages
huinet.on('message', (fromNodeID, message) => {
  console.log(`Received from ${fromNodeID}:`, message);
});

// Get network information
const localIPs = huinet.getLocalIPs();
const primaryIP = huinet.getPrimaryLocalIP();

// Check if nodes are on same network
const sameNetwork = huinet.isSameNetwork(targetNodeID, 24); // /24 subnet

// Get routing table statistics
const stats = huinet.getRoutingStats();
console.log(`Core: ${stats.coreCount}, Active: ${stats.activeCount}, Known: ${stats.knownCount}`);
```

## API Reference

### Configuration Options

```typescript
interface HuiNetConfig {
  // Identity
  keyPair?: KeyPair;           // Ed25519 key pair (auto-generated if not provided)

  // Network
  listenPort?: number;         // Listen port (default: 8000)
  listenHost?: string;         // Listen address (default: '0.0.0.0')
  enableMDNS?: boolean;        // Enable mDNS discovery (default: true)
  bootstrapNodes?: string[];   // Bootstrap node addresses

  // Connection limits
  maxCoreConnections?: number;     // Max core connections (default: 10)
  maxActiveConnections?: number;   // Max active connections (default: 50)

  // Routing table management
  promoteToActiveThreshold?: number;  // Connections to promote to Active (default: 3)
  promoteToCoreThreshold?: number;    // Connections to promote to Core (default: 10)
  routingCleanupInterval?: number;    // Cleanup interval in ms (default: 300000)
  maxNodeAge?: number;                // Max node age in ms (default: 3600000)
}
```

### Main Methods

```typescript
// Lifecycle
async start(): Promise<void>              // Start the network service
async stop(): Promise<void>               // Stop the network service
isRunning(): boolean                      // Check if running

// Identity
getNodeID(): string                       // Get this node's ID
getPublicKey(): Buffer                    // Get public key

// Messaging
async send(targetNodeID: string, message: any): Promise<void>
async broadcast(message: any): Promise<void>

// Connection Management
async connectToNode(host: string, port: number, nodeID?: string): Promise<boolean>
async disconnectFromNode(nodeID: string): Promise<boolean>
isConnected(nodeID: string): boolean
getConnectedNodes(): string[]

// Routing Table
getRoutingTable(): RoutingTable
getRoutingStats(): RoutingStats
promoteToActive(nodeID: string): boolean   // Manually promote to Active layer
promoteToCore(nodeID: string): boolean     // Manually promote to Core layer
demoteFromActive(nodeID: string): boolean  // Demote from Active to Known
demoteFromCore(nodeID: string): boolean    // Demote from Core to Active

// Network Utilities
getLocalIPs(options?: GetLocalIPOptions): string[]
getPrimaryLocalIP(): string
isSameNetwork(nodeID: string, subnetMask?: number): boolean
```

### Events

```typescript
huinet.on('ready', () => {
  // Emitted when HuiNet is ready
});

huinet.on('peerDiscovered', (nodeID: string) => {
  // Emitted when a new node is discovered
});

huinet.on('peerConnected', (nodeID: string) => {
  // Emitted when a connection is established
});

huinet.on('peerDisconnected', (nodeID: string) => {
  // Emitted when a node disconnects
});

huinet.on('message', (fromNodeID: string, message: any) => {
  // Emitted when a message is received
});

huinet.on('error', (error: Error) => {
  // Emitted when an error occurs
});
```

## Routing Table Layers

HuiNet uses a three-layer routing table for efficient connection management:

```
┌─────────────────────────────────────┐
│  Core Layer (Persistent)            │  ← Long-term connections
│  - Up to 10 nodes                   │  - Manually promoted
│  - Highest priority                 │  - Auto-promoted after 10+ connections
├─────────────────────────────────────┤
│  Active Layer (Cached)              │  ← Frequently used
│  - Up to 50 nodes                   │  - Auto-promoted after 3+ connections
│  - Medium priority                  │  - Faster reconnection
├─────────────────────────────────────┤
│  Known Layer (On-demand)            │  ← Discovered nodes
│  - Unlimited nodes                  │  - Connected when needed
│  - Lowest priority                  │  - Cleanup after 1 hour
└─────────────────────────────────────┘
```

## Network Utilities

```typescript
import { getLocalIPs, getPrimaryLocalIP, isSameSubnet, getNetworkInfo } from '@huinet/network/utils';

// Get all local IP addresses with filtering
const allIPs = getLocalIPs();
const ipv4Only = getLocalIPs({ ipv4Only: true });
const noLoopback = getLocalIPs({ excludeInternal: true });

// Get primary local IP (non-loopback IPv4)
const primaryIP = getPrimaryLocalIP();

// Check if two IPs are in the same subnet
const sameSubnet = isSameSubnet('192.168.1.1', '192.168.1.100', 24); // true
const differentSubnet = isSameSubnet('192.168.1.1', '192.168.2.1', 24); // false

// Get detailed network information
const networkInfo = getNetworkInfo();
// Returns: { hostname, interfaces, primaryIP }
```

## Proxy Server

The HuiNet Proxy server provides HTTP/WebSocket APIs for integrating HuiNet with any application or agent.

### Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Claude Code   │         │     CodeX       │
│                 │         │                 │
└────────┬────────┘         └────────┬────────┘
         │                          │
    HTTP/WebSocket              HTTP/WebSocket
         │                          │
┌────────▼────────┐         ┌───────▼──────────┐
│  HuiNet Proxy   │         │  HuiNet Proxy    │
│   (Agent A)     │◄───────►│   (Agent B)     │
└────────┬────────┘         └─────────────────┘
         │
      P2P Network
```

### Quick Start

```bash
cd proxy
npm install
npm start
```

The proxy server will start on:
- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:3001`

### HTTP API

```bash
# Send a message
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "to": "target-node-id",
    "data": { "message": "Hello from API" }
  }'

# Get status
curl http://localhost:3000/api/status \
  -H "X-API-Key: your-api-key"

# List connected nodes
curl http://localhost:3000/api/nodes \
  -H "X-API-Key: your-api-key"
```

### WebSocket API

```javascript
const ws = new WebSocket('ws://localhost:3001?apiKey=your-api-key');

ws.onopen = () => {
  console.log('Connected to HuiNet Proxy');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'message') {
    console.log(`Received from ${data.from}:`, data.data);
  }
};

// Send message
ws.send(JSON.stringify({
  type: 'send',
  to: 'target-node-id',
  data: { message: 'Hello via WebSocket' }
}));
```

### Configuration

Create `proxy/config.json`:

```json
{
  "apiKey": "your-secret-api-key",
  "httpPort": 3000,
  "wsPort": 3001,
  "huinet": {
    "listenPort": 8000,
    "enableMDNS": true
  },
  "auth": {
    "enabled": true,
    "rateLimit": {
      "windowMs": 60000,
      "maxRequests": 100
    }
  }
}
```

## CLI Commands

### Basic Commands

| Command | Description | Example |
|---------|-------------|---------|
| `help` | Show help | `help` |
| `status` | Show node status | `status` |
| `ls` | List discovered nodes | `ls` |
| `quit` | Exit program | `quit` |

### Messaging

| Command | Description | Example |
|---------|-------------|---------|
| `msg <name> <text>` | Send message | `msg Alice Hello` |
| `broadcast <text>` | Broadcast to all | `broadcast Hi everyone` |
| `history` | Show message history | `history` |

### Node Management

| Command | Description | Example |
|---------|-------------|---------|
| `alias <name> <id>` | Set node alias | `alias Alice 5HueCG...` |
| `connect <addr>` | Manual connect | `connect 192.168.1.100:8000` |
| `disconnect <name>` | Disconnect | `disconnect Alice` |
| `promote <name>` | Promote to Active | `promote Alice` |
| `demote <name>` | Demote to Known | `demote Alice` |

### Natural Language

You can use natural language instead of commands:

```
send a message to Alice saying hello
show me all the nodes
what's my status
disconnect from Alice
promote Bob to core
```

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

# Run in development mode
npm run dev

# Run CLI tool
npm run cli
```

### Test Coverage

- **Total Tests**: 282 ✅
- **Coverage**: Core modules, utilities, protocol handlers
- **Test Framework**: Jest
- **ESLint**: 0 errors, 35 warnings (unused imports only)

### Project Structure

```
HuiNet-Network-Core/
├── src/
│   ├── HuiNet.ts              # Main HuiNet class
│   ├── crypto/                 # Cryptography (keypair, signing)
│   ├── protocol/               # Message protocol (codec, handshake, heartbeat)
│   ├── routing/                # Routing table
│   ├── transport/              # TCP client/server, connection pool
│   ├── discovery/              # mDNS service
│   ├── types/                  # TypeScript types
│   └── utils/                  # Utilities (network, validation, base58)
├── cli/                        # Command-line interface
├── proxy/                      # HTTP/WebSocket proxy server
├── docs/                       # Documentation
└── specs/                      # Design specifications
```

## Documentation

- [API Reference](docs/api-reference.md) - Complete SDK API documentation
- [Agent Integration Guide](docs/agent-integration.md) - How to integrate HuiNet into your agent
- [Proxy Server Documentation](proxy/README.md) - Proxy server API and configuration

## Use Cases

- **Multi-Agent Systems**: Coordinate multiple AI agents across different machines
- **Home Automation**: Connect smart devices across your home network
- **Team Chat**: Create a private P2P chat network
- **Distributed Computing**: Coordinate tasks across distributed agents
- **Edge Computing**: Enable edge devices to communicate directly

## Troubleshooting

**Q: Nodes not discovering each other?**
- Check both devices are on the same network
- Ensure firewall allows port 8000
- Verify mDNS is enabled (default)
- Try `huinet status` to check network info

**Q: Port already in use?**
```bash
huinet --port 8001
```

**Q: How to reset configuration?**
```bash
rm ~/.huinet/config.json
huinet
```

**Q: Connection fails?**
- Use `huinet status` to check local IP addresses
- Verify target node is running: `huinet connect <host>:<port>`
- Check firewall settings
- Enable debug mode: `DEBUG=* huinet`

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [GitHub Repository](https://github.com/free-revalution/HuiNet-Network-Core)
- [Issues](https://github.com/free-revalution/HuiNet-Network-Core/issues)
- [Discussions](https://github.com/free-revalution/HuiNet-Network-Core/discussions)

---

<div align="center">

[GitHub](https://github.com/free-revalution/HuiNet-Network-Core) • [Issues](https://github.com/free-revalution/HuiNet-Network-Core/issues) • **282 Tests Passing**

</div>
