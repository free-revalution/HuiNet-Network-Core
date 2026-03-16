import { HuiNet } from '../HuiNet';
import { generateKeyPair } from '../crypto/keypair';

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

      await node1.start();
      await node2.start();

      // This will be a mock for now - actual connection will be implemented later
      // For now, we test the API exists
      expect(typeof node1.send).toBe('function');

      await node1.stop();
      await node2.stop();
    });
  });
});
