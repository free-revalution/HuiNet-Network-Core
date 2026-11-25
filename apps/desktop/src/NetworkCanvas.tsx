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

type Props = {
  agents: Agent[];
  selectedId: string | null;
  messages: BusMessage[];
  tokenTotals: Record<string, number>;
  tokenSum: number;
  memoryCount: number;
  openCount: number;
  onSelect: (id: string) => void;
  onToggle: (agent: Agent, open: boolean) => void;
};

type Pos = { x: number; y: number };

function StoryRing({ id }: { id: string }) {
  return (
    <svg className="story-ring" aria-hidden viewBox="0 0 100 100">
      <defs>
        <linearGradient id={`story-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f58529" />
          <stop offset="35%" stopColor="#dd2a7b" />
          <stop offset="70%" stopColor="#8134af" />
          <stop offset="100%" stopColor="#515bd4" />
        </linearGradient>
      </defs>
      <circle
        className="story-stroke"
        cx="50"
        cy="50"
        r="47"
        pathLength={100}
        fill="none"
        stroke={`url(#story-grad-${id})`}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeDasharray="22 78"
      />
    </svg>
  );
}

const VW = 1200;
const VH = 720;
/** Hub diameter in viewBox units — keep in sync with .hub-chip width calc(100% * 168 / 1200) */
const HUB_DIAM = 168;
const HUB_R_DEFAULT = HUB_DIAM / 2;
const POS_KEY = 'huinet.fabric.positions.v1';

function shortName(name: string): string {
  return name
    .replace(/\s+(CLI|Code|Desktop)$/i, '')
    .replace(/^OpenAI\s+/i, '')
    .replace(/^GitHub\s+/i, '')
    .trim();
}

function defaultPositions(agents: Agent[]): Record<string, Pos> {
  const cx = VW / 2;
  const cy = VH / 2;
  const r = 220;
  const n = Math.max(agents.length, 1);
  const out: Record<string, Pos> = {};
  agents.forEach((a, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    out[a.id] = {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * (r * 0.88),
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

/** Start at hub gray border (not center), end at agent. */
function edgeFromHubBorder(
  hcx: number,
  hcy: number,
  x2: number,
  y2: number,
  hubR: number,
  bend: number
): string {
  const dx = x2 - hcx;
  const dy = y2 - hcy;
  const len = Math.hypot(dx, dy) || 1;
  const x1 = hcx + (dx / len) * hubR;
  const y1 = hcy + (dy / len) * hubR;
  return edgePath(x1, y1, x2, y2, bend);
}

function strokeForTokens(tokens: number, max: number): number {
  // ViewBox stroke widths — clear thin vs thick (no non-scaling, scales with graph)
  if (tokens <= 0 || max <= 0) return 2;
  const t = Math.pow(Math.min(1, tokens / max), 0.55);
  return 2.5 + t * 14;
}

function tokensFromMessages(messages: BusMessage[]): Record<string, number> {
  const map: Record<string, number> = {};
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
    const bump = (id: string) => {
      if (!id || id === '*' || id === 'ui' || id === 'hub') return;
      map[id] = (map[id] || 0) + raw;
    };
    bump(m.from);
    bump(m.to);
  }
  return map;
}

export function NetworkCanvas({
  agents,
  selectedId,
  messages,
  tokenTotals,
  tokenSum,
  memoryCount,
  openCount,
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
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const hubChipRef = useRef<HTMLButtonElement>(null);
  const [hubR, setHubR] = useState(HUB_R_DEFAULT);

  // Merge new agents into positions without wiping user layout
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

  // Merge API totals + message-derived so edge width always tracks traffic
  const edgeTokenMap = useMemo(() => {
    const map: Record<string, number> = { ...tokenTotals };
    const fromMsgs = tokensFromMessages(messages);
    for (const [id, n] of Object.entries(fromMsgs)) {
      map[id] = Math.max(map[id] || 0, n);
    }
    return map;
  }, [messages, tokenTotals]);

  const maxTokens = useMemo(() => {
    const vals = Object.values(edgeTokenMap).filter((n) => n > 0);
    if (!vals.length) return 1;
    return Math.max(...vals);
  }, [edgeTokenMap]);

  // Measure hub radius in viewBox units so edges meet the gray border
  useEffect(() => {
    const stage = stageBoxRef.current;
    const hub = hubChipRef.current;
    if (!stage || !hub) return;
    const measure = () => {
      const sr = stage.getBoundingClientRect();
      const hr = hub.getBoundingClientRect();
      if (sr.width < 1) return;
      const r = (hr.width / 2) * (VW / sr.width);
      if (r > 8) setHubR(r);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(hub);
    return () => ro.disconnect();
  }, [agents.length, openCount]);

  const activeIds = useMemo(() => {
    const now = Date.now();
    const set = new Set<string>();
    for (const m of messages) {
      if (now - m.timestamp > 20_000) continue;
      if (m.from && m.from !== 'ui' && m.from !== 'hub' && m.from !== '*') {
        set.add(m.from);
      }
      if (m.to && m.to !== '*' && m.to !== 'hub' && m.to !== 'ui') set.add(m.to);
    }
    for (const a of agents) {
      if (a.presence === 'running' || a.presence === 'connected') set.add(a.id);
    }
    return set;
  }, [messages, agents]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const el = stageRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const sx = (clientX - rect.left - pan.x) / zoom;
      const sy = (clientY - rect.top - pan.y) / zoom;
      // stage uses aspect box; map to viewBox
      const x = (sx / rect.width) * VW;
      const y = (sy / rect.height) * VH;
      return { x, y };
    },
    [pan.x, pan.y, zoom]
  );

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault();

    // macOS trackpad pinch → wheel + ctrlKey; two-finger scroll → pan
    const isPinch = e.ctrlKey;
    const pixelScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 32 : 1;
    const dx = e.deltaX * pixelScale;
    const dy = e.deltaY * pixelScale;

    if (isPinch) {
      // Pinch zoom: very soft (trackpad sends many tiny pixel events)
      const clamped = Math.max(-12, Math.min(12, dy));
      const factor = Math.exp(-clamped * 0.012);
      setZoom((z) => Math.min(2.2, Math.max(0.55, z * factor)));
      return;
    }

    // Two-finger scroll pans the fabric (natural trackpad feel)
    // Mouse wheel (chunky delta, little/no deltaX) still zooms gently
    const looksLikeMouseWheel =
      Math.abs(dx) < 0.5 && Math.abs(dy) >= 20 && e.deltaMode !== 0;

    if (looksLikeMouseWheel) {
      const step = Math.sign(dy) * Math.min(1, Math.abs(dy) / 120);
      const factor = Math.exp(-step * 0.06);
      setZoom((z) => Math.min(2.2, Math.max(0.55, z * factor)));
      return;
    }

    setPan((p) => ({
      x: p.x - dx,
      y: p.y - dy,
    }));
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

  return (
    <div className="fabric">
      <div className="fabric-hint">
        双指滑动平移 · 捏合缩放 · 拖节点摆位 · 双击接入/离开
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

          <div className="fabric-stage" ref={stageBoxRef}>
            <svg
              className="fabric-svg"
              viewBox={`0 0 ${VW} ${VH}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="edgeLive" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(0,0,0,0.05)" />
                  <stop offset="50%" stopColor="rgba(0,0,0,0.55)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.05)" />
                </linearGradient>
                <linearGradient id="edgeDim" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(0,0,0,0.02)" />
                  <stop offset="50%" stopColor="rgba(0,0,0,0.16)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.02)" />
                </linearGradient>
              </defs>

              <circle className="orbit o1" cx={cx} cy={cy} r={268} />
              <circle className="orbit o2" cx={cx} cy={cy} r={210} />

              {agents.map((agent, i) => {
                const pos = positions[agent.id] || { x: cx, y: cy };
                const open = Boolean(agent.a2aOpen);
                const tokens = edgeTokenMap[agent.id] || 0;
                const width = open
                  ? strokeForTokens(tokens, maxTokens)
                  : 1.15;
                const d = edgeFromHubBorder(
                  cx,
                  cy,
                  pos.x,
                  pos.y,
                  hubR,
                  i % 2 === 0 ? 0.1 : -0.08
                );
                return (
                  <g key={`e-${agent.id}`}>
                    <path
                      d={d}
                      className={`edge ${open ? 'open' : 'idle'} ${tokens > 0 ? 'hot' : ''}`}
                      fill="none"
                      strokeWidth={width}
                      stroke={open ? (tokens > 0 ? '#1a1a1a' : '#6a6a6a') : '#b0b0b0'}
                      strokeLinecap="round"
                      opacity={open ? (tokens > 0 ? 0.9 : 0.5) : 0.32}
                    />
                    {open && tokens > 0 && (
                      <circle
                        r={Math.min(5.5, 2.4 + width * 0.2)}
                        className="packet"
                      >
                        <animateMotion
                          dur={`${Math.max(1.2, 4.0 - width * 0.22)}s`}
                          repeatCount="indefinite"
                          path={d}
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

            </svg>

            <div className="fabric-nodes">
              {(() => {
                const net = agents.length ? openCount / agents.length : 0;
                const tok = Math.min(1, tokenSum / 4000);
                const mem = Math.min(1, memoryCount / 200);
                const liveN = messages.filter(
                  (m) => Date.now() - m.timestamp < 20_000
                ).length;
                const working = openCount > 0 || liveN > 0;
                const loadPct = Math.round(
                  Math.min(
                    1,
                    net * 0.35 +
                      tok * 0.35 +
                      mem * 0.15 +
                      Math.min(1, liveN / 8) * 0.15
                  ) * 100
                );
                const tokLabel =
                  tokenSum >= 1000
                    ? `${(tokenSum / 1000).toFixed(1)}k`
                    : String(tokenSum);
                return (
                  <button
                    type="button"
                    ref={hubChipRef}
                    className={`hub-chip ${working ? 'live' : ''}`}
                    style={{
                      left: `${(cx / VW) * 100}%`,
                      top: `${(cy / VH) * 100}%`,
                    }}
                    onClick={() => onSelect('__hub__')}
                    title="Hub"
                  >
                    {working && <StoryRing id="hub" />}
                    <span className="hub-chip-kicker">HUB</span>
                    <span className="hub-chip-load">{loadPct}%</span>
                    <span className="hub-chip-stats">
                      <span>{openCount}/{agents.length} net</span>
                      <span>{tokLabel} tok</span>
                      <span>{memoryCount} mem</span>
                    </span>
                  </button>
                );
              })()}

              {agents.map((agent) => {
                const pos = positions[agent.id] || { x: cx, y: cy };
                const open = Boolean(agent.a2aOpen);
                const selected = selectedId === agent.id;
                const active = activeIds.has(agent.id);
                const tokens = tokenTotals[agent.id] || 0;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className={[
                      'node-chip',
                      open ? 'open' : '',
                      selected ? 'selected' : '',
                      active ? 'live' : '',
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
                    {active && (
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
                          className="story-stroke"
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
                    <span className={`node-pulse ${open ? 'on' : ''}`} />
                    <span className="node-name">{shortName(agent.name)}</span>
                    {tokens > 0 && (
                      <span className="node-tok">{tokens.toLocaleString()}t</span>
                    )}
                    {agent.mcpWired && <span className="node-tag">mcp</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!agents.length && (
        <div className="fabric-empty">扫描本机后，节点会落入这张织物</div>
      )}
    </div>
  );
}
