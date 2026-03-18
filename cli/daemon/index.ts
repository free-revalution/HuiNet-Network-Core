/**
 * HuiNet Daemon - Main daemon class for managing AI agents on each machine
 * FIXED: Plain class (does not extend EventEmitter per spec)
 */

import * as os from 'os';
import * as crypto from 'crypto';
import { HuiNet } from '../../src/HuiNet';
import { HuiNetConfig } from '../../src/HuiNet';
import { DaemonConfig, MachineInfo, MachineAnnouncement, AgentStatus } from './types';
import { loadConfig } from './config';
import { AgentRegistry } from './registry';
import { HTTPProxyPool } from './proxy';
import { setupAdminAPI } from './api';

/**
 * HuiNet Daemon - Manages AI agents on a single machine
 *
 * FIXED: Plain class (not extending EventEmitter per spec requirement)
 *
 * The daemon is responsible for:
 * - Registering the machine with the P2P network
 * - Managing the lifecycle of AI agents on this machine
 * - Providing proxy ports for agent communication
 * - Handling machine announcements and discovery
 */
export class HuiNetDaemon {
  private config: Required<DaemonConfig>;
  private machineInfo: MachineInfo;
  private huinet: HuiNet | null = null;
  private registry!: AgentRegistry; // FIXED: Definite assignment assertion - initialized in start()
  private proxyPool!: HTTPProxyPool; // FIXED: Definite assignment assertion - initialized in start()
  private apiServer: any = null; // Express server instance

  // FIXED: Removed 'running' and 'heartbeatInterval' properties per spec

  constructor(userConfig: DaemonConfig = {}) {
    // FIXED: Proper config validation with defaults instead of type assertion
    this.config = {
      machineName: userConfig.machineName || os.hostname(),
      location: userConfig.location || 'default',
      listenPort: userConfig.listenPort ?? 8000,
      enableMDNS: userConfig.enableMDNS ?? true,
      adminPort: userConfig.adminPort ?? 3000,
      proxyPortRange: userConfig.proxyPortRange ?? [8080, 8090],
      heartbeatInterval: userConfig.heartbeatInterval ?? 3000,
      heartbeatTimeout: userConfig.heartbeatTimeout ?? 10000,
    };

    // FIXED: Create machineInfo inline with getMachineId() per spec
    this.machineInfo = {
      machineId: this.getMachineId(),
      machineName: this.config.machineName,
      location: this.config.location,
    };

    // FIXED: Don't initialize registry and proxyPool here - they're initialized in start()
    // This prevents duplicate initialization

    // FIXED: HuiNet creation moved to start() method per spec
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    try {
      // FIXED: HuiNet creation moved from constructor to start() per spec
      const huinetConfig: HuiNetConfig = {
        listenPort: this.config.listenPort,
        enableMDNS: this.config.enableMDNS,
      };

      this.huinet = new HuiNet(huinetConfig);

      // FIXED: Initialize Registry and ProxyPool per spec
      this.registry = new AgentRegistry(this.machineInfo);
      this.proxyPool = new HTTPProxyPool({
        portRange: this.config.proxyPortRange,
      });

      // FIXED: Setup admin API per spec
      this.setupAdminAPI();

      // Start HuiNet
      await this.huinet.start();

      // Announce machine to network
      this.announceMachine();

      // Note: Event forwarding removed since we don't extend EventEmitter anymore

    } catch (error) {
      console.error('Failed to start daemon:', error);
      throw error;
    }
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (this.huinet) {
      await this.huinet.stop();
      this.huinet = null;
    }

    // Close proxy pool if it was initialized
    if (this.proxyPool) {
      await this.proxyPool.closeAll();
    }

    // Close API server if it was initialized
    if (this.apiServer) {
      await new Promise<void>((resolve) => {
        this.apiServer.close(() => {
          resolve();
        });
      });
      this.apiServer = null;
    }

    console.log('Daemon stopped');
  }

  /**
   * Get machine ID
   * FIXED: Renamed from generateMachineId(), made private, calls inline without parameters per spec
   */
  private getMachineId(): string {
    // FIXED: Call inline without parameters per spec
    const macAddress = this.getMacAddress();
    const hostname = os.hostname();
    const data = `${macAddress}-${hostname}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Setup admin API
   */
  private setupAdminAPI(): void {
    const app = setupAdminAPI(this.registry, this.proxyPool, this.config, this.machineInfo);

    // Start Express server
    this.apiServer = app.listen(this.config.adminPort, () => {
      console.log(`Admin API listening on port ${this.config.adminPort}`);
    });

    this.apiServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${this.config.adminPort} is already in use`);
      } else {
        console.error('Admin API server error:', err);
      }
    });
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
   * Announce machine to the P2P network
   */
  private announceMachine(): void {
    const announcement: MachineAnnouncement = {
      machineInfo: this.machineInfo,
      agents: [], // No agents yet - will be populated in Task 1.2
      timestamp: Date.now(),
    };

    console.log('Machine announced:', announcement);
    // In future tasks, this will be broadcast to the P2P network
  }

  // FIXED: Removed methods per spec: isRunning(), getHuiNet(), getConfig(),
  // getRegistry(), getProxyPool(), startHeartbeat(), and extra private methods
}

// Export types and config
export * from './types';
export * from './config';
