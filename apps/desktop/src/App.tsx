import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  type Agent,
  type BusMessage,
  type DoctorResult,
  type FabricBrief,
  type FabricTask,
  type HubStatus,
  type MailItem,
  type Memory,
  API_BASE,
} from './api';
import { NetworkCanvas } from './NetworkCanvas';
import {
  createT,
  loadLocale,
  saveLocale,
  type Locale,
  type TFunction,
} from './i18n';

type Layer =
  | 'fabric'
  | 'memory'
  | 'work'
  | 'traffic'
  | 'terminal'
  | 'net'
  | 'system';

const NAV_IDS: Layer[] = [
  'fabric',
  'memory',
  'work',
  'traffic',
  'terminal',
  'net',
  'system',
];

function navItems(t: TFunction) {
  return NAV_IDS.map((id) => ({
    id,
    label: t(`nav.${id}` as Parameters<TFunction>[0]),
    hint: t(`nav.${id}.hint` as Parameters<TFunction>[0]),
  }));
}

function presenceLabel(p: string, t: TFunction): string {
  switch (p) {
    case 'connected':
      return t('presence.connected');
    case 'running':
      return t('presence.running');
    case 'installed':
      return t('presence.installed');
    default:
      return p;
  }
}

function agentStatusLabel(
  a: { presence: string; a2aOpen?: boolean; wsConnected?: boolean },
  t: TFunction
): string {
  if (a.wsConnected) return t('presence.liveWs');
  if (a.presence === 'running') return t('presence.running');
  if (a.a2aOpen) return t('presence.onFabric');
  return presenceLabel(a.presence, t);
}

