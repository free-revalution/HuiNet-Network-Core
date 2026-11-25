/**
 * Local agent inventory types
 */

export type AgentPresence = 'unknown' | 'installed' | 'running' | 'connected';

export type AgentCapability = 'mcp' | 'skills' | 'sessions' | 'cli' | 'ide';

export interface DiscoveredAgent {
  /** Stable id e.g. claude-code, cursor, codex */
  id: string;
  /** Display name */
  name: string;
  /** Detection presence */
  presence: AgentPresence;
  /** Absolute path to binary if found */
  binaryPath?: string;
  /** Version string if detectable */
  version?: string;
  /** Home / state directory */
  homeDir?: string;
  /** Where sessions/transcripts live */
  sessionDir?: string;
  /** Known capabilities */
  capabilities: AgentCapability[];
  /** How it was detected */
  signals: string[];
  /** Last scan timestamp */
  scannedAt: number;
  /** Connected to HuiNet hub? */
  connected?: boolean;
  /** Manual override from agents.yaml */
  manual?: boolean;
}

export interface InventorySnapshot {
  version: string;
  scannedAt: number;
  agents: DiscoveredAgent[];
}

export interface AgentDetector {
  id: string;
  name: string;
  detect(): Promise<DiscoveredAgent | null> | DiscoveredAgent | null;
}
