import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { HuiNetPaths } from '../../paths';
import {
  isA2aOpen,
  loadNetworkAccess,
  setA2aOpen,
  setManyA2aOpen,
} from '../network-access';

function tempPaths(): HuiNetPaths {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'huinet-access-'));
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

describe('network access', () => {
  it('toggles a2a open state', () => {
    const paths = tempPaths();
    expect(isA2aOpen('claude-code', paths)).toBe(false);
    setA2aOpen('claude-code', true, paths);
    expect(isA2aOpen('claude-code', paths)).toBe(true);
    setA2aOpen('claude-code', false, paths);
    expect(isA2aOpen('claude-code', paths)).toBe(false);
  });

  it('bulk updates', () => {
    const paths = tempPaths();
    setManyA2aOpen({ cursor: true, codex: true }, paths);
    const state = loadNetworkAccess(paths);
    expect(state.a2aOpen.cursor).toBe(true);
    expect(state.a2aOpen.codex).toBe(true);
  });
});
