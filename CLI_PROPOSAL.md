# HuiNet CLI 工具设计方案

## 🎯 目标

让用户通过简单的命令行交互使用 HuiNet，无需编写代码。

## 📦 使用体验

### 安装

```bash
npm install -g @huinet/cli
```

### 启动

```bash
# 启动 HuiNet Agent
huinet

# 或指定名称和端口
huinet --name "我的电脑" --port 8000
```

### 交互式界面

```
╔══════════════════════════════════════════════════╗
║              🌐 HuiNet v1.0.0                   ║
╠══════════════════════════════════════════════════╣
║  名称: 我的电脑                                  ║
║  NodeID: 5HueCGue8dn...                          ║
║  状态: ● 已就绪                                  ║
╠══════════════════════════════════════════════════╣
║  输入 help 查看命令 | 输入 quit 退出              ║
╚══════════════════════════════════════════════════╝

🔍 正在发现附近节点...
✨ 发现 2 个节点

huinet >
```

---

## 💬 对话式交互

### 场景 1：自然语言指令

```
huinet > 帮我查看有哪些节点
📋 已发现 2 个节点:
  1. 🏠 小明的电脑 (小明)
  2. 💼 公司电脑 (Bob)

huinet > 给小明发个消息，说你好
📤 正在发送消息...
✅ 已发送到 "小明"

huinet > 显示和小明的连接状态
📊 与 "小明" 的连接状态:
  状态: ● 已连接
  地址: 192.168.1.100:8000
  最后活动: 刚刚
```

### 场景 2：快捷命令

```
huinet > ls
📋 节点列表:
  ● 小明 (已连接)
  ● Bob (已连接)

huinet > msg 小明 你好，我是 Claude
📤 发送中...
✅ 已发送

huinet > status
📊 我的节点状态:
  名称: 我的电脑
  NodeID: 5HueCGue8dn...
  已连接: 2 个节点

huinet > alias 小明 5HueCGue8dnF7iSBz5sYjXxMxq9
✅ 已设置别名: 小明 = 5HueCGue8dnF7iSBz5sYjXxMxq9
```

---

## 🎨 命令设计

### 基础命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `help` | 显示帮助 | `help` |
| `status` | 查看状态 | `status` |
| `ls` | 列出节点 | `ls` |
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
| `alias <名称> <NodeID>` | 设置别名 | `alias 小明 5HueCG...` |
| `connect <地址>` | 手动连接 | `connect 192.168.1.100:8000` |
| `disconnect <别名>` | 断开连接 | `disconnect 小明` |

### 自然语言支持

| 输入 | 解析为 |
|------|--------|
| "给小明发消息说你好" | `msg 小明 你好` |
| "看看有哪些节点" | `ls` |
| "断开和小明的连接" | `disconnect 小明` |
| "我的状态" | `status` |

---

## 🏗️ 技术实现

### 项目结构

```
huinet-cli/
├── src/
│   ├── commands/           # 命令处理
│   │   ├── alias.ts
│   │   ├── connect.ts
│   │   ├── help.ts
│   │   ├── ls.ts
│   │   ├── msg.ts
│   │   └── status.ts
│   ├── nlp/               # 自然语言处理
│   │   └── parser.ts
│   ├── ui/                # 用户界面
│   │   └── repl.ts        # 交互式命令行
│   ├── storage/           # 数据存储
│   │   └── config.ts      # 配置和别名
│   └── index.ts           # 入口
├── bin/
│   └── huinet             # CLI 入口
└── package.json
```

### 核心代码示例

#### CLI 入口 (bin/huinet)

```bash
#!/usr/bin/env node
require('../dist/index.js');
```

#### 主程序 (src/index.ts)

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { startREPL } from './ui/repl';

const program = new Command();

program
  .name('huinet')
  .description('HuiNet P2P Agent CLI')
  .version('1.0.0')
  .option('-n, --name <name>', 'Agent 名称', 'MyAgent')
  .option('-p, --port <port>', '监听端口', '8000')
  .option('--mdns', '启用 mDNS', true)
  .option('--bootstrap <addresses>', '引导节点地址')
  .action((options) => {
    startREPL(options);
  });

program.parse();
```

#### 交互式界面 (src/ui/repl.ts)

```typescript
import readline from 'readline';
import { HuiNet } from '@huinet/network';

export async function startREPL(options: any) {
  // 创建 HuiNet 实例
  const huinet = new HuiNet({
    listenPort: options.port,
    listenHost: '0.0.0.0',
    enableMDNS: options.mdns,
  });

  // 等待就绪
  await new Promise<void>((resolve) => {
    huinet.on('ready', () => {
      showWelcome(huinet, options.name);
      resolve();
    });
    huinet.start();
  });

  // 创建 REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'huinet > '
  });

  // 显示提示符
  rl.prompt();

  // 处理输入
  rl.on('line', async (input) => {
    const cmd = input.trim();

    // 处理命令
    await handleCommand(huinet, cmd);

    rl.prompt();
  });
}

function showWelcome(huinet: HuiNet, name: string) {
  console.clear();
  console.log(`
╔══════════════════════════════════════════════════╗
║              🌐 HuiNet v1.0.0                   ║
╠══════════════════════════════════════════════════╣
║  名称: ${name.padEnd(42)}║
║  NodeID: ${huinet.getNodeID().substring(0, 16)}...${' '.repeat(20)}║
║  状态: ● 已就绪${' '.repeat(31)}║
╠══════════════════════════════════════════════════╣
║  输入 help 查看命令 | 输入 quit 退出              ║
╚══════════════════════════════════════════════════╝
  `);
}
```

#### 命令处理 (src/commands/index.ts)

```typescript
import { parseNaturalLanguage } from '../nlp/parser';

