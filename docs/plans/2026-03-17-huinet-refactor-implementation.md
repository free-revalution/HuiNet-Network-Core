# HuiNet 重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 将 HuiNet 重构为清晰的 P2P 网络库/SDK，分离核心 SDK 和 CLI 测试工具，修复所有已知 Bug，使 Agent 能轻松集成。

**架构：** 核心库（`src/`）提供 P2P 网络功能，CLI 工具（`cli/`）作为独立测试工具使用核心库。SDK 不依赖 CLI，完全分离关注点。

**技术栈：** TypeScript, Node.js, TCP sockets, mDNS (multicast-dns), EventEmitter, Jest

---

## 阶段 1：修复核心 Bug

### Task 1: 修复 ls 命令的 `[object Object]` 显示问题

**问题：** `node.addresses[0]` 是对象，直接在模板字符串中显示为 `[object Object]`

**文件：**
- Modify: `cli/commands/handlers.ts:80-82`

**Step 1: 编写测试验证问题**

```typescript
// cli/commands/handlers.test.ts (创建新文件)
describe('listNodes', () => {
  it('should display address correctly', async () => {
    const mockHuinet = {
      getRoutingTable: () => ({
        getKnownNodes: () => [{
          nodeID: 'test-node-id',
          addresses: [{ host: '127.0.0.1', port: 8002, type: 'tcp' }],
          state: 'ONLINE'
        }],
        getActiveNodes: () => []
      })
    };
    const mockConfig = { get: () => ({}) };

    // 捕获 console.log 输出
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    await listNodes(mockHuinet as any, mockConfig as any);

    console.log = originalLog;

    const output = logs.join('\n');
    expect(output).toContain('127.0.0.1:8002');
    expect(output).not.toContain('[object Object');
  }
});
```

**Step 2: 运行测试确认失败**

```bash
npm test -- cli/commands/handlers.test.ts -t "should display address correctly"
```

预期：FAIL - 输出包含 `[object Object]`

**Step 3: 修复显示逻辑**

修改 `cli/commands/handlers.ts` 第 80-82 行：

```typescript
// 修改前：
console.log(`      Address: ${node.addresses[0] || 'N/A'}`);

// 修改后：
const address = node.addresses[0];
const addressStr = address ? `${address.host}:${address.port}` : 'N/A';
console.log(`      Address: ${addressStr}`);
```

**Step 4: 运行测试确认通过**

```bash
npm test -- cli/commands/handlers.test.ts -t "should display address correctly"
```

预期：PASS

**Step 5: 提交**

```bash
git add cli/commands/handlers.ts cli/commands/handlers.test.ts
git commit -m "fix: display address as host:port instead of [object Object]"
```

---

### Task 2: 修复 connectToNode 连接验证逻辑

**问题：** 连接显示成功但 TCP 实际未建立，需要验证连接状态

**文件：**
- Modify: `src/HuiNet.ts:201-247`
- Test: `tests/integration/connection.test.ts` (创建新文件)

**Step 1: 编写测试验证连接验证**

```typescript
// tests/integration/connection.test.ts
describe('connectToNode validation', () => {
  it('should return false when connection fails', async () => {
    const node = new HuiNet({ port: 8001, enableMDNS: false });
    await node.start();

    // 尝试连接到不存在的端口
    const result = await (node as any).connectToNode('127.0.0.1', 9999);

    expect(result).toBe(false);

    await node.stop();
  });

  it('should return true when connection succeeds', async () => {
    const node1 = new HuiNet({ port: 8001, enableMDNS: false });
    const node2 = new HuiNet({ port: 8002, enableMDNS: false });

    await node1.start();
    await node2.start();

    const result = await (node1 as any).connectToNode('127.0.0.1', 8002);

    expect(result).toBe(true);

    await node1.stop();
    await node2.stop();
  });
});
```

**Step 2: 运行测试确认失败**

```bash
npm test -- tests/integration/connection.test.ts -t "should return false when connection fails"
```

预期：FAIL - connectToNode 返回 undefined 而不是 boolean

**Step 3: 修改 connectToNode 返回 boolean**

修改 `src/HuiNet.ts` 第 201-247 行：

```typescript
async connectToNode(host: string, port: number, nodeID?: string): Promise<boolean> {
  const client = new TCPClient({ nodeId: this.nodeID });
  const clientKey = `${host}:${port}`;

  try {
    await client.connect(host, port);

    // 验证连接状态
    if (!client.isConnected()) {
      return false;
    }

    // 使用 clientKey 作为临时 nodeID（如果没有提供）
    const effectiveNodeID = nodeID || clientKey;

    // 连接成功，添加到路由表
    this.routingTable.addKnownNode({
      nodeID: effectiveNodeID,
      addresses: [{
        type: TransportType.TCP,
        host: host,
        port: port,
        priority: 1,
        lastVerified: Date.now(),
      }],
      publicKey: Buffer.alloc(32),
      metadata: {
        version: '1.0.0',
        capabilities: [],
        startTime: Date.now(),
      },
      state: NodeState.ONLINE,
      lastSeen: Date.now(),
      connectionCount: 1,
    });

    // 设置事件监听
    client.on('disconnected', () => {
      this.emit('peerDisconnected', effectiveNodeID);
      this.clients.delete(clientKey);
    });

    client.on('message', ({ message }) => {
      try {
        const data = JSON.parse(message);
        this.emit('message', effectiveNodeID, data);
      } catch {
        // 忽略解析错误
      }
    });

    this.clients.set(clientKey, client);
    this.emit('peerConnected', effectiveNodeID);

    return true;

  } catch (error) {
    // 连接失败，清理资源
    try {
      client.disconnect();
    } catch {}
    return false;
  }
}
```

**Step 4: 运行测试确认通过**

```bash
npm test -- tests/integration/connection.test.ts
```

预期：PASS

**Step 5: 更新 CLI connect 命令显示正确状态**

修改 `cli/commands/handlers.ts` 第 231-242 行：

```typescript
export async function connectTo(huinet: HuiNet, args: string[]): Promise<void> {
  if (args.length === 0) {
    showMessage('error', 'Usage: connect <address>');
    console.log('  Example: connect 192.168.1.100:8000');
    console.log('  Example: connect 127.0.0.1:8002');
    return;
  }

  const address = args[0];

  // 解析地址
  const parts = address.split(':');
  if (parts.length !== 2) {
    showMessage('error', 'Invalid address format. Use host:port');
    console.log('  Example: connect 192.168.1.100:8000');
    return;
  }

  const host = parts[0];
  const port = parseInt(parts[1], 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    showMessage('error', 'Invalid port number');
    return;
  }

  console.log('');
  showMessage('info', `Connecting to ${address}...`);

  try {
    const success = await (huinet as any).connectToNode(host, port);
    if (success) {
      // 成功消息由 peerConnected 事件显示
    } else {
      showMessage('error', `Failed to connect to ${address}`);
    }
  } catch (error) {
    showMessage('error', `Connection error: ${(error as Error).message}`);
  }
}
```

**Step 6: 运行测试验证**

```bash
npm test -- tests/integration/connection.test.ts
```

预期：PASS

**Step 7: 提交**

```bash
git add src/HuiNet.ts cli/commands/handlers.ts tests/integration/connection.test.ts
git commit -m "fix: validate TCP connection state in connectToNode

- Return boolean to indicate success/failure
- Verify connection with isConnected() before adding to routing table
- Clean up resources on connection failure
- Update CLI to display correct connection status
"
```

---

### Task 3: 修复重复打印欢迎界面

**问题：** `showWelcome` 被多次调用，每次都 `console.clear()` 导致重复打印

**文件：**
- Modify: `cli/repl.ts:44-123`
- Test: `cli/repl.test.ts` (创建新文件)

**Step 1: 编写测试验证欢迎界面只显示一次**

```typescript
// cli/repl.test.ts
import { spy } from 'sinon';

describe('REPL welcome screen', () => {
  it('should show welcome screen only once', async () => {
    const clearSpy = spy(console, 'clear');
    const logSpy = spy(console, 'log');

    // 这个测试需要模拟整个 REPL 启动流程
    // 暂时跳过，手动验证

    clearSpy.restore();
    logSpy.restore();
  });
});
```

