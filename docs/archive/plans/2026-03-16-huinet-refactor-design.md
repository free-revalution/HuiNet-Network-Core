# HuiNet 重构设计文档

**日期：** 2026-03-16
**目标：** 全面重构 HuiNet，修复 Bug，分离 SDK 和 CLI，使其成为易用的 P2P 网络库

---

## 一、项目定位

### 1.1 核心定位

HuiNet 是一个 **P2P 网络库/SDK**，供现有的 Agent（如 Claude Code、AutoGPT 等）集成使用，实现 Agent 之间的互联通信。

**不是：**
- 独立的 Agent 运行环境
- 自带 Agent 实现的完整系统

**而是：**
- 网络通信库
- 供 Agent 集成的基础设施
- 带有测试 CLI 的 SDK

### 1.2 设计原则

1. **SDK 第一** - 核心是网络库，CLI 只是测试工具
2. **简单集成** - Agent 只需几行代码即可使用
3. **清晰分离** - SDK 和 CLI 代码完全分离
4. **YAGNI** - 移除不必要功能，保持简洁

---

## 二、代码架构

### 2.1 目录结构

```
HuiNet/
├── src/                        # 核心 SDK
│   ├── core/                   # 核心功能
│   │   ├── HuiNetNode.ts      # 主节点类
│   │   ├── events.ts          # 事件类型定义
│   │   └── NodeConfig.ts      # 配置类型
│   ├── transport/              # 传输层
│   │   ├── TCPClient.ts       # TCP 客户端
│   │   ├── TCPServer.ts       # TCP 服务器
│   │   └── pool.ts            # 连接池
│   ├── routing/                # 路由
│   │   └── table.ts           # 路由表
│   ├── crypto/                 # 加密
│   │   ├── keypair.ts         # 密钥对
│   │   └── nodeid.ts          # NodeID 派生
│   ├── discovery/              # 服务发现
│   │   └── mdns.ts            # mDNS 实现
│   ├── types/                  # 类型定义
│   │   └── index.ts
│   └── index.ts                # 公开 API 导出
├── cli/                        # 测试工具（独立）
│   ├── commands/               # 命令处理
│   │   ├── index.ts           # 命令路由
│   │   ├── handlers.ts        # 业务逻辑
│   │   └── parser.ts          # 参数解析
│   ├── ui/                     # UI 显示
│   │   ├── display.ts         # 显示函数
│   │   ├── event-handlers.ts  # 事件显示
│   │   └── command-output.ts  # 命令输出
│   ├── storage/                # 配置存储
│   │   └── config.ts
│   └── index.ts                # CLI 入口
├── examples/                   # Agent 集成示例
│   ├── claude-code-integration.ts
│   ├── simple-agent.ts
│   └── two-node-communication.ts
├── tests/                      # 测试
│   ├── unit/                  # 单元测试
│   ├── integration/           # 集成测试
│   └── e2e/                   # E2E 测试
├── docs/                       # 文档
│   ├── agent-integration.md
│   └── api-reference.md
└── package.json
```

### 2.2 依赖关系

```
CLI ──导入──> SDK ──不依赖──> CLI
Agent ──导入──> SDK ──不依赖──> Agent
```

**关键规则：**
- SDK 不依赖 CLI
- SDK 不依赖 Agent
- CLI 和 Agent 都依赖 SDK

---

## 三、Agent 集成 API

### 3.1 基础集成

最简单的集成，只需几行代码：

```typescript
import { HuiNet } from '@huinet/network';

// 创建节点
const huinet = new HuiNet({
  listenPort: 8000,
  enableMDNS: true
});

// 监听消息
huinet.on('message', (from, data) => {
  console.log(`收到来自 ${from} 的消息:`, data);
});

// 发送消息
await huinet.send(targetNodeID, {
  type: 'chat',
  text: 'Hello!'
});

// 启动
await huinet.start();
```

### 3.2 高级集成 - Claude Code

