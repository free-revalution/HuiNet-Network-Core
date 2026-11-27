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
  pruneA2aOpen,
  setA2aOpen,
  setManyA2aOpen,
} from './network-access';
import { HubRPC, A2AMethod, type JSONRPCRequest } from './rpc';
import { createMailbox, type Mailbox } from './mailbox';
import { createTaskBoard, type TaskBoard } from './tasks';
import { createFabricBrief, type FabricBriefStore } from './brief';
import { buildFabricCanvas } from './json-canvas';
import { buildAgentCard, buildHubCard } from './agent-card';
import { netFetch } from './net-bridge';
import { runTerminal } from './terminal';
import { linksOf } from '../context/links';

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
  kind?: 'runtime' | 'session';
  parentId?: string;
  sessionId?: string;
  title?: string;
  project?: string;
  mtime?: number;
  /** Open to same-machine A2A fabric */
  a2aOpen: boolean;
  /** Can install HuiNet MCP */
  mcpSupported: boolean;
  /** MCP config already written */
  mcpWired: boolean;
  /** Live WebSocket registration on the hub */
  wsConnected: boolean;
  lastHeartbeat?: number;
  unreadMail?: number;
}

export interface LocalHubStatus {
  running: boolean;
  httpUrl: string;
  wsUrl: string;
  pid: number;
  connectedAgents: number;
  inventoryCount: number;
  memoryCount: number;
  openTasks?: number;
  unreadMail?: number;
  startedAt?: number;
}

export class LocalHub extends EventEmitter {
  private paths: HuiNetPaths;
  private config: HubConfig;
  private directory = new AgentDirectory();
  private bus: MessageBus;
  private scanner: AgentScanner;
  private context: ContextStore;
  private mailbox: Mailbox;
  private tasks: TaskBoard;
  private brief: FabricBriefStore;
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
    this.mailbox = createMailbox(this.paths);
    this.tasks = createTaskBoard(this.paths);
    this.brief = createFabricBrief(this.paths, this.context);

