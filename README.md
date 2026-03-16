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

  [Install](#installation) • [Quick Start](#quick-start) • [Commands](#commands) • [Examples](#examples)

</div>

---

## HuiNet

**HuiNet** is a decentralized P2P networking tool for Agent-to-Agent communication. Connect devices across networks with automatic discovery and encrypted messaging.

## Installation

### Clone and Install (Recommended)

```bash
# Clone repository
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# Install dependencies
npm install

# Build project
npm run build

# Run HuiNet
npm start

# Optional: Create global link to run from anywhere
npm link
# Then you can run: huinet
```

### Quick Start

After installation, from the project directory:

```bash
npm start
```

Or if you created a global link:

```bash
huinet
```

## Quick Start

### Start HuiNet

```bash
huinet
```

You'll see the welcome screen:

```
╔════════════════════════════════════════════════════════════╗
║                    🌐 HuiNet v1.0.0                       ║
╠════════════════════════════════════════════════════════════╣
║  Name: MyAgent                                             ║
║  NodeID: 5HueCGue8dnF7iSBz5sYjXx...                       ║
║  Status: ● Ready                                          ║
╠════════════════════════════════════════════════════════════╣
║  💡 Tips:                                                 ║
║    - Type "help" to see all commands                       ║
║    - Type "ls" to see discovered nodes                     ║
║    - Type "quit" to exit                                   ║
║    - Try natural language: "send hello to Alice"          ║
╚════════════════════════════════════════════════════════════╝

huinet >
```

### Connect Two Devices

**Device A:**
```bash
huinet "Computer A"
huinet > ls
```

**Device B:**
```bash
huinet "Computer B"
huinet > ls
```

Both devices will automatically discover each other on the same network!

### Send Messages

```bash
huinet > msg Computer B Hello!
huinet > send a message to Computer B saying How are you?
```

## Commands

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

## How It Works

```
┌─────────────────┐         ┌─────────────────┐
│   Computer A     │         │   Computer B     │
│   192.168.1.100  │         │   192.168.1.101  │
│   Port: 8000     │ <──────> │   Port: 8000     │
│   mDNS: ON       │   WiFi   │   mDNS: ON       │
└─────────────────┘         └─────────────────┘
        │                           │
        └─────── Auto Discovery ─────┘
```

### Features

- **Auto Discovery**: Automatically finds other HuiNet nodes on your network
- **Encrypted**: Ed25519 public-key cryptography
- **Simple**: No coding required, just type commands
- **Cross-Network**: Works across different networks with bootstrap nodes

## Use Cases

- **Home Automation**: Connect smart devices across your home network
- **Team Chat**: Create a private P2P chat network
- **File Sharing**: Share files directly between devices
- **IoT Coordination**: Coordinate IoT devices without a server

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
