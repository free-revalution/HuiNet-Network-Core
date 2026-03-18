/**
 * HuiNet Daemon - Main daemon class for managing AI agents on each machine
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as crypto from 'crypto';
import { HuiNet } from '../../src/HuiNet';
import { HuiNetConfig } from '../../src/HuiNet';
import { DaemonConfig, MachineInfo, MachineAnnouncement } from './types';
import { loadConfig } from './config';

// Placeholder types for future implementation
interface AgentRegistry {
  // Will be implemented in Task 1.2
}

interface ProxyPool {
  // Will be implemented in Task 1.3
}

/**
 * HuiNet Daemon - Manages AI agents on a single machine
 *
 * The daemon is responsible for:
 * - Registering the machine with the P2P network
 * - Managing the lifecycle of AI agents on this machine
 * - Providing proxy ports for agent communication
 * - Handling machine announcements and discovery
 */
export class HuiNetDaemon extends EventEmitter {
  private config: Required<DaemonConfig>;
  private machineInfo: MachineInfo;
  private huinet: HuiNet;
  private running = false;
  private heartbeatInterval?: NodeJS.Timeout;

  // Placeholder for future implementations
  private registry?: AgentRegistry;
  private proxyPool?: ProxyPool;

  constructor(userConfig: DaemonConfig = {}) {
    super();

    // Load and merge configuration
    this.config = loadConfig(userConfig);

    // Create machine info with unique ID
    this.machineInfo = this.createMachineInfo();

    // Initialize HuiNet with daemon configuration
    const huinetConfig: HuiNetConfig = {
      listenPort: this.config.listenPort,
      enableMDNS: this.config.enableMDNS,
    };

    this.huinet = new HuiNet(huinetConfig);

    // Set up event handlers for P2P events
    this.setupP2PEventHandlers();
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    try {
      // Start HuiNet (it emits 'ready' synchronously after completion)
      await this.huinet.start();

      // HuiNet is now ready - proceed with daemon setup
      // Announce machine to network
      this.announceMachine();

      // Set up heartbeat interval
      this.startHeartbeat();

      // Mark as running and emit ready event
      this.running = true;
      this.emit('ready');

      // TODO: Set up admin API (will be implemented in later tasks)
      // TODO: Initialize proxy pool (will be implemented in Task 1.3)
      // TODO: Initialize agent registry (will be implemented in Task 1.2)

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }

      // Stop HuiNet
      await this.huinet.stop();

      // TODO: Stop admin API
      // TODO: Clean up proxy pool
      // TODO: Unregister all agents

      this.running = false;
      this.emit('stopped');

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Check if daemon is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get machine information
   */
  getMachineInfo(): MachineInfo {
    return { ...this.machineInfo };
  }

  /**
   * Get the underlying HuiNet instance
   */
  getHuiNet(): HuiNet {
    return this.huinet;
  }

  /**
   * Get daemon configuration
   */
  getConfig(): Required<DaemonConfig> {
    return { ...this.config };
  }

  /**
   * Create machine information with unique ID
   * Machine ID is generated from MAC address + hostname
   */
  private createMachineInfo(): MachineInfo {
    const macAddress = this.getMacAddress();
    const hostname = os.hostname();
    const machineId = this.generateMachineId(macAddress, hostname);

    return {
      machineId,
      machineName: this.config.machineName,
      location: this.config.location,
    };
  }

  /**
   * Get the MAC address of the machine
   */
  private getMacAddress(): string {
    try {
      // Use getmac package to get MAC address
      const getmac = require('getmac');
      return getmac();
    } catch (error) {
      // Fallback to first network interface
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (iface) {
          for (const config of iface) {
            if (config.mac && config.mac !== '00:00:00:00:00:00') {
              return config.mac;
            }
          }
        }
      }
      // Final fallback
      return '00:00:00:00:00:00';
    }
  }

  /**
   * Generate machine ID from MAC address and hostname
   */
  private generateMachineId(macAddress: string, hostname: string): string {
    const data = `${macAddress}-${hostname}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Set up P2P event handlers
   */
  private setupP2PEventHandlers(): void {
    // Forward messages from HuiNet
    this.huinet.on('message', (fromNodeID, message) => {
      this.emit('message', fromNodeID, message);
    });

    // Forward peer connected events
    this.huinet.on('peerConnected', (nodeID) => {
      this.emit('peerConnected', nodeID);
    });

    // Forward peer disconnected events
    this.huinet.on('peerDisconnected', (nodeID) => {
      this.emit('peerDisconnected', nodeID);
    });

    // Forward node discovered events
    this.huinet.on('nodeDiscovered', (event) => {
      this.emit('nodeDiscovered', event);
    });

    // Forward error events
    this.huinet.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Announce machine to the P2P network
   */
  private announceMachine(): void {
    const announcement: MachineAnnouncement = {
      machineInfo: this.machineInfo,
      agents: [], // No agents yet - will be populated in Task 1.2
      timestamp: Date.now(),
    };

    // Emit announcement event
    this.emit('machineAnnounced', announcement);

    // In future tasks, this will be broadcast to the P2P network
    // For now, we just emit the event
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.emit('heartbeat', {
        machineId: this.machineInfo.machineId,
        timestamp: Date.now(),
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Handle incoming P2P messages
   * This will be expanded in later tasks to handle specific message types
   */
  private handleP2PMessage(fromNodeID: string, message: any): void {
    // TODO: Implement message handling for different types
    // - Machine announcements
    // - Agent registration requests
    // - Proxy requests
    // etc.

    this.emit('message', fromNodeID, message);
  }

  /**
   * Get agent registry (placeholder for future implementation)
   */
  getRegistry(): AgentRegistry | undefined {
    return this.registry;
  }

  /**
   * Get proxy pool (placeholder for future implementation)
   */
  getProxyPool(): ProxyPool | undefined {
    return this.proxyPool;
  }
}

// Export types and config
export * from './types';
export * from './config';
