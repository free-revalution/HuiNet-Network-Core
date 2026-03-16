import { RoutingTable } from '../table';
import { NodeState, TransportType } from '../../types/connection';

describe('RoutingTable', () => {
  let table: RoutingTable;

  beforeEach(() => {
    table = new RoutingTable();
  });

  describe('addCoreNode', () => {
    it('should add a core node', () => {
      const nodeInfo = {
        nodeID: 'CoreNode1',
        addresses: [{ type: TransportType.TCP, host: '1.2.3.4', port: 8000, priority: 100, lastVerified: Date.now() }],
        publicKey: Buffer.alloc(32),
        metadata: { version: '1.0.0', capabilities: [], startTime: Date.now() },
        state: NodeState.ONLINE,
        lastSeen: Date.now(),
        connectionCount: 0,
      };

      table.addCoreNode(nodeInfo);

      expect(table.hasCoreNode('CoreNode1')).toBe(true);
      expect(table.getCoreNode('CoreNode1')).toEqual(nodeInfo);
    });
  });

  describe('getActiveNode', () => {
    it('should return active node if exists', () => {
      const nodeInfo = {
        nodeID: 'ActiveNode1',
        addresses: [{ type: TransportType.TCP, host: '1.2.3.4', port: 8000, priority: 100, lastVerified: Date.now() }],
        publicKey: Buffer.alloc(32),
        metadata: { version: '1.0.0', capabilities: [], startTime: Date.now() },
        state: NodeState.ONLINE,
        lastSeen: Date.now(),
        connectionCount: 0,
      };

      table.addActiveNode(nodeInfo);

      const retrieved = table.getActiveNode('ActiveNode1');
      expect(retrieved).toEqual(nodeInfo);
    });

    it('should return undefined for non-existent node', () => {
      expect(table.getActiveNode('NonExistent')).toBeUndefined();
    });
  });

  describe('getAnyNode', () => {
    it('should check core nodes first, then active, then known', () => {
      const coreNode = {
        nodeID: 'CoreNode1',
        addresses: [{ type: TransportType.TCP, host: '1.2.3.4', port: 8000, priority: 100, lastVerified: Date.now() }],
        publicKey: Buffer.alloc(32),
        metadata: { version: '1.0.0', capabilities: [], startTime: Date.now() },
        state: NodeState.ONLINE,
        lastSeen: Date.now(),
        connectionCount: 0,
      };

      table.addCoreNode(coreNode);

      const found = table.getAnyNode('CoreNode1');
      expect(found).toEqual(coreNode);
    });
  });

  describe('removeNode', () => {
    it('should remove node from all layers', () => {
      const nodeInfo = {
        nodeID: 'ToRemove',
        addresses: [{ type: TransportType.TCP, host: '1.2.3.4', port: 8000, priority: 100, lastVerified: Date.now() }],
        publicKey: Buffer.alloc(32),
        metadata: { version: '1.0.0', capabilities: [], startTime: Date.now() },
        state: NodeState.ONLINE,
        lastSeen: Date.now(),
        connectionCount: 0,
      };

      table.addActiveNode(nodeInfo);
      expect(table.getActiveNode('ToRemove')).toBeDefined();

      table.removeNode('ToRemove');
      expect(table.getActiveNode('ToRemove')).toBeUndefined();
    });
  });

  describe('getAllNodes', () => {
    it('should return all nodes across all layers', () => {
      const coreNode = {
        nodeID: 'Core1',
        addresses: [{ type: TransportType.TCP, host: '1.2.3.4', port: 8000, priority: 100, lastVerified: Date.now() }],
        publicKey: Buffer.alloc(32),
        metadata: { version: '1.0.0', capabilities: [], startTime: Date.now() },
        state: NodeState.ONLINE,
        lastSeen: Date.now(),
        connectionCount: 0,
      };

      const activeNode = {
        nodeID: 'Active1',
        addresses: [{ type: TransportType.TCP, host: '5.6.7.8', port: 8000, priority: 100, lastVerified: Date.now() }],
        publicKey: Buffer.alloc(32),
        metadata: { version: '1.0.0', capabilities: [], startTime: Date.now() },
        state: NodeState.ONLINE,
        lastSeen: Date.now(),
        connectionCount: 0,
      };

      table.addCoreNode(coreNode);
      table.addActiveNode(activeNode);

      const allNodes = table.getAllNodes();
      expect(allNodes.length).toBe(2);
      expect(allNodes.map(n => n.nodeID)).toContain('Core1');
      expect(allNodes.map(n => n.nodeID)).toContain('Active1');
    });
  });
});
