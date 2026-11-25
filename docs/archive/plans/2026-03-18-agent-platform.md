# HuiNet Agent 管理平台实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 让现有的 AI Agent 工具（Claude Code、OpenClaw、Cursor 等）能够无缝接入 HuiNet P2P 网络，实现跨机器的 Agent 发现、通信和协作。

**架构:** 采用守护进程 + 启动器 + 监控控制台三层架构。每台机器运行一个守护进程作为本地 Agent 注册中心和 P2P 路由器。Agent 通过启动器包装启动，自动注入环境变量并通过 HTTP 代理通信。监控控制台提供 TUI 界面实时显示网络拓扑和 Agent 状态。

**技术栈:** Node.js、TypeScript、HTTP Proxy、mDNS、Ink（TUI）、systemd/launchd

---

## Phase 1: 守护进程核心 (Week 1)

### Task 1.1: 创建守护进程基础框架

**Files:**
- Create: `cli/daemon/index.ts`
- Create: `cli/daemon/types.ts`
- Create: `cli/daemon/config.ts`

**Step 1: 创建守护进程主类**

```typescript
// cli/daemon/index.ts
import { HuiNet } from '@huinet/network';
import { AgentRegistry } from './registry';
import { HTTPProxyPool } from './proxy';
import { MachineInfo } from './types';

export class HuiNetDaemon {
  private huinet: HuiNet;
  private registry: AgentRegistry;
  private proxyPool: HTTPProxyPool;
  private config: DaemonConfig;
  private machineInfo: MachineInfo;

  constructor(config: DaemonConfig) {
    this.config = config;
    this.machineInfo = {
      machineId: this.getMachineId(),
      machineName: config.machineName || 'Unnamed',
      location: config.location || 'Local',
    };
  }

  async start(): Promise<void> {
    // Start HuiNet P2P node
    this.huinet = new HuiNet({
      listenPort: this.config.listenPort,
      enableMDNS: this.config.enableMDNS,
    });
    await this.huinet.start();

    // Initialize registry and proxy pool
    this.registry = new AgentRegistry(this.machineInfo);
    this.proxyPool = new HTTPProxyPool({
      portRange: this.config.proxyPortRange,
    });

    // Setup admin API
    this.setupAdminAPI();

    // Listen for P2P messages
    this.huinet.on('message', (from, data) => {
      this.handleP2PMessage(from, data);
    });

    // Announce machine to network
    await this.announceMachine();

    console.log(`HuiNet Daemon started on ${this.machineInfo.machineName}`);
    console.log(`  Machine ID: ${this.machineInfo.machineId}`);
    console.log(`  P2P Port: ${this.config.listenPort}`);
    console.log(`  API: http://127.0.0.1:${this.config.adminPort}`);
  }

  async stop(): Promise<void> {
    await this.proxyPool.closeAll();
    await this.huinet.stop();
  }

  private getMachineId(): string {
    const crypto = require('crypto');
    const mac = require('getmac').mac();
    return crypto.createHash('sha256')
      .update(mac + require('os').hostname())
      .digest('hex')
      .substring(0, 16);
  }
}
```

**Step 2: 运行基础测试验证**

```bash
cd /Users/jiang/development/HuiNet/.worktrees/agent-platform
npm test -- src/cli/daemon/index.test.ts
```

Expected: FAIL - 测试文件不存在

**Step 3: 创建类型定义**

```typescript
// cli/daemon/types.ts
export interface MachineInfo {
  machineId: string;
  machineName: string;
  location: string;
}

export interface AgentInfo {
  agentId: string;
  machineId: string;
  agentType: string;
  agentName: string;
  pid: number;
  status: 'running' | 'busy' | 'idle' | 'offline';
  lastHeartbeat: number;
  proxyPort: number;
  registeredAt: number;
}

export interface DaemonConfig {
  machineName?: string;
  location?: string;
  listenPort: number;
  enableMDNS: boolean;
  adminPort: number;
  proxyPortRange: [number, number];
  heartbeatInterval: number;
  heartbeatTimeout: number;
}
```

**Step 4: 创建配置管理**

```typescript
// cli/daemon/config.ts
import { getMachineId } from './utils';

const DEFAULT_CONFIG: DaemonConfig = {
  listenPort: 8000,
  enableMDNS: true,
  adminPort: 3000,
  proxyPortRange: [8080, 8090],
  heartbeatInterval: 3000,
  heartbeatTimeout: 10000,
};

