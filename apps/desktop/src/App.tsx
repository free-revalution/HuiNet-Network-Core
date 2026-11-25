import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type Agent,
  type BusMessage,
  type HubStatus,
  type Memory,
  API_BASE,
} from './api';

type Nav = 'agents' | 'context' | 'bus' | 'settings';

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
  const [nav, setNav] = useState<Nav>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [messages, setMessages] = useState<BusMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [busTo, setBusTo] = useState('*');
  const [busText, setBusText] = useState('');
  const [mcpSnippet, setMcpSnippet] = useState('');

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [s, a] = await Promise.all([api.status(), api.agents()]);
      setStatus(s);
      setAgents(a.agents);
      if (!selectedId && a.agents[0]) setSelectedId(a.agents[0].id);
    } catch (err) {
      setError(
        `无法连接 Hub (${API_BASE})。请先运行 huinet start。\n${(err as Error).message}`
      );
      setStatus(null);
    }
  }, [selectedId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (nav === 'context') {
      void api
        .memories(query || undefined)
        .then((r) => setMemories(r.memories))
        .catch((e) => setError((e as Error).message));
    }
    if (nav === 'bus') {
      void api
        .busMessages()
        .then((r) => setMessages(r.messages))
        .catch((e) => setError((e as Error).message));
    }
    if (nav === 'settings') {
      void api
        .mcpConfig()
        .then((r) => setMcpSnippet(JSON.stringify(r, null, 2)))
        .catch(() => setMcpSnippet(''));
    }
  }, [nav, query]);

  const selected = agents.find((a) => a.id === selectedId) || null;

  async function onScan() {
    setBusy(true);
    try {
      const snap = await api.scan();
      setAgents(snap.agents);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onImport(from: string) {
    setBusy(true);
    try {
      const r = await api.importSessions(from);
      alert(`已导入 ${r.imported} 条（跳过 ${r.skipped}）`);
      const m = await api.memories();
      setMemories(m.memories);
      setNav('context');
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
      alert(`已复制迁移包（${pkg.memories.length} 条记忆）到剪贴板`);
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">H</span>
          <div>
            <div className="brand-name">HuiNet</div>
            <div className="brand-sub">Local Agent Fabric</div>
          </div>
        </div>

        <div className="side-section-label">Agents</div>
        <div className="agent-list">
          {agents.map((a) => (
            <button
              key={a.id}
              className={`agent-item ${selectedId === a.id && nav === 'agents' ? 'active' : ''}`}
              onClick={() => {
                setSelectedId(a.id);
                setNav('agents');
              }}
            >
              <span className={`dot ${a.presence}`} />
              <span className="agent-item-name">{a.name}</span>
            </button>
          ))}
          {!agents.length && (
            <div className="muted pad">尚未发现 Agent</div>
          )}
        </div>

        <div className="side-footer">
          <button
            className={`nav-btn ${nav === 'context' ? 'active' : ''}`}
            onClick={() => setNav('context')}
          >
            上下文
          </button>
          <button
            className={`nav-btn ${nav === 'bus' ? 'active' : ''}`}
            onClick={() => setNav('bus')}
          >
            总线
          </button>
          <button
            className={`nav-btn ${nav === 'settings' ? 'active' : ''}`}
            onClick={() => setNav('settings')}
          >
            设置
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>
              {nav === 'agents' && (selected?.name || 'Agents')}
              {nav === 'context' && '共享上下文'}
              {nav === 'bus' && 'A2A 总线'}
              {nav === 'settings' && '设置'}
            </h1>
            <p className="top-sub">
              {status
                ? `Hub 在线 · ${status.connectedAgents} 已连接 · ${status.inventoryCount} 已发现 · ${status.memoryCount} 记忆`
                : 'Hub 离线'}
            </p>
          </div>
          <div className="top-actions">
            <button className="btn" disabled={busy} onClick={() => void onScan()}>
              扫描
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => void refresh()}>
              刷新
            </button>
          </div>
        </header>

        {error && (
          <div className="banner error">
            <pre>{error}</pre>
            <button className="btn ghost" onClick={() => setError(null)}>
              关闭
            </button>
          </div>
        )}

        {nav === 'agents' && selected && (
          <section className="content">
            <article className="card">
              <div className="card-head">
                <div>
                  <h2>{selected.name}</h2>
                  <p className="muted mono">{selected.id}</p>
                </div>
                <span className={`pill ${selected.presence}`}>
                  {presenceLabel(selected.presence)}
                </span>
              </div>
              <dl className="meta">
                <div>
                  <dt>二进制</dt>
                  <dd className="mono">{selected.binaryPath || '—'}</dd>
                </div>
                <div>
                  <dt>版本</dt>
                  <dd>{selected.version || '—'}</dd>
                </div>
                <div>
                  <dt>主目录</dt>
                  <dd className="mono">{selected.homeDir || '—'}</dd>
                </div>
                <div>
                  <dt>会话目录</dt>
                  <dd className="mono">{selected.sessionDir || '—'}</dd>
                </div>
                <div>
                  <dt>能力</dt>
                  <dd>{(selected.capabilities || []).join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt>信号</dt>
                  <dd>{(selected.signals || []).join(' · ') || '—'}</dd>
                </div>
              </dl>
              <div className="card-actions">
                {['claude', 'codex', 'cursor'].includes(
                  selected.id === 'claude-code' ? 'claude' : selected.id
                ) && (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      void onImport(
                        selected.id === 'claude-code' ? 'claude' : selected.id
                      )
                    }
                  >
                    导入会话到上下文
                  </button>
                )}
                <button className="btn" disabled={busy} onClick={() => void onMigrate()}>
                  导出迁移包
                </button>
              </div>
            </article>
          </section>
        )}

        {nav === 'context' && (
          <section className="content">
            <div className="toolbar">
              <input
                className="input"
                placeholder="搜索记忆…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="btn" disabled={busy} onClick={() => void onImport('claude')}>
                从 Claude 导入
              </button>
              <button className="btn" disabled={busy} onClick={() => void onImport('codex')}>
                从 Codex 导入
              </button>
              <button className="btn" disabled={busy} onClick={() => void onImport('cursor')}>
                从 Cursor 导入
              </button>
              <button className="btn primary" disabled={busy} onClick={() => void onMigrate()}>
                复制迁移包
              </button>
            </div>
            <div className="card-stack">
              {memories.map((m) => (
                <article key={m.id} className="card compact">
                  <div className="card-head">
                    <h3>{m.title}</h3>
                    <span className="pill soft">{m.kind}</span>
                  </div>
                  <p className="body">{m.body}</p>
                  <p className="muted tiny">
                    {m.scope}
                    {m.project ? ` · ${m.project}` : ''} ·{' '}
                    {new Date(m.updatedAt).toLocaleString()}
                  </p>
                </article>
              ))}
              {!memories.length && (
                <div className="empty">还没有记忆。先从某个 Agent 导入会话，或用 CLI upsert。</div>
              )}
            </div>
          </section>
        )}

        {nav === 'bus' && (
          <section className="content">
            <div className="toolbar">
              <input
                className="input narrow"
                placeholder="目标 agentId 或 *"
                value={busTo}
                onChange={(e) => setBusTo(e.target.value)}
              />
              <input
                className="input"
                placeholder="消息内容"
                value={busText}
                onChange={(e) => setBusText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSend();
                }}
              />
              <button className="btn primary" disabled={busy} onClick={() => void onSend()}>
                发送
              </button>
            </div>
            <div className="timeline">
              {messages.map((m) => (
                <div key={m.id} className="timeline-item">
                  <div className="timeline-meta mono">
                    {new Date(m.timestamp).toLocaleTimeString()} · {m.from} → {m.to}
                  </div>
                  <div className="timeline-body">
                    {typeof m.payload === 'object' && m.payload && 'text' in (m.payload as object)
                      ? String((m.payload as { text: string }).text)
                      : JSON.stringify(m.payload)}
                  </div>
                </div>
              ))}
              {!messages.length && <div className="empty">暂无总线消息</div>}
            </div>
          </section>
        )}

        {nav === 'settings' && (
          <section className="content">
            <article className="card">
              <h2>Hub</h2>
              <dl className="meta">
                <div>
                  <dt>HTTP</dt>
                  <dd className="mono">{status?.httpUrl || API_BASE}</dd>
                </div>
                <div>
                  <dt>WS</dt>
                  <dd className="mono">{status?.wsUrl || '—'}</dd>
                </div>
              </dl>
            </article>
            <article className="card">
              <h2>MCP 配置</h2>
              <p className="muted">
                将下列片段写入 Claude / Cursor MCP 配置，即可让任意 Agent 读写共享上下文。
              </p>
              <pre className="code-block">{mcpSnippet || '启动 Hub 后可获取配置'}</pre>
              <button
                className="btn"
                onClick={() => {
                  void navigator.clipboard.writeText(mcpSnippet);
                }}
                disabled={!mcpSnippet}
              >
                复制
              </button>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