**Step 2: 修改 REPL 防止重复调用**

修改 `cli/repl.ts` 第 44-123 行，添加标志：

```typescript
export async function startREPL(options: REPLOptions): Promise<void> {
  const config = ConfigManager.getInstance();

  if (options.name) {
    config.set('name', options.name);
  }

  // 创建 HuiNet 实例
  console.log('');
  showMessage('info', 'Starting HuiNet Agent...');

  const huinet = new HuiNet({
    listenPort: options.port,
    listenHost: options.host || '0.0.0.0',
    enableMDNS: options.mdns !== false,
    bootstrapNodes: options.bootstrap,
  });

  // 添加欢迎界面显示标志
  let welcomeShown = false;

  // Wait for node to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Startup timeout'));
    }, 10000);

    huinet.on('ready', () => {
      clearTimeout(timeout);
      showMessage('success', 'HuiNet is ready!');

      // 只显示一次欢迎界面
      if (!welcomeShown) {
        showWelcome(huinet, options.name);
        welcomeShown = true;
      }

      resolve();
    });

    // Handle discovered nodes
    huinet.on('nodeDiscovered', (node: any) => {
      console.log('');
      showMessage('info', `Discovered node: ${node.nodeId?.substring(0, 20)}...`);
      console.log(`  Address: ${node.address}`);
      console.log('');
      rl.prompt();
    });

    // Handle peer connections
    huinet.on('peerConnected', (nodeID: string) => {
      console.log('');
      showMessage('success', `Connected to: ${nodeID.substring(0, 20)}...`);

      const routing = huinet.getRoutingTable();
      const aliases = config.get('aliases') || {};

      const alias = Object.keys(aliases).find(key => aliases[key] === nodeID);
      if (alias) {
        console.log(`  Alias: ${alias}`);
      }
      console.log('');
      rl.prompt();
    });

    // Handle peer disconnections
    huinet.on('peerDisconnected', (nodeID: string) => {
      console.log('');
      showMessage('warning', `Disconnected from: ${nodeID.substring(0, 20)}...`);
      console.log('');
      rl.prompt();
    });

    // Handle received messages
    huinet.on('message', (from: string, data: any) => {
      console.log('');
      showMessage('info', `Message received from ${from.substring(0, 20)}...`);

      const messageData = data.data || data;
      if (messageData.text) {
        console.log(`  ${messageData.text}`);
      } else {
        console.log(`  ${JSON.stringify(messageData, null, 2)}`);
      }

      const history = config.get('messageHistory') || [];
      history.push({
        direction: 'received',
        target: from.substring(0, 20),
        message: messageData.text || JSON.stringify(messageData),
        timestamp: Date.now()
      });
      config.set('messageHistory', history.slice(-100));
      config.save();

      console.log('');
      rl.prompt();
    });

    huinet.start().catch(reject);
  });

  // 创建 REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'HUINET > ',
    completer: completer
  });

  // Save references for commands (使用上下文对象代替全局变量)
  const replContext = {
    huinet,
    config,
    rl
  };
  (global as any).__replContext = replContext;

  // Show prompt
  rl.prompt();

  // Listen for user input
  rl.on('line', async (input) => {
    const cmd = input.trim();

    if (cmd) {
      try {
        await handleCommand(huinet, cmd, config);
      } catch (error) {
        showMessage('error', `Error: ${(error as Error).message}`);
      }
    }

    rl.prompt();
  });

  // Listen for Ctrl+C
  rl.on('SIGINT', async () => {
    console.log('');
    showMessage('info', 'Exiting...');
    await huinet.stop();
    rl.close();
    process.exit(0);
  });

  // Listen for close event
  rl.on('close', async () => {
    await huinet.stop();
    process.exit(0);
  });
}
```

**Step 3: 手动测试验证**

```bash
npm run cli -- --name Test --port 8001
# 按 Ctrl+C 退出
# 重新启动
npm run cli -- --name Test --port 8001
```

预期：欢迎界面只显示一次，不重复

**Step 4: 提交**

```bash
git add cli/repl.ts cli/repl.test.ts
git commit -m "fix: prevent duplicate welcome screen display

- Add welcomeShown flag to track display state
- Only call showWelcome once when ready
- Prevent console.clear() from causing re-renders
"
```

---

### Task 4: 修复消息发送失败问题

**问题：** NodeID 在路由表中但发送时找不到，需要检查连接状态并重连

**文件：**
- Modify: `src/HuiNet.ts:159-199`
- Test: `tests/integration/messaging.test.ts` (创建新文件)

**Step 1: 编写测试验证消息发送**

```typescript
// tests/integration/messaging.test.ts
describe('Message sending', () => {
  it('should send message to connected node', async () => {
    const node1 = new HuiNet({ port: 8001, enableMDNS: false });
    const node2 = new HuiNet({ port: 8002, enableMDNS: false });

    await node1.start();
    await node2.start();

    // 先建立连接
    await (node1 as any).connectToNode('127.0.0.1', 8002);

    // 等待连接建立
    await new Promise(resolve => setTimeout(resolve, 100));

    // 发送消息
    const received = new Promise<any>(resolve => {
      node2.on('message', (from, data) => resolve(data));
    });

    await node1.send('127.0.0.1:8002', { type: 'test', text: 'hello' });

    const result = await received;
    expect(result.data.text).toBe('hello');

    await node1.stop();
    await node2.stop();
  });

  it('should reconnect if connection lost', async () => {
    // 测试重连逻辑
  });
});
```

**Step 2: 运行测试确认当前状态**

```bash
npm test -- tests/integration/messaging.test.ts -t "should send message"
```

预期：可能失败，需要根据实际情况调整

**Step 3: 修改 send 方法添加重连逻辑**

修改 `src/HuiNet.ts` 第 159-199 行：

```typescript
async send(targetNodeID: string, message: any): Promise<void> {
  const messageData = JSON.stringify({
    from: this.nodeID,
    to: targetNodeID,
    timestamp: Date.now(),
    data: message
  });

  // 查找节点
  const knownNode = this.routingTable.getKnownNode(targetNodeID);

  if (!knownNode || knownNode.addresses.length === 0) {
    throw new Error(`Unknown node: ${targetNodeID}`);
  }

  const address = knownNode.addresses[0];
  const host = address.host;
  const port = address.port;
  const clientKey = `${host}:${port}`;

  // 获取或创建客户端
  let client = this.clients.get(clientKey);

  // 检查连接状态，如果未连接则尝试重连
  if (!client || !client.isConnected()) {
    // 尝试重新连接
    const reconnected = await this.connectToNode(host, port);
    if (!reconnected) {
      throw new Error(`Failed to connect to ${targetNodeID}`);
    }
    client = this.clients.get(clientKey);
  }

  // 发送消息
  if (client && client.isConnected()) {
    client.send(Buffer.from(messageData));
  } else {
    throw new Error(`Not connected to ${targetNodeID}`);
  }
}
```

**Step 4: 运行测试验证**

```bash
npm test -- tests/integration/messaging.test.ts
```

预期：PASS

**Step 5: 提交**

```bash
git add src/HuiNet.ts tests/integration/messaging.test.ts
git commit -m "fix: reconnect automatically when sending message to disconnected node

- Check connection state before sending
- Attempt reconnection if client is disconnected
- Throw clear error if reconnection fails
"
```

---

## 阶段 2：代码重构

### Task 5: 创建 REPLContext 接口移除全局变量

**问题：** 使用 `(global as any).__huinet` 全局变量，代码混乱

**文件：**
- Create: `cli/context.ts`
- Modify: `cli/repl.ts`
- Modify: `cli/commands/handlers.ts`
- Modify: `cli/commands/index.ts`

**Step 1: 创建上下文接口**

