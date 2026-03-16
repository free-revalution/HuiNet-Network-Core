# @huinet/cli

HuiNet P2P Agent 的命令行工具 - 让你无需编写代码即可使用 HuiNet！

## 🚀 快速开始

### 安装

```bash
npm install -g @huinet/cli
```

### 启动

```bash
# 使用默认配置启动
huinet

# 指定名称
huinet "我的电脑"

# 指定端口
huinet --port 8001

# 禁用 mDNS（跨互联网连接时）
huinet --no-mdns --bootstrap "server.com:9000"
```

## 💬 使用示例

### 交互式命令行

```
╔════════════════════════════════════════════════════════════╗
║                    🌐 HuiNet v1.0.0                       ║
╠════════════════════════════════════════════════════════════╣
║  名称: 我的电脑                                            ║
║  NodeID: 5HueCGue8dnF7iSBz5sYjXx...                       ║
║  状态: ● 已就绪                                            ║
╠════════════════════════════════════════════════════════════╣
║  💡 提示:                                                  ║
║    - 输入 help 查看所有命令                                ║
║    - 输入 ls 查看已发现的节点                              ║
║    - 输入 quit 退出程序                                    ║
║    - 支持自然语言，试试 "给小明发消息说你好"                ║
╚════════════════════════════════════════════════════════════╝

huinet > ls
📋 已发现的节点
──────────────────────────────────────────────────────────
  1. 🟢 小明的电脑
      状态: ● 已连接
      地址: 192.168.1.100:8000
      NodeID: 7KjdBf2k4pr...

  2. 🟢 公司电脑
      状态: ● 已连接
      地址: 192.168.1.101:8001
      NodeID: 3MxF7gHq8st...
──────────────────────────────────────────────────────────

huinet > msg 小明 你好，我是 HuiNet CLI
📤 正在发送消息到 小明...
✅ 消息已发送

huinet > status
📊 我的节点状态
──────────────────────────────────────────────────────────
  名称: 我的电脑
  NodeID: 5HueCGue8dnF7iSBz5sYjXxMxq9DHF9qVxkJ7p3R
  监听端口: 8000
  已连接节点: 2
  已知节点: 2
  核心节点: 0
──────────────────────────────────────────────────────────

huinet > quit
👋 正在退出...
```

## 📖 命令列表

### 基础命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `help` | 显示帮助信息 | `help` |
| `status` | 查看节点状态 | `status` |
| `ls` | 列出所有节点 | `ls` |
| `quit` | 退出程序 | `quit` |

### 消息命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `msg <别名> <内容>` | 发送消息 | `msg 小明 你好` |
| `broadcast <内容>` | 广播消息 | `broadcast 大家好` |
| `history` | 查看消息历史 | `history` |

### 节点管理

| 命令 | 说明 | 示例 |
|------|------|------|
| `alias <名称> <ID>` | 设置别名 | `alias 小明 5HueCG...` |
| `connect <地址>` | 手动连接 | `connect 192.168.1.100:8000` |
| `disconnect <别名>` | 断开连接 | `disconnect 小明` |

## 🗣️ 自然语言支持

你可以用自然语言与 CLI 交互：

| 自然语言输入 | 解析为 |
|-------------|--------|
| "给小明发消息说你好" | `msg 小明 你好` |
| "告诉小明我在这里" | `msg 小明 我在这里` |
| "看看有哪些节点" | `ls` |
| "我的状态怎么样" | `status` |
| "断开和小明的连接" | `disconnect 小明` |
| "清屏" | `clear` |
| "退出" | `quit` |

## 🔧 全局命令

```bash
# 管理别名
huinet alias 小明 5HueCGue8dnF7iSBz5sYjXxMxq9
huinet aliases    # 列出所有别名

# 重置配置
huinet reset     # 重置所有配置
huinet reset --force  # 强制重置
```

## 🌐 使用场景

### 场景 1：同一局域网

**电脑 A：**
```bash
huinet "我的电脑"
huinet > ls              # 自动发现局域网节点
```

**电脑 B：**
```bash
huinet "小明"
huinet > msg 我的电脑 你好
```

### 场景 2：跨互联网

**需要公网引导服务器**

**家里电脑：**
```bash
huinet --no-mdns --bootstrap "your-server.com:9000"
```

**公司电脑：**
```bash
huinet --no-mdns --bootstrap "your-server.com:9000"
```

## 📁 配置文件

配置文件保存在 `~/.huinet/config.json`：

```json
{
  "name": "MyAgent",
  "nodeID": "5HueCGue8dnF7iSBz5sYjXxMxq9DHF9qVxkJ7p3R",
  "aliases": {
    "小明": "7KjdBf2k4prF7iSBz5sYjXxMxq9",
    "公司": "3MxF7gHq8stF7iSBz5sYjXxMxq9"
  },
  "messageHistory": [...],
  "settings": {
    "mdns": true,
    "autoConnect": []
  }
}
```

## ⚙️ 选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--port <number>` | 8000 | 监听端口 |
| `--host <address>` | 0.0.0.0 | 监听地址 |
| `--no-mdns` | true | 禁用 mDNS |
| `--bootstrap <addr>` | - | 引导节点地址 |

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core/packages/cli

# 安装依赖
npm install

# 构建
npm run build

# 本地测试
npm link
huinet

# 开发模式
npm run dev
```

## 📝 License

MIT

---

**HuiNet CLI** - 让 P2P 通信变得简单！