export function loadConfig(configPath: string): DaemonConfig {
  const fs = require('fs');
  if (fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
  }
  return DEFAULT_CONFIG;
}
```

**Step 5: 提交基础框架**

```bash
git add cli/daemon/index.ts cli/daemon/types.ts cli/daemon/config.ts
git commit -m "feat: add daemon framework and types"
```

---

### Task 1.2: 实现 Agent 注册表

**Files:**
- Create: `cli/daemon/registry.ts`
- Create: `cli/daemon/registry.test.ts`

**Step 1: 编写注册表测试**

```typescript
// cli/daemon/registry.test.ts
import { AgentRegistry } from '../registry';
import { MachineInfo } from '../types';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  const machineInfo: MachineInfo = {
    machineId: 'test-machine-1',
    machineName: 'Test Machine',
    location: 'Local',
  };

  beforeEach(() => {
    registry = new AgentRegistry(machineInfo);
  });

  it('should register an agent', () => {
    const agent = registry.add({
      agentId: 'agent-1',
      machineId: 'test-machine-1',
      agentType: 'claude-code',
      agentName: 'Claude Code',
      pid: 1234,
      status: 'running',
      lastHeartbeat: Date.now(),
      proxyPort: 8081,
      registeredAt: Date.now(),
    });

    expect(agent.agentId).toBe('agent-1');
  });

  it('should find agent by ID', () => {
    registry.add({
      agentId: 'agent-1',
      machineId: 'test-machine-1',
      agentType: 'claude-code',
      agentName: 'Claude Code',
      pid: 1234,
      status: 'running',
      lastHeartbeat: Date.now(),
      proxyPort: 8081,
      registeredAt: Date.now(),
    });

    const found = registry.get('agent-1');
    expect(found?.agentType).toBe('claude-code');
  });

  it('should find agents by machine ID', () => {
    registry.add({
      agentId: 'agent-1',
      machineId: 'test-machine-1',
      agentType: 'claude-code',
      agentName: 'Claude Code',
      pid: 1234,
      status: 'running',
      lastHeartbeat: Date.now(),
      proxyPort: 8081,
      registeredAt: Date.now(),
    });

    const agents = registry.getByMachine('test-machine-1');
    expect(agents).toHaveLength(1);
  });

  it('should remove agent', () => {
    registry.add({
      agentId: 'agent-1',
      machineId: 'test-machine-1',
      agentType: 'claude-code',
      agentName: 'Claude Code',
      pid: 1234,
      status: 'running',
      lastHeartbeat: Date.now(),
      proxyPort: 8081,
      registeredAt: Date.now(),
    });

    const removed = registry.remove('agent-1');
    expect(removed).toBe(true);

    const found = registry.get('agent-1');
    expect(found).toBeUndefined();
  });
});
```

**Step 2: 实现注册表类**

```typescript
// cli/daemon/registry.ts
import { EventEmitter } from 'events';
import { AgentInfo, MachineInfo } from './types';

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, AgentInfo> = new Map();
  private machineInfo: MachineInfo;

  constructor(machineInfo: MachineInfo) {
    super();
    this.machineInfo = machineInfo;
  }

  add(agent: Omit<AgentInfo, 'machineId'>): AgentInfo {
    const fullAgent: AgentInfo = {
      ...agent,
      machineId: this.machineInfo.machineId,
    };

    this.agents.set(fullAgent.agentId, fullAgent);
    this.emit('agent-registered', fullAgent);

    return fullAgent;
  }

  get(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  getByMachine(machineId: string): AgentInfo[] {
    return Array.from(this.agents.values()).filter(a => a.machineId === machineId);
  }

  getAll(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  remove(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.agents.delete(agentId);
    this.emit('agent-removed', agent);
    return true;
  }

  updateHeartbeat(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.lastHeartbeat = Date.now();
    return true;
  }

  updateStatus(agentId: string, status: AgentInfo['status']): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.status = status;
    this.emit('agent-status-changed', agent);
    return true;
  }

  getStats() {
    const agents = this.getAll();
    return {
      total: agents.length,
      running: agents.filter(a => a.status === 'running').length,
      busy: agents.filter(a => a.status === 'busy').length,
      idle: agents.filter(a => a.status === 'idle').length,
      offline: agents.filter(a => a.status === 'offline').length,
    };
  }
}
```

**Step 3: 运行测试验证**

```bash
npm test -- cli/daemon/registry.test.ts
```

Expected: 5 tests PASS

**Step 4: 提交注册表实现**

```bash
git add cli/daemon/registry.ts cli/daemon/registry.test.ts
git commit -m "feat: implement agent registry with event emission"
```

---

### Task 1.3: 实现 HTTP 代理池

**Files:**
- Create: `cli/daemon/proxy.ts`
- Create: `cli/daemon/proxy.test.ts`

**Step 1: 编写代理测试**

```typescript
// cli/daemon/proxy.test.ts
import { HTTPProxyPool } from '../proxy';

