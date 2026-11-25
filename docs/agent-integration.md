# Agent Integration Guide

HuiNet 在本机以 **Local Hub** 形式运行。Agent 有两种接入方式：MCP（推荐）与原生 WebSocket JSON-RPC。

## 1. MCP（兼容大多数 Agent）

1. 启动 Hub：`huinet start`
2. 生成配置：`huinet mcp install-config --write`
3. 在 Claude Code / Cursor / Codex 中确认出现 `huinet` MCP server

### 可用 Tools

| Tool | 作用 |
|------|------|
| `list_agents` | 本机已发现 / 已连接 Agent |
| `get_agent_info` | 单个 Agent 详情 |
| `send_message` | 经总线发消息（`to` 可为 agentId 或 `*`） |
| `context_search` / `context_upsert` | 读写共享记忆 |
| `context_migrate` | 导出迁移用 Markdown |
| `context_import` | 从 claude/codex/cursor 导入会话摘要 |
| `scan_agents` | 重新扫描本机 |

环境变量：

- `HUINET_HTTP` — 默认 `http://127.0.0.1:19527`

## 2. WebSocket JSON-RPC

连接：`ws://127.0.0.1:19528`

```json
{"jsonrpc":"2.0","id":1,"method":"a2a.register","params":{"id":"my-agent","name":"My Agent"}}
{"jsonrpc":"2.0","id":2,"method":"a2a.listAgents"}
{"jsonrpc":"2.0","id":3,"method":"a2a.send","params":{"to":"claude-code","type":"chat","payload":{"text":"hello"}}}
```

入站通知：`a2a.connected`、`a2a.message`。

## 3. HTTP API（UI / 脚本）

基址：`http://127.0.0.1:19527`

- `GET /api/status`
- `GET /api/agents` · `POST /api/agents/scan`
- `GET|POST /api/context` · `POST /api/context/import` · `POST /api/context/migrate`
- `GET /api/bus/messages` · `POST /api/bus/send`
- `GET /api/mcp/config`

## 4. 上下文迁移流程

1. `huinet context import --from claude|codex|cursor`
2. （可选）`huinet context upsert --title "..." --body "..."` 持续沉淀决策
3. `huinet context migrate --to <agent> --out ctx.md` 或在 UI 点「复制迁移包」
4. 将 Markdown 粘贴 / 注入目标 Agent，或让目标 Agent 用 MCP `context_search`

## 手动注册未知 Agent

```bash
huinet agents add my-bot --command /usr/local/bin/my-bot --name "My Bot"
huinet agents scan
```
