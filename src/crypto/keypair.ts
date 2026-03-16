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
  if (!privateKey || !Buffer.isBuffer(privateKey)) {
    throw new Error('Private key must be a Buffer');
  }
  if (privateKey.length !== 64) {
    throw new Error(`Invalid private key length: ${privateKey.length}. Expected 64 bytes for Ed25519`);
  }
  // In Ed25519, the public key is the last 32 bytes of the secret key
  return privateKey.subarray(32);
}

/**
 * Derive NodeID from public key
 * NodeID = Base58(SHA256(publicKey))
 */
export function deriveNodeID(publicKey: Buffer): string {
  if (!publicKey || !Buffer.isBuffer(publicKey)) {
    throw new Error('Public key must be a Buffer');
  }
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: ${publicKey.length}. Expected 32 bytes for Ed25519`);
  }
  const hash = createHash('sha256').update(publicKey).digest();
  return Base58.encode(hash);
}

/**
 * Serialize public key to hex string
 */
export function serializePublicKey(publicKey: Buffer): string {
  if (!publicKey || !Buffer.isBuffer(publicKey)) {
    throw new Error('Public key must be a Buffer');
  }
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: ${publicKey.length}`);
  }
  return publicKey.toString('hex');
}

/**
 * Deserialize public key from hex string
 */
export function deserializePublicKey(hex: string): Buffer {
  if (typeof hex !== 'string') {
    throw new Error('Hex must be a string');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('Invalid public key hex format');
  }
  return Buffer.from(hex, 'hex');
}