export async function handleCommand(huinet: HuiNet, input: string) {
  if (!input) return;

  // 尝试解析自然语言
  const parsed = parseNaturalLanguage(input);
  const cmd = parsed.command || input.split(' ')[0];
  const args = parsed.args || input.split(' ').slice(1);

  switch (cmd) {
    case 'help':
      showHelp();
      break;
    case 'status':
      await showStatus(huinet);
      break;
    case 'ls':
      await listNodes(huinet);
      break;
    case 'msg':
      await sendMessage(huinet, args);
      break;
    case 'alias':
      setAlias(args[0], args[1]);
      break;
    case 'quit':
    case 'exit':
      await huinet.stop();
      process.exit(0);
    default:
      console.log(`❓ 未知命令: ${cmd}`);
      console.log('   输入 help 查看可用命令');
  }
}

// 显示状态
async function showStatus(huinet: HuiNet) {
  const routing = huinet.getRoutingTable();
  console.log(`
📊 我的节点状态:
  名称: ${getConfig('name')}
  NodeID: ${huinet.getNodeID()}
  已连接: ${routing.getActiveNodes().size} 个节点
  已知: ${routing.getKnownNodes().size} 个节点
  `);
}

// 列出节点
async function listNodes(huinet: HuiNet) {
  const routing = huinet.getRoutingTable();
  const aliases = getAliases();

  console.log('\n📋 节点列表:');

  routing.getKnownNodes().forEach((node, nodeID) => {
    const alias = aliases[nodeID] || nodeID.substring(0, 16);
    const status = routing.getActiveNodes().has(nodeID) ? '●' : '○';
    console.log(`  ${status} ${alias} (${node.address})`);
  });

  console.log('');
}

// 发送消息
async function sendMessage(huinet: HuiNet, args: string[]) {
  if (args.length < 2) {
    console.log('❌ 用法: msg <别名> <消息内容>');
    return;
  }

  const alias = args[0];
  const message = args.slice(1).join(' ');
  const nodeID = resolveNodeID(alias);

  if (!nodeID) {
    console.log(`❌ 未找到节点: ${alias}`);
    return;
  }

  try {
    await huinet.send(nodeID, { type: 'chat', text: message });
    console.log('✅ 已发送');
  } catch (error) {
    console.log('❌ 发送失败');
  }
}
```

#### 自然语言解析 (src/nlp/parser.ts)

```typescript
interface ParsedCommand {
  command: string;
  args: string[];
}

export function parseNaturalLanguage(input: string): ParsedCommand {
  const patterns = [
    // 发送消息
    {
      regex: /给(.+)发(消息|说|告知)(.+)/,
      handler: (_, alias, __, message) => ({
        command: 'msg',
        args: [alias.trim(), message.trim()]
      })
    },
    // 查看节点
    {
      regex: /(看看|查看|显示)(有哪些)?节点/,
      handler: () => ({ command: 'ls', args: [] })
    },
    // 查看状态
    {
      regex: /(我的)?状态/,
      handler: () => ({ command: 'status', args: [] })
    },
    // 断开连接
    {
      regex: /断开(和)?(.+)的连接/,
      handler: (_, __, alias) => ({
        command: 'disconnect',
        args: [alias.trim()]
      })
    },
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern.regex);
    if (match) {
      return pattern.handler(...match);
    }
  }

  return { command: '', args: [] };
}
```

#### 配置存储 (src/storage/config.ts)

```typescript
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.env.HOME, '.huinet', 'config.json');

interface Config {
  name: string;
  aliases: Record<string, string>;
}

export function getConfig(): Config {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { name: 'MyAgent', aliases: {} };
  }
}

export function setAlias(alias: string, nodeID: string): void {
  const config = getConfig();
  config.aliases[alias] = nodeID;

  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`✅ 已设置别名: ${alias} = ${nodeID.substring(0, 16)}...`);
}

export function resolveNodeID(alias: string): string | null {
  const config = getConfig();
  return config.aliases[alias] || null;
}
```

---

## 📦 package.json 配置

```json
{
  "name": "@huinet/cli",
  "version": "1.0.0",
  "description": "HuiNet P2P Agent CLI Tool",
  "bin": {
    "huinet": "./bin/huinet"
  },
  "dependencies": {
    "@huinet/network": "^1.0.0",
    "commander": "^11.0.0",
    "chalk": "^5.3.0"
  },
  "files": [
    "bin",
    "dist",
    "README.md"
  ]
}
```

---

## 🚀 发布和使用

### 开发者

```bash
# 1. 构建
npm run build

# 2. 本地测试
npm link
huinet

# 3. 发布到 npm
npm publish --access public
```

### 用户

```bash
# 安装
npm install -g @huinet/cli

# 启动
huinet

# 指定名称
huinet --name "小明"

# 指定端口
huinet --port 8001

# 禁用 mDNS（跨互联网）
huinet --no-mdns --bootstrap "server.com:9000"
```

---

## 📋 快速开始指南

### 第一次使用

```bash
# 1. 安装
npm install -g @huinet/cli

# 2. 启动（会自动生成配置）
huinet

# 3. 查看状态
huinet > status

# 4. 等待其他节点（同一局域网会自动发现）
```

### 多节点通信

**电脑 A：**
```bash
huinet --name "Alice"
huinet > ls           # 查看发现的节点
huinet > alias Bob 7KjdBf2k4pr...   # 设置别名
huinet > msg Bob 你好
```

**电脑 B：**
```bash
huinet --name "Bob"
huinet > msg Alice 你好Alice
```

---

## 🎯 下一步

1. 创建 CLI 包结构
2. 实现核心命令
3. 添加自然语言解析
4. 测试和完善
5. 发布到 npm

这个方案让用户无需编写代码，直接通过命令行交互使用 HuiNet！
