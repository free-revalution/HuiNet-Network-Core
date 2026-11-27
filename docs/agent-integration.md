# Agent Integration Guide

Plug any local agent into the HuiNet fabric.

The Hub runs only on this machine (`127.0.0.1`). Prefer **MCP** for Claude Code / Cursor / Codex and friends; use **WebSocket JSON-RPC** when you control the agent runtime yourself.

## 1. MCP（兼容大多数 Agent）

1. 启动 Hub：`huinet start`
2. 生成配置：`huinet mcp install-config --write`
3. 在 Claude Code / Cursor / Codex 中确认出现 `huinet` MCP server

### 可用 Tools

| Tool | 作用 |
|------|------|
| `list_agents` | 本机已开放 A2A 的 peers |
| `get_agent_info` / `agent_card` | 详情与能力卡片 |
| `send_message` | 经总线发消息（落入对方 **mailbox**） |
| `inbox_check` / `inbox_ack` | 轮询 / 确认收件箱（MCP 无 WS 推送） |
| `task_create` / `task_list` / `task_complete` | 本机轻量任务闭环 |
| `fabric_brief` | 拉取钉选工作集 |
| `context_search` / `context_upsert` | 读写共享记忆 |
| `context_migrate` / `context_import` | 迁移包 / 会话导入 |
| `scan_agents` | 重新扫描本机 |

推荐工作流：对方 `send_message` / `ask_agent` → 你 `inbox_check` → 处理 → `inbox_ack`；或 `task_create` → 对方 `task_complete`。

公网：`net_fetch` 经 Hub 出站（私网/metadata 已拦截）。本机命令：桌面「终端」或 `POST /api/terminal/run`。

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

任务：`a2a.task.execute` → 返回 `taskId`；完成后 `a2a.task.result`。

## 3. HTTP API（UI / 脚本）

基址：`http://127.0.0.1:19527`

- `GET /api/status`
- `GET /api/agents` · `POST /api/agents/scan` · `GET /api/agents/:id/card`
- `GET /api/card` · `GET /.well-known/agent.json`
- `GET /api/mailbox` · `POST /api/mailbox/read`
- `GET|POST /api/tasks` · `GET|POST /api/tasks/:id`
- `GET /api/brief` · `POST /api/brief/pin|unpin|clear`
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
