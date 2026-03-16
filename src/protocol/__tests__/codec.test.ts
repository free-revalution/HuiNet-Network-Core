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
  });
});
