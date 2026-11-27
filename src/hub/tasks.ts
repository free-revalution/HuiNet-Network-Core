/**
 * Lightweight fabric tasks — A2A task lifecycle without a team issue board.
 */

import * as fs from 'fs';
import type { HuiNetPaths } from '../paths';

export type TaskStatus =
  | 'pending'
  | 'accepted'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface FabricTask {
  id: string;
  from: string;
  to: string;
  title: string;
  description?: string;
  status: TaskStatus;
  result?: unknown;
  error?: string;
  messageId?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface TaskState {
  tasks: FabricTask[];
}

const MAX_TASKS = 200;

function tasksPath(paths: HuiNetPaths): string {
  return `${paths.root}/tasks.json`;
}

function load(paths: HuiNetPaths): TaskState {
  try {
    const raw = fs.readFileSync(tasksPath(paths), 'utf-8');
    const parsed = JSON.parse(raw) as TaskState;
    if (Array.isArray(parsed.tasks)) return parsed;
  } catch {
    // ignore
  }
  return { tasks: [] };
}

function save(state: TaskState, paths: HuiNetPaths): void {
  fs.mkdirSync(paths.root, { recursive: true });
  fs.writeFileSync(tasksPath(paths), JSON.stringify(state, null, 2), 'utf-8');
}

function newId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class TaskBoard {
  constructor(private paths: HuiNetPaths) {}

  create(input: {
    from: string;
    to: string;
    title: string;
    description?: string;
    messageId?: string;
  }): FabricTask {
    const now = Date.now();
    const task: FabricTask = {
      id: newId(),
      from: input.from,
      to: input.to,
      title: input.title,
      description: input.description,
      status: 'pending',
      messageId: input.messageId,
      createdAt: now,
      updatedAt: now,
    };
    const state = load(this.paths);
    state.tasks.unshift(task);
    if (state.tasks.length > MAX_TASKS) state.tasks.length = MAX_TASKS;
    save(state, this.paths);
    return task;
  }

  get(id: string): FabricTask | undefined {
    return load(this.paths).tasks.find((t) => t.id === id);
  }

  list(filter?: {
    to?: string;
    from?: string;
    status?: TaskStatus | TaskStatus[];
    limit?: number;
  }): FabricTask[] {
    const statuses = filter?.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null;
    return load(this.paths)
      .tasks.filter((t) => (filter?.to ? t.to === filter.to : true))
      .filter((t) => (filter?.from ? t.from === filter.from : true))
      .filter((t) => (statuses ? statuses.includes(t.status) : true))
      .slice(0, filter?.limit ?? 50);
  }

  update(
    id: string,
    patch: Partial<
      Pick<FabricTask, 'status' | 'result' | 'error' | 'title' | 'description'>
    >
  ): FabricTask {
    const state = load(this.paths);
    const task = state.tasks.find((t) => t.id === id);
    if (!task) throw new Error(`Task not found: ${id}`);
    if (patch.status !== undefined) task.status = patch.status;
    if (patch.result !== undefined) task.result = patch.result;
    if (patch.error !== undefined) task.error = patch.error;
    if (patch.title !== undefined) task.title = patch.title;
    if (patch.description !== undefined) task.description = patch.description;
    task.updatedAt = Date.now();
    if (
      patch.status === 'completed' ||
      patch.status === 'failed' ||
      patch.status === 'cancelled'
    ) {
      task.completedAt = task.updatedAt;
    }
    save(state, this.paths);
    return task;
  }

  complete(id: string, result?: unknown): FabricTask {
    return this.update(id, { status: 'completed', result });
  }

  fail(id: string, error: string): FabricTask {
    return this.update(id, { status: 'failed', error });
  }

  summary(): { open: number; completed: number; failed: number } {
    const tasks = load(this.paths).tasks;
    return {
      open: tasks.filter((t) =>
        ['pending', 'accepted', 'running'].includes(t.status)
      ).length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
    };
  }
}

export function createTaskBoard(paths: HuiNetPaths): TaskBoard {
  return new TaskBoard(paths);
}
