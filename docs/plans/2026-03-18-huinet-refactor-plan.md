# HuiNet 项目重构方案

> 基于 Agent-to-Agent (A2A) 通信的核心功能重构方案

## 1. 核心目标

**让同一台电脑或不同网络上的 AI Agent 能够通过一行命令互联**

- 支持的 Agent：Claude Code、OpenClaw、CodeX 等主流通用 Agent
- 使用方式：一行指令，无需编写适配代码
- 跨平台：Windows、macOS、Linux

---

## 2. 技术方案总结

| 决策点 | 选择方案 | 理由 |
|--------|----------|------|
| 通信场景 | 混合场景（消息 + 任务分发） | 支持多种 Agent 协作模式 |
| 技术路线 | Agent Wrapper 方案 | 性价比高，实现可控 |
| 消息格式 | JSON-RPC 2.0 | 成熟标准，支持请求/响应 |
| 身份管理 | 混合方案（名字 + NodeID） | 用户友好 + P2P 原生 |
| 本地通信 | WebSocket | 跨平台完美支持 |
| 启动方式 | 预配置 + 手动覆盖 | 易用性 + 灵活性 |
| 配置管理 | 配置文件 + 命令行工具 | 可编程 + 用户友好 |
| 消息路由 | 混合路由（复用现有三层路由表） | 性能 + 可达性 |
| 安装方式 | npm + 独立安装脚本 | 覆盖不同用户群体 |
| 生命周期 | 父子进程模式 | 简单清晰，故障处理容易 |
| 安全加密 | 网络密钥（Network Key） | 简单有效，易于分发 |
| 日志系统 | 混合方案（开发控制台 + 生产文件） | 开发友好 + 生产可靠 |
| 测试验证 | 内置测试命令 | 无需额外依赖 |

---

## 3. 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户电脑 A                               │
│                                                                  │
│   $ huinet run claude-code                                       │
│          │                                                       │
│          ▼                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              HuiNet Launcher                            │   │
│   │  1. 读取配置 ~/.huinet/agents.yaml                      │   │
│   │  2. 启动本地 P2P 节点 (端口 8000)                        │   │
│   │  3. 启动 WebSocket Server (端口 8080+)                   │   │
│   │  4. 设置环境变量                                         │   │
│   │  5. 启动 Agent 子进程                                    │   │
│   │  6. 转发消息: Agent ↔ P2P 网络                           │   │
│   └─────────────────────────────────────────────────────────┘   │
│          │                                                       │
│          │ fork/subprocess                                      │
│          ▼                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Agent (Claude Code)                         │   │
│   │  环境变量:                                               │   │
│   │  - HUINET_AGENT_ID=claude-code-alice                    │   │
│   │  - HUINET_WS_URL=ws://127.0.0.1:8081                    │   │
│   │  - HTTP_PROXY=http://127.0.0.1:8081                     │   │
│   │                                                          │   │
│   │  通过 WebSocket 连接到本地 HuiNet                        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              HuiNet P2P 核心                             │   │
│   │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐     │   │
│   │  │ mDNS 发现   │  │ TCP 传输层   │  │ 三层路由表    │     │   │
│   │  └────────────┘  └─────────────┘  └──────────────┘     │   │
│   │  ┌────────────┐  ┌─────────────┐                       │   │
│   │  │ Ed25519    │  │ JSON-RPC    │                       │   │
│   │  │ 加密签名    │  │ 消息协议    │                       │   │
│   │  └────────────┘  └─────────────┘                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│          │                                                       │
│          │ P2P 网络 (TCP 8000)                                  │
│          │                                                       │
└──────────┼───────────────────────────────────────────────────────┘
           │
           │ 跨网络通信
           │
┌──────────┼───────────────────────────────────────────────────────┐
│          │              用户电脑 B                               │
│          │          （相同架构）                                 │
└──────────┴───────────────────────────────────────────────────────┘
```

---

## 4. 重构执行顺序（自底向上）

### Phase 1: 清理代码（主线 main）

**删除偏离核心功能的代码**：

| 目录/文件 | 删除理由 |
|-----------|----------|
| `/proxy/` | HTTP/WebSocket API 服务器，大厂 Agent 不会适配 |
| `/examples/` | SDK 集成示例，不符合"一行使用"需求 |
| `/cli/repl.ts` | 交互式命令行，非核心功能 |
| `/cli/nlp/` | 自然语言解析，非核心功能 |
| `/cli/commands/` | 当前命令集，大部分与 Agent 通信无关 |
| `/cli/ui/` | 终端 UI，非核心功能 |

**保留的代码**：
- `/src/` - P2P 网络核心（完整保留）
- `/cli/daemon/registry.ts` - Agent 注册表
- `/cli/daemon/p2p-sync.ts` - 跨机器消息路由

---

### Phase 2: 实现核心代理功能（新分支 refactor/agent-wrapper）

#### 2.1 本地 WebSocket 代理

**文件**: `cli/daemon/agent-proxy.ts`

```typescript
/**
 * 本地 Agent WebSocket 代理
 * 每个 Agent 连接到独立的 WebSocket 端口
 * 代理转发 Agent 消息到 P2P 网络
 */

class AgentProxy {
  // 为单个 Agent 提供 WebSocket 接口
  // 接收 Agent 发送的消息
  // 推送收到的 P2P 消息给 Agent
}
```

**功能**：
- WebSocket 服务器（动态端口分配）
- JSON-RPC 消息解析
- 消息路由到 P2P 网络
- 推送 P2P 消息给 Agent

#### 2.2 消息路由器

**文件**: `cli/daemon/router.ts`

```typescript
/**
 * 消息路由器
 * 决定消息如何到达目标 Agent
 */

