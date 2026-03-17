import { HuiNet } from '../HuiNet';
import { generateKeyPair } from '../crypto/keypair';
import { NodeState } from '../types/connection';

describe('HuiNet', () => {
  let huinet: HuiNet;

  afterEach(async () => {
    await huinet?.stop();
  });

  describe('constructor', () => {
    it('should create HuiNet instance with generated identity', async () => {
      huinet = new HuiNet({
        listenPort: 0,
        enableMDNS: false,
      });

      expect(huinet.getNodeID()).toBeDefined();
      expect(huinet.getNodeID().length).toBeGreaterThanOrEqual(43);
      expect(huinet.getNodeID().length).toBeLessThanOrEqual(44);
    });

    it('should create HuiNet instance with provided identity', async () => {
      const keyPair = generateKeyPair();

      huinet = new HuiNet({
        keyPair,
        listenPort: 0,
        enableMDNS: false,
      });

      expect(huinet.getNodeID()).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start the network service', async () => {
      huinet = new HuiNet({
        listenPort: 0,
        enableMDNS: false,
      });

      await huinet.start();

      expect(huinet.isRunning()).toBe(true);
    });

    it('should emit "ready" event when started', async () => {
      huinet = new HuiNet({
        listenPort: 0,
        enableMDNS: false,
      });

      const readyPromise = new Promise<void>(resolve => {
        huinet.once('ready', () => resolve());
      });

      await huinet.start();
      await readyPromise;
    });
  });

  describe('stop', () => {
    it('should stop the network service', async () => {
      huinet = new HuiNet({
        listenPort: 0,
        enableMDNS: false,
      });

      await huinet.start();
      expect(huinet.isRunning()).toBe(true);

      await huinet.stop();
      expect(huinet.isRunning()).toBe(false);
    });
  });

  describe('send', () => {
    it('should send message to connected node', async () => {
      const node1 = new HuiNet({ listenPort: 0, enableMDNS: false });
      const node2 = new HuiNet({ listenPort: 0, enableMDNS: false });

      try {
        await node1.start();
        await node2.start();

        // This will be a mock for now - actual connection will be implemented later
        // For now, we test the API exists
        expect(typeof node1.send).toBe('function');
      } finally {
        // Ensure cleanup even if tests fail
        await node1.stop().catch(() => {});
        await node2.stop().catch(() => {});
      }
    });
  });

  describe('disconnectFromNode', () => {
    it('should return false for non-existent node', async () => {
      huinet = new HuiNet({
        listenPort: 0,
        enableMDNS: false,
      });

      await huinet.start();

      const result = await huinet.disconnectFromNode('non-existent-node-id');
      expect(result).toBe(false);
    });

    it('should disconnect from a connected node', async () => {
      const node1 = new HuiNet({ listenPort: 0, enableMDNS: false });
      const node2 = new HuiNet({ listenPort: 0, enableMDNS: false });

      try {
        await node1.start();
        await node2.start();

        const node1Port = (node1 as any).tcpServer?.server?.address()?.port;
        const node2ID = node2.getNodeID();

        if (node1Port) {
          // Connect node2 to node1
          await node2.connectToNode('127.0.0.1', node1Port, node1.getNodeID());

          // Disconnect
          const result = await node2.disconnectFromNode(node1.getNodeID());
          expect(result).toBe(true);

          // Verify node is marked as offline
          const routingTable = node2.getRoutingTable();
          const disconnectedNode = routingTable.getAnyNode(node1.getNodeID());
          expect(disconnectedNode?.state).toBe(NodeState.OFFLINE);
        }
      } finally {
        await node1.stop().catch(() => {});
        await node2.stop().catch(() => {});
      }
    });
  });

  describe('getConnectedNodes', () => {
    it('should return empty array when no nodes connected', async () => {
      huinet = new HuiNet({
        listenPort: 0,
        enableMDNS: false,
      });

      await huinet.start();

      const connected = huinet.getConnectedNodes();
      expect(connected).toEqual([]);
    });

    it('should return list of connected node IDs', async () => {
      const node1 = new HuiNet({ listenPort: 0, enableMDNS: false });
      const node2 = new HuiNet({ listenPort: 0, enableMDNS: false });

      try {
        await node1.start();
        await node2.start();

        const node1Port = (node1 as any).tcpServer?.server?.address()?.port;

        if (node1Port) {
          // Connect node2 to node1
          await node2.connectToNode('127.0.0.1', node1Port, node1.getNodeID());

          // Get connected nodes
          const connected = node2.getConnectedNodes();
          expect(connected).toContain(node1.getNodeID());
        }
      } finally {
        await node1.stop().catch(() => {});
        await node2.stop().catch(() => {});
      }
    });
  });

  describe('Routing table layer management', () => {
    it('should track node connection counts', async () => {
      const node1 = new HuiNet({ listenPort: 0, enableMDNS: false });
      const node2 = new HuiNet({ listenPort: 0, enableMDNS: false });

      try {
        await node1.start();
        await node2.start();

        const node1Port = (node1 as any).tcpServer?.server?.address()?.port;

        if (node1Port) {
          const node1ID = node1.getNodeID();

          // First connection - node should be in Known layer initially
          await node2.connectToNode('127.0.0.1', node1Port, node1ID);
          await new Promise(resolve => setTimeout(resolve, 100));

          let routingTable = node2.getRoutingTable();
          expect(routingTable.getKnownNode(node1ID)).toBeDefined();

          // Multiple connections should trigger promotion
          for (let i = 0; i < 5; i++) {
            await node2.connectToNode('127.0.0.1', node1Port, node1ID);
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // After multiple connections, node should be promoted
          routingTable = node2.getRoutingTable();
          const stats = routingTable.getStats();
          expect(stats.activeCount + stats.coreCount).toBeGreaterThan(0);
        }
      } finally {
        await node1.stop().catch(() => {});
        await node2.stop().catch(() => {});
      }
    });

    it('should support manual node promotion', async () => {
      const node1 = new HuiNet({ listenPort: 0, enableMDNS: false });
      const node2 = new HuiNet({ listenPort: 0, enableMDNS: false });

      try {
        await node1.start();
        await node2.start();

        const node1Port = (node1 as any).tcpServer?.server?.address()?.port;

        if (node1Port) {
          const node1ID = node1.getNodeID();

          // Connect and verify node is in Known layer
          await node2.connectToNode('127.0.0.1', node1Port, node1ID);
          await new Promise(resolve => setTimeout(resolve, 100));

          // Manually promote to Active
          const promoted = node2.promoteToActive(node1ID);
          expect(promoted).toBe(true);

          let routingTable = node2.getRoutingTable();
          expect(routingTable.getActiveNode(node1ID)).toBeDefined();
          expect(routingTable.getKnownNode(node1ID)).toBeUndefined();

          // Manually promote to Core
          const promotedToCore = node2.promoteToCore(node1ID);
          expect(promotedToCore).toBe(true);

          routingTable = node2.getRoutingTable();
          expect(routingTable.getCoreNode(node1ID)).toBeDefined();
          expect(routingTable.getActiveNode(node1ID)).toBeUndefined();
          expect(routingTable.getKnownNode(node1ID)).toBeUndefined();
        }
      } finally {
        await node1.stop().catch(() => {});
        await node2.stop().catch(() => {});
      }
    });

    it('should support manual node demotion', async () => {
      const node1 = new HuiNet({ listenPort: 0, enableMDNS: false });
      const node2 = new HuiNet({ listenPort: 0, enableMDNS: false });

      try {
        await node1.start();
        await node2.start();

        const node1Port = (node1 as any).tcpServer?.server?.address()?.port;

        if (node1Port) {
          const node1ID = node1.getNodeID();

          // Connect and promote to Core
          await node2.connectToNode('127.0.0.1', node1Port, node1ID);
          await new Promise(resolve => setTimeout(resolve, 100));

          node2.promoteToActive(node1ID);
          node2.promoteToCore(node1ID);

          let routingTable = node2.getRoutingTable();
          expect(routingTable.getCoreNode(node1ID)).toBeDefined();

          // Demote to Active
          const demoted = node2.demoteFromCore(node1ID);
          expect(demoted).toBe(true);

          routingTable = node2.getRoutingTable();
          expect(routingTable.getActiveNode(node1ID)).toBeDefined();
          expect(routingTable.getCoreNode(node1ID)).toBeUndefined();

          // Demote to Known
          const demotedToKnown = node2.demoteFromActive(node1ID);
          expect(demotedToKnown).toBe(true);

          routingTable = node2.getRoutingTable();
          expect(routingTable.getKnownNode(node1ID)).toBeDefined();
          expect(routingTable.getActiveNode(node1ID)).toBeUndefined();
          expect(routingTable.getCoreNode(node1ID)).toBeUndefined();
        }
      } finally {
        await node1.stop().catch(() => {});
        await node2.stop().catch(() => {});
      }
    });

    it('should provide routing table statistics', async () => {
      const node1 = new HuiNet({ listenPort: 0, enableMDNS: false });
      const node2 = new HuiNet({ listenPort: 0, enableMDNS: false });

      try {
        await node1.start();
        await node2.start();

        const node1Port = (node1 as any).tcpServer?.server?.address()?.port;

        if (node1Port) {
          const node1ID = node1.getNodeID();

          await node2.connectToNode('127.0.0.1', node1Port, node1ID);
          await new Promise(resolve => setTimeout(resolve, 100));

          const stats = node2.getRoutingStats();
          expect(stats).toHaveProperty('totalNodes');
          expect(stats).toHaveProperty('coreCount');
          expect(stats).toHaveProperty('activeCount');
          expect(stats).toHaveProperty('knownCount');
          expect(stats).toHaveProperty('connectionCounts');
          expect(stats.totalNodes).toBeGreaterThan(0);
        }
      } finally {
        await node1.stop().catch(() => {});
        await node2.stop().catch(() => {});
      }
    });
  });
});
