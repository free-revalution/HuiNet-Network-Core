/**
 * Unit Tests - ConfigManager
 */

import { ConfigManager } from '../../src/config/ConfigManager';
import { LogLevel } from '../../src/types';

describe('ConfigManager', () => {
  describe('default configuration', () => {
    it('should create config with default values', () => {
      const manager = new ConfigManager();
      const config = manager.getConfig();

      expect(config.httpPort).toBe(3000);
      expect(config.wsPort).toBe(3001);
      expect(config.host).toBe('0.0.0.0');
      expect(config.apiKey).toMatch(/^hk_/);
      expect(config.huinet.listenPort).toBe(8000);
      expect(config.huinet.enableMDNS).toBe(true);
      expect(config.huinet.bootstrapNodes).toEqual([]);
      expect(config.logLevel).toBe('info');
      expect(config.maxConnections).toBe(100);
    });
  });

  describe('user configuration overrides', () => {
    it('should merge user config with defaults', () => {
      const manager = new ConfigManager({
        httpPort: 4000,
        apiKey: 'test-key-123',
      });
      const config = manager.getConfig();

      expect(config.httpPort).toBe(4000);
      expect(config.wsPort).toBe(3001); // Default
      expect(config.apiKey).toBe('test-key-123');
    });

    it('should merge nested huinet config', () => {
      const manager = new ConfigManager({
        huinet: {
          listenPort: 9000,
          enableMDNS: false,
          bootstrapNodes: [],
        },
      });
      const config = manager.getConfig();

      expect(config.huinet.listenPort).toBe(9000);
      expect(config.huinet.enableMDNS).toBe(false);
    });
  });

  describe('get method', () => {
    it('should return specific config value', () => {
      const manager = new ConfigManager({ httpPort: 5000 });

      expect(manager.get('httpPort')).toBe(5000);
      expect(manager.get('wsPort')).toBe(3001);
    });
  });

  describe('validation', () => {
    it('should validate correct config', () => {
      const manager = new ConfigManager();
      const result = manager.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid httpPort', () => {
      const manager = new ConfigManager({ httpPort: 0 });
      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('httpPort must be between 1 and 65535');
    });

    it('should reject when httpPort equals wsPort', () => {
      const manager = new ConfigManager({
        httpPort: 3000,
        wsPort: 3000,
      });
      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('httpPort and wsPort must be different');
    });

    it('should reject short API key', () => {
      const manager = new ConfigManager({ apiKey: 'short' });
      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('apiKey must be at least 8 characters');
    });
  });
});
