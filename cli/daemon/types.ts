/**
 * Type definitions for HuiNet Daemon
 */

/**
 * Machine information
 */
export interface MachineInfo {
  /** Unique machine identifier (hash of MAC address + hostname) */
  machineId: string;
  /** Human-readable machine name */
  machineName: string;
  /** Physical location of the machine */
  location: string;
}

/**
 * Agent status enum
 */
export enum AgentStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Agent information
 */
export interface AgentInfo {
  /** Unique agent identifier */
  agentId: string;
  /** ID of the machine running this agent */
  machineId: string;
  /** Type of the agent (e.g., 'chatbot', 'code-assistant') */
  agentType: string;
  /** Human-readable agent name */
  agentName: string;
  /** Process ID of the agent */
  pid?: number;
  /** Current status of the agent */
  status: AgentStatus;
  /** Timestamp of last heartbeat */
  lastHeartbeat: number;
  /** Port assigned for proxy connections */
  proxyPort?: number;
  /** Timestamp when agent was registered */
  registeredAt: number;
}

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  /** Human-readable name for this machine */
  machineName?: string;
  /** Physical location of this machine */
  location?: string;
  /** Port for P2P listening */
  listenPort?: number;
  /** Enable mDNS discovery */
  enableMDNS?: boolean;
  /** Port for admin API */
  adminPort?: number;
  /** Port range for proxy pool [min, max] */
  proxyPortRange?: [number, number];
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Heartbeat timeout in milliseconds */
  heartbeatTimeout?: number;
}

/**
 * Machine announcement message for P2P network
 */
export interface MachineAnnouncement {
  /** Machine information */
  machineInfo: MachineInfo;
  /** List of agents running on this machine */
  agents: AgentInfo[];
  /** Timestamp of announcement */
  timestamp: number;
}
