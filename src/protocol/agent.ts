import { NodeID } from '../types/node';

/**
 * Agent-specific message types
 * Uses range 0x20-0x2F (32-47) to avoid conflicts with existing protocol
 */
export enum AgentMessageType {
  MACHINE_ANNOUNCE = 0x20,
  AGENT_ANNOUNCE = 0x21,
  AGENT_HEARTBEAT = 0x22,
  AGENT_STATUS = 0x23,
  AGENT_MESSAGE = 0x24,
}

/**
 * Summary information about an agent
 */
export interface AgentSummary {
  agentId: string;
  agentType: string;
  agentName: string;
  status: 'online' | 'offline' | 'busy';
}

/**
 * Machine announcement message
 * Sent by a machine to announce itself and its agents
 */
export interface MachineAnnounceMessage {
  type: AgentMessageType.MACHINE_ANNOUNCE;
  machineId: NodeID;
  machineName: string;
  location?: string;
  agents: AgentSummary[];
  timestamp: number;
}

/**
 * Agent announcement message
 * Sent by an agent to announce its presence on a machine
 */
export interface AgentAnnounceMessage {
  type: AgentMessageType.AGENT_ANNOUNCE;
  machineId: NodeID;
  agentId: string;
  agentType: string;
  agentName: string;
  capabilities: string[];
  timestamp: number;
}

/**
 * Agent heartbeat message
 * Sent periodically to indicate agent is alive
 */
export interface AgentHeartbeatMessage {
  type: AgentMessageType.AGENT_HEARTBEAT;
  agentId: string;
  machineId: NodeID;
  sequence: number;
  status: 'online' | 'offline' | 'busy';
  timestamp: number;
}

/**
 * Agent status message
 * Sent to report current status and state
 */
export interface AgentStatusMessage {
  type: AgentMessageType.AGENT_STATUS;
  agentId: string;
  machineId: NodeID;
  status: 'online' | 'offline' | 'busy';
  load?: number;
  tasksProcessed?: number;
  errors?: number;
  lastActivity?: number;
  timestamp: number;
}

/**
 * Agent-to-agent message
 * Used for direct communication between agents
 */
export interface AgentMessage {
  type: AgentMessageType.AGENT_MESSAGE;
  fromAgent: string;
  toAgent: string;
  message: any;
  timestamp: number;
}

/**
 * Type guard for agent messages
 */
export function isAgentMessage(msg: any): msg is
  | MachineAnnounceMessage
  | AgentAnnounceMessage
  | AgentHeartbeatMessage
  | AgentStatusMessage
  | AgentMessage {
  return (
    msg != null &&
    typeof msg === 'object' &&
    typeof msg.type === 'number' &&
    msg.type >= AgentMessageType.MACHINE_ANNOUNCE &&
    msg.type <= AgentMessageType.AGENT_MESSAGE
  );
}

/**
 * Get agent message type name
 */
export function getAgentMessageTypeName(type: AgentMessageType): string {
  switch (type) {
    case AgentMessageType.MACHINE_ANNOUNCE:
      return 'MACHINE_ANNOUNCE';
    case AgentMessageType.AGENT_ANNOUNCE:
      return 'AGENT_ANNOUNCE';
    case AgentMessageType.AGENT_HEARTBEAT:
      return 'AGENT_HEARTBEAT';
    case AgentMessageType.AGENT_STATUS:
      return 'AGENT_STATUS';
    case AgentMessageType.AGENT_MESSAGE:
      return 'AGENT_MESSAGE';
    default:
      return 'UNKNOWN';
  }
}
