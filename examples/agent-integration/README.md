# Agent Integration Examples

This directory contains examples for integrating HuiNet with AI Agents.

## Purpose

These examples demonstrate how to use HuiNet as a networking layer for AI agents, enabling:

- Agent-to-agent communication
- Distributed agent networks
- Collaborative AI systems
- Multi-agent coordination

## Examples

This directory will contain:

- Basic agent integration
- Multi-agent communication patterns
- Agent discovery and coordination
- Real-world use cases

## Status

Examples will be added as part of the ongoing HuiNet development. Check back soon for practical demonstrations of agent integration.

## Quick Start (Coming Soon)

```typescript
// Example: Basic agent with HuiNet
import { HuiNetNode } from '../../src/core/HuiNetNode';

class MyAgent {
  private node: HuiNetNode;

  constructor() {
    this.node = new HuiNetNode({
      listenPort: 8000,
      enableMDNS: true
    });
  }

  async start() {
    await this.node.start();
    // Agent logic here
  }
}
```

## Contributing

If you have interesting agent integration examples, please contribute them!
