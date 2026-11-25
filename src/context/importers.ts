/**
 * Read-only session importers → Context Hub memories
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createContextStore, type ContextStore } from './store';
import type { ImportResult, MemoryEntry } from './types';

export type ImportSource = 'claude' | 'codex' | 'cursor';

export interface ImportOptions {
  from: ImportSource;
  project?: string;
  limit?: number;
  store?: ContextStore;
}

function walkFiles(root: string, pred: (f: string) => boolean): string[] {
  const out: string[] = [];
  if (!fs.existsSync(root)) return out;

  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && pred(full)) out.push(full);
    }
  }
  return out;
}

function summarizeText(text: string, max = 800): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max) + '…';
}

function extractContent(row: Record<string, unknown>): string {
  let content =
    (row.content as string) ||
    ((row.message as Record<string, unknown>)?.content as string) ||
    (row.text as string) ||
    '';

  if (Array.isArray(content)) {
    content = content
      .map((c: unknown) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && 'text' in (c as object)) {
          return String((c as { text: string }).text);
        }
        return '';
      })
      .join('\n');
  }
  return typeof content === 'string' ? content : '';
}

function extractUserAssistantPairs(
  lines: Array<Record<string, unknown>>
): { title: string; body: string; highlights: string[] } | null {
  const userMsgs: string[] = [];
  const assistantMsgs: string[] = [];

  for (const row of lines) {
    const role =
      (row.role as string) ||
      (row.type as string) ||
      ((row.message as Record<string, unknown>)?.role as string);
    const content = extractContent(row);
    if (!content) continue;
    const r = (role || '').toLowerCase();
    if (r.includes('user') || r === 'human' || r === 'user_message') {
      userMsgs.push(content);
    }
    if (
      r.includes('assistant') ||
      r === 'ai' ||
      r === 'assistant_message' ||
      r.includes('agent')
    ) {
      assistantMsgs.push(content);
    }
  }

  if (userMsgs.length === 0 && assistantMsgs.length === 0) return null;

  const title = summarizeText(userMsgs[0] || assistantMsgs[0] || 'Session', 80);
  const lastUser = userMsgs[userMsgs.length - 1];
  const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
  const highlights = pickHighlights([...userMsgs, ...assistantMsgs]);

  const body = [
    userMsgs[0] ? `First user: ${summarizeText(userMsgs[0], 350)}` : '',
    lastUser && lastUser !== userMsgs[0]
      ? `Latest user: ${summarizeText(lastUser, 350)}`
      : '',
    lastAssistant
      ? `Latest assistant: ${summarizeText(lastAssistant, 450)}`
      : '',
    highlights.length
      ? `Highlights:\n- ${highlights.map((h) => summarizeText(h, 160)).join('\n- ')}`
      : '',
    `Turns: ~${Math.max(userMsgs.length, assistantMsgs.length)}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { title, body, highlights };
}

function pickHighlights(texts: string[]): string[] {
  const keywords =
    /\b(decid(?:e|ed|ing)|we should|let's|必须|决定|方案|改用|改成|prefer|instead of|do not|不要|迁移|refactor)\b/i;
  const out: string[] = [];
  for (const t of texts) {
    if (keywords.test(t)) {
      out.push(t);
      if (out.length >= 3) break;
    }
  }
  return out;
}

/** Claude stores project dirs like -Users-name-dev-HuiNet */
function inferProjectFromPath(filePath: string): string | undefined {
  const parts = filePath.split(path.sep);
  const projectsIdx = parts.findIndex((p) => p === 'projects');
  if (projectsIdx >= 0 && parts[projectsIdx + 1]) {
    const raw = parts[projectsIdx + 1];
    const slug = raw
      .replace(/^-/, '')
      .split('-')
      .slice(-2)
      .join('-')
      .toLowerCase();
    if (slug && slug.length > 1) return slug.slice(0, 64);
  }
  return undefined;
}

