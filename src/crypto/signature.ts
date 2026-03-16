import * as nacl from 'tweetnacl';

/**
 * Sign a message using Ed25519
 */
export function signMessage(message: Buffer, privateKey: Buffer): Buffer {
  const signature = nacl.sign.detached(
    new Uint8Array(message),
    new Uint8Array(privateKey)
  );

  return Buffer.from(signature);
}

/**
 * Verify an Ed25519 signature
 */
export function verifySignature(
  message: Buffer,
  signature: Buffer,
  publicKey: Buffer
): boolean {
  return nacl.sign.detached.verify(
    new Uint8Array(message),
    new Uint8Array(signature),
    new Uint8Array(publicKey)
  );
}
