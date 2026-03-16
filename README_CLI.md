# HuiNet - Quick Start Guide

HuiNet is a decentralized P2P networking library for Agent-to-Agent communication.

## Installation

```bash
# Clone repository
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# Install dependencies
npm install

# Build project
npm run build
```

## Using the CLI Tool

### Start Interactive CLI

```bash
# Using npm script
npm start

# Or directly with node
node dist/cli/index.js

# Or use ts-node for development
npm run dev
```

### CLI Commands

Once inside the CLI:

```
huinet > help              # Show all commands
huinet > status            # Show node status
huinet > ls                # List discovered nodes
huinet > msg Alice Hello   # Send message to node
huinet > quit              # Exit
```

### Natural Language Support

```
huinet > send a message to Alice saying hello
huinet > show me all nodes
huinet > what's my status
```

### Command-Line Options

```bash
# Specify name and port
npm start -- "My Computer" --port 8001

# Disable mDNS (for cross-internet)
npm start -- --no-mdns --bootstrap "server.com:9000"
```

## Programmatic Usage

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

// Send message
await huinet.send(targetNodeID, {
  type: 'chat',
  text: 'Hello!'
});
```

## Project Structure

```
HuiNet-Network-Core/
├── src/              # Core library (HuiNet class)
├── cli/              # CLI tool (command-line interface)
├── examples/         # Usage examples
├── dist/             # Compiled JavaScript
└── bin/huinet        # CLI entry point
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Configuration

CLI configuration is stored in `~/.huinet/config.json`:

```json
{
  "name": "MyAgent",
  "aliases": {
    "Alice": "5HueCGue8dn..."
  },
  "messageHistory": [...]
}
```

## License

MIT

---

**Documentation:** [README.md](README.md) | [USAGE.md](USAGE.md)
