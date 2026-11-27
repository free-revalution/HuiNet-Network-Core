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
  kind?: 'runtime' | 'session';
  parentId?: string;
  sessionId?: string;
  title?: string;
  project?: string;
  mtime?: number;
  a2aOpen?: boolean;
  mcpSupported?: boolean;
  mcpWired?: boolean;
  wsConnected?: boolean;
  unreadMail?: number;
  lastHeartbeat?: number;
}

export interface FabricTask {
  id: string;
  from: string;
  to: string;
  title: string;
  description?: string;
  status: string;
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MailItem {
  id: string;
  agentId: string;
  message: BusMessage;
  read: boolean;
  deliveredAt: number;
}

export interface FabricBrief {
  updatedAt: number;
  memories: Array<{
    id: string;
    kind: string;
    title: string;
    body: string;
    pinnedAt: number;
    pinnedBy: string;
    note?: string;
  }>;
  markdown: string;
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
  links?: string[];
  via?: string;
  score?: number;
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
  openTasks?: number;
  unreadMail?: number;
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
  memories: (q?: string, project?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (project) params.set('project', project);
    const qs = params.toString();
    return request<{ memories: Memory[] }>(
      `/api/context${qs ? `?${qs}` : ''}`
    );
  },
  relatedMemories: (id: string) =>
    request<{ memory: Memory; related: Memory[] }>(
      `/api/context/${encodeURIComponent(id)}/related`
    ),
  importSessions: (from: string) =>
    request<{ imported: number; skipped: number }>('/api/context/import', {
      method: 'POST',
      json: { from, limit: 20 },
    }),
  migrate: (project?: string) =>
    request<{ markdown: string; memories: Memory[] }>('/api/context/migrate', {
      method: 'POST',
      json: project ? { project } : {},
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
  consult: (to: string[], message: string, project?: string) =>
    request<{
      ok: boolean;
      delivered: number;
      peers: string[];
    }>('/api/bus/consult', {
      method: 'POST',
      json: { to, message, from: 'ui', project },
    }),
  fabricCanvas: (openOnly = false) =>
    request<{
      nodes: unknown[];
      edges: unknown[];
      markdown: string;
      meta: { generatedAt: number };
    }>(`/api/fabric/canvas${openOnly ? '?open=1' : ''}`),
  mcpConfig: () => request<Record<string, unknown>>('/api/mcp/config'),
  mcpStatus: () =>
    request<{ claude: boolean; cursor: boolean; codex: boolean }>(
      '/api/mcp/status'
    ),
  mailbox: (agentId: string, unreadOnly = true) =>
    request<{ agentId: string; unread: number; items: MailItem[] }>(
      `/api/mailbox?agentId=${encodeURIComponent(agentId)}${
        unreadOnly ? '&unread=1' : ''
      }`
    ),
  mailboxRead: (agentId: string, opts?: { ids?: string[]; all?: boolean }) =>
    request<{ marked: number; unread: number }>('/api/mailbox/read', {
      method: 'POST',
      json: { agentId, ...opts },
    }),
  tasks: (params?: { to?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.to) q.set('to', params.to);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<{
      tasks: FabricTask[];
      summary: { open: number; completed: number; failed: number };
    }>(`/api/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (body: {
    to: string;
    title: string;
    description?: string;
    from?: string;
  }) =>
    request<FabricTask>('/api/tasks', {
      method: 'POST',
      json: body,
    }),
  completeTask: (
    taskId: string,
    body: { status?: string; result?: unknown; error?: string }
  ) =>
    request<FabricTask>(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'POST',
      json: body,
    }),
  brief: (project?: string) =>
    request<FabricBrief>(
      project
        ? `/api/brief?project=${encodeURIComponent(project)}`
        : '/api/brief'
    ),
  pinBrief: (memoryId: string, note?: string) =>
    request<FabricBrief>('/api/brief/pin', {
      method: 'POST',
      json: { memoryId, pinnedBy: 'ui', note },
    }),
  unpinBrief: (memoryId: string) =>
    request<FabricBrief>('/api/brief/unpin', {
      method: 'POST',
      json: { memoryId },
    }),
  agentCard: (agentId: string) =>
    request<Record<string, unknown>>(
      `/api/agents/${encodeURIComponent(agentId)}/card`
    ),
  netFetch: (body: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  }) =>
    request<{
      ok: boolean;
      status: number;
      statusText: string;
      url: string;
      body: string;
      truncated: boolean;
      ms: number;
    }>('/api/net/fetch', { method: 'POST', json: body }),
  terminalRun: (command: string, cwd?: string) =>
    request<{
      ok: boolean;
      code: number | null;
      stdout: string;
      stderr: string;
      ms: number;
      command: string;
    }>('/api/terminal/run', {
      method: 'POST',
      json: { command, cwd },
    }),
};

export { API_BASE };
