# HTTP / WS API Reference (Local Hub)

Base URL: `http://127.0.0.1:19527`  
WebSocket: `ws://127.0.0.1:19528`

## HTTP

### GET /api/health · /api/status

Hub runtime status.

### GET /api/agents

Discovered + connected agents.

### POST /api/agents/scan

Refresh inventory fingerprint scan.

### GET /api/agents/:id

Single agent record.

### GET /api/agents/connected

Agents currently registered on the bus.

### GET /api/context?q=&project=

List or search memories.

### POST /api/context

Upsert memory:

```json
{
  "kind": "fact",
  "title": "...",
  "body": "...",
  "scope": "global",
  "project": "optional",
  "tags": []
}
```

### POST /api/context/import

```json
{ "from": "claude|codex|cursor", "project": "optional", "limit": 20 }
```

### POST /api/context/migrate

```json
{ "targetAgent": "claude-code", "project": "optional" }
```

Returns `{ markdown, memories }`.

### GET /api/bus/messages

Recent bus messages.

### POST /api/bus/send

```json
{ "from": "ui", "to": "codex", "type": "chat", "payload": { "text": "hi" } }
```

### GET /api/mcp/config

MCP server snippet for client configs.

## WebSocket JSON-RPC methods

- `a2a.register` / `huinet.register`
- `a2a.listAgents`
- `a2a.getAgentInfo`
- `a2a.send`
- `a2a.broadcast`
- `a2a.heartbeat`
- `a2a.task.execute`
- `context.search` / `context.upsert` / `context.list` / `context.migrate` / `context.import`

Notifications: `a2a.connected`, `a2a.message`.

Legacy cross-machine P2P API docs: [archive/api-reference-p2p.md](archive/api-reference-p2p.md).
