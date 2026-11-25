/**
 * HuiNet Local Hub — singleton same-machine A2A control plane
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ensureHuiNetDirs,
  getHuiNetPaths,
  loadHubConfig,
  saveHubConfig,
  type HubConfig,
  type HuiNetPaths,
} from '../paths';
import { createAgentScanner, type AgentScanner } from '../inventory';
import { createContextStore, importSessions, type ContextStore } from '../context';
import {
  agentIdToMcpTarget,
  buildMcpSnippet,
  isMcpWired,
  wireMcpTarget,
} from '../mcp/install';
import { AgentDirectory } from './directory';
import { MessageBus, type BusMessage } from './bus';
import {
  isA2aOpen,
  loadNetworkAccess,
  setA2aOpen,
  setManyA2aOpen,
} from './network-access';
import { HubRPC, A2AMethod, type JSONRPCRequest } from './rpc';

export interface EnrichedAgent {
  id: string;
  name: string;
  presence: string;
  binaryPath?: string;
  version?: string;
  homeDir?: string;
  sessionDir?: string;
  capabilities?: string[];
  signals?: string[];
  online?: boolean;
  connected?: boolean;
  /** Open to same-machine A2A fabric */
  a2aOpen: boolean;
  /** Can install HuiNet MCP */
  mcpSupported: boolean;
  /** MCP config already written */
  mcpWired: boolean;
}

export interface LocalHubStatus {
  running: boolean;
  httpUrl: string;
  wsUrl: string;
  pid: number;
  connectedAgents: number;
  inventoryCount: number;
  memoryCount: number;
  startedAt?: number;
}

export class LocalHub extends EventEmitter {
  private paths: HuiNetPaths;
  private config: HubConfig;
  private directory = new AgentDirectory();
  private bus: MessageBus;
  private scanner: AgentScanner;
  private context: ContextStore;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private wsClients = new Map<string, WebSocket>();
  private running = false;
  private startedAt = 0;
  private token: string;

  constructor(options?: { paths?: HuiNetPaths; config?: Partial<HubConfig> }) {
    super();
    this.paths = options?.paths ?? getHuiNetPaths();
    ensureHuiNetDirs(this.paths);
    this.config = { ...loadHubConfig(this.paths), ...options?.config };
    saveHubConfig(this.config, this.paths);
    this.token = this.loadOrCreateToken();
    this.bus = new MessageBus(this.directory, this.paths);
    this.scanner = createAgentScanner({ paths: this.paths });
    this.context = createContextStore(this.paths);

    this.bus.on('message', (msg: BusMessage) => {
      this.fanoutBusMessage(msg);
      this.emit('busMessage', msg);
    });
  }

  private loadOrCreateToken(): string {
    try {
      if (fs.existsSync(this.paths.tokenFile)) {
        return fs.readFileSync(this.paths.tokenFile, 'utf-8').trim();
      }
    } catch {
      // ignore
    }
    const token = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(this.paths.tokenFile, token, 'utf-8');
    return token;
  }

  getToken(): string {
    return this.token;
  }

  getDirectory(): AgentDirectory {
    return this.directory;
  }

  getBus(): MessageBus {
    return this.bus;
  }

  getContext(): ContextStore {
    return this.context;
  }

  getScanner(): AgentScanner {
    return this.scanner;
  }

  getConfig(): HubConfig {
    return this.config;
  }

  getPaths(): HuiNetPaths {
    return this.paths;
  }

  async start(): Promise<void> {
    if (this.running) return;

    await this.refreshInventory();

    this.httpServer = http.createServer((req, res) => {
      void this.handleHttp(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(this.config.httpPort, this.config.host, () =>
        resolve()
      );
      this.httpServer!.on('error', reject);
    });

    this.wss = new WebSocketServer({
      port: this.config.wsPort,
      host: this.config.host,
    });

    this.wss.on('connection', (ws, req) => {
      this.handleWsConnection(ws, req);
    });

    this.writePid();
    this.running = true;
    this.startedAt = Date.now();
    this.emit('ready');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    for (const ws of this.wsClients.values()) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    this.wsClients.clear();

    await new Promise<void>((resolve) => {
      if (this.wss) {
        this.wss.close(() => resolve());
      } else resolve();
    });
    this.wss = null;

    await new Promise<void>((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => resolve());
      } else resolve();
    });
    this.httpServer = null;

