import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  expandSessionNodes,
  parseSessionNodeId,
  sessionNodeId,
} from '../sessions';
import type { DiscoveredAgent } from '../types';

function runtime(id: string, name: string): DiscoveredAgent {
  return {
    id,
    name,
    presence: 'running',
    capabilities: ['sessions', 'mcp'],
    signals: ['process:running'],
    scannedAt: Date.now(),
    kind: 'runtime',
  };
}

describe('session nodes', () => {
  it('parses session ids', () => {
    expect(sessionNodeId('cursor', 'abc')).toBe('cursor:session:abc');
    expect(parseSessionNodeId('cursor:session:abc')).toEqual({
      parentId: 'cursor',
      sessionId: 'abc',
    });
    expect(parseSessionNodeId('cursor')).toBeNull();
  });

  it('expands cursor + claude conversation folders', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'huinet-sess-'));
    const chatId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const cursorFile = path.join(
      home,
      '.cursor/projects/Users-jiang-development-Demo/agent-transcripts',
      chatId,
      `${chatId}.jsonl`
    );
    fs.mkdirSync(path.dirname(cursorFile), { recursive: true });
    fs.writeFileSync(
      cursorFile,
      JSON.stringify({
        role: 'user',
        message: {
          content: [
            {
              type: 'text',
              text: '<user_query>Build the fabric graph</user_query>',
            },
          ],
        },
      }) + '\n'
    );

    const claudeId = '11111111-2222-3333-4444-555555555555';
    const claudeDir = path.join(
      home,
      '.claude/projects/-Users-jiang-development-Demo'
    );
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, `${claudeId}.jsonl`),
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Refactor detectors' }],
        },
      }) + '\n'
    );

    const agents = expandSessionNodes(
      [runtime('cursor', 'Cursor'), runtime('claude-code', 'Claude Code')],
      { home }
    );

    const sessions = agents.filter((a) => a.kind === 'session');
    expect(sessions.length).toBe(2);
    expect(sessions.some((s) => s.parentId === 'cursor')).toBe(true);
    expect(sessions.some((s) => s.parentId === 'claude-code')).toBe(true);
    expect(sessions.find((s) => s.parentId === 'cursor')?.title).toMatch(
      /fabric graph/i
    );
    expect(agents.some((a) => a.id === 'cursor')).toBe(true);
  });
});
