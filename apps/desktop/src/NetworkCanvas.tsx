import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { Agent, BusMessage } from './api';
import type { TFunction } from './i18n';

type Props = {
  agents: Agent[];
  selectedId: string | null;
  messages: BusMessage[];
  tokenTotals: Record<string, number>;
  tokenSum: number;
  memoryCount: number;
  openCount: number;
  t: TFunction;
  onSelect: (id: string) => void;
  onToggle: (agent: Agent, open: boolean) => void;
};

type Pos = { x: number; y: number };

type PeerLink = {
  a: string;
  b: string;
  tokens: number;
  recent: boolean;
};

const VW = 1200;
const VH = 720;
const POS_KEY = 'huinet.fabric.positions.v2';
const SKIP = new Set(['ui', 'hub', 'hub-net', 'mcp-client', 'cli', 'anonymous', '*']);

function shortName(agent: Agent): string {
  if (agent.kind === 'session' && agent.title) {
    const t = agent.title.length > 22 ? `${agent.title.slice(0, 21)}…` : agent.title;
    const host =
      agent.parentId === 'claude-code'
        ? 'Claude'
        : agent.parentId === 'cursor'
          ? 'Cursor'
          : agent.parentId === 'codex'
            ? 'Codex'
            : agent.parentId || 'Chat';
    return `${host} · ${t}`;
  }
  return agent.name
    .replace(/\s+(CLI|Code|Desktop)$/i, '')
    .replace(/^OpenAI\s+/i, '')
    .replace(/^GitHub\s+/i, '')
    .trim();
}

function defaultPositions(agents: Agent[]): Record<string, Pos> {
  const cx = VW / 2;
  const cy = VH / 2;
  const r = 240;
  const n = Math.max(agents.length, 1);
  const out: Record<string, Pos> = {};
  agents.forEach((a, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    out[a.id] = {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * (r * 0.86),
    };
  });
  return out;
}

function loadPositions(agents: Agent[]): Record<string, Pos> {
  const base = defaultPositions(agents);
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Record<string, Pos>;
    for (const a of agents) {
      if (saved[a.id]) base[a.id] = saved[a.id];
    }
  } catch {
    // ignore
  }
  return base;
}

function edgePath(x1: number, y1: number, x2: number, y2: number, bend: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return `M ${x1} ${y1} Q ${mx - dy * bend} ${my + dx * bend} ${x2} ${y2}`;
}

function strokeForTokens(tokens: number, max: number): number {
  if (tokens <= 0 || max <= 0) return 2.4;
  const t = Math.pow(Math.min(1, tokens / max), 0.55);
  return 2.4 + t * 12;
}

/** Peer links from real bus traffic only — no hub star. */
function buildPeerLinks(
  messages: BusMessage[],
  agentIds: Set<string>
): PeerLink[] {
  const map = new Map<string, PeerLink>();
  const now = Date.now();

  const bump = (a: string, b: string, tokens: number, ts: number) => {
    if (!agentIds.has(a) || !agentIds.has(b) || a === b) return;
    if (SKIP.has(a) || SKIP.has(b)) return;
    const [x, y] = a < b ? [a, b] : [b, a];
    const key = `${x}|${y}`;
    const prev = map.get(key);
    const recent = now - ts < 20_000;
    if (!prev) {
      map.set(key, { a: x, b: y, tokens, recent });
    } else {
      prev.tokens += tokens;
      prev.recent = prev.recent || recent;
    }
  };

  for (const m of messages) {
    const raw =
      typeof m.tokens === 'number' && m.tokens > 0
        ? m.tokens
        : Math.max(
            1,
            Math.ceil(
              (typeof m.payload === 'string'
                ? m.payload
                : JSON.stringify(m.payload ?? '')
              ).length / 4
            )
          );
    if (m.to === '*') {
      for (const id of agentIds) {
        if (id !== m.from) bump(m.from, id, raw, m.timestamp);
      }
    } else {
      bump(m.from, m.to, raw, m.timestamp);
    }
  }

  return Array.from(map.values());
}

