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
  timestamp: number;
}

export interface HubStatus {
  running: boolean;
  httpUrl: string;
  wsUrl: string;
  connectedAgents: number;
  inventoryCount: number;
  memoryCount: number;
}

export const api = {
  status: () => request<HubStatus>('/api/status'),
  agents: () => request<{ agents: Agent[] }>('/api/agents'),
  scan: () => request<{ agents: Agent[] }>('/api/agents/scan', { method: 'POST', json: {} }),
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
  upsert: (body: Partial<Memory> & { title: string; body: string; kind: string }) =>
    request<Memory>('/api/context', { method: 'POST', json: body }),
  busMessages: () => request<{ messages: BusMessage[] }>('/api/bus/messages'),
  send: (to: string, message: string) =>
    request('/api/bus/send', {
      method: 'POST',
      json: { to, from: 'ui', type: 'chat', payload: { text: message } },
    }),
  mcpConfig: () => request<Record<string, unknown>>('/api/mcp/config'),
};

export { API_BASE };
