/**
 * Context Hub — durable memory store under ~/.huinet/context
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  ensureHuiNetDirs,
  getHuiNetPaths,
  type HuiNetPaths,
} from '../paths';
import type {
  ContextIndex,
  MemoryEntry,
  MemoryKind,
  MemoryScope,
  MigratePackage,
} from './types';

export class ContextStore {
  private paths: HuiNetPaths;

  constructor(paths?: HuiNetPaths) {
    this.paths = paths ?? getHuiNetPaths();
    ensureHuiNetDirs(this.paths);
    this.ensureIndex();
  }

  private ensureIndex(): void {
    if (!fs.existsSync(this.paths.contextIndex)) {
      const index: ContextIndex = { version: '1.0', entries: [] };
      fs.writeFileSync(
        this.paths.contextIndex,
        JSON.stringify(index, null, 2),
        'utf-8'
      );
    }
  }

  private readIndex(): ContextIndex {
    this.ensureIndex();
    return JSON.parse(
      fs.readFileSync(this.paths.contextIndex, 'utf-8')
    ) as ContextIndex;
  }

  private writeIndex(index: ContextIndex): void {
    fs.writeFileSync(
      this.paths.contextIndex,
      JSON.stringify(index, null, 2),
      'utf-8'
    );
  }

  private fileFor(entry: MemoryEntry): string {
    const dir =
      entry.scope === 'project' && entry.project
        ? path.join(this.paths.projectsDir, sanitize(entry.project))
        : this.paths.memoriesDir;
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${entry.id}.json`);
  }

  upsert(
    input: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ): MemoryEntry {
    const now = Date.now();
    const id =
      input.id ??
      crypto.createHash('sha256')
        .update(`${input.kind}:${input.title}:${input.body}:${input.project ?? ''}`)
        .digest('hex')
        .slice(0, 16);

    const existingPath = this.lookupFile(id);
    let createdAt = now;
    if (existingPath && fs.existsSync(existingPath)) {
      try {
        const prev = JSON.parse(
          fs.readFileSync(existingPath, 'utf-8')
        ) as MemoryEntry;
        createdAt = prev.createdAt;
      } catch {
        // ignore
      }
    }

    const entry: MemoryEntry = {
      id,
      kind: input.kind,
      scope: input.scope,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      project: input.project,
      agentId: input.agentId,
      source: input.source,
      createdAt,
      updatedAt: now,
    };

    const file = this.fileFor(entry);
    fs.writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8');

    const index = this.readIndex();
    const meta = {
      id: entry.id,
      kind: entry.kind,
      scope: entry.scope,
      title: entry.title,
      project: entry.project,
      agentId: entry.agentId,
      updatedAt: entry.updatedAt,
      file,
    };
    const idx = index.entries.findIndex((e) => e.id === id);
    if (idx >= 0) index.entries[idx] = meta;
    else index.entries.push(meta);
    this.writeIndex(index);

    return entry;
  }

  private lookupFile(id: string): string | undefined {
    const index = this.readIndex();
    return index.entries.find((e) => e.id === id)?.file;
  }

  get(id: string): MemoryEntry | null {
    const file = this.lookupFile(id);
    if (!file || !fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as MemoryEntry;
  }

  list(filter?: {
    project?: string;
    kind?: MemoryKind;
    scope?: MemoryScope;
    agentId?: string;
    limit?: number;
  }): MemoryEntry[] {
    const index = this.readIndex();
    let metas = index.entries;
    if (filter?.project) {
      metas = metas.filter((e) => e.project === filter.project);
    }
    if (filter?.kind) {
      metas = metas.filter((e) => e.kind === filter.kind);
    }
    if (filter?.scope) {
      metas = metas.filter((e) => e.scope === filter.scope);
    }
    if (filter?.agentId) {
      metas = metas.filter((e) => e.agentId === filter.agentId);
    }
    metas = metas.sort((a, b) => b.updatedAt - a.updatedAt);
    if (filter?.limit) metas = metas.slice(0, filter.limit);

    const out: MemoryEntry[] = [];
    for (const m of metas) {
      if (fs.existsSync(m.file)) {
        out.push(JSON.parse(fs.readFileSync(m.file, 'utf-8')) as MemoryEntry);
      }
    }
    return out;
  }

  search(query: string, limit = 20): MemoryEntry[] {
    const q = query.toLowerCase();
    return this.list({ limit: 500 })
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, limit);
  }

  delete(id: string): boolean {
    const index = this.readIndex();
    const meta = index.entries.find((e) => e.id === id);
    if (!meta) return false;
    if (fs.existsSync(meta.file)) fs.unlinkSync(meta.file);
    index.entries = index.entries.filter((e) => e.id !== id);
    this.writeIndex(index);
    return true;
  }

  migrate(options?: {
    project?: string;
    targetAgent?: string;
    limit?: number;
  }): MigratePackage {
    const memories = this.list({
      project: options?.project,
      limit: options?.limit ?? 50,
    });
    // Also include global if project filter set
    const globals = options?.project
      ? this.list({ scope: 'global', limit: 20 })
      : [];
    const merged = dedupeById([...memories, ...globals]);

    const lines = [
      `# HuiNet Context Package`,
      ``,
      `Generated: ${new Date().toISOString()}`,
      options?.targetAgent ? `Target: ${options.targetAgent}` : '',
      options?.project ? `Project: ${options.project}` : '',
      ``,
      `Use the following shared context from HuiNet when continuing work.`,
      ``,
    ].filter(Boolean);

    for (const m of merged) {
      lines.push(`## [${m.kind}] ${m.title}`);
      lines.push(m.body);
      if (m.tags.length) lines.push(`Tags: ${m.tags.join(', ')}`);
      lines.push('');
    }

    return {
      generatedAt: Date.now(),
      targetAgent: options?.targetAgent,
      project: options?.project,
      markdown: lines.join('\n'),
      memories: merged,
    };
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
}

function dedupeById(entries: MemoryEntry[]): MemoryEntry[] {
  const map = new Map<string, MemoryEntry>();
  for (const e of entries) map.set(e.id, e);
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createContextStore(paths?: HuiNetPaths): ContextStore {
  return new ContextStore(paths);
}
