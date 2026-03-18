/**
 * Process Manager
 *
 * Manages multiple agent processes and handles graceful shutdown.
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import type { AgentConfig } from '../config/agent-config';
import type { HuiNetDaemon } from '../daemon';
import type { LaunchResult, LaunchOptions } from './agent-launcher';
import { AgentLauncher } from './agent-launcher';

/**
 * Agent process status
 */
export interface AgentProcessStatus {
  /** Agent ID */
  agentId: string;

  /** Process ID */
  pid: number;

  /** Running state */
  running: boolean;

  /** Exit code (if exited) */
  exitCode?: number;

  /** Exit signal (if killed) */
  exitSignal?: string;

  /** Started at */
  startedAt: number;

  /** Exited at */
  exitedAt?: number;
}

/**
 * Process Manager
 */
export class ProcessManager extends EventEmitter {
  private daemon: HuiNetDaemon;
  private launcher: AgentLauncher;
  private processes = new Map<string, AgentProcessStatus>();

  constructor(daemon: HuiNetDaemon) {
    super();
    this.daemon = daemon;
    this.launcher = new AgentLauncher(daemon);

    // Forward launcher events
    this.launcher.on('agentLaunched', (result: LaunchResult) => {
      const status: AgentProcessStatus = {
        agentId: result.agentId,
        pid: result.pid,
        running: true,
        startedAt: Date.now(),
      };
      this.processes.set(result.agentId, status);
      this.emit('agentLaunched', status);
    });

    this.launcher.on('agentExited', (agentId: string, code: number | null, signal: string | null) => {
      const status = this.processes.get(agentId);
      if (status) {
        status.running = false;
        status.exitCode = code ?? undefined;
        status.exitSignal = signal ?? undefined;
        status.exitedAt = Date.now();
      }
      this.emit('agentExited', agentId, code, signal);
    });

    this.launcher.on('agentError', (agentId: string, error: Error) => {
      this.emit('agentError', agentId, error);
    });

    this.launcher.on('stdout', (agentId: string, data: string) => {
      this.emit('agentStdout', agentId, data);
    });

    this.launcher.on('stderr', (agentId: string, data: string) => {
      this.emit('agentStderr', agentId, data);
    });
  }

  /**
   * Launch an agent by configuration
   */
  async launchAgent(config: AgentConfig): Promise<AgentProcessStatus> {
    // Allocate proxy for the agent
    const allocation = await this.daemon.allocateAgent(config.id);

    const result = await this.launcher.launch({
      config,
      proxyPort: allocation.port.toString(),
      nodeId: this.daemon.getHuiNet()?.getNodeID() || '',
    });

    return this.processes.get(result.agentId)!;
  }

  /**
   * Launch multiple agents
   */
  async launchAgents(configs: AgentConfig[]): Promise<Map<string, AgentProcessStatus>> {
    const results = new Map<string, AgentProcessStatus>();

    for (const config of configs) {
      try {
        const status = await this.launchAgent(config);
        results.set(config.id, status);
      } catch (error) {
        console.error(`Failed to launch agent ${config.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string, signal?: NodeJS.Signals): Promise<boolean> {
    return this.launcher.stop(agentId, signal);
  }

  /**
   * Stop all agents
   */
  async stopAll(signal?: NodeJS.Signals): Promise<void> {
    await this.launcher.stopAll();
    this.processes.clear();
  }

  /**
   * Get status of an agent
   */
  getAgentStatus(agentId: string): AgentProcessStatus | undefined {
    return this.processes.get(agentId);
  }

  /**
   * Get status of all agents
   */
  getAllStatus(): AgentProcessStatus[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get running agents
   */
  getRunningAgents(): AgentProcessStatus[] {
    return this.getAllStatus().filter((s) => s.running);
  }

  /**
   * Restart an agent
   */
  async restartAgent(agentId: string, config: AgentConfig): Promise<AgentProcessStatus> {
    await this.stopAgent(agentId, 'SIGTERM');

    // Wait a bit for clean shutdown
    await new Promise((resolve) => setTimeout(resolve, 500));

    return this.launchAgent(config);
  }

  /**
   * Get agent process
   */
  getProcess(agentId: string): ChildProcess | undefined {
    return this.launcher.getProcess(agentId);
  }

  /**
   * Send signal to agent
   */
  sendSignal(agentId: string, signal: NodeJS.Signals): boolean {
    const process = this.getProcess(agentId);

    if (!process) {
      return false;
    }

    return process.kill(signal);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAll().catch((err) => {
      console.error('Error during cleanup:', err);
    });
  }
}

/**
 * Create process manager
 */
export function createProcessManager(daemon: HuiNetDaemon): ProcessManager {
  return new ProcessManager(daemon);
}
