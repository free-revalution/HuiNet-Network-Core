# HuiNet 代码库分析报告

## 核心功能需求

根据 `调整.md` 的要求，HuiNet 的核心功能是：

> 同一台电脑上启动的不同 Agent，以及不同电脑处在同一局域网或不同网络情况下可以通过 HuiNet 进行互联

**支持的 Agent**: Claude Code、OpenClaw、CodeX 等主流通用 Agent

**使用方式**: 一行指令安装/使用，无需编写复杂代码适配

---

## 当前代码库结构分析

### 1. `/src/` - 核心 P2P 网络库 ✅ 保留

| 模块 | 文件 | 是否服务于核心功能 | 理由 |
|------|------|-------------------|------|
| **crypto/** | keypair.ts, signing.ts | ✅ **保留** | Ed25519 密钥对和签名，P2P 安全通信必需 |
| **protocol/** | codec.ts, handshake.ts, heartbeat.ts | ✅ **保留** | 消息编解码、握手、心跳协议，P2P 可靠通信必需 |
| **routing/** | table.ts | ✅ **保留** | 三层路由表（Core/Active/Known），P2P 拓扑管理必需 |
| **transport/** | client.ts, server.ts, pool.ts | ✅ **保留** | TCP 传输层、连接池，P2P 传输必需 |
| **discovery/** | mdns.ts | ✅ **保留** | mDNS 服务发现，局域网自动发现必需 |
| **utils/** | network.ts, base58.ts, validation.ts | ✅ **保留** | 网络工具函数，IP 检测、子网比较等 |
| **types/** | node.ts, message.ts, connection.ts | ✅ **保留** | TypeScript 类型定义 |
| **HuiNet.ts**, **index.ts** | 主入口 | ✅ **保留** | 核心库入口 |

**状态**: ✅ **完整且功能正常** (282 个测试通过)

---

### 2. `/proxy/` - HTTP 代理服务 ⚠️ 仅框架，需删除重写

| 模块 | 文件 | 是否服务于核心功能 | 状态 |
|------|------|-------------------|------|
| **HuiNetProxy.ts** | 主代理类 | ⚠️ **仅框架** | 只有 HTTP/WebSocket API，无实际代理逻辑 |
| **HttpApiModule.ts** | HTTP API | ❌ **偏离核心** | REST API 对 Agent 透明接入无意义 |
| **WebSocketModule.ts** | WebSocket API | ❌ **偏离核心** | WebSocket API 对 Agent 透明接入无意义 |
| **MessageHistory.ts** | 消息历史 | ❌ **偏离核心** | 非核心功能 |
| **MessageQueue.ts** | 消息队列 | ❌ **偏离核心** | 非核心功能 |
| **MonitoringModule.ts** | 监控模块 | ❌ **偏离核心** | 非核心功能 |
| **AuthMiddleware.ts** | 认证中间件 | ❌ **偏离核心** | 透明代理不需要认证 |
| **ConfigManager.ts** | 配置管理 | ⚠️ **可合并** | 功能可合并到主配置 |

**问题**:
1. ❌ **没有实现实际的 HTTP 代理转发逻辑**
2. ❌ **没有 CONNECT 方法支持**（HTTPS 必需）
3. ❌ **没有域名到 Agent 的路由解析**
4. ❌ **提供了 HTTP/WebSocket API**，但主流 Agent 不会为 HuiNet 适配

**建议**: 🗑️ **删除整个 `/proxy/` 目录**，重新实现真正的透明 HTTP 代理

---

### 3. `/cli/` - 命令行工具 ⚠️ 部分保留

#### 3.1 当前 CLI (main 分支)

| 模块 | 文件 | 是否服务于核心功能 | 建议 |
|------|------|-------------------|------|
| **repl.ts** | 交互式命令行 | ❌ **偏离核心** | Agent 不需要交互式 CLI |
| **nlp/parser.ts** | 自然语言解析 | ❌ **偏离核心** | 非核心功能 |
| **commands/** | 命令处理器 | ❌ **偏离核心** | 大部分命令与 Agent 通信无关 |
| **ui/** | 终端 UI | ❌ **偏离核心** | 非核心功能 |

**建议**: 🗑️ **删除 `/cli/` 目录**（main 分支的版本）

#### 3.2 Daemon 平台 (feature/agent-platform 分支)

| 模块 | 文件 | 是否服务于核心功能 | 建议 |
|------|------|-------------------|------|
| **daemon/proxy.ts** | HTTP 代理池 | ⚠️ **仅框架** | 需要实现实际转发逻辑 |
| **daemon/registry.ts** | Agent 注册表 | ✅ **保留** | 跟踪本地 Agent |
| **daemon/p2p-sync.ts** | P2P 同步 | ✅ **保留** | 跨机器消息路由 |
| **daemon/api.ts** | 管理 API | ⚠️ **可选** | 用于管理，非核心 |
| **launcher/** | Agent 启动器 | ⚠️ **仅框架** | 需要完善环境变量注入 |
| **monitor/** | TUI 监控 | ❌ **非核心** | 可选功能 |

---

### 4. `/examples/` - 示例代码 ❌ 删除

| 文件 | 问题 |
|------|------|
| **basic-usage.ts** | 展示 SDK API，不符合"一行使用"需求 |
| **agent-chat.ts** | 同上 |
| **agent-integration/** | 展示如何用 SDK 集成，但大厂不会适配 |

**建议**: 🗑️ **删除所有示例**，创建实际的使用指南

---

## 核心功能实现状态

### ✅ 已完成 (100%)

1. **P2P 网络核心** - mDNS 发现、TCP 传输、Ed25519 加密
2. **三层路由表** - Core/Active/Known 节点管理
3. **消息协议** - 编解码、握手、心跳
4. **跨网络通信** - Bootstrap 节点支持

### ❌ 未实现 (0%)

1. **HTTP 代理转发** - 只解析 Agent ID，不转发请求
2. **HTTPS CONNECT** - 完全未实现
3. **域名路由** - 域名 → Agent 映射未实现
4. **Agent 启动器** - 只有框架，环境变量注入不完整
5. **一行使用** - 没有简单的启动命令

---

## 删除/保留建议

### 🗑️ 需要删除的代码

| 路径 | 理由 |
|------|------|
| `/proxy/` (全部) | 当前实现只是 HTTP/WebSocket API，不是透明代理 |
| `/cli/` (main 分支) | REPL 和命令行界面对 Agent 透明接入无意义 |
| `/examples/` (全部) | SDK 集成示例不符合实际使用场景 |

### ✅ 需要保留的代码

| 路径 | 理由 |
|------|------|
| `/src/` (全部) | P2P 网络核心，功能完整且测试通过 |
| `/cli/daemon/registry.ts` | 本地 Agent 注册表 |
| `/cli/daemon/p2p-sync.ts` | 跨机器消息路由 |

### ⚠️ 需要重写的代码

| 路径 | 当前状态 | 需要实现 |
|------|----------|----------|
| `/cli/daemon/proxy.ts` | 仅框架 | 实际 HTTP/HTTPS 代理转发 |
| `/cli/launcher/` | 仅框架 | 环境变量注入和 Agent 启动 |

---

## 优先级建议

### P0 - 阻塞性问题（必须立即解决）

1. **实现真正的 HTTP 代理**
   - CONNECT 方法支持
   - 请求转发逻辑
   - 响应处理
   - 域名到 Agent 的路由

### P1 - 核心功能（必须完成）

2. **完善 Agent 启动器**
   - HTTP_PROXY 环境变量注入
   - 独立端口分配
   - 进程生命周期管理

3. **创建一行启动命令**
   ```bash
   huinet-start claude-code
   ```

### P2 - 可选功能（延后）

4. TUI 监控界面
5. 管理 API
6. 消息历史记录

---

## 下一步行动

1. **删除偏离核心的代码**
   - 删除 `/proxy/` 目录
   - 删除 `/cli/` 中 REPL 和 NLP 相关代码
   - 删除 `/examples/` 中 SDK 集成示例

2. **实现透明 HTTP 代理**
   - 在 `/cli/daemon/proxy.ts` 中实现实际转发逻辑
   - 支持 CONNECT 方法
   - 实现域名路由解析

3. **完善 Agent 启动器**
   - 自动注入 HTTP_PROXY 环境变量
   - 分配独立代理端口
   - 管理子进程生命周期

4. **创建简单的启动命令**
   ```bash
   # 启动 HuiNet Daemon
   huinet daemon start

   # 启动并注册 Agent
   huinet agent start claude-code

   # 一行启动（组合命令）
   huinet run claude-code
   ```
