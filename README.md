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
  [![Tests](https://img.shields.io/badge/tests-331%20passed-success)](https://github.com/free-revalution/HuiNet-Network-Core)

  [Usage Guide](docs/USAGE.md) • [API Reference](docs/api-reference.md) • [Examples](docs/examples/)

</div>

---

## HuiNet

**HuiNet** enables AI agents (Claude Code, OpenClaw, CodeX, etc.) to communicate directly across networks through automatic P2P discovery and encrypted messaging.

---

## Features

### Core Networking
- **Auto Discovery**: mDNS for local network discovery
- **P2P Communication**: Direct agent-to-agent messaging
- **Encrypted**: Ed25519 public-key cryptography
- **Cross-Network**: Bootstrap nodes for NAT traversal
- **WebSocket Interface**: For agent integration

### Agent Management
- **One-Command Launch**: `huinet run <agent>`
- **Configuration**: YAML-based agent profiles
- **Network Keys**: Secure network authentication
- **Process Management**: Automatic lifecycle handling

---

## Quick Start

### 1. Installation

```bash
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core
npm install
npm run build
npm link  # Optional
```

### 2. Create Network

```bash
huinet network create MyTeam
# Output: Network Key: a3f7c9e24b1d8x6y...
```

### 3. Configure Agent

```bash
huinet agent add claude-code --command "/usr/local/bin/claude-code"
```

### 4. Start Agent

```bash
huinet run claude-code
```

**On another computer:**

```bash
huinet network join MyTeam <key-from-step-2>
huinet agent add claude-code --command "/usr/local/bin/claude-code"
huinet run claude-code
```

---

## Usage

```bash
# Network management
huinet network create <name>              # Create network
huinet network join <name> <key>         # Join network
huinet network list                       # List networks
huinet network status                     # Show network status

# Agent management
huinet agent add <id> --command <path>     # Add agent
huinet agent list                          # List agents
huinet agent remove <id>                   # Remove agent

# Start agent
huinet run <agent-id>                       # Launch agent

# System check
huinet doctor                               # Check system status
```

See [USAGE.md](docs/USAGE.md) for detailed guide.

---

## Configuration Files

Located in `~/.huinet/`:

**agents.yaml** - Agent configurations:
```yaml
- id: "claude-code"
  name: "Claude Code"
  command: "/usr/local/bin/claude-code"
  args: ["--no-color"]
  workdir: "~/projects"
```

**networks.yaml** - Network configurations:
```yaml
- name: "MyTeam"
  key: "a3f7c9e24b1d8x6y..."
  active: true
  machineId: "machine-abc123..."
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   User Computer A                            │
│  ┌──────────────┐      ┌─────────────────────────────┐   │
│  │ huinet run   │─────►│  HuiNet Daemon              │   │
│  │ claude-code  │      │  - mDNS Discovery           │   │
│  └──────────────┘      │  - P2P Network              │   │
│         │              │  - WebSocket Server         │   │
│         ▼              └─────────────────────────────┘   │
│  ┌──────────────┐                                       │
│  │  Agent       │◄─────── WebSocket / HTTP_PROXY      │
│  │              │                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                         │ P2P Network
                         │
┌─────────────────────────────────────────────────────────────┐
│                   User Computer B                            │
│              (Same architecture)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run CLI
npm run cli

# Lint
npm run lint
```

### Test Coverage
- **Total Tests**: 331 ✅
- **Coverage**: Core modules, protocol, launcher, config
- **Test Framework**: Jest

### Project Structure

```
HuiNet/
├── src/                    # P2P network core
│   ├── crypto/             # Ed25519 cryptography
│   ├── protocol/           # Message protocol
│   ├── routing/            # Three-layer routing table
│   ├── transport/          # TCP client/server, pool
│   ├── discovery/          # mDNS service discovery
│   ├── types/              # TypeScript types
│   └── utils/              # Utilities
├── cli/                    # Command-line interface
│   ├── daemon/             # Agent proxy and router
│   ├── protocol/           # JSON-RPC protocol
│   ├── launcher/           # Agent launcher
│   ├── config/             # Configuration management
│   ├── network/            # Network management
│   └── types/              # CLI types
├── docs/                   # Documentation
└── bin/huinet              # Executable
```

---

## Documentation

- [Usage Guide](docs/USAGE.md) - Complete usage instructions
- [API Reference](docs/api-reference.md) - SDK documentation
- [Agent Integration](docs/agent-integration.md) - Integration guide

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

[GitHub](https://github.com/free-revalution/HuiNet-Network-Core) • [Issues](https://github.com/free-revalution/HuiNet-Network-Core/issues)

**331 Tests Passing**

</div>