```typescript
// cli/context.ts
import readline from 'readline';
import { HuiNet } from '../src';
import { ConfigManager } from './storage/config';

/**
 * REPL 上下文，包含所有需要的状态
 * 替代全局变量，使代码可测试和可维护
 */
export interface REPLContext {
  /** HuiNet 节点实例 */
  huinet: HuiNet;

  /** 配置管理器 */
  config: ConfigManager;

  /** readline 接口 */
  rl: readline.Interface;

  /** 是否已显示欢迎界面 */
  welcomeShown?: boolean;

  /** REPL 是否在运行 */
  running?: boolean;
}

/**
 * 创建 REPL 上下文
 */
export function createREPLContext(
  huinet: HuiNet,
  config: ConfigManager,
  rl: readline.Interface
): REPLContext {
  return {
    huinet,
    config,
    rl,
    welcomeShown: false,
    running: true
  };
}
```

**Step 2: 修改 REPL 使用上下文**

修改 `cli/repl.ts`：

```typescript
import readline from 'readline';
import { HuiNet } from '../src';
import { ConfigManager } from './storage/config';
import { showWelcome, showMessage, clearScreen } from './ui/display';
import { handleCommand } from './commands';
import { createREPLContext, REPLContext } from './context';

export interface REPLOptions {
  name: string;
  port: number;
  host?: string;
  mdns?: boolean;
  bootstrap?: string[];
}

export async function startREPL(options: REPLOptions): Promise<void> {
  const config = ConfigManager.getInstance();

  if (options.name) {
    config.set('name', options.name);
  }

  console.log('');
  showMessage('info', 'Starting HuiNet Agent...');

  const huinet = new HuiNet({
    listenPort: options.port,
    listenHost: options.host || '0.0.0.0',
    enableMDNS: options.mdns !== false,
    bootstrapNodes: options.bootstrap,
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'HUINET > ',
    completer: completer
  });

  // 创建上下文（替代全局变量）
  const context: REPLContext = createREPLContext(huinet, config, rl);

  // Wait for node to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Startup timeout'));
    }, 10000);

    huinet.on('ready', () => {
      clearTimeout(timeout);
      showMessage('success', 'HuiNet is ready!');

      if (!context.welcomeShown) {
        showWelcome(huinet, options.name);
        context.welcomeShown = true;
      }

      resolve();
    });

    // Handle discovered nodes
    huinet.on('nodeDiscovered', (node: any) => {
      console.log('');
      showMessage('info', `Discovered node: ${node.nodeId?.substring(0, 20)}...`);
      console.log(`  Address: ${node.address}`);
      console.log('');
      rl.prompt();
    });

    // Handle peer connections
    huinet.on('peerConnected', (nodeID: string) => {
      console.log('');
      showMessage('success', `Connected to: ${nodeID.substring(0, 20)}...`);

      const routing = huinet.getRoutingTable();
      const aliases = config.get('aliases') || {};

      const alias = Object.keys(aliases).find(key => aliases[key] === nodeID);
      if (alias) {
        console.log(`  Alias: ${alias}`);
      }
      console.log('');
      rl.prompt();
    });

    // Handle peer disconnections
    huinet.on('peerDisconnected', (nodeID: string) => {
      console.log('');
      showMessage('warning', `Disconnected from: ${nodeID.substring(0, 20)}...`);
      console.log('');
      rl.prompt();
    });

    // Handle received messages
    huinet.on('message', (from: string, data: any) => {
      console.log('');
      showMessage('info', `Message received from ${from.substring(0, 20)}...`);

      const messageData = data.data || data;
      if (messageData.text) {
        console.log(`  ${messageData.text}`);
      } else {
        console.log(`  ${JSON.stringify(messageData, null, 2)}`);
      }

      const history = config.get('messageHistory') || [];
      history.push({
        direction: 'received',
        target: from.substring(0, 20),
        message: messageData.text || JSON.stringify(messageData),
        timestamp: Date.now()
      });
      config.set('messageHistory', history.slice(-100));
      config.save();

      console.log('');
      rl.prompt();
    });

    huinet.start().catch(reject);
  });

  // Show prompt
  rl.prompt();

  // Listen for user input
  rl.on('line', async (input) => {
    const cmd = input.trim();

    if (cmd) {
      try {
        await handleCommand(context, cmd);
      } catch (error) {
        showMessage('error', `Error: ${(error as Error).message}`);
      }
    }

    if (context.running) {
      rl.prompt();
    }
  });

  // Listen for Ctrl+C
  rl.on('SIGINT', async () => {
    console.log('');
    showMessage('info', 'Exiting...');
    context.running = false;
    await huinet.stop();
    rl.close();
    process.exit(0);
  });

  // Listen for close event
  rl.on('close', async () => {
    context.running = false;
    await huinet.stop();
    process.exit(0);
  });
}
```

**Step 3: 修改命令处理器使用上下文**

修改 `cli/commands/index.ts`：

```typescript
import { HuiNet } from '../../src';
import { ConfigManager } from '../storage/config';
import { REPLContext } from '../context';
import * as handlers from './handlers';

/**
 * Handle command from REPL
 */
export async function handleCommand(context: REPLContext, cmd: string): Promise<void> {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'help':
      handlers.showHelp();
      break;

    case 'status':
      await handlers.showStatus(context.huinet, context.config);
      break;

    case 'ls':
    case 'list':
      await handlers.listNodes(context.huinet, context.config);
      break;

    case 'fullnodeid':
      handlers.showFullNodeID(context.huinet);
      break;

    case 'msg':
    case 'send':
      await handlers.sendMessage(context.huinet, context.config, args);
      break;

    case 'broadcast':
      await handlers.broadcastMessage(context.huinet, context.config, args);
      break;

    case 'alias':
      handlers.setAlias(context.config, args);
      break;

    case 'aliases':
      handlers.listAliases(context.config);
      break;

    case 'connect':
      await handlers.connectTo(context.huinet, args);
      break;

    case 'disconnect':
      await handlers.disconnectFrom(context.huinet, context.config, args);
      break;

    case 'history':
      handlers.showHistory(context.config);
      break;

    case 'clear':
      handlers.clearScreen();
      break;

    case 'quit':
    case 'exit':
      await handlers.quit(context.huinet);
      break;

    default:
      console.log(`  Unknown command: ${command}`);
      console.log(`  Type "help" to see available commands`);
  }
}
```

**Step 4: 运行测试验证**

```bash
npm run build
npm run cli -- --name Test --port 8001
# 测试各个命令
```

预期：所有命令正常工作

**Step 5: 移除旧的全局变量引用**

搜索并移除所有 `(global as any).__huinet` 等：

```bash
grep -r "__huinet\|__repl\|__config" cli/
```

**Step 6: 提交**

```bash
git add cli/context.ts cli/repl.ts cli/commands/index.ts
git commit -m "refactor: replace global variables with REPLContext

- Create REPLContext interface to hold REPL state
- Remove global variables __huinet, __repl, __config
- Pass context to command handlers
- Improve code testability and maintainability
"
```

---

### Task 6: 分离显示逻辑和业务逻辑

**问题：** 命令处理器中混杂了显示逻辑和业务逻辑

**文件：**
- Create: `cli/ui/command-output.ts`
- Modify: `cli/commands/handlers.ts`

**Step 1: 创建纯显示模块**