```typescript
import { HuiNet } from '@huinet/network';
import { Tool } from '@anthropic-ai/sdk';

class ClaudeCodeHuiNetIntegration {
  private huinet: HuiNet;

  constructor() {
    this.huinet = new HuiNet({
      listenPort: 8000,
      enableMDNS: true
    });

    this.setupMessageHandlers();
  }

  private setupMessageHandlers() {
    // 处理来自其他 Agent 的工具执行请求
    this.huinet.on('message', async (from, data) => {
      if (data.type === 'tool-execution') {
        const result = await this.executeTool(data.tool, data.params);
        await this.huinet.send(from, {
          type: 'tool-result',
          id: data.id,
          result
        });
      }
    });

    // 处理节点连接事件
    this.huinet.on('peerConnected', (nodeID) => {
      console.log(`Agent connected: ${nodeID}`);
    });
  }

  // 为 Claude Code 提供工具
  getTools(): Tool[] {
    return [
      {
        name: 'huinet_send_message',
        description: 'Send message to another agent',
        input_schema: {
          type: 'object',
          properties: {
            agent: { type: 'string', description: 'Target agent name' },
            message: { type: 'string', description: 'Message to send' }
          },
          required: ['agent', 'message']
        }
      },
      {
        name: 'huinet_list_agents',
        description: 'List all connected agents',
        input_schema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'huinet_execute_on_agent',
        description: 'Execute a tool on another agent',
        input_schema: {
          type: 'object',
          properties: {
            agent: { type: 'string' },
            tool: { type: 'string' },
            params: { type: 'object' }
          },
          required: ['agent', 'tool', 'params']
        }
      }
    ];
  }

  async executeTool(tool: string, params: any): Promise<any> {
    // 执行工具并返回结果
    return { result: 'success' };
  }
}
```

### 3.3 API 接口设计

```typescript
// src/index.ts - 公开 API
export { HuiNet } from './core/HuiNetNode';
export type {
  HuiNetConfig,
  NodeID,
  MessageData,
  ConnectionEvent
} from './types';

// 核心 API
export interface HuiNetEvents {
  'ready': () => void;
  'message': (from: NodeID, data: MessageData) => void;
  'peerConnected': (nodeID: NodeID) => void;
  'peerDisconnected': (nodeID: NodeID) => void;
  'nodeDiscovered': (node: DiscoveredNode) => void;
  'error': (error: Error) => void;
}

export class HuiNet extends EventEmitter<HuiNetEvents> {
  // 配置和启动
  constructor(config: HuiNetConfig);
  async start(): Promise<void>;
  async stop(): Promise<void>;

  // 消息
  async send(targetNodeID: NodeID, message: any): Promise<void>;
  on(event: 'message', handler: (from: NodeID, data: any) => void): this;

  // 连接
  async connectToNode(host: string, port: number): Promise<boolean>;

  // 查询
  getNodeID(): NodeID;
  getRoutingTable(): RoutingTable;
  getConnectedNodes(): Node[];
}
```

---

## 四、Bug 修复方案

### 4.1 显示 `[object Object]`

**问题：** `node.addresses[0]` 是对象，直接显示为 `[object Object]`

**修复：**
```typescript
// cli/commands/handlers.ts
const address = node.addresses[0];
const addressStr = address
  ? `${address.host}:${address.port}`
  : 'N/A';
console.log(`      Address: ${addressStr}`);
```

### 4.2 连接显示成功但实际未连接

**问题：** 添加到路由表就显示成功，没有验证 TCP 连接

**修复：**
```typescript
// src/core/HuiNetNode.ts
async connectToNode(host: string, port: number): Promise<boolean> {
  const client = new TCPClient({ nodeId: this.nodeID });
  const clientKey = `${host}:${port}`;

  try {
    await client.connect(host, port);

    // 验证连接状态
    if (!client.isConnected()) {
      return false;
    }

    // 连接成功，添加到路由表
    this.routingTable.addKnownNode({
      nodeID: clientKey,
      addresses: [{ host, port, type: TransportType.TCP }],
      state: NodeState.ONLINE
    });

    this.clients.set(clientKey, client);
    this.emit('peerConnected', clientKey);
    return true;

  } catch (error) {
    return false;
  }
}
```

### 4.3 重复打印欢迎界面

**问题：** `showWelcome` 被调用多次，每次都 `console.clear()`

