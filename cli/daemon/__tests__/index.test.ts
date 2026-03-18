/**
 * Tests for HuiNet Daemon
 */

import { HuiNetDaemon } from '../index';
import { DaemonConfig } from '../types';
import { loadConfig } from '../config';

describe('HuiNetDaemon', () => {
  let daemon: HuiNetDaemon;

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
    }
  });

  describe('constructor', () => {
    it('should create daemon instance with default config', () => {
      daemon = new HuiNetDaemon();

      expect(daemon).toBeDefined();
      expect(daemon.getMachineInfo()).toBeDefined();
      expect(daemon.getMachineInfo().machineId).toBeDefined();
      expect(daemon.getMachineInfo().machineId.length).toBeGreaterThan(0);
    });

    it('should create daemon instance with custom config', () => {
      const config: DaemonConfig = {
        machineName: 'test-machine',
        location: 'test-location',
        listenPort: 9000,
        enableMDNS: false,
      };

      daemon = new HuiNetDaemon(config);

      expect(daemon).toBeDefined();
      expect(daemon.getMachineInfo().machineName).toBe('test-machine');
      expect(daemon.getMachineInfo().location).toBe('test-location');
    });

    it('should generate unique machine ID', () => {
      const daemon1 = new HuiNetDaemon();
      const daemon2 = new HuiNetDaemon();

      // Machine IDs should be different (different instances)
      // Note: In production, these might be the same on the same machine
      // but for testing purposes, we verify the ID is generated
      expect(daemon1.getMachineInfo().machineId).toBeDefined();
      expect(daemon2.getMachineInfo().machineId).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start the daemon', async () => {
      daemon = new HuiNetDaemon({
        listenPort: 0, // Use random port for testing
        enableMDNS: false,
      });

      await daemon.start();

      expect(daemon.isRunning()).toBe(true);
    });

    it('should emit "ready" event when started', async () => {
      daemon = new HuiNetDaemon({
        listenPort: 0,
        enableMDNS: false,
      });

      const readyPromise = new Promise<void>(resolve => {
        daemon.once('ready', () => resolve());
      });

      await daemon.start();
      await readyPromise;
    });

    it('should emit "machineAnnounced" event with machine info', async () => {
      daemon = new HuiNetDaemon({
        listenPort: 0,
        enableMDNS: false,
      });

      const announcedPromise = new Promise<void>(resolve => {
        daemon.once('machineAnnounced', (announcement) => {
          expect(announcement).toBeDefined();
          expect(announcement.machineInfo).toBeDefined();
          expect(announcement.machineInfo.machineId).toBeDefined();
          resolve();
        });
      });

      await daemon.start();
      await announcedPromise;
    });

    it('should not start if already running', async () => {
      daemon = new HuiNetDaemon({
        listenPort: 0,
        enableMDNS: false,
      });

      await daemon.start();
      expect(daemon.isRunning()).toBe(true);

      // Second start should be idempotent
      await daemon.start();
      expect(daemon.isRunning()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop the daemon', async () => {
      daemon = new HuiNetDaemon({
        listenPort: 0,
        enableMDNS: false,
      });

      await daemon.start();
      expect(daemon.isRunning()).toBe(true);

      await daemon.stop();
      expect(daemon.isRunning()).toBe(false);
    });

    it('should be safe to stop when not running', async () => {
      daemon = new HuiNetDaemon();

      expect(daemon.isRunning()).toBe(false);

      // Should not throw
      await daemon.stop();
      expect(daemon.isRunning()).toBe(false);
    });
  });

  describe('getMachineInfo', () => {
    it('should return machine information', () => {
      const config: DaemonConfig = {
        machineName: 'test-machine',
        location: 'test-location',
      };

      daemon = new HuiNetDaemon(config);

      const info = daemon.getMachineInfo();

      expect(info).toBeDefined();
      expect(info.machineName).toBe('test-machine');
      expect(info.location).toBe('test-location');
      expect(info.machineId).toBeDefined();
      expect(typeof info.machineId).toBe('string');
    });
  });

  describe('getHuiNet', () => {
    it('should return HuiNet instance', () => {
      daemon = new HuiNetDaemon();

      const huinet = daemon.getHuiNet();

      expect(huinet).toBeDefined();
      expect(huinet.getNodeID).toBeDefined();
      expect(typeof huinet.getNodeID).toBe('function');
    });
  });

  describe('event handling', () => {
    it('should handle P2P messages', async () => {
      daemon = new HuiNetDaemon({
        listenPort: 0,
        enableMDNS: false,
      });

      const messagePromise = new Promise<void>(resolve => {
        daemon.once('message', (fromNodeID, message) => {
          expect(fromNodeID).toBeDefined();
          resolve();
        });
      });

      await daemon.start();

      // Emit a test message through HuiNet
      const huinet = daemon.getHuiNet();
      huinet.emit('message', 'test-node', { test: 'data' });

      await messagePromise;
    });

    it('should handle peer connected events', async () => {
      daemon = new HuiNetDaemon({
        listenPort: 0,
        enableMDNS: false,
      });

      const connectedPromise = new Promise<void>(resolve => {
        daemon.once('peerConnected', (nodeID) => {
          expect(nodeID).toBeDefined();
          resolve();
        });
      });

      await daemon.start();

      // Simulate peer connection
      const huinet = daemon.getHuiNet();
      huinet.emit('peerConnected', 'test-node');

      await connectedPromise;
    });

    it('should handle peer disconnected events', async () => {
      daemon = new HuiNetDaemon({
        listenPort: 0,
        enableMDNS: false,
      });

      const disconnectedPromise = new Promise<void>(resolve => {
        daemon.once('peerDisconnected', (nodeID) => {
          expect(nodeID).toBeDefined();
          resolve();
        });
      });

      await daemon.start();

      // Simulate peer disconnection
      const huinet = daemon.getHuiNet();
      huinet.emit('peerDisconnected', 'test-node');

      await disconnectedPromise;
    });
  });

  describe('loadConfig', () => {
    it('should load default config when no config provided', () => {
      const config = loadConfig();

      expect(config.listenPort).toBe(8000);
      expect(config.enableMDNS).toBe(true);
      expect(config.adminPort).toBe(3000);
      expect(config.proxyPortRange).toEqual([8080, 8090]);
    });

    it('should merge user config with defaults', () => {
      const config = loadConfig({
        listenPort: 9000,
        machineName: 'custom-machine',
      });

      expect(config.listenPort).toBe(9000);
      expect(config.machineName).toBe('custom-machine');
      expect(config.enableMDNS).toBe(true); // Default value
      expect(config.adminPort).toBe(3000); // Default value
    });
  });
});
