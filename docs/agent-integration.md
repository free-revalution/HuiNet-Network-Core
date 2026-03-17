# HuiNet Agent Integration Guide

A comprehensive guide for integrating HuiNet with your AI Agents for decentralized P2P communication.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Basic Concepts](#basic-concepts)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

---

## Overview

HuiNet is a decentralized networking library designed specifically for Agent-to-Agent (A2A) communication. It enables AI Agents to discover, connect, and communicate with each other without centralized servers.

### Key Features

- **Decentralized P2P Architecture**: No central servers required
- **Automatic Peer Discovery**: mDNS-based local network discovery
- **Secure Communication**: Built-in cryptographic authentication
- **Flexible Messaging**: JSON-based message protocol
- **Connection Management**: Automatic reconnection and pooling
- **TypeScript Support**: Full type definitions included

### Use Cases

- Multi-agent collaboration systems
- Distributed AI agent networks
- Local agent clusters
- Agent swarms and collectives
- Peer-to-peer agent marketplaces

---

## Installation

### NPM

```bash
npm install @huinet/network
```

### Yarn

```bash
yarn add @huinet/network
```

### pnpm

```bash
pnpm add @huinet/network
```

### Development Installation

```bash
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core
npm install
npm run build
```

---

## Quick Start

### Minimal Example

Create a simple agent that can send and receive messages:

```typescript
import { HuiNet } from '@huinet/network';

// Create and configure your agent
const agent = new HuiNet({
  listenPort: 8000,
  enableMDNS: true
});

// Listen for incoming messages
agent.on('message', (from, data) => {
  console.log(`Received from ${from}:`, data);
});

// Start the agent
await agent.start();
console.log('Agent ready! NodeID:', agent.getNodeID());

// Send a message to another agent
await agent.send(targetNodeID, {
  type: 'greeting',
  text: 'Hello, Agent!'
});
```

### Complete Working Example

```typescript
import { HuiNet, HuiNetConfig } from '@huinet/network';

interface AgentMessage {
  type: string;
  sender: string;
  text: string;
  timestamp: number;
}

class MyAgent {
  private node: HuiNet;
  private name: string;

  constructor(name: string, port: number) {
    this.name = name;

    const config: HuiNetConfig = {
      listenPort: port,
      enableMDNS: true,
      maxCoreConnections: 10,
      maxActiveConnections: 50
    };

    this.node = new HuiNet(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.node.on('ready', () => {
      console.log(`${this.name} is ready!`);
      console.log(`NodeID: ${this.node.getNodeID()}`);
    });

    this.node.on('message', (from, data: AgentMessage) => {
      console.log(`${this.name} received from ${from}: ${data.text}`);
      this.handleMessage(from, data);
    });

    this.node.on('peerConnected', (nodeID) => {
      console.log(`${this.name} connected to ${nodeID}`);
    });

    this.node.on('nodeDiscovered', (node) => {
      console.log(`${this.name} discovered ${node.nodeId}`);
    });
  }

  private async handleMessage(from: string, data: AgentMessage): Promise<void> {
    // Handle different message types
    switch (data.type) {
      case 'greeting':
        await this.sendGreeting(from, `Hello back from ${this.name}!`);
        break;
      case 'request':
        await this.handleRequest(from, data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  private async sendGreeting(to: string, text: string): Promise<void> {
    await this.node.send(to, {
      type: 'greeting',
      sender: this.name,
      text,
      timestamp: Date.now()
    });
  }

  private async handleRequest(from: string, data: AgentMessage): Promise<void> {
    // Process request and send response
    const response = {
      type: 'response',
      sender: this.name,
      text: `Processed your request: ${data.text}`,
      timestamp: Date.now()
    };
    await this.node.send(from, response);
  }

  async start(): Promise<void> {
    await this.node.start();
  }

  async stop(): Promise<void> {
    await this.node.stop();
  }

  getNodeID(): string {
    return this.node.getNodeID();
  }
}

// Usage
async function main() {
  const agent1 = new MyAgent('Agent-1', 8000);
  const agent2 = new MyAgent('Agent-2', 8001);

  await agent1.start();
  await agent2.start();

  // Wait for agents to discover each other
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send a message
  await agent2['sendGreeting'](agent1.getNodeID(), 'Hello from Agent-2!');

  // Keep running
  process.on('SIGINT', async () => {
    await agent1.stop();
    await agent2.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

---

## Basic Concepts

### Node Identity

Each agent in the HuiNet network has a unique identity based on cryptographic keys:

```typescript
import { generateKeyPair, deriveNodeID } from '@huinet/network';

// Generate a new key pair
const keyPair = generateKeyPair();

// Derive NodeID from public key
const nodeID = deriveNodeID(keyPair.publicKey);

// Use custom key pair for persistent identity
const agent = new HuiNet({
  keyPair: keyPair,
  listenPort: 8000
});

console.log('Agent NodeID:', agent.getNodeID());
```

### Network Discovery

HuiNet uses mDNS for automatic peer discovery on local networks:

```typescript
const agent = new HuiNet({
  enableMDNS: true  // Enabled by default
});

agent.on('nodeDiscovered', (node) => {
  console.log(`Discovered: ${node.nodeId} at ${node.address}`);

  // Automatically connect to discovered nodes
  const [host, port] = node.address.split(':');
  agent.connectToNode(host, parseInt(port));
});

await agent.start();
```

### Manual Connection

Connect to specific nodes by address:

```typescript
// Connect to a known node
const success = await agent.connectToNode('192.168.1.100', 8000);

if (success) {
  console.log('Connected successfully');
} else {
  console.log('Connection failed');
}
```

### Bootstrap Nodes

Configure bootstrap nodes for network initialization:

```typescript
const agent = new HuiNet({
  bootstrapNodes: [
    '192.168.1.100:8000',
    'example.com:9000',
    'node.example.org:8000'
  ]
});

// Agent will automatically connect to bootstrap nodes on startup
await agent.start();
```

---

## Common Patterns

### Request-Response Pattern

Implement request-response communication:

```typescript
class RequestResponseAgent {
  private node: HuiNet;
  private pendingRequests: Map<string, any>;

  constructor() {
    this.node = new HuiNet({ listenPort: 8000 });
    this.pendingRequests = new Map();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.node.on('message', async (from, data) => {
      if (data.type === 'request') {
        // Handle incoming request
        const response = await this.processRequest(data.payload);
        await this.node.send(from, {
          type: 'response',
          requestId: data.requestId,
          payload: response
        });
      } else if (data.type === 'response') {
        // Handle incoming response
        const resolver = this.pendingRequests.get(data.requestId);
        if (resolver) {
          resolver(data.payload);
          this.pendingRequests.delete(data.requestId);
        }
      }
    });
  }

  async sendRequest(to: string, payload: any): Promise<any> {
    const requestId = generateId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.node.send(to, {
        type: 'request',
        requestId,
        payload
      });

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ error: 'Request timeout' });
        }
      }, 5000);
    });
  }

  private async processRequest(payload: any): Promise<any> {
    // Process request and return response
    return { result: 'processed', data: payload };
  }

  async start(): Promise<void> {
    await this.node.start();
  }
}
```

### Broadcast Pattern

Send messages to multiple nodes:

```typescript
class BroadcastAgent {
  private node: HuiNet;

