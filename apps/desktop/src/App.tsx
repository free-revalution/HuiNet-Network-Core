import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  type Agent,
  type BusMessage,
  type DoctorResult,
  type HubStatus,
  type Memory,
  API_BASE,
} from './api';
import { NetworkCanvas } from './NetworkCanvas';

type Layer = 'fabric' | 'memory' | 'traffic' | 'system';

function presenceLabel(p: string): string {
  switch (p) {
    case 'connected':
      return '已连接';
    case 'running':
      return '运行中';
    case 'installed':
      return '已安装';
    default:
      return p;
  }
}

export default function App() {
  const [layer, setLayer] = useState<Layer>('fabric');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [messages, setMessages] = useState<BusMessage[]>([]);
  const [tokenTotals, setTokenTotals] = useState<Record<string, number>>({});
  const [tokenSum, setTokenSum] = useState(0);
  const seenMsgIds = useRef<Set<string>>(new Set());
  const [doctor, setDoctor] = useState<DoctorResult | null>(null);
  const [mcpSnippet, setMcpSnippet] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busTo, setBusTo] = useState('*');
  const [busText, setBusText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [memTitle, setMemTitle] = useState('');
  const [memBody, setMemBody] = useState('');
  const [memKind, setMemKind] = useState('fact');

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [s, a, bus] = await Promise.all([
        api.status(),
        api.agents(),
        api.busMessages().catch(
          (): import('./api').BusSnapshot => ({
            messages: [],
            tokenTotals: {},
            tokenSum: 0,
          })
        ),
      ]);
      setStatus(s);
      setAgents(a.agents);
      setMessages(bus.messages);
      // Accumulate per-message so edge width stays stable as the bus window rotates
      setTokenTotals((prev) => {
        const next = { ...prev };
        let added = 0;
        for (const m of bus.messages) {
          if (seenMsgIds.current.has(m.id)) continue;
          seenMsgIds.current.add(m.id);
          const t =
            typeof m.tokens === 'number' && m.tokens > 0
              ? m.tokens
              : Math.max(
                  1,
                  Math.ceil(JSON.stringify(m.payload ?? '').length / 4)
                );
          added += t;
          const bump = (id: string) => {
            if (!id || id === '*' || id === 'ui' || id === 'hub') return;
            next[id] = (next[id] || 0) + t;
          };
          bump(m.from);
          bump(m.to);
        }
        if (seenMsgIds.current.size > 2000) {
          seenMsgIds.current = new Set(
            [...seenMsgIds.current].slice(-1000)
          );
        }
        if (added > 0) {
          setTokenSum((s) => s + added);
        } else if ((bus.tokenSum || 0) > 0) {
          setTokenSum((s) => Math.max(s, bus.tokenSum || 0));
        }
        return next;
      });
      setOffline(false);
      if (!selectedId && a.agents[0]) setSelectedId(a.agents[0].id);
    } catch (err) {
      setOffline(true);
      setStatus(null);
      setError((err as Error).message);
    }
  }, [selectedId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (offline) return;
    if (layer === 'memory') {
      void api
        .memories(query || undefined)
        .then((r) => setMemories(r.memories))
        .catch((e) => setError((e as Error).message));
    }
    if (layer === 'system') {
      void Promise.all([
        api.mcpConfig().catch(() => null),
        api.doctor().catch(() => null),
      ]).then(([cfg, doc]) => {
        if (cfg) setMcpSnippet(JSON.stringify(cfg, null, 2));
        if (doc) setDoctor(doc);
      });
    }
  }, [layer, query, offline]);

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) || null,
    [agents, selectedId]
  );
  const openCount = agents.filter((a) => a.a2aOpen).length;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function onScan() {
    setBusy(true);
    try {
      const snap = await api.scan();
      setAgents(snap.agents);
      showToast(`发现 ${snap.agents.length} 节点`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onConnectAll() {
    setBusy(true);
    try {
      const r = await api.connectAll();
      setAgents(r.agents);
      showToast(`网络已展开 · ${r.opened.length}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnectAll() {
    setBusy(true);
    try {
      const r = await api.disconnectAll();
      setAgents(r.agents);
      showToast(`已收起 ${r.closed.length}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onToggleA2a(agent: Agent, open: boolean) {
    setToggling(agent.id);
    try {
      const r = await api.setA2aOpen(agent.id, open);
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, ...r.agent } : a))
      );
      showToast(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setToggling(null);
    }
  }

  async function onImport(from: string) {
    setBusy(true);
    try {
      const r = await api.importSessions(from);
      showToast(`导入 ${r.imported}`);
      const m = await api.memories();
      setMemories(m.memories);
      setLayer('memory');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onMigrate() {
    setBusy(true);
    try {
      const pkg = await api.migrate();
      await navigator.clipboard.writeText(pkg.markdown);
      showToast(`已复制迁移包`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onUpsertMemory() {
    if (!memTitle.trim() || !memBody.trim()) {
      showToast('需要标题和内容');
      return;
    }
    setBusy(true);
    try {
      await api.upsert({
        kind: memKind,
        title: memTitle.trim(),
        body: memBody.trim(),
        scope: 'global',
        tags: ['ui'],
      });
      setMemTitle('');
      setMemBody('');
      const m = await api.memories(query || undefined);
      setMemories(m.memories);
      showToast('已写入记忆层');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteMemory(id: string) {
    setBusy(true);
    try {
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!busText.trim()) return;
    setBusy(true);
    try {
      await api.send(busTo, busText.trim());
      setBusText('');
      const r = await api.busMessages();
      setMessages(r.messages);
      setLayer('fabric');
      showToast('已进入网络');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onRunDoctor() {
    setBusy(true);
    try {
      const doc = await api.doctor();
      setDoctor(doc);
      showToast(doc.ok ? '网络健康' : '有待处理项');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSelect(id: string) {
    if (id === '__hub__') {
      setLayer('system');
      return;
    }
    setSelectedId(id);
    setLayer('fabric');
  }

  return (
    <div className="app">
      <div className="ambient" aria-hidden>
        <span className="wash w1" />
        <span className="wash w2" />
        <span className="wash w3" />
      </div>

      {/* Native traffic lights sit here via Electron hiddenInset */}
      <header className="titlebar">
        <div className="titlebar-spacer" />
        <div className="titlebar-center">
          <span className="title-mark" />
          <span className="title-text">HuiNet</span>
          <span className="title-sep" />
          <span className={`title-live ${offline ? 'off' : ''}`}>
            {offline ? 'offline' : `fabric ${openCount}/${agents.length}`}
          </span>
        </div>
        <div className="titlebar-actions">
          <nav className="seg" aria-label="layers">
            {(
              [
                ['fabric', '网络'],
                ['memory', '记忆'],
                ['traffic', 'Token'],
                ['system', '系统'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={`seg-btn ${layer === id ? 'on' : ''}`}
                onClick={() => setLayer(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          {!offline && (
            <>
              <button
                className="btn ghost"
                disabled={busy || !agents.length}
                onClick={() => void onConnectAll()}
              >
                展开
              </button>
              <button
                className="btn ghost"
                disabled={busy || openCount === 0}
                onClick={() => void onDisconnectAll()}
              >
                收起
              </button>
            </>
          )}
          <button className="btn" disabled={busy || offline} onClick={() => void onScan()}>
            扫描
          </button>
        </div>
      </header>

      {toast && <div className="toast glass">{toast}</div>}
      {error && (
        <div className="banner glass">
          <pre>{error}</pre>
          <button className="btn ghost" onClick={() => setError(null)}>
            关闭
          </button>
        </div>
      )}

      {offline ? (
        <section className="offline glass">
          <h1>等待本地 Hub</h1>
          <p>桌面端会自动拉起网络核心</p>
          <button className="btn" onClick={() => void refresh()}>
            重新连接
          </button>
        </section>
      ) : (
        <main className="stage">
          <section className="stage-main glass">
            {layer === 'fabric' && (
              <>
                <NetworkCanvas
                  agents={agents}
                  selectedId={selectedId}
                  messages={messages}
                  tokenTotals={tokenTotals}
                  tokenSum={tokenSum}
                  memoryCount={status?.memoryCount ?? 0}
                  openCount={openCount}
                  onSelect={handleSelect}
                  onToggle={(a, open) => void onToggleA2a(a, open)}
                />
                <div className="roster">
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      className={`roster-row ${selectedId === a.id ? 'on' : ''}`}
                      onClick={() => handleSelect(a.id)}
                    >
                      <span className={`dot ${a.a2aOpen ? 'open' : a.presence}`} />
                      <span className="roster-name">{a.name}</span>
                      <span className="roster-meta">
                        {a.a2aOpen ? 'on fabric' : presenceLabel(a.presence)}
                      </span>
                      <span className="roster-tok">
                        {(tokenTotals[a.id] || 0).toLocaleString()}t
                      </span>
                      <label className="switch" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={Boolean(a.a2aOpen)}
                          disabled={toggling === a.id || busy}
                          onChange={(e) => void onToggleA2a(a, e.target.checked)}
                        />
                        <span className="slider" />
                      </label>
                    </button>
                  ))}
                </div>
              </>
            )}

            {layer === 'memory' && (
              <div className="panel">
                <div className="compose">
                  <div className="row">
                    <select
                      className="field"
                      value={memKind}
                      onChange={(e) => setMemKind(e.target.value)}
                    >
                      <option value="fact">fact</option>
                      <option value="decision">decision</option>
                      <option value="preference">preference</option>
                      <option value="artifact">artifact</option>
                      <option value="thread_summary">thread_summary</option>
                    </select>
                    <input
                      className="field grow"
                      placeholder="标题"
                      value={memTitle}
                      onChange={(e) => setMemTitle(e.target.value)}
                    />
                  </div>
                  <textarea
                    className="field"
                    rows={3}
                    placeholder="写入共享记忆层…"
                    value={memBody}
                    onChange={(e) => setMemBody(e.target.value)}
                  />
                  <div className="row wrap">
                    <button className="btn" disabled={busy} onClick={() => void onUpsertMemory()}>
                      写入
                    </button>
                    <button className="btn ghost" disabled={busy} onClick={() => void onImport('claude')}>
                      Claude
                    </button>
                    <button className="btn ghost" disabled={busy} onClick={() => void onImport('codex')}>
                      Codex
                    </button>
                    <button className="btn ghost" disabled={busy} onClick={() => void onImport('cursor')}>
                      Cursor
                    </button>
                    <button className="btn ghost" disabled={busy} onClick={() => void onMigrate()}>
                      导出
                    </button>
                  </div>
                </div>
                <input
                  className="field search"
                  placeholder="搜索…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="list">
                  {memories.map((m) => (
                    <article key={m.id} className="card">
                      <div className="card-head">
                        <strong>{m.title}</strong>
                        <span className="tag">{m.kind}</span>
                      </div>
                      <p>{m.body}</p>
                      <div className="card-foot">
                        <span className="muted">
                          {new Date(m.updatedAt).toLocaleString()}
                        </span>
                        <button
                          className="btn ghost tiny"
                          onClick={() => void onDeleteMemory(m.id)}
                        >
                          删除
                        </button>
                      </div>
                    </article>
                  ))}
                  {!memories.length && <div className="empty">记忆层为空</div>}
                </div>
              </div>
            )}

            {layer === 'traffic' && (
              <div className="panel">
                <div className="card">
                  <h2>Token 流量</h2>
                  <p className="muted">
                    总线消息按内容估算 token（约 4 字 ≈ 1 token）；Agent 上报真实用量后会覆盖估算。
                    连线粗细随该节点累计 token 变化。合计{' '}
                    <strong className="mono">{tokenSum.toLocaleString()}</strong> t
                  </p>
                </div>
                <div className="row">
                  <select
                    className="field"
                    value={busTo}
                    onChange={(e) => setBusTo(e.target.value)}
                  >
                    <option value="*">广播 *</option>
                    {agents
                      .filter((a) => a.a2aOpen)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                  <input
                    className="field grow"
                    placeholder="向网络发送…"
                    value={busText}
                    onChange={(e) => setBusText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void onSend();
                    }}
                  />
                  <button className="btn" disabled={busy} onClick={() => void onSend()}>
                    发送
                  </button>
                </div>
                <div className="traffic">
                  {messages.map((m) => (
                    <div key={m.id} className="traffic-row">
                      <span className="mono muted">
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="mono muted">{(m.tokens ?? 0)}t</span>
                      <span className="mono">
                        {m.from} → {m.to}
                      </span>
                      <span>
                        {typeof m.payload === 'object' &&
                        m.payload &&
                        'text' in (m.payload as object)
                          ? String((m.payload as { text: string }).text)
                          : JSON.stringify(m.payload)}
                      </span>
                    </div>
                  ))}
                  {!messages.length && <div className="empty">暂无 token 流量</div>}
                </div>
              </div>
            )}

            {layer === 'system' && (
              <div className="panel system">
                <article className="card">
                  <h2>Hub</h2>
                  <dl className="kv">
                    <div>
                      <dt>HTTP</dt>
                      <dd className="mono">{status?.httpUrl || API_BASE}</dd>
                    </div>
                    <div>
                      <dt>WS</dt>
                      <dd className="mono">{status?.wsUrl || '—'}</dd>
                    </div>
                    <div>
                      <dt>PID</dt>
                      <dd>{status?.pid ?? '—'}</dd>
                    </div>
                  </dl>
                </article>
                <article className="card">
                  <div className="card-head">
                    <h2>诊断</h2>
                    <button className="btn ghost" disabled={busy} onClick={() => void onRunDoctor()}>
                      检查
                    </button>
                  </div>
                  {doctor ? (
                    <ul className="checks">
                      {doctor.checks.map((c) => (
                        <li key={c.name}>
                          <span className={c.pass ? 'ok' : 'bad'}>{c.pass ? '✓' : '✗'}</span>
                          {c.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">运行检查</p>
                  )}
                </article>
                <article className="card">
                  <h2>MCP</h2>
                  <pre className="code">{mcpSnippet || '—'}</pre>
                </article>
                <article className="card">
                  <h2>关闭应用</h2>
                  <p className="muted">
                    点窗口红绿灯关闭只会隐藏到菜单栏托盘。彻底退出：菜单栏图标 →「退出」，或{' '}
                    <code>⌘Q</code>，或终端执行 <code>huinet app --quit</code>
                    （可选再 <code>huinet stop</code> 停 Hub）。
                  </p>
                </article>
              </div>
            )}
          </section>

          <aside className="inspector glass">
            {selected ? (
              <>
                <div className="insp-kicker">节点</div>
                <h2>{selected.name}</h2>
                <p className="mono muted">{selected.id}</p>
                <span className={`pill ${selected.a2aOpen ? 'open' : ''}`}>
                  {selected.a2aOpen ? 'on fabric' : presenceLabel(selected.presence)}
                </span>
                <dl className="kv">
                  <div>
                    <dt>路径</dt>
                    <dd className="mono">{selected.binaryPath || '—'}</dd>
                  </div>
                  <div>
                    <dt>会话</dt>
                    <dd className="mono">{selected.sessionDir || '—'}</dd>
                  </div>
                  <div>
                    <dt>MCP</dt>
                    <dd>
                      {selected.mcpSupported
                        ? selected.mcpWired
                          ? '已接入'
                          : '可接入'
                        : '无适配'}
                    </dd>
                  </div>
                </dl>
                <div className="row wrap">
                  <button
                    className="btn"
                    disabled={busy || toggling === selected.id}
                    onClick={() => void onToggleA2a(selected, !selected.a2aOpen)}
                  >
                    {selected.a2aOpen ? '离开网络' : '接入网络'}
                  </button>
                  {['claude-code', 'codex', 'cursor'].includes(selected.id) && (
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() =>
                        void onImport(
                          selected.id === 'claude-code' ? 'claude' : selected.id
                        )
                      }
                    >
                      导入会话
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="muted">选择一个节点</p>
            )}
          </aside>
        </main>
      )}
    </div>
  );
}
