import { encodeMessage, decodeMessage } from '../codec';
import { MessageType } from '../../types/message';

describe('Message Codec', () => {
  describe('encodeMessage', () => {
    it('should encode a message to buffer', () => {
      const message = {
        header: {
          version: '1.0.0',
          type: MessageType.HEARTBEAT,
          from: 'QmXw9zFxVY',
          to: 'QmAb1Cd2Ef',
          id: 'msg-123',
          timestamp: Date.now(),
        },
        body: Buffer.from('test body'),
        signature: Buffer.from('signature'),
      };

      const encoded = encodeMessage(message);

      expect(encoded).toBeInstanceOf(Buffer);
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('should throw when header is missing', () => {
      const message = {
        header: undefined as any,
        body: Buffer.from('test'),
        signature: Buffer.from('sig'),
      };

      expect(() => encodeMessage(message)).toThrow('Message header is required');
    });

    it('should throw when signature is missing', () => {
      const message = {
        header: {
          version: '1.0.0',
          type: MessageType.HEARTBEAT,
          from: 'QmXw9zFxVY',
          to: 'QmAb1Cd2Ef',
          id: 'msg-123',
          timestamp: Date.now(),
        },
        body: Buffer.from('test body'),
        signature: undefined as any,
      };

      expect(() => encodeMessage(message)).toThrow('Message signature is required');
    });

    it('should throw when signature is not a Buffer', () => {
      const message = {
        header: {
          version: '1.0.0',
          type: MessageType.HEARTBEAT,
          from: 'QmXw9zFxVY',
          to: 'QmAb1Cd2Ef',
          id: 'msg-123',
          timestamp: Date.now(),
        },
        body: Buffer.from('test body'),
        signature: 'not a buffer' as any,
      };

      expect(() => encodeMessage(message)).toThrow('Message signature is required');
    });

    it('should throw when message size exceeds maximum', () => {
      const message = {
        header: {
          version: '1.0.0',
          type: MessageType.HEARTBEAT,
          from: 'QmXw9zFxVY',
          to: 'QmAb1Cd2Ef',
          id: 'msg-123',
          timestamp: Date.now(),
        },
        body: Buffer.alloc(11 * 1024 * 1024), // 11MB
        signature: Buffer.alloc(64),
      };

      expect(() => encodeMessage(message)).toThrow('Message size exceeds maximum allowed size');
    });
  });

  describe('decodeMessage', () => {
    it('should decode a buffer to message', () => {
      const original = {
        header: {
          version: '1.0.0',
          type: MessageType.HEARTBEAT,
          from: 'QmXw9zFxVY',
          to: 'QmAb1Cd2Ef',
          id: 'msg-123',
          timestamp: Date.now(),
        },
        body: Buffer.from('test body'),
        signature: Buffer.from('signature'),
      };

      const encoded = encodeMessage(original);
      const decoded = decodeMessage(encoded);

      expect(decoded.header.version).toBe(original.header.version);
      expect(decoded.header.type).toBe(original.header.type);
      expect(decoded.header.from).toBe(original.header.from);
      expect(decoded.body).toEqual(original.body);
      expect(decoded.signature).toEqual(original.signature);
    });

    it('should round-trip message data', () => {
      const original = {
        header: {
          version: '1.0.0',
          type: MessageType.CHAT,
          from: 'NodeA',
          to: 'NodeB',
          id: 'chat-001',
          timestamp: 1234567890,
          ttl: 60,
        },
        body: Buffer.from('Hello from NodeA'),
        signature: Buffer.alloc(64, 0xAB),
      };

      const encoded = encodeMessage(original);
      const decoded = decodeMessage(encoded);

      expect(decoded).toEqual(original);
    });

    it('should throw when buffer exceeds maximum size', () => {
      const hugeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      expect(() => decodeMessage(hugeBuffer)).toThrow('Buffer size exceeds maximum allowed size');
    });

    it('should throw when header length exceeds buffer size', () => {
      // Create a buffer with a header length varint that claims more data than exists
      const maliciousBuffer = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF]); // Huge varint

      expect(() => decodeMessage(maliciousBuffer)).toThrow();
    });

    it('should throw when body length exceeds buffer size', () => {
      const validMessage = {
        header: {
          version: '1.0.0',
          type: MessageType.HEARTBEAT,
          from: 'QmXw9zFxVY',
          to: 'QmAb1Cd2Ef',
          id: 'msg-123',
          timestamp: Date.now(),
        },
        body: Buffer.from('test'),
        signature: Buffer.alloc(64),
      };

      const encoded = encodeMessage(validMessage);
      // Corrupt the buffer by truncating it
      const truncatedBuffer = encoded.subarray(0, encoded.length - 10);

      expect(() => decodeMessage(truncatedBuffer)).toThrow('Buffer overflow');
    });

    it('should throw when header JSON is invalid', () => {
      // Create a buffer with invalid JSON in the header
      const headerLen = Buffer.from([5]); // varint: 5
      const invalidJson = Buffer.from('{invalid}', 'utf-8');
      const bodyLen = Buffer.from([0]); // varint: 0
      const sigLen = Buffer.from([0]); // varint: 0

      const invalidBuffer = Buffer.concat([headerLen, invalidJson, bodyLen, sigLen]);

      expect(() => decodeMessage(invalidBuffer)).toThrow('Failed to parse message header');
    });

    it('should throw when signature length exceeds buffer size', () => {
      const validMessage = {
        header: {
          version: '1.0.0',
          type: MessageType.HEARTBEAT,
          from: 'QmXw9zFxVY',
          to: 'QmAb1Cd2Ef',
          id: 'msg-123',
          timestamp: Date.now(),
        },
        body: Buffer.from('test'),
        signature: Buffer.alloc(64),
      };

      const encoded = encodeMessage(validMessage);
      // Truncate right before the signature
      const truncatedBuffer = encoded.subarray(0, encoded.length - 30);

      expect(() => decodeMessage(truncatedBuffer)).toThrow('Buffer overflow');
    });

    it('should throw when decoding from empty buffer', () => {
      expect(() => decodeMessage(Buffer.alloc(0))).toThrow();
    });

    it('should handle empty body correctly', () => {
      const message = {
        header: {
          version: '1.0.0',
          type: MessageType.HEARTBEAT,
          from: 'QmXw9zFxVY',
          to: 'QmAb1Cd2Ef',
          id: 'msg-123',
          timestamp: Date.now(),
        },
        body: Buffer.alloc(0),
        signature: Buffer.alloc(64),
      };

      const encoded = encodeMessage(message);
      const decoded = decodeMessage(encoded);

      expect(decoded.body?.length || 0).toBe(0);
      expect(decoded.signature).toEqual(message.signature);
    });
  });
});