function importClaudeJsonl(
  store: ContextStore,
  project?: string,
  limit = 20
): ImportResult {
  const root = path.join(os.homedir(), '.claude', 'projects');
  const files = walkFiles(root, (f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, mtime: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  const memories: MemoryEntry[] = [];
  let skipped = 0;

  for (const { f } of files) {
    try {
      const rows = fs
        .readFileSync(f, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
      const summary = extractUserAssistantPairs(rows);
      if (!summary) {
        skipped++;
        continue;
      }
      const projectSlug = project || inferProjectFromPath(f);
      const entry = store.upsert({
        kind: 'thread_summary',
        scope: projectSlug ? 'project' : 'global',
        project: projectSlug,
        title: summary.title,
        body: summary.body,
        tags: ['import', 'claude-code', ...(summary.highlights.length ? ['has-highlights'] : [])],
        agentId: 'claude-code',
        source: { agentId: 'claude-code', path: f },
      });
      memories.push(entry);

      for (const h of summary.highlights.slice(0, 2)) {
        memories.push(
          store.upsert({
            kind: 'decision',
            scope: projectSlug ? 'project' : 'global',
            project: projectSlug,
            title: summarizeText(h, 60),
            body: summarizeText(h, 500),
            tags: ['import', 'claude-code', 'auto-highlight'],
            agentId: 'claude-code',
            source: { agentId: 'claude-code', path: f },
          })
        );
      }
    } catch {
      skipped++;
    }
  }

  return { imported: memories.length, skipped, memories };
}

function importCodexJsonl(
  store: ContextStore,
  project?: string,
  limit = 20
): ImportResult {
  const root = path.join(os.homedir(), '.codex', 'sessions');
  const files = walkFiles(
    root,
    (f) => f.includes('rollout-') && f.endsWith('.jsonl')
  )
    .map((f) => ({ f, mtime: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  const memories: MemoryEntry[] = [];
  let skipped = 0;

  for (const { f } of files) {
    try {
      const rows = fs
        .readFileSync(f, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
      const summary = extractUserAssistantPairs(rows);
      if (!summary) {
        skipped++;
        continue;
      }
      const entry = store.upsert({
        kind: 'thread_summary',
        scope: project ? 'project' : 'global',
        project,
        title: summary.title,
        body: summary.body,
        tags: [
          'import',
          'codex',
          ...(summary.highlights.length ? ['has-highlights'] : []),
        ],
        agentId: 'codex',
        source: { agentId: 'codex', path: f },
      });
      memories.push(entry);
      for (const h of summary.highlights.slice(0, 2)) {
        memories.push(
          store.upsert({
            kind: 'decision',
            scope: project ? 'project' : 'global',
            project,
            title: summarizeText(h, 60),
            body: summarizeText(h, 500),
            tags: ['import', 'codex', 'auto-highlight'],
            agentId: 'codex',
            source: { agentId: 'codex', path: f },
          })
        );
      }
    } catch {
      skipped++;
    }
  }

  return { imported: memories.length, skipped, memories };
}

function importCursor(
  store: ContextStore,
  project?: string,
  limit = 20
): ImportResult {
  const memories: MemoryEntry[] = [];
  let skipped = 0;
  const home = os.homedir();

  // Prefer CLI agent-transcripts JSONL if present
  const projectsRoot = path.join(home, '.cursor', 'projects');
  const jsonlFiles = walkFiles(projectsRoot, (f) =>
    f.includes('agent-transcripts') && f.endsWith('.jsonl')
  )
    .map((f) => ({ f, mtime: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  for (const { f } of jsonlFiles) {
    try {
      const rows = fs
        .readFileSync(f, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
      const summary = extractUserAssistantPairs(rows);
      if (!summary) {
        skipped++;
        continue;
      }
      memories.push(
        store.upsert({
          kind: 'thread_summary',
          scope: project ? 'project' : 'global',
          project,
          title: summary.title,
          body: summary.body,
          tags: ['import', 'cursor'],
          agentId: 'cursor',
          source: { agentId: 'cursor', path: f },
        })
      );
    } catch {
      skipped++;
    }
  }

  if (memories.length > 0) {
    return { imported: memories.length, skipped, memories };
  }

  // Fallback: note presence of IDE sqlite without deep parse if node:sqlite unavailable
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (path: string, opts?: { readOnly?: boolean }) => {
        prepare: (sql: string) => {
          all: (...params: unknown[]) => unknown[];
        };
        close: () => void;
      };
    };

    const candidates = [
      path.join(
        home,
        'Library/Application Support/Cursor/User/globalStorage/state.vscdb'
      ),
      path.join(home, '.config/Cursor/User/globalStorage/state.vscdb'),
    ];

    for (const dbPath of candidates) {
      if (!fs.existsSync(dbPath)) continue;
      try {
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const rows = db
          .prepare(
            `SELECT key FROM cursorDiskKV WHERE key LIKE 'composerData:%' LIMIT ?`
          )
          .all(limit) as Array<{ key: string }>;
        for (const row of rows) {
          memories.push(
            store.upsert({
              kind: 'thread_summary',
              scope: project ? 'project' : 'global',
              project,
              title: `Cursor composer ${row.key.slice(0, 40)}`,
              body: `Imported Cursor composer key reference: ${row.key}. Open Cursor to view full transcript.`,
              tags: ['import', 'cursor', 'sqlite'],
              agentId: 'cursor',
              source: { agentId: 'cursor', path: dbPath, sessionId: row.key },
            })
          );
        }
        db.close();
        break;
      } catch {
        skipped++;
      }
    }
  } catch {
    // node:sqlite not available
    skipped++;
  }

  return { imported: memories.length, skipped, memories };
}

export async function importSessions(
  options: ImportOptions
): Promise<ImportResult> {
  const store = options.store ?? createContextStore();
  const limit = options.limit ?? 20;
  switch (options.from) {
    case 'claude':
      return importClaudeJsonl(store, options.project, limit);
    case 'codex':
      return importCodexJsonl(store, options.project, limit);
    case 'cursor':
      return importCursor(store, options.project, limit);
    default:
      throw new Error(`Unknown import source: ${options.from}`);
  }
}