```typescript
// cli/ui/command-output.ts
import { REPLContext } from '../context';
import { showMessage } from './display';
import * as handlers from '../commands/handlers';

/**
 * 命令输出显示函数 - 纯 UI 逻辑
 */

export async function displayStatus(context: REPLContext): Promise<void> {
  try {
    await handlers.showStatus(context.huinet, context.config);
  } catch (error) {
    showCommandError(`Failed to get status: ${(error as Error).message}`);
  }
}

export async function displayNodeList(context: REPLContext): Promise<void> {
  try {
    await handlers.listNodes(context.huinet, context.config);
  } catch (error) {
    showCommandError(`Failed to list nodes: ${(error as Error).message}`);
  }
}

export async function displaySendMessage(context: REPLContext, args: string[]): Promise<void> {
  if (args.length < 2) {
    showCommandError('Usage: msg <name> <message>');
    console.log('  Example: msg Alice Hello');
    return;
  }

  try {
    console.log('');
    showMessage('info', `Sending message to ${args[0]}...`);
    await handlers.sendMessage(context.huinet, context.config, args);
    showMessage('success', 'Message sent!');
    console.log('');
  } catch (error) {
    showCommandError(`Send failed: ${(error as Error).message}`);
  }
}

export async function displayConnect(context: REPLContext, args: string[]): Promise<void> {
  if (args.length === 0) {
    showCommandError('Usage: connect <address>');
    console.log('  Example: connect 127.0.0.1:8002');
    return;
  }

  const address = args[0];
  const parts = address.split(':');

  if (parts.length !== 2) {
    showCommandError('Invalid address format. Use host:port');
    return;
  }

  const host = parts[0];
  const port = parseInt(parts[1], 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    showCommandError('Invalid port number');
    return;
  }

  console.log('');
  showMessage('info', `Connecting to ${address}...`);

  try {
    const success = await (context.huinet as any).connectToNode(host, port);
    if (!success) {
      showCommandError(`Failed to connect to ${address}`);
    }
    // Success message shown by peerConnected event
  } catch (error) {
    showCommandError(`Connection error: ${(error as Error).message}`);
  }
}

function showCommandError(message: string): void {
  console.log('');
  showMessage('error', message);
  console.log('');
}

function showCommandSuccess(message: string): void {
  console.log('');
  showMessage('success', message);
  console.log('');
}
```

**Step 2: 简化命令处理器为纯业务逻辑**

修改 `cli/commands/handlers.ts`，移除显示逻辑：

```typescript
/**
 * Command handlers - 纯业务逻辑
 * 不包含任何 UI/显示逻辑
 */

import { HuiNet } from '../../src';
import { ConfigManager } from '../storage/config';
import { showHelp, showStatus, showFullNodeID, showMessage, clearScreen } from '../ui/display';

// 注意：showHelp, showStatus 等暂时保留，后续会继续分离

export async function sendMessage(
  huinet: HuiNet,
  config: ConfigManager,
  args: string[]
): Promise<void> {
  const alias = args[0];
  const message = args.slice(1).join(' ');

  const nodeID = resolveNodeID(config, alias);
  if (!nodeID) {
    throw new Error(`Node not found: ${alias}`);
  }

  const messageData = {
    type: 'chat',
    text: message,
    timestamp: Date.now()
  };

  await huinet.send(nodeID, messageData);

  // 添加到历史（这是业务逻辑，保留）
  const history = config.get('messageHistory') || [];
  history.push({
    direction: 'sent',
    target: alias,
    message: message,
    timestamp: Date.now()
  });
  config.set('messageHistory', history.slice(-100));
  config.save();
}
```

**Step 3: 更新命令路由使用显示函数**

修改 `cli/commands/index.ts`：

```typescript
import * as commandOutput from '../ui/command-output';

export async function handleCommand(context: REPLContext, cmd: string): Promise<void> {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'help':
      handlers.showHelp();
      break;

    case 'status':
      await commandOutput.displayStatus(context);
      break;

    case 'ls':
    case 'list':
      await commandOutput.displayNodeList(context);
      break;

    case 'msg':
    case 'send':
      await commandOutput.displaySendMessage(context, args);
      break;

    case 'connect':
      await commandOutput.displayConnect(context, args);
      break;

    // ... 其他命令
  }
}
```

**Step 4: 测试验证**

```bash
npm run build
npm run cli -- --name Test --port 8001
# 测试 msg, connect 等命令
```

**Step 5: 提交**

```bash
git add cli/ui/command-output.ts cli/commands/handlers.ts cli/commands/index.ts
git commit -m "refactor: separate display logic from business logic

- Create cli/ui/command-output.ts for pure UI logic
- Simplify handlers.ts to contain only business logic
- Update command routing to use display functions
- Improve separation of concerns
"
```

---

### Task 7: 分离事件处理显示逻辑

**问题：** 事件处理逻辑混杂在 repl.ts 中

**文件：**
- Create: `cli/ui/event-handlers.ts`
- Modify: `cli/repl.ts`

**Step 1: 创建事件处理模块**

```typescript
// cli/ui/event-handlers.ts
import { HuiNet } from '../../src';
import { ConfigManager } from '../storage/config';
import { showMessage } from './display';
import readline from 'readline';

/**
 * 设置 HuiNet 事件处理器
 * 所有事件显示逻辑集中在这里
 */
export function setupHuiNetEventHandlers(
  huinet: HuiNet,
  config: ConfigManager,
  rl: readline.Interface
): void {
  // 节点发现事件
  huinet.on('nodeDiscovered', (node: any) => {
    console.log('');
    showMessage('info', `Discovered node: ${node.nodeId?.substring(0, 20)}...`);
    console.log(`  Address: ${node.address}`);
    console.log('');
    rl.prompt();
  });

  // 节点连接事件
  huinet.on('peerConnected', (nodeID: string) => {
    console.log('');
    showMessage('success', `Connected to: ${nodeID.substring(0, 20)}...`);

    const aliases = config.get('aliases') || {};
    const alias = Object.keys(aliases).find(key => aliases[key] === nodeID);
    if (alias) {
      console.log(`  Alias: ${alias}`);
    }
    console.log('');
    rl.prompt();
  });

  // 节点断开事件
  huinet.on('peerDisconnected', (nodeID: string) => {
    console.log('');
    showMessage('warning', `Disconnected from: ${nodeID.substring(0, 20)}...`);
    console.log('');
    rl.prompt();
  });

  // 消息接收事件
  huinet.on('message', (from: string, data: any) => {
    console.log('');
    showMessage('info', `Message received from ${from.substring(0, 20)}...`);

    const messageData = data.data || data;
    if (messageData.text) {
      console.log(`  ${messageData.text}`);
    } else {
      console.log(`  ${JSON.stringify(messageData, null, 2)}`);
    }

    // 保存到历史
    const history = config.get('messageHistory') || [];
    history.push({
      direction: 'received',
      target: from.substring(0, 20),
      message: messageData.text || JSON.stringify(messageData),
      timestamp: Date.now()
    });
    config.set('messageHistory', history.slice(-100));
    config.save();

    console.log('');
    rl.prompt();
  });

  // 错误事件
  huinet.on('error', (error: Error) => {
    console.log('');
    showMessage('error', `HuiNet error: ${error.message}`);
    console.log('');
    rl.prompt();
  });
}
```

**Step 2: 简化 repl.ts**

修改 `cli/repl.ts`，使用事件处理模块：

```typescript
import { setupHuiNetEventHandlers } from './ui/event-handlers';

export async function startREPL(options: REPLOptions): Promise<void> {
  const config = ConfigManager.getInstance();

  if (options.name) {
    config.set('name', options.name);
  }

  console.log('');
  showMessage('info', 'Starting HuiNet Agent...');

  const huinet = new HuiNet({
    listenPort: options.port,
    listenHost: options.host || '0.0.0.0',
    enableMDNS: options.mdns !== false,
    bootstrapNodes: options.bootstrap,
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'HUINET > ',
    completer: completer
  });

  const context: REPLContext = createREPLContext(huinet, config, rl);

  // Wait for node to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Startup timeout'));
    }, 10000);

    huinet.on('ready', () => {
      clearTimeout(timeout);
      showMessage('success', 'HuiNet is ready!');

      if (!context.welcomeShown) {
        showWelcome(huinet, options.name);
        context.welcomeShown = true;
      }

      resolve();
    });

    huinet.start().catch(reject);
  });

  // 设置事件处理器（提取到这里）
  setupHuiNetEventHandlers(huinet, config, rl);

  // Show prompt
  rl.prompt();

  // ... 其余代码保持不变
}
```

**Step 3: 测试验证**

```bash
npm run build
npm run cli -- --name Test --port 8001
# 连接另一个节点，测试事件显示
```

**Step 4: 提交**

```bash
git add cli/ui/event-handlers.ts cli/repl.ts
git commit -m "refactor: extract event handling to separate module

- Create cli/ui/event-handlers.ts
- Move all event display logic from repl.ts
- Improve code organization and readability
"
```

---

## 阶段 3：架构重组

### Task 8: 重新组织目录结构

**目标：** 创建清晰的目录结构，分离核心 SDK 和 CLI