**修复：**
```typescript
// cli/repl.ts
let welcomeShown = false;

huinet.on('ready', () => {
  clearTimeout(timeout);

  // 只显示一次
  if (!welcomeShown) {
    showWelcome(huinet, options.name);
    welcomeShown = true;
  }

  showMessage('success', 'HuiNet is ready!');
  resolve();
});
```

### 4.4 发送消息失败

**问题：** NodeID 在路由表中但找不到

**修复：**
```typescript
// src/core/HuiNetNode.ts
async send(targetNodeID: string, message: any): Promise<void> {
  // 检查路由表
  const knownNode = this.routingTable.getKnownNode(targetNodeID);

  if (!knownNode || knownNode.addresses.length === 0) {
    throw new Error(`Unknown node: ${targetNodeID}`);
  }

  // 检查连接状态
  const client = this.clients.get(clientKey);
  if (!client || !client.isConnected()) {
    // 尝试重新连接
    await this.connectToNode(host, port);
  }

  // 发送消息
  client.send(Buffer.from(messageData));
}
```

---

## 五、代码重构

### 5.1 移除全局变量

**当前：**
```typescript
(global as any).__huinet = huinet;
(global as any).__repl = rl;
(global as any).__config = config;
```

**修复后：**
```typescript
// 创建 REPL 上下文
interface REPLContext {
  huinet: HuiNet;
  config: ConfigManager;
  rl: readline.Interface;
}

const context: REPLContext = {
  huinet,
  config,
  rl
};

// 传递上下文
await handleCommand(context, cmd);
```

### 5.2 分离显示逻辑和业务逻辑

**当前（混乱）：**
```typescript
export async function sendMessage(huinet, config, args) {
  // 业务逻辑
  const nodeID = resolveNodeID(config, alias);
  await huinet.send(nodeID, message);

  // 显示逻辑混杂
  console.log('');
  showMessage('info', 'Sending...');
  showMessage('success', 'Sent!');
  console.log('');
}
```

**修复后：**
```typescript
// cli/commands/handlers.ts - 纯业务逻辑
export async function sendMessage(
  huinet: HuiNet,
  target: string,
  message: string
): Promise<void> {
  const nodeID = await resolveNodeID(huinet, target);
  await huinet.send(nodeID, { type: 'chat', text: message });
}

// cli/ui/command-output.ts - 纯显示逻辑
export async function displaySendCommand(
  context: REPLContext,
  args: string[]
): Promise<void> {
  try {
    const [target, ...messageParts] = args;
    const message = messageParts.join(' ');

    await sendMessage(context.huinet, target, message);
    showCommandSuccess('Message sent!');
  } catch (error) {
    showCommandError(`Send failed: ${error.message}`);
  }
}
```

### 5.3 事件处理分离

```typescript
// cli/ui/event-handlers.ts
export function setupEventHandlers(context: REPLContext): void {
  const { huinet, rl } = context;

  huinet.on('peerConnected', (nodeID) => {
    showPeerConnected(nodeID, context.config);
    rl.prompt();
  });

  huinet.on('message', (from, data) => {
    showReceivedMessage(from, data, context.config);
    rl.prompt();
  });
}

// cli/ui/event-display.ts
function showPeerConnected(nodeID: string, config: ConfigManager): void {
  const alias = getAlias(nodeID, config);
  console.log('');
  showMessage('success', `Connected to: ${alias || nodeID.substring(0, 20)}...`);
  console.log('');
}
```

---

## 六、数据流设计

### 6.1 消息流程

```
Agent A                          Agent B
   │                               │
   │ 1. huinet.send(target, msg)   │
   ├──────────────────────────────>│ TCP
   │                               │ 2. Server 接收
   │                               │ 3. 解析 JSON
   │                               │ 4. emit('message')
   │                               │ 5. Agent 监听
   │                               │ 6. Agent 处理
   │<──────────────────────────────┤
   │ 7. 响应（可选）                 │
```

### 6.2 连接建立流程