describe('HTTPProxyPool', () => {
  let pool: HTTPProxyPool;

  beforeEach(() => {
    pool = new HTTPProxyPool({ portRange: [8080, 8085] });
  });

  afterEach(async () => {
    await pool.closeAll();
  });

  it('should allocate proxy port', async () => {
    const port = await pool.allocate('agent-1');
    expect(port).toBeGreaterThanOrEqual(8080);
    expect(port).toBeLessThanOrEqual(8085);
  });

  it('should route message to agent', async () => {
    const port = await pool.allocate('agent-1');
    await pool.create('agent-1', port);

    // Mock agent server
    const http = require('http');
    const server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('OK');
    });
    server.listen(port);

    try {
      const response = await fetch(`http://127.0.0.1:${port}/test`);
      const text = await response.text();
      expect(text).toBe('OK');
    } finally {
      server.close();
    }
  });

  it('should free proxy port on close', async () => {
    const port = await pool.allocate('agent-1');
    await pool.close('agent-1');

    const port2 = await pool.allocate('agent-2');
    expect(port2).toBe(port); // Should reuse the same port
  });
});
```

**Step 2: 实现代理池**

```typescript
// cli/daemon/proxy.ts
import { EventEmitter } from 'events';

export interface HTTPProxyConfig {
  portRange: [number, number];
  timeout?: number;
}

export class HTTPProxyPool extends EventEmitter {
  private proxies: Map<string, AgentProxy> = new Map();
  private config: HTTPProxyConfig;

  constructor(config: HTTPProxyConfig) {
    super();
    this.config = config;
  }

  async allocate(agentId: string): Promise<number> {
    // Reuse existing proxy if exists
    if (this.proxies.has(agentId)) {
      return this.proxies.get(agentId)!.port;
    }

    // Allocate new port
    for (let port = this.config.portRange[0]; port <= this.config.portRange[1]; port++) {
      if (await this.isPortAvailable(port)) {
        const proxy = new AgentProxy(agentId, port);
        await proxy.start();
        this.proxies.set(agentId, proxy);
        return port;
      }
    }

    throw new Error('No available proxy ports');
  }

  async create(agentId: string, port: number): Promise<void> {
    const proxy = new AgentProxy(agentId, port);
    await proxy.start();
    this.proxies.set(agentId, proxy);
  }

  async close(agentId: string): Promise<void> {
    const proxy = this.proxies.get(agentId);
    if (proxy) {
      await proxy.stop();
      this.proxies.delete(agentId);
    }
  }

  async closeAll(): Promise<void> {
    const promises = Array.from(this.proxies.values()).map(p => p.stop());
    await Promise.all(promises);
    this.proxies.clear();
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    const net = require('net');
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '127.0.0.1');
    });
  }

  getStats() {
    return {
      total: this.proxies.size,
      active: Array.from(this.proxies.values()).filter(p => p.isActive()).length,
    };
  }
}

class AgentProxy {
  private server: any;
  private active = false;

  constructor(
    public agentId: string,
    public port: number
  ) {}

  async start(): Promise<void> {
    const http = require('http');
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    await new Promise((resolve) => {
      this.server.once('listening', resolve);
      this.server.listen(this.port, '127.0.0.1');
    });

    this.active = true;
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise((resolve) => {
        this.server.once('close', resolve);
        this.server.close();
      });
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  private handleRequest(req: any, res: any): void {
    // Parse target agent from Host header
    const host = req.headers.host;
    const targetAgentId = this.parseAgentId(host);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      from: this.agentId,
      to: targetAgentId,
      path: req.url,
      method: req.method,
      headers: req.headers,
    }));
  }

  private parseAgentId(host: string): string {
    // Host format: <agent-id>.huinet.local or <agent-id>.huinet.local:<port>
    const match = host.match(/^([^.]+)\.huinet\.local/);
    return match ? match[1] : host;
  }
}
```

**Step 3: 运行测试验证**

```bash
npm test -- cli/daemon/proxy.test.ts
```

**Step 4: 提交代理池实现**

```bash
git add cli/daemon/proxy.ts cli/daemon/proxy.test.ts
git commit -m "feat: implement HTTP proxy pool for agent communication"
```

---

### Task 1.4: 实现管理 API

**Files:**
- Create: `cli/daemon/api.ts`
- Create: `cli/daemon/api.test.ts`

**Step 1: 实现 REST API 端点**

```typescript
// cli/daemon/api.ts
import express from 'express';
import { AgentRegistry } from './registry';
import { HTTPProxyPool } from './proxy';

