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

function extractUserAssistantPairs(
  lines: Array<Record<string, unknown>>
): { title: string; body: string } | null {
  const userMsgs: string[] = [];
  const assistantMsgs: string[] = [];

  for (const row of lines) {
    const role =
      (row.role as string) ||
      (row.type as string) ||
      ((row.message as Record<string, unknown>)?.role as string);
    let content =
      (row.content as string) ||
      ((row.message as Record<string, unknown>)?.content as string) ||
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

    if (!content || typeof content !== 'string') continue;
    const r = (role || '').toLowerCase();
    if (r.includes('user') || r === 'human') userMsgs.push(content);
    if (r.includes('assistant') || r === 'ai') assistantMsgs.push(content);
  }

  if (userMsgs.length === 0 && assistantMsgs.length === 0) return null;

  const title = summarizeText(userMsgs[0] || assistantMsgs[0] || 'Session', 80);
  const body = [
    userMsgs[0] ? `User: ${summarizeText(userMsgs[0], 400)}` : '',
    assistantMsgs[0]
      ? `Assistant: ${summarizeText(assistantMsgs[0], 400)}`
      : '',
    `Turns: ~${Math.max(userMsgs.length, assistantMsgs.length)}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { title, body };
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
      const entry = store.upsert({
        kind: 'thread_summary',
        scope: project ? 'project' : 'global',
        project,
        title: summary.title,
        body: summary.body,
        tags: ['import', 'claude-code'],
        agentId: 'claude-code',
        source: { agentId: 'claude-code', path: f },
      });
      memories.push(entry);
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
        tags: ['import', 'codex'],
        agentId: 'codex',
        source: { agentId: 'codex', path: f },
      });
      memories.push(entry);
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
