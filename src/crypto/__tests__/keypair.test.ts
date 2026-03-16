import { generateKeyPair, getPublicKey, deriveNodeID, serializePublicKey, deserializePublicKey } from '../keypair';
import { createNodeID } from '../../types/node';

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

    it('should derive consistent NodeID from public key', () => {
      const keyPair = generateKeyPair();
      const nodeID1 = createNodeID(keyPair.publicKey);
      const nodeID2 = createNodeID(keyPair.publicKey);

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

    it('should throw on invalid private key', () => {
      const invalidKey = Buffer.alloc(32); // Wrong size

      expect(() => getPublicKey(invalidKey)).toThrow('Invalid private key length');
    });

    it('should throw on non-Buffer input', () => {
      expect(() => getPublicKey('not a buffer' as any)).toThrow('Private key must be a Buffer');
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

      expect(nodeID1).toBe(nodeID2);
    });

    it('should derive different NodeIDs for different public keys', () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();

      const nodeID1 = deriveNodeID(keyPair1.publicKey);
      const nodeID2 = deriveNodeID(keyPair2.publicKey);

      expect(nodeID1).not.toBe(nodeID2);
    });

    it('should throw on invalid public key', () => {
      const invalidKey = Buffer.alloc(16); // Wrong size

      expect(() => deriveNodeID(invalidKey)).toThrow('Invalid public key length');
    });

    it('should throw on non-Buffer input', () => {
      expect(() => deriveNodeID('not a buffer' as any)).toThrow('Public key must be a Buffer');
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

    it('should throw on invalid public key', () => {
      const invalidKey = Buffer.alloc(16); // Wrong size

      expect(() => serializePublicKey(invalidKey)).toThrow('Invalid public key length');
    });

    it('should throw on non-Buffer input', () => {
      expect(() => serializePublicKey('not a buffer' as any)).toThrow('Public key must be a Buffer');
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

    it('should throw on invalid hex format', () => {
      expect(() => deserializePublicKey('not-hex')).toThrow('Invalid public key hex format');
    });

    it('should throw on wrong hex length', () => {
      expect(() => deserializePublicKey('abc123')).toThrow('Invalid public key hex format');
    });

    it('should throw on non-string input', () => {
      expect(() => deserializePublicKey(123 as any)).toThrow('Hex must be a string');
    });
  });
});
