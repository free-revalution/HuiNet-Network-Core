/**
 * Shared context / memory types
 */

export type MemoryKind =
  | 'fact'
  | 'decision'
  | 'preference'
  | 'artifact'
  | 'thread_summary';

export type MemoryScope = 'global' | 'project' | 'agent-private';

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  scope: MemoryScope;
  title: string;
  body: string;
  tags: string[];
  project?: string;
  agentId?: string;
  source?: {
    agentId: string;
    path?: string;
    sessionId?: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ContextIndex {
  version: string;
  entries: Array<{
    id: string;
    kind: MemoryKind;
    scope: MemoryScope;
    title: string;
    project?: string;
    agentId?: string;
    updatedAt: number;
    file: string;
  }>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  memories: MemoryEntry[];
}

export interface MigratePackage {
  generatedAt: number;
  targetAgent?: string;
  project?: string;
  markdown: string;
  memories: MemoryEntry[];
}
