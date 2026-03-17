# @huinet/proxy

HuiNet Proxy Server - Enable AI agents to communicate via the HuiNet P2P network.

## Installation

```bash
npm install @huinet/proxy
```

## Quick Start

### Basic Usage

```typescript
import { HuiNetProxy } from '@huinet/proxy';

// Create and start the proxy server
const proxy = new HuiNetProxy({
  apiKey: process.env.HUINET_API_KEY || 'your-api-key',
  httpPort: 3000,
  wsPort: 3001,
});

await proxy.start();

console.log('Proxy server running on http://localhost:3000');
```

### Configuration via Environment Variables

```bash
export HUINET_API_KEY="your-secret-api-key"
export HUINET_PORT=8000
export HUINET_ENABLE_MDNS=true
export HUINET_LOG_LEVEL=info
```

## API Documentation

### Health Check

**GET** `/health`

Check if the proxy server is running.

**Response:**
```json
{
  "status": "ok",
  "running": true,
  "wsClients": 2
}
```

---

### Send Message

**POST** `/api/send`

Send a message to a target node in the HuiNet network.

**Headers:**
- `X-API-Key: your-api-key`

**Request Body:**
```json
{
  "to": "target-node-id",
  "data": {
    "type": "chat",
    "content": "Hello from Agent!"
  }
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "1710681234567-abc12345"
}
```

**Errors:**
- `400` - Invalid request (missing `to` or `data`)
- `401` - Invalid API key
- `404` - Target node not found
- `503` - HuiNet network unavailable

---

### Get All Nodes

**GET** `/api/nodes`

Get a list of all known nodes in the network.

**Headers:**
- `X-API-Key: your-api-key`

**Query Parameters:**
- None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "nodeID": "5HueCGue8dnF7iSBz5sYjXx...",
      "state": "online",
      "addresses": [
        {
          "type": "tcp",
          "host": "192.168.1.100",
          "port": 8000
        }
      ],
      "lastSeen": 1710681234567
    }
  ]
}
```

---

### Get Specific Node Status

**GET** `/api/nodes/:nodeID`

Get detailed status of a specific node.

**Headers:**
- `X-API-Key: your-api-key`

**Response:**
```json
{
  "success": true,
  "data": {
    "nodeID": "5HueCGue8dnF7iSBz5sYjXx...",
    "state": "online",
    "addresses": [...],
    "lastSeen": 1710681234567,
    "metadata": {
      "version": "1.0.0",
      "capabilities": []
    },
    "connectionCount": 3,
    "recentMessages": {
      "sent": 5,
      "received": 12
    }
  }
}
```

---

### Get Proxy Status

**GET** `/api/status`

Get the overall status of the proxy server.

**Headers:**
- `X-API-Key: your-api-key`

**Response:**
```json
{
  "success": true,
  "data": {
    "nodeID": "5HueCGue8dnF7iSBz5sYjXx...",
    "isRunning": true,
    "knownNodesCount": 5,
    "uptime": 123.456,
    "messageStats": {
      "total": 47,
      "inbound": 32,
      "outbound": 15,
      "oldest": 1710670000000,
      "newest": 1710680000000
    }
  }
}
```

---

### Get Message History

**GET** `/api/messages`

Get message history with optional filters.

**Headers:**
- `X-API-Key: your-api-key`

**Query Parameters:**
- `since` (optional) - Timestamp to start from (exclusive)
- `before` (optional) - Timestamp to end at (exclusive)
- `from` (optional) - Filter by sender node ID
- `to` (optional) - Filter by receiver node ID
- `direction` (optional) - Filter by direction (`inbound` or `outbound`)
- `limit` (optional) - Maximum number of messages (1-1000, default: 100)

**Examples:**
```
# Get last 100 messages
GET /api/messages

# Get messages from last hour
GET /api/messages?since=1710679200000

# Get outbound messages to a specific node
GET /api/messages?to=node123&direction=outbound

