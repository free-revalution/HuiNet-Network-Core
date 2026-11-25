#!/usr/bin/env node
/**
 * HuiNet MCP Server — exposes local hub tools to any MCP-capable agent
 *
 * Tools: list_agents, send_message, get_agent_info,
 *        context_search, context_upsert, context_migrate, context_import
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
      'List AI agents discovered or connected on this machine via HuiNet',
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
    name: 'send_message',
    description: 'Send a message to another local agent through HuiNet bus',
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
    name: 'context_search',
    description: 'Search the shared HuiNet context memory hub',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
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
];

async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'list_agents':
      return hubFetch('/api/agents');
    case 'get_agent_info':
      return hubFetch(`/api/agents/${encodeURIComponent(String(args.agentId))}`);
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
    case 'context_search':
      return hubFetch(
        `/api/context?q=${encodeURIComponent(String(args.query || ''))}`
      );
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
        serverInfo: { name: 'huinet', version: '2.0.0' },
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
