const API_BASE =
  import.meta.env.VITE_HUINET_HTTP || 'http://127.0.0.1:19527';

async function request<T>(
  path: string,
  options?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  let body = options?.body;
  if (options?.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface Agent {
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
  a2aOpen?: boolean;
  mcpSupported?: boolean;
  mcpWired?: boolean;
}

export interface Memory {
  id: string;
  kind: string;
  title: string;
  body: string;
  scope: string;
  project?: string;
  updatedAt: number;
  tags: string[];
}

export interface BusMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: unknown;
  tokens?: number;
  timestamp: number;
}

export interface BusSnapshot {
  messages: BusMessage[];
  tokenTotals?: Record<string, number>;
  tokenSum?: number;
}

export interface HubStatus {
  running: boolean;
  httpUrl: string;
  wsUrl: string;
  connectedAgents: number;
  inventoryCount: number;
  memoryCount: number;
  pid?: number;
}

export interface DoctorResult {
  ok: boolean;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
}

export const api = {
  status: () => request<HubStatus>('/api/status'),
  doctor: () => request<DoctorResult>('/api/doctor'),
  agents: () => request<{ agents: Agent[] }>('/api/agents'),
  scan: () =>
    request<{ agents: Agent[] }>('/api/agents/scan', {
      method: 'POST',
      json: {},
    }),
  setA2aOpen: (agentId: string, open: boolean) =>
    request<{
      agent: Agent;
      message: string;
      wire?: { message: string; file: string };
    }>(`/api/agents/${encodeURIComponent(agentId)}/a2a`, {
      method: 'POST',
      json: { open },
    }),
  connectAll: () =>
    request<{
      wired: Array<{ target: string; message: string; file: string }>;
      opened: string[];
      agents: Agent[];
    }>('/api/agents/connect-all', { method: 'POST', json: {} }),
  disconnectAll: () =>
    request<{ closed: string[]; agents: Agent[] }>(
      '/api/agents/disconnect-all',
      { method: 'POST', json: {} }
    ),
  memories: (q?: string) =>
    request<{ memories: Memory[] }>(
      q ? `/api/context?q=${encodeURIComponent(q)}` : '/api/context'
    ),
  importSessions: (from: string) =>
    request<{ imported: number; skipped: number }>('/api/context/import', {
      method: 'POST',
      json: { from, limit: 20 },
    }),
  migrate: () =>
    request<{ markdown: string; memories: Memory[] }>('/api/context/migrate', {
      method: 'POST',
      json: {},
    }),
  upsert: (body: {
    kind: string;
    title: string;
    body: string;
    scope?: string;
    project?: string;
    tags?: string[];
  }) => request<Memory>('/api/context', { method: 'POST', json: body }),
  deleteMemory: (id: string) =>
    request<{ deleted: string }>(`/api/context/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  busMessages: () => request<BusSnapshot>('/api/bus/messages'),
  send: (to: string, message: string, tokens?: number) =>
    request('/api/bus/send', {
      method: 'POST',
      json: {
        to,
        from: 'ui',
        type: 'chat',
        payload: { text: message },
        tokens,
      },
    }),
  mcpConfig: () => request<Record<string, unknown>>('/api/mcp/config'),
  mcpStatus: () =>
    request<{ claude: boolean; cursor: boolean; codex: boolean }>(
      '/api/mcp/status'
    ),
};

export { API_BASE };
