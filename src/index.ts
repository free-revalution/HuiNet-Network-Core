/**
 * HuiNet Local Agent Fabric
 *
 * Same-machine agent discovery, A2A bus, and shared context hub.
 * Cross-machine P2P is deprecated and no longer the primary API.
 */

export {
  LocalHub,
  createLocalHub,
  AgentDirectory,
  MessageBus,
  HubRPC,
  A2AMethod,
} from './hub';
export type { LocalHubStatus, ConnectedAgent, BusMessage } from './hub';

export {
  AgentScanner,
  createAgentScanner,
  BUILTIN_DETECTORS,
} from './inventory';
export type {
  DiscoveredAgent,
  InventorySnapshot,
  AgentDetector,
  AgentPresence,
} from './inventory';

export {
  ContextStore,
  createContextStore,
  importSessions,
} from './context';
export type {
  MemoryEntry,
  MemoryKind,
  ImportResult,
  MigratePackage,
} from './context';

export {
  getHuiNetPaths,
  ensureHuiNetDirs,
  loadHubConfig,
  saveHubConfig,
  DEFAULT_HTTP_PORT,
  DEFAULT_WS_PORT,
} from './paths';
export type { HuiNetPaths, HubConfig } from './paths';

// Legacy P2P exports kept for transitional imports / tests
export { HuiNet, HuiNetConfig } from './HuiNet';
export { HuiNetNode, HuiNetConfig as HuiNetNodeConfig } from './core/HuiNetNode';
export * from './types';
export * from './crypto';
export * from './routing';
export * from './transport';
export * from './discovery';
export * from './protocol';
export * from './utils/network';