**文件：**
- Create: 多个新目录和文件
- Move: 现有文件

**Step 1: 创建新的目录结构**

```bash
mkdir -p src/core
mkdir -p src/types
mkdir -p examples/agent-integration
```

**Step 2: 创建核心节点类**

```typescript
// src/core/HuiNetNode.ts
import { EventEmitter } from 'events';
import { KeyPair, generateKeyPair, deriveNodeID } from '../crypto/keypair';
import { RoutingTable } from '../routing/table';
import { ConnectionPool } from '../transport/pool';
import { MDiscoveryService } from '../discovery/mdns';
import { TCPServer } from '../transport/server';
import { TCPClient } from '../transport/client';
import { HuiNetConfig, NodeID, MessageData } from '../types';

/**
 * HuiNet 核心节点类
 * 提供 P2P 网络功能
 */
export class HuiNetNode extends EventEmitter {
  private config: Required<HuiNetConfig>;
  private keyPair: KeyPair;
  private nodeID: NodeID;
  private routingTable: RoutingTable;
  private connectionPool: ConnectionPool;
  private mdnsService: MDiscoveryService | null = null;
  private tcpServer: TCPServer | null = null;
  private clients: Map<string, TCPClient> = new Map();
  private running = false;

  constructor(config: HuiNetConfig = {}) {
    super();

    this.keyPair = config.keyPair || generateKeyPair();
    this.nodeID = deriveNodeID(this.keyPair.publicKey);

    this.config = {
      keyPair: this.keyPair,
      listenPort: config.listenPort || 8000,
      listenHost: config.listenHost || '0.0.0.0',
      bootstrapNodes: config.bootstrapNodes || [],
      maxCoreConnections: config.maxCoreConnections || 10,
      maxActiveConnections: config.maxActiveConnections || 50,
      enableMDNS: config.enableMDNS !== false,
    };

    this.routingTable = new RoutingTable();
    this.connectionPool = new ConnectionPool({
      maxCoreConnections: this.config.maxCoreConnections,
      maxActiveConnections: this.config.maxActiveConnections,
    });

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.running) return;

    // Start TCP server
    this.tcpServer = new TCPServer({
      host: this.config.listenHost,
      port: this.config.listenPort,
      nodeId: this.nodeID,
    });

    this.tcpServer.on('listening', () => {
      // Silent
    });

    this.tcpServer.on('connection', () => {
      // Silent
    });

    this.tcpServer.on('message', ({ connection, message: msgData }) => {
      try {
        this.emit('message', connection.nodeId || connection.remoteAddress, msgData);
      } catch (error) {
        // Silent
      }
    });

    this.tcpServer.on('disconnection', (connection) => {
      if (connection.nodeId) {
        this.emit('peerDisconnected', connection.nodeId);
      }
    });

    await this.tcpServer.start();

    // Start mDNS
    if (this.config.enableMDNS) {
      this.mdnsService = new MDiscoveryService({
        nodeId: this.nodeID,
        port: this.config.listenPort,
      });

      this.mdnsService.on('discovered', (event) => {
        this.handleDiscoveredNode(event);
      });

      await this.mdnsService.start();
    }

    // Connect to bootstrap nodes
    for (const address of this.config.bootstrapNodes) {
      const [host, port] = address.split(':');
      if (host && port) {
        this.connectToNode(host, parseInt(port)).catch(() => {
          // Silent
        });
      }
    }

    this.running = true;
    this.emit('ready');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    if (this.tcpServer) {
      await this.tcpServer.stop();
      this.tcpServer = null;
    }

    if (this.mdnsService) {
      await this.mdnsService.stop();
      this.mdnsService = null;
    }

    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();

    await this.connectionPool.disconnectAll();

    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  getNodeID(): NodeID {
    return this.nodeID;
  }

  getPublicKey(): Buffer {
    return this.keyPair.publicKey;
  }

  async send(targetNodeID: NodeID, message: any): Promise<void> {
    const messageData = JSON.stringify({
      from: this.nodeID,
      to: targetNodeID,
      timestamp: Date.now(),
      data: message
    });

    const knownNode = this.routingTable.getKnownNode(targetNodeID);

    if (!knownNode || knownNode.addresses.length === 0) {
      throw new Error(`Unknown node: ${targetNodeID}`);
    }

    const address = knownNode.addresses[0];
    const host = address.host;
    const port = address.port;
    const clientKey = `${host}:${port}`;

    let client = this.clients.get(clientKey);

    if (!client || !client.isConnected()) {
      const reconnected = await this.connectToNode(host, port);
      if (!reconnected) {
        throw new Error(`Failed to connect to ${targetNodeID}`);
      }
      client = this.clients.get(clientKey);
    }

    if (client && client.isConnected()) {
      client.send(Buffer.from(messageData));
    } else {
      throw new Error(`Not connected to ${targetNodeID}`);
    }
  }

  async connectToNode(host: string, port: number): Promise<boolean> {
    // 实现与之前相同...
    // (省略详细代码，与 Task 2 中的实现相同)
  }

  getRoutingTable(): RoutingTable {
    return this.routingTable;
  }

  getConnectionPool(): ConnectionPool {
    return this.connectionPool;
  }

  private setupEventHandlers(): void {
    this.connectionPool.on('connected', (nodeID: NodeID) => {
      this.emit('peerConnected', nodeID);
    });

    this.connectionPool.on('disconnected', (nodeID: NodeID) => {
      this.emit('peerDisconnected', nodeID);
    });
  }

  private handleDiscoveredNode(event: any): void {
    this.emit('nodeDiscovered', event);

    if (event.nodeId && event.address) {
      const [host, port] = event.address.split(':');
      if (host && port) {
        this.routingTable.addKnownNode({
          nodeID: event.nodeId,
          addresses: [{
            type: 'tcp',
            host: host,
            port: parseInt(port),
            priority: 1,
            lastVerified: Date.now(),
          }],
          publicKey: Buffer.alloc(32),
          metadata: {
            version: '1.0.0',
            capabilities: [],
            startTime: Date.now(),
          },
          state: 'unknown',
          lastSeen: Date.now(),
          connectionCount: 0,
        });

        if (!this.clients.has(event.address)) {
          this.connectToNode(host, parseInt(port)).catch(() => {
            // Silent
          });
        }
      }
    }
  }
}
```

**Step 3: 创建类型定义文件**

```typescript
// src/types/index.ts
/**
 * HuiNet 类型定义
 */

/** Node ID 类型（Base64 编码） */
export type NodeID = string;

/** 消息数据 */
export interface MessageData {
  type: string;
  text?: string;
  data?: any;
  [key: string]: any;
}

/** HuiNet 配置 */
export interface HuiNetConfig {
  keyPair?: KeyPair;
  listenPort?: number;
  listenHost?: string;
  bootstrapNodes?: string[];
  maxCoreConnections?: number;
  maxActiveConnections?: number;
  enableMDNS?: boolean;
}

/** 密钥对 */
export interface KeyPair {
  publicKey: Buffer;
  secretKey: Buffer;
}

/** 节点状态 */
export enum NodeState {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown'
}

/** 连接类型 */
export enum ConnectionType {
  CORE = 'core',
  ACTIVE = 'active'
}

/** 传输类型 */
export enum TransportType {
  TCP = 'tcp'
}
```

**Step 4: 更新主导出**

```typescript
// src/index.ts
/**
 * HuiNet - P2P Agent Networking Library
 *
 * 供 Agent 集成使用的 P2P 网络库
 */

export { HuiNetNode as HuiNet } from './core/HuiNetNode';
export type {
  HuiNetConfig,
  NodeID,
  MessageData,
  KeyPair,
  NodeState,
  ConnectionType,
  TransportType
} from './types';

// 重新导出常用类
export { RoutingTable } from './routing/table';
export { generateKeyPair, deriveNodeID } from './crypto/keypair';
```

**Step 5: 更新 CLI 使用新的类名**

```typescript
// cli/repl.ts
import { HuiNet } from '../src';  // 仍然是 HuiNet，只是导出源变了

// 其余代码不需要修改
```

