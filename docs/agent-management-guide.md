# HuiNet Agent 管理指南

本指南介绍如何使用 HuiNet Agent 管理平台来管理和协调分布在不同机器上的 AI Agent 工具。

## 目录

- [概述](#概述)
- [安装](#安装)
- [快速开始](#快速开始)
- [守护进程](#守护进程)
- [Agent 启动器](#agent-启动器)
- [监控控制台](#监控控制台)
- [高级配置](#高级配置)
- [API 参考](#api-参考)

---

## 概述

HuiNet Agent 管理平台是一个基于 P2P 网络的分布式 Agent 管理系统，允许您：

- **跨机器 Agent 发现**：自动发现网络中的所有 Agent
- **统一管理**：从单一控制点管理所有 Agent
- **Agent 通信**：支持跨机器的 Agent 消息传递
- **实时监控**：TUI 界面显示网络拓扑和 Agent 状态

### 架构

```
┌─────────────────────────────────────────────────────────┐
│                   HuiNet P2P 网络                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  机器 A      │  │  机器 B      │  │  机器 C      │  │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │  │
│  │  │守护进程│  │  │  │守护进程│  │  │  │守护进程│  │  │
│  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │  │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │  │
│  │  │Agent 1 │  │  │  │Agent 2 │  │  │  │Agent 3 │  │  │
│  │  │Agent 2 │  │  │  │Agent 3 │  │  │  │Agent 4 │  │  │
│  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │              监控控制台 (任意机器)                │  │
│  │         实时查看网络拓扑和 Agent 状态             │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 安装

### 前置要求

- Node.js >= 18
- npm 或 yarn
- 系统权限（用于守护进程）

### 一键安装

```bash
curl -sSL https://install.huinet.dev | sh
```

### 手动安装

```bash
# 克隆仓库
git clone https://github.com/huinet/agent-platform.git
cd agent-platform

# 安装依赖
npm install

# 构建项目
npm run build

# 全局安装
npm install -g .
```

### 验证安装

```bash
huinet --version
```

---

## 快速开始

### 1. 启动守护进程

在每台需要运行 Agent 的机器上启动守护进程：

```bash
huinet daemon start
```

守护进程会：
- 在端口 8000 启动 P2P 监听
- 在端口 3000 启动管理 API
- 通过 mDNS 发现本地网络中的其他机器

### 2. 启动 Agent

使用启动器启动您的 Agent：

```bash
# 启动 Claude Code
huinet launch claude-code

# 启动 Cursor
huinet launch cursor

# 启动 Windsurf
huinet launch windsurf
```

### 3. 查看状态

```bash
# 查看所有 Agent
huient status

# 查看 P2P 网络拓扑
huinet topology

# 查看特定机器的 Agent
huinet agents --machine <machine-id>
```

### 4. 打开监控控制台

```bash
huinet monitor
```

---

## 守护进程

守护进程是 HuiNet Agent 管理平台的核心组件，运行在每台机器上。

### 启动守护进程

```bash
huinet daemon start [options]
```

**选项：**

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--name <name>` | 机器名称 | 主机名 |
| `--location <location>` | 机器位置 | `default` |
| `--port <port>` | P2P 监听端口 | `8000` |
| `--api-port <port>` | 管理 API 端口 | `3000` |
| `--no-mdns` | 禁用 mDNS | - |
| `--proxy-range <min-max>` | 代理端口范围 | `8080-8090` |

**示例：**

```bash
# 自定义机器名称和位置
huinet daemon start --name "开发机-01" --location "北京办公室"

# 指定端口
huinet daemon start --port 9000 --api-port 4000
```

### 停止守护进程

```bash
huinet daemon stop
```

### 守护进程状态

```bash
huinet daemon status
```

输出示例：

```
HuiNet Daemon
Status: Running
Machine ID: a1b2c3d4e5f6
Machine Name: 开发机-01
Location: 北京办公室
P2P Port: 8000
API Port: 3000

Connected Machines: 3
  - remote-machine-1 (上海办公室)
  - remote-machine-2 (深圳办公室)
  - remote-machine-3 (广州办公室)

Local Agents: 2
  - agent-1 (Claude Code) - running
  - agent-2 (Cursor) - idle
```

---

## Agent 启动器

Agent 启动器用于包装和启动各种 AI Agent 工具。

### 启动 Agent

```bash
huinet launch <agent-type> [args...]
```

**支持的 Agent 类型：**

| 类型 | 命令 | 描述 |
|------|------|------|
| `claude-code` | `claude` | Anthropic Claude Code |
| `cursor` | `cursor` | Cursor AI Editor |
| `windsurf` | `windsurf` | Windsurf AI |
| `openclaw` | `openclaw` | OpenClaw AI |

**示例：**

```bash
# 启动 Claude Code
huinet launch claude-code

# 启动 Cursor 并传递参数
huinet launch cursor /path/to/project

# 启动 Windsurf
huinet launch windsurf
```

### Agent 环境变量

启动器会自动注入以下环境变量：

```bash
HUINET_AGENT_ID=<agent-id>
HUINET_AGENT_TYPE=<agent-type>
HUINET_DAEMON_URL=http://127.0.0.1:3000
HTTP_PROXY=http://127.0.0.1:<proxy-port>
HTTPS_PROXY=http://127.0.0.1:<proxy-port>
```

### Agent 生命周期

1. **注册**：Agent 向守护进程注册
2. **分配端口**：守护进程分配唯一的代理端口
3. **心跳**：Agent 定期发送心跳（默认 3 秒）
4. **清理**：Agent 退出时自动清理资源

---

## 监控控制台

监控控制台提供实时 TUI 界面来查看网络状态。

### 启动监控

```bash
huinet monitor [options]
```

**选项：**

| 选项 | 描述 |
|------|------|
| `--daemon <url>` | 守护进程 URL |
| `--refresh <ms>` | 刷新间隔（毫秒）|

### 界面

```
┌─ HuiNet Agent Monitor ──────────────────────────────────┐
│                                                          │
│  ● 3 online  ○ 1 offline  | Connected: 4 machines       │
│                                                          │
│  Network Topology                                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ┌─ 开发机-01 (Local) ──────────────────────┐   │   │
│  │  │  ● Claude Code (running)                  │   │   │
│  │  │  ● Cursor (idle)                          │   │   │
│  │  └───────────────────────────────────────────┘   │   │
│  │                                                    │   │
│  │  ┌─ 开发机-02 (Remote) ─────────────────────┐   │   │
│  │  │  ○ Windsurf (offline)                     │   │   │
│  │  └───────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Press [q] to quit, [r] to refresh                       │
└──────────────────────────────────────────────────────────┘
```

### 键盘快捷键

| 按键 | 动作 |
|------|------|
| `q` | 退出 |
| `r` | 刷新 |
| `t` | 切换到拓扑视图 |
| `a` | 切换到 Agent 列表 |
| `m` | 切换到消息视图 |

---

## 高级配置

### 配置文件

配置文件位于 `~/.huinet/daemon.json`：

```json
{
  "machineName": "开发机-01",
  "location": "北京办公室",
  "listenPort": 8000,
  "enableMDNS": true,
  "adminPort": 3000,
  "proxyPortRange": [8080, 8090],
  "heartbeatInterval": 3000,
  "heartbeatTimeout": 10000
}
```

### 环境变量

```bash
# 守护进程 URL
export HUINET_DAEMON_URL=http://localhost:3000

# 配置文件路径
export HUINET_CONFIG_PATH=/path/to/config.json

# 日志级别
export HUINET_LOG_LEVEL=debug
```

### P2P 网络配置

```json
{
  "p2p": {
    "bootstrapNodes": [
      "192.168.1.100:8000",
      "192.168.1.101:8000"
    ],
    "maxConnections": 50,
    "connectionTimeout": 30000
  }
}
```

---

## API 参考

### REST API

管理 API 在 `http://127.0.0.1:3000` 上提供服务。

#### 获取状态

```bash
GET /api/status
```

**响应：**

```json
{
  "status": "ok",
  "machineId": "a1b2c3d4e5f6",
  "stats": {
    "total": 2,
    "running": 1,
    "busy": 0,
    "idle": 1,
    "offline": 0
  },
  "proxyStats": {
    "total": 2,
    "active": 2
  }
}
```

#### 注册 Agent

```bash
POST /api/agents/register
Content-Type: application/json

{
  "agentType": "claude-code",
  "agentName": "Claude Code",
  "pid": 12345
}
```

**响应：**

```json
{
  "agentId": "agent-1234567890",
  "proxyPort": 8081,
  "heartbeatInterval": 3000
}
```

#### Agent 心跳

```bash
POST /api/agents/heartbeat
Content-Type: application/json

{
  "agentId": "agent-1234567890",
  "status": "running"
}
```

#### 获取网络拓扑

```bash
GET /api/topology
```

**响应：**

```json
{
  "machines": [
    {
      "machineId": "a1b2c3d4e5f6",
      "machineName": "开发机-01",
      "agents": [
        {
          "agentId": "agent-1",
          "agentType": "claude-code",
          "agentName": "Claude Code",
          "status": "running"
        }
      ]
    }
  ],
  "connections": []
}
```

### WebSocket API

实时事件订阅：

```javascript
const events = new EventSource('http://127.0.0.1:3000/api/events');

events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data);
};
```

**事件类型：**

- `agent-registered` - 新 Agent 注册
- `agent-removed` - Agent 被移除
- `agent-status-changed` - Agent 状态变化
- `machine-discovered` - 发现新机器
- `machine-lost` - 机器丢失

---

## 故障排除

遇到问题？请参阅 [故障排除指南](troubleshooting.md)。
