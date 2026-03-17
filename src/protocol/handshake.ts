/**
 * Handshake Protocol Handler
 *
 * Manages the handshake process between HuiNet nodes
 */

import { randomBytes } from 'crypto';
import { MessageType } from '../types/message';
import { NodeID } from '../types/node';
import {
  createHandshakeMessage,
  createHandshakeAckMessage,
  encodeMessage,
  decodeMessage,
  generateMessageID
} from './codec';

export interface HandshakeState {
  status: 'pending' | 'completed' | 'failed';
  challenge: Buffer;
  remoteNodeID?: NodeID;
  remotePublicKey?: Buffer;
  startTime: number;
}

export interface HandshakeOptions {
  timeout?: number;
  retries?: number;
}

export class HandshakeHandler {
  private pendingHandshakes: Map<NodeID, HandshakeState> = new Map();
  private completedHandshakes: Set<NodeID> = new Set();
  private defaultTimeout: number = 5000; // 5 seconds

  /**
   * Initiate handshake with a remote node
   */
  async initiateHandshake(
    localNodeID: NodeID,
    localPublicKey: Buffer,
    signCallback: (data: Buffer) => Buffer
  ): Promise<{ message: Buffer; challenge: Buffer }> {
    // Generate a random challenge
    const challenge = randomBytes(32);

    // Create handshake message
    const message = createHandshakeMessage(
      localNodeID,
      localPublicKey,
      challenge,
      Buffer.alloc(0) // Temporary signature, will be replaced
    );

    // Sign the message
    const messageToSign = this.getMessageToSign(message);
    const signature = signCallback(messageToSign);
    message.signature = signature;

    // Encode message
    const encoded = encodeMessage(message);

    // Store pending handshake state
    const state: HandshakeState = {
      status: 'pending',
      challenge,
      startTime: Date.now(),
    };
    this.pendingHandshakes.set(localNodeID, state);

    return { message: encoded, challenge };
  }

  /**
   * Handle incoming handshake message
   */
  async handleHandshake(
    encodedMessage: Buffer,
    localNodeID: NodeID,
    localPublicKey: Buffer,
    signCallback: (data: Buffer) => Buffer
  ): Promise<{ response: Buffer; remoteNodeID: NodeID } | null> {
    try {
      const message = decodeMessage(encodedMessage);
      if (!message || message.header.type !== MessageType.HANDSHAKE) {
        return null;
      }

      // Parse body
      if (!message.body) {
        return null;
      }
      const body = JSON.parse(message.body.toString());
      const remoteNodeID = body.nodeID as NodeID;
      const remotePublicKey = Buffer.from(body.publicKey, 'base64');
      const challenge = Buffer.from(body.challenge, 'base64');

      // Create handshake acknowledgment
      const ackMessage = createHandshakeAckMessage(
        localNodeID,
        challenge,
        localPublicKey,
        Buffer.alloc(0) // Temporary signature
      );

      // Sign the acknowledgment
      const messageToSign = this.getMessageToSign(ackMessage);
      const signature = signCallback(messageToSign);
      ackMessage.signature = signature;

      // Encode acknowledgment
      const encodedAck = encodeMessage(ackMessage);

      // Mark handshake as completed
      this.completedHandshakes.add(remoteNodeID);

      return {
        response: encodedAck,
        remoteNodeID,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Handle incoming handshake acknowledgment
   */
  handleHandshakeAck(encodedMessage: Buffer): { success: boolean; remoteNodeID?: NodeID } {
    try {
      const message = decodeMessage(encodedMessage);
      if (!message || message.header.type !== MessageType.HANDSHAKE_ACK) {
        return { success: false };
      }

      // Parse body
      if (!message.body) {
        return { success: false };
      }
      const body = JSON.parse(message.body.toString());
      const remoteNodeID = body.nodeID as NodeID;
      const challengeResponse = Buffer.from(body.challengeResponse, 'base64');

      // Verify challenge response
      const localState = this.pendingHandshakes.get(message.header.from);
      if (!localState) {
        return { success: false };
      }

      // Verify challenge matches
      if (challengeResponse.equals(localState.challenge)) {
        // Mark handshake as completed
        this.completedHandshakes.add(remoteNodeID);
        this.pendingHandshakes.delete(message.header.from);

        return {
          success: true,
          remoteNodeID,
        };
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Check if handshake is completed with a node
   */
  isHandshakeCompleted(nodeID: NodeID): boolean {
    return this.completedHandshakes.has(nodeID);
  }

  /**
   * Get handshake state
   */
  getHandshakeState(nodeID: NodeID): HandshakeState | undefined {
    return this.pendingHandshakes.get(nodeID);
  }

  /**
   * Cleanup expired handshakes
   */
  cleanupExpiredHandshakes(timeout: number = this.defaultTimeout): void {
    const now = Date.now();

    for (const [nodeID, state] of this.pendingHandshakes) {
      if (now - state.startTime > timeout) {
        this.pendingHandshakes.delete(nodeID);
      }
    }
  }

  /**
   * Reset all handshake state
   */
  reset(): void {
    this.pendingHandshakes.clear();
    this.completedHandshakes.clear();
  }

  /**
   * Get data to sign for a message
   */
  private getMessageToSign(message: any): Buffer {
    // For now, sign the header JSON
    // In production, you might want to sign both header and body
    return Buffer.from(JSON.stringify(message.header));
  }
}