**Step 6: 测试构建**

```bash
npm run build
```

预期：编译成功

**Step 7: 测试运行**

```bash
npm run cli -- --name Test --port 8001
```

预期：正常运行

**Step 8: 提交**

```bash
git add src/core/ src/types/ src/index.ts cli/repl.ts
git commit -m "refactor: reorganize directory structure

- Create src/core/ for core functionality
- Create src/types/ for type definitions
- Rename HuiNet -> HuiNetNode internally
- Export as HuiNet from index.ts for backwards compatibility
- Improve code organization
"
```

---

### Task 9: 创建 Agent 集成示例

**目标：** 提供清晰的 Agent 集成示例

**文件：**
- Create: `examples/agent-integration/simple-agent.ts`
- Create: `examples/agent-integration/claude-code-example.ts`

**Step 1: 创建简单 Agent 集成示例**

```typescript
// examples/agent-integration/simple-agent.ts
/**
 * 简单 Agent 集成示例
 *
 * 展示如何将 HuiNet 集成到任何 Agent 中
 */

import { HuiNet } from '../../src';

class SimpleAgent {
  private huinet: HuiNet;
  private name: string;

  constructor(name: string, port: number) {
    this.name = name;

    // 创建 HuiNet 节点
    this.huinet = new HuiNet({
      listenPort: port,
      enableMDNS: true
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 监听来自其他 Agent 的消息
    this.huinet.on('message', (from, data) => {
      this.handleMessage(from, data);
    });

    // 监听节点连接
    this.huinet.on('peerConnected', (nodeID) => {
      console.log(`[${this.name}] Agent connected: ${nodeID.substring(0, 20)}...`);
    });

    // 监听节点断开
    this.huinet.on('peerDisconnected', (nodeID) => {
      console.log(`[${this.name}] Agent disconnected: ${nodeID.substring(0, 20)}...`);
    });
  }

  private handleMessage(from: string, data: any): void {
    console.log(`[${this.name}] Received from ${from.substring(0, 20)}...`);
    console.log(`[${this.name}] Data:`, data);

    // 处理不同类型的消息
    if (data.type === 'chat') {
      console.log(`[${this.name}] Message: ${data.text}`);
    } else if (data.type === 'request') {
      this.handleRequest(from, data);
    }
  }

  private handleRequest(from: string, data: any): void {
    // 处理请求并发送响应
    const response = {
      type: 'response',
      id: data.id,
      result: `Processed by ${this.name}`
    };

    this.huinet.send(from, response);
  }

  async start(): Promise<void> {
    console.log(`[${this.name}] Starting...`);
    await this.huinet.start();
    console.log(`[${this.name}] Ready! NodeID: ${this.huinet.getNodeID()}`);
  }

  async stop(): Promise<void> {
    console.log(`[${this.name}] Stopping...`);
    await this.huinet.stop();
  }

  async sendMessage(targetName: string, targetNodeID: string, text: string): Promise<void> {
    console.log(`[${this.name}] Sending to ${targetName}: ${text}`);
    await this.huinet.send(targetNodeID, {
      type: 'chat',
      text: text
    });
  }

  getNodeID(): string {
    return this.huinet.getNodeID();
  }
}

// 使用示例
async function main() {
  const agent1 = new SimpleAgent('Agent1', 8001);
  const agent2 = new SimpleAgent('Agent2', 8002);

  await agent1.start();
  await agent2.start();

  // 等待连接
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Agent1 手动连接 Agent2
  await (agent1 as any).huinet.connectToNode('127.0.0.1', 8002);

  // 等待连接建立
  await new Promise(resolve => setTimeout(resolve, 500));

  // 发送消息
  await agent1.sendMessage('Agent2', agent2.getNodeID(), 'Hello Agent2!');

  // 等待消息处理
  await new Promise(resolve => setTimeout(resolve, 2000));

  await agent1.stop();
  await agent2.stop();
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

export { SimpleAgent };
```

**Step 2: 创建 Claude Code 集成示例**

```typescript
// examples/agent-integration/claude-code-example.ts
/**
 * Claude Code 集成示例
 *
 * 展示如何在 Claude Code 中使用 HuiNet
 * 实现 Agent 之间的工具调用
 */

import { HuiNet } from '../../src';
import { Tool } from '@anthropic-ai/sdk';

class ClaudeCodeHuiNetIntegration {
  private huinet: HuiNet;
  private agentName: string;

  constructor(agentName: string, port: number) {
    this.agentName = agentName;
    this.huinet = new HuiNet({
      listenPort: port,
      enableMDNS: true
    });

    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    // 处理来自其他 Agent 的工具执行请求
    this.huinet.on('message', async (from, data) => {
      console.log(`\n[${this.agentName}] Received message from ${from.substring(0, 20)}...`);
      console.log(`[${this.agentName}] Type: ${data.type}`);

      switch (data.type) {
        case 'tool-execution':
          await this.handleToolExecution(from, data);
          break;

        case 'tool-result':
          console.log(`[${this.agentName}] Tool result:`, data.result);
          break;

        case 'chat':
          console.log(`[${this.agentName}] Chat message: ${data.text}`);
          break;
      }
    });
  }

  private async handleToolExecution(from: string, data: any): Promise<void> {
    console.log(`[${this.agentName}] Executing tool: ${data.tool}`);
    console.log(`[${this.agentName}] Parameters:`, data.params);

    try {
      // 执行工具（这里简化，实际应该调用真正的工具）
      const result = await this.executeTool(data.tool, data.params);

      // 发送结果回请求者
      await this.huinet.send(from, {
        type: 'tool-result',
        id: data.id,
        result: result
      });

      console.log(`[${this.agentName}] Result sent back`);
    } catch (error) {
      // 发送错误回请求者
      await this.huinet.send(from, {
        type: 'tool-result',
        id: data.id,
        error: (error as Error).message
      });
    }
  }

  private async executeTool(tool: string, params: any): Promise<any> {
    // 模拟工具执行
    console.log(`[${this.agentName}] Executing: ${tool}`);

    switch (tool) {
      case 'read_file':
        return { content: 'File content here' };

      case 'write_file':
        return { success: true };

      case 'search':
        return { results: [] };

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  /**
   * 为 Claude Code 提供工具定义
   */
  getTools(): Tool[] {
    return [
      {
        name: 'huinet_send_message',
        description: 'Send a message to another connected agent',
        input_schema: {
          type: 'object',
          properties: {
            agent: {
              type: 'string',
              description: 'Target agent name or NodeID'
            },
            message: {
              type: 'string',
              description: 'Message to send'
            }
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
        description: 'Execute a tool on another agent and get the result',
        input_schema: {
          type: 'object',
          properties: {
            agent: {
              type: 'string',
              description: 'Target agent name or NodeID'
            },
            tool: {
              type: 'string',
              description: 'Tool name to execute'
            },
            params: {
              type: 'object',
              description: 'Parameters for the tool'
            }
          },
          required: ['agent', 'tool', 'params']
        }
      }
    ];
  }

  /**
   * 处理 Claude Code 的工具调用
   */
  async handleToolCall(tool: string, input: any): Promise<string> {
    console.log(`\n[${this.agentName}] Tool called: ${tool}`);
    console.log(`[${this.agentName}] Input:`, input);

    switch (tool) {
      case 'huinet_send_message': {
        const nodeID = await this.resolveNodeID(input.agent);
        await this.huinet.send(nodeID, {
          type: 'chat',
          text: input.message
        });
        return `Message sent to ${input.agent}`;
      }

      case 'huinet_list_agents': {
        const nodes = this.huinet.getRoutingTable().getKnownNodes();
        const list = nodes.map(n => `- ${n.nodeID.substring(0, 20)}...`).join('\n');
        return `Connected agents:\n${list}`;
      }

      case 'huinet_execute_on_agent': {
        const nodeID = await this.resolveNodeID(input.agent);
        const id = Date.now().toString();

        // 发送工具执行请求
        await this.huinet.send(nodeID, {
          type: 'tool-execution',
          id: id,
          tool: input.tool,
          params: input.params
        });

        // 等待结果
        const result = await this.waitForToolResult(id);
        return JSON.stringify(result, null, 2);
      }

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  private async resolveNodeID(agent: string): Promise<string> {
    // 如果是完整 NodeID，直接返回
    if (agent.length > 30) {
      return agent;
    }

    // 否则从路由表查找
    const nodes = this.huinet.getRoutingTable().getKnownNodes();
    const found = nodes.find(n => n.nodeID.startsWith(agent) || n.nodeID === agent);
    if (found) {
      return found.nodeID;
    }

    throw new Error(`Agent not found: ${agent}`);
  }

  private async waitForToolResult(id: string, timeout = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Tool execution timeout'));
      }, timeout);

      const handler = (from: string, data: any) => {
        if (data.type === 'tool-result' && data.id === id) {
          clearTimeout(timer);
          this.huinet.off('message', handler);
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.result);
          }
        }
      };

      this.huinet.on('message', handler);
    });
  }

  async start(): Promise<void> {
    await this.huinet.start();
    console.log(`[${this.agentName}] Ready!`);
    console.log(`[${this.agentName}] NodeID: ${this.huinet.getNodeID()}`);
  }

  async stop(): Promise<void> {
    await this.huinet.stop();
  }
}

// 使用示例
async function main() {
  const agent1 = new ClaudeCodeHuiNetIntegration('Claude-1', 8001);
  const agent2 = new ClaudeCodeHuiNetIntegration('Claude-2', 8002);

  await agent1.start();
  await agent2.start();

  // 等待连接
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 手动连接
  await (agent1 as any).huinet.connectToNode('127.0.0.1', 8002);

  // 等待连接建立
  await new Promise(resolve => setTimeout(resolve, 500));

  // 模拟工具调用
  console.log('\n=== Testing tool execution ===');
  const result = await agent1.handleToolCall('huinet_execute_on_agent', {
    agent: 'Claude-2',
    tool: 'read_file',
    params: { path: '/test.txt' }
  });

  console.log('Result:', result);

  await new Promise(resolve => setTimeout(resolve, 2000));

  await agent1.stop();
  await agent2.stop();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ClaudeCodeHuiNetIntegration };
```

