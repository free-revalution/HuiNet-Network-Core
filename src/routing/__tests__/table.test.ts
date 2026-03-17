import { RoutingTable, NodeInfo } from '../table';
import { NodeState, TransportType } from '../../types/connection';
import { createNodeID } from '../../types/node';

describe('RoutingTable', () => {
  let table: RoutingTable;

  beforeEach(() => {
    table = new RoutingTable();
  });

  const createMockNodeInfo = (nodeID: string, state: NodeState = NodeState.ONLINE): NodeInfo => ({
    nodeID,
    addresses: [
      {
        type: TransportType.TCP,
        host: '192.168.1.1',
        port: 8000,
        priority: 100,
        lastVerified: Date.now()
      }
    ],
    publicKey: Buffer.alloc(32, nodeID), // Unique public key per node
    metadata: {
      name: `Node-${nodeID}`,
      version: '1.0.0',
      capabilities: ['relay', 'storage'],
      startTime: Date.now()
    },
    state,
    lastSeen: Date.now(),
    connectionCount: 0
  });

  describe('Core node operations', () => {
    describe('addCoreNode', () => {
      it('should add a core node', () => {
        const nodeInfo = createMockNodeInfo('CoreNode1');
        table.addCoreNode(nodeInfo);

        expect(table.hasCoreNode('CoreNode1')).toBe(true);
        expect(table.getCoreNode('CoreNode1')).toEqual(nodeInfo);
      });

      it('should replace existing core node with same ID', () => {
        const node1 = createMockNodeInfo('CoreNode1');
        const node2 = createMockNodeInfo('CoreNode1');
        node2.connectionCount = 5;

        table.addCoreNode(node1);
        table.addCoreNode(node2);

        const retrieved = table.getCoreNode('CoreNode1');
        expect(retrieved?.connectionCount).toBe(5);
      });

      it('should handle multiple core nodes', () => {
        const nodes = [
          createMockNodeInfo('Core1'),
          createMockNodeInfo('Core2'),
          createMockNodeInfo('Core3')
        ];

        nodes.forEach(node => table.addCoreNode(node));

        expect(table.getCoreNodes().length).toBe(3);
        expect(table.hasCoreNode('Core1')).toBe(true);
        expect(table.hasCoreNode('Core2')).toBe(true);
        expect(table.hasCoreNode('Core3')).toBe(true);
      });
    });

    describe('getCoreNode', () => {
      it('should return core node if exists', () => {
        const nodeInfo = createMockNodeInfo('CoreNode1');
        table.addCoreNode(nodeInfo);

        const retrieved = table.getCoreNode('CoreNode1');
        expect(retrieved).toEqual(nodeInfo);
      });

      it('should return undefined for non-existent core node', () => {
        expect(table.getCoreNode('NonExistent')).toBeUndefined();
      });
    });

    describe('hasCoreNode', () => {
      it('should return true for existing core node', () => {
        const nodeInfo = createMockNodeInfo('CoreNode1');
        table.addCoreNode(nodeInfo);

        expect(table.hasCoreNode('CoreNode1')).toBe(true);
      });

      it('should return false for non-existent core node', () => {
        expect(table.hasCoreNode('NonExistent')).toBe(false);
      });
    });

    describe('getCoreNodes', () => {
      it('should return empty array when no core nodes', () => {
        expect(table.getCoreNodes()).toEqual([]);
      });

      it('should return all core nodes', () => {
        const node1 = createMockNodeInfo('Core1');
        const node2 = createMockNodeInfo('Core2');

        table.addCoreNode(node1);
        table.addCoreNode(node2);

        const coreNodes = table.getCoreNodes();
        expect(coreNodes.length).toBe(2);
        expect(coreNodes).toContainEqual(node1);
        expect(coreNodes).toContainEqual(node2);
      });
    });

    describe('removeCoreNode', () => {
      it('should remove core node', () => {
        const nodeInfo = createMockNodeInfo('CoreNode1');
        table.addCoreNode(nodeInfo);

        expect(table.removeCoreNode('CoreNode1')).toBe(true);
        expect(table.hasCoreNode('CoreNode1')).toBe(false);
      });

      it('should return false when removing non-existent node', () => {
        expect(table.removeCoreNode('NonExistent')).toBe(false);
      });
    });
  });

  describe('Active node operations', () => {
    describe('addActiveNode', () => {
      it('should add an active node', () => {
        const nodeInfo = createMockNodeInfo('ActiveNode1');
        table.addActiveNode(nodeInfo);

        expect(table.hasActiveNode('ActiveNode1')).toBe(true);
        expect(table.getActiveNode('ActiveNode1')).toEqual(nodeInfo);
      });

      it('should replace existing active node with same ID', () => {
        const node1 = createMockNodeInfo('ActiveNode1');
        const node2 = createMockNodeInfo('ActiveNode1');
        node2.connectionCount = 10;

        table.addActiveNode(node1);
        table.addActiveNode(node2);

        const retrieved = table.getActiveNode('ActiveNode1');
        expect(retrieved?.connectionCount).toBe(10);
      });
    });

    describe('getActiveNode', () => {
      it('should return active node if exists', () => {
        const nodeInfo = createMockNodeInfo('ActiveNode1');
        table.addActiveNode(nodeInfo);

        const retrieved = table.getActiveNode('ActiveNode1');
        expect(retrieved).toEqual(nodeInfo);
      });

      it('should return undefined for non-existent active node', () => {
        expect(table.getActiveNode('NonExistent')).toBeUndefined();
      });
    });

    describe('getActiveNodes', () => {
      it('should return empty array when no active nodes', () => {
        expect(table.getActiveNodes()).toEqual([]);
      });

      it('should return all active nodes', () => {
        const node1 = createMockNodeInfo('Active1');
        const node2 = createMockNodeInfo('Active2');

        table.addActiveNode(node1);
        table.addActiveNode(node2);

        const activeNodes = table.getActiveNodes();
        expect(activeNodes.length).toBe(2);
        expect(activeNodes).toContainEqual(node1);
        expect(activeNodes).toContainEqual(node2);
      });
    });

    describe('removeActiveNode', () => {
      it('should remove active node', () => {
        const nodeInfo = createMockNodeInfo('ActiveNode1');
        table.addActiveNode(nodeInfo);

        expect(table.removeActiveNode('ActiveNode1')).toBe(true);
        expect(table.hasActiveNode('ActiveNode1')).toBe(false);
      });

      it('should return false when removing non-existent node', () => {
        expect(table.removeActiveNode('NonExistent')).toBe(false);
      });
    });
  });

  describe('Known node operations', () => {
    describe('addKnownNode', () => {
      it('should add a known node', () => {
        const nodeInfo = createMockNodeInfo('KnownNode1');
        table.addKnownNode(nodeInfo);

        expect(table.hasKnownNode('KnownNode1')).toBe(true);
        expect(table.getKnownNode('KnownNode1')).toEqual(nodeInfo);
      });

      it('should replace existing known node with same ID', () => {
        const node1 = createMockNodeInfo('KnownNode1');
        const node2 = createMockNodeInfo('KnownNode1');
        node2.lastSeen = node1.lastSeen + 1000;

        table.addKnownNode(node1);
        table.addKnownNode(node2);

        const retrieved = table.getKnownNode('KnownNode1');
        expect(retrieved?.lastSeen).toBe(node2.lastSeen);
      });
    });

    describe('getKnownNode', () => {
      it('should return known node if exists', () => {
        const nodeInfo = createMockNodeInfo('KnownNode1');
        table.addKnownNode(nodeInfo);

        const retrieved = table.getKnownNode('KnownNode1');
        expect(retrieved).toEqual(nodeInfo);
      });

      it('should return undefined for non-existent known node', () => {
        expect(table.getKnownNode('NonExistent')).toBeUndefined();
      });
    });

    describe('getKnownNodes', () => {
      it('should return empty array when no known nodes', () => {
        expect(table.getKnownNodes()).toEqual([]);
      });

      it('should return all known nodes', () => {
        const node1 = createMockNodeInfo('Known1');
        const node2 = createMockNodeInfo('Known2');

        table.addKnownNode(node1);
        table.addKnownNode(node2);

        const knownNodes = table.getKnownNodes();
        expect(knownNodes.length).toBe(2);
        expect(knownNodes).toContainEqual(node1);
        expect(knownNodes).toContainEqual(node2);
      });
    });

    describe('removeKnownNode', () => {
      it('should remove known node', () => {
        const nodeInfo = createMockNodeInfo('KnownNode1');
        table.addKnownNode(nodeInfo);

        expect(table.removeKnownNode('KnownNode1')).toBe(true);
        expect(table.hasKnownNode('KnownNode1')).toBe(false);
      });

      it('should return false when removing non-existent node', () => {
        expect(table.removeKnownNode('NonExistent')).toBe(false);
      });
    });
  });

  describe('Unified node access', () => {
    describe('getAnyNode', () => {
      it('should prioritize core nodes over active and known', () => {
        const coreNode = createMockNodeInfo('PriorityNode');
        table.addCoreNode(coreNode);

        const found = table.getAnyNode('PriorityNode');
        expect(found).toEqual(coreNode);
      });

      it('should check active nodes if not in core', () => {
        const activeNode = createMockNodeInfo('PriorityNode2');
        table.addActiveNode(activeNode);

        const found = table.getAnyNode('PriorityNode2');
        expect(found).toEqual(activeNode);
      });

      it('should check known nodes if not in core or active', () => {
        const knownNode = createMockNodeInfo('PriorityNode3');
        table.addKnownNode(knownNode);

        const found = table.getAnyNode('PriorityNode3');
        expect(found).toEqual(knownNode);
      });

      it('should return undefined for non-existent node', () => {
        expect(table.getAnyNode('NonExistent')).toBeUndefined();
      });

      it('should prefer core node when node exists in multiple layers', () => {
        const coreNode = createMockNodeInfo('MultiLayerNode');
        const activeNode = createMockNodeInfo('MultiLayerNode');
        const knownNode = createMockNodeInfo('MultiLayerNode');

        coreNode.connectionCount = 1;
        activeNode.connectionCount = 2;
        knownNode.connectionCount = 3;

        table.addCoreNode(coreNode);
        table.addActiveNode(activeNode);
        table.addKnownNode(knownNode);

        const found = table.getAnyNode('MultiLayerNode');
        expect(found?.connectionCount).toBe(1); // Should get core node
      });
    });

    describe('hasNode', () => {
      it('should return true for core node', () => {
        const nodeInfo = createMockNodeInfo('TestNode');
        table.addCoreNode(nodeInfo);

        expect(table.hasNode('TestNode')).toBe(true);
      });

      it('should return true for active node', () => {
        const nodeInfo = createMockNodeInfo('TestNode');
        table.addActiveNode(nodeInfo);

        expect(table.hasNode('TestNode')).toBe(true);
      });

      it('should return true for known node', () => {
        const nodeInfo = createMockNodeInfo('TestNode');
        table.addKnownNode(nodeInfo);

        expect(table.hasNode('TestNode')).toBe(true);
      });

      it('should return false for non-existent node', () => {
        expect(table.hasNode('NonExistent')).toBe(false);
      });
    });

    describe('removeNode', () => {
      it('should remove node from all layers', () => {
        const nodeInfo = createMockNodeInfo('ToRemove');
        table.addCoreNode(nodeInfo);
        table.addActiveNode(nodeInfo);
        table.addKnownNode(nodeInfo);

        table.removeNode('ToRemove');

        expect(table.hasCoreNode('ToRemove')).toBe(false);
        expect(table.hasActiveNode('ToRemove')).toBe(false);
        expect(table.hasKnownNode('ToRemove')).toBe(false);
      });

      it('should handle removing node that only exists in one layer', () => {
        const nodeInfo = createMockNodeInfo('ToRemove');
        table.addActiveNode(nodeInfo);

        table.removeNode('ToRemove');

        expect(table.hasActiveNode('ToRemove')).toBe(false);
      });
    });

    describe('getAllNodes', () => {
      it('should return all nodes across all layers', () => {
        const coreNode = createMockNodeInfo('Core1');
        const activeNode = createMockNodeInfo('Active1');
        const knownNode = createMockNodeInfo('Known1');

        table.addCoreNode(coreNode);
        table.addActiveNode(activeNode);
        table.addKnownNode(knownNode);

        const allNodes = table.getAllNodes();
        expect(allNodes.length).toBe(3);
        expect(allNodes.map(n => n.nodeID)).toContain('Core1');
        expect(allNodes.map(n => n.nodeID)).toContain('Active1');
        expect(allNodes.map(n => n.nodeID)).toContain('Known1');
      });

      it('should return empty array when no nodes', () => {
        expect(table.getAllNodes()).toEqual([]);
      });

      it('should handle duplicate node IDs across layers', () => {
        const nodeInfo = createMockNodeInfo('Duplicate');
        table.addCoreNode(nodeInfo);
        table.addActiveNode(nodeInfo);
        table.addKnownNode(nodeInfo);

        const allNodes = table.getAllNodes();
        // Should return all instances if node is in multiple layers
        expect(allNodes.filter(n => n.nodeID === 'Duplicate').length).toBe(3);
      });
    });
  });

  describe('Super node operations', () => {
    describe('addSuperNode', () => {
      it('should add a super node address', () => {
        const address = {
          type: TransportType.TCP,
          host: 'super1.example.com',
          port: 9000,
          priority: 100,
          lastVerified: Date.now()
        };

        table.addSuperNode(address);

        const superNodes = table.getSuperNodes();
        expect(superNodes.length).toBe(1);
        expect(superNodes[0]).toEqual(address);
      });

      it('should prevent duplicate super nodes', () => {
        const address = {
          type: TransportType.TCP,
          host: 'super1.example.com',
          port: 9000,
          priority: 100,
          lastVerified: Date.now()
        };

        table.addSuperNode(address);
        table.addSuperNode(address);

        expect(table.getSuperNodes().length).toBe(1);
      });

      it('should allow multiple super nodes', () => {
        const address1 = {
          type: TransportType.TCP,
          host: 'super1.example.com',
          port: 9000,
          priority: 100,
          lastVerified: Date.now()
        };

        const address2 = {
          type: TransportType.TCP,
          host: 'super2.example.com',
          port: 9000,
          priority: 100,
          lastVerified: Date.now()
        };

        table.addSuperNode(address1);
        table.addSuperNode(address2);

        expect(table.getSuperNodes().length).toBe(2);
      });
    });

    describe('getSuperNodes', () => {
      it('should return empty array when no super nodes', () => {
        expect(table.getSuperNodes()).toEqual([]);
      });

      it('should return copy of super nodes array', () => {
        const address = {
          type: TransportType.TCP,
          host: 'super1.example.com',
          port: 9000,
          priority: 100,
          lastVerified: Date.now()
        };

        table.addSuperNode(address);

        const superNodes1 = table.getSuperNodes();
        const superNodes2 = table.getSuperNodes();

        expect(superNodes1).not.toBe(superNodes2); // Different references
        expect(superNodes1).toEqual(superNodes2); // Same content
      });
    });
  });

  describe('Bootstrap node operations', () => {
    describe('addBootstrapNode', () => {
      it('should add a bootstrap node address', () => {
        const address = {
          type: TransportType.TCP,
          host: 'bootstrap.example.com',
          port: 8000,
          priority: 100,
          lastVerified: Date.now()
        };

        table.addBootstrapNode(address);

        const bootstrapNodes = table.getBootstrapNodes();
        expect(bootstrapNodes.length).toBe(1);
        expect(bootstrapNodes[0]).toEqual(address);
      });

      it('should prevent duplicate bootstrap nodes', () => {
        const address = {
          type: TransportType.TCP,
          host: 'bootstrap.example.com',
          port: 8000,
          priority: 100,
          lastVerified: Date.now()
        };

        table.addBootstrapNode(address);
        table.addBootstrapNode(address);

        expect(table.getBootstrapNodes().length).toBe(1);
      });
    });

    describe('getBootstrapNodes', () => {
      it('should return empty array when no bootstrap nodes', () => {
        expect(table.getBootstrapNodes()).toEqual([]);
      });

      it('should return copy of bootstrap nodes array', () => {
        const address = {
          type: TransportType.TCP,
          host: 'bootstrap.example.com',
          port: 8000,
          priority: 100,
          lastVerified: Date.now()
        };

        table.addBootstrapNode(address);

        const bootstrapNodes1 = table.getBootstrapNodes();
        const bootstrapNodes2 = table.getBootstrapNodes();

        expect(bootstrapNodes1).not.toBe(bootstrapNodes2); // Different references
        expect(bootstrapNodes1).toEqual(bootstrapNodes2); // Same content
      });
    });
  });

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should return zero stats for empty table', () => {
        const stats = table.getStats();

        expect(stats.totalNodes).toBe(0);
        expect(stats.coreCount).toBe(0);
        expect(stats.activeCount).toBe(0);
        expect(stats.knownCount).toBe(0);
        expect(stats.superNodeCount).toBe(0);
        expect(stats.bootstrapCount).toBe(0);
      });

      it('should count nodes correctly', () => {
        const coreNode = createMockNodeInfo('Core1');
        const activeNode = createMockNodeInfo('Active1');
        const knownNode = createMockNodeInfo('Known1');

        table.addCoreNode(coreNode);
        table.addActiveNode(activeNode);
        table.addKnownNode(knownNode);

        const stats = table.getStats();

        expect(stats.coreCount).toBe(1);
        expect(stats.activeCount).toBe(1);
        expect(stats.knownCount).toBe(1);
        expect(stats.totalNodes).toBe(3);
      });

      it('should count super and bootstrap nodes', () => {
        const superNode = {
          type: TransportType.TCP,
          host: 'super1.example.com',
          port: 9000,
          priority: 100,
          lastVerified: Date.now()
        };

        const bootstrapNode = {
          type: TransportType.TCP,
          host: 'bootstrap.example.com',
          port: 8000,
          priority: 100,
          lastVerified: Date.now()
        };

        table.addSuperNode(superNode);
        table.addBootstrapNode(bootstrapNode);

        const stats = table.getStats();

        expect(stats.superNodeCount).toBe(1);
        expect(stats.bootstrapCount).toBe(1);
      });
    });
  });

  describe('Node promotion/demotion', () => {
    describe('promoteToActive', () => {
      it('should promote known node to active', () => {
        const nodeInfo = createMockNodeInfo('PromoteMe');
        table.addKnownNode(nodeInfo);

        const result = table.promoteToActive('PromoteMe');

        expect(result).toBe(true);
        expect(table.hasActiveNode('PromoteMe')).toBe(true);
        expect(table.hasKnownNode('PromoteMe')).toBe(false);
      });

      it('should promote core node to active (demote)', () => {
        const nodeInfo = createMockNodeInfo('DemoteMe');
        table.addCoreNode(nodeInfo);

        const result = table.promoteToActive('DemoteMe');

        expect(result).toBe(true);
        expect(table.hasActiveNode('DemoteMe')).toBe(true);
        // Note: The implementation doesn't remove from core when promoting to active
        expect(table.hasCoreNode('DemoteMe')).toBe(true); // Still in core
      });

      it('should return false for non-existent node', () => {
        const result = table.promoteToActive('NonExistent');
        expect(result).toBe(false);
      });
    });

    describe('promoteToCore', () => {
      it('should promote active node to core', () => {
        const nodeInfo = createMockNodeInfo('PromoteMe');
        table.addActiveNode(nodeInfo);

        const result = table.promoteToCore('PromoteMe');

        expect(result).toBe(true);
        expect(table.hasCoreNode('PromoteMe')).toBe(true);
        expect(table.hasActiveNode('PromoteMe')).toBe(false);
      });

      it('should promote known node to core', () => {
        const nodeInfo = createMockNodeInfo('PromoteMe');
        table.addKnownNode(nodeInfo);

        const result = table.promoteToCore('PromoteMe');

        expect(result).toBe(true);
        expect(table.hasCoreNode('PromoteMe')).toBe(true);
        expect(table.hasKnownNode('PromoteMe')).toBe(false);
      });

      it('should return false for non-existent node', () => {
        const result = table.promoteToCore('NonExistent');
        expect(result).toBe(false);
      });
    });

    describe('demoteToActive', () => {
      it('should demote core node to active', () => {
        const nodeInfo = createMockNodeInfo('DemoteMe');
        table.addCoreNode(nodeInfo);

        const result = table.demoteToActive('DemoteMe');

        expect(result).toBe(true);
        expect(table.hasActiveNode('DemoteMe')).toBe(true);
        expect(table.hasCoreNode('DemoteMe')).toBe(false);
      });

      it('should return false for non-existent node', () => {
        const result = table.demoteToActive('NonExistent');
        expect(result).toBe(false);
      });
    });

    describe('demoteToKnown', () => {
      it('should demote active node to known', () => {
        const nodeInfo = createMockNodeInfo('DemoteMe');
        table.addActiveNode(nodeInfo);

        const result = table.demoteToKnown('DemoteMe');

        expect(result).toBe(true);
        expect(table.hasKnownNode('DemoteMe')).toBe(true);
        expect(table.hasActiveNode('DemoteMe')).toBe(false);
      });

      it('should demote core node to known', () => {
        const nodeInfo = createMockNodeInfo('DemoteMe');
        table.addCoreNode(nodeInfo);

        const result = table.demoteToKnown('DemoteMe');

        expect(result).toBe(true);
        expect(table.hasKnownNode('DemoteMe')).toBe(true);
        expect(table.hasCoreNode('DemoteMe')).toBe(false);
      });

      it('should return false for non-existent node', () => {
        const result = table.demoteToKnown('NonExistent');
        expect(result).toBe(false);
      });
    });
  });

  describe('Cleanup', () => {
    describe('cleanup', () => {
      it('should remove stale known nodes', () => {
        const oldNode = createMockNodeInfo('OldNode');
        oldNode.lastSeen = Date.now() - 7200000; // 2 hours ago

        const recentNode = createMockNodeInfo('RecentNode');
        recentNode.lastSeen = Date.now() - 1800000; // 30 minutes ago

        table.addKnownNode(oldNode);
        table.addKnownNode(recentNode);

        const cleaned = table.cleanup(3600000); // 1 hour max age

        expect(cleaned).toBe(1);
        expect(table.hasKnownNode('OldNode')).toBe(false);
        expect(table.hasKnownNode('RecentNode')).toBe(true);
      });

      it('should not affect core or active nodes', () => {
        const oldCoreNode = createMockNodeInfo('OldCore');
        oldCoreNode.lastSeen = Date.now() - 7200000;

        const oldActiveNode = createMockNodeInfo('OldActive');
        oldActiveNode.lastSeen = Date.now() - 7200000;

        table.addCoreNode(oldCoreNode);
        table.addActiveNode(oldActiveNode);

        table.cleanup(3600000);

        expect(table.hasCoreNode('OldCore')).toBe(true);
        expect(table.hasActiveNode('OldActive')).toBe(true);
      });

      it('should use default max age if not specified', () => {
        const veryOldNode = createMockNodeInfo('VeryOld');
        veryOldNode.lastSeen = Date.now() - 7200000; // 2 hours ago

        table.addKnownNode(veryOldNode);

        const cleaned = table.cleanup(); // Default 1 hour

        expect(cleaned).toBe(1);
        expect(table.hasKnownNode('VeryOld')).toBe(false);
      });

      it('should return 0 when no stale nodes', () => {
        const recentNode = createMockNodeInfo('Recent');
        recentNode.lastSeen = Date.now();

        table.addKnownNode(recentNode);

        const cleaned = table.cleanup(3600000);

        expect(cleaned).toBe(0);
        expect(table.hasKnownNode('Recent')).toBe(true);
      });
    });
  });
});
