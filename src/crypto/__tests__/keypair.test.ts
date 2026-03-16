import { generateKeyPair, getPublicKey } from '../keypair';
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
  });
});
