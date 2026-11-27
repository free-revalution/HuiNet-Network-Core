<div align="center">

<img src="docs/assets/logo.svg" alt="HuiNet" width="96" height="96" />

# HuiNet

### 你的 Agents 本来就在同一台电脑上。给它们一张网。

发现本机 Agent · 打开 A2A 总线 · 共享记忆 —— 全部在 `127.0.0.1`。

[![License: MIT](https://img.shields.io/badge/license-MIT-111111)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-111111?logo=nodedotjs&logoColor=white)](package.json)
[![Local-only](https://img.shields.io/badge/network-127.0.0.1-5B9CFF)](#范围)
[![MCP](https://img.shields.io/badge/MCP-ready-111111)](docs/agent-integration.md)

[English](README.md) · **简体中文**

[快速开始](#快速开始) · [适不适合你](#适不适合你) · [你能得到什么](#你能得到什么) · [文档](docs/agent-integration.md) · [API](docs/api-reference.md)

</div>

---

Claude Code、Cursor、Codex、Gemini CLI、OpenClaw……它们挤在**同一台笔记本**上，却仍然没有共享总线、收件箱或工作集。

**HuiNet 是本机 Agent 织物（Local Agent Fabric）**——扫描已安装工具，把对话放进对等网格，钉住 Fabric Brief，用 MCP / WebSocket 互通，数据不出你的桌子。

> 不是模型路由器（[Magpie](https://github.com/yetone/magpie) / CC Switch）。  
> 不是团队看板。  
> 它是底下那层织物：谁在本机、谁在总线上、它们一起记得什么。

```
 Cursor 对话 A ──┐
 Claude 对话 B ──┼──►  HuiNet Hub  ──►  收件箱 · 任务 · 简报 · Canvas
 Codex 对话 C  ──┘         │
                      127.0.0.1:19527
```

## 适不适合你

**适合，如果你……**

- 本机跑着**不止一个** Agent（或多个对话），希望它们能看见彼此  
- 需要可导入、可钉选、可迁移、可用 `[[双向链接]]` 关联的**共享记忆**  
- 需要 **MCP 友好的投递**（mailbox）——因为很多 Agent 收不到 WebSocket 推送  
- 坚持一切留在 **`127.0.0.1`**——没有云账号，没有公网 P2P

**可以跳过，如果你……**

- 只用一家厂商的客户端，从不跨工具协作  
- 要的是 **Provider / 模型网关** → 请看 [Magpie](https://github.com/yetone/magpie)  
- 要云同步、多用户 SaaS 或公网互联（当前不在范围内）

## 快速开始

```bash
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

npm install
npm run build && npm run build:ui
npm link                     # 可选：全局 huinet

huinet app                   # 桌面端 + Hub
# 或: huinet start && open http://127.0.0.1:19527
```

打开 UI 后：**扫描** → 把对话接入织物 → 导入会话 → 可选 **会诊** / **导出 Canvas**。

```bash
huinet app --quit
huinet stop
```

### 30 秒 CLI

```bash
huinet agents scan
huinet agents connect-all
huinet context import --from cursor
huinet bus send --to '*' --message 'hello fabric'
huinet doctor
```

| 命令 | 作用 |
|------|------|
| `huinet start \| stop \| status` | Hub 启停 |
| `huinet app` | 桌面织物界面 |
| `huinet agents scan \| connect-all` | 清单 + A2A |
| `huinet context import --from …` | 会话 → 记忆 |
| `huinet brief show \| pin <id>` | 工作集简报 |
| `huinet mcp install-config --write` | 写入 MCP 配置 |
| `huinet doctor` | 健康检查 |

## 你能得到什么

| | |
|---|---|
| **对话级节点** | 每个 Cursor / Claude / Codex 对话是一个织物节点，而不是「一个 App 一个点」 |
| **A2A 总线 + 收件箱** | 已连接节点走 WS；MCP 用持久 mailbox（`inbox_check`） |
| **Fabric 任务** | 本机派发 → 完成 / 失败 |
| **Fabric Brief** | 钉选事实/决策；Agent 用 MCP `fabric_brief` 拉取 |
| **记忆链接** | `[[标题]]` + 一跳相关 / 项目作用域 |
| **会诊** | 一条问题并行发给多个节点（`consult_agents`） |
| **JSON Canvas** | 导出拓扑，可用 Obsidian 等 [JSON Canvas](https://jsoncanvas.org/) 工具打开 |
| **桌面 UI** | 深色织物控制台 · 中英切换 · 可收起详情栏 |

## 怎么拼在一起

```
┌──────────────┐  MCP / WS   ┌─────────────────────┐
│  Agents      │◄───────────►│  Local Hub          │
│  (sessions)  │             │  inventory · bus ·  │
└──────────────┘             │  context · mailbox  │
                             └──────────┬──────────┘
                                        │
                             ┌──────────▼──────────┐
                             │  桌面织物 UI         │
                             └─────────────────────┘
```

1. **被动发现** — 无需改 Agent 即可出现在清单里  
2. **MCP** — `list_agents`、`send_message`、`consult_agents`、`fabric_brief`、`context_*`、`fabric_canvas`…  
3. **WS JSON-RPC** — `a2a.register` / `a2a.send` / `a2a.listAgents`  
4. **导入器** — Claude JSONL、Codex、Cursor 会话（只读）

详情：[Agent 接入](docs/agent-integration.md) · [API 参考](docs/api-reference.md)

## MCP 片段

```json
{
  "mcpServers": {
    "huinet": {
      "command": "huinet",
      "args": ["mcp"]
    }
  }
}
```

或执行：`huinet mcp install-config --write`（Claude / Cursor / Codex 适配）。

## 磁盘数据

```
~/.huinet/
  config.json
  inventory.json
  network-access.json    # A2A 开放集合
  brief.json
  context/memories/…
```

## 范围

| 做 | 暂不做 |
|----|--------|
| 本机织物、MCP、桌面 UI | 无中继的跨局域网 / 公网 P2P |
| 会话导入 / 迁移 / 简报 | 替代 Magpie 类模型网关 |
| 本机会诊 + Canvas 导出 | 云账号与同步 |

历史 P2P 笔记：[`docs/archive/`](docs/archive/)。

## 贡献

欢迎 Issue / PR。请尽量小步、可审：

1. 跑通 `npm test` 与 `npm run build && npm run build:ui`  
2. 除非明确改网络能力，否则保持 Hub 只绑 `127.0.0.1`  
3. 跟现有 TypeScript / 桌面风格一致；用户可见改动请同步 `README.md` 与 `README.zh-CN.md`

## 相关项目

| 需求 | 项目 |
|------|------|
| 模型 / 套餐池化 | [Magpie](https://github.com/yetone/magpie) |
| Provider 切换 UI | [CC Switch](https://github.com/farion1231/cc-switch) |
| 本机 Agent 织物 + 共享记忆 | **HuiNet**（本仓库） |

## 许可证

[MIT](LICENSE)