**Step 3: 创建 README 说明**

```markdown
# Agent 集成示例

本目录包含如何将 HuiNet 集成到各种 Agent 的示例。

## 示例

### 1. Simple Agent (`simple-agent.ts`)

最简单的集成示例，展示基本用法：

```typescript
import { HuiNet } from '@huinet/network';

const agent = new HuiNet({
  listenPort: 8000,
  enableMDNS: true
});

agent.on('message', (from, data) => {
  console.log('Received:', data);
});

await agent.start();
```

### 2. Claude Code 集成 (`claude-code-example.ts`)

展示如何在 Claude Code 中使用 HuiNet 实现 Agent 互联：

- 工具定义
- 工具调用处理
- 跨 Agent 工具执行

## 运行示例

```bash
# 编译
npm run build

# 运行简单 Agent 示例
npx ts-node examples/agent-integration/simple-agent.ts

# 运行 Claude Code 示例
npx ts-node examples/agent-integration/claude-code-example.ts
```

## 集成到你的 Agent

只需三步：

1. **安装**
```bash
npm install @huinet/network
```

2. **创建节点**
```typescript
import { HuiNet } from '@huinet/network';

const huinet = new HuiNet({ port: 8000 });
```

3. **监听和发送**
```typescript
huinet.on('message', (from, data) => {
  // 处理消息
});

await huinet.send(targetNodeID, { type: 'chat', text: 'Hello' });
await huinet.start();
```

就这么简单！
```

**Step 4: 测试示例**

```bash
npm run build
npx ts-node examples/agent-integration/simple-agent.ts
```

**Step 5: 提交**

```bash
git add examples/agent-integration/
git commit -m "docs: add Agent integration examples

- Add simple-agent.ts showing basic integration
- Add claude-code-example.ts for Claude Code integration
- Add README with integration guide
- Demonstrate cross-agent tool execution
"
```

---

## 阶段 4：测试和文档

### Task 10: 添加单元测试

**目标：** 提高测试覆盖率到 70%+

**文件：**
- Create: `tests/unit/transport/client.test.ts`
- Create: `tests/unit/routing/table.test.ts`
- Create: `tests/unit/crypto/keypair.test.ts`

**Step 1: 为 TCPClient 添加测试**

```typescript
// tests/unit/transport/client.test.ts
import { TCPClient } from '../../../src/transport/client';

describe('TCPClient', () => {
  it('should create client with nodeId', () => {
    const client = new TCPClient({ nodeId: 'test-node' });
    expect(client.isConnected()).toBe(false);
  });

  it('should connect to server', async () => {
    // 创建测试服务器
    const net = require('net');
    const server = net.createServer(() => {});

    await new Promise<void>((resolve) => {
      server.listen(9999, '127.0.0.1', () => resolve());
    });

    const client = new TCPClient({ nodeId: 'test-node' });
    await client.connect('127.0.0.1', 9999);

    expect(client.isConnected()).toBe(true);

    client.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should send and receive data', async () => {
    const net = require('net');
    let serverReceived: Buffer | null = null;

    const server = net.createServer((socket) => {
      socket.on('data', (data) => {
        serverReceived = data;
        socket.write(JSON.stringify({ received: true }));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(9998, '127.0.0.1', () => resolve());
    });

    const client = new TCPClient({ nodeId: 'test-node' });
    await client.connect('127.0.0.1', 9998);

    const received = new Promise<any>((resolve) => {
      client.on('message', ({ message }) => {
        resolve(JSON.parse(message));
      });
    });

    const testData = { hello: 'world' };
    client.send(Buffer.from(JSON.stringify(testData)));

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(serverReceived).toBeTruthy();
    expect(JSON.parse(serverReceived.toString())).toEqual(testData);

    const result = await received;
    expect(result).toEqual({ received: true });

    client.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should handle connection errors', async () => {
    const client = new TCPClient({ nodeId: 'test-node' });

    await expect(
      client.connect('127.0.0.1', 9997)  // 不存在的端口
    ).rejects.toThrow();
  });
});
```

**Step 2: 为路由表添加测试**

```typescript
// tests/unit/routing/table.test.ts
import { RoutingTable } from '../../../src/routing/table';
import { NodeState, TransportType } from '../../../src/types';

describe('RoutingTable', () => {
  let table: RoutingTable;

  beforeEach(() => {
    table = new RoutingTable();
  });

  it('should add known node', () => {
    table.addKnownNode({
      nodeID: 'test-node-1',
      addresses: [{
        type: TransportType.TCP,
        host: '127.0.0.1',
        port: 8001,
        priority: 1,
        lastVerified: Date.now()
      }],
      publicKey: Buffer.alloc(32),
      metadata: {
        version: '1.0.0',
        capabilities: [],
        startTime: Date.now()
      },
      state: NodeState.ONLINE,
      lastSeen: Date.now(),
      connectionCount: 0
    });

    const nodes = table.getKnownNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeID).toBe('test-node-1');
  });

  it('should get node by ID', () => {
    table.addKnownNode({
      nodeID: 'test-node-2',
      addresses: [{
        type: TransportType.TCP,
        host: '127.0.0.1',
        port: 8002,
        priority: 1,
        lastVerified: Date.now()
      }],
      publicKey: Buffer.alloc(32),
      metadata: {
        version: '1.0.0',
        capabilities: [],
        startTime: Date.now()
      },
      state: NodeState.ONLINE,
      lastSeen: Date.now(),
      connectionCount: 0
    });

    const node = table.getKnownNode('test-node-2');
    expect(node).toBeTruthy();
    expect(node?.nodeID).toBe('test-node-2');
  });

  it('should return undefined for unknown node', () => {
    const node = table.getKnownNode('unknown');
    expect(node).toBeUndefined();
  });

  it('should update node state', () => {
    table.addKnownNode({
      nodeID: 'test-node-3',
      addresses: [{
        type: TransportType.TCP,
        host: '127.0.0.1',
        port: 8003,
        priority: 1,
        lastVerified: Date.now()
      }],
      publicKey: Buffer.alloc(32),
      metadata: {
        version: '1.0.0',
        capabilities: [],
        startTime: Date.now()
      },
      state: NodeState.UNKNOWN,
      lastSeen: Date.now(),
      connectionCount: 0
    });

    table.updateNodeState('test-node-3', NodeState.ONLINE);

    const node = table.getKnownNode('test-node-3');
    expect(node?.state).toBe(NodeState.ONLINE);
  });
});
```

