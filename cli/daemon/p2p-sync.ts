/**
 * P2P Synchronization for HuiNet Daemon
 * Handles machine discovery and agent communication across the P2P network
 */

import { HuiNet } from '../../src/HuiNet';
import { NodeID } from '../../src/types/node';
import {
  MachineInfo,
  AgentInfo,
  MachineAnnouncement,
} from './types';
import {
  AgentMessageType,
  MachineAnnounceMessage,
  AgentAnnounceMessage,
  AgentHeartbeatMessage,
  AgentMessage,
  isAgentMessage,
  getAgentMessageTypeName,
  AgentSummary,
} from '../../src/protocol/agent';

/**
 * Remote machine information
 */
export interface RemoteMachine {
  machineId: NodeID;
  machineName: string;
  location?: string;
  status: 'online' | 'offline';
  lastSeen: number;
  agents: AgentSummary[];
}

/**
 * P2P message handler callback type
 */
export type P2PMessageHandler = (fromMachineId: NodeID, message: any) => void;

/**
 * P2P Sync - Manages P2P communication for the daemon
 *
 * Responsibilities:
 * - Track remote machines and their agents
 * - Handle machine announcements
 * - Route agent-to-agent messages
 * - Broadcast local machine state
 */
export class P2PSync {
  private remoteMachines: Map<NodeID, RemoteMachine> = new Map();
  private messageHandlers: Map<AgentMessageType, P2PMessageHandler[]> = new Map();
  private machineHeartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private huinet: HuiNet,
    private machineInfo: MachineInfo,
    private registry: { getAll(): AgentInfo[] }
  ) {
    this.setupMessageHandler();
  }

  /**
   * Setup P2P message handler
   */
  private setupMessageHandler(): void {
    this.huinet.on('message', (from: NodeID, data: unknown) => {
      this.handleMessage(from, data);
    });
  }

  /**
   * Handle incoming P2P message
   */
  private handleMessage(from: NodeID, data: unknown): void {
    try {
      // Parse message if it's a string
      const message = typeof data === 'string' ? JSON.parse(data) : data;

      // Validate it's an agent message
      if (!isAgentMessage(message)) {
        return;
      }

      console.log(`[P2P] Received ${getAgentMessageTypeName(message.type)} from ${from}`);

      // Route to appropriate handler
      switch (message.type) {
        case AgentMessageType.MACHINE_ANNOUNCE:
          this.handleMachineAnnounce(from, message as MachineAnnounceMessage);
          break;
        case AgentMessageType.AGENT_ANNOUNCE:
          this.handleAgentAnnounce(from, message as AgentAnnounceMessage);
          break;
        case AgentMessageType.AGENT_HEARTBEAT:
          this.handleAgentHeartbeat(from, message as AgentHeartbeatMessage);
          break;
        case AgentMessageType.AGENT_MESSAGE:
          this.handleAgentMessage(from, message as AgentMessage);
          break;
        default:
          console.warn(`[P2P] Unknown message type: ${message.type}`);
      }

      // Call registered handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(from, message));
      }
    } catch (error) {
      console.error('[P2P] Failed to handle message:', error);
    }
  }

  /**
   * Handle machine announcement
   */
  private handleMachineAnnounce(from: NodeID, data: MachineAnnounceMessage): void {
    const remoteMachine: RemoteMachine = {
      machineId: from,
      machineName: data.machineName,
      location: data.location,
      status: 'online',
      lastSeen: Date.now(),
      agents: data.agents,
    };

    // Update or add remote machine
    const existing = this.remoteMachines.get(from);
    if (existing) {
      // Update existing machine - use current time for lastSeen
      existing.lastSeen = Date.now();
      existing.agents = data.agents;
      existing.status = 'online';
    } else {
      // New machine discovered
      this.remoteMachines.set(from, remoteMachine);
      console.log(`[P2P] New machine discovered: ${data.machineName} (${from})`);
    }
  }

  /**
   * Handle agent announcement
   */
  private handleAgentAnnounce(from: NodeID, data: AgentAnnounceMessage): void {
    let remoteMachine = this.remoteMachines.get(from);

    if (!remoteMachine) {
      // Create remote machine entry if doesn't exist
      remoteMachine = {
        machineId: from,
        machineName: `Machine-${from.substring(0, 8)}`,
        location: undefined,
        status: 'online',
        lastSeen: Date.now(),
        agents: [],
      };
      this.remoteMachines.set(from, remoteMachine);
    }

    // Add or update agent
    const existingAgent = remoteMachine.agents.find(a => a.agentId === data.agentId);
    if (existingAgent) {
      existingAgent.status = 'online';
    } else {
      remoteMachine.agents.push({
        agentId: data.agentId,
        agentType: data.agentType,
        agentName: data.agentName,
        status: 'online',
      });
    }

    console.log(`[P2P] Agent announced: ${data.agentName} on ${remoteMachine.machineName}`);
  }

  /**
   * Handle agent heartbeat
   */
  private handleAgentHeartbeat(from: NodeID, data: AgentHeartbeatMessage): void {
    const remoteMachine = this.remoteMachines.get(from);
    if (!remoteMachine) {
      return;
    }

    const agent = remoteMachine.agents.find(a => a.agentId === data.agentId);
    if (agent) {
      agent.status = data.status;
      remoteMachine.lastSeen = data.timestamp;
    }
  }

  /**
   * Handle agent-to-agent message
   */
  private handleAgentMessage(from: NodeID, data: AgentMessage): void {
    console.log(`[P2P] Agent message: ${data.fromAgent} -> ${data.toAgent}`);
    // Messages to local agents will be handled by the proxy
    // This is just for logging and tracking
  }

  /**
   * Announce local machine to P2P network
   * Sends to all known remote machines
   */
  async announceMachine(): Promise<void> {
    const localAgents = this.getLocalAgents();

    const message: MachineAnnounceMessage = {
      type: AgentMessageType.MACHINE_ANNOUNCE,
      machineId: this.machineInfo.machineId as NodeID,
      machineName: this.machineInfo.machineName,
      location: this.machineInfo.location,
      agents: localAgents.map(a => ({
        agentId: a.agentId,
        agentType: a.agentType,
        agentName: a.agentName,
        status: a.status === 'offline' ? 'offline' : 'online',
      })),
      timestamp: Date.now(),
    };

    const messageStr = JSON.stringify(message);

    // Send to all known remote machines
    const remoteMachineIds = Array.from(this.remoteMachines.keys());
    const sendPromises = remoteMachineIds.map(machineId =>
      this.huinet.send(machineId, messageStr).catch(err => {
        console.warn(`[P2P] Failed to send announcement to ${machineId}:`, err.message);
      })
    );

    await Promise.allSettled(sendPromises);
    console.log(`[P2P] Machine announced with ${localAgents.length} agents to ${remoteMachineIds.length} machines`);
  }

  /**
   * Start periodic machine heartbeat
   */
  startMachineHeartbeat(intervalMs: number = 30000): void {
    if (this.machineHeartbeatTimer) {
      clearInterval(this.machineHeartbeatTimer);
    }

    this.machineHeartbeatTimer = setInterval(async () => {
      await this.announceMachine();
      this.cleanupStaleMachines();
    }, intervalMs);

    console.log(`[P2P] Machine heartbeat started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop machine heartbeat
   */
  stopMachineHeartbeat(): void {
    if (this.machineHeartbeatTimer) {
      clearInterval(this.machineHeartbeatTimer);
      this.machineHeartbeatTimer = null;
    }
  }

  /**
   * Get local agents from registry
   */
  private getLocalAgents(): AgentInfo[] {
    return this.registry.getAll();
  }

  /**
   * Send message to specific agent on remote machine
   */
  async sendMessageToAgent(
    toMachineId: NodeID,
    toAgentId: string,
    fromAgentId: string,
    message: any
  ): Promise<void> {
    const agentMessage: AgentMessage = {
      type: AgentMessageType.AGENT_MESSAGE,
      fromAgent: fromAgentId,
      toAgent: toAgentId,
      message,
      timestamp: Date.now(),
    };

    await this.huinet.send(toMachineId, JSON.stringify(agentMessage));
    console.log(`[P2P] Sent message to agent ${toAgentId} on ${toMachineId}`);
  }

  /**
   * Register custom message handler
   */
  on(messageType: AgentMessageType, handler: P2PMessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  /**
   * Get all remote machines
   */
  getRemoteMachines(): RemoteMachine[] {
    return Array.from(this.remoteMachines.values());
  }

  /**
   * Get remote machine by ID
   */
  getRemoteMachine(machineId: NodeID): RemoteMachine | undefined {
    return this.remoteMachines.get(machineId);
  }

  /**
   * Get network topology (local + remote machines)
   */
  getNetworkTopology(): {
    local: MachineInfo & { agents: AgentInfo[] };
    remote: RemoteMachine[];
  } {
    return {
      local: {
        ...this.machineInfo,
        agents: this.getLocalAgents(),
      },
      remote: this.getRemoteMachines(),
    };
  }

  /**
   * Cleanup stale machines that haven't been seen recently
   */
  private cleanupStaleMachines(timeoutMs: number = 120000): void {
    const now = Date.now();
    const staleMachines: NodeID[] = [];

    for (const [machineId, machine] of this.remoteMachines.entries()) {
      if (now - machine.lastSeen > timeoutMs) {
        staleMachines.push(machineId);
      }
    }

    for (const machineId of staleMachines) {
      const machine = this.remoteMachines.get(machineId);
      console.log(`[P2P] Removing stale machine: ${machine?.machineName} (${machineId})`);
      this.remoteMachines.delete(machineId);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopMachineHeartbeat();
    this.remoteMachines.clear();
    this.messageHandlers.clear();
  }
}