export function setupAdminAPI(
  registry: AgentRegistry,
  proxyPool: HTTPProxyPool,
  config: DaemonConfig
): express.Application {
  const app = express();
  app.use(express.json());

  // GET /api/status
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      machineId: registry.getMachineInfo().machineId,
      stats: registry.getStats(),
      proxyStats: proxyPool.getStats(),
    });
  });

  // POST /api/agents/register
  app.post('/api/agents/register', (req, res) => {
    const { agentType, agentName, pid, version } = req.body;
    const agentId = generateAgentId();

    const proxyPort = await proxyPool.allocate(agentId);

    const agent = registry.add({
      agentId,
      agentType,
      agentName,
      pid,
      status: 'running',
      lastHeartbeat: Date.now(),
      proxyPort,
      registeredAt: Date.now(),
    });

    res.json({
      agentId,
      proxyPort,
      heartbeatInterval: config.heartbeatInterval,
    });
  });

  // POST /api/agents/heartbeat
  app.post('/api/agents/heartbeat', (req, res) => {
    const { agentId, status } = req.body;
    const updated = registry.updateHeartbeat(agentId);

    res.json({ registered: updated, networkTime: Date.now() });
  });

  // GET /api/agents
  app.get('/api/agents', (req, res) => {
    const agents = registry.getAll();
    res.json({ agents });
  });

  // GET /api/topology
  app.get('/api/topology', (req, res) => {
    const agents = registry.getAll();
    const machines = groupByMachine(agents);
    res.json({ machines, connections: [] });
  });

  // DELETE /api/agents/:agentId
  app.delete('/api/agents/:agentId', (req, res) => {
    const { agentId } = req.params;
    const removed = registry.remove(agentId);

    if (removed) {
      await proxyPool.close(agentId);
    }

    res.json({ success: removed });
  });

  return app;
}

function generateAgentId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function groupByMachine(agents: any[]): any[] {
  const grouped = new Map();
  for (const agent of agents) {
    if (!grouped.has(agent.machineId)) {
      grouped.set(agent.machineId, {
        machineId: agent.machineId,
        agents: [],
      });
    }
    grouped.get(agent.machineId).agents.push(agent);
  }
  return Array.from(grouped.values());
}
```

**Step 2: 添加 API 测试**

```typescript
// cli/daemon/api.test.ts
import request from 'supertest';
import { setupAdminAPI } from '../api';
import { AgentRegistry } from '../registry';
import { HTTPProxyPool } from '../proxy';

describe('Admin API', () => {
  let app: express.Application;
  let registry: AgentRegistry;
  let proxyPool: HTTPProxyPool;

  beforeEach(() => {
    registry = new AgentRegistry({
      machineId: 'test-machine',
      machineName: 'Test',
      location: 'Local',
    });
    proxyPool = new HTTPProxyPool({ portRange: [8080, 8085] });
    app = setupAdminAPI(registry, proxyPool, {
      adminPort: 3000,
      heartbeatInterval: 3000,
    });
  });

  it('GET /api/status returns daemon status', async () => {
    const response = await request(app)
      .get('/api/status')
      .expect(200)
      .expect(res => res.body.status).toBe('ok');

    expect(response.body.stats).toBeDefined();
  });

  it('POST /api/agents/register registers agent', async () => {
    const response = await request(app)
      .post('/api/agents/register')
      .send({
        agentType: 'claude-code',
        agentName: 'Test Agent',
        pid: 1234,
        version: '1.0.0',
      })
      .expect(200)
      .expect(res => res.body.agentId).toMatch(/^agent-/);

    expect(response.body.proxyPort).toBeGreaterThanOrEqual(8080);
  });

  it('POST /api/agents/heartbeat updates heartbeat', async () => {
    // First register an agent
    const register = await request(app)
      .post('/api/agents/register')
      .send({
        agentType: 'claude-code',
        agentName: 'Test Agent',
        pid: 1234,
      });

    const { agentId } = register.body;

    // Send heartbeat
    const response = await request(app)
      .post('/api/agents/heartbeat')
      .send({ agentId, status: 'running' })
      .expect(200)
      .expect(res.body.registered).toBe(true);
  });

  it('DELETE /api/agents/:agentId removes agent', async () => {
    // First register an agent
    const register = await request(app)
      .post('/api/agents/register')
      .send({ agentType: 'claude-code', agentName: 'Test', pid: 1234 });

    const { agentId } = register.body;

    // Remove agent
    const response = await request(app)
      .delete(`/api/agents/${agentId}`)
      .expect(200)
      .expect(res.body.success).toBe(true);
  });
});
```

**Step 3: 运行测试并提交**

```bash
npm test -- cli/daemon/api.test.ts
git add cli/daemon/api.ts cli/daemon/api.test.ts
git commit -m "feat: implement admin REST API for agent management"
```

---

## Phase 2: Agent 启动器 (Week 2)

### Task 2.1: 实现启动器核心

**Files:**
- Create: `cli/launcher/index.ts`
- Create: `cli/launcher/supervisor.ts`
- Create: `cli/launcher/agent-types.ts`
- Create: `cli/huinet-launch.ts`

**Step 1: 实现 Agent 类型配置**

```typescript
// cli/launcher/agent-types.ts
export interface AgentTypeConfig {
  name: string;
  command: string;
  args: string[];
  detect: (cmd: string) => boolean;
}

