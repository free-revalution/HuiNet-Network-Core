import * as nacl from 'tweetnacl';

/**
 * Sign a message using Ed25519
 */
export function signMessage(message: Buffer, privateKey: Buffer): Buffer {
  if (!message || !Buffer.isBuffer(message)) {
    throw new Error('Message must be a Buffer');
  }
  if (!privateKey || !Buffer.isBuffer(privateKey)) {
    throw new Error('Private key must be a Buffer');
  }
  if (privateKey.length !== 64) {
    throw new Error(`Invalid private key length: ${privateKey.length}. Expected 64 bytes for Ed25519`);
  }

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
  if (!message || !Buffer.isBuffer(message)) {
    throw new Error('Message must be a Buffer');
  }
  if (!signature || !Buffer.isBuffer(signature)) {
    throw new Error('Signature must be a Buffer');
  }
  if (!publicKey || !Buffer.isBuffer(publicKey)) {
    throw new Error('Public key must be a Buffer');
  }
  if (signature.length !== 64) {
    throw new Error(`Invalid signature length: ${signature.length}. Expected 64 bytes for Ed25519`);
  }
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: ${publicKey.length}. Expected 32 bytes for Ed25519`);
  }

  return nacl.sign.detached.verify(
    new Uint8Array(message),
    new Uint8Array(signature),
    new Uint8Array(publicKey)
  );
}
