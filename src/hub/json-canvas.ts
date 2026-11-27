/**
 * Export fabric topology as JSON Canvas (https://jsoncanvas.org/)
 * so Obsidian / other tools can open the same peer graph.
 */

import type { BusMessage } from './bus';

export type CanvasAgent = {
  id: string;
  name: string;
  kind?: string;
  parentId?: string;
  title?: string;
  project?: string;
  a2aOpen?: boolean;
  presence?: string;
};

export type JsonCanvas = {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
};

const VW = 1200;
const VH = 720;

function layout(agents: CanvasAgent[]): Record<string, { x: number; y: number }> {
  const cx = VW / 2;
  const cy = VH / 2;
  const r = 260;
  const n = Math.max(agents.length, 1);
  const out: Record<string, { x: number; y: number }> = {};
  agents.forEach((a, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    out[a.id] = {
      x: cx + Math.cos(angle) * r - 140,
      y: cy + Math.sin(angle) * (r * 0.86) - 40,
    };
  });
  return out;
}

function peerKeys(
  messages: BusMessage[],
  agentIds: Set<string>
): Map<string, number> {
  const map = new Map<string, number>();
  const skip = new Set(['ui', 'hub', 'hub-net', 'mcp-client', 'cli', '*']);
  for (const m of messages) {
    const a = m.from;
    const b = m.to;
    if (!a || !b || skip.has(a) || skip.has(b) || a === b) continue;
    if (!agentIds.has(a) || !agentIds.has(b)) continue;
    const key = [a, b].sort().join('::');
    const t =
      typeof m.tokens === 'number' && m.tokens > 0
        ? m.tokens
        : Math.max(1, Math.ceil(JSON.stringify(m.payload ?? '').length / 4));
    map.set(key, (map.get(key) || 0) + t);
  }
  return map;
}

export function buildFabricCanvas(input: {
  agents: CanvasAgent[];
  messages?: BusMessage[];
  generatedAt?: number;
}): JsonCanvas & {
  meta: {
    format: 'jsoncanvas';
    version: '1.0';
    generatedAt: number;
    source: 'huinet';
  };
  markdown: string;
} {
  const agents = input.agents;
  const positions = layout(agents);
  const ids = new Set(agents.map((a) => a.id));
  const links = peerKeys(input.messages || [], ids);

  const nodes = agents.map((a) => {
    const pos = positions[a.id] || { x: 0, y: 0 };
    const label =
      a.kind === 'session' && a.title
        ? `${a.parentId || 'chat'}: ${a.title}`
        : a.name;
    const color = a.a2aOpen ? '4' : '1';
    return {
      id: a.id,
      type: 'text',
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      width: 280,
      height: 80,
      color,
      text: [
        `## ${label}`,
        a.project ? `project: \`${a.project}\`` : '',
        a.presence ? `presence: ${a.presence}` : '',
        a.a2aOpen ? 'A2A: open' : 'A2A: closed',
        '',
        `id: \`${a.id}\``,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  });

  const edges = [...links.entries()].map(([key, tokens], i) => {
    const [from, to] = key.split('::');
    return {
      id: `e${i}-${from.slice(0, 6)}-${to.slice(0, 6)}`,
      fromNode: from,
      toNode: to,
      label: `${tokens}t`,
    };
  });

  const generatedAt = input.generatedAt ?? Date.now();
  const md = [
    '# HuiNet Fabric Canvas',
    '',
    `_Exported ${new Date(generatedAt).toISOString()}_`,
    '',
    `- Nodes: ${nodes.length}`,
    `- Edges: ${edges.length} (peer traffic only)`,
    '',
    'Open the accompanying `.canvas` JSON in Obsidian Canvas or any JSON Canvas tool.',
  ].join('\n');

  return {
    meta: {
      format: 'jsoncanvas',
      version: '1.0',
      generatedAt,
      source: 'huinet',
    },
    nodes,
    edges,
    markdown: md,
  };
}