# Get last 50 inbound messages
GET /api/messages?direction=inbound&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg_1710681234567_abc123",
      "from": "nodeA",
      "to": "nodeB",
      "data": { "content": "Hello" },
      "timestamp": 1710681234567,
      "direction": "outbound"
    }
  ]
}
```

---

### Get Message Statistics

**GET** `/api/messages/stats`

Get statistics about message history.

**Headers:**
- `X-API-Key: your-api-key`

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "inbound": 95,
    "outbound": 55,
    "oldest": 1710600000000,
    "newest": 1710680000000
  }
}
```

---

## WebSocket API

### Connection

Connect to the WebSocket server with your API key:

```
ws://localhost:3001?apiKey=your-api-key
```

### Message Format

All WebSocket messages follow this format:

```typescript
{
  type: 'message' | 'nodeStatus' | 'error' | 'pong' | 'ping' | 'subscribe' | 'unsubscribe',
  from?: string,        // Sender node ID (for 'message' type)
  data?: any,           // Message payload
  timestamp: number
}
```

### Client → Server Messages

**Ping (keepalive):**
```json
{ "type": "ping" }
```

**Subscribe to message types:**
```json
{
  "type": "subscribe",
  "data": { "types": ["message", "nodeStatus"] }
}
```

**Unsubscribe:**
```json
{ "type": "unsubscribe" }
```

**Send message through proxy:**
```json
{
  "type": "message",
  "from": "target-node-id",
  "data": { "content": "Hello!" }
}
```

### Server → Client Messages

**Welcome (on connect):**
```json
{
  "type": "message",
  "data": {
    "connected": true,
    "clientId": "ws_1234567890_abc123"
  },
  "timestamp": 1710681234567
}
```

**Incoming message from HuiNet:**
```json
{
  "type": "message",
  "from": "sender-node-id",
  "data": { "content": "Hi there!" },
  "timestamp": 1710681234567
}
```

**Node status change:**
```json
{
  "type": "nodeStatus",
  "data": {
    "nodeID": "node123",
    "status": "connected"
  },
  "timestamp": 1710681234567
}
```

**Pong (response to ping):**
```json
{
  "type": "pong",
  "timestamp": 1710681234567
}
```

**Error:**
```json
{
  "type": "error",
  "data": {
    "error": "Failed to send message"
  },
  "timestamp": 1710681234567
}
```

---

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Missing or invalid request parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 404 | `NODE_NOT_FOUND` | Target node not found in routing table |
| 503 | `SERVICE_UNAVAILABLE` | HuiNet network unavailable |
| 500 | `INTERNAL_ERROR` | Server internal error |

---

## Configuration Options

```typescript
interface ProxyConfig {
  // Server configuration
  httpPort: number;           // HTTP API port (default: 3000)
  wsPort: number;             // WebSocket port (default: 3001)
  host: string;               // Listen address (default: '0.0.0.0')
  apiKey: string;             // API key for authentication

  // HuiNet configuration
  huinet: {
    listenPort: number;       // HuiNet P2P port (default: 8000)
    enableMDNS: boolean;      // Enable mDNS discovery (default: true)
    bootstrapNodes: string[]; // Bootstrap node addresses
  };

  // Optional
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxConnections: number;     // Max concurrent connections (default: 100)
}
```

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Development mode
npm run dev
```

---

## Docker

### Build Image

```bash
docker build -t huinet-proxy .
```

### Run Container

```bash
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -p 8000:8000 \
  -e HUINET_API_KEY=your-secret-key \
  huinet-proxy
```

### Docker Compose

```yaml
version: '3.8'

services:
  huinet-proxy:
    image: huinet-proxy
    ports:
      - "3000:3000"
      - "3001:3001"
      - "8000:8000"
    environment:
      - HUINET_API_KEY=your-secret-key
      - HUINET_ENABLE_MDNS=true
      - HUINET_LOG_LEVEL=info
    restart: unless-stopped
```

---

## License

MIT

---

## See Also

- [HuiNet SDK](https://github.com/free-revalution/HuiNet-Network-Core)
- [Proxy Server Design Document](../specs/proxy-server-design.md)
- [Agent Integration Guide](docs/agent-integration.md)
