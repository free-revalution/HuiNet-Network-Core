/**
 * HTTP Proxy Pool for Agent Communication
 *
 * Manages HTTP proxy servers that route messages to agents.
 * Each agent gets a dedicated proxy port for external communication.
 */

import * as http from 'http';
import * as net from 'net';

/**
 * Configuration for HTTP Proxy Pool
 */
export interface HTTPProxyConfig {
  /** Port range for proxy allocation [min, max] */
  portRange: [number, number];
}

/**
 * Statistics for proxy pool
 */
export interface ProxyStats {
  /** Total number of proxies created */
  total: number;
  /** Number of active proxies */
  active: number;
}

/**
 * Agent Proxy - Internal class representing a single agent's HTTP proxy
 */
class AgentProxy {
  private server: http.Server | null = null;
  private running: boolean = false;

  constructor(
    public readonly agentId: string,
    public readonly port: number,
  ) {}

  /**
   * Start the HTTP proxy server
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, () => {
        this.running = true;
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP proxy server
   */
  async stop(): Promise<void> {
    if (!this.running || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.running = false;
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Check if proxy is running
   */
  isActive(): boolean {
    return this.running;
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    try {
      // Parse agent ID from Host header
      const host = req.headers.host || '';
      const agentId = this.parseAgentId(host);

      if (!agentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid Host header' }));
        return;
      }

      // Check if request is for this agent
      if (agentId !== this.agentId) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent not found' }));
        return;
      }

      // Handle the request - in a real implementation, this would forward to the agent
      // For now, just return a success response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        agentId: this.agentId,
        message: 'Request routed to agent',
      }));

    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Parse agent ID from Host header
   * Supports formats:
   * - agent-id.huinet.local
   * - agent-id.huinet.local:port
   * - agent-id
   */
  private parseAgentId(host: string): string | null {
    if (!host) {
      return null;
    }

    // Remove port if present
    const hostWithoutPort = host.split(':')[0];

    // If it's just the agent ID (no domain)
    if (!hostWithoutPort.includes('.')) {
      return hostWithoutPort;
    }

    // Extract agent ID from subdomain
    // Format: agent-id.huinet.local
    const parts = hostWithoutPort.split('.');
    if (parts.length >= 2 && parts[1] === 'huinet') {
      return parts[0];
    }

    return null;
  }
}

/**
 * HTTP Proxy Pool - Manages multiple agent proxies
 */
export class HTTPProxyPool {
  private proxies: Map<string, AgentProxy> = new Map();
  private allocatedPorts: Set<number> = new Set();
  private config: HTTPProxyConfig;

  constructor(config: HTTPProxyConfig) {
    this.config = config;
  }

  /**
   * Allocate a port for an agent
   * Reuses existing port if agent already has one
   */
  async allocate(agentId: string): Promise<number> {
    // Check if agent already has a proxy
    const existingProxy = this.proxies.get(agentId);
    if (existingProxy) {
      return existingProxy.port;
    }

    // Find next available port
    const port = this.findAvailablePort();
    if (port === null) {
      throw new Error('No available ports in range');
    }

    // Create and start proxy
    await this.create(agentId, port);

    return port;
  }

  /**
   * Create a proxy at a specific port
   */
  async create(agentId: string, port: number): Promise<void> {
    // Check if proxy already exists for this agent
    if (this.proxies.has(agentId)) {
      return;
    }

    // Validate port is in range
    const [minPort, maxPort] = this.config.portRange;
    if (port < minPort || port > maxPort) {
      throw new Error(`Port ${port} is out of range [${minPort}, ${maxPort}]`);
    }

    // Check if port is already allocated
    if (this.allocatedPorts.has(port)) {
      throw new Error(`Port ${port} is already in use`);
    }

    // Check if port is actually available on the system
    const isAvailable = await this.checkPortAvailable(port);
    if (!isAvailable) {
      throw new Error(`Port ${port} is already in use by another process`);
    }

    // Create and start the proxy
    const proxy = new AgentProxy(agentId, port);
    await proxy.start();

    // Track the proxy
    this.proxies.set(agentId, proxy);
    this.allocatedPorts.add(port);
  }

  /**
   * Close proxy for a specific agent
   */
  async close(agentId: string): Promise<void> {
    const proxy = this.proxies.get(agentId);
    if (!proxy) {
      return;
    }

    await proxy.stop();

    // Free the port
    this.allocatedPorts.delete(proxy.port);
    this.proxies.delete(agentId);
  }

  /**
   * Close all proxies
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.proxies.values()).map(proxy => proxy.stop());
    await Promise.all(closePromises);

    this.proxies.clear();
    this.allocatedPorts.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): ProxyStats {
    return {
      total: this.proxies.size,
      active: Array.from(this.proxies.values()).filter(p => p.isActive()).length,
    };
  }

  /**
   * Find next available port in range
   */
  private findAvailablePort(): number | null {
    const [minPort, maxPort] = this.config.portRange;

    for (let port = minPort; port <= maxPort; port++) {
      if (!this.allocatedPorts.has(port)) {
        return port;
      }
    }

    return null;
  }

  /**
   * Check if a port is available on the system
   */
  private checkPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, '127.0.0.1');
    });
  }
}
