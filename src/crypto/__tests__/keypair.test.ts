import { generateKeyPair, getPublicKey, deriveNodeID, serializePublicKey, deserializePublicKey } from '../keypair';
import { signMessage, verifySignature } from '../signature';

describe('KeyPair', () => {
  describe('generateKeyPair', () => {
    it('should generate a new Ed25519 key pair', () => {
      const keyPair = generateKeyPair();

      expect(keyPair.publicKey).toBeInstanceOf(Buffer);
      expect(keyPair.privateKey).toBeInstanceOf(Buffer);
      expect(keyPair.publicKey.length).toBe(32);
      expect(keyPair.privateKey.length).toBe(64); // Ed25519
    });

    it('should generate unique key pairs', () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();

      expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
    });

    it('should generate cryptographically strong random keys', () => {
      const keyPairs = Array.from({ length: 100 }, () => generateKeyPair());

      // Check all public keys are unique
      const uniqueKeys = new Set(keyPairs.map(kp => kp.publicKey.toString('hex')));
      expect(uniqueKeys.size).toBe(100);
    });

    it('should derive consistent NodeID from public key', () => {
      const keyPair = generateKeyPair();
      const nodeID1 = deriveNodeID(keyPair.publicKey);
      const nodeID2 = deriveNodeID(keyPair.publicKey);

      expect(nodeID1).toBe(nodeID2);
      expect(nodeID1).toHaveLength(44);
    });
  });

  describe('getPublicKey', () => {
    it('should extract public key from private key', () => {
      const keyPair = generateKeyPair();
      const publicKey = getPublicKey(keyPair.privateKey);

      expect(publicKey).toEqual(keyPair.publicKey);
    });

    it('should work for multiple key pairs', () => {
      for (let i = 0; i < 10; i++) {
        const keyPair = generateKeyPair();
        const extractedPublicKey = getPublicKey(keyPair.privateKey);

        expect(extractedPublicKey).toEqual(keyPair.publicKey);
      }
    });

    it('should throw on invalid private key length', () => {
      const invalidKey = Buffer.alloc(32); // Wrong size

      expect(() => getPublicKey(invalidKey)).toThrow('Invalid private key length');
    });

    it('should throw on various invalid lengths', () => {
      expect(() => getPublicKey(Buffer.alloc(0))).toThrow('Invalid private key length');
      expect(() => getPublicKey(Buffer.alloc(16))).toThrow('Invalid private key length');
      expect(() => getPublicKey(Buffer.alloc(128))).toThrow('Invalid private key length');
    });

    it('should throw on non-Buffer input', () => {
      expect(() => getPublicKey('not a buffer' as any)).toThrow('Private key must be a Buffer');
      expect(() => getPublicKey(null as any)).toThrow('Private key must be a Buffer');
      expect(() => getPublicKey(undefined as any)).toThrow('Private key must be a Buffer');
      expect(() => getPublicKey(123 as any)).toThrow('Private key must be a Buffer');
    });
  });

  describe('deriveNodeID', () => {
    it('should derive NodeID from public key', () => {
      const keyPair = generateKeyPair();
      const nodeID = deriveNodeID(keyPair.publicKey);

      expect(typeof nodeID).toBe('string');
      expect(nodeID).toHaveLength(44);
    });

    it('should derive consistent NodeID for same public key', () => {
      const keyPair = generateKeyPair();
      const nodeID1 = deriveNodeID(keyPair.publicKey);
      const nodeID2 = deriveNodeID(keyPair.publicKey);
      const nodeID3 = deriveNodeID(keyPair.publicKey);

      expect(nodeID1).toBe(nodeID2);
      expect(nodeID2).toBe(nodeID3);
    });

    it('should derive different NodeIDs for different public keys', () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();

      const nodeID1 = deriveNodeID(keyPair1.publicKey);
      const nodeID2 = deriveNodeID(keyPair2.publicKey);

      expect(nodeID1).not.toBe(nodeID2);
    });

    it('should produce valid Base58 output', () => {
      const keyPair = generateKeyPair();
      const nodeID = deriveNodeID(keyPair.publicKey);

      // Base58 character set
      const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      expect(nodeID.split('').every(c => base58Chars.includes(c))).toBe(true);
    });

    it('should throw on invalid public key length', () => {
      const invalidKey = Buffer.alloc(16); // Wrong size

      expect(() => deriveNodeID(invalidKey)).toThrow('Invalid public key length');
    });

    it('should throw on various invalid lengths', () => {
      expect(() => deriveNodeID(Buffer.alloc(0))).toThrow('Invalid public key length');
      expect(() => deriveNodeID(Buffer.alloc(31))).toThrow('Invalid public key length');
      expect(() => deriveNodeID(Buffer.alloc(33))).toThrow('Invalid public key length');
      expect(() => deriveNodeID(Buffer.alloc(64))).toThrow('Invalid public key length');
    });

    it('should throw on non-Buffer input', () => {
      expect(() => deriveNodeID('not a buffer' as any)).toThrow('Public key must be a Buffer');
      expect(() => deriveNodeID(null as any)).toThrow('Public key must be a Buffer');
      expect(() => deriveNodeID(undefined as any)).toThrow('Public key must be a Buffer');
      expect(() => deriveNodeID(123 as any)).toThrow('Public key must be a Buffer');
    });

    it('should produce deterministic NodeIDs', () => {
      // Same public key should always produce same NodeID
      const keyPair = generateKeyPair();
      const nodeIDs = Array.from({ length: 100 }, () => deriveNodeID(keyPair.publicKey));

      expect(new Set(nodeIDs).size).toBe(1);
    });
  });

  describe('serializePublicKey', () => {
    it('should serialize public key to hex', () => {
      const keyPair = generateKeyPair();
      const hex = serializePublicKey(keyPair.publicKey);

      expect(typeof hex).toBe('string');
      expect(hex).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hex)).toBe(true);
    });

    it('should produce consistent hex output', () => {
      const keyPair = generateKeyPair();
      const hex1 = serializePublicKey(keyPair.publicKey);
      const hex2 = serializePublicKey(keyPair.publicKey);

      expect(hex1).toBe(hex2);
    });

    it('should use lowercase hex characters', () => {
      const keyPair = generateKeyPair();
      const hex = serializePublicKey(keyPair.publicKey);

      expect(hex).toBe(hex.toLowerCase());
    });

    it('should throw on invalid public key length', () => {
      const invalidKey = Buffer.alloc(16); // Wrong size

      expect(() => serializePublicKey(invalidKey)).toThrow('Invalid public key length');
    });

    it('should throw on non-Buffer input', () => {
      expect(() => serializePublicKey('not a buffer' as any)).toThrow('Public key must be a Buffer');
      expect(() => serializePublicKey(null as any)).toThrow('Public key must be a Buffer');
      expect(() => serializePublicKey(undefined as any)).toThrow('Public key must be a Buffer');
    });
  });

  describe('deserializePublicKey', () => {
    it('should deserialize hex to public key', () => {
      const keyPair = generateKeyPair();
      const hex = serializePublicKey(keyPair.publicKey);
      const deserialized = deserializePublicKey(hex);

      expect(deserialized).toEqual(keyPair.publicKey);
      expect(deserialized).toBeInstanceOf(Buffer);
      expect(deserialized.length).toBe(32);
    });

    it('should handle both uppercase and lowercase hex', () => {
      const keyPair = generateKeyPair();
      const hex = serializePublicKey(keyPair.publicKey);
      const upperHex = hex.toUpperCase();

      const deserialized1 = deserializePublicKey(hex);
      const deserialized2 = deserializePublicKey(upperHex);

      expect(deserialized1).toEqual(deserialized2);
    });

    it('should handle mixed case hex', () => {
      const keyPair = generateKeyPair();
      const hex = serializePublicKey(keyPair.publicKey);
      const mixedHex = hex.split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c).join('');

      const deserialized = deserializePublicKey(mixedHex);

      expect(deserialized).toEqual(keyPair.publicKey);
    });

    it('should throw on invalid hex format', () => {
      expect(() => deserializePublicKey('not-hex')).toThrow('Invalid public key hex format');
      expect(() => deserializePublicKey('xyz123')).toThrow('Invalid public key hex format');
      expect(() => deserializePublicKey('ghijkl')).toThrow('Invalid public key hex format');
    });

    it('should throw on wrong hex length', () => {
      expect(() => deserializePublicKey('abc123')).toThrow('Invalid public key hex format');
      expect(() => deserializePublicKey('a'.repeat(63))).toThrow('Invalid public key hex format');
      expect(() => deserializePublicKey('a'.repeat(65))).toThrow('Invalid public key hex format');
    });

    it('should throw on non-string input', () => {
      expect(() => deserializePublicKey(123 as any)).toThrow('Hex must be a string');
      expect(() => deserializePublicKey(null as any)).toThrow('Hex must be a string');
      expect(() => deserializePublicKey(undefined as any)).toThrow('Hex must be a string');
      expect(() => deserializePublicKey({} as any)).toThrow('Hex must be a string');
    });
  });

  describe('serialize/deserialize round-trip', () => {
    it('should maintain data integrity through serialize/deserialize', () => {
      const keyPair = generateKeyPair();
      const hex = serializePublicKey(keyPair.publicKey);
      const deserialized = deserializePublicKey(hex);

      expect(deserialized).toEqual(keyPair.publicKey);
    });

    it('should handle multiple round-trips', () => {
      const keyPair = generateKeyPair();
      let publicKey = keyPair.publicKey;

      for (let i = 0; i < 10; i++) {
        const hex = serializePublicKey(publicKey);
        publicKey = deserializePublicKey(hex);
      }

      expect(publicKey).toEqual(keyPair.publicKey);
    });
  });

  describe('signing/verification integration', () => {
    let keyPair: ReturnType<typeof generateKeyPair>;

    beforeEach(() => {
      keyPair = generateKeyPair();
    });

    it('should sign and verify messages successfully', () => {
      const message = Buffer.from('Hello, HuiNet!');
      const signature = signMessage(message, keyPair.privateKey);

      const valid = verifySignature(message, signature, keyPair.publicKey);
      expect(valid).toBe(true);
    });

    it('should fail to verify with wrong public key', () => {
      const message = Buffer.from('Hello, HuiNet!');
      const signature = signMessage(message, keyPair.privateKey);

      const wrongKeyPair = generateKeyPair();
      const valid = verifySignature(message, signature, wrongKeyPair.publicKey);
      expect(valid).toBe(false);
    });

    it('should fail to verify tampered messages', () => {
      const message = Buffer.from('Hello, HuiNet!');
      const signature = signMessage(message, keyPair.privateKey);

      const tamperedMessage = Buffer.from('Hello, World!');
      const valid = verifySignature(tamperedMessage, signature, keyPair.publicKey);
      expect(valid).toBe(false);
    });

    it('should work with empty messages', () => {
      const message = Buffer.alloc(0);
      const signature = signMessage(message, keyPair.privateKey);

      const valid = verifySignature(message, signature, keyPair.publicKey);
      expect(valid).toBe(true);
    });

    it('should work with large messages', () => {
      const message = Buffer.alloc(1024 * 1024); // 1MB
      const signature = signMessage(message, keyPair.privateKey);

      const valid = verifySignature(message, signature, keyPair.publicKey);
      expect(valid).toBe(true);
    });

    it('should produce different signatures for different messages', () => {
      const message1 = Buffer.from('Message 1');
      const message2 = Buffer.from('Message 2');

      const sig1 = signMessage(message1, keyPair.privateKey);
      const sig2 = signMessage(message2, keyPair.privateKey);

      expect(sig1).not.toEqual(sig2);
    });

    it('should produce same signature for same message', () => {
      const message = Buffer.from('Same message');

      const sig1 = signMessage(message, keyPair.privateKey);
      const sig2 = signMessage(message, keyPair.privateKey);

      expect(sig1).toEqual(sig2);
    });
  });

  describe('NodeID uniqueness', () => {
    it('should generate unique NodeIDs for different key pairs', () => {
      const keyPairs = Array.from({ length: 1000 }, () => generateKeyPair());
      const nodeIDs = keyPairs.map(kp => deriveNodeID(kp.publicKey));

      const uniqueNodeIDs = new Set(nodeIDs);
      expect(uniqueNodeIDs.size).toBeGreaterThan(990); // Allow some collisions statistically
    });

    it('should distribute NodeIDs uniformly', () => {
      const keyPairs = Array.from({ length: 1000 }, () => generateKeyPair());
      const nodeIDs = keyPairs.map(kp => deriveNodeID(kp.publicKey));

      // Check first character distribution
      const firstChars = nodeIDs.map(id => id[0]);
      const charCounts = firstChars.reduce((acc, char) => {
        acc[char] = (acc[char] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Should have reasonable distribution (not all same character)
      const uniqueChars = Object.keys(charCounts).length;
      expect(uniqueChars).toBeGreaterThan(10);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero-filled buffers', () => {
      const publicKey = Buffer.alloc(32);
      const privateKey = Buffer.alloc(64);

      expect(() => getPublicKey(privateKey)).not.toThrow();
      expect(() => deriveNodeID(publicKey)).not.toThrow();
      expect(() => serializePublicKey(publicKey)).not.toThrow();
    });

    it('should handle max-filled buffers', () => {
      const publicKey = Buffer.alloc(32, 0xff);
      const privateKey = Buffer.alloc(64, 0xff);

      expect(() => getPublicKey(privateKey)).not.toThrow();
      expect(() => deriveNodeID(publicKey)).not.toThrow();
      expect(() => serializePublicKey(publicKey)).not.toThrow();
    });

    it('should handle random buffers', () => {
      const publicKey = Buffer.from(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)));
      const privateKey = Buffer.from(Array.from({ length: 64 }, () => Math.floor(Math.random() * 256)));

      expect(() => getPublicKey(privateKey)).not.toThrow();
      expect(() => deriveNodeID(publicKey)).not.toThrow();
      expect(() => serializePublicKey(publicKey)).not.toThrow();
    });
  });
});
