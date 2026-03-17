# Agent Integration Examples

This directory contains examples for integrating HuiNet with AI Agents.

## Purpose

These examples demonstrate how to use HuiNet as a networking layer for AI agents, enabling:

- Agent-to-agent communication
- Distributed agent networks
- Collaborative AI systems
- Multi-agent coordination

## Examples

### 1. Simple Chat Agent (`simple-chat-agent.ts`)

A basic example demonstrating fundamental HuiNet integration for AI agents:

**Features:**
- Agent creation and configuration
- Node lifecycle management (start/stop)
- Basic peer-to-peer messaging
- Event handling (peer connections, messages)
- Message history tracking

**Use Case:** Perfect for understanding the basics of agent-to-agent communication

**Run:**
```bash
# Compile and run the example
npm run build
node dist/examples/agent-integration/simple-chat-agent.js
```

### 2. Event-Driven Agent (`event-driven-agent.ts`)

Advanced example showing reactive programming patterns:

**Features:**
- Event-driven architecture
- Reactive state management
- Custom message handlers and routing
- Reaction rules for network events
- Event logging and statistics
- Role-based agent behavior (coordinator, worker)

**Use Case:** Building agents that react to network state changes and coordinate behavior

**Run:**
```bash
npm run build
node dist/examples/agent-integration/event-driven-agent.js
```

### 3. Multi-Agent System (`multi-agent-system.ts`)

Comprehensive example of distributed multi-agent coordination:

**Features:**
- Orchestrator-worker architecture
- Task distribution and load balancing
- Result aggregation and coordination
- Role-based agent specialization
- System monitoring and observation
- Hierarchical agent organization

**Use Case:** Building complex multi-agent systems with specialized roles

**Architecture:**
- **Orchestrator Agent:** Coordinates tasks and distributes work
- **Worker Agents:** Process assigned tasks and return results
- **Monitor Agent:** Observes system behavior and logs events

**Run:**
```bash
npm run build
node dist/examples/agent-integration/multi-agent-system.js
```

## Key Concepts Demonstrated

All examples showcase essential HuiNet features:

- **Node Management:** Creating, starting, and stopping HuiNet nodes
- **Peer Discovery:** Automatic peer discovery via mDNS
- **Message Passing:** Direct peer-to-peer communication
- **Event Handling:** Reacting to network events (connections, disconnections, messages)
- **State Management:** Tracking agent state and network conditions
- **Error Handling:** Robust error handling and reconnection logic
- **TypeScript Support:** Full type safety and IDE support

## Quick Start

Get started with any example:

```bash
# Build the project
npm run build

# Run any example (choose one)
node dist/examples/agent-integration/simple-chat-agent.js
node dist/examples/agent-integration/event-driven-agent.js
node dist/examples/agent-integration/multi-agent-system.js
```

## Usage Patterns

### Basic Agent Setup

```typescript
import { HuiNet, HuiNetConfig } from '../../src/HuiNet';

class MyAgent {
  private node: HuiNet;

  constructor(config: HuiNetConfig = {}) {
    this.node = new HuiNet({
      listenPort: config.listenPort || 8000,
      listenHost: config.listenHost || '0.0.0.0',
      enableMDNS: config.enableMDNS !== false,
      bootstrapNodes: config.bootstrapNodes || [],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.node.on('ready', () => {
      console.log('Agent is ready!');
    });

    this.node.on('message', (from, message) => {
      console.log(`Received from ${from}:`, message);
    });
  }

  async start(): Promise<void> {
    await this.node.start();
  }

  async stop(): Promise<void> {
    await this.node.stop();
  }
}
```

### Advanced: Multi-Agent Coordination

```typescript
// Create orchestrator
const orchestrator = new OrchestratorAgent('Orchestrator', {
  listenPort: 9001,
  enableMDNS: true,
});

// Create workers
const workers = [
  new WorkerAgent('Worker-1', {
    listenPort: 9002,
    bootstrapNodes: ['127.0.0.1:9001'],
  }),
  new WorkerAgent('Worker-2', {
    listenPort: 9003,
    bootstrapNodes: ['127.0.0.1:9001'],
  }),
];

// Start all agents
await orchestrator.start();
await Promise.all(workers.map(w => w.start()));

// Submit tasks
await orchestrator.createTask('data_processing', { data: [1, 2, 3] });
```

## Best Practices

1. **Port Management:** Use different ports for each agent in local testing
2. **Bootstrap Nodes:** Always provide bootstrap nodes for initial network connection
3. **Error Handling:** Always handle connection failures and message errors
4. **Event Cleanup:** Remove event listeners when stopping agents
5. **State Management:** Keep track of connected peers and message history
6. **Type Safety:** Leverage TypeScript for type-safe message handling

## Real-World Applications

These examples can be extended for:

- **Distributed AI Systems:** Multi-agent AI collaboration
- **Edge Computing:** Coordinated edge device networks
- **IoT Networks:** Smart device communication and coordination
- **Microservices:** Service-to-service communication
- **P2P Applications:** Decentralized application networks
- **Research Simulations:** Multi-agent system research

## Contributing
