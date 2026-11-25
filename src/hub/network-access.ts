/**
 * Persist which local agents are open to the A2A fabric
 */

import * as fs from 'fs';
import {
  ensureHuiNetDirs,
  getHuiNetPaths,
  type HuiNetPaths,
} from '../paths';

export interface NetworkAccessState {
  version: string;
  /** agentId → open on A2A bus */
  a2aOpen: Record<string, boolean>;
  updatedAt: number;
}

function accessPath(paths: HuiNetPaths): string {
  return `${paths.root}/network-access.json`;
}

export function loadNetworkAccess(
  paths: HuiNetPaths = getHuiNetPaths()
): NetworkAccessState {
  ensureHuiNetDirs(paths);
  try {
    const raw = fs.readFileSync(accessPath(paths), 'utf-8');
    const data = JSON.parse(raw) as NetworkAccessState;
    return {
      version: '1.0',
      a2aOpen: data.a2aOpen || {},
      updatedAt: data.updatedAt || Date.now(),
    };
  } catch {
    return { version: '1.0', a2aOpen: {}, updatedAt: Date.now() };
  }
}

export function saveNetworkAccess(
  state: NetworkAccessState,
  paths: HuiNetPaths = getHuiNetPaths()
): void {
  ensureHuiNetDirs(paths);
  state.updatedAt = Date.now();
  fs.writeFileSync(accessPath(paths), JSON.stringify(state, null, 2), 'utf-8');
}

export function isA2aOpen(
  agentId: string,
  paths?: HuiNetPaths
): boolean {
  const state = loadNetworkAccess(paths);
  return Boolean(state.a2aOpen[agentId]);
}

export function setA2aOpen(
  agentId: string,
  open: boolean,
  paths?: HuiNetPaths
): NetworkAccessState {
  const p = paths ?? getHuiNetPaths();
  const state = loadNetworkAccess(p);
  if (open) state.a2aOpen[agentId] = true;
  else delete state.a2aOpen[agentId];
  saveNetworkAccess(state, p);
  return state;
}

export function setManyA2aOpen(
  updates: Record<string, boolean>,
  paths?: HuiNetPaths
): NetworkAccessState {
  const p = paths ?? getHuiNetPaths();
  const state = loadNetworkAccess(p);
  for (const [id, open] of Object.entries(updates)) {
    if (open) state.a2aOpen[id] = true;
    else delete state.a2aOpen[id];
  }
  saveNetworkAccess(state, p);
  return state;
}