    this.bus.on('message', (msg: BusMessage) => {
      this.depositMailbox(msg);
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
    pruneA2aOpen(
      snap.agents.map((a) => a.id),
      this.paths
    );
    return snap;
  }

  getStatus(): LocalHubStatus {
    const taskSummary = this.tasks.summary();
    return {
      running: this.running,
      httpUrl: `http://${this.config.host}:${this.config.httpPort}`,
      wsUrl: `ws://${this.config.host}:${this.config.wsPort}`,
      pid: process.pid,
      connectedAgents: this.directory.getConnected().length,
      inventoryCount: this.directory.getInventory().length,
      memoryCount: this.context.list({ limit: 10000 }).length,
      openTasks: taskSummary.open,
      unreadMail: this.mailbox.unreadCount(),
      startedAt: this.startedAt || undefined,
    };
  }

  enrichAgents(): EnrichedAgent[] {
    const access = loadNetworkAccess(this.paths);
    return this.directory.listAll().map((a) => {
      const mcpTarget = agentIdToMcpTarget(a.id);
      const parentId = a.parentId;
      const live =
        this.directory.get(a.id) ||
        (parentId ? this.directory.get(parentId) : undefined);
      const wsConnected =
        this.wsClients.has(a.id) ||
        (parentId ? this.wsClients.has(parentId) : false);
      const a2aOpen = Boolean(
        access.a2aOpen[a.id] ||
          (parentId ? access.a2aOpen[parentId] : false)
      );
      return {
        ...a,
        a2aOpen,
        mcpSupported: mcpTarget !== null,
        mcpWired: mcpTarget ? isMcpWired(mcpTarget) : false,
        wsConnected,
        online: wsConnected || Boolean(a.online),
        lastHeartbeat: live?.lastHeartbeat,
        unreadMail: this.mailbox.unreadCount(a.id),
      };
    });
  }

  private hubUrls(): { httpUrl: string; wsUrl: string } {
    return {
      httpUrl: `http://${this.config.host}:${this.config.httpPort}`,
      wsUrl: `ws://${this.config.host}:${this.config.wsPort}`,
    };
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
        const found = this.directory.listAll().find((a) => a.id === id);
        const parentId = found?.parentId;

        let wireResult = null;
        if (open && mcpTarget) {
          wireResult = wireMcpTarget(
            mcpTarget,
            buildMcpSnippet(this.token).mcpServers.huinet
          );
        }
        setA2aOpen(id, open, this.paths);
        // Session nodes share the product MCP — keep parent flag in sync
        if (parentId) setA2aOpen(parentId, open, this.paths);

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

      const agentCardEarly = p.match(/^\/api\/agents\/([^/]+)\/card$/);
      if (agentCardEarly && req.method === 'GET') {
        const id = decodeURIComponent(agentCardEarly[1]);
        const agent = this.enrichAgents().find((a) => a.id === id);
        if (!agent) {
          this.json(res, 404, { error: 'not found' });
          return;
        }
        this.json(res, 200, buildAgentCard(agent, this.hubUrls()));
        return;
      }

      const agentGet = p.match(/^\/api\/agents\/([^/]+)$/);
      if (agentGet && req.method === 'GET') {
        const id = decodeURIComponent(agentGet[1]);
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

      // Multi-agent consult: fan-out one prompt to selected peers
      if (p === '/api/bus/consult' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req)) as {
          to?: string[];
          message?: string;
          from?: string;
          project?: string;
        };
        const targets = (body.to || []).filter(Boolean);
        const text = String(body.message || '').trim();
        if (!targets.length || !text) {
          this.json(res, 400, { error: 'to[] and message required' });
          return;
        }
        const from = body.from || 'ui';
        const messages = targets.map((to) =>
          this.bus.publish({
            from,
            to,
            type: 'consult',
            payload: {
              text,
              consult: true,
              peers: targets,
              project: body.project,
            },
          })
        );
        this.json(res, 200, {
          ok: true,
          delivered: messages.length,
          peers: targets,
          messages,
        });
        return;
      }

      if (p === '/api/fabric/canvas' && req.method === 'GET') {
        const openOnly = url.searchParams.get('open') === '1';
        let agents = this.enrichAgents();
        if (openOnly) agents = agents.filter((a) => a.a2aOpen);
        // Prefer session nodes when present
        const parents = new Set(
          agents
            .filter((a) => a.kind === 'session' && a.parentId)
            .map((a) => a.parentId!)
        );
        agents = agents.filter(
          (a) => a.kind === 'session' || !parents.has(a.id)
        );
        const canvas = buildFabricCanvas({
          agents,
          messages: this.bus.getRecent(200),
        });
        this.json(res, 200, canvas);
        return;
      }

      // --- Mailbox (MCP-friendly inbox) ---
      if (p === '/api/mailbox' && req.method === 'GET') {
        const agentId = url.searchParams.get('agentId');
        if (!agentId) {
          this.json(res, 400, { error: 'agentId required' });
          return;
        }
        const unreadOnly = url.searchParams.get('unread') === '1';
        const items = this.mailbox.list(agentId, { unreadOnly, limit: 50 });
        this.json(res, 200, {
          agentId,
          unread: this.mailbox.unreadCount(agentId),
          items,
        });
        return;
      }

      if (p === '/api/mailbox/read' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req)) as {
          agentId?: string;
          ids?: string[];
          all?: boolean;
        };
        if (!body.agentId) {
          this.json(res, 400, { error: 'agentId required' });
          return;
        }
        const marked = body.all
          ? this.mailbox.markAllRead(body.agentId)
          : this.mailbox.markRead(body.ids || [], body.agentId);
        this.json(res, 200, {
          marked,
          unread: this.mailbox.unreadCount(body.agentId),
        });
        return;
      }

      // --- Fabric tasks ---
      if (p === '/api/tasks' && req.method === 'GET') {
        const to = url.searchParams.get('to') || undefined;
        const from = url.searchParams.get('from') || undefined;
        const status = url.searchParams.get('status') || undefined;
        this.json(res, 200, {
          tasks: this.tasks.list({
            to,
            from,
            status: status as never,
            limit: 50,
          }),
          summary: this.tasks.summary(),
        });
        return;
      }

      if (p === '/api/tasks' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req)) as {
          from?: string;
          to?: string;
          title?: string;
          description?: string;
          notify?: boolean;
        };
        if (!body.to || !body.title) {
          this.json(res, 400, { error: 'to and title required' });
          return;
        }
        const from = body.from || 'ui';
        let messageId: string | undefined;
        if (body.notify !== false) {
          const msg = this.bus.publish({
            from,
            to: body.to,
            type: 'task_request',
            payload: {
              title: body.title,
              description: body.description,
            },
          });
          messageId = msg.id;
        }
        const task = this.tasks.create({
          from,
          to: body.to,
          title: body.title,
          description: body.description,
          messageId,
        });
        this.json(res, 200, task);
        return;
      }

      const taskMatch = p.match(/^\/api\/tasks\/([^/]+)$/);
      if (taskMatch && req.method === 'GET') {
        const task = this.tasks.get(decodeURIComponent(taskMatch[1]));
        if (!task) {
          this.json(res, 404, { error: 'not found' });
          return;
        }
        this.json(res, 200, task);
        return;
      }

      if (taskMatch && req.method === 'POST') {
        const id = decodeURIComponent(taskMatch[1]);
        const body = JSON.parse(await this.readBody(req)) as {
          status?: string;
          result?: unknown;
          error?: string;
        };
        let task;
        if (body.status === 'completed') {
          task = this.tasks.complete(id, body.result);
        } else if (body.status === 'failed') {
          task = this.tasks.fail(id, String(body.error || 'failed'));
        } else if (body.status) {
          task = this.tasks.update(id, {
            status: body.status as never,
            result: body.result,
            error: body.error,
          });
        } else {
          task = this.tasks.update(id, {
            result: body.result,
            error: body.error,
          });
        }
        if (body.status === 'completed' || body.status === 'failed') {
          this.bus.publish({
            from: task.to,
            to: task.from,
            type: 'task_result',
            payload: {
              taskId: task.id,
              status: task.status,
              result: task.result,
              error: task.error,
            },
          });
        }
        this.json(res, 200, task);
        return;
      }

      // --- Fabric brief (pinned working set) ---
      if (p === '/api/brief' && req.method === 'GET') {
        const project = url.searchParams.get('project') || undefined;
        this.json(res, 200, this.brief.get({ project }));
        return;
      }

      if (p === '/api/brief/pin' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req)) as {
          memoryId?: string;
          pinnedBy?: string;
          note?: string;
        };
        if (!body.memoryId) {
          this.json(res, 400, { error: 'memoryId required' });
          return;
        }
        this.json(
          res,
          200,
          this.brief.pin(body.memoryId, body.pinnedBy || 'ui', body.note)
        );
        return;
      }

      if (p === '/api/brief/unpin' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req)) as {
          memoryId?: string;
        };
        if (!body.memoryId) {
          this.json(res, 400, { error: 'memoryId required' });
          return;
        }
        this.json(res, 200, this.brief.unpin(body.memoryId));
        return;
      }

      if (p === '/api/brief/clear' && req.method === 'POST') {
        this.json(res, 200, this.brief.clear());
        return;
      }

      // --- Agent / Hub cards ---
      if (
        (p === '/.well-known/agent.json' || p === '/api/card') &&
        req.method === 'GET'
      ) {
        this.json(
          res,
          200,
          buildHubCard({ ...this.hubUrls(), agents: this.enrichAgents() })
        );
        return;
      }

      if (p === '/api/context' && req.method === 'GET') {
        const project = url.searchParams.get('project') || undefined;
        const q = url.searchParams.get('q');
        const entries = q
          ? this.context.search(q, 20, { project })
          : this.context.list({ project, limit: 100 });
        this.json(res, 200, {
          memories: entries.map((m) => ({
            ...m,
            links: linksOf(m),
          })),
        });
        return;
      }

      if (p === '/api/context' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req));
        const entry = this.context.upsert(body);
        this.json(res, 200, { ...entry, links: linksOf(entry) });
        return;
      }

      const ctxRelated = p.match(/^\/api\/context\/([^/]+)\/related$/);
      if (ctxRelated && req.method === 'GET') {
        const id = decodeURIComponent(ctxRelated[1]);
        const seed = this.context.get(id);
        if (!seed) {
          this.json(res, 404, { error: 'not found' });
          return;
        }
        const related = this.context.related(id);
        this.json(res, 200, {
          memory: { ...seed, links: linksOf(seed) },
          related: related.map((r) => ({
            ...r.memory,
            links: linksOf(r.memory),
            via: r.via,
            score: r.score,
          })),
        });
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

      // Outbound internet for agents (hub listens locally, fetches publicly)
      if (p === '/api/net/fetch' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req)) as {
          url?: string;
          method?: string;
          headers?: Record<string, string>;
          body?: string;
          timeoutMs?: number;
        };
        if (!body.url) {
          this.json(res, 400, { error: 'url required' });
          return;
        }
        try {
          const result = await netFetch({
            url: body.url,
            method: body.method,
            headers: body.headers,
            body: body.body,
            timeoutMs: body.timeoutMs,
          });
          this.bus.publish({
            from: 'hub-net',
            to: '*',
            type: 'net_fetch',
            payload: {
              url: result.url,
              status: result.status,
              ms: result.ms,
              truncated: result.truncated,
            },
          });
          this.json(res, 200, result);
        } catch (err) {
          this.json(res, 400, { error: (err as Error).message });
        }
        return;
      }

      // Local terminal runner for desktop panel
      if (p === '/api/terminal/run' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req)) as {
          command?: string;
          cwd?: string;
          timeoutMs?: number;
        };
        if (!body.command) {
          this.json(res, 400, { error: 'command required' });
          return;
        }
        try {
          const result = await runTerminal({
            command: body.command,
            cwd: body.cwd,
            timeoutMs: body.timeoutMs,
          });
          this.json(res, 200, result);
        } catch (err) {
          this.json(res, 400, { error: (err as Error).message });
        }
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

    const seenMcp = new Set<string>();
    for (const agent of this.enrichAgents()) {
      const target = agentIdToMcpTarget(agent.id);
      if (target && !seenMcp.has(target)) {
        seenMcp.add(target);
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
      {
        name: `开放任务（${this.tasks.summary().open}）`,
        pass: true,
        detail: 'huinet tasks / 协作页',
      },
      {
        name: `未读邮件（${this.mailbox.unreadCount()}）`,
        pass: true,
        detail: 'MCP inbox_check',
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
        if (to !== '*' && !isA2aOpen(to, this.paths) && to !== from) {
          throw new Error(`Agent ${to} is not open on A2A network`);
        }
        const title =
          String(params.title || params.goal || params.description || 'task');
        const msg = this.bus.publish({
          from,
          to,
          type: 'task_request',
          payload: params,
        });
        const task = this.tasks.create({
          from,
          to,
          title,
          description:
            typeof params.description === 'string'
              ? params.description
              : undefined,
          messageId: msg.id,
        });
        return { accepted: true, taskId: task.id, messageId: msg.id, task };
      }

      case A2AMethod.TASK_RESULT: {
        const taskId = String(params.taskId || '');
        if (!taskId) throw new Error('taskId required');
        const status = String(params.status || 'completed');
        const task =
          status === 'failed'
            ? this.tasks.fail(taskId, String(params.error || 'failed'))
            : this.tasks.complete(taskId, params.result);
        this.bus.publish({
          from,
          to: task.from,
          type: 'task_result',
          payload: {
            taskId: task.id,
            status: task.status,
            result: task.result,
            error: task.error,
          },
        });
        return { ok: true, task };
      }

      case 'a2a.mailbox.list':
        return {
          items: this.mailbox.list(String(params.agentId || from), {
            unreadOnly: Boolean(params.unreadOnly),
          }),
        };

      case 'a2a.mailbox.read':
        return {
          marked: this.mailbox.markRead(
            (params.ids as string[]) || [],
            String(params.agentId || from)
          ),
        };

      case 'a2a.brief.get':
        return this.brief.get();

      case 'a2a.card': {
        const id = String(params.agentId || from);
        const agent = this.enrichAgents().find((a) => a.id === id);
        if (!agent) throw new Error(`Agent not found: ${id}`);
        return buildAgentCard(agent, this.hubUrls());
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

  private depositMailbox(msg: BusMessage): void {
    const recipients =
      msg.to === '*'
        ? this.enrichAgents()
            .filter((a) => a.a2aOpen && a.id !== msg.from)
            .map((a) => a.id)
        : msg.to && msg.to !== 'hub' && msg.to !== 'ui'
          ? [msg.to]
          : [];
    if (recipients.length) {
      this.mailbox.deposit(msg, recipients);
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