class MessageRouter {
  // 本域消息 → 直接通过 WebSocket 推送
  // 跨域消息 → 通过 P2P 网络发送
}
```

---

### Phase 3: 实现启动器（同分支）

#### 3.1 Agent Launcher

**文件**: `cli/launcher/agent-launcher.ts`

```typescript
/**
 * Agent 启动器
 * 负责启动 Agent 并管理其生命周期
 */

class AgentLauncher {
  // 读取配置
  // 启动 P2P 节点
  // 启动 WebSocket 代理
  // 设置环境变量
  // 启动 Agent 子进程
  // 监听进程退出
}
```

#### 3.2 配置管理

**文件**: `cli/config/agent-config.ts`

```typescript
/**
 * Agent 配置管理
 */

// ~/.huinet/agents.yaml
interface AgentConfig {
  name: string;
  command: string;
  args?: string[];
  workdir?: string;
  env?: Record<string, string>;
}
```

---

### Phase 4: 实现命令行工具（同分支）

#### 4.1 核心命令

**文件**: `cli/commands/agent-commands.ts`

```bash
# 启动 Agent
huinet run <agent-name>

# 配置管理
huinet agent add <name> --command <path>
huinet agent list
huinet agent remove <name>

# 网络管理
huinet network create --name <name>
huinet network join <key>
huinet network status

# 测试诊断
huinet doctor
huinet test send <agent> <message>
```

---

## 5. 实现清单

### Phase 1: 清理（主线 main）

- [ ] 删除 `/proxy/` 目录
- [ ] 删除 `/examples/` 目录
- [ ] 删除 `/cli/repl.ts`
- [ ] 删除 `/cli/nlp/` 目录
- [ ] 删除 `/cli/commands/` 目录
- [ ] 删除 `/cli/ui/` 目录
- [ ] 保留 `/src/` 全部
- [ ] 保留 `/cli/daemon/registry.ts`
- [ ] 保留 `/cli/daemon/p2p-sync.ts`
- [ ] 更新 README.md
- [ ] 运行测试确保 P2P 核心正常

### Phase 2: 核心代理（分支 refactor/agent-wrapper）

- [ ] 创建 `cli/daemon/agent-proxy.ts`
- [ ] 创建 `cli/daemon/router.ts`
- [ ] 实现 WebSocket 服务器
- [ ] 实现 JSON-RPC 消息解析
- [ ] 实现本地消息路由
- [ ] 实现 P2P 消息转发
- [ ] 单元测试

### Phase 3: 启动器（同分支）

- [ ] 创建 `cli/launcher/agent-launcher.ts`
- [ ] 创建 `cli/config/agent-config.ts`
- [ ] 实现配置文件读取
- [ ] 实现环境变量注入
- [ ] 实现子进程管理
- [ ] 实现进程清理
- [ ] 集成测试

### Phase 4: 命令行（同分支）

- [ ] 创建 `cli/index.ts`
- [ ] 实现 `huinet run` 命令
- [ ] 实现 `huinet agent` 命令组
- [ ] 实现 `huinet network` 命令组
- [ ] 实现 `huinet doctor` 命令
- [ ] 实现 `huinet test` 命令
- [ ] 更新 package.json bin 字段
- [ ] 端到端测试

---

## 6. 文件结构（重构后）

```
HuiNet/
├── src/                          # P2P 网络核心（不变）
│   ├── crypto/
│   ├── protocol/
│   ├── routing/
│   ├── transport/
│   ├── discovery/
│   ├── types/
│   ├── utils/
│   └── HuiNet.ts
│
├── cli/                          # 命令行工具
│   ├── daemon/                   # 后台服务
│   │   ├── agent-proxy.ts        # [NEW] WebSocket 代理
│   │   ├── router.ts             # [NEW] 消息路由
│   │   ├── registry.ts           # Agent 注册表
│   │   └── p2p-sync.ts           # P2P 同步
│   │
│   ├── launcher/                 # [NEW] 启动器
│   │   ├── agent-launcher.ts
│   │   └── process-manager.ts
│   │
│   ├── config/                   # [NEW] 配置管理
│   │   ├── agent-config.ts
│   │   └── network-config.ts
│   │
│   ├── commands/                 # [NEW] 命令实现
│   │   ├── run.ts
│   │   ├── agent.ts
│   │   ├── network.ts
│   │   └── test.ts
│   │
│   └── index.ts                  # CLI 入口
│
├── bin/                          # 可执行文件
│   └── huinet                    # 启动脚本
│
├── package.json
└── README.md                     # 更新文档
```

---

## 7. 使用示例（重构后）

```bash
# 安装
npm install -g @huinet/cli

# 配置 Agent
huinet agent add claude-code --command "/usr/local/bin/claude-code"

# 创建网络
huinet network create --name "MyTeam"

# 启动 Agent
huinet run claude-code

# 测试连接
huinet doctor
```

---

## 8. 预期成果

**最小可用版本 (MVP)**：
- ✅ 一行命令启动 Agent
- ✅ Agent 之间可以发送消息
- ✅ 同局域网自动发现
- ✅ 跨网络通过 Bootstrap 节点通信
- ✅ 网络密钥保护

**后续增强**：
- 任务分发（JSON-RPC request/response）
- 消息历史记录
- TUI 监控界面
- 全局目录服务