```
Agent A                          Agent B
   │                               │
   │ 1. connect(host, port)        │
   ├──────────────────────────────>│ TCP
   │                               │ 2. Server 接受
   │                               │ 3. connectionsBySocket[socket]
   │                               │ 4. emit('connection')
   │                               │
   │ 5. 连接成功                    │
   │ 6. 路由表.addKnownNode()       │
   │ 7. emit('peerConnected')      │
   │                               │
```

### 6.3 节点发现流程（mDNS）

```
Node A                           Node B
   │                               │
   │ 1. 启动 mDNS                   │
   │ 2. 加入 224.0.0.114:43000     │
   │                               │ 3. 同样启动
   │                               │ 4. 发送 announce
   │<──────────────────────────────┤ UDP 多播
   │ 5. 收到 announce               │
   │ 6. 路由表.addKnownNode()       │
   │ 7. 自动连接                    │
   ├──────────────────────────────>│ TCP
   │ 8. 连接建立                    │
```

---

## 七、错误处理

### 7.1 分层错误处理

```typescript
// 核心 SDK 层 - 抛出具体错误
export class HuiNetError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'HuiNetError';
  }
}

export class ConnectionError extends HuiNetError {
  constructor(target: string, reason: string) {
    super('CONNECTION_FAILED', `Failed to connect to ${target}`, { target, reason });
  }
}

export class MessageError extends HuiNetError {
  constructor(target: string, reason: string) {
    super('MESSAGE_FAILED', `Failed to send message to ${target}`, { target, reason });
  }
}
```

### 7.2 CLI 错误显示

```typescript
// CLI 层 - 友好显示
async function displayConnect(context: REPLContext, args: string[]): Promise<void> {
  try {
    const [address] = args;
    const [host, port] = parseAddress(address);

    const success = await context.huinet.connectToNode(host, port);

    if (success) {
      showCommandSuccess(`Connected to ${address}`);
    } else {
      showCommandError(`Failed to connect to ${address}`);
    }
  } catch (error) {
    if (error instanceof ConnectionError) {
      showCommandError(`Connection failed: ${error.details.reason}`);
    } else if (error instanceof AddressParseError) {
      showCommandError(`Invalid address format. Use host:port`);
    } else {
      showCommandError('Unexpected error occurred');
    }
  }
}
```

### 7.3 自动重试

```typescript
class HuiNetNode {
  private retryConfig = {
    maxRetries: 3,
    backoffMs: 1000
  };

  async connectWithRetry(host: string, port: number): Promise<boolean> {
    for (let i = 0; i < this.retryConfig.maxRetries; i++) {
      try {
        const result = await this.connectToNode(host, port);
        if (result) return true;
      } catch (error) {
        if (i === this.retryConfig.maxRetries - 1) {
          throw new ConnectionError(`${host}:${port}`, 'Max retries exceeded');
        }
        await this.sleep(this.retryConfig.backoffMs * (i + 1));
      }
    }
    return false;
  }
}
```

---

## 八、测试策略

### 8.1 测试结构

```
tests/
├── unit/                    # 单元测试
│   ├── transport/
│   │   ├── client.test.ts
│   │   └── server.test.ts
│   ├── routing/
│   │   └── table.test.ts
│   └── crypto/
│       └── keypair.test.ts
├── integration/             # 集成测试
│   ├── two-node.test.ts
│   ├── message-send.test.ts
│   └── mdns-discovery.test.ts
└── e2e/                     # E2E 测试
    └── full-scenario.test.ts
```

### 8.2 核心测试用例

**单元测试示例：**
```typescript
// tests/unit/transport/client.test.ts
describe('TCPClient', () => {
  it('should connect to server', async () => {
    const server = createTestServer(8001);
    const client = new TCPClient({ nodeId: 'test' });

    await client.connect('127.0.0.1', 8001);

    expect(client.isConnected()).toBe(true);

    server.close();
  });

  it('should send and receive data', async () => {
    const server = createTestServer(8001);
    const client = new TCPClient({ nodeId: 'test' });

    await client.connect('127.0.0.1', 8001);

    const received = new Promise(resolve => {
      client.on('message', resolve);
    });

    client.send(Buffer.from(JSON.stringify({ test: 'data' })));

    const result = await received;
    expect(result).toEqual({ test: 'data' });

    server.close();
  });

  it('should handle connection errors', async () => {
    const client = new TCPClient({ nodeId: 'test' });

    await expect(
      client.connect('127.0.0.1', 9999)
    ).rejects.toThrow();
  });
});
```

