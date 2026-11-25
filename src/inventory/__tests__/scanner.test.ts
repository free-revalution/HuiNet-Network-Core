import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentScanner } from '../scanner';
import type { AgentDetector } from '../types';
import type { HuiNetPaths } from '../../paths';

function tempPaths(): HuiNetPaths {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'huinet-test-'));
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

describe('AgentScanner', () => {
  it('runs custom detectors and writes inventory', async () => {
    const paths = tempPaths();
    const fake: AgentDetector = {
      id: 'fake-agent',
      name: 'Fake',
      detect: () => ({
        id: 'fake-agent',
        name: 'Fake',
        presence: 'installed',
        capabilities: ['cli'],
        signals: ['test'],
        scannedAt: Date.now(),
      }),
    };

    const scanner = new AgentScanner({
      paths,
      extraDetectors: [fake],
    });
    // Replace builtins with only fake for isolation
    (scanner as any).detectors = new Map([['fake-agent', fake]]);

    const snap = await scanner.scan();
    expect(snap.agents).toHaveLength(1);
    expect(snap.agents[0].id).toBe('fake-agent');
    expect(fs.existsSync(paths.inventory)).toBe(true);
  });

  it('marks connected agents', async () => {
    const paths = tempPaths();
    const fake: AgentDetector = {
      id: 'x',
      name: 'X',
      detect: () => ({
        id: 'x',
        name: 'X',
        presence: 'installed',
        capabilities: [],
        signals: ['t'],
        scannedAt: Date.now(),
      }),
    };
    const scanner = new AgentScanner({ paths, extraDetectors: [fake] });
    (scanner as any).detectors = new Map([['x', fake]]);
    scanner.setConnected(['x']);
    const snap = await scanner.scan();
    expect(snap.agents[0].presence).toBe('connected');
  });
});
