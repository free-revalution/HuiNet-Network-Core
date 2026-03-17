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

  [Install](#installation) • [Quick Start](#quick-start) • [Agent Integration](#agent-integration) • [CLI](#cli-commands)

</div>

---

## HuiNet

**HuiNet** is a decentralized P2P networking library for Agent-to-Agent (A2A) communication. It enables AI agents to discover each other and communicate directly across networks with automatic discovery and encrypted messaging.

## Features

- **Auto Discovery**: Automatically finds other HuiNet nodes via mDNS
- **P2P Communication**: Direct agent-to-agent messaging without central servers
- **Encrypted**: Ed25519 public-key cryptography for secure communication
- **Cross-Network**: Works across different networks with bootstrap nodes
- **Agent Integration**: Proxy server for easy integration with Claude Code, CodeX, OpenClaw, etc.

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
```

### Using the SDK

```typescript
import { HuiNet } from '@huinet/network';

const huinet = new HuiNet({
  listenPort: 8000,
  enableMDNS: true
});

await huinet.start();

// Send message to another node
await huinet.send(targetNodeID, { data: 'Hello World' });

// Listen for incoming messages
huinet.on('message', (fromNodeID, message) => {
  console.log(`Received from ${fromNodeID}:`, message);
});
```

## Agent Integration

### HuiNet Proxy Server (Coming Soon)

The proxy server enables existing AI agents to communicate via the HuiNet P2P network without code modifications.

**Architecture:**
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

**API Preview:**
```typescript
// Start proxy server
import { HuiNetProxy } from '@huinet/proxy';

const proxy = new HuiNetProxy({
  apiKey: process.env.HUINET_API_KEY,
  httpPort: 3000,
  wsPort: 3001
});
await proxy.start();

// Agent sends message via HTTP
POST /api/send
Headers: X-API-Key: xxx
Body: { "to": "targetNodeID", "data": { "message": "Hello" } }

// Agent receives via WebSocket
ws://localhost:3001?apiKey=xxx
// Message push: { "type": "message", "from": "nodeID", "data": {...} }
```

**Status:** 🚧 Under Development

See [`specs/proxy-server-design.md`](specs/proxy-server-design.md) for the complete design document.

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

### Natural Language

You can use natural language instead of commands:

```
send a message to Alice saying hello
show me all the nodes
what's my status
disconnect from Alice
```

## Options

```bash
huinet [name] [options]

Options:
  -p, --port <number>      Listen port (default: 8000)
  -h, --host <address>     Listen address (default: 0.0.0.0)
  --no-mdns                Disable mDNS discovery
  -b, --bootstrap <addr>   Bootstrap node address
```

**Examples:**

```bash
# Custom name and port
huinet "My Computer" --port 8001

# Cross-internet (disable mDNS)
huinet --no-mdns --bootstrap "server.com:9000"

# Specify host
huinet --host 192.168.1.100
```

## Configuration

Configuration is stored in `~/.huinet/config.json`:

```json
{
  "name": "MyAgent",
  "aliases": {
    "Alice": "5HueCGue8dnF7iSBz5sYjXxMxq9"
  },
  "messageHistory": [...]
}
```

## Architecture

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
```

## Documentation

- [API Reference](docs/api-reference.md) - Complete SDK API documentation
- [Agent Integration Guide](docs/agent-integration.md) - How to integrate HuiNet into your agent
- [Proxy Server Design](specs/proxy-server-design.md) - Proxy server architecture and implementation plan
- [Contributing Guidelines](CONTRIBUTING.md)

## Use Cases

- **Multi-Agent Systems**: Coordinate multiple AI agents across different machines
- **Home Automation**: Connect smart devices across your home network
- **Team Chat**: Create a private P2P chat network
- **Distributed Computing**: Coordinate tasks across distributed agents

## Troubleshooting

**Q: Nodes not discovering each other?**
- Check both devices are on the same network
- Ensure firewall allows port 8000
- Verify mDNS is enabled (default)

**Q: Port already in use?**
```bash
huinet --port 8001
```

**Q: How to reset configuration?**
```bash
huinet reset --force
```

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

**Built with ❤️ for the decentralized future**

[GitHub](https://github.com/free-revalution/HuiNet-Network-Core) • [Issues](https://github.com/free-revalution/HuiNet-Network-Core/issues)

</div>
