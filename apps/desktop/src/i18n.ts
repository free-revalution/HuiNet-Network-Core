export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'huinet.locale';

const zh = {
  // titlebar
  'title.offline': 'Hub 离线',
  'title.fabric': '网络 {open}/{total}',
  'lang.zh': '中文',
  'lang.en': 'EN',
  'lang.toggle': '切换语言',

  // nav
  'nav.fabric': '网络',
  'nav.fabric.hint': '拓扑 · A2A',
  'nav.memory': '记忆',
  'nav.memory.hint': '共享上下文',
  'nav.work': '协作',
  'nav.work.hint': '简报 · 任务 · 收件',
  'nav.traffic': '流量',
  'nav.traffic.hint': '总线流量',
  'nav.terminal': '终端',
  'nav.terminal.hint': '本机 shell',
  'nav.net': '出网',
  'nav.net.hint': '出站 HTTP',
  'nav.system': '系统',
  'nav.system.hint': 'Hub · MCP',
  'nav.views': '视图',

  // presence
  'presence.connected': '已连接',
  'presence.running': '运行中',
  'presence.installed': '已安装',
  'presence.liveWs': '实时 WS',
  'presence.onFabric': '已入网',

  // toasts
  'toast.scan': '发现 {n} 节点',
  'toast.expand': '网络已展开 · {n}',
  'toast.collapse': '已收起 {n}',
  'toast.import': '导入 {n}',
  'toast.migrateCopied': '已复制迁移包',
  'toast.needTitleBody': '需要标题和内容',
  'toast.memoryWritten': '已写入记忆层',
  'toast.pinned': '已钉到网络简报',
  'toast.unpinned': '已取消钉选',
  'toast.taskDispatched': '任务已派发',
  'toast.taskDone': '任务完成',
  'toast.mailRead': '收件箱已读',
  'toast.cmdOk': '命令完成',
  'toast.cmdFail': '命令失败',
  'toast.http': 'HTTP {status} · {ms}ms',
  'toast.busSent': '已进入总线 / 收件箱',
  'toast.healthy': '网络健康',
  'toast.issues': '有待处理项',

  // common
  'common.close': '关闭',
  'common.send': '发送',
  'common.run': '运行',
  'common.fetch': '请求',
  'common.write': '写入',
  'common.export': '导出',
  'common.search': '搜索…',
  'common.delete': '删除',
  'common.pin': '钉选',
  'common.unpin': '取消',
  'common.done': '完成',
  'common.check': '检查',
  'common.broadcast': '广播 *',
  'common.title': '标题',
  'common.detail': '详情',
  'common.panel': '面板',
  'common.read': '已读',
  'common.new': '未读',
  'common.open': '开放',

  // offline
  'offline.title': '等待本地 Hub',
  'offline.body': '桌面端会自动拉起网络核心',
  'offline.reconnect': '重新连接',

  // sidebar top
  'sb.scanAgents': '扫描 Agents',
  'sb.expandAll': '全部展开',
  'sb.systemMcp': '系统 / MCP',
  'sb.agents': 'Agents',
  'sb.filter': '筛选',
  'sb.scan': '扫描',
  'sb.filterPlaceholder': '筛选 Agents…',
  'sb.onFabric': '已入网',
  'sb.installed': '已安装',
  'sb.noAgents': '暂无 Agent',
  'sb.doctor': '诊断',
  'sb.doctorTitle': '运行 Hub 诊断并打开系统页',
  'sb.clickCheck': '点击检查',
  'sb.running': '运行',
  'sb.runningTitle': '正在运行的进程',
  'sb.a2a': 'A2A',
  'sb.a2aTitle': '已接入 A2A 的节点',
  'sb.mail': '收件',
  'sb.mailTitle': '未读邮件',
  'sb.tasks': '任务',
  'sb.tasksTitle': '开放任务',
  'sb.expand': '展开',
  'sb.collapse': '收起',

  // fabric
  'fabric.leave': '离开网络',
  'fabric.join': '接入网络',
  'fabric.sendPlaceholder': '向 Agent 发消息（进总线 + 收件箱）…',
  'fabric.hint':
    '对等网格 · 边=真实互通 · {open}/{total} 已入网 · {links} 连线 · {tokens} token · {mem} 记忆',
  'fabric.empty': '扫描本机后，节点会出现；互通后才会连线',
  'fabric.emptySoft': '去中心化拓扑：仅在 Agent 真正互发消息后画边。用底部发送框试一下。',

  // memory
  'mem.kind.fact': '事实',
  'mem.kind.decision': '决策',
  'mem.kind.preference': '偏好',
  'mem.kind.artifact': '产物',
  'mem.kind.thread_summary': '线程摘要',
  'mem.bodyPlaceholder': '写入共享记忆层…',
  'mem.empty': '记忆层为空',

  // work
  'work.brief': '网络简报',
  'work.briefMeta': '{n} 钉选 · 供 MCP fabric_brief 拉取',
  'work.briefEmpty': '在「记忆」里钉选事实/决策，组成本机工作集。',
  'work.tasks': '任务',
  'work.assign': '指派给…',
  'work.taskTitle': '任务标题',
  'work.dispatch': '派发',
  'work.noTasks': '暂无任务',
  'work.inbox': '收件箱',
  'work.markAllRead': '全部已读',
  'work.inboxEmpty': '收件箱为空',

  // traffic
  'traffic.title': 'Token 流量',
  'traffic.desc':
    '总线消息按内容估算 token（约 4 字 ≈ 1 token）；Agent 上报真实用量后会覆盖估算。连线粗细随该节点累计 token 变化。合计 {sum} t',
  'traffic.sendPlaceholder': '向网络发送…',
  'traffic.empty': '暂无 token 流量',

  // terminal
  'term.title': '本机终端',
  'term.desc': '经 Hub 在本机执行命令（超时保护）。适合跑 huinet CLI、快速检查环境。',
  'term.waiting': '$ 等待输入…',

  // net
  'net.title': '互联网出口',
  'net.desc':
    'Hub 仍只监听 127.0.0.1；Agent 可通过 MCP net_fetch / 此面板请求公网。私网与 metadata 地址已拦截。',
  'net.chat': 'Agent 互聊',
  'net.chatDesc':
    '用 MCP ask_agent / send_message 发到总线；对方用 inbox_check 收取。',
  'net.msgPlaceholder': '消息…',
  'net.noRequest': '尚未请求',

  // system
  'sys.hub': 'Hub',
  'sys.doctor': '诊断',
  'sys.runCheck': '运行检查',
  'sys.mcp': 'MCP',
  'sys.quit': '关闭应用',
  'sys.quitDesc':
    '点窗口红绿灯关闭只会隐藏到菜单栏托盘。彻底退出：菜单栏图标 →「退出」，或 ⌘Q，或终端执行 huinet app --quit（可选再 huinet stop 停 Hub）。',

  // inspector
  'insp.agent': 'Agent',
  'insp.path': '路径',
  'insp.session': '会话',
  'insp.mcp': 'MCP',
  'insp.mcpWired': '已接入',
  'insp.mcpReady': '可接入',
  'insp.mcpNone': '无适配',
  'insp.unread': '未读',
  'insp.token': 'Token',
  'insp.importSession': '导入会话',
  'insp.selectHint': '从左侧 Agents 列表选择节点',
  'insp.recentBus': '最近总线',
  'insp.collapse': '向右收起',
  'insp.expand': '展开详情',

  'fabric.exportCanvas': '导出 Canvas',
  'fabric.consult': '会诊',
  'fabric.consultHint': '勾选多个对话，一键并行提问',
  'fabric.consultSend': '发起会诊',
  'fabric.peersSelected': '已选 {n}',
  'toast.canvasCopied': '已复制 JSON Canvas',
  'toast.consultSent': '会诊已派发 · {n}',

  'mem.project': '项目',
  'mem.projectPlaceholder': '项目（可选）',
  'mem.projectFilter': '按项目筛选…',
  'mem.linksHint': '正文可用 [[标题]] 关联其他记忆',
  'mem.related': '相关',
  'mem.links': '链接',
  'mem.allProjects': '全部项目',
} as const;

