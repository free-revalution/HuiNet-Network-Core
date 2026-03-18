/**
 * Agent Launcher
 *
 * Launches agents with proper environment variables and manages their lifecycle.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import type { AgentConfig } from '../config/agent-config';
import type { HuiNetDaemon } from '../daemon';

/**
 * Agent launch options
 */
export interface LaunchOptions {
  /** Agent configuration */
  config: AgentConfig;

  /** Allocated proxy port */
  proxyPort: string;

  /** HuiNet node ID */
  nodeId: string;

  /** Working directory override */
  workdir?: string;
}

/**
 * Agent launch result
 */
export interface LaunchResult {
  /** Child process */
  process: ChildProcess;

  /** Agent ID */
  agentId: string;

  /** Process ID */
  pid: number;

  /** WebSocket URL */
  wsUrl: string;
}

/**
 * Agent Launcher
 */
export class AgentLauncher extends EventEmitter {
  private daemon: HuiNetDaemon;
  private launchedAgents = new Map<string, ChildProcess>();

  constructor(daemon: HuiNetDaemon) {
    super();
    this.daemon = daemon;
  }

  /**
   * Launch an agent
   */
  async launch(options: LaunchOptions): Promise<LaunchResult> {
    const { config, proxyPort, nodeId } = options;

    // Check if agent is already running
    if (this.launchedAgents.has(config.id)) {
      throw new Error(`Agent ${config.id} is already running`);
    }

    // Prepare environment variables
    const env = {
      ...process.env,
      ...config.env,
      HUINET_AGENT_ID: config.id,
      HUINET_NODE_ID: nodeId,
      HUINET_WS_URL: `ws://127.0.0.1:${proxyPort}`,
      HTTP_PROXY: `http://127.0.0.1:${proxyPort}`,
      HTTPS_PROXY: `http://127.0.0.1:${proxyPort}`,
    };

    // Prepare working directory
    const workdir = options.workdir || config.workdir || process.cwd();

    // Prepare command and arguments
    const command = config.command;
    const args = config.args || [];

    // Spawn the agent process
    const childProcess = spawn(command, args, {
      cwd: path.resolve(workdir),
      env: env as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Track the process
    this.launchedAgents.set(config.id, childProcess);

    // Handle process output
    childProcess.stdout?.on('data', (data: Buffer) => {
      this.emit('stdout', config.id, data.toString());
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      this.emit('stderr', config.id, data.toString());
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      this.launchedAgents.delete(config.id);
      this.emit('agentExited', config.id, code, signal);
    });

    // Handle process error
    childProcess.on('error', (error) => {
      this.launchedAgents.delete(config.id);
      this.emit('agentError', config.id, error);
    });

    const result: LaunchResult = {
      process: childProcess,
      agentId: config.id,
      pid: childProcess.pid || 0,
      wsUrl: env.HUINET_WS_URL,
    };

    this.emit('agentLaunched', result);

    return result;
  }

  /**
   * Stop a running agent
   */
  async stop(agentId: string, signal?: NodeJS.Signals): Promise<boolean> {
    const process = this.launchedAgents.get(agentId);

    if (!process) {
      return false;
    }

    process.kill(signal || 'SIGTERM');

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if still running after 5 seconds
        if (this.launchedAgents.has(agentId)) {
          process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      process.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    return true;
  }

  /**
   * Stop all running agents
   */
  async stopAll(): Promise<void> {
    const stopPromises: Promise<boolean>[] = [];

    for (const agentId of this.launchedAgents.keys()) {
      stopPromises.push(this.stop(agentId));
    }

    await Promise.all(stopPromises);
  }

  /**
   * Check if an agent is running
   */
  isRunning(agentId: string): boolean {
    return this.launchedAgents.has(agentId);
  }

  /**
   * Get all running agent IDs
   */
  getRunningAgents(): string[] {
    return Array.from(this.launchedAgents.keys());
  }

  /**
   * Get process for an agent
   */
  getProcess(agentId: string): ChildProcess | undefined {
    return this.launchedAgents.get(agentId);
  }
}

/**
 * Quick launch helper
 */
export async function launchAgent(
  daemon: HuiNetDaemon,
  config: AgentConfig
): Promise<LaunchResult> {
  // Allocate proxy for the agent
  const allocation = await daemon.allocateAgent(config.id);

  const launcher = new AgentLauncher(daemon);

  return launcher.launch({
    config,
    proxyPort: allocation.port.toString(),
    nodeId: daemon.getHuiNet()?.getNodeID() || '',
  });
}
