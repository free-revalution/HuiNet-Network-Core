/**
 * Daemon Client for Monitor
 * Connects to HuiNet daemon admin API and provides real-time updates
 */

import { AgentInfo } from '../daemon/types';

/**
 * Network topology response from daemon
 */
export interface NetworkTopology {
  machines: Array<{
    machineId: string;
    machineName: string;
    location: string;
    agents: AgentInfo[];
  }>;
}

/**
 * Message send request
 */
export interface MessageRequest {
  fromAgent: string;
  toAgent: string;
  message: string;
}

/**
 * Message send response
 */
export interface MessageResponse {
  fromAgent: string;
  toAgent: string;
  message: string;
  timestamp: number;
}

/**
 * Status event from daemon
 */
export interface StatusEvent {
  machineId: string;
  stats: {
    totalAgents: number;
    activeAgents: number;
  };
  proxyStats: {
    total: number;
    active: number;
  };
}

/**
 * Event source for daemon events
 */
export interface EventSource {
  on(event: 'status', callback: (data: StatusEvent) => void): void;
  on(event: 'topology', callback: (data: NetworkTopology) => void): void;
  on(event: 'agent-added' | 'agent-removed', callback: (agent: AgentInfo) => void): void;
  close(): void;
}

/**
 * Simple event emitter implementation
 */
class SimpleEventEmitter implements EventSource {
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  private pollingInterval?: NodeJS.Timeout;

  constructor(private daemonUrl: string) {}

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  startPolling(interval: number = 1000): void {
    if (this.pollingInterval) {
      return; // Already polling
    }

    this.pollingInterval = setInterval(async () => {
      try {
        // Poll for status updates
        const response = await fetch(`${this.daemonUrl}/api/status`);
        if (response.ok) {
          const data = await response.json();
          this.emit('status', data);
        }
      } catch (error) {
        // Silently ignore polling errors
      }
    }, interval);
  }

  close(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    this.listeners.clear();
  }
}

/**
 * Client for communicating with HuiNet daemon
 */
export class DaemonClient {
  private connected = false;

  constructor(private daemonUrl: string) {}

  /**
   * Verify connection to daemon
   */
  async connect(): Promise<void> {
    try {
      const response = await fetch(`${this.daemonUrl}/api/status`);

      if (!response.ok) {
        throw new Error(`Daemon returned error: ${response.status} ${response.statusText}`);
      }

      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to daemon: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to real-time events from daemon
   * Returns an event source that emits status, topology, and agent events
   */
  subscribeEvents(): EventSource {
    const emitter = new SimpleEventEmitter(this.daemonUrl);
    emitter.startPolling(1000); // Poll every second
    return emitter;
  }

  /**
   * Fetch current network topology
   */
  async getTopology(): Promise<NetworkTopology> {
    try {
      const response = await fetch(`${this.daemonUrl}/api/topology`);

      if (!response.ok) {
        throw new Error(`Failed to fetch topology: ${response.status}`);
      }

      return (await response.json()) as NetworkTopology;
    } catch (error) {
      throw new Error(`Failed to fetch topology: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a message from one agent to another
   */
  async sendMessage(fromAgent: string, toAgent: string, message: string): Promise<void> {
    try {
      const response = await fetch(`${this.daemonUrl}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAgent,
          toAgent,
          message,
        } as MessageRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if client is connected to daemon
   */
  isConnected(): boolean {
    return this.connected;
  }
}
