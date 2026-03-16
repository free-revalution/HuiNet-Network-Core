import { NodeID } from '../types/node';
import { TransportAddress, NodeState } from '../types/connection';

export interface NodeInfo {
  nodeID: NodeID;
  addresses: TransportAddress[];
  publicKey: Buffer;
  metadata: {
    name?: string;
    version: string;
    capabilities: string[];
    startTime: number;
  };
  state: NodeState;
  lastSeen: number;
  connectionCount: number;
}

export class RoutingTable {
  private coreNodes: Map<NodeID, NodeInfo> = new Map();
  private activeNodes: Map<NodeID, NodeInfo> = new Map();
  private knownNodes: Map<NodeID, NodeInfo> = new Map();
  private superNodes: TransportAddress[] = [];
  private bootstrapNodes: TransportAddress[] = [];

  // Core node operations (persistent connections)
  addCoreNode(node: NodeInfo): void {
    this.coreNodes.set(node.nodeID, node);
  }

  getCoreNode(nodeID: NodeID): NodeInfo | undefined {
    return this.coreNodes.get(nodeID);
  }

  hasCoreNode(nodeID: NodeID): boolean {
    return this.coreNodes.has(nodeID);
  }

  getCoreNodes(): NodeInfo[] {
    return Array.from(this.coreNodes.values());
  }

  removeCoreNode(nodeID: NodeID): boolean {
    return this.coreNodes.delete(nodeID);
  }

  // Active node operations (cached connections)
  addActiveNode(node: NodeInfo): void {
    this.activeNodes.set(node.nodeID, node);
  }

  getActiveNode(nodeID: NodeID): NodeInfo | undefined {
    return this.activeNodes.get(nodeID);
  }

  hasActiveNode(nodeID: NodeID): boolean {
    return this.activeNodes.has(nodeID);
  }

  getActiveNodes(): NodeInfo[] {
    return Array.from(this.activeNodes.values());
  }

  removeActiveNode(nodeID: NodeID): boolean {
    return this.activeNodes.delete(nodeID);
  }

  // Known node operations (on-demand connections)
  addKnownNode(node: NodeInfo): void {
    this.knownNodes.set(node.nodeID, node);
  }

  getKnownNode(nodeID: NodeID): NodeInfo | undefined {
    return this.knownNodes.get(nodeID);
  }

  hasKnownNode(nodeID: NodeID): boolean {
    return this.knownNodes.has(nodeID);
  }

  getKnownNodes(): NodeInfo[] {
    return Array.from(this.knownNodes.values());
  }

  removeKnownNode(nodeID: NodeID): boolean {
    return this.knownNodes.delete(nodeID);
  }

  // Unified node access (priority: core > active > known)
  getAnyNode(nodeID: NodeID): NodeInfo | undefined {
    return this.coreNodes.get(nodeID) ||
           this.activeNodes.get(nodeID) ||
           this.knownNodes.get(nodeID);
  }

  hasNode(nodeID: NodeID): boolean {
    return this.coreNodes.has(nodeID) ||
           this.activeNodes.has(nodeID) ||
           this.knownNodes.has(nodeID);
  }

  removeNode(nodeID: NodeID): void {
    this.coreNodes.delete(nodeID);
    this.activeNodes.delete(nodeID);
    this.knownNodes.delete(nodeID);
  }

  getAllNodes(): NodeInfo[] {
    return [
      ...this.coreNodes.values(),
      ...this.activeNodes.values(),
      ...this.knownNodes.values(),
    ];
  }

  // Super node operations
  addSuperNode(address: TransportAddress): void {
    if (!this.superNodes.some(a => a.host === address.host && a.port === address.port)) {
      this.superNodes.push(address);
    }
  }

  getSuperNodes(): TransportAddress[] {
    return [...this.superNodes];
  }

  // Bootstrap node operations
  addBootstrapNode(address: TransportAddress): void {
    if (!this.bootstrapNodes.some(a => a.host === address.host && a.port === address.port)) {
      this.bootstrapNodes.push(address);
    }
  }

  getBootstrapNodes(): TransportAddress[] {
    return [...this.bootstrapNodes];
  }

  // Statistics
  getStats() {
    return {
      totalNodes: this.coreNodes.size + this.activeNodes.size + this.knownNodes.size,
      coreCount: this.coreNodes.size,
      activeCount: this.activeNodes.size,
      knownCount: this.knownNodes.size,
      superNodeCount: this.superNodes.length,
      bootstrapCount: this.bootstrapNodes.length,
    };
  }

  // Promote/demote nodes between layers
  promoteToActive(nodeID: NodeID): boolean {
    const node = this.knownNodes.get(nodeID) || this.coreNodes.get(nodeID);
    if (!node) return false;

    this.activeNodes.set(nodeID, node);
    this.knownNodes.delete(nodeID);
    return true;
  }

  promoteToCore(nodeID: NodeID): boolean {
    const node = this.activeNodes.get(nodeID) || this.knownNodes.get(nodeID);
    if (!node) return false;

    this.coreNodes.set(nodeID, node);
    this.activeNodes.delete(nodeID);
    this.knownNodes.delete(nodeID);
    return true;
  }

  demoteToActive(nodeID: NodeID): boolean {
    const node = this.coreNodes.get(nodeID);
    if (!node) return false;

    this.activeNodes.set(nodeID, node);
    this.coreNodes.delete(nodeID);
    return true;
  }

  demoteToKnown(nodeID: NodeID): boolean {
    const node = this.activeNodes.get(nodeID) || this.coreNodes.get(nodeID);
    if (!node) return false;

    this.knownNodes.set(nodeID, node);
    this.activeNodes.delete(nodeID);
    this.coreNodes.delete(nodeID);
    return true;
  }

  // Cleanup stale nodes
  cleanup(maxAge: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [nodeID, node] of this.knownNodes) {
      if (now - node.lastSeen > maxAge) {
        this.knownNodes.delete(nodeID);
        cleaned++;
      }
    }

    return cleaned;
  }
}
