# HuiNet 使用指南

## 快速开始

### 1. 安装

```bash
# 克隆仓库
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# 安装依赖
npm install

# 构建项目
npm run build

# （可选）创建全局链接
npm link
```

### 2. 配置网络

首先创建一个网络，用于 Agent 之间的通信认证：

```bash
huinet network create MyTeam
```

输出：
```
✓ Network "MyTeam" created!

🔑 Network Key: a3f7c9e24b1d8x6y...

Share this key with trusted agents:
  huinet network join MyTeam a3f7c9e24b1d8x6y...
```

**在其他电脑上加入网络**：
```bash
huinet network join MyTeam a3f7c9e24b1d8x6y...
```

### 3. 配置 Agent

添加 Agent 配置：

```bash
huinet agent add claude-code --command "/usr/local/bin/claude-code" --name "Claude Code"
```

查看所有配置的 Agent：

```bash
huinet agent list
```

### 4. 启动 Agent

启动配置好的 Agent：

```bash
huinet run claude-code
```

---

## 完整示例

### 场景：两台电脑上的 Agent 通信

#### 电脑 A

```bash
# 1. 创建网络
huinet network create OfficeNetwork

# 2. 配置 Agent
huinet agent add claude-code --command "/usr/local/bin/claude-code" --name "Claude A"

# 3. 启动 Agent
huinet run claude-code
```

#### 电脑 B

```bash
# 1. 加入同一网络（使用电脑 A 生成的密钥）
huinet network join OfficeNetwork <从A获取的密钥>

# 2. 配置 Agent
huinet agent add claude-code --command "/usr/local/bin/claude-code" --name "Claude B"

# 3. 启动 Agent
huinet run claude-code
```

---

## 命令参考

### 网络管理

```bash
# 创建网络
huinet network create <name>

# 加入网络
huinet network join <name> <key>

# 列出所有网络
huinet network list

# 查看网络状态
huinet network status
```

### Agent 管理

```bash
# 添加 Agent
huinet agent add <id> --command <path> [--name <name>] [--args <args>] [--workdir <path>]

# 列出 Agent
huinet agent list

# 删除 Agent
huinet agent remove <id>
```

### 启动 Agent

```bash
# 启动 Agent
huinet run <agent-id> [--workdir <path>]
```

### 系统工具

```bash
# 系统检查
huinet doctor
```

---

## 配置文件位置

- **用户配置**: `~/.huinet/agents.yaml`
- **网络配置**: `~/.huinet/networks.yaml`

### 示例 agents.yaml

```yaml
# HuiNet Agent Configuration
# Edit this file to add or modify agents

- id: "claude-code"
  name: "Claude Code"
  command: "/usr/local/bin/claude-code"
  args: ["--no-color"]
  workdir: "/home/user/projects"

- id: "openclaw"
  name: "OpenClaw"
  command: "/opt/openclaw/bin/openclaw"
  workdir: "/home/user/projects"
```

---

## 故障排除

### Agent 无法发现其他 Agent

1. 检查是否在同一网络：
```bash
huinet network status
```

2. 检查防火墙设置：
- 确保 UDP 端口 5353 开放（mDNS）
- 确保 TCP 端口 8000 开放（P2P）

3. 检查 Agent 配置：
```bash
huinet agent list
huinet doctor
```

### 连接失败

1. 检查 Agent 是否运行：
```bash
huinet run <agent-id>
```

2. 检查网络密钥是否匹配：
```bash
huinet network list
```

3. 查看详细日志：
```bash
DEBUG=* huinet run <agent-id>
```

---

## 高级用法

### 自定义端口

```bash
# 在启动时指定端口
huinet run <agent-id> -- --port 8001
```

### 手动指定工作目录

```bash
huinet run <agent-id> --workdir /path/to/project
```

### 多 Agent 管理

```bash
# 终端 1
huinet run agent-1

# 终端 2
huinet run agent-2

# 终端 3
huinet run agent-3
```

---

## 下一步

- 查看 [API 文档](api-reference.md) 了解 SDK 用法
- 查看 [Agent 集成指南](agent-integration.md) 了解如何集成新 Agent