  constructor() {
    this.node = new HuiNet({ listenPort: 8000 });
  }

  async broadcast(message: any): Promise<void> {
    const routingTable = this.node.getRoutingTable();
    const knownNodes = routingTable.getAllKnownNodes();

    for (const node of knownNodes) {
      if (node.state === 'ONLINE') {
        try {
          await this.node.send(node.nodeID, message);
        } catch (error) {
          console.error(`Failed to send to ${node.nodeID}:`, error);
        }
      }
    }
  }

  async start(): Promise<void> {
    await this.node.start();
  }
}
```

### Event-Driven Architecture

Build event-driven agent systems:

```typescript
class EventDrivenAgent {
  private node: HuiNet;
  private eventHandlers: Map<string, Function[]>;

  constructor() {
    this.node = new HuiNet({ listenPort: 8000 });
    this.eventHandlers = new Map();
    this.setupEventHandlers();
  }

  on(eventName: string, handler: Function): void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(handler);
  }

  private async emit(eventName: string, data: any): Promise<void> {
    const handlers = this.eventHandlers.get(eventName) || [];
    for (const handler of handlers) {
      await handler(data);
    }
  }

  private setupEventHandlers(): void {
    this.node.on('message', async (from, data) => {
      if (data.type === 'event') {
        await this.emit(data.eventName, {
          ...data.payload,
          from
        });
      }
    });
  }

  async sendEvent(to: string, eventName: string, payload: any): Promise<void> {
    await this.node.send(to, {
      type: 'event',
      eventName,
      payload
    });
  }

  async start(): Promise<void> {
    await this.node.start();
  }
}

