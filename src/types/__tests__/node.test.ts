import { NodeID, createNodeID, validateNodeID } from '../node';

describe('NodeID', () => {
  describe('createNodeID', () => {
    it('should create a valid NodeID from public key', () => {
      const publicKey = Buffer.from('test-public-key-32-bytes-long!');
      const nodeID = createNodeID(publicKey);

      expect(nodeID.length).toBeGreaterThanOrEqual(43); // Base58 encoded 32 bytes
      expect(nodeID.length).toBeLessThanOrEqual(44);
      expect(typeof nodeID).toBe('string');
    });

    it('should create consistent NodeID for same public key', () => {
      const publicKey = Buffer.from('test-public-key-32-bytes-long!');
      const nodeID1 = createNodeID(publicKey);
      const nodeID2 = createNodeID(publicKey);

      expect(nodeID1).toBe(nodeID2);
    });
  });

  describe('validateNodeID', () => {
    it('should accept valid NodeID', () => {
      const publicKey = Buffer.from('test-public-key-32-bytes-long!');
      const nodeID = createNodeID(publicKey);

      expect(validateNodeID(nodeID)).toBe(true);
    });

    it('should reject invalid NodeID', () => {
      expect(validateNodeID('')).toBe(false);
      expect(validateNodeID('too-short')).toBe(false);
      expect(validateNodeID('invalid@characters!')).toBe(false);
    });
  });
});
