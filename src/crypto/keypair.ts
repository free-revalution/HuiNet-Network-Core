import * as nacl from 'tweetnacl';
import { createHash } from 'crypto';
import { Base58 } from '../utils/base58';

export interface KeyPair {
  publicKey: Buffer;
  privateKey: Buffer;
}

/**
 * Generate a new Ed25519 key pair for NodeID and signing
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.sign.keyPair();

  return {
    publicKey: Buffer.from(keyPair.publicKey),
    privateKey: Buffer.from(keyPair.secretKey),
  };
}

/**
 * Extract public key from private key
 * Ed25519 private key contains the public key
 */
export function getPublicKey(privateKey: Buffer): Buffer {
  // In Ed25519, the public key is the last 32 bytes of the secret key
  return privateKey.subarray(32);
}

/**
 * Derive NodeID from public key
 * NodeID = Base58(SHA256(publicKey))
 */
export function deriveNodeID(publicKey: Buffer): string {
  const hash = createHash('sha256').update(publicKey).digest();
  return Base58.encode(hash);
}
