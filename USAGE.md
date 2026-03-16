# HuiNet 使用指南

让两台电脑上的 Agent 互相连接和通信的完整教程

## 📚 目录

1. [快速开始](#快速开始)
2. [场景 1：同一台电脑测试](#场景-1同一台电脑测试)
3. [场景 2：同一局域网两台电脑](#场景-2同一局域网两台电脑)
4. [场景 3：跨互联网连接](#场景-3跨互联网连接)
5. [常见问题](#常见问题)

---

## 🚀 快速开始

### 环境准备

```bash
# 1. 克隆项目
git clone https://github.com/free-revalution/HuiNet-Network-Core.git
cd HuiNet-Network-Core

# 2. 安装依赖
npm install

# 3. 编译项目
npm run build
```

---

## 场景 1：同一台电脑测试

这是最简单的测试方式，适合快速验证功能。

### 步骤

**1. 运行双节点测试：**

```bash
npx ts-node examples/two-node-test.ts
```

**2. 预期输出：**

```
╔══════════════════════════════════════════════════╗
║       HuiNet 双节点通信测试                      ║
╚══════════════════════════════════════════════════╝

📌 步骤 1: 创建节点 Alice
🔧 正在创建节点: Alice (端口 8001)
✅ Alice 就绪! NodeID: 5HueCGue8dn...

📌 步骤 2: 创建节点 Bob（使用 Alice 作为引导节点）
🔧 正在创建节点: Bob (端口 8002)
✅ Bob 就绪! NodeID: 7KjdBf2k4pr...

⏳ 等待节点建立连接...
🔍 Bob 发现节点: 5HueCGue8dn...
✨ Bob 连接到: 5HueCGue8dn...

📊 步骤 3: 查看节点状态
--- Alice 的路由表 ---
核心节点: 0
活跃节点: 1
已知节点: 1

✅ 测试完成！
```

---

## 场景 2：同一局域网两台电脑

### 网络拓扑

```
┌─────────────────┐         ┌─────────────────┐
│   电脑 A         │         │   电脑 B         │
│   192.168.1.100  │         │   192.168.1.101  │
│   Agent-Alice    │ <──────> │   Agent-Bob      │
│   端口: 8000     │   WiFi   │   端口: 8001     │
└─────────────────┘         └─────────────────┘
```

### 步骤

#### 电脑 A（Alice）配置

**1. 创建文件 `alice.ts`：**

```typescript
import { HuiNet } from './src';

async function main() {
  const alice = new HuiNet({
    listenPort: 8000,
    listenHost: '0.0.0.0',  // 重要：监听所有网络接口
    enableMDNS: true,        // 启用局域网自动发现
  });

  // 监听事件
  alice.on('ready', () => {
    console.log('✅ Alice 就绪!');
    console.log('NodeID:', alice.getNodeID());
    console.log('本机 IP: 192.168.1.100');  // 替换为你的实际 IP
  });

  alice.on('nodeDiscovered', (node) => {
    console.log('🔍 发现节点:', node.nodeId);
  });

  alice.on('peerConnected', (nodeID) => {
    console.log('✨ 已连接:', nodeID);
  });

  alice.on('peerDisconnected', (nodeID) => {
    console.log('💔 断开连接:', nodeID);
  });

  await alice.start();

  // 保持运行
  process.on('SIGINT', async () => {
    await alice.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

**2. 运行 Alice：**

```bash
npx ts-node alice.ts
```

#### 电脑 B（Bob）配置

**1. 创建文件 `bob.ts`：**

```typescript
import { HuiNet } from './src';

async function main() {
  const bob = new HuiNet({
    listenPort: 8001,
    listenHost: '0.0.0.0',
    enableMDNS: true,  // 两个节点都启用 mDNS
  });

  bob.on('ready', () => {
    console.log('✅ Bob 就绪!');
    console.log('NodeID:', bob.getNodeID());
  });

  bob.on('nodeDiscovered', (node) => {
    console.log('🔍 发现节点:', node.nodeId);
  });

  bob.on('peerConnected', (nodeID) => {
    console.log('✨ 已连接:', nodeID);

    // 连接后发送消息
    setTimeout(async () => {
      await bob.send(nodeID, {
        type: 'greeting',
        from: 'Bob',
        text: 'Hello Alice! 我在电脑 B 上',
      });
    }, 1000);
  });

  await bob.start();

  process.on('SIGINT', async () => {
    await bob.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

**2. 运行 Bob：**

```bash
npx ts-node bob.ts
```

### 预期结果

两个节点会通过 mDNS 自动发现对方：

```
# 电脑 A 输出：
✅ Alice 就绪!
NodeID: 5HueCGue8dn...
🔍 发现节点: 7KjdBf2k4pr...
✨ 已连接: 7KjdBf2k4pr...

# 电脑 B 输出：
✅ Bob 就绪!
NodeID: 7KjdBf2k4pr...
🔍 发现节点: 5HueCGue8dn...
✨ 已连接: 5HueCGue8dn...
```

---

## 场景 3：跨互联网连接

这是最复杂的场景，需要处理 NAT 穿透。

### 网络拓扑

```
┌─────────────────┐              ┌─────────────────┐
│   家里电脑 A     │              │   公司电脑 B     │
│   NAT 后面       │              │   NAT 后面       │
│   Agent-Home     │ <──────────> │   Agent-Office  │
└─────────────────┘    互联网    └─────────────────┘
        │                              │
        └──────────────┬───────────────┘
                       │
              ┌────────▼────────┐
              │  引导服务器      │
              │  Bootstrap      │
              │  公网 IP        │
              └─────────────────┘
```

### 步骤

#### 1. 部署引导服务器（可选）

如果你有公网服务器，可以部署一个引导节点：

```typescript
// bootstrap-server.ts
import { HuiNet } from './src';

async function main() {
  const bootstrap = new HuiNet({
    listenPort: 9000,
    listenHost: '0.0.0.0',
    enableMDNS: false,
  });

  bootstrap.on('ready', () => {
    console.log('✅ 引导服务器就绪!');
    console.log('NodeID:', bootstrap.getNodeID());
    console.log('公网地址: your-server-ip:9000');
  });

  await bootstrap.start();
}

main().catch(console.error);
```

#### 2. 电脑 A（家里）配置

```typescript
import { HuiNet } from './src';

async function main() {
  const homeAgent = new HuiNet({
    listenPort: 8000,
    listenHost: '0.0.0.0',
    enableMDNS: false,  // 跨互联网关闭 mDNS
    bootstrapNodes: [
      'your-server-ip:9000'  // 引导服务器地址
    ],
  });

  homeAgent.on('ready', () => {
    console.log('✅ 家里 Agent 就绪!');
    console.log('NodeID:', homeAgent.getNodeID());
  });

  homeAgent.on('peerConnected', (nodeID) => {
    console.log('✨ 连接到:', nodeID);
  });

  await homeAgent.start();
}

main().catch(console.error);
```

#### 3. 电脑 B（公司）配置

```typescript
import { HuiNet } from './src';

async function main() {
  const officeAgent = new HuiNet({
    listenPort: 8001,
    listenHost: '0.0.0.0',
    enableMDNS: false,
    bootstrapNodes: [
      'your-server-ip:9000'
    ],
  });

  officeAgent.on('ready', () => {
    console.log('✅ 公司 Agent 就绪!');
    console.log('NodeID:', officeAgent.getNodeID());
  });

  officeAgent.on('peerConnected', (nodeID) => {
    console.log('✨ 连接到:', nodeID);

    // 发送消息测试
    officeAgent.send(nodeID, {
      type: 'chat',
      from: 'Office',
      text: '你好，我在公司',
    });
  });

  await officeAgent.start();
}

main().catch(console.error);
```

---

## 🔧 完整的 Agent 示例

### 带消息处理的完整实现

```typescript
import { HuiNet } from './src';

interface AgentMessage {
  type: 'chat' | 'file' | 'command';
  from: string;
  text?: string;
  data?: any;
  timestamp: number;
}

class MyAgent {
  private huinet: HuiNet;
  private name: string;

  constructor(name: string, port: number) {
    this.name = name;
    this.huinet = new HuiNet({
      listenPort: port,
      listenHost: '0.0.0.0',
      enableMDNS: true,
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    // 节点就绪
    this.huinet.on('ready', () => {
      console.log(`✅ ${this.name} 就绪!`);
      console.log(`NodeID: ${this.huinet.getNodeID()}`);
    });

    // 发现新节点
    this.huinet.on('nodeDiscovered', (node) => {
      console.log(`🔍 发现节点: ${node.nodeId}`);
    });

    // 连接建立
    this.huinet.on('peerConnected', (nodeID) => {
      console.log(`✨ 已连接: ${nodeID}`);
    });

    // 连接断开
    this.huinet.on('peerDisconnected', (nodeID) => {
      console.log(`💔 断开: ${nodeID}`);
    });
  }

  async start() {
    await this.huinet.start();
  }

  async stop() {
    await this.huinet.stop();
  }

  // 发送聊天消息
  async sendChat(targetNodeID: string, text: string) {
    const message: AgentMessage = {
      type: 'chat',
      from: this.name,
      text,
      timestamp: Date.now(),
    };

    await this.huinet.send(targetNodeID, message);
    console.log(`📤 已发送: ${text}`);
  }

  // 发送命令
  async sendCommand(targetNodeID: string, command: string, args: any) {
    const message: AgentMessage = {
      type: 'command',
      from: this.name,
      data: { command, args },
      timestamp: Date.now(),
    };

    await this.huinet.send(targetNodeID, message);
  }

  getNodeID() {
    return this.huinet.getNodeID();
  }
}

// 使用示例
async function main() {
  const agent = new MyAgent('Agent-Alice', 8000);
  await agent.start();

  // 获取其他节点的 NodeID 后发送消息
  const targetNodeID = '7KjdBf2k4pr...';  // 替换为实际的 NodeID
  await agent.sendChat(targetNodeID, 'Hello!');

  process.on('SIGINT', async () => {
    await agent.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

---

## ❓ 常见问题

### Q1: 节点无法互相发现

**原因：** 防火墙阻止了端口

**解决：**
```bash
# macOS/Linux
sudo ufw allow 8000/tcp

# Windows
# 在防火墙设置中允许端口 8000
```

### Q2: mDNS 不工作

**原因：** 某些网络不允许 mDNS 组播

**解决：** 使用引导节点手动连接：
```typescript
const agent = new HuiNet({
  listenPort: 8000,
  enableMDNS: false,  // 关闭 mDNS
  bootstrapNodes: ['192.168.1.100:8000'],  // 手动指定
});
```

### Q3: 跨互联网无法连接

**原因：** NAT 阻止了入站连接

**解决：**
1. 使用引导服务器
2. 配置端口转发（UPnP 或手动）
3. 使用 STUN 发现公网地址

### Q4: 如何获取本机 IP

```bash
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig
```

### Q5: 端口已被占用

```bash
# 查找占用端口的进程
# macOS/Linux
lsof -i :8000

# 杀死进程
kill -9 <PID>

# 或者使用不同的端口
const agent = new HuiNet({ listenPort: 8001 });
```

---

## 📚 下一步

- 查看 [API 文档](https://github.com/free-revalution/HuiNet-Network-Core#api-reference)
- 阅读 [架构设计](https://github.com/free-revalution/HuiNet-Network-Core#architecture)
- 加入社区讨论

---

**祝你使用愉快！如有问题，请在 GitHub 提 issue。** 🎉