export const AGENT_TYPES: Record<string, AgentTypeConfig> = {
  'claude-code': {
    name: 'Claude Code',
    command: 'claude',
    args: [],
    detect: (cmd) => cmd.includes('claude') || cmd.includes('Claude'),
  },
  'cursor': {
    name: 'Cursor',
    command: 'cursor',
    args: [],
    detect: (cmd) => cmd.includes('cursor'),
  },
  'openclaw': {
    name: 'OpenClaw',
    command: 'openclaw',
    args: [],
    detect: (cmd) => cmd.includes('openclaw'),
  },
  'windsurf': {
    name: 'Windsurf',
    command: 'windsurf',
    args: [],
    detect: (cmd) => cmd.includes('windsurf'),
  },
};
```

**Step 2: 实现进程监控器**

```typescript
// cli/launcher/supervisor.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export class Supervisor extends EventEmitter {
  private agentProcess: ChildProcess | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private daemonUrl: string, private agentId: string) {
    super();
  }

  async launch(command: string, args: string[], env: Record<string, string>): Promise<void> {
    this.agentProcess = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });

    this.agentProcess.on('error', (error) => {
      this.emit('error', error);
    });

    this.agentProcess.on('exit', async (code, signal) => {
      this.stopHeartbeat();
      await this.unregister(code, signal);
      this.emit('exit', { code, signal });
    });

    this.startHeartbeat();
    this.emit('launched');
  }

  private startHeartbeat(): void {
    const heartbeatInterval = 3000; // Will get from daemon
    this.heartbeatTimer = setInterval(async () => {
      try {
        const response = await fetch(`${this.daemonUrl}/api/agents/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: this.agentId, status: 'running' }),
        });

        if (!response.ok) {
          throw new Error('Heartbeat failed');
        }
      } catch (error) {
        this.emit('heartbeat-failed', error);
      }
    }, heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async unregister(code: number | null, signal: string | null): Promise<void> {
    try {
      await fetch(`${this.daemonUrl}/api/agents/${this.agentId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to unregister agent:', error);
    }
  }

  stop(): void {
    this.stopHeartbeat();
    if (this.agentProcess) {
      this.agentProcess.kill();
      this.agentProcess = null;
    }
  }
}
```

**Step 3: 实现启动器主逻辑**

```typescript
// cli/launcher/index.ts
import { AGENT_TYPES } from './agent-types';
import { Supervisor } from './supervisor';

export async function launch(agentCommand: string, args: string[]): Promise<void> {
  // Detect agent type
  const agentType = detectAgentType(agentCommand);
  if (!agentType) {
    console.error(`Unknown agent type: ${agentCommand}`);
    console.error('Supported agents:', Object.keys(AGENT_TYPES).join(', '));
    process.exit(1);
  }

  // Check daemon availability
  const daemonUrl = process.env.HUINET_DAEMON_URL || 'http://127.0.0.1:3000';
  try {
    await fetch(`${daemonUrl}/api/status`);
  } catch {
    console.error('HuiNet daemon is not running. Please start it with:');
    console.error('  huinet daemon start');
    process.exit(1);
  }

  // Register agent
  const agentName = args[0] || agentType.name;
  const registration = await fetch(`${daemonUrl}/api/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentType: agentType.name,
      agentName,
      pid: process.pid,
    }),
  });

  if (!registration.ok) {
    console.error('Failed to register agent');
    process.exit(1);
  }

  const { agentId, httpProxyPort, heartbeatInterval } = await registration.json();

  // Setup environment
  const env = {
    ...process.env,
    HUINET_AGENT_ID: agentId,
    HUINET_AGENT_TYPE: agentType.name,
    HTTP_PROXY: `http://127.0.0.1:${httpProxyPort}`,
    http_proxy: `http://127.0.0.1:${httpProxyPort}`,
    HTTPS_PROXY: `http://127.0.0.1:${httpProxyPort}`,
    https_proxy: `http://127.0.0.1:${httpProxyPort}`,
  };

  // Launch agent
  const supervisor = new Supervisor(daemonUrl, agentId);
  supervisor.on('error', (error) => {
    console.error('Agent error:', error);
  });

  supervisor.on('exit', ({ code, signal }) => {
    if (code !== 0) {
      console.error(`Agent exited with code ${code}, signal ${signal}`);
    }
    process.exit(code || 1);
  });

  await supervisor.launch(agentType.command, [...agentType.args, ...args], env);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    supervisor.stop();
    process.exit(0);
  });

  console.log(`Agent launched with ID: ${agentId}`);
  console.log(`Proxy: http://127.0.0.1:${httpProxyPort}`);
}

function detectAgentType(command: string): AgentTypeConfig | null {
  for (const [key, config] of Object.entries(AGENT_TYPES)) {
    if (config.detect(command)) {
      return { key, ...config };
    }
  }
  return null;
}
```

**Step 4: 创建命令行入口**

```typescript
// cli/huinet-launch.ts
#!/usr/bin/env node
import { launch } from './launcher';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: huinet-launch <agent-command> [args...]');
  process.exit(1);
}

