# HuiNet

**Local Agent Fabric** — 同一台电脑上的 AI Agent 互相发现、共享上下文、协作开发。

HuiNet 不再做跨机 P2P。没有中继服务器时，跨网连通不可靠；本期核心是 **单主机 A2A**。

## 它解决什么

- 本机装了 Claude Code / Cursor / Codex / OpenClaw… 上下文散落各处
- 好用的 harness 不一定接得上好用的模型；需要统一记忆层持续迭代
- 需要一种方式让本机 Agent **被发现、彼此可见、迁移上下文**

## 架构

```
本机 Agents  ──MCP / WS──►  HuiNet Local Hub  ◄──  Desktop UI / CLI
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
               Inventory   A2A Bus   Context Hub
              (指纹扫描)   (同机消息)  (记忆+导入)
```

## Quick Start

```bash
npm install
npm run build
npm link          # 可选：全局 huinet 命令

huinet start      # 启动本机单例 Hub（127.0.0.1:19527）
huinet agents scan
huinet agents list
huinet app        # 打开控制台（桌面壳或浏览器）
```

挂上 MCP（让几乎任意 Agent 读写共享上下文）：

```bash
huinet mcp install-config           # 打印片段
huinet mcp install-config --write   # 写入 Claude / Cursor / Codex 配置
```

导入已有会话到统一记忆层：

```bash
huinet context import --from claude
huinet context import --from codex
huinet context import --from cursor
huinet context migrate --to claude-code --out /tmp/ctx.md
```

## CLI

| 命令 | 说明 |
|------|------|
| `huinet start \| stop \| status` | 本机 Hub 生命周期 |
| `huinet agents scan \| list \| show \| add \| remove` | 本机 Agent 清单 |
| `huinet context list \| search \| upsert \| import \| migrate` | 共享上下文 |
| `huinet bus peers \| send \| listen` | 同机 A2A 总线 |
| `huinet mcp install-config` | MCP 接入片段 |
| `huinet app` | 打开 UI |
| `huinet doctor` | 健康检查 |

## 桌面 UI

CC Switch 风格：左侧 Agent 列表，右侧卡片；底部「上下文 / 总线 / 设置」；Tauri 托盘常驻。

```bash
npm run build:ui          # 构建 Web UI → apps/desktop/dist（Hub 可直接托管）
cd apps/desktop && npm i
npm run tauri dev         # 可选：Tauri 桌面壳
```

## 兼容策略

1. **被动发现**：PATH、家目录、进程指纹（不改 Agent 也能进清单）
2. **MCP**：list_agents / send_message / context_*（主流 Agent 通用入口）
3. **可选 WS JSON-RPC**：`a2a.register` / `a2a.send` / `a2a.listAgents`
4. **会话导入**：只读 Claude JSONL / Codex rollout / Cursor transcripts → 记忆层

## 配置目录

```
~/.huinet/
  config.json
  inventory.json
  daemon.pid
  token
  context/
    memories/
    projects/
    index.json
  agents.yaml          # 手动注册
```

## 开发

```bash
npm run dev:daemon    # 前台 Hub
npm run cli -- agents scan
npm test
```

## 不在本期

- 跨公网 / 跨 LAN 无中继 P2P
- 替代 CC Switch 的模型供应商切换
- 云端同步与账号体系

旧跨机文档见 [`docs/archive/`](docs/archive/).

## License

MIT
