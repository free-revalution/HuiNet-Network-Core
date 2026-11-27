#!/usr/bin/env node
/**
 * HuiNet MCP Server — exposes local hub tools to any MCP-capable agent
 *
 * Tools: list_agents, send_message, get_agent_info, inbox_*, task_*,
 *        fabric_brief, agent_card, context_*, scan_agents
 */

import * as http from 'http';

const HUINET_HTTP =
  process.env.HUINET_HTTP || 'http://127.0.0.1:19527';

interface JsonRpcReq {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

async function hubFetch(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<unknown> {
  const method = options?.method || 'GET';
  const url = `${HUINET_HTTP}${path}`;

  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = options?.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: body
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            }
          : undefined,
        timeout: 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          try {
            resolve(JSON.parse(text));
          } catch {
            resolve(text);
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const TOOLS = [
  {
    name: 'list_agents',
    description:
      'List AI agents open on the HuiNet local fabric (A2A peers on this machine)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_agent_info',
    description: 'Get details for one local agent by id',
    inputSchema: {
      type: 'object',
      properties: { agentId: { type: 'string' } },
      required: ['agentId'],
    },
  },
  {
    name: 'agent_card',
    description:
      'Fetch an Agent Card (capabilities/skills) for a peer, or the hub card',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Omit for the hub card',
        },
      },
    },
  },
  {
    name: 'send_message',
    description:
      'Send a message to another local agent through HuiNet bus (lands in their mailbox)',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Target agent id or * for broadcast' },
        message: { type: 'string' },
        from: { type: 'string' },
      },
      required: ['to', 'message'],
    },
  },
  {
    name: 'inbox_check',
    description:
      'Poll your HuiNet mailbox for messages from other agents (MCP has no WS push)',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Your agent id (e.g. claude-code, cursor, codex)',
        },
        unreadOnly: { type: 'boolean' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'inbox_ack',
    description: 'Mark mailbox messages as read',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        ids: { type: 'array', items: { type: 'string' } },
        all: { type: 'boolean' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'task_create',
    description: 'Create a fabric task and notify the assignee on the A2A bus',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        from: { type: 'string' },
      },
      required: ['to', 'title'],
    },
  },
  {
    name: 'task_list',
    description: 'List fabric tasks (optionally filtered by assignee)',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'task_complete',
    description: 'Mark a fabric task completed or failed and notify the requester',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        status: { type: 'string', enum: ['completed', 'failed'] },
        result: {},
        error: { type: 'string' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'fabric_brief',
    description:
      'Get the pinned Fabric Brief — shared working-set context for agents on this machine',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project scope filter',
        },
      },
    },
  },
  {
    name: 'context_search',
    description: 'Search the shared HuiNet context memory hub',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        project: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'context_upsert',
    description: 'Create or update a shared memory entry in HuiNet',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['fact', 'decision', 'preference', 'artifact', 'thread_summary'],
        },
        title: { type: 'string' },
        body: { type: 'string' },
        scope: {
          type: 'string',
          enum: ['global', 'project', 'agent-private'],
        },
        project: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['kind', 'title', 'body'],
    },
  },
  {
    name: 'context_migrate',
    description: 'Export a markdown context package for another agent',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        targetAgent: { type: 'string' },
      },
    },
  },
  {
    name: 'context_import',
    description: 'Import session summaries from claude, codex, or cursor into HuiNet',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', enum: ['claude', 'codex', 'cursor'] },
        project: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['from'],
    },
  },
  {
    name: 'scan_agents',
    description: 'Rescan this machine for installed AI agents',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'net_fetch',
    description:
      'Fetch a public http(s) URL via the local HuiNet hub (outbound internet for agents)',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        method: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['url'],
    },
  },
  {
    name: 'ask_agent',
    description:
      'Send a message to another local agent on the fabric and leave it in their mailbox',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        message: { type: 'string' },
        from: { type: 'string' },
      },
      required: ['to', 'message'],
    },
  },
  {
    name: 'consult_agents',
    description:
      'Fan-out one consult prompt to multiple open fabric peers (parallel symposium)',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Peer agent ids',
        },
        message: { type: 'string' },
        from: { type: 'string' },
        project: { type: 'string' },
      },
      required: ['to', 'message'],
    },
  },
  {
    name: 'fabric_canvas',
    description:
      'Export the local fabric topology as JSON Canvas (Obsidian-compatible)',
    inputSchema: {
      type: 'object',
      properties: {
        openOnly: {
          type: 'boolean',
          description: 'Only include A2A-open nodes',
        },
      },
    },
  },
  {
    name: 'context_related',
    description:
      '1-hop related memories via [[wikilinks]], backlinks, project, and tags',
    inputSchema: {
      type: 'object',
      properties: { memoryId: { type: 'string' } },
      required: ['memoryId'],
    },
  },
];