**集成测试示例：**
```typescript
// tests/integration/two-node.test.ts
describe('Two Node Communication', () => {
  let node1: HuiNet;
  let node2: HuiNet;

  beforeEach(async () => {
    node1 = new HuiNet({ port: 8001, enableMDNS: false });
    node2 = new HuiNet({ port: 8002, enableMDNS: false });

    await node1.start();
    await node2.start();
  });

  afterEach(async () => {
    await node1.stop();
    await node2.stop();
  });

  it('should establish connection', async () => {
    const result = await node1.connectToNode('127.0.0.1', 8002);

    expect(result).toBe(true);

    const nodes = node1.getRoutingTable().getKnownNodes();
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('should send messages bidirectionally', async () => {
    await node1.connectToNode('127.0.0.1', 8002);

    const msg1 = new Promise(resolve => {
      node2.on('message', (from, data) => resolve(data));
    });

    await node1.send('127.0.0.1:8002', { type: 'test', text: 'hello' });

    const result1 = await msg1;
    expect(result1.text).toBe('hello');

    // Test reverse direction
    const msg2 = new Promise(resolve => {
      node1.on('message', (from, data) => resolve(data));
    });

    await node2.send('127.0.0.1:8001', { type: 'test', text: 'hi back' });

    const result2 = await msg2;
    expect(result2.text).toBe('hi back');
  });
});
```

---

## 九、实施计划

### 阶段 1：修复核心 Bug（1-2小时）

**任务清单：**
- [ ] 修复 `ls` 命令的 `[object Object]` 显示
- [ ] 修复 `connectToNode` 连接验证逻辑
- [ ] 修复重复打印欢迎界面
- [ ] 修复消息发送失败问题

**验证标准：**
- `ls` 正确显示地址
- 连接成功后真正可通信
- 启动时只显示一次欢迎界面
- 消息能成功发送和接收

### 阶段 2：代码重构（3-4小时）

**任务清单：**
- [ ] 移除所有全局变量
- [ ] 创建 REPLContext 接口
- [ ] 分离显示逻辑到 `cli/ui/`
- [ ] 分离业务逻辑到 `cli/commands/`
- [ ] 重组事件处理到独立模块

**验证标准：**
- 无全局变量
- 显示和业务逻辑清晰分离
- 代码结构清晰易读

### 阶段 3：架构重组（4-6小时）

**任务清单：**
- [ ] 创建新的目录结构
- [ ] 重命名和移动文件
- [ ] 创建清晰的核心 API
- [ ] 编写 Agent 集成示例
- [ ] 更新 package.json 导出

**验证标准：**
- 目录结构符合设计
- SDK 和 CLI 完全分离
- 可以独立导入 SDK
- 示例代码可以运行

### 阶段 4：测试和文档（2-3小时）

**任务清单：**
- [ ] 添加单元测试（覆盖率 > 70%）
- [ ] 添加集成测试
- [ ] 编写 API 文档
- [ ] 编写 Agent 集成指南
- [ ] 更新 README

**验证标准：**
- 测试通过
- 文档完整
- 示例可运行

### 总时间估算：10-15小时

---

## 十、成功标准

重构完成后，HuiNet 应该：

1. **功能完整**
   - ✅ 两个节点能连接并通信
   - ✅ 消息发送接收正常
   - ✅ 节点发现工作正常

2. **代码清晰**
   - ✅ SDK 和 CLI 完全分离
   - ✅ 无全局变量
   - ✅ 显示和业务逻辑分离
   - ✅ 代码结构清晰易读

3. **易于集成**
   - ✅ Agent 只需几行代码即可使用
   - ✅ API 简单直观
   - ✅ 有完整的集成示例

4. **测试完备**
   - ✅ 单元测试覆盖率 > 70%
   - ✅ 有集成测试
   - ✅ 有 E2E 测试

5. **文档完整**
   - ✅ API 文档
   - ✅ Agent 集成指南
   - ✅ 使用示例
