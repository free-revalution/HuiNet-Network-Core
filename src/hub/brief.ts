/**
 * Fabric Brief — pinned working set for agents on this machine.
 * Inspired by local-first shared memory demand (e.g. SuperLocalMemory-class tools).
 */

import * as fs from 'fs';
import type { HuiNetPaths } from '../paths';
import type { ContextStore } from '../context';

export interface BriefPin {
  memoryId: string;
  pinnedAt: number;
  pinnedBy: string;
  note?: string;
}

export interface FabricBrief {
  updatedAt: number;
  pins: BriefPin[];
  memories: Array<{
    id: string;
    kind: string;
    title: string;
    body: string;
    tags: string[];
    project?: string;
    pinnedAt: number;
    pinnedBy: string;
    note?: string;
  }>;
  markdown: string;
  project?: string;
}

interface BriefState {
  pins: BriefPin[];
  updatedAt: number;
}

const MAX_PINS = 24;

function briefPath(paths: HuiNetPaths): string {
  return `${paths.root}/brief.json`;
}

function load(paths: HuiNetPaths): BriefState {
  try {
    const raw = fs.readFileSync(briefPath(paths), 'utf-8');
    const parsed = JSON.parse(raw) as BriefState;
    if (Array.isArray(parsed.pins)) return parsed;
  } catch {
    // ignore
  }
  return { pins: [], updatedAt: 0 };
}

function save(state: BriefState, paths: HuiNetPaths): void {
  fs.mkdirSync(paths.root, { recursive: true });
  fs.writeFileSync(briefPath(paths), JSON.stringify(state, null, 2), 'utf-8');
}

export class FabricBriefStore {
  constructor(
    private paths: HuiNetPaths,
    private context: ContextStore
  ) {}

  pin(memoryId: string, pinnedBy = 'ui', note?: string): FabricBrief {
    const mem = this.context.get(memoryId);
    if (!mem) throw new Error(`Memory not found: ${memoryId}`);
    const state = load(this.paths);
    state.pins = state.pins.filter((p) => p.memoryId !== memoryId);
    state.pins.unshift({
      memoryId,
      pinnedAt: Date.now(),
      pinnedBy,
      note,
    });
    if (state.pins.length > MAX_PINS) state.pins.length = MAX_PINS;
    state.updatedAt = Date.now();
    save(state, this.paths);
    return this.get();
  }

  unpin(memoryId: string): FabricBrief {
    const state = load(this.paths);
    state.pins = state.pins.filter((p) => p.memoryId !== memoryId);
    state.updatedAt = Date.now();
    save(state, this.paths);
    return this.get();
  }

  clear(): FabricBrief {
    save({ pins: [], updatedAt: Date.now() }, this.paths);
    return this.get();
  }

  get(filter?: { project?: string }): FabricBrief {
    const state = load(this.paths);
    const memories: FabricBrief['memories'] = [];
    for (const pin of state.pins) {
      const mem = this.context.get(pin.memoryId);
      if (!mem) continue;
      if (
        filter?.project &&
        mem.project &&
        mem.project !== filter.project &&
        mem.scope !== 'global'
      ) {
        continue;
      }
      memories.push({
        id: mem.id,
        kind: mem.kind,
        title: mem.title,
        body: mem.body,
        tags: mem.tags || [],
        project: mem.project,
        pinnedAt: pin.pinnedAt,
        pinnedBy: pin.pinnedBy,
        note: pin.note,
      });
    }
    const markdown = this.renderMarkdown(
      memories,
      state.updatedAt,
      filter?.project
    );
    return {
      updatedAt: state.updatedAt,
      pins: state.pins,
      memories,
      markdown,
      project: filter?.project,
    };
  }

  private renderMarkdown(
    memories: FabricBrief['memories'],
    updatedAt: number,
    project?: string
  ): string {
    const lines = [
      '# HuiNet Fabric Brief',
      '',
      `_Working set for agents on this machine · updated ${
        updatedAt ? new Date(updatedAt).toISOString() : 'never'
      }_`,
    ];
    if (project) lines.push(`_Project scope: \`${project}\`_`);
    lines.push('');
    if (!memories.length) {
      lines.push('_No pinned context yet. Pin facts/decisions from the memory hub._');
      return lines.join('\n');
    }
    for (const m of memories) {
      lines.push(`## ${m.title}`);
      lines.push(
        `_${m.kind}_ · pinned by \`${m.pinnedBy}\`${
          m.project ? ` · project \`${m.project}\`` : ''
        }`
      );
      if (m.note) lines.push(`> ${m.note}`);
      lines.push('');
      lines.push(m.body);
      lines.push('');
    }
    return lines.join('\n');
  }
}

export function createFabricBrief(
  paths: HuiNetPaths,
  context: ContextStore
): FabricBriefStore {
  return new FabricBriefStore(paths, context);
}