// Usage
const agent = new EventDrivenAgent();
await agent.start();

agent.on('task-completed', (data) => {
  console.log('Task completed by', data.from);
});

await agent.sendEvent(targetNodeID, 'task-completed', {
  taskId: '123',
  result: 'success'
});
```

### State Synchronization

Keep agent state synchronized across the network:

```typescript
class StateSyncAgent {
  private node: HuiNet;
  private state: any;
  private stateVersion: number = 0;

  constructor(initialState: any) {
    this.state = initialState;
    this.node = new HuiNet({ listenPort: 8000 });
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.node.on('message', async (from, data) => {
      if (data.type === 'state-sync') {
        await this.handleStateSync(from, data);
      } else if (data.type === 'state-request') {
        await this.sendState(from);
      }
    });
  }

  private async handleStateSync(from: string, data: any): Promise<void> {
    if (data.version > this.stateVersion) {
      this.state = data.state;
      this.stateVersion = data.version;
      console.log('State updated from', from);

      // Propagate to other nodes
      await this.broadcastState();
    }
  }

  private async sendState(to: string): Promise<void> {
    await this.node.send(to, {
      type: 'state-sync',
      state: this.state,
      version: this.stateVersion
    });
  }

  async updateState(newState: any): Promise<void> {
    this.state = { ...this.state, ...newState };
    this.stateVersion++;
    await this.broadcastState();
  }

  private async broadcastState(): Promise<void> {
    const routingTable = this.node.getRoutingTable();
    const knownNodes = routingTable.getAllKnownNodes();

    for (const node of knownNodes) {
      if (node.nodeID !== this.node.getNodeID()) {
        try {
          await this.node.send(node.nodeID, {
            type: 'state-sync',
            state: this.state,
            version: this.stateVersion
          });
        } catch (error) {
          console.error('Failed to sync state:', error);
        }
      }
    }
  }

  async start(): Promise<void> {
    await this.node.start();
  }

  getState(): any {
    return this.state;
  }
}
```

---

## Best Practices

### 1. Error Handling

Always implement proper error handling:

```typescript
agent.on('error', (error) => {
  console.error('Agent error:', error);

  // Implement error recovery
  if (error.message.includes('Unknown node')) {
    // Handle unknown node error
  }
});

// Wrap sends in try-catch
try {
  await agent.send(targetNodeID, message);
} catch (error) {
  console.error('Send failed:', error);
  // Implement retry logic or fallback
}
```

### 2. Connection Management

Monitor and manage connections:

```typescript
agent.on('peerConnected', (nodeID) => {
  console.log('Connected:', nodeID);

  // Perform connection-specific initialization
  sendWelcomeMessage(nodeID);
});

agent.on('peerDisconnected', (nodeID) => {
  console.log('Disconnected:', nodeID);

  // Implement reconnection logic
  setTimeout(async () => {
    const routingTable = agent.getRoutingTable();
    const node = routingTable.getKnownNode(nodeID);

    if (node && node.addresses.length > 0) {
      const addr = node.addresses[0];
      await agent.connectToNode(addr.host, addr.port, nodeID);
    }
  }, 5000);
});
```

### 3. Message Validation

Validate incoming messages:

```typescript
interface ValidatedMessage {
  type: string;
  timestamp: number;
  payload: any;
}

function isValidMessage(data: any): data is ValidatedMessage {
  return (
    typeof data === 'object' &&
    typeof data.type === 'string' &&
    typeof data.timestamp === 'number' &&
    data.payload !== undefined
  );
}

agent.on('message', (from, data) => {
  if (!isValidMessage(data)) {
    console.warn('Invalid message received');
    return;
  }

  // Process valid message
  handleMessage(from, data);
});
```

### 4. Graceful Shutdown

Implement clean shutdown:

```typescript
class Agent {
  private node: HuiNet;

