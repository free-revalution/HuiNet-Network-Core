import { EventEmitter } from 'events';
import dgram from 'dgram';
import { MDiscoveryService } from '../mdns';

// Mock dgram module
jest.mock('dgram');

describe('MDiscoveryService', () => {
  let mockSocket: any;
  let service: MDiscoveryService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock socket
    mockSocket = new EventEmitter();
    mockSocket.bind = jest.fn((port: number, address: string, callback?: () => void) => {
      if (callback) callback();
      mockSocket.emit('listening');
    });
    mockSocket.close = jest.fn((callback?: () => void) => {
      if (callback) callback();
    });
    mockSocket.send = jest.fn();
    mockSocket.addMembership = jest.fn();
    mockSocket.setBroadcast = jest.fn();
    mockSocket.setMulticastTTL = jest.fn();
    mockSocket.address = jest.fn(() => ({ port: 43000, address: '0.0.0.0' }));

    (dgram.createSocket as jest.Mock).mockReturnValue(mockSocket);

    service = new MDiscoveryService({
      nodeId: 'test-node-id',
      port: 8080,
    });
  });

  afterEach(() => {
    if (service.isRunning()) {
      service.stop();
    }
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const defaultService = new MDiscoveryService({
        nodeId: 'test-node-id',
        port: 8080,
      });
      expect(defaultService).toBeInstanceOf(MDiscoveryService);
      expect(defaultService.isRunning()).toBe(false);
    });

    it('should create instance with custom options', () => {
      const customService = new MDiscoveryService({
        nodeId: 'custom-node-id',
        port: 9000,
        multicastAddress: '239.255.255.250',
        multicastPort: 5353,
      });
      expect(customService).toBeInstanceOf(MDiscoveryService);
    });
  });

  describe('start()', () => {
    it('should start the discovery service', async () => {
      await service.start();

      expect(dgram.createSocket).toHaveBeenCalledWith('udp4');
      expect(mockSocket.bind).toHaveBeenCalledWith(
        43000,
        '0.0.0.0',
        expect.any(Function)
      );
      expect(mockSocket.addMembership).toHaveBeenCalledWith('224.0.0.114');
      expect(mockSocket.setBroadcast).toHaveBeenCalledWith(true);
      expect(mockSocket.setMulticastTTL).toHaveBeenCalledWith(1);
      expect(service.isRunning()).toBe(true);
    });

    it('should emit listening event when started', async () => {
      const listeningSpy = jest.fn();
      service.on('listening', listeningSpy);

      await service.start();

      expect(listeningSpy).toHaveBeenCalled();
    });

    it('should handle multiple start calls gracefully', async () => {
      await service.start();
      await service.start();

      expect(dgram.createSocket).toHaveBeenCalledTimes(1);
      expect(service.isRunning()).toBe(true);
    });

    it('should handle bind errors', async () => {
      const error = new Error('Bind failed');
      mockSocket.bind = jest.fn((port: number, address: string, callback?: () => void) => {
        // Emit error before calling callback
        mockSocket.emit('error', error);
        if (callback) callback();
      });

      await expect(service.start()).rejects.toThrow('Bind failed');
    });
  });

  describe('stop()', () => {
    it('should stop the discovery service', async () => {
      await service.start();
      expect(service.isRunning()).toBe(true);

      await service.stop();

      expect(mockSocket.close).toHaveBeenCalled();
      expect(service.isRunning()).toBe(false);
    });

    it('should handle stop when not running', async () => {
      await service.stop();
      expect(service.isRunning()).toBe(false);
    });

    it('should emit stopped event', async () => {
      await service.start();
      const stoppedSpy = jest.fn();
      service.on('stopped', stoppedSpy);

      await service.stop();

      expect(stoppedSpy).toHaveBeenCalled();
    });
  });

  describe('announce()', () => {
    it('should send announcement when running', async () => {
      await service.start();

      service.announce();

      expect(mockSocket.send).toHaveBeenCalled();
      const callArgs = (mockSocket.send as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBeInstanceOf(Buffer);
      expect(callArgs[1]).toBe(43000);
      expect(callArgs[2]).toBe('224.0.0.114');

      // Verify message format
      const message = JSON.parse(callArgs[0].toString());
      expect(message.type).toBe('announce');
      expect(message.nodeId).toBe('test-node-id');
      expect(message.port).toBe(8080);
      expect(message.timestamp).toBeDefined();
    });

    it('should not send announcement when not running', () => {
      service.announce();

      expect(mockSocket.send).not.toHaveBeenCalled();
    });

    it('should include custom metadata in announcement', async () => {
      const customService = new MDiscoveryService({
        nodeId: 'test-node-id',
        port: 8080,
        metadata: { version: '1.0.0', features: ['relay'] },
      });

      await customService.start();
      customService.announce();

      const callArgs = (mockSocket.send as jest.Mock).mock.calls[0];
      const message = JSON.parse(callArgs[0].toString());
      expect(message.metadata).toEqual({ version: '1.0.0', features: ['relay'] });
    });
  });

  describe('message handling', () => {
    it('should emit discovered event on receiving announce', async () => {
      await service.start();

      const discoveredSpy = jest.fn();
      service.on('discovered', discoveredSpy);

      const announceMessage = JSON.stringify({
        type: 'announce',
        nodeId: 'remote-node-id',
        port: 9000,
        timestamp: Date.now(),
      });

      // Simulate receiving a message
      mockSocket.emit('message', Buffer.from(announceMessage), {
        address: '192.168.1.100',
        port: 43000,
      });

      expect(discoveredSpy).toHaveBeenCalledWith({
        nodeId: 'remote-node-id',
        port: 9000,
        address: '192.168.1.100',
        timestamp: expect.any(Number),
      });
    });

    it('should ignore own messages', async () => {
      await service.start();

      const discoveredSpy = jest.fn();
      service.on('discovered', discoveredSpy);

      const announceMessage = JSON.stringify({
        type: 'announce',
        nodeId: 'test-node-id', // Same as local node
        port: 8080,
        timestamp: Date.now(),
      });

      mockSocket.emit('message', Buffer.from(announceMessage), {
        address: '192.168.1.100',
        port: 43000,
      });

      expect(discoveredSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid messages gracefully', async () => {
      await service.start();

      const errorSpy = jest.fn();
      service.on('error', errorSpy);

      mockSocket.emit('message', Buffer.from('invalid json'), {
        address: '192.168.1.100',
        port: 43000,
      });

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle messages missing required fields', async () => {
      await service.start();

      const discoveredSpy = jest.fn();
      service.on('discovered', discoveredSpy);

      const incompleteMessage = JSON.stringify({
        type: 'announce',
        nodeId: 'remote-node-id',
        // Missing port
      });

      mockSocket.emit('message', Buffer.from(incompleteMessage), {
        address: '192.168.1.100',
        port: 43000,
      });

      expect(discoveredSpy).not.toHaveBeenCalled();
    });
  });

  describe('isRunning()', () => {
    it('should return false when not started', () => {
      expect(service.isRunning()).toBe(false);
    });

    it('should return true when started', async () => {
      await service.start();
      expect(service.isRunning()).toBe(true);
    });

    it('should return false after stop', async () => {
      await service.start();
      await service.stop();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should emit error on socket errors', async () => {
      await service.start();

      const errorSpy = jest.fn();
      service.on('error', errorSpy);

      const socketError = new Error('Socket error');
      mockSocket.emit('error', socketError);

      expect(errorSpy).toHaveBeenCalledWith(socketError);
    });

    it('should handle multiple event listeners', async () => {
      await service.start();

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      service.on('discovered', listener1);
      service.on('discovered', listener2);

      const announceMessage = JSON.stringify({
        type: 'announce',
        nodeId: 'remote-node-id',
        port: 9000,
        timestamp: Date.now(),
      });

      mockSocket.emit('message', Buffer.from(announceMessage), {
        address: '192.168.1.100',
        port: 43000,
      });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove all listeners on stop', async () => {
      await service.start();

      const discoveredSpy = jest.fn();
      service.on('discovered', discoveredSpy);

      await service.stop();

      // Send message after stop
      const announceMessage = JSON.stringify({
        type: 'announce',
        nodeId: 'remote-node-id',
        port: 9000,
        timestamp: Date.now(),
      });

      mockSocket.emit('message', Buffer.from(announceMessage), {
        address: '192.168.1.100',
        port: 43000,
      });

      expect(discoveredSpy).not.toHaveBeenCalled();
    });
  });
});
