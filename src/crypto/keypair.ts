import * as nacl from 'tweetnacl';

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
