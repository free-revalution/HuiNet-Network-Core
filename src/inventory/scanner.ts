/**
 * Local agent inventory scanner
 */

import * as fs from 'fs';
import {
  ensureHuiNetDirs,
  getHuiNetPaths,
  type HuiNetPaths,
} from '../paths';
import { getDetectorRegistry } from './detectors';
import type {
  AgentDetector,
  DiscoveredAgent,
  InventorySnapshot,
} from './types';

export class AgentScanner {
  private detectors: Map<string, AgentDetector>;
  private paths: HuiNetPaths;
  private connectedIds = new Set<string>();

  constructor(options?: {
    paths?: HuiNetPaths;
    extraDetectors?: AgentDetector[];
  }) {
    this.paths = options?.paths ?? getHuiNetPaths();
    this.detectors = getDetectorRegistry(options?.extraDetectors ?? []);
  }

  registerDetector(detector: AgentDetector): void {
    this.detectors.set(detector.id, detector);
  }

  setConnected(agentIds: string[]): void {
    this.connectedIds = new Set(agentIds);
  }

  async scan(): Promise<InventorySnapshot> {
    ensureHuiNetDirs(this.paths);
    const agents: DiscoveredAgent[] = [];

    for (const detector of this.detectors.values()) {
      try {
        const result = await detector.detect();
        if (result) {
          if (this.connectedIds.has(result.id)) {
            result.presence = 'connected';
            result.connected = true;
          }
          agents.push(result);
        }
      } catch (err) {
        // Skip failing detectors
        console.warn(
          `Detector ${detector.id} failed:`,
          (err as Error).message
        );
      }
    }

    // Merge manual agents from agents.yaml-style JSON sidecar if present
    try {
      const manualPath = this.paths.agents;
      if (fs.existsSync(manualPath)) {
        const content = fs.readFileSync(manualPath, 'utf-8');
        const manual = parseManualAgents(content);
        for (const m of manual) {
          const existing = agents.find((a) => a.id === m.id);
          if (existing) {
            existing.manual = true;
            if (m.binaryPath) existing.binaryPath = m.binaryPath;
            if (m.name) existing.name = m.name;
          } else {
            agents.push({
              id: m.id,
              name: m.name || m.id,
              presence: m.binaryPath ? 'installed' : 'unknown',
              binaryPath: m.binaryPath,
              capabilities: ['cli'],
              signals: ['manual'],
              scannedAt: Date.now(),
              manual: true,
            });
          }
        }
      }
    } catch {
      // ignore parse errors
    }

    agents.sort((a, b) => a.name.localeCompare(b.name));

    const snapshot: InventorySnapshot = {
      version: '1.0',
      scannedAt: Date.now(),
      agents,
    };

    fs.writeFileSync(
      this.paths.inventory,
      JSON.stringify(snapshot, null, 2),
      'utf-8'
    );

    return snapshot;
  }

  loadCached(): InventorySnapshot | null {
    try {
      const raw = fs.readFileSync(this.paths.inventory, 'utf-8');
      return JSON.parse(raw) as InventorySnapshot;
    } catch {
      return null;
    }
  }

  getAgent(id: string): DiscoveredAgent | undefined {
    const snap = this.loadCached();
    return snap?.agents.find((a) => a.id === id);
  }
}

interface ManualAgent {
  id: string;
  name?: string;
  binaryPath?: string;
}

function parseManualAgents(content: string): ManualAgent[] {
  const agents: ManualAgent[] = [];
  let current: ManualAgent | null = null;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('- id:')) {
      current = { id: unquote(trimmed.slice(5).trim()) };
      agents.push(current);
      continue;
    }
    if (current && trimmed.includes(':')) {
      const idx = trimmed.indexOf(':');
      const key = trimmed.slice(0, idx).trim();
      const value = unquote(trimmed.slice(idx + 1).trim());
      if (key === 'name') current.name = value;
      if (key === 'command') current.binaryPath = value;
    }
  }
  return agents;
}

function unquote(v: string): string {
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

export function createAgentScanner(
  options?: ConstructorParameters<typeof AgentScanner>[0]
): AgentScanner {
  return new AgentScanner(options);
}