async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'list_agents': {
      const data = (await hubFetch('/api/agents')) as {
        agents: Array<{ a2aOpen?: boolean; id: string }>;
      };
      return {
        agents: (data.agents || []).filter((a) => a.a2aOpen),
      };
    }
    case 'get_agent_info':
      return hubFetch(`/api/agents/${encodeURIComponent(String(args.agentId))}`);
    case 'agent_card':
      if (args.agentId) {
        return hubFetch(
          `/api/agents/${encodeURIComponent(String(args.agentId))}/card`
        );
      }
      return hubFetch('/api/card');
    case 'send_message':
      return hubFetch('/api/bus/send', {
        method: 'POST',
        body: {
          to: args.to,
          from: args.from || 'mcp-client',
          type: 'chat',
          payload: { text: args.message },
        },
      });
    case 'inbox_check':
      return hubFetch(
        `/api/mailbox?agentId=${encodeURIComponent(String(args.agentId))}${
          args.unreadOnly === false ? '' : '&unread=1'
        }`
      );
    case 'inbox_ack':
      return hubFetch('/api/mailbox/read', {
        method: 'POST',
        body: {
          agentId: args.agentId,
          ids: args.ids,
          all: args.all,
        },
      });
    case 'task_create':
      return hubFetch('/api/tasks', {
        method: 'POST',
        body: {
          to: args.to,
          title: args.title,
          description: args.description,
          from: args.from || 'mcp-client',
        },
      });
    case 'task_list': {
      const q = new URLSearchParams();
      if (args.to) q.set('to', String(args.to));
      if (args.status) q.set('status', String(args.status));
      const qs = q.toString();
      return hubFetch(`/api/tasks${qs ? `?${qs}` : ''}`);
    }
    case 'task_complete':
      return hubFetch(`/api/tasks/${encodeURIComponent(String(args.taskId))}`, {
        method: 'POST',
        body: {
          status: args.status || 'completed',
          result: args.result,
          error: args.error,
        },
      });
    case 'fabric_brief': {
      const q = args.project
        ? `?project=${encodeURIComponent(String(args.project))}`
        : '';
      return hubFetch(`/api/brief${q}`);
    }
    case 'context_search': {
      const params = new URLSearchParams();
      if (args.query) params.set('q', String(args.query));
      if (args.project) params.set('project', String(args.project));
      const qs = params.toString();
      return hubFetch(`/api/context${qs ? `?${qs}` : ''}`);
    }
    case 'context_upsert':
      return hubFetch('/api/context', {
        method: 'POST',
        body: {
          kind: args.kind || 'fact',
          title: args.title,
          body: args.body,
          scope: args.scope || 'global',
          project: args.project,
          tags: args.tags || [],
        },
      });
    case 'context_migrate':
      return hubFetch('/api/context/migrate', {
        method: 'POST',
        body: args,
      });
    case 'context_import':
      return hubFetch('/api/context/import', {
        method: 'POST',
        body: args,
      });
    case 'scan_agents':
      return hubFetch('/api/agents/scan', { method: 'POST', body: {} });
    case 'net_fetch':
      return hubFetch('/api/net/fetch', {
        method: 'POST',
        body: {
          url: args.url,
          method: args.method || 'GET',
          body: args.body,
        },
      });
    case 'ask_agent':
      return hubFetch('/api/bus/send', {
        method: 'POST',
        body: {
          to: args.to,
          from: args.from || 'mcp-client',
          type: 'chat',
          payload: { text: args.message },
        },
      });
    case 'consult_agents':
      return hubFetch('/api/bus/consult', {
        method: 'POST',
        body: {
          to: args.to,
          message: args.message,
          from: args.from || 'mcp-client',
          project: args.project,
        },
      });
    case 'fabric_canvas': {
      const q = args.openOnly ? '?open=1' : '';
      return hubFetch(`/api/fabric/canvas${q}`);
    }
    case 'context_related':
      return hubFetch(
        `/api/context/${encodeURIComponent(String(args.memoryId))}/related`
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(msg: unknown): void {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handle(req: JsonRpcReq): Promise<void> {
  const { id, method, params } = req;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'huinet', version: '2.2.0' },
      },
    });
    return;
  }

  if (method === 'notifications/initialized' || method === 'initialized') {
    return;
  }

  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }

  if (method === 'tools/call') {
    const name = String((params as { name?: string })?.name || '');
    const args =
      ((params as { arguments?: Record<string, unknown> })?.arguments) || {};
    try {
      const result = await callTool(name, args);
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      });
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: (err as Error).message }],
          isError: true,
        },
      });
    }
    return;
  }

  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  send({
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

let buffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx: number;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const req = JSON.parse(line) as JsonRpcReq;
      void handle(req);
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: (err as Error).message },
      });
    }
  }
});

process.stdin.on('end', () => process.exit(0));
