/**
 * Configuration validation tests
 */

import {
  validatePort,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateStringArray,
  validateNodeID,
  validateHuiNetConfig,
  validateConfigData,
  sanitizeConfigData,
  ValidationError,
} from '../validation';

describe('Validation Utilities', () => {
  describe('ValidationError', () => {
    it('should create validation error with details', () => {
      const error = new ValidationError('Invalid value', 'field', 123);
      expect(error.message).toBe('Invalid value');
      expect(error.field).toBe('field');
      expect(error.value).toBe(123);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('validatePort', () => {
    it('should accept valid ports', () => {
      expect(() => validatePort(0)).not.toThrow();
      expect(() => validatePort(8000)).not.toThrow();
      expect(() => validatePort(65535)).not.toThrow();
    });

    it('should reject non-integer ports', () => {
      expect(() => validatePort(80.5)).toThrow(ValidationError);
      expect(() => validatePort(8000.1)).toThrow(ValidationError);
    });

    it('should reject out of range ports', () => {
      expect(() => validatePort(-1)).toThrow(ValidationError);
      expect(() => validatePort(65536)).toThrow(ValidationError);
      expect(() => validatePort(100000)).toThrow(ValidationError);
    });
  });

  describe('validatePositiveNumber', () => {
    it('should accept positive numbers', () => {
      expect(() => validatePositiveNumber(1, 'test')).not.toThrow();
      expect(() => validatePositiveNumber(100, 'test')).not.toThrow();
      expect(() => validatePositiveNumber(0.5, 'test')).not.toThrow();
    });

    it('should reject zero', () => {
      expect(() => validatePositiveNumber(0, 'test')).toThrow(ValidationError);
    });

    it('should reject negative numbers', () => {
      expect(() => validatePositiveNumber(-1, 'test')).toThrow(ValidationError);
    });

    it('should reject non-numbers', () => {
      expect(() => validatePositiveNumber(NaN, 'test')).toThrow(ValidationError);
      expect(() => validatePositiveNumber('string' as any, 'test')).toThrow(ValidationError);
    });
  });

  describe('validateNonNegativeNumber', () => {
    it('should accept non-negative numbers', () => {
      expect(() => validateNonNegativeNumber(0, 'test')).not.toThrow();
      expect(() => validateNonNegativeNumber(1, 'test')).not.toThrow();
      expect(() => validateNonNegativeNumber(100, 'test')).not.toThrow();
    });

    it('should reject negative numbers', () => {
      expect(() => validateNonNegativeNumber(-1, 'test')).toThrow(ValidationError);
    });
  });

  describe('validateStringArray', () => {
    it('should accept valid string arrays', () => {
      expect(() => validateStringArray([], 'test')).not.toThrow();
      expect(() => validateStringArray(['a', 'b', 'c'], 'test')).not.toThrow();
    });

    it('should reject non-arrays', () => {
      expect(() => validateStringArray('string' as any, 'test')).toThrow(ValidationError);
      expect(() => validateStringArray(123 as any, 'test')).toThrow(ValidationError);
      expect(() => validateStringArray({} as any, 'test')).toThrow(ValidationError);
    });

    it('should reject arrays with non-strings', () => {
      expect(() => validateStringArray([1, 2, 3] as any, 'test')).toThrow(ValidationError);
      expect(() => validateStringArray(['a', 1, 'b'] as any, 'test')).toThrow(ValidationError);
    });
  });

  describe('validateNodeID', () => {
    it('should accept valid NodeIDs', () => {
      // Valid Base58 with 43-44 chars
      expect(() => validateNodeID('k'.repeat(43))).not.toThrow();
      expect(() => validateNodeID('k'.repeat(44))).not.toThrow();
      // Use a 43-character string from Base58 alphabet
      expect(() => validateNodeID('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk')).not.toThrow();
    });

    it('should reject non-strings', () => {
      expect(() => validateNodeID(123 as any)).toThrow(ValidationError);
      expect(() => validateNodeID(null as any)).toThrow(ValidationError);
    });

    it('should reject wrong length', () => {
      expect(() => validateNodeID('a'.repeat(42))).toThrow(ValidationError);
      expect(() => validateNodeID('a'.repeat(45))).toThrow(ValidationError);
    });

    it('should reject invalid Base58 characters', () => {
      expect(() => validateNodeID('0'.repeat(43))).toThrow(ValidationError); // 0 not in Base58
      expect(() => validateNodeID('O'.repeat(43))).toThrow(ValidationError); // O not in Base58
      expect(() => validateNodeID('I'.repeat(43))).toThrow(ValidationError); // I not in Base58
      expect(() => validateNodeID('l'.repeat(43))).toThrow(ValidationError); // lowercase l looks like 1/I, excluded
      expect(() => validateNodeID('m'.repeat(43))).not.toThrow(); // lowercase m is valid
    });
  });

  describe('validateHuiNetConfig', () => {
    it('should accept valid minimal config', () => {
      expect(() => validateHuiNetConfig({})).not.toThrow();
    });

    it('should accept valid full config', () => {
      const config = {
        listenPort: 8000,
        listenHost: '0.0.0.0',
        bootstrapNodes: ['node1', 'node2'],
        maxCoreConnections: 10,
        maxActiveConnections: 50,
        enableMDNS: true,
        promoteToActiveThreshold: 3,
        promoteToCoreThreshold: 10,
        routingCleanupInterval: 300000,
        maxNodeAge: 3600000,
      };
      expect(() => validateHuiNetConfig(config)).not.toThrow();
    });

    it('should validate listenPort', () => {
      expect(() => validateHuiNetConfig({ listenPort: -1 })).toThrow(ValidationError);
      expect(() => validateHuiNetConfig({ listenPort: 65536 })).toThrow(ValidationError);
      expect(() => validateHuiNetConfig({ listenPort: 8000 })).not.toThrow();
    });

    it('should validate connection counts relationship', () => {
      expect(() =>
        validateHuiNetConfig({
          maxCoreConnections: 50,
          maxActiveConnections: 10,
        })
      ).toThrow(ValidationError);
    });

    it('should validate threshold relationship', () => {
      expect(() =>
        validateHuiNetConfig({
          promoteToActiveThreshold: 10,
          promoteToCoreThreshold: 3,
        })
      ).toThrow(ValidationError);
    });

    it('should validate routingCleanupInterval minimum', () => {
      expect(() =>
        validateHuiNetConfig({ routingCleanupInterval: 30000 })
      ).toThrow(ValidationError);
    });

    it('should validate maxNodeAge minimum', () => {
      expect(() =>
        validateHuiNetConfig({ maxNodeAge: 30000 })
      ).toThrow(ValidationError);
    });
  });

  describe('validateConfigData', () => {
    it('should accept valid config data', () => {
      const data = {
        name: 'MyAgent',
        aliases: {
          node1: 'k'.repeat(43),
        },
        settings: {
          mdns: true,
          autoConnect: ['node1'],
        },
      };
      expect(() => validateConfigData(data)).not.toThrow();
    });

    it('should reject invalid name type', () => {
      expect(() =>
        validateConfigData({ name: 123 })
      ).toThrow(ValidationError);
    });

    it('should reject invalid aliases', () => {
      expect(() =>
        validateConfigData({ aliases: [] })
      ).toThrow(ValidationError);
    });

    it('should reject invalid messageHistory', () => {
      expect(() =>
        validateConfigData({ messageHistory: 'not array' })
      ).toThrow(ValidationError);

      expect(() =>
        validateConfigData({
          messageHistory: [{ direction: 'invalid' }],
        })
      ).toThrow(ValidationError);
    });

    it('should reject invalid settings', () => {
      expect(() =>
        validateConfigData({ settings: 'not object' })
      ).toThrow(ValidationError);

      expect(() =>
        validateConfigData({
          settings: { mdns: 'not boolean' },
        })
      ).toThrow(ValidationError);
    });
  });

  describe('sanitizeConfigData', () => {
    it('should sanitize invalid data', () => {
      const input = {
        name: 123,
        invalidField: 'should be removed',
        aliases: { valid: 'k'.repeat(43), invalid: 123 },
        settings: {
          mdns: 'true',
          autoConnect: ['valid', 123],
        },
        messageHistory: [
          {
            direction: 'sent',
            target: 'node1',
            message: 'hello',
            timestamp: 1000,
          },
          {
            direction: 'invalid',
            target: 'node2',
          },
        ],
      };

      const sanitized = sanitizeConfigData(input);

      expect(sanitized.name).toBe('MyAgent'); // default
      expect(sanitized.invalidField).toBeUndefined();
      expect(sanitized.aliases.valid).toBe('k'.repeat(43));
      expect(sanitized.aliases.invalid).toBeUndefined();
      expect(sanitized.settings.mdns).toBe(true); // default
      expect(sanitized.settings.autoConnect).toEqual(['valid']);
      expect(sanitized.messageHistory).toHaveLength(1);
      expect(sanitized.messageHistory[0].direction).toBe('sent');
    });

    it('should preserve valid data', () => {
      const input = {
        name: 'TestAgent',
        aliases: { node1: 'k'.repeat(43) },
        settings: {
          mdns: false,
          autoConnect: ['node1'],
        },
      };

      const sanitized = sanitizeConfigData(input);

      expect(sanitized.name).toBe('TestAgent');
      expect(sanitized.aliases.node1).toBe('k'.repeat(43));
      expect(sanitized.settings.mdns).toBe(false);
      expect(sanitized.settings.autoConnect).toEqual(['node1']);
    });

    it('should provide defaults for empty object', () => {
      const sanitized = sanitizeConfigData({});

      expect(sanitized.name).toBe('MyAgent');
      expect(sanitized.aliases).toEqual({});
      expect(sanitized.settings.mdns).toBe(true);
      expect(sanitized.settings.autoConnect).toEqual([]);
    });
  });
});
