/**
 * Agent Registry
 * Manages agent registration, tracking, and state changes
 */

import { EventEmitter } from 'events';
import { MachineInfo, AgentInfo } from './types';

/**
 * Statistics about registered agents
 */
export interface AgentStats {
  /** Total number of agents */
  total: number;
  /** Number of agents with status 'running' */
  running: number;
  /** Number of agents with status 'busy' */
  busy: number;
  /** Number of agents with status 'idle' */
  idle: number;
  /** Number of agents with status 'offline' */
  offline: number;
}

/**
 * Agent Registry class
 * Extends EventEmitter to notify about agent lifecycle events
 */
export class AgentRegistry extends EventEmitter {
  private agents: Map<string, AgentInfo>;
  private machineInfo: MachineInfo;

  constructor(machineInfo: MachineInfo) {
    super();
    this.machineInfo = machineInfo;
    this.agents = new Map();
  }

  /**
   * Register a new agent
   * @param agent - Agent information without machineId
   * @returns Complete agent information with machineId added
   * @emits agent-registered
   */
  add(agent: Omit<AgentInfo, 'machineId'>): AgentInfo {
    const completeAgent: AgentInfo = {
      ...agent,
      machineId: this.machineInfo.machineId,
    };

    this.agents.set(completeAgent.agentId, completeAgent);
    this.emit('agent-registered', completeAgent);

    return completeAgent;
  }

  /**
   * Find an agent by ID
   * @param agentId - Agent identifier
   * @returns Agent information or undefined if not found
   */
  get(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Find all agents on a specific machine
   * @param machineId - Machine identifier
   * @returns Array of agents on the specified machine
   */
  getByMachine(machineId: string): AgentInfo[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.machineId === machineId
    );
  }

  /**
   * Get all registered agents
   * @returns Array of all agents
   */
  getAll(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  /**
   * Remove an agent from registry
   * @param agentId - Agent identifier
   * @returns true if agent was removed, false if not found
   * @emits agent-removed
   */
  remove(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    this.agents.delete(agentId);
    this.emit('agent-removed', agentId);
    return true;
  }

  /**
   * Update agent's last heartbeat timestamp
   * @param agentId - Agent identifier
   * @returns true if updated, false if agent not found
   */
  updateHeartbeat(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.lastHeartbeat = Date.now();
    return true;
  }

  /**
   * Update agent's status
   * @param agentId - Agent identifier
   * @param status - New status
   * @returns true if updated, false if agent not found
   * @emits agent-status-changed
   */
  updateStatus(agentId: string, status: AgentInfo['status']): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.status = status;
    this.emit('agent-status-changed', agentId, status);
    return true;
  }

  /**
   * Get statistics about registered agents
   * @returns Statistics object with counts by status
   */
  getStats(): AgentStats {
    const agents = this.getAll();
    return {
      total: agents.length,
      running: agents.filter(a => a.status === 'running').length,
      busy: agents.filter(a => a.status === 'busy').length,
      idle: agents.filter(a => a.status === 'idle').length,
      offline: agents.filter(a => a.status === 'offline').length,
    };
  }
}
