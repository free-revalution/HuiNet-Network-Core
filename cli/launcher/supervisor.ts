/**
 * Process Supervisor for AI agents
 * Manages the lifecycle of an agent process, including heartbeat and cleanup
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';

/**
 * Supervisor extends EventEmitter to emit lifecycle events
 */
export class Supervisor extends EventEmitter {
  private daemonUrl: string;
  private agentId: string;
  private process: ChildProcess | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 3000; // 3 seconds

  constructor(daemonUrl: string, agentId: string) {
    super();
    this.daemonUrl = daemonUrl;
    this.agentId = agentId;
  }

  /**
   * Launch the agent process
   */
  async launch(command: string, args: string[], env: Record<string, string>): Promise<void> {
    try {
      // Merge environment variables
      const processEnv = {
        ...process.env,
        ...env,
        HUINET_AGENT_ID: this.agentId,
      };

      // Spawn the agent process
      this.process = spawn(command, args, {
        env: processEnv,
        stdio: 'inherit',
      });

      // Handle process exit
      this.process.on('exit', (code: number | null, signal: string | null) => {
        this.emit('process-exit', code, signal);
        this.stopHeartbeat();
        this.unregister().catch((err) => {
          this.emit('error', err);
        });
      });

      // Handle process errors
      this.process.on('error', (err: Error) => {
        this.emit('error', err);
      });

      // Start heartbeat
      this.startHeartbeat();

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start heartbeat loop
   * Sends heartbeat to daemon every 3 seconds
   */
  startHeartbeat(): void {
    // Send initial heartbeat
    this.sendHeartbeat();

    // Set up interval
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat loop
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat to daemon
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const url = new URL('/api/agents/heartbeat', this.daemonUrl);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: this.agentId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.statusText}`);
      }

      const data = await response.json() as { registered: boolean };
      if (!data.registered) {
        this.emit('error', new Error('Agent not registered in daemon'));
        this.stop();
      }

    } catch (error) {
      this.emit('error', error);
      // Don't stop on heartbeat failure, keep trying
    }
  }

  /**
   * Unregister agent from daemon
   */
  async unregister(): Promise<void> {
    try {
      const url = new URL(`/api/agents/${this.agentId}`, this.daemonUrl);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Unregister failed: ${response.statusText}`);
      }

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the supervised process
   */
  async stop(): Promise<void> {
    this.stopHeartbeat();

    if (this.process) {
      return new Promise<void>((resolve) => {
        const process = this.process!;

        // Set up timeout for force kill
        const timeout = setTimeout(() => {
          if (process.kill) {
            process.kill('SIGKILL');
          }
          resolve();
        }, 5000); // 5 second timeout

        // Try graceful shutdown first
        process.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });

        if (process.kill) {
          process.kill('SIGTERM');
        }

        this.process = null;
      });
    }
  }
}
