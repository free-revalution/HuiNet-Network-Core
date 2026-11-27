/**
 * Agent Cards — capability discovery for the local fabric
 * (aligned with Google A2A Agent Card idea, local-only).
 */

export interface CardAgent {
  id: string;
  name: string;
  presence: string;
  version?: string;
  capabilities?: string[];
  a2aOpen: boolean;
  mcpWired: boolean;
  wsConnected?: boolean;
}

export interface AgentCard {
  name: string;
  description: string;
  version?: string;
  url: string;
  protocol: 'huinet-local-a2a';
  preferredTransport: 'ws' | 'mcp' | 'http';
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags?: string[];
  }>;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    mailbox: boolean;
    tasks: boolean;
  };
  provider: {
    organization: string;
    url: string;
  };
  agentId: string;
  a2aOpen: boolean;
  wsConnected: boolean;
  mcpWired: boolean;
  presence: string;
}

const SKILL_HINTS: Record<string, Array<AgentCard['skills'][0]>> = {
  'claude-code': [
    {
      id: 'code',
      name: 'Software engineering',
      description: 'Edit, test, and reason about codebases in the terminal',
      tags: ['code', 'cli'],
    },
  ],
  cursor: [
    {
      id: 'ide',
      name: 'IDE pair programming',
      description: 'Edit projects inside Cursor with MCP tools',
      tags: ['ide', 'mcp'],
    },
  ],
  codex: [
    {
      id: 'codex',
      name: 'Codex agent',
      description: 'OpenAI Codex CLI coding sessions',
      tags: ['code', 'cli'],
    },
  ],
  gemini: [
    {
      id: 'gemini',
      name: 'Gemini CLI',
      description: 'Google Gemini command-line agent',
      tags: ['cli'],
    },
  ],
  copilot: [
    {
      id: 'copilot',
      name: 'GitHub Copilot',
      description: 'Inline and chat coding assistance',
      tags: ['ide'],
    },
  ],
};

export function buildAgentCard(
  agent: CardAgent,
  hub: { httpUrl: string; wsUrl: string }
): AgentCard {
  const caps = agent.capabilities || [];
  const skills =
    SKILL_HINTS[agent.id] ||
    caps.map((c) => ({
      id: c,
      name: c,
      description: `Reported capability: ${c}`,
      tags: [c],
    }));

  const preferred: AgentCard['preferredTransport'] = agent.mcpWired
    ? 'mcp'
    : agent.wsConnected
      ? 'ws'
      : 'http';

  return {
    name: agent.name,
    description: `${agent.name} on the HuiNet local fabric (${agent.presence})`,
    version: agent.version,
    url: hub.httpUrl,
    protocol: 'huinet-local-a2a',
    preferredTransport: preferred,
    skills:
      skills.length > 0
        ? skills
        : [
            {
              id: 'peer',
              name: 'Fabric peer',
              description: 'Receives and sends messages on the local A2A bus',
              tags: ['a2a'],
            },
          ],
    capabilities: {
      streaming: false,
      pushNotifications: Boolean(agent.wsConnected),
      mailbox: true,
      tasks: true,
    },
    provider: {
      organization: 'HuiNet Local Hub',
      url: hub.httpUrl,
    },
    agentId: agent.id,
    a2aOpen: agent.a2aOpen,
    wsConnected: Boolean(agent.wsConnected),
    mcpWired: agent.mcpWired,
    presence: agent.presence,
  };
}

export function buildHubCard(hub: {
  httpUrl: string;
  wsUrl: string;
  agents: CardAgent[];
}): Record<string, unknown> {
  const open = hub.agents.filter((a) => a.a2aOpen);
  return {
    name: 'HuiNet Local Hub',
    description:
      'Same-machine Agent Fabric — discovery, mailbox, tasks, shared context',
    url: hub.httpUrl,
    documentationUrl: `${hub.httpUrl}/`,
    protocol: 'huinet-local-a2a',
    version: '2.2.0',
    preferredTransport: 'ws',
    additionalInterfaces: [
      { url: hub.wsUrl, transport: 'websocket-jsonrpc' },
      { url: `${hub.httpUrl}/api`, transport: 'http' },
      { url: 'stdio', transport: 'mcp' },
    ],
    skills: [
      {
        id: 'discover',
        name: 'Agent discovery',
        description: 'Scan and list local AI agents',
      },
      {
        id: 'mailbox',
        name: 'Mailbox',
        description: 'Durable per-agent inbox for MCP clients',
      },
      {
        id: 'tasks',
        name: 'Fabric tasks',
        description: 'Lightweight A2A task lifecycle on this machine',
      },
      {
        id: 'context',
        name: 'Shared context',
        description: 'Import, search, pin, and migrate local memory',
      },
    ],
    peers: open.map((a) => ({
      id: a.id,
      name: a.name,
      card: `${hub.httpUrl}/api/agents/${encodeURIComponent(a.id)}/card`,
    })),
  };
}