type DictKey = keyof typeof zh;

const en: Record<DictKey, string> = {
  'title.offline': 'Hub offline',
  'title.fabric': 'fabric {open}/{total}',
  'lang.zh': '中文',
  'lang.en': 'EN',
  'lang.toggle': 'Switch language',

  'nav.fabric': 'Network',
  'nav.fabric.hint': 'Topology · A2A',
  'nav.memory': 'Memory',
  'nav.memory.hint': 'Shared context',
  'nav.work': 'Work',
  'nav.work.hint': 'Brief · Tasks · Inbox',
  'nav.traffic': 'Traffic',
  'nav.traffic.hint': 'Bus traffic',
  'nav.terminal': 'Terminal',
  'nav.terminal.hint': 'Local shell',
  'nav.net': 'Outbound',
  'nav.net.hint': 'Outbound HTTP',
  'nav.system': 'System',
  'nav.system.hint': 'Hub · MCP',
  'nav.views': 'Views',

  'presence.connected': 'connected',
  'presence.running': 'running',
  'presence.installed': 'installed',
  'presence.liveWs': 'live ws',
  'presence.onFabric': 'on fabric',

  'toast.scan': 'Found {n} nodes',
  'toast.expand': 'Fabric expanded · {n}',
  'toast.collapse': 'Collapsed {n}',
  'toast.import': 'Imported {n}',
  'toast.migrateCopied': 'Migration pack copied',
  'toast.needTitleBody': 'Title and body required',
  'toast.memoryWritten': 'Written to memory',
  'toast.pinned': 'Pinned to Fabric Brief',
  'toast.unpinned': 'Unpinned',
  'toast.taskDispatched': 'Task dispatched',
  'toast.taskDone': 'Task completed',
  'toast.mailRead': 'Inbox marked read',
  'toast.cmdOk': 'Command finished',
  'toast.cmdFail': 'Command failed',
  'toast.http': 'HTTP {status} · {ms}ms',
  'toast.busSent': 'Sent to bus / mailbox',
  'toast.healthy': 'Fabric healthy',
  'toast.issues': 'Issues found',

  'common.close': 'Close',
  'common.send': 'Send',
  'common.run': 'Run',
  'common.fetch': 'Fetch',
  'common.write': 'Write',
  'common.export': 'Export',
  'common.search': 'Search…',
  'common.delete': 'Delete',
  'common.pin': 'Pin',
  'common.unpin': 'Unpin',
  'common.done': 'Done',
  'common.check': 'Check',
  'common.broadcast': 'Broadcast *',
  'common.title': 'Title',
  'common.detail': 'Detail',
  'common.panel': 'panel',
  'common.read': 'read',
  'common.new': 'new',
  'common.open': 'open',

  'offline.title': 'Waiting for local Hub',
  'offline.body': 'The desktop app will start the fabric core automatically',
  'offline.reconnect': 'Reconnect',

  'sb.scanAgents': 'Scan Agents',
  'sb.expandAll': 'Expand all',
  'sb.systemMcp': 'System / MCP',
  'sb.agents': 'Agents',
  'sb.filter': 'Filter',
  'sb.scan': 'Scan',
  'sb.filterPlaceholder': 'Filter agents…',
  'sb.onFabric': 'On fabric',
  'sb.installed': 'Installed',
  'sb.noAgents': 'No agents',
  'sb.doctor': 'Doctor',
  'sb.doctorTitle': 'Run Hub doctor and open System',
  'sb.clickCheck': 'Click to check',
  'sb.running': 'Run',
  'sb.runningTitle': 'Running processes',
  'sb.a2a': 'A2A',
  'sb.a2aTitle': 'Nodes on A2A',
  'sb.mail': 'Mail',
  'sb.mailTitle': 'Unread mail',
  'sb.tasks': 'Tasks',
  'sb.tasksTitle': 'Open tasks',
  'sb.expand': 'Expand',
  'sb.collapse': 'Collapse',

  'fabric.leave': 'Leave fabric',
  'fabric.join': 'Join fabric',
  'fabric.sendPlaceholder': 'Message an agent (bus + mailbox)…',
  'fabric.hint':
    'peer mesh · edges = real traffic · {open}/{total} on fabric · {links} links · {tokens} tok · {mem} mem',
  'fabric.empty': 'Scan this machine to show nodes; edges appear after peer traffic',
  'fabric.emptySoft':
    'Decentralized topology: edges only after agents message each other. Try the compose box below.',

  'mem.kind.fact': 'fact',
  'mem.kind.decision': 'decision',
  'mem.kind.preference': 'preference',
  'mem.kind.artifact': 'artifact',
  'mem.kind.thread_summary': 'thread_summary',
  'mem.bodyPlaceholder': 'Write to shared memory…',
  'mem.empty': 'Memory is empty',

  'work.brief': 'Fabric Brief',
  'work.briefMeta': '{n} pinned · for MCP fabric_brief',
  'work.briefEmpty':
    'Pin facts/decisions in Memory to build a local working set.',
  'work.tasks': 'Tasks',
  'work.assign': 'Assign to…',
  'work.taskTitle': 'Task title',
  'work.dispatch': 'Dispatch',
  'work.noTasks': 'No tasks',
  'work.inbox': 'Inbox',
  'work.markAllRead': 'Mark all read',
  'work.inboxEmpty': 'Inbox empty',

  'traffic.title': 'Token traffic',
  'traffic.desc':
    'Bus messages estimate tokens (~4 chars ≈ 1). Agent-reported usage overrides estimates. Edge width follows per-node totals. Sum {sum} t',
  'traffic.sendPlaceholder': 'Send to fabric…',
  'traffic.empty': 'No token traffic yet',

  'term.title': 'Local terminal',
  'term.desc':
    'Run commands on this machine via Hub (with timeout). Handy for huinet CLI and quick checks.',
  'term.waiting': '$ waiting…',

  'net.title': 'Internet egress',
  'net.desc':
    'Hub still listens only on 127.0.0.1; agents can hit the public web via MCP net_fetch / this panel. Private and metadata addresses are blocked.',
  'net.chat': 'Agent chat',
  'net.chatDesc':
    'Use MCP ask_agent / send_message on the bus; peers collect with inbox_check.',
  'net.msgPlaceholder': 'Message…',
  'net.noRequest': 'No request yet',

  'sys.hub': 'Hub',
  'sys.doctor': 'Doctor',
  'sys.runCheck': 'Run checks',
  'sys.mcp': 'MCP',
  'sys.quit': 'Quit app',
  'sys.quitDesc':
    'Closing the window traffic lights only hides to the menu-bar tray. Quit fully: tray icon → Quit, or ⌘Q, or run huinet app --quit (optionally huinet stop for the Hub).',

  'insp.agent': 'Agent',
  'insp.path': 'Path',
  'insp.session': 'Session',
  'insp.mcp': 'MCP',
  'insp.mcpWired': 'wired',
  'insp.mcpReady': 'ready',
  'insp.mcpNone': 'n/a',
  'insp.unread': 'Unread',
  'insp.token': 'Token',
  'insp.importSession': 'Import sessions',
  'insp.selectHint': 'Select a node from the Agents list',
  'insp.recentBus': 'Recent bus',
  'insp.collapse': 'Collapse panel',
  'insp.expand': 'Expand detail',

  'fabric.exportCanvas': 'Export Canvas',
  'fabric.consult': 'Consult',
  'fabric.consultHint': 'Select multiple chats, ask in parallel',
  'fabric.consultSend': 'Start consult',
  'fabric.peersSelected': '{n} selected',
  'toast.canvasCopied': 'JSON Canvas copied',
  'toast.consultSent': 'Consult sent · {n}',

  'mem.project': 'Project',
  'mem.projectPlaceholder': 'Project (optional)',
  'mem.projectFilter': 'Filter by project…',
  'mem.linksHint': 'Use [[Title]] in the body to link memories',
  'mem.related': 'Related',
  'mem.links': 'Links',
  'mem.allProjects': 'All projects',
};

const dicts: Record<Locale, Record<DictKey, string>> = { zh, en };

export type TFunction = (
  key: DictKey,
  vars?: Record<string, string | number>
) => string;

export function loadLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'zh') return v;
  } catch {
    // ignore
  }
  return 'zh';
}

export function saveLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

export function createT(locale: Locale): TFunction {
  const table = dicts[locale] || zh;
  return (key, vars) => {
    let s = table[key] ?? zh[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return s;
  };
}

export type { DictKey };
