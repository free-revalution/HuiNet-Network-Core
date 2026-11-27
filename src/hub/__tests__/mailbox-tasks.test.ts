import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createMailbox } from '../mailbox';
import { createTaskBoard } from '../tasks';
import { getHuiNetPaths, ensureHuiNetDirs } from '../../paths';
import type { BusMessage } from '../bus';

function tmpPaths() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huinet-test-'));
  const paths = getHuiNetPaths(home);
  ensureHuiNetDirs(paths);
  return paths;
}

describe('mailbox', () => {
  it('deposits and marks read', () => {
    const paths = tmpPaths();
    const box = createMailbox(paths);
    const msg: BusMessage = {
      id: 'm1',
      from: 'ui',
      to: 'claude-code',
      type: 'chat',
      payload: { text: 'hi' },
      tokens: 1,
      timestamp: Date.now(),
    };
    box.deposit(msg, ['claude-code', 'cursor']);
    expect(box.list('claude-code')).toHaveLength(1);
    expect(box.unreadCount('claude-code')).toBe(1);
    const id = box.list('claude-code')[0].id;
    expect(box.markRead([id], 'claude-code')).toBe(1);
    expect(box.unreadCount('claude-code')).toBe(0);
  });
});

describe('tasks', () => {
  it('creates and completes a task', () => {
    const paths = tmpPaths();
    const board = createTaskBoard(paths);
    const task = board.create({
      from: 'ui',
      to: 'codex',
      title: 'Fix lint',
      description: 'run eslint',
    });
    expect(task.status).toBe('pending');
    expect(board.summary().open).toBe(1);
    const done = board.complete(task.id, { ok: true });
    expect(done.status).toBe('completed');
    expect(board.summary().completed).toBe(1);
  });
});
