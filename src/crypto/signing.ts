/**
 * Signing Manager
 *
 * Handles message signing and verification for HuiNet
 */

import { signMessage, verifySignature } from './signature';
import { KeyPair } from './keypair';
import { BaseMessage, MessageHeader } from '../types/message';
import { NodeID } from '../types/node';

export interface SigningResult {
  success: boolean;
  signature?: Buffer;
  error?: string;
}

export interface VerificationResult {
  valid: boolean;
  nodeID?: NodeID;
  error?: string;
}

/**
 * Data to be signed - includes header and body hash
 */
interface SignableData {
  header: MessageHeader;
  bodyHash: string;
}

export class SigningManager {
  private keyPair: KeyPair;
  private publicKeyCache: Map<NodeID, Buffer> = new Map();

  constructor(keyPair: KeyPair) {
    this.keyPair = keyPair;
  }

  /**
   * Sign a message
   */
  signMessage(message: BaseMessage): SigningResult {
    try {
      // Create data to sign
      const dataToSign = this.createDataToSign(message);

      // Sign the data
      const signature = signMessage(dataToSign, this.keyPair.privateKey);

      return {
        success: true,
        signature,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown signing error',
      };
    }
  }

  /**
   * Verify a message signature
   */
  verifyMessage(message: BaseMessage, nodeID: NodeID): VerificationResult {
    try {
      if (!message.signature) {
        return {
          valid: false,
          error: 'No signature present',
        };
      }

      // Get public key for this node
      const publicKey = this.getPublicKey(nodeID);
      if (!publicKey) {
        return {
          valid: false,
          error: `Public key not found for node: ${nodeID}`,
        };
      }

      // Create data to verify
      const dataToVerify = this.createDataToSign(message);

      // Verify signature
      const isValid = verifySignature(
        dataToVerify,
        message.signature,
        publicKey
      );

      return {
        valid: isValid,
        nodeID,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
      };
    }
  }

  /**
   * Add a public key for a node
   */
  addPublicKey(nodeID: NodeID, publicKey: Buffer): void {
    this.publicKeyCache.set(nodeID, publicKey);
  }

  /**
   * Get public key for a node
   */
  getPublicKey(nodeID: NodeID): Buffer | undefined {
    return this.publicKeyCache.get(nodeID);
  }

  /**
   * Remove a public key
   */
  removePublicKey(nodeID: NodeID): boolean {
    return this.publicKeyCache.delete(nodeID);
  }

  /**
   * Get all known public keys
   */
  getPublicKeys(): Map<NodeID, Buffer> {
    return new Map(this.publicKeyCache);
  }

  /**
   * Create data to sign/verify from a message
   */
  private createDataToSign(message: BaseMessage): Buffer {
    // Serialize header
    const headerJson = JSON.stringify(message.header);
    const headerBuffer = Buffer.from(headerJson, 'utf-8');

    // Hash body if present
    let bodyHash: Buffer;
    if (message.body && message.body.length > 0) {
      // For efficiency, we could use a proper hash function here
      // For now, just use the body as-is
      bodyHash = message.body;
    } else {
      bodyHash = Buffer.alloc(0);
    }

    // Concatenate header and body hash
    return Buffer.concat([headerBuffer, bodyHash]);
  }

  /**
   * Extract public key from a handshake message
   */
  extractPublicKeyFromHandshake(message: BaseMessage): Buffer | null {
    try {
      if (!message.body) {
        return null;
      }

      const body = JSON.parse(message.body.toString());
      if (body.publicKey) {
        return Buffer.from(body.publicKey, 'base64');
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get local public key
   */
  getLocalPublicKey(): Buffer {
    return this.keyPair.publicKey;
  }

  /**
   * Get local node ID
   */
  getLocalNodeID(): NodeID {
    // Derive node ID from public key
    const publicKeyArray = new Uint8Array(this.keyPair.publicKey);
    const hashBuffer = require('crypto').createHash('sha256')
      .update(publicKeyArray)
      .digest();

    // Convert to base58 and return
    return require('../utils/base58').encode(hashBuffer);
  }

  /**
   * Clear all cached public keys
   */
  clearPublicKeyCache(): void {
    this.publicKeyCache.clear();
  }
}