export function NetworkCanvas({
  agents,
  selectedId,
  messages,
  tokenTotals,
  tokenSum,
  memoryCount,
  openCount,
  t,
  onSelect,
  onToggle,
}: Props) {
  const cx = VW / 2;
  const cy = VH / 2;

  const [positions, setPositions] = useState<Record<string, Pos>>(() =>
    loadPositions(agents)
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);

  const dragRef = useRef<{
    id: string;
    ox: number;
    oy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null
  );
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      const fresh = defaultPositions(agents);
      let changed = false;
      for (const a of agents) {
        if (!next[a.id]) {
          next[a.id] = fresh[a.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [agents]);

  useEffect(() => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(positions));
    } catch {
      // ignore
    }
  }, [positions]);

  const agentIds = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);

  const peerLinks = useMemo(
    () => buildPeerLinks(messages, agentIds),
    [messages, agentIds]
  );

  const maxLinkTokens = useMemo(() => {
    const vals = peerLinks.map((l) => l.tokens).filter((n) => n > 0);
    return vals.length ? Math.max(...vals) : 1;
  }, [peerLinks]);

  /** Live = process running / WS registered / recent peer traffic — NOT mere a2aOpen */
  const liveIds = useMemo(() => {
    const now = Date.now();
    const set = new Set<string>();
    for (const a of agents) {
      if (a.presence === 'running' || a.wsConnected) set.add(a.id);
    }
    for (const m of messages) {
      if (now - m.timestamp > 12_000) continue;
      if (m.from && agentIds.has(m.from)) set.add(m.from);
      if (m.to && agentIds.has(m.to)) set.add(m.to);
    }
    return set;
  }, [messages, agents, agentIds]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const el = stageRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const sx = (clientX - rect.left - pan.x) / zoom;
      const sy = (clientY - rect.top - pan.y) / zoom;
      const x = (sx / rect.width) * VW;
      const y = (sy / rect.height) * VH;
      return { x, y };
    },
    [pan.x, pan.y, zoom]
  );

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    const isPinch = e.ctrlKey;
    const pixelScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 32 : 1;
    const dx = e.deltaX * pixelScale;
    const dy = e.deltaY * pixelScale;

    if (isPinch) {
      const clamped = Math.max(-12, Math.min(12, dy));
      const factor = Math.exp(-clamped * 0.012);
      setZoom((z) => Math.min(2.2, Math.max(0.55, z * factor)));
      return;
    }

    const looksLikeMouseWheel =
      Math.abs(dx) < 0.5 && Math.abs(dy) >= 20 && e.deltaMode !== 0;

    if (looksLikeMouseWheel) {
      const step = Math.sign(dy) * Math.min(1, Math.abs(dy) / 120);
      const factor = Math.exp(-step * 0.06);
      setZoom((z) => Math.min(2.2, Math.max(0.55, z * factor)));
      return;
    }

    setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
  };

  const onStagePointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.node-chip')) return;
    panRef.current = { x: pan.x, y: pan.y, px: e.clientX, py: e.clientY };
    setPanning(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onStagePointerMove = (e: ReactPointerEvent) => {
    if (dragRef.current) {
      const d = dragRef.current;
      const w = clientToWorld(e.clientX, e.clientY);
      const dx = Math.abs(e.clientX - d.startX);
      const dy = Math.abs(e.clientY - d.startY);
      if (dx > 3 || dy > 3) d.moved = true;
      setPositions((prev) => ({
        ...prev,
        [d.id]: {
          x: Math.min(VW - 40, Math.max(40, w.x - d.ox)),
          y: Math.min(VH - 40, Math.max(40, w.y - d.oy)),
        },
      }));
      return;
    }
    if (panRef.current) {
      const p = panRef.current;
      setPan({
        x: p.x + (e.clientX - p.px),
        y: p.y + (e.clientY - p.py),
      });
    }
  };

  const endInteraction = (e: ReactPointerEvent) => {
    if (dragRef.current) {
      const d = dragRef.current;
      if (!d.moved) onSelect(d.id);
      dragRef.current = null;
      setDraggingId(null);
    }
    panRef.current = null;
    setPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onNodePointerDown = (e: ReactPointerEvent, agent: Agent) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = positions[agent.id] || { x: cx, y: cy };
    const w = clientToWorld(e.clientX, e.clientY);
    dragRef.current = {
      id: agent.id,
      ox: w.x - pos.x,
      oy: w.y - pos.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    setDraggingId(agent.id);
    stageRef.current?.setPointerCapture(e.pointerId);
  };

  const tokLabel =
    tokenSum >= 1000 ? `${(tokenSum / 1000).toFixed(1)}k` : String(tokenSum);

  return (
    <div className="fabric">
      <div className="fabric-hint">
        {t('fabric.hint', {
          open: openCount,
          total: agents.length,
          links: peerLinks.length,
          tokens: tokLabel,
          mem: memoryCount,
        })}
      </div>
      <div
        className={`fabric-viewport ${panning ? 'panning' : ''} ${draggingId ? 'dragging' : ''}`}
        ref={stageRef}
        onWheel={onWheel}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
      >
        <div
          className="fabric-world"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <div className="fabric-aura" aria-hidden>
            <span className="blob b1" />
            <span className="blob b2" />
            <span className="blob b3" />
          </div>

          <div className="fabric-stage">
            <svg
              className="fabric-svg"
              viewBox={`0 0 ${VW} ${VH}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {peerLinks.map((link, i) => {
                const pa = positions[link.a] || { x: cx, y: cy };
                const pb = positions[link.b] || { x: cx, y: cy };
                const width = Math.max(
                  2.2,
                  strokeForTokens(link.tokens, maxLinkTokens)
                );
                const d = edgePath(
                  pa.x,
                  pa.y,
                  pb.x,
                  pb.y,
                  i % 2 === 0 ? 0.08 : -0.06
                );
                return (
                  <g key={`${link.a}-${link.b}`}>
                    <path
                      d={d}
                      className={`edge open ${link.recent ? 'hot' : ''}`}
                      fill="none"
                      strokeWidth={width}
                      stroke={link.recent ? '#5b9cff' : '#6a7a90'}
                      strokeLinecap="round"
                      opacity={link.recent ? 0.95 : 0.7}
                    />
                    <circle
                      r={link.recent ? Math.min(5, 2.2 + width * 0.18) : 2}
                      fill="#5b9cff"
                      className="packet"
                    >
                      <animateMotion
                        dur={`${Math.max(1.5, 4.2 - width * 0.2)}s`}
                        repeatCount="indefinite"
                        path={d}
                      />
                    </circle>
                  </g>
                );
              })}
            </svg>

            <div className="fabric-nodes">
              {agents.map((agent) => {
                const pos = positions[agent.id] || { x: cx, y: cy };
                const open = Boolean(agent.a2aOpen);
                const selected = selectedId === agent.id;
                const live = liveIds.has(agent.id);
                const tokens = tokenTotals[agent.id] || 0;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className={[
                      'node-chip',
                      open ? 'open' : '',
                      selected ? 'selected' : '',
                      live ? 'live' : '',
                      draggingId === agent.id ? 'dragging' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      left: `${(pos.x / VW) * 100}%`,
                      top: `${(pos.y / VH) * 100}%`,
                    }}
                    onPointerDown={(e) => onNodePointerDown(e, agent)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onToggle(agent, !open);
                    }}
                  >
                    {live && (
                      <svg
                        className="story-ring"
                        aria-hidden
                        viewBox="0 0 120 40"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient
                            id={`story-grad-${agent.id}`}
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="0%"
                          >
                            <stop offset="0%" stopColor="#f58529" />
                            <stop offset="35%" stopColor="#dd2a7b" />
                            <stop offset="70%" stopColor="#8134af" />
                            <stop offset="100%" stopColor="#515bd4" />
                          </linearGradient>
                        </defs>
                        <rect
                          className="story-stroke fast"
                          x="2"
                          y="2"
                          width="116"
                          height="36"
                          rx="18"
                          ry="18"
                          pathLength={100}
                          fill="none"
                          stroke={`url(#story-grad-${agent.id})`}
                          strokeWidth={2.8}
                          strokeLinecap="round"
                          strokeDasharray="22 78"
                        />
                      </svg>
                    )}
                    <span
                      className={`node-pulse ${live ? 'on' : open ? 'open' : ''}`}
                    />
                    <span className="node-name">{shortName(agent)}</span>
                    {tokens > 0 && (
                      <span className="node-tok">{tokens.toLocaleString()}t</span>
                    )}
                    {agent.mcpWired && <span className="node-tag">mcp</span>}
                    {live && <span className="node-tag live">live</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!agents.length && (
        <div className="fabric-empty">{t('fabric.empty')}</div>
      )}
      {agents.length > 0 && peerLinks.length === 0 && (
        <div className="fabric-empty soft">{t('fabric.emptySoft')}</div>
      )}
    </div>
  );
}
