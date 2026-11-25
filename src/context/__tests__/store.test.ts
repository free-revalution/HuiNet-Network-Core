import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ContextStore } from '../store';
import type { HuiNetPaths } from '../../paths';

function tempPaths(): HuiNetPaths {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'huinet-ctx-'));
  const contextDir = path.join(root, 'context');
  return {
    root,
    config: path.join(root, 'config.json'),
    agents: path.join(root, 'agents.yaml'),
    inventory: path.join(root, 'inventory.json'),
    contextDir,
    memoriesDir: path.join(contextDir, 'memories'),
    projectsDir: path.join(contextDir, 'projects'),
    contextIndex: path.join(contextDir, 'index.json'),
    daemonPid: path.join(root, 'daemon.pid'),
    daemonSock: path.join(root, 'huinet.sock'),
    tokenFile: path.join(root, 'token'),
    busLog: path.join(root, 'bus.log'),
  };
}

describe('ContextStore', () => {
  it('upserts, searches, and migrates', () => {
    const store = new ContextStore(tempPaths());
    const a = store.upsert({
      kind: 'fact',
      scope: 'global',
      title: 'Preferred stack',
      body: 'Use TypeScript and local hub',
      tags: ['stack'],
    });
    expect(a.id).toBeTruthy();

    const found = store.search('TypeScript');
    expect(found.length).toBe(1);

    const pkg = store.migrate({ targetAgent: 'claude-code' });
    expect(pkg.markdown).toContain('Preferred stack');
    expect(pkg.memories.length).toBe(1);
  });

  it('scopes project memories', () => {
    const store = new ContextStore(tempPaths());
    store.upsert({
      kind: 'decision',
      scope: 'project',
      project: 'huinet',
      title: 'Local only',
      body: 'No cross-machine P2P',
      tags: [],
    });
    expect(store.list({ project: 'huinet' })).toHaveLength(1);
    expect(store.list({ project: 'other' })).toHaveLength(0);
  });
});
