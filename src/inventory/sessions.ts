/**
 * Expand product runtimes into per-conversation session nodes.
 * Cursor: ~/.cursor/projects/.../agent-transcripts/<uuid>/
 * Claude Code: ~/.claude/projects/.../<uuid>.jsonl (+ sessions-index)
 * Codex: ~/.codex/sessions (nested jsonl, best-effort)
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { DiscoveredAgent } from './types';

const MAX_PER_RUNTIME = 40;
const MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000; // 45 days
const TITLE_MAX = 48;

export function sessionNodeId(parentId: string, sessionId: string): string {
  return `${parentId}:session:${sessionId}`;
}

export function parseSessionNodeId(
  id: string
): { parentId: string; sessionId: string } | null {
  const m = id.match(/^([a-z0-9-]+):session:([a-z0-9-]+)$/i);
  if (!m) return null;
  return { parentId: m[1], sessionId: m[2] };
}

export function runtimeIdOf(agentId: string): string {
  return parseSessionNodeId(agentId)?.parentId ?? agentId;
}

type RawSession = {
  sessionId: string;
  parentId: string;
  title: string;
  project?: string;
  path: string;
  mtime: number;
};

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function safeReadHead(file: string, bytes = 16_000): string {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(bytes);
      const n = fs.readSync(fd, buf, 0, bytes, 0);
      return buf.slice(0, n).toString('utf-8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function cleanTitle(raw: string): string {
  let s = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*`_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return 'Untitled chat';
  if (s.length > TITLE_MAX) s = `${s.slice(0, TITLE_MAX - 1)}…`;
  return s;
}

function titleFromCursorJsonl(file: string): string {
  const head = safeReadHead(file, 24_000);
  const m =
    head.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i) ||
    head.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!m) return 'Cursor chat';
  try {
    const text = m[1].includes('\\')
      ? JSON.parse(`"${m[1]}"`)
      : m[1];
    return cleanTitle(String(text));
  } catch {
    return cleanTitle(m[1].replace(/\\n/g, ' '));
  }
}

function titleFromClaudeJsonl(file: string, fallback?: string): string {
  if (fallback && fallback !== 'No prompt') return cleanTitle(fallback);
  const head = safeReadHead(file, 32_000);
  for (const line of head.split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as {
        type?: string;
        message?: { role?: string; content?: unknown };
      };
      if (row.type !== 'user' && row.message?.role !== 'user') continue;
      const content = row.message?.content;
      let text = '';
      if (typeof content === 'string') text = content;
      else if (Array.isArray(content)) {
        for (const part of content) {
          if (
            part &&
            typeof part === 'object' &&
            'text' in part &&
            typeof (part as { text: unknown }).text === 'string'
          ) {
            text = (part as { text: string }).text;
            break;
          }
        }
      }
      if (text) return cleanTitle(text);
    } catch {
      // continue
    }
  }
  return 'Claude chat';
}

function projectLabelFromCursorPath(transcriptPath: string): string | undefined {
  // .../projects/<projectKey>/agent-transcripts/<uuid>/<uuid>.jsonl
  const parts = transcriptPath.split(path.sep);
  const i = parts.lastIndexOf('projects');
  if (i >= 0 && parts[i + 1]) {
    return parts[i + 1]
      .replace(/^Users-[^-]+-development-/, '')
      .replace(/^Users-[^-]+-/, '');
  }
  return undefined;
}

function projectLabelFromClaudeDir(dirName: string): string | undefined {
  return dirName
    .replace(/^-Users-[^-]+-development-/, '')
    .replace(/^-Users-[^-]+-/, '')
    .replace(/^-/, '')
    .replace(/-/g, '/')
    .split('/')
    .pop();
}

function listCursorSessions(home: string): RawSession[] {
  const root = path.join(home, '.cursor', 'projects');
  if (!exists(root)) return [];
  const out: RawSession[] = [];
  let projects: string[] = [];
  try {
    projects = fs.readdirSync(root);
  } catch {
    return [];
  }
  for (const project of projects) {
    const transcripts = path.join(root, project, 'agent-transcripts');
    if (!exists(transcripts)) continue;
    let chats: string[] = [];
    try {
      chats = fs.readdirSync(transcripts);
    } catch {
      continue;
    }
    for (const chatId of chats) {
      if (!/^[0-9a-f-]{16,}$/i.test(chatId)) continue;
      const file = path.join(transcripts, chatId, `${chatId}.jsonl`);
      if (!exists(file)) continue;
      let st: fs.Stats;
      try {
        st = fs.statSync(file);
      } catch {
        continue;
      }
      if (Date.now() - st.mtimeMs > MAX_AGE_MS) continue;
      out.push({
        sessionId: chatId,
        parentId: 'cursor',
        title: titleFromCursorJsonl(file),
        project: projectLabelFromCursorPath(file),
        path: file,
        mtime: st.mtimeMs,
      });
    }
  }
  return out;
}

function listClaudeSessions(home: string): RawSession[] {
  const root = path.join(home, '.claude', 'projects');
  if (!exists(root)) return [];
  const out: RawSession[] = [];
  let projects: string[] = [];
  try {
    projects = fs.readdirSync(root);
  } catch {
    return [];
  }

  for (const project of projects) {
    const dir = path.join(root, project);
    let stDir: fs.Stats;
    try {
      stDir = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!stDir.isDirectory()) continue;

    const indexPath = path.join(dir, 'sessions-index.json');
    const indexed = new Map<
      string,
      { firstPrompt?: string; fullPath?: string; fileMtime?: number }
    >();
    if (exists(indexPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as {
          entries?: Array<{
            sessionId: string;
            firstPrompt?: string;
            fullPath?: string;
            fileMtime?: number;
            isSidechain?: boolean;
          }>;
        };
        for (const e of raw.entries || []) {
          if (e.isSidechain) continue;
          indexed.set(e.sessionId, e);
        }
      } catch {
        // ignore
      }
    }

    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const sessionId = file.replace(/\.jsonl$/, '');
      if (!/^[0-9a-f-]{16,}$/i.test(sessionId)) continue;
      const full = path.join(dir, file);
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      const meta = indexed.get(sessionId);
      const mtime = meta?.fileMtime || st.mtimeMs;
      if (Date.now() - mtime > MAX_AGE_MS) continue;
      out.push({
        sessionId,
        parentId: 'claude-code',
        title: titleFromClaudeJsonl(full, meta?.firstPrompt),
        project: projectLabelFromClaudeDir(project),
        path: full,
        mtime,
      });
    }
  }
  return out;
}

function listCodexSessions(home: string): RawSession[] {
  const root = path.join(home, '.codex', 'sessions');
  if (!exists(root)) return [];
  const out: RawSession[] = [];

  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!ent.name.endsWith('.jsonl')) continue;
      const sessionId = ent.name.replace(/\.jsonl$/, '');
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (Date.now() - st.mtimeMs > MAX_AGE_MS) continue;
      out.push({
        sessionId: sessionId.slice(0, 36),
        parentId: 'codex',
        title: cleanTitle(titleFromClaudeJsonl(full) || 'Codex chat'),
        path: full,
        mtime: st.mtimeMs,
      });
    }
  };
  walk(root, 0);
  return out;
}

function toAgent(
  raw: RawSession,
  parent: DiscoveredAgent
): DiscoveredAgent {
  const projectBit = raw.project ? ` · ${raw.project}` : '';
  const name = `${parent.name}: ${raw.title}${projectBit}`;
  const recent = Date.now() - raw.mtime < 36 * 60 * 60 * 1000;
  let presence: DiscoveredAgent['presence'] = 'installed';
  if (parent.presence === 'running' && recent) presence = 'running';
  else if (parent.presence === 'connected') presence = 'connected';

  return {
    id: sessionNodeId(raw.parentId, raw.sessionId),
    name: name.slice(0, 80),
    presence,
    binaryPath: parent.binaryPath,
    version: parent.version,
    homeDir: parent.homeDir,
    sessionDir: path.dirname(raw.path),
    capabilities: parent.capabilities.includes('sessions')
      ? parent.capabilities
      : [...parent.capabilities, 'sessions'],
    signals: [
      ...parent.signals.filter((s) => s.startsWith('process:') || s.startsWith('app:')),
      `session:${raw.sessionId.slice(0, 8)}`,
      `mtime:${new Date(raw.mtime).toISOString()}`,
    ],
    scannedAt: Date.now(),
    kind: 'session',
    parentId: raw.parentId,
    sessionId: raw.sessionId,
    title: raw.title,
    project: raw.project,
    mtime: raw.mtime,
    connected: parent.connected,
  };
}

/** Expand discovered runtimes into conversation nodes (keeps runtimes too). */
export function expandSessionNodes(
  runtimes: DiscoveredAgent[],
  options?: { home?: string; maxPerRuntime?: number }
): DiscoveredAgent[] {
  const home = options?.home ?? os.homedir();
  const max = options?.maxPerRuntime ?? MAX_PER_RUNTIME;
  const byParent = new Map(runtimes.map((a) => [a.id, a]));
  const sessions: DiscoveredAgent[] = [];

  const pushTop = (parentId: string, raws: RawSession[]) => {
    const parent = byParent.get(parentId);
    if (!parent) return;
    raws
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, max)
      .forEach((r) => sessions.push(toAgent(r, parent)));
  };

  if (byParent.has('cursor')) pushTop('cursor', listCursorSessions(home));
  if (byParent.has('claude-code'))
    pushTop('claude-code', listClaudeSessions(home));
  if (byParent.has('codex')) pushTop('codex', listCodexSessions(home));

  // Prefer showing sessions on the fabric; keep runtime parents for MCP wiring.
  return [...runtimes, ...sessions];
}