function layerTitle(layer: Layer, t: TFunction): string {
  return t(`nav.${layer}` as Parameters<TFunction>[0]);
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => loadLocale());
  const t = useMemo(() => createT(locale), [locale]);
  const nav = useMemo(() => navItems(t), [t]);

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
  const [brief, setBrief] = useState<FabricBrief | null>(null);
  const [tasks, setTasks] = useState<FabricTask[]>([]);
  const [mail, setMail] = useState<MailItem[]>([]);
  const [taskTo, setTaskTo] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [inboxAgent, setInboxAgent] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState('');
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [fabricGroupOpen, setFabricGroupOpen] = useState(true);
  const [idleGroupOpen, setIdleGroupOpen] = useState(true);
  const [termCmd, setTermCmd] = useState('huinet status');
  const [termLog, setTermLog] = useState('');
  const [netUrl, setNetUrl] = useState('https://httpbin.org/get');
  const [netOut, setNetOut] = useState('');
  const [memProject, setMemProject] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [related, setRelated] = useState<
    Array<import('./api').Memory & { via?: string }>
  >([]);
  const [consultMode, setConsultMode] = useState(false);
  const [consultPeers, setConsultPeers] = useState<string[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    try {
      return localStorage.getItem('huinet.inspector.open') !== '0';
    } catch {
      return true;
    }
  });

  const toggleInspector = () => {
    setInspectorOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('huinet.inspector.open', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const switchLocale = (next: Locale) => {
    setLocale(next);
    saveLocale(next);
  };

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
      setTokenTotals((prev) => {
        const next = { ...prev };
        let added = 0;
        for (const m of bus.messages) {
          if (seenMsgIds.current.has(m.id)) continue;
          seenMsgIds.current.add(m.id);
          const tok =
            typeof m.tokens === 'number' && m.tokens > 0
              ? m.tokens
              : Math.max(
                  1,
                  Math.ceil(JSON.stringify(m.payload ?? '').length / 4)
                );
          added += tok;
          const bump = (id: string) => {
            if (!id || id === '*' || id === 'ui' || id === 'hub') return;
            next[id] = (next[id] || 0) + tok;
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
      void api.doctor().then(setDoctor).catch(() => null);
    } catch (err) {
      setOffline(true);
      setStatus(null);
      setError((err as Error).message);
    }
  }, [selectedId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (offline) return;
    if (layer === 'memory') {
      void Promise.all([
        api.memories(query || undefined, projectFilter || undefined),
        api.brief(projectFilter || undefined).catch(() => null),
      ])
        .then(([r, b]) => {
          setMemories(r.memories);
          if (b) setBrief(b);
        })
        .catch((e) => setError((e as Error).message));
    }
    if (layer === 'work') {
      const agent =
        inboxAgent ||
        selectedId ||
        agents.find((a) => a.a2aOpen)?.id ||
        agents[0]?.id ||
        '';
      void Promise.all([
        api.brief(projectFilter || undefined).catch(() => null),
        api
          .tasks()
          .catch(() => ({
            tasks: [] as FabricTask[],
            summary: { open: 0, completed: 0, failed: 0 },
          })),
        agent
          ? api.mailbox(agent, false).catch(() => ({
              agentId: agent,
              unread: 0,
              items: [] as MailItem[],
            }))
          : Promise.resolve({
              agentId: '',
              unread: 0,
              items: [] as MailItem[],
            }),
      ]).then(([b, taskRes, m]) => {
        if (b) setBrief(b);
        setTasks(taskRes.tasks);
        setMail(m.items);
        if (agent && !inboxAgent) setInboxAgent(agent);
      });
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
  }, [layer, query, projectFilter, offline, selectedId, inboxAgent, agents]);

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) || null,
    [agents, selectedId]
  );
  /** Prefer conversation nodes on the fabric; keep runtime only if it has no sessions. */
  const fabricAgents = useMemo(() => {
    const parentsWithSessions = new Set(
      agents.filter((a) => a.kind === 'session' && a.parentId).map((a) => a.parentId!)
    );
    return agents.filter(
      (a) => a.kind === 'session' || !parentsWithSessions.has(a.id)
    );
  }, [agents]);
  const openCount = fabricAgents.filter((a) => a.a2aOpen).length;
  const runningCount = fabricAgents.filter(
    (a) => a.presence === 'running' || a.wsConnected
  ).length;
  const filteredAgents = useMemo(() => {
    const q = sidebarFilter.trim().toLowerCase();
    const base = fabricAgents;
    if (!q) return base;
    return base.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        (a.title || '').toLowerCase().includes(q) ||
        (a.project || '').toLowerCase().includes(q)
    );
  }, [fabricAgents, sidebarFilter]);
  const onFabricAgents = useMemo(
    () => filteredAgents.filter((a) => a.a2aOpen),
    [filteredAgents]
  );
  const idleAgents = useMemo(
    () => filteredAgents.filter((a) => !a.a2aOpen),
    [filteredAgents]
  );
  const doctorPass = doctor?.checks.filter((c) => c.pass).length ?? 0;
  const doctorTotal = doctor?.checks.length ?? 0;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function onScan() {
    setBusy(true);
    try {
      const snap = await api.scan();
      setAgents(snap.agents);
      showToast(t('toast.scan', { n: snap.agents.length }));
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
      showToast(t('toast.expand', { n: r.opened.length }));
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
      showToast(t('toast.collapse', { n: r.closed.length }));
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
      showToast(t('toast.import', { n: r.imported }));
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
      const pkg = await api.migrate(projectFilter || undefined);
      await navigator.clipboard.writeText(pkg.markdown);
      showToast(t('toast.migrateCopied'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onUpsertMemory() {
    if (!memTitle.trim() || !memBody.trim()) {
      showToast(t('toast.needTitleBody'));
      return;
    }
    setBusy(true);
    try {
      await api.upsert({
        kind: memKind,
        title: memTitle.trim(),
        body: memBody.trim(),
        scope: memProject.trim() ? 'project' : 'global',
        project: memProject.trim() || undefined,
        tags: ['ui'],
      });
      setMemTitle('');
      setMemBody('');
      const m = await api.memories(
        query || undefined,
        projectFilter || undefined
      );
      setMemories(m.memories);
      showToast(t('toast.memoryWritten'));
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

  async function onPinMemory(id: string) {
    try {
      const b = await api.pinBrief(id);
      setBrief(b);
      showToast(t('toast.pinned'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onUnpinMemory(id: string) {
    try {
      const b = await api.unpinBrief(id);
      setBrief(b);
      showToast(t('toast.unpinned'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onCreateTask() {
    const to = taskTo || fabricAgents.find((a) => a.a2aOpen)?.id || '';
    if (!to || !taskTitle.trim()) return;
    setBusy(true);
    try {
      await api.createTask({ to, title: taskTitle.trim(), from: 'ui' });
      setTaskTitle('');
      const taskRes = await api.tasks();
      setTasks(taskRes.tasks);
      showToast(t('toast.taskDispatched'));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onCompleteTask(id: string) {
    try {
      await api.completeTask(id, { status: 'completed', result: { ok: true } });
      const taskRes = await api.tasks();
      setTasks(taskRes.tasks);
      showToast(t('toast.taskDone'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onAckMail() {
    if (!inboxAgent) return;
    try {
      await api.mailboxRead(inboxAgent, { all: true });
      const m = await api.mailbox(inboxAgent, false);
      setMail(m.items);
      await refresh();
      showToast(t('toast.mailRead'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onTerminalRun() {
    if (!termCmd.trim()) return;
    setBusy(true);
    try {
      const r = await api.terminalRun(termCmd.trim());
      const block = [
        `$ ${r.command}`,
        r.stdout || '',
        r.stderr || '',
        `[exit ${r.code ?? 'null'} · ${r.ms}ms]`,
        '',
      ].join('\n');
      setTermLog((prev) => (prev + block).slice(-12000));
      showToast(r.ok ? t('toast.cmdOk') : t('toast.cmdFail'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onNetFetch() {
    if (!netUrl.trim()) return;
    setBusy(true);
    try {
      const r = await api.netFetch({ url: netUrl.trim() });
      setNetOut(
        JSON.stringify(
          {
            status: r.status,
            statusText: r.statusText,
            url: r.url,
            ms: r.ms,
            truncated: r.truncated,
            body: r.body.slice(0, 4000),
          },
          null,
          2
        )
      );
      showToast(t('toast.http', { status: r.status, ms: r.ms }));
      await refresh();
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
      if (consultMode) {
        const peers =
          consultPeers.length > 0
            ? consultPeers
            : fabricAgents.filter((a) => a.a2aOpen).map((a) => a.id);
        if (!peers.length) {
          showToast(t('fabric.consultHint'));
          setBusy(false);
          return;
        }
        const r = await api.consult(
          peers,
          busText.trim(),
          projectFilter || selected?.project
        );
        setBusText('');
        showToast(t('toast.consultSent', { n: r.delivered }));
      } else {
        await api.send(busTo, busText.trim());
        setBusText('');
        showToast(t('toast.busSent'));
      }
      const snap = await api.busMessages();
      setMessages(snap.messages);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onExportCanvas() {
    setBusy(true);
    try {
      const canvas = await api.fabricCanvas(false);
      const { markdown: _md, meta: _meta, ...doc } = canvas as {
        markdown?: string;
        meta?: unknown;
        nodes: unknown[];
        edges: unknown[];
      };
      await navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
      showToast(t('toast.canvasCopied'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onShowRelated(id: string) {
    try {
      const r = await api.relatedMemories(id);
      setRelated(r.related);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function toggleConsultPeer(id: string) {
    setConsultPeers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onRunDoctor() {
    setBusy(true);
    try {
      const doc = await api.doctor();
      setDoctor(doc);
      showToast(doc.ok ? t('toast.healthy') : t('toast.issues'));
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
    const node = agents.find((a) => a.id === id);
    if (node?.project) {
      setProjectFilter(node.project);
      setMemProject(node.project);
    }
  }

  function agentRow(a: Agent) {
    const tok = tokenTotals[a.id] || 0;
    return (
      <div
        key={a.id}
        className={`sb-row ${selectedId === a.id ? 'active' : ''}`}
        onClick={() => handleSelect(a.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSelect(a.id);
        }}
      >
        {selectedId === a.id && <span className="sb-active-dot" />}
        <span className="sb-row-icon" aria-hidden>
          {a.presence === 'running' || a.wsConnected
            ? '◉'
            : a.a2aOpen
              ? '○'
              : '·'}
        </span>
        <span className="sb-row-main">
          <span className="sb-row-title">
            {a.kind === 'session'
              ? a.title || a.name
              : a.name}
          </span>
          <span className="sb-row-sub muted">
            {a.kind === 'session'
              ? [
                  a.parentId === 'claude-code'
                    ? 'Claude'
                    : a.parentId === 'cursor'
                      ? 'Cursor'
                      : a.parentId === 'codex'
                        ? 'Codex'
                        : a.parentId,
                  a.project,
                  agentStatusLabel(a, t),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : agentStatusLabel(a, t)}
          </span>
        </span>
        <span className="sb-row-time">
          {(a.unreadMail || 0) > 0
            ? `${a.unreadMail}`
            : tok > 0
              ? `${tok > 999 ? `${Math.round(tok / 1000)}k` : tok}t`
              : ''}
        </span>
        <label className="switch compact" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={Boolean(a.a2aOpen)}
            disabled={toggling === a.id || busy}
            onChange={(e) => void onToggleA2a(a, e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>
    );
  }

  const openTasksCount =
    status?.openTasks ??
    tasks.filter((task) =>
      ['pending', 'accepted', 'running'].includes(task.status)
    ).length;

  return (
    <div className="app dark" lang={locale}>
      <header className="titlebar">
        <div className="titlebar-spacer" />
        <div className="titlebar-center">
          <span className={`title-live ${offline ? 'off' : ''}`}>
            {offline
              ? t('title.offline')
              : t('title.fabric', {
                  open: openCount,
                  total: fabricAgents.length,
                })}
          </span>
        </div>
        <div className="titlebar-actions">
          <div className="lang-switch" title={t('lang.toggle')}>
            <button
              type="button"
              className={`lang-btn ${locale === 'zh' ? 'on' : ''}`}
              onClick={() => switchLocale('zh')}
            >
              {t('lang.zh')}
            </button>
            <button
              type="button"
              className={`lang-btn ${locale === 'en' ? 'on' : ''}`}
              onClick={() => switchLocale('en')}
            >
              {t('lang.en')}
            </button>
          </div>
        </div>
      </header>

      {toast && <div className="toast">{toast}</div>}
      {error && (
        <div className="banner">
          <pre>{error}</pre>
          <button className="btn ghost" onClick={() => setError(null)}>
            {t('common.close')}
          </button>
        </div>
      )}

      {offline ? (
        <section className="offline">
          <h1>{t('offline.title')}</h1>
          <p>{t('offline.body')}</p>
          <button className="btn" onClick={() => void refresh()}>
            {t('offline.reconnect')}
          </button>
        </section>
      ) : (
        <div className="shell">
          <aside className="sidebar">
            <div className="sb-top">
              <button
                type="button"
                className="sb-action"
                disabled={busy}
                onClick={() => void onScan()}
              >
                <span className="sb-action-ico">＋</span>
                {t('sb.scanAgents')}
              </button>
              <button
                type="button"
                className="sb-action"
                disabled={busy || !agents.length}
                onClick={() => void onConnectAll()}
              >
                <span className="sb-action-ico">↻</span>
                {t('sb.expandAll')}
              </button>
              <button
                type="button"
                className={`sb-action ${layer === 'system' ? 'on' : ''}`}
                onClick={() => setLayer('system')}
              >
                <span className="sb-action-ico">⚙</span>
                {t('sb.systemMcp')}
              </button>
            </div>

            <div className="sb-scroll">
              <div className="sb-sec">
                <div className="sb-sec-h">
                  <span>{t('nav.views')}</span>
                  <button
                    type="button"
                    className="sb-ico-btn"
                    title={t('nav.fabric')}
                    onClick={() => setLayer('fabric')}
                  >
                    ＋
                  </button>
                </div>
                {nav
                  .filter((item) => item.id !== 'system')
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`sb-row view ${layer === item.id ? 'active' : ''}`}
                      onClick={() => setLayer(item.id)}
                    >
                      {layer === item.id && <span className="sb-active-dot" />}
                      <span className="sb-row-icon">▸</span>
                      <span className="sb-row-main">
                        <span className="sb-row-title">{item.label}</span>
                      </span>
                      <span className="sb-row-time">
                        {item.id === 'work' && (status?.unreadMail || 0) > 0
                          ? status?.unreadMail
                          : ''}
                      </span>
                    </button>
                  ))}
              </div>

              <div className="sb-sec">
                <div className="sb-sec-h">
                  <button
                    type="button"
                    className="sb-sec-toggle"
                    onClick={() => setAgentsOpen((v) => !v)}
                  >
                    <span className={`chev ${agentsOpen ? 'open' : ''}`}>▸</span>
                    {t('sb.agents')}
                  </button>
                  <div className="sb-sec-tools">
                    <button
                      type="button"
                      className="sb-ico-btn"
                      title={t('sb.filter')}
                      onClick={() => {
                        const el = document.getElementById('sb-filter');
                        el?.focus();
                      }}
                    >
                      ⌕
                    </button>
                    <button
                      type="button"
                      className="sb-ico-btn"
                      title={t('sb.scan')}
                      disabled={busy}
                      onClick={() => void onScan()}
                    >
                      ＋
                    </button>
                  </div>
                </div>
                {agentsOpen && (
                  <>
                    <input
                      id="sb-filter"
                      className="sb-filter"
                      placeholder={t('sb.filterPlaceholder')}
                      value={sidebarFilter}
                      onChange={(e) => setSidebarFilter(e.target.value)}
                    />
                    <button
                      type="button"
                      className="sb-group"
                      onClick={() => setFabricGroupOpen((v) => !v)}
                    >
                      <span className={`chev ${fabricGroupOpen ? 'open' : ''}`}>
                        ▸
                      </span>
                      <span className="sb-folder">📁</span>
                      {t('sb.onFabric')}
                      <span className="sb-count">{onFabricAgents.length}</span>
                    </button>
                    {fabricGroupOpen && onFabricAgents.map(agentRow)}
                    <button
                      type="button"
                      className="sb-group"
                      onClick={() => setIdleGroupOpen((v) => !v)}
                    >
                      <span className={`chev ${idleGroupOpen ? 'open' : ''}`}>
                        ▸
                      </span>
                      <span className="sb-folder">📁</span>
                      {t('sb.installed')}
                      <span className="sb-count">{idleAgents.length}</span>
                    </button>
                    {idleGroupOpen && idleAgents.map(agentRow)}
                    {!filteredAgents.length && (
                      <div className="sb-empty">{t('sb.noAgents')}</div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="sb-bottom">
              <button
                type="button"
                className="sb-health"
                title={t('sb.doctorTitle')}
                onClick={() => {
                  setLayer('system');
                  void onRunDoctor();
                }}
              >
                <div className="sb-health-top">
                  <span>{t('sb.doctor')}</span>
                  <span
                    className={`sb-health-score ${
                      doctorTotal && doctorPass === doctorTotal ? 'ok' : ''
                    }`}
                  >
                    {doctorTotal
                      ? `${doctorPass}/${doctorTotal}`
                      : t('sb.clickCheck')}
                  </span>
                </div>
                <div className="sb-progress">
                  <div
                    className="sb-progress-bar"
                    style={{
                      width: doctorTotal
                        ? `${(doctorPass / doctorTotal) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </button>

              <div className="sb-stats">
                <button
                  type="button"
                  className="sb-stat"
                  title={t('sb.runningTitle')}
                  onClick={() => setLayer('fabric')}
                >
                  <strong>{runningCount}</strong>
                  <span>{t('sb.running')}</span>
                </button>
                <button
                  type="button"
                  className="sb-stat"
                  title={t('sb.a2aTitle')}
                  onClick={() => setLayer('fabric')}
                >
                  <strong>{openCount}</strong>
                  <span>{t('sb.a2a')}</span>
                </button>
                <button
                  type="button"
                  className="sb-stat"
                  title={t('sb.mailTitle')}
                  onClick={() => setLayer('work')}
                >
                  <strong>{status?.unreadMail ?? 0}</strong>
                  <span>{t('sb.mail')}</span>
                </button>
                <button
                  type="button"
                  className="sb-stat"
                  title={t('sb.tasksTitle')}
                  onClick={() => setLayer('work')}
                >
                  <strong>{status?.openTasks ?? 0}</strong>
                  <span>{t('sb.tasks')}</span>
                </button>
              </div>

              <div className="sb-actions">
                <button
                  type="button"
                  className="sb-act"
                  disabled={busy}
                  onClick={() => void onScan()}
                >
                  {t('sb.scan')}
                </button>
                <button
                  type="button"
                  className="sb-act"
                  disabled={busy || !agents.length}
                  onClick={() => void onConnectAll()}
                >
                  {t('sb.expand')}
                </button>
                <button
                  type="button"
                  className="sb-act danger"
                  disabled={busy || openCount === 0}
                  onClick={() => void onDisconnectAll()}
                >
                  {t('sb.collapse')}
                </button>
              </div>
            </div>
          </aside>

          <main className="workspace">
            <div className="workspace-bar">
              <div className="workspace-tabs">
                <div className="workspace-tab on">
                  {selected && layer === 'fabric'
                    ? selected.name
                    : layerTitle(layer, t)}
                </div>
              </div>
              <div className="workspace-actions">
                {layer === 'fabric' && (
                  <>
                    <button
                      className={`btn ghost ${consultMode ? 'on' : ''}`}
                      onClick={() => setConsultMode((v) => !v)}
                      title={t('fabric.consultHint')}
                    >
                      {t('fabric.consult')}
                      {consultMode && consultPeers.length > 0
                        ? ` · ${consultPeers.length}`
                        : ''}
                    </button>
                    <button
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => void onExportCanvas()}
                    >
                      {t('fabric.exportCanvas')}
                    </button>
                    {selected && (
                      <button
                        className="btn ghost"
                        disabled={busy || toggling === selected.id}
                        onClick={() =>
                          void onToggleA2a(selected, !selected.a2aOpen)
                        }
                      >
                        {selected.a2aOpen
                          ? t('fabric.leave')
                          : t('fabric.join')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div
              className={`workspace-body ${inspectorOpen ? '' : 'inspector-collapsed'}`}
            >
              <section className="stage-main">
                {layer === 'fabric' && (
                  <div className="fabric-wrap">
                    <NetworkCanvas
                      agents={fabricAgents}
                      selectedId={selectedId}
                      messages={messages}
                      tokenTotals={tokenTotals}
                      tokenSum={tokenSum}
                      memoryCount={status?.memoryCount ?? 0}
                      openCount={openCount}
                      t={t}
                      onSelect={handleSelect}
                      onToggle={(a, open) => void onToggleA2a(a, open)}
                    />
                    <div className="a2a-compose">
                      {consultMode ? (
                        <div className="consult-peers">
                          {fabricAgents
                            .filter((a) => a.a2aOpen)
                            .map((a) => (
                              <label key={a.id} className="consult-chip">
                                <input
                                  type="checkbox"
                                  checked={consultPeers.includes(a.id)}
                                  onChange={() => toggleConsultPeer(a.id)}
                                />
                                <span>
                                  {a.kind === 'session'
                                    ? a.title || a.name
                                    : a.name}
                                </span>
                              </label>
                            ))}
                          {!fabricAgents.some((a) => a.a2aOpen) && (
                            <span className="muted">
                              {t('fabric.consultHint')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <select
                          className="field"
                          value={busTo}
                          onChange={(e) => setBusTo(e.target.value)}
                        >
                          <option value="*">{t('common.broadcast')}</option>
                          {fabricAgents
                            .filter((a) => a.a2aOpen)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.kind === 'session'
                                  ? a.title || a.name
                                  : a.name}
                              </option>
                            ))}
                        </select>
                      )}
                      <input
                        className="field grow"
                        placeholder={
                          consultMode
                            ? t('fabric.consultHint')
                            : t('fabric.sendPlaceholder')
                        }
                        value={busText}
                        onChange={(e) => setBusText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void onSend();
                        }}
                      />
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => void onSend()}
                      >
                        {consultMode
                          ? t('fabric.consultSend')
                          : t('common.send')}
                      </button>
                    </div>
                  </div>
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
                          <option value="fact">{t('mem.kind.fact')}</option>
                          <option value="decision">
                            {t('mem.kind.decision')}
                          </option>
                          <option value="preference">
                            {t('mem.kind.preference')}
                          </option>
                          <option value="artifact">
                            {t('mem.kind.artifact')}
                          </option>
                          <option value="thread_summary">
                            {t('mem.kind.thread_summary')}
                          </option>
                        </select>
                        <input
                          className="field grow"
                          placeholder={t('common.title')}
                          value={memTitle}
                          onChange={(e) => setMemTitle(e.target.value)}
                        />
                      </div>
                      <div className="row">
                        <input
                          className="field grow"
                          placeholder={t('mem.projectPlaceholder')}
                          value={memProject}
                          onChange={(e) => setMemProject(e.target.value)}
                        />
                      </div>
                      <textarea
                        className="field"
                        rows={3}
                        placeholder={`${t('mem.bodyPlaceholder')} · ${t('mem.linksHint')}`}
                        value={memBody}
                        onChange={(e) => setMemBody(e.target.value)}
                      />
                      <div className="row wrap">
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void onUpsertMemory()}
                        >
                          {t('common.write')}
                        </button>
                        <button
                          className="btn ghost"
                          disabled={busy}
                          onClick={() => void onImport('claude')}
                        >
                          Claude
                        </button>
                        <button
                          className="btn ghost"
                          disabled={busy}
                          onClick={() => void onImport('codex')}
                        >
                          Codex
                        </button>
                        <button
                          className="btn ghost"
                          disabled={busy}
                          onClick={() => void onImport('cursor')}
                        >
                          Cursor
                        </button>
                        <button
                          className="btn ghost"
                          disabled={busy}
                          onClick={() => void onMigrate()}
                        >
                          {t('common.export')}
                        </button>
                      </div>
                    </div>
                    <div className="row">
                      <input
                        className="field search grow"
                        placeholder={t('common.search')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      <input
                        className="field"
                        placeholder={t('mem.projectFilter')}
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                        list="project-suggestions"
                      />
                      <datalist id="project-suggestions">
                        {[
                          ...new Set(
                            [
                              ...agents.map((a) => a.project).filter(Boolean),
                              ...memories.map((m) => m.project).filter(Boolean),
                            ] as string[]
                          ),
                        ].map((p) => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                    </div>
                    <div className="list">
                      {memories.map((m) => (
                        <article key={m.id} className="card">
                          <div className="card-head">
                            <strong>{m.title}</strong>
                            <span className="tag">{m.kind}</span>
                            {m.project && (
                              <span className="tag">{m.project}</span>
                            )}
                          </div>
                          <p>{m.body}</p>
                          {(m.links?.length || 0) > 0 && (
                            <p className="muted">
                              {t('mem.links')}: {m.links!.map((l) => `[[${l}]]`).join(' ')}
                            </p>
                          )}
                          <div className="card-foot">
                            <span className="muted">
                              {new Date(m.updatedAt).toLocaleString(
                                locale === 'zh' ? 'zh-CN' : 'en-US'
                              )}
                            </span>
                            <button
                              className="btn ghost tiny"
                              onClick={() => void onShowRelated(m.id)}
                            >
                              {t('mem.related')}
                            </button>
                            <button
                              className="btn ghost tiny"
                              onClick={() => void onPinMemory(m.id)}
                            >
                              {t('common.pin')}
                            </button>
                            <button
                              className="btn ghost tiny"
                              onClick={() => void onDeleteMemory(m.id)}
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        </article>
                      ))}
                      {!memories.length && (
                        <div className="empty">{t('mem.empty')}</div>
                      )}
                    </div>
                    {related.length > 0 && (
                      <article className="card">
                        <div className="card-head">
                          <h2>{t('mem.related')}</h2>
                          <button
                            className="btn ghost tiny"
                            onClick={() => setRelated([])}
                          >
                            {t('common.close')}
                          </button>
                        </div>
                        {related.map((m) => (
                          <div key={m.id} className="traffic-row">
                            <span className="tag">{m.via || ''}</span>
                            <strong>{m.title}</strong>
                            <span className="muted">{m.kind}</span>
                          </div>
                        ))}
                      </article>
                    )}
                  </div>
                )}

                {layer === 'work' && (
                  <div className="panel">
                    <div className="row">
                      <input
                        className="field grow"
                        placeholder={t('mem.projectFilter')}
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                      />
                    </div>
                    <article className="card">
                      <div className="card-head">
                        <h2>{t('work.brief')}</h2>
                        <span className="muted">
                          {t('work.briefMeta', {
                            n: brief?.memories.length || 0,
                          })}
                        </span>
                      </div>
                      {brief?.memories?.length ? (
                        <div className="list">
                          {brief.memories.map((m) => (
                            <div key={m.id} className="traffic-row">
                              <strong>{m.title}</strong>
                              <span className="muted">{m.kind}</span>
                              <button
                                className="btn ghost tiny"
                                onClick={() => void onUnpinMemory(m.id)}
                              >
                                {t('common.unpin')}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">{t('work.briefEmpty')}</p>
                      )}
                    </article>

                    <article className="card">
                      <div className="card-head">
                        <h2>{t('work.tasks')}</h2>
                        <span className="muted">
                          {t('common.open')} {openTasksCount}
                        </span>
                      </div>
                      <div className="row">
                        <select
                          className="field"
                          value={
                            taskTo || fabricAgents.find((a) => a.a2aOpen)?.id || ''
                          }
                          onChange={(e) => setTaskTo(e.target.value)}
                        >
                          <option value="">{t('work.assign')}</option>
                          {fabricAgents
                            .filter((a) => a.a2aOpen)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                        </select>
                        <input
                          className="field grow"
                          placeholder={t('work.taskTitle')}
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void onCreateTask();
                          }}
                        />
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void onCreateTask()}
                        >
                          {t('work.dispatch')}
                        </button>
                      </div>
                      <div className="list">
                        {tasks.map((task) => (
                          <div key={task.id} className="traffic-row">
                            <span className="tag">{task.status}</span>
                            <span className="mono muted">
                              {task.from} → {task.to}
                            </span>
                            <strong>{task.title}</strong>
                            {['pending', 'accepted', 'running'].includes(
                              task.status
                            ) && (
                              <button
                                className="btn ghost tiny"
                                onClick={() => void onCompleteTask(task.id)}
                              >
                                {t('common.done')}
                              </button>
                            )}
                          </div>
                        ))}
                        {!tasks.length && (
                          <div className="empty">{t('work.noTasks')}</div>
                        )}
                      </div>
                    </article>

                    <article className="card">
                      <div className="card-head">
                        <h2>{t('work.inbox')}</h2>
                        <button
                          className="btn ghost tiny"
                          onClick={() => void onAckMail()}
                        >
                          {t('work.markAllRead')}
                        </button>
                      </div>
                      <select
                        className="field"
                        value={inboxAgent}
                        onChange={(e) => setInboxAgent(e.target.value)}
                      >
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                            {(a.unreadMail || 0) > 0
                              ? ` (${a.unreadMail})`
                              : ''}
                          </option>
                        ))}
                      </select>
                      <div className="traffic">
                        {mail.map((item) => (
                          <div key={item.id} className="traffic-row">
                            <span
                              className={`tag ${item.read ? '' : 'open'}`}
                            >
                              {item.read
                                ? t('common.read')
                                : t('common.new')}
                            </span>
                            <span className="mono">
                              {item.message.from} → {item.message.to}
                            </span>
                            <span>
                              {typeof item.message.payload === 'object' &&
                              item.message.payload &&
                              'text' in (item.message.payload as object)
                                ? String(
                                    (item.message.payload as { text: string })
                                      .text
                                  )
                                : JSON.stringify(item.message.payload)}
                            </span>
                          </div>
                        ))}
                        {!mail.length && (
                          <div className="empty">{t('work.inboxEmpty')}</div>
                        )}
                      </div>
                    </article>
                  </div>
                )}

                {layer === 'traffic' && (
                  <div className="panel">
                    <div className="card">
                      <h2>{t('traffic.title')}</h2>
                      <p className="muted">
                        {t('traffic.desc', {
                          sum: tokenSum.toLocaleString(
                            locale === 'zh' ? 'zh-CN' : 'en-US'
                          ),
                        })}
                      </p>
                    </div>
                    <div className="row">
                      <select
                        className="field"
                        value={busTo}
                        onChange={(e) => setBusTo(e.target.value)}
                      >
                        <option value="*">{t('common.broadcast')}</option>
                        {fabricAgents
                          .filter((a) => a.a2aOpen)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                      <input
                        className="field grow"
                        placeholder={t('traffic.sendPlaceholder')}
                        value={busText}
                        onChange={(e) => setBusText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void onSend();
                        }}
                      />
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => void onSend()}
                      >
                        {t('common.send')}
                      </button>
                    </div>
                    <div className="traffic">
                      {messages.map((m) => (
                        <div key={m.id} className="traffic-row">
                          <span className="mono muted">
                            {new Date(m.timestamp).toLocaleTimeString(
                              locale === 'zh' ? 'zh-CN' : 'en-US'
                            )}
                          </span>
                          <span className="mono muted">
                            {(m.tokens ?? 0)}t
                          </span>
                          <span className="mono">
                            {m.from} → {m.to}
                          </span>
                          <span>
                            {typeof m.payload === 'object' &&
                            m.payload &&
                            'text' in (m.payload as object)
                              ? String(
                                  (m.payload as { text: string }).text
                                )
                              : JSON.stringify(m.payload)}
                          </span>
                        </div>
                      ))}
                      {!messages.length && (
                        <div className="empty">{t('traffic.empty')}</div>
                      )}
                    </div>
                  </div>
                )}

                {layer === 'terminal' && (
                  <div className="panel terminal-panel">
                    <article className="card">
                      <h2>{t('term.title')}</h2>
                      <p className="muted">{t('term.desc')}</p>
                      <div className="row">
                        <input
                          className="field grow mono"
                          value={termCmd}
                          onChange={(e) => setTermCmd(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void onTerminalRun();
                          }}
                          spellCheck={false}
                        />
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void onTerminalRun()}
                        >
                          {t('common.run')}
                        </button>
                      </div>
                      <div className="term-shortcuts row wrap">
                        {[
                          'huinet status',
                          'huinet agents list',
                          'huinet doctor',
                          'huinet bus listen',
                        ].map((c) => (
                          <button
                            key={c}
                            className="btn ghost tiny"
                            onClick={() => setTermCmd(c)}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </article>
                    <pre className="code term-log">
                      {termLog || t('term.waiting')}
                    </pre>
                  </div>
                )}

                {layer === 'net' && (
                  <div className="panel">
                    <article className="card">
                      <h2>{t('net.title')}</h2>
                      <p className="muted">{t('net.desc')}</p>
                      <div className="row">
                        <input
                          className="field grow mono"
                          value={netUrl}
                          onChange={(e) => setNetUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void onNetFetch();
                          }}
                          spellCheck={false}
                        />
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void onNetFetch()}
                        >
                          {t('common.fetch')}
                        </button>
                      </div>
                    </article>
                    <article className="card">
                      <h2>{t('net.chat')}</h2>
                      <p className="muted">{t('net.chatDesc')}</p>
                      <div className="row">
                        <select
                          className="field"
                          value={busTo}
                          onChange={(e) => setBusTo(e.target.value)}
                        >
                          <option value="*">{t('common.broadcast')}</option>
                          {fabricAgents
                            .filter((a) => a.a2aOpen)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                        </select>
                        <input
                          className="field grow"
                          placeholder={t('net.msgPlaceholder')}
                          value={busText}
                          onChange={(e) => setBusText(e.target.value)}
                        />
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void onSend()}
                        >
                          {t('common.send')}
                        </button>
                      </div>
                    </article>
                    <pre className="code">{netOut || t('net.noRequest')}</pre>
                  </div>
                )}

                {layer === 'system' && (
                  <div className="panel system">
                    <article className="card">
                      <h2>{t('sys.hub')}</h2>
                      <dl className="kv">
                        <div>
                          <dt>HTTP</dt>
                          <dd className="mono">
                            {status?.httpUrl || API_BASE}
                          </dd>
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
                        <h2>{t('sys.doctor')}</h2>
                        <button
                          className="btn ghost"
                          disabled={busy}
                          onClick={() => void onRunDoctor()}
                        >
                          {t('common.check')}
                        </button>
                      </div>
                      {doctor ? (
                        <ul className="checks">
                          {doctor.checks.map((c) => (
                            <li key={c.name}>
                              <span className={c.pass ? 'ok' : 'bad'}>
                                {c.pass ? '✓' : '✗'}
                              </span>
                              {c.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">{t('sys.runCheck')}</p>
                      )}
                    </article>
                    <article className="card">
                      <h2>{t('sys.mcp')}</h2>
                      <pre className="code">{mcpSnippet || '—'}</pre>
                    </article>
                    <article className="card">
                      <h2>{t('sys.quit')}</h2>
                      <p className="muted">{t('sys.quitDesc')}</p>
                    </article>
                  </div>
                )}
              </section>

              <aside
                className={`inspector ${inspectorOpen ? '' : 'collapsed'}`}
              >
                {inspectorOpen ? (
                  <>
                    <div className="inspector-head">
                      <span>{t('common.detail')}</span>
                      <button
                        type="button"
                        className="insp-toggle"
                        title={t('insp.collapse')}
                        onClick={toggleInspector}
                      >
                        ›
                      </button>
                    </div>
                    {selected ? (
                      <>
                        <div className="insp-kicker">
                          {selected.kind === 'session'
                            ? t('insp.session')
                            : t('insp.agent')}
                        </div>
                        <h2>
                          {selected.kind === 'session'
                            ? selected.title || selected.name
                            : selected.name}
                        </h2>
                        <p className="mono muted">{selected.id}</p>
                        {selected.kind === 'session' && (
                          <p className="muted insp-empty">
                            {[
                              selected.parentId,
                              selected.project,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                        <span
                          className={`pill ${selected.a2aOpen ? 'open' : ''}`}
                        >
                          {selected.wsConnected
                            ? t('presence.liveWs')
                            : selected.a2aOpen
                              ? t('presence.onFabric')
                              : presenceLabel(selected.presence, t)}
                        </span>
                        <dl className="kv">
                          <div>
                            <dt>{t('insp.path')}</dt>
                            <dd className="mono">
                              {selected.binaryPath || '—'}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('insp.session')}</dt>
                            <dd className="mono">
                              {selected.sessionDir || '—'}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('insp.mcp')}</dt>
                            <dd>
                              {selected.mcpSupported
                                ? selected.mcpWired
                                  ? t('insp.mcpWired')
                                  : t('insp.mcpReady')
                                : t('insp.mcpNone')}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('insp.unread')}</dt>
                            <dd>{selected.unreadMail ?? 0}</dd>
                          </div>
                          <div>
                            <dt>{t('insp.token')}</dt>
                            <dd className="mono">
                              {(
                                tokenTotals[selected.id] || 0
                              ).toLocaleString()}{' '}
                              t
                            </dd>
                          </div>
                        </dl>
                        <div className="row wrap">
                          <button
                            className="btn"
                            disabled={busy || toggling === selected.id}
                            onClick={() =>
                              void onToggleA2a(selected, !selected.a2aOpen)
                            }
                          >
                            {selected.a2aOpen
                              ? t('fabric.leave')
                              : t('fabric.join')}
                          </button>
                          {['claude-code', 'codex', 'cursor'].includes(
                            selected.id
                          ) && (
                            <button
                              className="btn ghost"
                              disabled={busy}
                              onClick={() =>
                                void onImport(
                                  selected.id === 'claude-code'
                                    ? 'claude'
                                    : selected.id
                                )
                              }
                            >
                              {t('insp.importSession')}
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="muted insp-empty">
                        {t('insp.selectHint')}
                      </p>
                    )}
                    <div className="inspector-traffic">
                      <div className="insp-kicker">{t('insp.recentBus')}</div>
                      {messages.slice(0, 8).map((m) => (
                        <div key={m.id} className="insp-msg">
                          <span className="mono muted">
                            {m.from}→{m.to}
                          </span>
                          <span>
                            {typeof m.payload === 'object' &&
                            m.payload &&
                            'text' in (m.payload as object)
                              ? String(
                                  (m.payload as { text: string }).text
                                ).slice(0, 80)
                              : JSON.stringify(m.payload).slice(0, 80)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="insp-rail"
                    title={t('insp.expand')}
                    onClick={toggleInspector}
                  >
                    <span className="insp-rail-chev">‹</span>
                    <span className="insp-rail-label">
                      {selected?.name || t('common.detail')}
                    </span>
                  </button>
                )}
              </aside>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
