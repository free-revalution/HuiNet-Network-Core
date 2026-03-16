import { Base58 } from '../base58';

describe('Base58', () => {
  describe('encode', () => {
    it('should handle empty buffer', () => {
      const buffer = Buffer.alloc(0);
      const encoded = Base58.encode(buffer);
      expect(encoded).toBe('');
    });

    it('should handle buffer with single zero byte', () => {
      const buffer = Buffer.from([0x00]);
      const encoded = Base58.encode(buffer);
      expect(encoded).toBe('1');
    });

    it('should handle buffer with leading zeros', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x01]);
      const encoded = Base58.encode(buffer);
      expect(encoded).toBe('112');
    });

    it('should encode standard 32-byte hash', () => {
      const buffer = Buffer.alloc(32, 0xAB); // 32 bytes
      const encoded = Base58.encode(buffer);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThanOrEqual(43);
      expect(encoded.length).toBeLessThanOrEqual(44);
    });

    it('should be deterministic', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03]);
      const encoded1 = Base58.encode(buffer);
      const encoded2 = Base58.encode(buffer);
      expect(encoded1).toBe(encoded2);
    });

    it('should reject buffers larger than 4KB', () => {
      const largeBuffer = Buffer.alloc(4097); // 1 byte over limit
      expect(() => Base58.encode(largeBuffer)).toThrow(
        /Buffer too large: 4097 > 4096/
      );
    });

    it('should accept buffers exactly at 4KB limit', () => {
      const buffer = Buffer.alloc(4096);
      expect(() => Base58.encode(buffer)).not.toThrow();
    });
  });

  describe('decode', () => {
    it('should handle empty string', () => {
      const decoded = Base58.decode('');
      expect(decoded.length).toBe(0);
    });

    it('should decode single leading zero', () => {
      const decoded = Base58.decode('1');
      expect(decoded.length).toBe(1);
      expect(decoded[0]).toBe(0);
    });

    it('should decode multiple leading zeros', () => {
      const decoded = Base58.decode('112');
      expect(decoded.length).toBe(3);
      expect(decoded[0]).toBe(0);
      expect(decoded[1]).toBe(0);
      expect(decoded[2]).toBe(1);
    });

    it('should reject invalid Base58 characters', () => {
      expect(() => Base58.decode('invalid@characters!')).toThrow(
        /Invalid Base58 character/
      );
    });

    it('should reject characters not in Base58 alphabet', () => {
      expect(() => Base58.decode('0')).toThrow(/Invalid Base58 character: 0/);
      expect(() => Base58.decode('O')).toThrow(/Invalid Base58 character: O/);
      expect(() => Base58.decode('I')).toThrow(/Invalid Base58 character: I/);
      expect(() => Base58.decode('l')).toThrow(/Invalid Base58 character: l/);
    });

    it('should decode standard encoded string', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03]);
      const encoded = Base58.encode(buffer);
      const decoded = Base58.decode(encoded);
      expect(decoded.equals(buffer)).toBe(true);
    });
  });

  describe('roundtrip', () => {
    it('should encode and decode correctly for various sizes', () => {
      const testCases = [
        Buffer.alloc(0),
        Buffer.from([0x00]),
        Buffer.from([0xff]),
        Buffer.from([0x00, 0x01]),
        Buffer.from([0x01, 0x02, 0x03]),
        Buffer.from('test'),
        Buffer.from('test-public-key-32-bytes-long!'),
        Buffer.alloc(32, 0xff),
        Buffer.alloc(100),
      ];

      for (const original of testCases) {
        const encoded = Base58.encode(original);
        const decoded = Base58.decode(encoded);
        expect(decoded.equals(original)).toBe(true);
      }
    });

    it('should handle all byte values', () => {
      const buffer = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        buffer[i] = i;
      }

      const encoded = Base58.encode(buffer);
      const decoded = Base58.decode(encoded);
      expect(decoded.equals(buffer)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle maximum size buffer (4KB)', () => {
      const buffer = Buffer.alloc(4096);
      // Fill with some data
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = i % 256;
      }

      const encoded = Base58.encode(buffer);
      const decoded = Base58.decode(encoded);
      expect(decoded.equals(buffer)).toBe(true);
    });

    it('should handle buffer with all zeros', () => {
      const buffer = Buffer.alloc(10, 0);
      const encoded = Base58.encode(buffer);
      expect(encoded).toBe('1111111111'); // 10 leading zeros

      const decoded = Base58.decode(encoded);
      expect(decoded.equals(buffer)).toBe(true);
    });

    it('should handle buffer with all 0xFF', () => {
      const buffer = Buffer.alloc(10, 0xff);
      const encoded = Base58.encode(buffer);

      const decoded = Base58.decode(encoded);
      expect(decoded.equals(buffer)).toBe(true);
    });
  });

  describe('alphabet compliance', () => {
    it('should use Bitcoin Base58 alphabet', () => {
      const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      expect(Base58['ALPHABET']).toBe(alphabet);
    });

    it('should exclude ambiguous characters', () => {
      const alphabet = Base58['ALPHABET'];
      expect(alphabet).not.toContain('0'); // Zero
      expect(alphabet).not.toContain('O'); // Capital O
      expect(alphabet).not.toContain('I'); // Capital I
      expect(alphabet).not.toContain('l'); // Lowercase l
    });
  });
});