launch(args[0], args.slice(1)).catch((error) => {
  console.error('Failed to launch agent:', error);
  process.exit(1);
});
```

**Step 5: 提交启动器实现**

```bash
git add cli/launcher/ cli/huinet-launch.ts
git commit -m "feat: implement agent launcher with supervisor"
```

---

## Phase 3: 监控控制台 (Week 3)

### Task 3.1: 实现 TUI 框架

**Files:**
- Create: `cli/monitor/index.ts`
- Create: `cli/monitor/ui/components.tsx`
- Create: `cli/monitor/client.ts`
- Create: `cli/huinet-monitor.ts`

**Step 1: 安装 TUI 依赖**

```bash
npm install ink@^4.0.0 ink@latest react react-dom --save-exact
```

**Step 2: 创建监控客户端**

```typescript
// cli/monitor/client.ts
export class DaemonClient {
  private ws: WebSocket | null = null;

  constructor(private baseUrl: string) {}

  async connect(): Promise<void> {
    // HTTP connection for queries
    const response = await fetch(`${this.baseUrl}/api/topology`);
    return;
  }

  subscribeEvents(): EventSource {
    return new EventSource(`${this.baseUrl}/api/events`);
  }

  async getTopology(): Promise<NetworkTopology> {
    const response = await fetch(`${this.baseUrl}/api/topology`);
    return response.json();
  }