    this.clearPid();
    this.running = false;
    this.emit('stopped');
  }

  private writePid(): void {
    fs.writeFileSync(
      this.paths.daemonPid,
      String(process.pid),
      'utf-8'
    );
  }

  private clearPid(): void {
    try {
      if (fs.existsSync(this.paths.daemonPid)) {
        fs.unlinkSync(this.paths.daemonPid);
      }
    } catch {
      // ignore
    }
  }

  async refreshInventory() {
    this.scanner.setConnected(this.directory.getConnected().map((a) => a.id));
    const snap = await this.scanner.scan();
    this.directory.setInventory(snap.agents);
    return snap;
  }

  getStatus(): LocalHubStatus {
    return {
      running: this.running,
      httpUrl: `http://${this.config.host}:${this.config.httpPort}`,
      wsUrl: `ws://${this.config.host}:${this.config.wsPort}`,
      pid: process.pid,
      connectedAgents: this.directory.getConnected().length,
      inventoryCount: this.directory.getInventory().length,
      memoryCount: this.context.list({ limit: 10000 }).length,
      startedAt: this.startedAt || undefined,
    };
  }

  enrichAgents(): EnrichedAgent[] {
    const access = loadNetworkAccess(this.paths);
    return this.directory.listAll().map((a) => {
      const mcpTarget = agentIdToMcpTarget(a.id);
      return {
        ...a,
        a2aOpen: Boolean(access.a2aOpen[a.id]),
        mcpSupported: mcpTarget !== null,
        mcpWired: mcpTarget ? isMcpWired(mcpTarget) : false,
      };
    });
  }

  /** Agents visible on the A2A fabric (open switch on) */
  listA2aPeers(excludeId?: string): EnrichedAgent[] {
    return this.enrichAgents().filter(
      (a) => a.a2aOpen && a.id !== excludeId
    );
  }

  private cors(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  private async readBody(req: http.IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  private json(
    res: http.ServerResponse,
    status: number,
    body: unknown
  ): void {
    this.cors(res);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  private async handleHttp(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    this.cors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${this.config.host}`);
    const p = url.pathname;

    try {
      if (p === '/api/health' && req.method === 'GET') {
        this.json(res, 200, { ok: true, ...this.getStatus() });
        return;
      }

      if (p === '/api/status' && req.method === 'GET') {
        this.json(res, 200, this.getStatus());
        return;
      }

      if (p === '/api/agents' && req.method === 'GET') {
        this.json(res, 200, { agents: this.enrichAgents() });
        return;
      }

      if (p === '/api/agents/scan' && req.method === 'POST') {
        await this.refreshInventory();
        this.json(res, 200, { agents: this.enrichAgents() });
        return;
      }

      if (p === '/api/agents/connected' && req.method === 'GET') {
        this.json(res, 200, { agents: this.directory.getConnected() });
        return;
      }

      if (p === '/api/agents/connect-all' && req.method === 'POST') {
        const results = this.connectAllSupported();
        this.json(res, 200, results);
        return;
      }

      if (p === '/api/agents/disconnect-all' && req.method === 'POST') {
        this.json(res, 200, this.disconnectAll());
        return;
      }

      // POST /api/agents/:id/a2a  { open: boolean }
      const a2aMatch = p.match(/^\/api\/agents\/([^/]+)\/a2a$/);
      if (a2aMatch && req.method === 'POST') {
        const id = decodeURIComponent(a2aMatch[1]);
        const body = JSON.parse(await this.readBody(req)) as { open?: boolean };
        const open = Boolean(body.open);
        const mcpTarget = agentIdToMcpTarget(id);

        let wireResult = null;
        if (open && mcpTarget) {
          wireResult = wireMcpTarget(
            mcpTarget,
            buildMcpSnippet(this.token).mcpServers.huinet
          );
        }
        setA2aOpen(id, open, this.paths);

        const agent = this.enrichAgents().find((a) => a.id === id);
        this.json(res, 200, {
          agent,
          wire: wireResult,
          message: open
            ? mcpTarget
              ? 'Opened on A2A and MCP wired'
              : 'Opened on A2A (no MCP adapter for this agent)'
            : 'Closed on A2A network',
        });
        return;
      }

      if (p.startsWith('/api/agents/') && req.method === 'GET') {
        const id = decodeURIComponent(p.slice('/api/agents/'.length));
        const agent = this.enrichAgents().find((a) => a.id === id);
        if (!agent) {
          this.json(res, 404, { error: 'not found' });
          return;
        }
        this.json(res, 200, agent);
        return;
      }

      if (p === '/api/bus/messages' && req.method === 'GET') {
        const messages = this.bus.getRecent(100);
        const byAgent: Record<string, number> = {};
        for (const m of messages) {
          const t = m.tokens || 0;
          if (m.from && m.from !== 'ui' && m.from !== '*') {
            byAgent[m.from] = (byAgent[m.from] || 0) + t;
          }
          if (m.to && m.to !== '*' && m.to !== 'hub' && m.to !== 'ui') {
            byAgent[m.to] = (byAgent[m.to] || 0) + t;
          }
        }
        this.json(res, 200, {
          messages,
          tokenTotals: byAgent,
          tokenSum: messages.reduce((s, m) => s + (m.tokens || 0), 0),
        });
        return;
      }

      if (p === '/api/bus/send' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req));
        const payload = body.payload ?? body.message ?? {};
        const msg = this.bus.publish({
          from: body.from || 'ui',
          to: body.to,
          type: body.type || 'chat',
          payload,
          tokens: body.tokens,
        });
        this.json(res, 200, msg);
        return;
      }

      if (p === '/api/context' && req.method === 'GET') {
        const project = url.searchParams.get('project') || undefined;
        const q = url.searchParams.get('q');
        const entries = q
          ? this.context.search(q)
          : this.context.list({ project, limit: 100 });
        this.json(res, 200, { memories: entries });
        return;
      }

      if (p === '/api/context' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req));
        const entry = this.context.upsert(body);
        this.json(res, 200, entry);
        return;
      }

      const ctxDel = p.match(/^\/api\/context\/([^/]+)$/);
      if (ctxDel && req.method === 'DELETE') {
        const id = decodeURIComponent(ctxDel[1]);
        const ok = this.context.delete(id);
        this.json(res, ok ? 200 : 404, ok ? { deleted: id } : { error: 'not found' });
        return;
      }

      if (p === '/api/context/import' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req));
        const result = await importSessions({
          from: body.from,
          project: body.project,
          limit: body.limit,
          store: this.context,
        });
        this.json(res, 200, result);
        return;
      }

      if (p === '/api/context/migrate' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req));
        const pkg = this.context.migrate(body);
        this.json(res, 200, pkg);
        return;
      }

      if (p === '/api/doctor' && req.method === 'GET') {
        this.json(res, 200, this.runDoctor());
        return;
      }

      if (p === '/api/mcp/config' && req.method === 'GET') {
        this.json(res, 200, this.buildMcpConfigSnippet());
        return;
      }

      if (p === '/api/mcp/status' && req.method === 'GET') {
        this.json(res, 200, {
          claude: isMcpWired('claude'),
          cursor: isMcpWired('cursor'),
          codex: isMcpWired('codex'),
        });
        return;
      }

      if (p === '/api/mcp/wire' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req)) as {
          target?: string;
          agentId?: string;
          openA2a?: boolean;
        };
        const target =
          body.target ||
          (body.agentId ? agentIdToMcpTarget(body.agentId) : null);
        if (!target) {
          this.json(res, 400, {
            error: 'Provide target (claude|cursor|codex) or a supported agentId',
          });
          return;
        }
        const result = wireMcpTarget(
          target,
          buildMcpSnippet(this.token).mcpServers.huinet
        );
        const agentId = body.agentId || target;
        if (body.openA2a !== false) {
          setA2aOpen(
            agentId === 'claude' ? 'claude-code' : agentId,
            true,
            this.paths
          );
        }
        this.json(res, 200, result);
        return;
      }

      if (p === '/api/mcp/wire-all' && req.method === 'POST') {
        this.json(res, 200, this.connectAllSupported());
        return;
      }

      // Static UI (optional)
      if (p === '/' || p === '/index.html') {
        const uiPath = this.findUiIndex();
        if (uiPath) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(fs.readFileSync(uiPath));
          return;
        }
        this.json(res, 200, {
          name: 'HuiNet Local Hub',
          status: this.getStatus(),
          hint: 'Open the desktop app or use the CLI',
        });
        return;
      }

      if (p.startsWith('/assets/')) {
        const uiRoot = this.findUiRoot();
        if (uiRoot) {
          const file = require('path').join(uiRoot, p.slice(1));
          if (fs.existsSync(file)) {
            const ext = require('path').extname(file);
            const types: Record<string, string> = {
              '.js': 'application/javascript',
              '.css': 'text/css',
              '.svg': 'image/svg+xml',
              '.html': 'text/html',
            };
            res.writeHead(200, {
              'Content-Type': types[ext] || 'application/octet-stream',
            });
            res.end(fs.readFileSync(file));
            return;
          }
        }
      }

      this.json(res, 404, { error: 'not found' });
    } catch (err) {
      this.json(res, 500, { error: (err as Error).message });
    }
  }

  private findUiRoot(): string | null {
    const path = require('path') as typeof import('path');
    const candidates = [
      path.join(__dirname, '../../apps/desktop/dist'),
      path.join(__dirname, '../../../apps/desktop/dist'),
      path.join(process.cwd(), 'apps/desktop/dist'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  private findUiIndex(): string | null {
    const root = this.findUiRoot();
    if (!root) return null;
    const index = require('path').join(root, 'index.html');
    return fs.existsSync(index) ? index : null;
  }

  buildMcpConfigSnippet(): Record<string, unknown> {
    return buildMcpSnippet(this.token);
  }

  /**
   * Wire MCP for every supported agent and open them on A2A.
   */
  connectAllSupported(): {
    wired: ReturnType<typeof wireMcpTarget>[];
    opened: string[];
    agents: EnrichedAgent[];
  } {
    const spec = buildMcpSnippet(this.token).mcpServers.huinet;
    const wired: ReturnType<typeof wireMcpTarget>[] = [];
    const opened: string[] = [];
    const updates: Record<string, boolean> = {};

    for (const agent of this.enrichAgents()) {
      const target = agentIdToMcpTarget(agent.id);
      if (target) {
        wired.push(wireMcpTarget(target, spec));
      }
      updates[agent.id] = true;
      opened.push(agent.id);
    }
    setManyA2aOpen(updates, this.paths);

    return { wired, opened, agents: this.enrichAgents() };
  }

  disconnectAll(): { closed: string[]; agents: EnrichedAgent[] } {
    const updates: Record<string, boolean> = {};
    const closed: string[] = [];
    for (const agent of this.enrichAgents()) {
      updates[agent.id] = false;
      closed.push(agent.id);
    }
    setManyA2aOpen(updates, this.paths);
    return { closed, agents: this.enrichAgents() };
  }

  runDoctor(): {
    ok: boolean;
    checks: Array<{ name: string; pass: boolean; detail?: string }>;
  } {
    const agents = this.enrichAgents();
    const checks = [
      { name: 'Hub 运行中', pass: this.running },
      {
        name: `已发现 Agent（${agents.length}）`,
        pass: agents.length > 0,
      },
      {
        name: `A2A 开放（${agents.filter((a) => a.a2aOpen).length}）`,
        pass: agents.some((a) => a.a2aOpen),
        detail: '在「A2A 网络」页用开关开放，或点一键全连',
      },
      {
        name: 'MCP · Claude',
        pass: isMcpWired('claude'),
      },
      {
        name: 'MCP · Cursor',
        pass: isMcpWired('cursor'),
      },
      {
        name: 'MCP · Codex',
        pass: isMcpWired('codex'),
      },
      {
        name: `记忆条目（${this.context.list({ limit: 10000 }).length}）`,
        pass: true,
      },
    ];
    return { ok: checks.every((c) => c.pass), checks };
  }

  private handleWsConnection(ws: WebSocket, _req: http.IncomingMessage): void {
    let agentId: string | null = null;

    ws.on('message', async (data) => {
      const text = data.toString();
      const request = HubRPC.parseRequest(text);
      if (!request) {
        HubRPC.sendResponse(
          ws,
          HubRPC.createResponse(
            null,
            undefined,
            HubRPC.createError(-32600, 'Invalid Request')
          )
        );
        return;
      }

      try {
        const result = await this.handleRpc(ws, request, () => agentId);
        if (request.method === 'a2a.register' || request.method === 'huinet.register') {
          const params = request.params as { id?: string; name?: string };
          if (params?.id) {
            agentId = params.id;
            this.wsClients.set(agentId, ws);
            this.directory.register({
              id: params.id,
              name: params.name || params.id,
              transport: 'ws',
              connectedAt: Date.now(),
              lastHeartbeat: Date.now(),
            });
            this.scanner.setConnected(
              this.directory.getConnected().map((a) => a.id)
            );
          }
        }

        if (!HubRPC.isNotification(request)) {
          HubRPC.sendResponse(
            ws,
            HubRPC.createResponse(request.id!, result)
          );
        }
      } catch (err) {
        if (!HubRPC.isNotification(request)) {
          HubRPC.sendResponse(
            ws,
            HubRPC.createResponse(
              request.id!,
              undefined,
              HubRPC.createError(-32603, (err as Error).message)
            )
          );
        }
      }
    });

    ws.on('close', () => {
      if (agentId) {
        this.wsClients.delete(agentId);
        this.directory.unregister(agentId);
      }
    });

    // Welcome
    HubRPC.sendRequest(ws, {
      jsonrpc: '2.0',
      method: 'a2a.connected',
      params: {
        wsUrl: `ws://${this.config.host}:${this.config.wsPort}`,
        httpUrl: `http://${this.config.host}:${this.config.httpPort}`,
      },
    });
  }

  private async handleRpc(
    _ws: WebSocket,
    request: JSONRPCRequest,
    getAgentId: () => string | null
  ): Promise<unknown> {
    const method = request.method;
    const params = (request.params || {}) as Record<string, unknown>;
    const from = (params.from as string) || getAgentId() || 'anonymous';

    switch (method) {
      case 'a2a.register':
      case 'huinet.register':
        return { ok: true, id: params.id };

      case A2AMethod.LIST_AGENTS:
        return { agents: this.listA2aPeers(from) };

      case A2AMethod.GET_AGENT_INFO: {
        const id = params.agentId as string;
        const agent = this.enrichAgents().find((a) => a.id === id);
        if (!agent) throw new Error(`Agent not found: ${id}`);
        if (!agent.a2aOpen && id !== from) {
          throw new Error(`Agent ${id} is not open on A2A network`);
        }
        return agent;
      }

      case A2AMethod.SEND_MESSAGE: {
        const to = params.to as string;
        if (to !== '*' && !isA2aOpen(to, this.paths) && to !== from) {
          throw new Error(`Agent ${to} is not open on A2A network`);
        }
        const msg = this.bus.publish({
          from,
          to,
          type: (params.type as string) || 'chat',
          payload: params.payload ?? params.message,
        });
        return { delivered: true, message: msg };
      }

      case A2AMethod.BROADCAST: {
        const msg = this.bus.publish({
          from,
          to: '*',
          type: (params.type as string) || 'chat',
          payload: params.payload ?? params.message,
        });
        return { delivered: true, message: msg };
      }

      case A2AMethod.HEARTBEAT:
        this.directory.heartbeat(from);
        return { ok: true, ts: Date.now() };

      case A2AMethod.TASK_EXECUTE: {
        const to = params.to as string;
        const msg = this.bus.publish({
          from,
          to,
          type: 'task_request',
          payload: params,
        });
        return { accepted: true, messageId: msg.id };
      }

      case 'context.search':
        return { memories: this.context.search(String(params.query || '')) };

      case 'context.upsert':
        return this.context.upsert(params as never);

      case 'context.get':
        return this.context.get(String(params.id));

      case 'context.list':
        return { memories: this.context.list(params as never) };

      case 'context.migrate':
        return this.context.migrate(params as never);

      case 'context.import':
        return importSessions({
          from: params.from as 'claude' | 'codex' | 'cursor',
          project: params.project as string | undefined,
          store: this.context,
        });

      default:
        throw Object.assign(new Error(`Method not found: ${method}`), {
          code: -32601,
        });
    }
  }

  private fanoutBusMessage(msg: BusMessage): void {
    const targets =
      msg.to === '*'
        ? Array.from(this.wsClients.entries()).filter(
            ([id]) => id !== msg.from && isA2aOpen(id, this.paths)
          )
        : ([[msg.to, this.wsClients.get(msg.to)]] as Array<
            [string, WebSocket | undefined]
          >);

    for (const [id, ws] of targets) {
      if (!ws || ws.readyState !== WebSocket.OPEN) continue;
      if (id === msg.from) continue;
      if (msg.to !== '*' && !isA2aOpen(id, this.paths)) continue;
      HubRPC.sendRequest(ws, {
        jsonrpc: '2.0',
        method: 'a2a.message',
        params: msg,
      });
    }
  }
}

export function createLocalHub(
  options?: ConstructorParameters<typeof LocalHub>[0]
): LocalHub {
  return new LocalHub(options);
}
