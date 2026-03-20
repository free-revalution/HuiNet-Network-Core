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

  [Quick Start](#quick-start) • [Usage](#usage) • [Examples](#examples) • [API](docs/api-reference.md)

</div>

---

## HuiNet

**HuiNet** is a decentralized P2P networking library that enables AI agents (Claude Code, OpenClaw, CodeX, etc.) to communicate directly across different computers and networks through automatic discovery and encrypted messaging.

### Key Features

- 🌐 **Cross-Network Communication**: Agents on different computers can communicate seamlessly
- 🔒 **Encrypted**: Ed25519 public-key cryptography for secure messaging
- 🔍 **Auto Discovery**: mDNS-based local network discovery
- 🚀 **One-Command Launch**: Simple `huinet run <agent>` to start agents
- 📡 **Network Keys**: Secure network authentication for trusted agent groups

---

## Quick Start

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# Install dependencies
npm install

# Build the project
npm run build

# (Optional) Create global symlink for easy access
npm link
```

### Basic Usage

```bash
# 1. Create a network for your agents
huinet network create MyTeam
# Output: Network Key: a3f7c9e24b1d8x6y...

# 2. Configure an agent
huinet agent add claude-code --command "/usr/local/bin/claude-code"

# 3. Start the agent
huinet run claude-code
```

**On another computer, join the same network:**

```bash
huinet network join MyTeam a3f7c9e24b1d8x6y...
huinet agent add claude-code --command "/usr/local/bin/claude-code"
huinet run claude-code
```

---

## Usage

### Network Management

HuiNet uses network keys to authenticate and secure agent communication.

```bash
# Create a new network
huinet network create <network-name>
# Generates a 32-character hex key for authentication

# Join an existing network
huinet network join <network-name> <network-key>

# List all configured networks
huinet network list

# Show active network status
huinet network status
```

### Agent Configuration

Configure agents with custom commands, arguments, and working directories.

```bash
# Add an agent
huinet agent add <agent-id> --command <path> [options]

# Options:
#   --name <display-name>     Friendly name for the agent
#   --args <arg1,arg2>        Command arguments (comma-separated)
#   --workdir <path>          Working directory

# Examples:
huinet agent add claude-code --command "/usr/local/bin/claude-code"
huinet agent add openclaw --command "/opt/openclaw/openclaw" --args "--debug"
huinet agent add custom-agent --command "/usr/bin/node" --args "server.js" --workdir "~/myapp"

# List all configured agents
huinet agent list

# Remove an agent
huinet agent remove <agent-id>
```

### Starting Agents

```bash
# Start an agent
huinet run <agent-id>

# With custom working directory
huinet run <agent-id> --workdir /path/to/project

# The agent will have these environment variables set:
#   HUINET_AGENT_ID=<agent-id>
#   HUINET_NODE_ID=<your-node-id>
#   HUINET_WS_URL=ws://127.0.0.1:<allocated-port>
#   HTTP_PROXY=http://127.0.0.1:<allocated-port>
#   HTTPS_PROXY=http://127.0.0.1:<allocated-port>
```

### System Utilities

```bash
# Check system status and configuration
huinet doctor
```

---

## Testing

### Quick Test (Single Machine)

Test HuiNet with a simple echo server:

```bash
# 1. Create network
huinet network create TestNetwork

# 2. Create a simple test agent
huinet agent add echo-server \
  --command "node" \
  --args "-e,require('http').createServer((req,res)=>res.end('Hello from '+req.url).listen(8081)"

# 3. Start the agent
huinet run echo-server
```

In another terminal:

```bash
# Create another agent
huinet agent add echo-client \
  --command "curl" \
  --args "http://localhost:8081/test"

huinet run echo-client
```

### Local Network Test (Two Computers)

Test agent communication across two computers on the same network.

#### Computer A

```bash
# Create network
huinet network create LocalTest
# Note the network key that is generated

# Configure and start agent
huinet agent add agent-a --command "node" --args "-e,console.log('Agent A running')"
huinet run agent-a
```

#### Computer B

```bash
# Join the network (use the key from Computer A)
huinet network join LocalTest <network-key-from-A>

# Configure and start agent
huinet agent add agent-b --command "node" --args "-e,console.log('Agent B running')"
huinet run agent-b
```

### Cross-Network Test (Different Locations)

For testing across different networks (e.g., home and office):

1. **Set up a bootstrap node** (optional, for NAT traversal):
   - Deploy HuiNet on a publicly accessible server
   - Configure both agents to use it as bootstrap

2. **Create the same network on both sides**:
   ```bash
   # Both computers run:
   huinet network create GlobalNet
   # Note: Both will generate different keys initially
   # Manually edit ~/.huinet/networks.yaml to use the same key
   ```

3. **Start agents**:
   ```bash
   huinet run <agent-id>
   ```

### Testing with Real Agents

#### Claude Code

```bash
# Add Claude Code to HuiNet
huinet agent add claude-code \
  --command "/usr/local/bin/claude-code" \
  --workdir "~/projects"

# Create network
huinet network create ClaudeNetwork

# Start Claude Code with HuiNet
huinet run claude-code
```

#### OpenClaw (or other CLI-based agents)

```bash
huinet agent add openclaw \
  --command "/path/to/openclaw" \
  --args "--interactive"

huinet network create MyNetwork
huinet run openclaw
```

#### Custom Node.js Scripts

Create a test agent script:

```javascript
// my-agent.js
const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Received request:', req.method, req.url);

  // You can use HuiNet's WebSocket API here
  // to send messages to other agents

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'OK from my-agent' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Agent running on port ${PORT}`);
});
```

Then configure and start:

```bash
huinet agent add my-agent --command "node" --args "my-agent.js"
huinet network create TestNet
huinet run my-agent
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Computer A                          │
│                                                             │
│   $ huinet run claude-code                                  │
│          │                                                  │
│          ▼                                                  │
│   ┌──────────────────────────────────────────────────────┐  │
│   │         HuiNet Launcher                              │  │
│   │  1. Read agent config from ~/.huinet/agents.yaml     │  │
│   │  2. Load network config from ~/.huinet/networks.yaml │  │
│   │  3. Start HuiNet Daemon (P2P + WebSocket Server)     │  │
│   │  4. Allocate WebSocket port for agent                │  │
│   │  5. Set environment variables                        │  │
│   │  6. Spawn agent process                              │  │
│   └──────────────────────────────────────────────────────┘  │
│          │                                                  │
│          │ spawn                                            │
│          ▼                                                  │
│   ┌──────────────────────────────────────────────────────┐  │
│   │           Agent Process                              │  │
│   │  - HUINET_AGENT_ID=claude-code-alice                 │  │
│   │  - HUINET_WS_URL=ws://127.0.0.1:8081                 │  │
│   │  - HTTP_PROXY=http://127.0.0.1:8081                  │  │
│   │  - Connects to HuiNet via WebSocket                  │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │           HuiNet Daemon                              │  │
│   │                                                      │  │
│   │  ┌────────────┐  ┌───────────────┐  ┌───────────┐    │  │
│   │  │ mDNS       │  │ P2P Network   │  │ Router    │    │  │
│   │  │ Discovery  │  │ (TCP 8000)    │  │           │    │  │
│   │  └────────────┘  └───────────────┘  └───────────┘    │  │
│   │                                                      │  │
│   │  ┌───────────────────────────────────────────────┐   │  │
│   │  │  WebSocket Server (ws://127.0.0.1:8080)       │   │  │
│   │  └───────────────────────────────────────────────┘   │  │
│   └──────────────────────────────────────────────────────┘  │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │ P2P Network (TCP 8000)
                           │
┌──────────────────────────┼───────────────────────────────┐
│                          │                               │
│   ┌──────────────────────────────────────────────────┐   │
│   │            User Computer B                       │   │
│   │         (Same architecture)                      │   │
│   │                                                  │   │
│   │   $ huinet run claude-code                       │   │
│   └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Configuration Files

Configuration files are stored in `~/.huinet/`:

### ~/.huinet/agents.yaml

Agent configurations with commands, arguments, and working directories:

```yaml
# HuiNet Agent Configuration
# Edit this file to add or modify agents

- id: "claude-code"
  name: "Claude Code"
  command: "/usr/local/bin/claude-code"
  args: ["--no-color"]
  workdir: "/home/user/projects"

- id: "openclaw"
  name: "OpenClaw"
  command: "/opt/openclaw/openclaw"
  workdir: "/home/user/projects"

- id: "test-server"
  name: "Test Server"
  command: "node"
  args: ["-e", "require('http').createServer(...)"]
  workdir: "/home/user/test"
```

### ~/.huinet/networks.yaml

Network configurations with authentication keys:

```yaml
# HuiNet Network Configuration
# Networks are used for agent authentication

- name: "MyTeam"
  key: "a3f7c9e24b1d8x6y1234abcd567890ef1234abcd"
  active: true
  machineId: "machine-abc123def456"

- name: "OfficeNetwork"
  key: "9876543210fedcba09876543210fedcba"
  active: false
  machineId: "machine-xyz789abc123"
```

---

## Command Reference

### Global Options

```bash
huinet [command] [options]
```

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `network create <name>` | Create a new network | `huinet network create MyTeam` |
| `network join <name> <key>` | Join existing network | `huinet network join MyTeam <key>` |
| `network list` | List all networks | `huinet network list` |
| `network status` | Show network status | `huinet network status` |
| `agent add <id> --command <path>` | Add agent | `huinet agent add claude-code --command "/bin/claude"` |
| `agent list` | List all agents | `huinet agent list` |
| `agent remove <id>` | Remove agent | `huinet agent remove claude-code` |
| `run <agent-id>` | Start agent | `huinet run claude-code` |
| `doctor` | System health check | `huinet doctor` |

---

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testPathPattern="cli/"
npm test -- --testPathPattern="src/"
```

### Building

```bash
# Build the project
npm run build

# Build CLI only
npm run build:cli
```

### Linting

```bash
# Run ESLint
npm run lint
```

### Project Structure

```
HuiNet-Network-Core/
├── src/                          # P2P networking core
│   ├── crypto/                   # Ed25519 cryptography
│   ├── protocol/                 # Message protocol (codec, handshake, heartbeat)
│   ├── routing/                  # Three-layer routing table
│   ├── transport/                # TCP client/server, connection pool
│   ├── discovery/                # mDNS service discovery
│   ├── types/                    # TypeScript types
│   └── utils/                    # Network utilities
├── cli/                          # Command-line interface
│   ├── daemon/                   # Agent proxy and router
│   ├── protocol/                 # JSON-RPC protocol handler
│   ├── launcher/                 # Agent launcher
│   ├── config/                   # Configuration management
│   ├── network/                  # Network management
│   └── types/                    # CLI types
├── docs/                         # Documentation
├── bin/                          # Executable (huinet)
├── tests/                        # Test files
└── specs/                        # Design specifications
```

---

## How It Works

### 1. Network Discovery

HuiNet uses mDNS (Multicast DNS) to automatically discover other HuiNet nodes on the local network. When an agent starts:

1. It announces itself via mDNS
2. Other nodes on the network detect the announcement
3. P2P connections are established automatically

### 2. Cross-Network Communication

For agents on different networks (e.g., home and office):

1. Both agents join the same network (using the same network key)
2. HuiNet uses bootstrap nodes or direct IP connections
3. Messages are routed through the P2P network

### 3. Agent Communication

Agents communicate through:

1. **WebSocket Interface**: Each agent gets a dedicated WebSocket port
2. **HTTP Proxy**: The agent's HTTP requests are proxied through HuiNet
3. **Message Routing**: Messages are routed based on destination agent ID

### 4. Security

- **Network Keys**: 32-character hex keys for network authentication
- **Ed25519**: All P2P messages are signed and verified
- **Machine IDs**: Unique identifiers for each machine

---

## Troubleshooting

### Agents Not Discovering Each Other

**Problem**: Agents on the same network can't find each other.

**Solutions**:
1. Check both agents are on the same network:
   ```bash
   huinet network status
   ```

2. Verify mDNS is working:
   ```bash
   # On macOS: Check if Bonjour is running
   # On Linux: Check if avahi-daemon is running
   ```

3. Check firewall settings:
   - Allow UDP port 5353 (mDNS)
   - Allow TCP port 8000 (P2P)

4. Verify network configuration:
   ```bash
   huinet doctor
   ```

### Connection Failures

**Problem**: Agent fails to start or connect.

**Solutions**:

1. Check agent configuration:
   ```bash
   huinet agent list
   ```

2. Verify the agent command path:
   ```bash
   # Test if the command works
   /usr/local/bin/claude-code --version
   ```

3. Check port availability:
   ```bash
   # Check if ports are in use
   lsof -i :8000
   lsof -i :8080
   ```

4. Enable debug logging:
   ```bash
   DEBUG=* huinet run <agent-id>
   ```

### Network Key Issues

**Problem**: Can't join a network or network key format error.

**Solutions**:

1. Verify key format (should be 32 hex characters):
   ```bash
   # Valid: a3f7c9e24b1d8x6y1234abcd567890ef1234abcd
   # Invalid: abc123 (too short)
   ```

2. Re-create network key:
   ```bash
   # Remove old network
   huinet network remove <network-name>

   # Create new network
   huinet network create <network-name>
   ```

### Port Conflicts

**Problem**: Port already in use error.

**Solutions**:

1. Kill process using the port:
   ```bash
   # Find and kill process on port 8000
   lsof -ti:8000 | xargs kill -9
   ```

2. Use a different port:
   ```bash
   # Modify daemon configuration in ~/.huinet/config.yaml
   ```

---

## Advanced Usage

### Custom Network Configuration

You can manually edit `~/.huinet/networks.yaml`:

```yaml
- name: "Production"
  key: "your-production-key-here"
  active: true
  machineId: "server-1"
```

### Multiple Networks

Configure multiple networks and switch between them:

```bash
# Create multiple networks
huinet network create Development
huinet network create Staging
huinet network create Production

# List networks
huinet network list

# Manually edit ~/.huinet/networks.yaml to set active: true
# on your desired network
```

### Bootstrap Nodes

For cross-network communication, configure bootstrap nodes in `~/.huinet/networks.yaml`:

```yaml
- name: "Global"
  key: "global-network-key"
  active: true
  bootstrapNodes: ["your-server.com:8000"]
```

---

## Related Projects

HuiNet was inspired by existing P2P networking and agent communication solutions. While we solve similar problems, HuiNet focuses on simplicity and ease of use for AI agents:

### P2P Networking Libraries
- **[libp2p](https://github.com/libp2p/js-libp2p)** - A modular P2P network stack that provides production-ready implementations
- **[IPFS](https://github.com/ipfs/ipfs)** - InterPlanetary File System, a peer-to-peer distributed file system

### Agent Communication
- **[p2p-agent-chat](https://github.com/Foadsf/p2p-agent-chat)** - Decentralized P2P communication tool for AI agents (Python)
- **[Agent2Agent (A2A)](https://github.com/a2aproject/A2A)** - Open protocol enabling AI agents to communicate across frameworks
- **[OpenAgents](https://github.com/openagents-org/openagents)** - Open network for AI agents to discover and collaborate
- **[ACP Protocol](https://github.com/i-am-bee/acp)** - Open protocol for communication between AI agents

### What Makes HuiNet Different
- **Simplicity**: Focus on ease of use with a simple CLI
- **Claude Code Integration**: Designed specifically for Claude Code and similar AI tools
- **Learning Project**: Built as an educational project to understand distributed systems
- **Lightweight**: Minimal dependencies and straightforward architecture

> **Note**: HuiNet is a learning project and not intended for production use. For production P2P applications, consider using mature libraries like libp2p.

---

## Acknowledgments

HuiNet was developed with AI-assisted coding using [Claude Code](https://claude.ai/code). The project serves as a learning experience in distributed systems and P2P networking.

Special thanks to the authors of:
- [multicast-dns](https://github.com/mafintosh/multicast-dns) - mDNS implementation
- [tweetnacl](https://github.com/dchest/tweetnacl-js) - Ed25519 cryptography library
- [ws](https://github.com/websockets/ws) - WebSocket library

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Links

- [GitHub Repository](https://github.com/free-revalution/HuiNet-Network-Core)
- [Issues](https://github.com/free-revalution/HuiNet-Network-Core/issues)
- [Discussions](https://github.com/free-revalution/HuiNet-Network-Core/discussions)

---

<div align="center">

**331 Tests Passing** • **Open Source** • **MIT License**

</div>