  async sendMessage(fromAgent: string, toAgent: string, message: any): Promise<void> {
    await fetch(`${this.baseUrl}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromAgent, toAgent, message }),
    });
  }
}
```

**Step 3: 创建 TUI 组件**

```typescript
// cli/monitor/ui/components.tsx
import { Box, Text, useInput, useApp } from 'ink';

export const TopologyView: React.FC<{ topology: NetworkTopology }> = ({ topology }) => {
  return (
    <Box flexDirection="column" borderStyle="single" padding={1}>
      <Text bold>Network Topology</Text>
      <Box flexDirection="row">
        {topology.machines.map(machine => (
          <Box key={machine.machineId} marginRight={2}>
            <Box borderStyle="round" padding={1}>
              <Text bold>{machine.machineName}</Text>
              <Text dimColor>({machine.status})</Text>
              <Box marginTop={1}>
                {machine.agents.map(agent => (
                  <Box key={agent.agentId}>
                    <Text>
                      {agent.status === 'online' ? '●' : '○'} {agent.agentName}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export const StatusBar: React.FC<{ stats: NetworkStats }> = ({ stats }) => {
  return (
    <Box>
      <Text>● {stats.online} ○ {stats.offline} | Connected: {stats.connectedCount}</Text>
    </Box>
  );
};

export const MainMenu: React.FC = () => {
  const [selected, setSelected] = useState('topology');
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.escape) {
      exit();
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>Main Menu</Text>
      <Text>→ [{selected === 'topology' ? 'X' : ' '}] Topology</Text>
      <Text>→ [{selected === 'agents' ? 'X' : ' '}] Agents</Text>
      <Text>→ [{selected === 'messages' ? 'X' : ' '}] Messages</Text>
      <Text>→ [q] Quit</Text>
    </Box>
  );
};
```

**Step 4: 实现主监控界面**

```typescript
// cli/monitor/index.ts
import { render } from 'ink';
import { DaemonClient } from './client';
import { TopologyView, StatusBar, MainMenu } from './ui/components';

async function startMonitor(daemonUrl: string = 'http://127.0.0.1:3000') {
  const client = new DaemonClient(daemonUrl);

  const { unmount } = render(
    <MonitorApp client={client} />
  );

  await client.connect();
  const events = client.subscribeEvents();

  events.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Handle real-time updates
  };
}

interface MonitorAppProps {
  client: DaemonClient;
}

const MonitorApp: React.FC<MonitorAppProps> = ({ client }) => {
  const [topology, setTopology] = React.useState<NetworkTopology>({ machines: [], connections: [] });
  const [selected, setSelected] = useState('topology');
  const [stats, setStats] = useState({ online: 0, offline: 0 });

  React.useEffect(() => {
    const interval = setInterval(async () => {
      const newTopology = await client.getTopology();
      setTopology(newTopology);
      setStats(calculateStats(newTopology));
    }, 1000);

    return () => clearInterval(interval);
  }, [client]);

  return (
    <>
      <StatusBar stats={stats} />
      {selected === 'topology' && <TopologyView topology={topology} />}
    </>
  );
};
```

**Step 5: 创建命令行入口**

```typescript
// cli/huinet-monitor.ts
#!/usr/bin/env node
import { startMonitor } from './monitor';

const daemonUrl = process.env.HUINET_DAEMON_URL || 'http://127.0.0.1:3000';
startMonitor(daemonUrl).catch((error) => {
  console.error('Failed to start monitor:', error);
  process.exit(1);
});
```

**Step 6: 提交监控控制台实现**

```bash
git add cli/monitor/ cli/huinet-monitor.ts package.json package-lock.json
git commit -m "feat: implement TUI monitor with real-time topology view"
```

---

## Phase 4: P2P 协议扩展 (Week 4)

### Task 4.1: 扩展消息协议

**Files:**
- Create: `src/protocol/agent.ts`
- Modify: `src/protocol/index.ts`

**Step 1: 定义 Agent 消息类型**

```typescript
// src/protocol/agent.ts
import { MessageType } from './index';

export enum AgentMessageType {
  MACHINE_ANNOUNCE = 0x20,
  AGENT_ANNOUNCE = 0x21,
  AGENT_HEARTBEAT = 0x22,
  AGENT_STATUS = 0x23,
  AGENT_MESSAGE = 0x24,
}

export interface MachineAnnounceMessage {
  type: AgentMessageType.MACHINE_ANNOUNCE;
  machineId: string;
  machineName: string;
  location: string;
  agents: AgentSummary[];
}

export interface AgentAnnounceMessage {
  type: AgentMessageType.AGENT_ANNOUNCE;
  machineId: string;
  agentId: string;
  agentType: string;
  agentName: string;
  capabilities: string[];
}

export interface AgentMessage {
  type: AgentMessageType.AGENT_MESSAGE;
  fromAgent: string;
  toAgent: string;
  message: any;
}
```

**Step 2: 更新协议导出**

```typescript
// src/protocol/index.ts
export * from './codec';
export * from './agent';
export * from './handshake';
export * from './heartbeat';
```

**Step 3: 提交协议扩展**

```bash
git add src/protocol/agent.ts src/protocol/index.ts
git commit -m "feat: add agent message types for P2P agent management"
```

---

### Task 4.2: 实现 P2P 消息路由

**Files:**
- Modify: `cli/daemon/index.ts`
- Create: `cli/daemon/p2p-sync.ts`

**Step 1: 实现 P2P 同步器**

```typescript
// cli/daemon/p2p-sync.ts
import { HuiNet } from '@huinet/network';
import { AgentInfo } from './types';

export class P2PSync {
  private remoteMachines: Map<string, RemoteMachine> = new Map();

  constructor(private huinet: HuiNet) {
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    this.huinet.on('message', (from, data) => {
      this.handleMessage(from, data);
    });
  }

  private handleMessage(from: string, data: any): void {
    switch (data.type) {
      case 'MACHINE_ANNOUNCE':
        this.handleMachineAnnounce(from, data);
        break;
      case 'AGENT_ANNOUNCE':
        this.handleAgentAnnounce(from, data);
        break;
      case 'AGENT_HEARTBEAT':
        this.handleAgentHeartbeat(from, data);
        break;
    }
  }

  private handleMachineAnnounce(from: string, data: MachineAnnounceMessage): void {
    this.remoteMachines.set(data.machineId, {
      machineId: data.machineId,
      machineName: data.machineName,
      status: 'online',
      lastSeen: Date.now(),
      agents: data.agents,
    });
  }

  async announceMachine(): Promise<void> {
    const localAgents = this.getLocalAgents();

    const message: MachineAnnounceMessage = {
      type: 0x20, // MACHINE_ANNOUNCE
      machineId: this.config.machineInfo.machineId,
      machineName: this.config.machineInfo.machineName,
      location: this.config.machineInfo.location,
      agents: localAgents.map(a => ({
        agentId: a.agentId,
        agentType: a.agentType,
        agentName: a.agentName,
      })),
    };

    await this.huinet.broadcast(JSON.stringify(message));
  }

  async sendMessageToAgent(toMachineId: string, toAgentId: string, message: any): Promise<void> {
    // Route through remote daemon
    const message: AgentMessage = {
      type: 0x24, // AGENT_MESSAGE
      fromAgent: this.localAgentId,
      toAgent: toAgentId,
      message,
    };

    await this.huinet.send(toMachineId, message);
  }
}
```

**Step 2: 集成到守护进程**

```typescript
// Modify cli/daemon/index.ts
import { P2PSync } from './p2p-sync';

export class HuiNetDaemon {
  private p2pSync: P2PSync;

  async start(): Promise<void> {
    // ... existing code ...

    // Initialize P2P sync
    this.p2pSync = new P2PSync(this.huinet);

    // Announce machine on startup
    await this.p2pSync.announceMachine();

    // Start heartbeat for machine
    this.startMachineHeartbeat();
  }
}
```

**Step 3: 提交 P2P 路由实现**

```bash
git add cli/daemon/p2p-sync.ts cli/daemon/index.ts
git commit -m "feat: implement P2P message routing for cross-machine agent communication"
```

---

## Phase 5: 测试和文档 (Week 5)

### Task 5.1: 集成测试

**Files:**
- Create: `cli/integration/agent-lifecycle.test.ts`
- Create: `cli/integration/p2p-communication.test.ts`

**Step 1: 实现 Agent 生命周期集成测试**

```typescript
// cli/integration/agent-lifecycle.test.ts
import { AgentRegistry } from '../daemon/registry';
import { HTTPProxyPool } from '../daemon/proxy';

describe('Agent Lifecycle Integration', () => {
  it('should register, heartbeat, and cleanup agent', async () => {
    const registry = new AgentRegistry({
      machineId: 'test-machine',
      machineName: 'Test',
      location: 'Local',
    });
    const proxyPool = new HTTPProxyPool({ portRange: [8080, 8085] });

    // Register agent
    const agent = registry.add({
      agentId: 'agent-1',
      machineId: 'test-machine',
      agentType: 'test',
      agentName: 'Test Agent',
      pid: 1234,
      status: 'running',
      lastHeartbeat: Date.now(),
      proxyPort: 8081,
      registeredAt: Date.now(),
    });

    expect(agent.agentId).toBe('agent-1');

    // Heartbeat
    const updated = registry.updateHeartbeat('agent-1');
    expect(updated).toBe(true);

    // Cleanup
    const removed = registry.remove('agent-1');
    expect(removed).toBe(true);

    await proxyPool.closeAll();
  });
});
```

**Step 2: 提交集成测试**

```bash
git add cli/integration/
git commit -m "test: add integration tests for agent lifecycle"
```

### Task 5.2: 用户文档

**Files:**
- Create: `docs/agent-management-guide.md`
- Create: `docs/troubleshooting.md`

**Step 1: 编写用户指南**

```markdown
# HuiNet Agent 管理指南

## 安装

### 一键安装
```bash
curl -sSL https://install.huinet.dev | sh
```

### 手动安装
```bash
npm install -g @huinet/daemon
huinet daemon start
```

## 使用

### 启动 Agent

```bash
# 启动 Claude Code
huinet launch claude-code

# 启动 OpenClaw
huinet launch openclaw

# 启动 Cursor
huinet launch cursor
```

### 监控

```bash
# 打开监控面板
huinet monitor

# 查看状态
huinet status
```

### 发送消息

```bash
huinet send <agent-id> "Hello"
```

## 高级配置

### 配置文件

`~/.huinet/daemon.json`:
```json
{
  "machineName": "开发机-01",
  "proxyPortRange": [8080, 8100]
}
```

### 环境变量

```bash
export HUINET_DAEMON_URL="http://localhost:3000"
```
```

**Step 2: 提交文档**

```bash
git add docs/
git commit -m "docs: add agent management user guide and troubleshooting"
```

---

## 提交总结

完成此实现计划后，将创建以下 git commits：

1. 守护进程框架和类型
2. Agent 注册表
3. HTTP 代理池
4. 管理 REST API
5. Agent 启动器
6. TUI 监控控制台
7. P2P 协议扩展
8. P2P 消息路由
9. 集成测试
10. 用户文档

**预计时间：** 5 周
**测试覆盖：** 新增 150+ 测试
**代码行数：** 约 3000 行新增代码

---

**计划已保存。选择执行方式：**

1. **Subagent-Driven (当前会话)** - 我派发子任务，审查每个任务
2. **Parallel Session (新会话)** - 在新会话中使用 executing-plans 技能批量执行

**选择哪种方式？**
