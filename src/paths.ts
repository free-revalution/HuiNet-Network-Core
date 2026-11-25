/**
 * HuiNet local paths under ~/.huinet
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const DEFAULT_HTTP_PORT = 19527;
export const DEFAULT_WS_PORT = 19528;

export interface HuiNetPaths {
  root: string;
  config: string;
  agents: string;
  inventory: string;
  contextDir: string;
  memoriesDir: string;
  projectsDir: string;
  contextIndex: string;
  daemonPid: string;
  daemonSock: string;
  tokenFile: string;
  busLog: string;
}

export function getHuiNetPaths(home = os.homedir()): HuiNetPaths {
  const root = path.join(home, '.huinet');
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

export function ensureHuiNetDirs(paths: HuiNetPaths = getHuiNetPaths()): HuiNetPaths {
  for (const dir of [paths.root, paths.contextDir, paths.memoriesDir, paths.projectsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return paths;
}

export interface HubConfig {
  version: string;
  httpPort: number;
  wsPort: number;
  host: string;
}

export const DEFAULT_HUB_CONFIG: HubConfig = {
  version: '2.0.0',
  httpPort: DEFAULT_HTTP_PORT,
  wsPort: DEFAULT_WS_PORT,
  host: '127.0.0.1',
};

export function loadHubConfig(paths: HuiNetPaths = getHuiNetPaths()): HubConfig {
  try {
    const raw = fs.readFileSync(paths.config, 'utf-8');
    return { ...DEFAULT_HUB_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_HUB_CONFIG };
  }
}

export function saveHubConfig(
  config: HubConfig,
  paths: HuiNetPaths = getHuiNetPaths()
): void {
  ensureHuiNetDirs(paths);
  fs.writeFileSync(paths.config, JSON.stringify(config, null, 2), 'utf-8');
}
