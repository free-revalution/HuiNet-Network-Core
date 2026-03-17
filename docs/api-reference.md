# HuiNet API Reference

Complete API reference for HuiNet - A decentralized Agent-to-Agent (A2A) networking library with P2P communication.

## Table of Contents

- [Core Classes](#core-classes)
  - [HuiNet](#huinet)
  - [HuiNetNode](#huinetnode)
- [Configuration](#configuration)
  - [HuiNetConfig](#huinetconfig)
- [Methods](#methods)
  - [start()](#start)
  - [stop()](#stop)
  - [send()](#send)
  - [connectToNode()](#connecttonode)
  - [getNodeID()](#getnodeid)
  - [getPublicKey()](#getpublickey)
  - [getRoutingTable()](#getroutingtable)
  - [getConnectionPool()](#getconnectionpool)
  - [isRunning()](#isrunning)
- [Events](#events)
  - [ready](#ready)
  - [message](#message)
  - [peerConnected](#peerconnected)
  - [peerDisconnected](#peerdisconnected)
  - [nodeDiscovered](#nodediscovered)
  - [error](#error)
- [Type Definitions](#type-definitions)
  - [NodeID](#nodeid)
  - [MessageData](#messagedata)
  - [NodeState](#nodestate)
  - [ConnectionType](#connectiontype)
  - [ConnectionState](#connectionstate)
  - [TransportType](#transporttype)
- [Utility Functions](#utility-functions)
  - [generateKeyPair()](#generatekeypair)
  - [deriveNodeID()](#derivenodeid)
  - [validateNodeID()](#validatenodeid)

---

## Core Classes

### HuiNet

The main P2P network node class that provides decentralized networking capabilities for Agents.

**Extends:** `EventEmitter`

#### Example

```typescript
import { HuiNet } from '@huinet/network';

const huinet = new HuiNet({
  listenPort: 8000,
  enableMDNS: true
});

await huinet.start();
```

---

### HuiNetNode

Alias for `HuiNet` class, providing clearer naming conventions for Agent integration.

**Note:** `HuiNetNode` is an alias of `HuiNet` and can be used interchangeably.

#### Example

```typescript
import { HuiNetNode } from '@huinet/network';

const node = new HuiNetNode({
  listenPort: 8000
});
```

---

## Configuration

### HuiNetConfig

Configuration interface for initializing a HuiNet node.

```typescript
interface HuiNetConfig {
  keyPair?: KeyPair;              // Optional: Cryptographic key pair (auto-generated if not provided)
  listenPort?: number;            // Optional: Port to listen on (default: 8000)
  listenHost?: string;            // Optional: Host address to bind to (default: '0.0.0.0')
  bootstrapNodes?: string[];      // Optional: Array of bootstrap node addresses (host:port format)
  maxCoreConnections?: number;    // Optional: Maximum number of core/persistent connections (default: 10)
  maxActiveConnections?: number;  // Optional: Maximum number of active cached connections (default: 50)
  enableMDNS?: boolean;           // Optional: Enable mDNS discovery (default: true)
}
```

#### Fields

- **keyPair** (`KeyPair`, optional): Cryptographic key pair for node identity. If not provided, a new key pair will be generated automatically.
- **listenPort** (`number`, optional): TCP port for incoming connections. Defaults to `8000`.
- **listenHost** (`string`, optional): Host address to bind the server to. Defaults to `'0.0.0.0'` (all interfaces).
- **bootstrapNodes** (`string[]`, optional): Array of bootstrap node addresses in `'host:port'` format. The node will attempt to connect to these on startup.
- **maxCoreConnections** (`number`, optional): Maximum number of persistent core connections to maintain. Defaults to `10`.
- **maxActiveConnections** (`number`, optional): Maximum number of active cached connections. Defaults to `50`.
- **enableMDNS** (`boolean`, optional): Whether to enable mDNS-based peer discovery. Defaults to `true`.

#### Example

```typescript
import { HuiNet, generateKeyPair } from '@huinet/network';

// Basic configuration
const config1: HuiNetConfig = {
  listenPort: 9000,
  enableMDNS: true
};

// Advanced configuration with custom key pair
const keyPair = generateKeyPair();
const config2: HuiNetConfig = {
  keyPair: keyPair,
  listenPort: 8000,
  listenHost: '0.0.0.0',
  bootstrapNodes: [
    '192.168.1.100:8000',
    'example.com:9000'
  ],
  maxCoreConnections: 20,
  maxActiveConnections: 100,
  enableMDNS: true
};

const huinet = new HuiNet(config2);
```

---

## Methods

### start()

Start the HuiNet node, initializing the TCP server, mDNS discovery (if enabled), and connecting to bootstrap nodes.

```typescript
async start(): Promise<void>
```

#### Behavior

1. Starts the TCP server on the configured host and port
2. Initializes mDNS discovery service if `enableMDNS` is `true`
3. Attempts to connect to all configured bootstrap nodes
4. Sets the node state to running
5. Emits the `ready` event when complete

#### Example

```typescript
const huinet = new HuiNet({ listenPort: 8000 });

huinet.on('ready', () => {
  console.log('Node is ready and listening');
});

await huinet.start();
```

---

### stop()

Stop the HuiNet node, closing all connections and services.

```typescript
async stop(): Promise<void>
```

#### Behavior

1. Stops the TCP server
2. Stops the mDNS discovery service
3. Disconnects all client connections
4. Clears the connection pool
5. Sets the node state to stopped

#### Example

```typescript
// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await huinet.stop();
  process.exit(0);
});
```

---

### send()

Send a message to a target node by NodeID.

```typescript
async send(targetNodeID: string, message: any): Promise<void>
```

#### Parameters

- **targetNodeID** (`string`): The NodeID of the recipient
- **message** (`any`): Message data (any JSON-serializable object)

#### Throws

- `Error` - If the target node is unknown (not in routing table)
- `Error` - If connection to the target fails

#### Behavior

1. Looks up the target node in the routing table
2. Establishes a connection if not already connected
3. Sends the message as JSON
4. Automatically handles reconnection if needed

#### Example

```typescript
// Send a simple message
await huinet.send(targetNodeID, {
  type: 'chat',
  text: 'Hello, World!'
});

// Send complex data
await huinet.send(targetNodeID, {
  type: 'file-transfer',
  filename: 'document.pdf',
  size: 1024000,
  data: base64EncodedData
});
```

---

### connectToNode()

Manually connect to a node at a specific address.

```typescript
async connectToNode(host: string, port: number, nodeID?: string): Promise<boolean>
```

#### Parameters

- **host** (`string`): Target host address
- **port** (`number`): Target port number
- **nodeID** (`string`, optional): NodeID of the target (used for event tracking)

#### Returns

`boolean` - `true` if connection succeeded, `false` otherwise

#### Behavior

1. Creates a new TCP client connection
2. Sets up event handlers for the connection
3. Adds the node to the routing table on success
4. Emits `peerConnected` event on success
5. Returns `false` on connection failure

#### Example

```typescript
// Connect to a known node
const success = await huinet.connectToNode('192.168.1.100', 8000);

if (success) {
  console.log('Connected successfully');
} else {
  console.log('Connection failed');
}

// Connect with known NodeID
await huinet.connectToNode('example.com', 9000, 'QmXxx...');

// Handle connection events
huinet.on('peerConnected', (nodeID) => {
  console.log(`Connected to ${nodeID}`);
});
```

---

### getNodeID()

Get the current node's ID.

```typescript
getNodeID(): string
```

#### Returns

`string` - The NodeID (Base58-encoded SHA-256 hash of the public key)

#### Example

```typescript
const nodeID = huinet.getNodeID();
console.log(`My NodeID: ${nodeID}`);
```

---

### getPublicKey()

Get the current node's public key.

```typescript
getPublicKey(): Buffer
```

#### Returns

`Buffer` - The node's public key (32 bytes)

#### Example

```typescript
const publicKey = huinet.getPublicKey();
console.log(`Public Key: ${publicKey.toString('hex')}`);
```

---

### getRoutingTable()

Get the routing table containing known nodes.

```typescript
getRoutingTable(): RoutingTable
```

#### Returns

`RoutingTable` - The routing table object

#### Example

```typescript
const routingTable = huinet.getRoutingTable();

// Get all known nodes
const allNodes = routingTable.getAllKnownNodes();

// Get a specific node
const node = routingTable.getKnownNode(nodeID);

if (node) {
  console.log(`Node state: ${node.state}`);
  console.log(`Addresses: ${node.addresses.length}`);
}
```

---

### getConnectionPool()

Get the connection pool managing active connections.

```typescript
getConnectionPool(): ConnectionPool
```

#### Returns

`ConnectionPool` - The connection pool object

#### Example

```typescript
const pool = huinet.getConnectionPool();

// Get connection statistics
const stats = pool.getStats();
console.log(`Core connections: ${stats.coreCount}`);
console.log(`Active connections: ${stats.activeCount}`);
```

---

### isRunning()

Check if the node is currently running.

```typescript
isRunning(): boolean
```

#### Returns

`boolean` - `true` if the node is running, `false` otherwise

#### Example

```typescript
if (huinet.isRunning()) {
  console.log('Node is active');
} else {
  console.log('Node is stopped');
}
```

---

## Events

HuiNet extends `EventEmitter` and emits the following events:

### ready

Emitted when the node has started and is ready to accept connections.

```typescript
huinet.on('ready', () => {
  console.log('Node is ready');
});
```

**Callback Signature:** `() => void`

---

### message

Emitted when a message is received from a peer node.

```typescript
huinet.on('message', (from: NodeID, data: any) => {
  console.log(`Received from ${from}:`, data);
});
```

**Callback Signature:** `(from: NodeID, data: any) => void`

**Parameters:**
- **from** (`NodeID`): The NodeID of the sender
- **data** (`any`): The message data (parsed JSON object)

#### Example

```typescript
huinet.on('message', (from, data) => {
  if (data.type === 'chat') {
    console.log(`${from}: ${data.text}`);
  } else if (data.type === 'file-transfer') {
    handleFileTransfer(from, data);
  }
});
```

---

### peerConnected

Emitted when a connection to a peer node is established.

```typescript
huinet.on('peerConnected', (nodeID: NodeID, type?: ConnectionType) => {
  console.log(`Connected to ${nodeID}`);
});
```

**Callback Signature:** `(nodeID: NodeID, type?: ConnectionType) => void`

**Parameters:**
- **nodeID** (`NodeID`): The NodeID of the connected peer
- **type** (`ConnectionType`, optional): The connection type (CORE, ACTIVE, or ON_DEMAND)

#### Example

```typescript
huinet.on('peerConnected', (nodeID, type) => {
  console.log(`New connection: ${nodeID} (${type || 'unknown'})`);
});
```

---

### peerDisconnected

Emitted when a peer node disconnects.

```typescript
huinet.on('peerDisconnected', (nodeID: NodeID) => {
  console.log(`Disconnected from ${nodeID}`);
});
```

**Callback Signature:** `(nodeID: NodeID) => void`

**Parameters:**
- **nodeID** (`NodeID`): The NodeID of the disconnected peer

#### Example

```typescript
huinet.on('peerDisconnected', (nodeID) => {
  console.log(`Peer ${nodeID} disconnected`);

  // Attempt to reconnect after delay
  setTimeout(async () => {
    const node = huinet.getRoutingTable().getKnownNode(nodeID);
    if (node && node.addresses.length > 0) {
      const addr = node.addresses[0];
      await huinet.connectToNode(addr.host, addr.port, nodeID);
    }
  }, 5000);
});
```

---

### nodeDiscovered

Emitted when a new node is discovered through mDNS.

```typescript
huinet.on('nodeDiscovered', (node: DiscoveredNode) => {
  console.log(`Discovered ${node.nodeId}`);
});
```

**Callback Signature:** `(node: DiscoveredNode) => void`

**Parameters:**
- **node** (`DiscoveredNode`): Information about the discovered node

#### Example

```typescript
huinet.on('nodeDiscovered', (node) => {
  console.log(`Discovered node: ${node.nodeId} at ${node.address}`);
});
```

---

### error

Emitted when an error occurs.

```typescript
huinet.on('error', (error: Error) => {
  console.error('Error:', error);
});
```

**Callback Signature:** `(error: Error) => void`

**Parameters:**
- **error** (`Error`): The error object

#### Example

```typescript
huinet.on('error', (error) => {
  console.error('HuiNet error:', error.message);

  // Handle specific errors
  if (error.message.includes('Unknown node')) {
    console.log('Node not found in routing table');
  }
});
```

---

## Type Definitions

### NodeID

A NodeID is a string representing a unique node identifier.

```typescript
type NodeID = string;
```

**Format:** Base58-encoded SHA-256 hash of a public key (43-44 characters)

**Example:** `'QmXxx...'`

---

### MessageData

Interface for message data structure.

```typescript
interface MessageData {
  from: NodeID;           // Sender's NodeID
  to: NodeID;             // Recipient's NodeID
  timestamp: number;       // Unix timestamp in milliseconds
  data: any;              // Actual message payload
}
```

**Example:**

```typescript
const message: MessageData = {
  from: 'QmSender123...',
  to: 'QmRecipient456...',
  timestamp: Date.now(),
  data: {
    type: 'chat',
    text: 'Hello, World!'
  }
};
```

---

### NodeState

Enum representing the state of a node in the routing table.

```typescript
enum NodeState {
  UNKNOWN = 'UNKNOWN',      // Node state not yet determined
  ONLINE = 'ONLINE',        // Node is online and reachable
  OFFLINE = 'OFFLINE',      // Node is offline or unreachable
  RESTRICTED = 'RESTRICTED' // Node is restricted/blocked
}
```

**Values:**
- **UNKNOWN**: Initial state when a node is discovered but not yet verified
- **ONLINE**: Node has been successfully contacted
- **OFFLINE**: Node is known to be offline
- **RESTRICTED**: Node is blocked or restricted

---

### ConnectionType

Enum representing the type of connection.

```typescript
enum ConnectionType {
  CORE = 'CORE',           // Persistent connection to super nodes
  ACTIVE = 'ACTIVE',       // Cached connection to recently used nodes
  ON_DEMAND = 'ON_DEMAND'  // Temporary connection for one-off operations
}
```

---

### ConnectionState

Enum representing the state of a connection.

```typescript
enum ConnectionState {
  CONNECTING = 'CONNECTING',     // Connection is being established
  CONNECTED = 'CONNECTED',       // Connection is active
  IDLE = 'IDLE',                 // Connection is idle
  DISCONNECTED = 'DISCONNECTED', // Connection is closed
  RECONNECTING = 'RECONNECTING', // Reconnection in progress
  FAILED = 'FAILED'              // Connection failed
}
```

---

### TransportType

Enum representing the transport protocol.

```typescript
enum TransportType {
  TCP = 'tcp',         // TCP transport
  WS = 'ws',           // WebSocket transport
  QUIC = 'quic',       // QUIC transport
  RELAY = 'relay'      // Relay transport
}
```

---

## Utility Functions

### generateKeyPair()

Generate a new cryptographic key pair for node identity.

```typescript
function generateKeyPair(): KeyPair
```

#### Returns

`KeyPair` - Object containing `publicKey` and `secretKey` buffers

#### Example

```typescript
import { generateKeyPair } from '@huinet/network';

const keyPair = generateKeyPair();
console.log('Public Key:', keyPair.publicKey.toString('hex'));
console.log('Secret Key:', keyPair.secretKey.toString('hex'));
```

---

### deriveNodeID()

Derive a NodeID from a public key.

```typescript
function deriveNodeID(publicKey: Buffer): NodeID
```

#### Parameters

- **publicKey** (`Buffer`): The public key buffer (32 bytes)

#### Returns

`NodeID` - The derived NodeID (Base58-encoded string)

#### Example

```typescript
import { deriveNodeID } from '@huinet/network';

const nodeID = deriveNodeID(publicKey);
console.log('NodeID:', nodeID);
```

---

### validateNodeID()

Validate a NodeID string format.

```typescript
function validateNodeID(nodeID: string): boolean
```

#### Parameters

- **nodeID** (`string`): The NodeID to validate

#### Returns

`boolean` - `true` if valid, `false` otherwise

#### Example

```typescript
import { validateNodeID } from '@huinet/network';

const isValid = validateNodeID('QmXxx...');
if (isValid) {
  console.log('Valid NodeID');
} else {
  console.log('Invalid NodeID');
}
```

---

## Complete Usage Example

```typescript
import { HuiNet, HuiNetConfig, generateKeyPair } from '@huinet/network';

// Create configuration
const config: HuiNetConfig = {
  listenPort: 8000,
  listenHost: '0.0.0.0',
  bootstrapNodes: ['192.168.1.100:8000'],
  maxCoreConnections: 10,
  maxActiveConnections: 50,
  enableMDNS: true
};

// Initialize HuiNet
const huinet = new HuiNet(config);

// Set up event handlers
huinet.on('ready', () => {
  console.log(`Node ready! ID: ${huinet.getNodeID()}`);
});

huinet.on('message', (from, data) => {
  console.log(`Message from ${from}:`, data);
});

huinet.on('peerConnected', (nodeID) => {
  console.log(`Connected to ${nodeID}`);
});

huinet.on('peerDisconnected', (nodeID) => {
  console.log(`Disconnected from ${nodeID}`);
});

huinet.on('nodeDiscovered', (node) => {
  console.log(`Discovered ${node.nodeId}`);
});

huinet.on('error', (error) => {
  console.error('Error:', error);
});

// Start the node
await huinet.start();

// Send a message
await huinet.send(targetNodeID, {
  type: 'chat',
  text: 'Hello from HuiNet!'
});

// Get routing information
const routingTable = huinet.getRoutingTable();
const allNodes = routingTable.getAllKnownNodes();
console.log(`Known nodes: ${allNodes.length}`);

// Graceful shutdown
process.on('SIGINT', async () => {
  await huinet.stop();
  process.exit(0);
});
```

---

## Additional Resources

- [Agent Integration Guide](./agent-integration.md) - Getting started guide for Agent integration
- [Examples](../examples/) - Code examples and sample implementations
- [GitHub Repository](https://github.com/free-revalution/HuiNet-Network-Core) - Source code and issues