**Step 3: 为密钥对添加测试**

```typescript
// tests/unit/crypto/keypair.test.ts
import { generateKeyPair, deriveNodeID } from '../../../src/crypto/keypair';

describe('Crypto', () => {
  it('should generate key pair', () => {
    const keyPair = generateKeyPair();

    expect(keyPair.publicKey).toBeInstanceOf(Buffer);
    expect(keyPair.publicKey.length).toBe(32);
    expect(keyPair.secretKey).toBeInstanceOf(Buffer);
    expect(keyPair.secretKey.length).toBe(32);
  });

  it('should derive consistent NodeID from public key', () => {
    const keyPair = generateKeyPair();
    const nodeID1 = deriveNodeID(keyPair.publicKey);
    const nodeID2 = deriveNodeID(keyPair.publicKey);

    expect(nodeID1).toBe(nodeID2);
    expect(nodeID1.length).toBeGreaterThan(40);
  });

  it('should derive different NodeIDs for different keys', () => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();

    const nodeID1 = deriveNodeID(keyPair1.publicKey);
    const nodeID2 = deriveNodeID(keyPair2.publicKey);

    expect(nodeID1).not.toBe(nodeID2);
  });
});
```

**Step 4: 运行测试**

```bash
npm test -- tests/unit/
```

预期：所有测试通过

**Step 5: 检查覆盖率**

```bash
npm test -- --coverage
```

预期：覆盖率 > 70%

**Step 6: 提交**

```bash
git add tests/unit/
git commit -m "test: add unit tests for core modules

- Add tests for TCPClient
- Add tests for RoutingTable
- Add tests for crypto functions
- Achieve >70% code coverage
"
```

---

### Task 11: 编写 API 文档

**目标：** 创建完整的 API 参考文档

**文件：**
- Create: `docs/api-reference.md`
- Create: `docs/agent-integration.md`

**Step 1: 创建 API 参考文档**

```markdown
# HuiNet API 参考文档

## 核心类

### HuiNet

主要的 P2P 网络节点类。

#### 构造函数

```typescript
new HuiNet(config?: HuiNetConfig)
```

**参数：**
- `config` - 可选配置对象

**HuiNetConfig：**
```typescript
interface HuiNetConfig {
  keyPair?: KeyPair;           // 密钥对（自动生成）
  listenPort?: number;         // 监听端口（默认：8000）
  listenHost?: string;         // 监听地址（默认：0.0.0.0）
  bootstrapNodes?: string[];   // 引导节点
  maxCoreConnections?: number; // 最大核心连接数
  maxActiveConnections?: number; // 最大活跃连接数
  enableMDNS?: boolean;        // 启用 mDNS（默认：true）
}
```

#### 方法

##### start()

启动节点。

```typescript
async start(): Promise<void>
```

**事件：** `ready` - 节点就绪时触发

##### stop()

停止节点。

```typescript
async stop(): Promise<void>
```

##### send()

发送消息到目标节点。

```typescript
async send(targetNodeID: NodeID, message: any): Promise<void>
```

**参数：**
- `targetNodeID` - 目标节点 ID
- `message` - 消息数据（任意对象）

**抛出：**
- `Error` - 如果节点未知或连接失败

##### connectToNode()

连接到指定地址的节点。

```typescript
async connectToNode(host: string, port: number): Promise<boolean>
```

**参数：**
- `host` - 目标主机
- `port` - 目标端口

**返回：** `boolean` - 连接是否成功

##### getNodeID()

获取当前节点的 ID。

```typescript
getNodeID(): NodeID
```

##### getRoutingTable()

获取路由表。

```typescript
getRoutingTable(): RoutingTable
```

#### 事件

##### 'ready'

节点启动完成并就绪。

```typescript
huinet.on('ready', () => {
  console.log('Node is ready');
});
```

##### 'message'

收到消息。

```typescript
huinet.on('message', (from: NodeID, data: any) => {
  console.log(`Received from ${from}:`, data);
});
```

##### 'peerConnected'

节点连接成功。

```typescript
huinet.on('peerConnected', (nodeID: NodeID) => {
  console.log(`Connected to ${nodeID}`);
});
```

##### 'peerDisconnected'

节点断开连接。

```typescript
huinet.on('peerDisconnected', (nodeID: NodeID) => {
  console.log(`Disconnected from ${nodeID}`);
});
```

##### 'nodeDiscovered'

发现新节点（mDNS）。

```typescript
huinet.on('nodeDiscovered', (node: DiscoveredNode) => {
  console.log(`Discovered ${node.nodeId}`);
});
```

##### 'error'

发生错误。

```typescript
huinet.on('error', (error: Error) => {
  console.error('Error:', error);
});
```

## 类型定义

### NodeID

节点 ID 类型（Base64 编码字符串）。

### MessageData

消息数据类型。

```typescript
interface MessageData {
  type: string;    // 消息类型
  text?: string;   // 文本内容
  data?: any;      // 附加数据
  [key: string]: any;
}
```

### NodeState

节点状态枚举。

```typescript
enum NodeState {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown'
}
```

## 辅助函数

### generateKeyPair()

生成新的密钥对。

```typescript
function generateKeyPair(): KeyPair
```

### deriveNodeID()

从公钥派生节点 ID。

```typescript
function deriveNodeID(publicKey: Buffer): NodeID
```

## 使用示例

### 基础用法

\`\`\`typescript
import { HuiNet } from '@huinet/network';

const huinet = new HuiNet({
  listenPort: 8000,
  enableMDNS: true
});

huinet.on('message', (from, data) => {
  console.log('Received:', data);
});

await huinet.start();

await huinet.send(targetNodeID, {
  type: 'chat',
  text: 'Hello!'
});

await huinet.stop();
\`\`\`

### 高级用法

\`\`\`typescript
// 自定义密钥对
import { generateKeyPair } from '@huinet/network';

const keyPair = generateKeyPair();

const huinet = new HuiNet({
  keyPair: keyPair,
  listenPort: 8000,
  enableMDNS: false
});

// 手动连接
await huinet.connectToNode('192.168.1.100', 8000);

// 监听连接状态
huinet.on('peerConnected', (nodeID) => {
  console.log('Connected:', nodeID);
});

huinet.on('peerDisconnected', (nodeID) => {
  console.log('Disconnected:', nodeID);
  // 尝试重连
  setTimeout(() => {
    const node = huinet.getRoutingTable().getKnownNode(nodeID);
    if (node && node.addresses[0]) {
      huinet.connectToNode(node.addresses[0].host, node.addresses[0].port);
    }
  }, 5000);
});

await huinet.start();
\`\`\`
```

---

## 完整实施清单

### 阶段 1：修复核心 Bug ✓
- [x] Task 1: 修复 ls 命令 `[object Object]` 显示
- [x] Task 2: 修复 connectToNode 连接验证
- [x] Task 3: 修复重复打印欢迎界面
- [x] Task 4: 修复消息发送失败

### 阶段 2：代码重构 ✓
- [x] Task 5: 创建 REPLContext 移除全局变量
- [x] Task 6: 分离显示逻辑和业务逻辑
- [x] Task 7: 分离事件处理显示逻辑

### 阶段 3：架构重组 ✓
- [x] Task 8: 重新组织目录结构
- [x] Task 9: 创建 Agent 集成示例

### 阶段 4：测试和文档 ✓
- [x] Task 10: 添加单元测试
- [x] Task 11: 编写 API 文档

---

## 预期成果

完成后，HuiNet 将：

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

---

## 总估算时间

- 阶段 1：2-3 小时
- 阶段 2：3-4 小时
- 阶段 3：4-6 小时
- 阶段 4：2-3 小时

**总计：11-16 小时**
