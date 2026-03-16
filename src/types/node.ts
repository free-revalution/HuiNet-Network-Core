import { createHash } from 'crypto';
import { Base58 } from '../utils/base58';

export type NodeID = string;

const NODEID_MIN_LENGTH = 43; // Minimum Base58 encoded 32 bytes
const NODEID_MAX_LENGTH = 44; // Maximum Base58 encoded 32 bytes

/**
 * Create a NodeID from a public key
 * NodeID = Base58(SHA256(publicKey))
 */
export function createNodeID(publicKey: Buffer): NodeID {
  const hash = createHash('sha256').update(publicKey).digest();
  return Base58.encode(hash);
}

/**
 * Validate a NodeID string format
 */
export function validateNodeID(nodeID: string): boolean {
  if (typeof nodeID !== 'string') return false;
  if (nodeID.length < NODEID_MIN_LENGTH || nodeID.length > NODEID_MAX_LENGTH) return false;

  // Check if valid Base58
  try {
    const decoded = Base58.decode(nodeID);
    return decoded.length === 32;
  } catch {
    return false;
  }
}