  constructor() {
    this.node = new HuiNet({ listenPort: 8000 });
    this.setupShutdownHandlers();
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down...`);

      // Stop accepting new connections
      await this.node.stop();

      // Cleanup resources
      await this.cleanup();

      console.log('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  private async cleanup(): Promise<void> {
    // Cleanup resources
    // Close databases, save state, etc.
  }

  async start(): Promise<void> {
    await this.node.start();
  }
}
```

### 5. Resource Management

Manage connections and resources efficiently:

```typescript
const agent = new HuiNet({
  listenPort: 8000,
  maxCoreConnections: 10,      // Limit persistent connections
  maxActiveConnections: 50     // Limit cached connections
});

// Monitor connection pool
const pool = agent.getConnectionPool();
setInterval(() => {
  const stats = pool.getStats();
  console.log('Connections:', stats);
}, 60000);
```

### 6. Logging

Implement structured logging:

```typescript
class Logger {
  private agentName: string;

  constructor(agentName: string) {
    this.agentName = agentName;
  }

  log(level: string, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      agent: this.agentName,
      level,
      message,
      data
    };

    console.log(JSON.stringify(logEntry));
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }
}

// Usage
const logger = new Logger('MyAgent');
agent.on('message', (from, data) => {
  logger.info('Message received', { from, type: data.type });
});
```

### 7. Testing

Write tests for your agent logic:

```typescript
import { HuiNet } from '@huinet/network';

describe('MyAgent', () => {
  let agent1: HuiNet;
  let agent2: HuiNet;

  beforeEach(async () => {
    agent1 = new HuiNet({ listenPort: 8100, enableMDNS: false });
    agent2 = new HuiNet({ listenPort: 8101, enableMDNS: false });

    await agent1.start();
    await agent2.start();

    await agent2.connectToNode('localhost', 8100);
  });

  afterEach(async () => {
    await agent1.stop();
    await agent2.stop();
  });

  it('should send and receive messages', async (done) => {
    agent1.on('message', (from, data) => {
      expect(data.type).toBe('test');
      done();
    });

    await agent2.send(agent1.getNodeID(), { type: 'test' });
  });
});
```

---

## Advanced Usage

### Custom Message Protocol

Define your own message protocol:

```typescript
interface CustomProtocol {
  version: string;
  type: 'query' | 'response' | 'notification';
  id: string;
  timestamp: number;
  payload: any;
  signature?: string;
}

class CustomProtocolAgent {
  private node: HuiNet;

  constructor() {
    this.node = new HuiNet({ listenPort: 8000 });
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.node.on('message', async (from, data) => {
      const message = data as CustomProtocol;

      // Validate protocol version
      if (message.version !== '1.0') {
        console.error('Unsupported protocol version');
        return;
      }

      // Handle message types
      switch (message.type) {
        case 'query':
          await this.handleQuery(from, message);
          break;
        case 'response':
          await this.handleResponse(from, message);
          break;
        case 'notification':
          await this.handleNotification(from, message);
          break;
      }
    });
  }

  async sendQuery(to: string, payload: any): Promise<void> {
    const message: CustomProtocol = {
      version: '1.0',
      type: 'query',
      id: generateId(),
      timestamp: Date.now(),
      payload
    };

    await this.node.send(to, message);
  }

  private async handleQuery(from: string, message: CustomProtocol): Promise<void> {
    const response: CustomProtocol = {
      version: '1.0',
      type: 'response',
      id: message.id,
      timestamp: Date.now(),
      payload: { result: 'processed' }
    };

    await this.node.send(from, response);
  }

  async start(): Promise<void> {
    await this.node.start();
  }
}
```

### Multi-Network Agent

Connect to multiple networks:

```typescript
class MultiNetworkAgent {
  private networks: Map<string, HuiNet> = new Map();

  async addNetwork(name: string, port: number, bootstrapNodes: string[]): Promise<void> {
    const network = new HuiNet({
      listenPort: port,
      bootstrapNodes,
      enableMDNS: false
    });

    this.networks.set(name, network);
    await network.start();

    console.log(`Joined network: ${name}`);
  }

  async sendToNetwork(networkName: string, nodeId: string, message: any): Promise<void> {
    const network = this.networks.get(networkName);
    if (!network) {
      throw new Error(`Network not found: ${networkName}`);
    }

    await network.send(nodeId, message);
  }

  async stop(): Promise<void> {
    for (const [name, network] of this.networks) {
      await network.stop();
      console.log(`Left network: ${name}`);
    }
    this.networks.clear();
  }
}
```

### Load Balancing

Implement load balancing across nodes:

```typescript
class LoadBalancingAgent {
  private node: HuiNet;
  private taskQueue: any[] = [];
  private busyNodes: Set<string> = new Set();

  constructor() {
    this.node = new HuiNet({ listenPort: 8000 });
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.node.on('message', async (from, data) => {
      if (data.type === 'task-result') {
        this.busyNodes.delete(from);
        await this.processQueue();
      }
    });
  }

  async distributeTask(task: any): Promise<void> {
    const routingTable = this.node.getRoutingTable();
    const knownNodes = routingTable.getAllKnownNodes();

    // Find available node
    const availableNode = knownNodes.find(
      node => node.state === 'ONLINE' && !this.busyNodes.has(node.nodeID)
    );

    if (availableNode) {
      this.busyNodes.add(availableNode.nodeID);
      await this.node.send(availableNode.nodeID, {
        type: 'task',
        payload: task
      });
    } else {
      // Queue the task
      this.taskQueue.push(task);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    const task = this.taskQueue.shift();
    await this.distributeTask(task);
  }

  async start(): Promise<void> {
    await this.node.start();
  }
}
```

---

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to other nodes

**Solutions**:
1. Check firewall settings
2. Verify port accessibility
3. Ensure nodes are on the same network
4. Check bootstrap node addresses

```typescript
// Test connection manually
const success = await agent.connectToNode('192.168.1.100', 8000);
console.log('Connection result:', success);
```

### Message Loss

**Problem**: Messages not being received

**Solutions**:
1. Verify NodeID is correct
2. Check if target node is online
3. Implement retry logic
4. Monitor connection state

```typescript
// Implement retry logic
async function sendWithRetry(agent: HuiNet, to: string, message: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await agent.send(to, message);
      return true;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return false;
}
```

### Discovery Issues

**Problem**: mDNS discovery not working

**Solutions**:
1. Check if mDNS is enabled
2. Verify network supports multicast
3. Ensure nodes are on same local network
4. Check firewall allows multicast

```typescript
// Test mDNS discovery
const agent = new HuiNet({
  enableMDNS: true
});

agent.on('nodeDiscovered', (node) => {
  console.log('Discovered:', node.nodeId);
});

await agent.start();
```

### Performance Issues

**Problem**: Slow message delivery or high latency

**Solutions**:
1. Reduce connection limits
2. Implement message batching
3. Use connection pooling
4. Monitor and optimize

```typescript
// Monitor performance
const startTime = Date.now();
await agent.send(targetNodeID, message);
const duration = Date.now() - startTime;
console.log(`Send took ${duration}ms`);
```

---

## Examples

See the [examples](../examples/) directory for complete working examples:

- [Basic Usage](../examples/basic-usage.ts) - Minimal HuiNet usage
- [Agent Integration](../examples/agent-integration/) - Agent integration examples
  - [Simple Chat Agent](../examples/agent-integration/simple-chat-agent.ts) - Basic chat agent
  - [Event-Driven Agent](../examples/agent-integration/event-driven-agent.ts) - Event-based architecture
  - [Multi-Agent System](../examples/agent-integration/multi-agent-system.ts) - Complex multi-agent setup

### Running Examples

```bash
# Build the project
npm run build

# Run basic example
npm run dev

# Run agent integration examples
ts-node examples/agent-integration/simple-chat-agent.ts
```

---

## Additional Resources

- [API Reference](./api-reference.md) - Complete API documentation
- [GitHub Repository](https://github.com/free-revalution/HuiNet-Network-Core) - Source code
- [Issue Tracker](https://github.com/free-revalution/HuiNet-Network-Core/issues) - Report bugs and request features

---

## Support

For questions, issues, or contributions:

- Open an issue on GitHub
- Check existing documentation
- Review example code
- Join community discussions (link TBD)

---

**Happy Agent Networking! 🚀**
