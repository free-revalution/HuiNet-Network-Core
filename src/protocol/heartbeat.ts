/**
 * Heartbeat Protocol Handler
 *
 * Manages heartbeat/ping-pong mechanism for connection health monitoring
 */

import { MessageType } from '../types/message';
import { HeartbeatState as BaseHeartbeatState } from '../types/connection';
import { NodeID } from '../types/node';
import {
  createHeartbeatMessage,
  encodeMessage,
  decodeMessage,
  isControlMessage
} from './codec';

export interface NodeHeartbeatState {
  lastReceived: number;
  lastSent: number;
  sequence: number;
  rtt?: number; // Round-trip time in milliseconds
  missed: number;
}

export interface HeartbeatOptions {
  interval?: number; // Heartbeat interval in milliseconds
  timeout?: number; // Timeout before considering node dead
  maxMissed?: number; // Maximum missed heartbeats before declaring dead
}

export class HeartbeatHandler {
  private heartbeatStates: Map<NodeID, NodeHeartbeatState> = new Map();
  private intervals: Map<NodeID, NodeJS.Timeout> = new Map();
  private defaultOptions: Required<HeartbeatOptions> = {
    interval: 30000, // 30 seconds
    timeout: 60000, // 60 seconds
    maxMissed: 3,
  };

  constructor(options?: HeartbeatOptions) {
    if (options) {
      this.defaultOptions = { ...this.defaultOptions, ...options };
    }
  }

  /**
   * Start heartbeat for a node
   */
  startHeartbeat(
    nodeID: NodeID,
    sendCallback: (message: Buffer) => boolean | Promise<boolean>
  ): void {
    // Don't start if already running
    if (this.intervals.has(nodeID)) {
      return;
    }

    // Initialize state
    this.heartbeatStates.set(nodeID, {
      lastReceived: Date.now(),
      lastSent: Date.now(),
      sequence: 0,
      missed: 0,
    });

    // Start interval
    const interval = setInterval(async () => {
      await this.sendHeartbeat(nodeID, sendCallback);
    }, this.defaultOptions.interval);

    this.intervals.set(nodeID, interval);
  }

  /**
   * Stop heartbeat for a node
   */
  stopHeartbeat(nodeID: NodeID): void {
    const interval = this.intervals.get(nodeID);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(nodeID);
    }

    this.heartbeatStates.delete(nodeID);
  }

  /**
   * Stop all heartbeats
   */
  stopAll(): void {
    for (const nodeID of this.intervals.keys()) {
      this.stopHeartbeat(nodeID);
    }
  }

  /**
   * Send heartbeat to a node
   */
  private async sendHeartbeat(
    nodeID: NodeID,
    sendCallback: (message: Buffer) => boolean | Promise<boolean>
  ): Promise<void> {
    const state = this.heartbeatStates.get(nodeID);
    if (!state) {
      return;
    }

    // Increment sequence
    state.sequence++;

    // Check for timeout
    const now = Date.now();
    if (now - state.lastReceived > this.defaultOptions.timeout) {
      state.missed++;

      if (state.missed >= this.defaultOptions.maxMissed) {
        // Node is considered dead
        this.stopHeartbeat(nodeID);
        return;
      }
    }

    // Create heartbeat message
    // Note: Using empty signature for now, will be replaced by actual signature
    const message = createHeartbeatMessage(
      nodeID,
      state.sequence,
      Buffer.alloc(0)
    );

    const encoded = encodeMessage(message);

    // Send heartbeat
    try {
      await sendCallback(encoded);
      state.lastSent = now;
    } catch (error) {
      // Failed to send heartbeat
      state.missed++;
    }
  }

  /**
   * Handle incoming heartbeat
   */
  handleHeartbeat(
    encodedMessage: Buffer,
    localNodeID: NodeID,
    sendCallback?: (message: Buffer) => boolean | Promise<boolean>
  ): { success: boolean; from?: NodeID; sequence?: number } {
    try {
      const message = decodeMessage(encodedMessage);
      if (!message || message.header.type !== MessageType.HEARTBEAT) {
        return { success: false };
      }

      const from = message.header.from;
      const sequence = message.header.sequence || 0;

      // Update state
      const state = this.heartbeatStates.get(from);
      if (state) {
        state.lastReceived = Date.now();
        state.sequence = sequence;
        state.missed = 0;

        // Calculate RTT if sequence matches
        if (sequence === state.sequence) {
          state.rtt = Date.now() - state.lastSent;
        }
      } else {
        // New heartbeat, initialize state
        this.heartbeatStates.set(from, {
          lastReceived: Date.now(),
          lastSent: Date.now(),
          sequence,
          missed: 0,
        });
      }

      // Send pong if callback provided
      if (sendCallback) {
        // Send heartbeat response (same message type, but with our sequence)
        const pongMessage = createHeartbeatMessage(
          localNodeID,
          sequence,
          Buffer.alloc(0)
        );

        const encodedPong = encodeMessage(pongMessage);
        const result = sendCallback(encodedPong);
        if (result instanceof Promise) {
          result.catch(() => {
            // Ignore send errors
          });
        } else if (result === true) {
          // Synchronous send succeeded
        }
      }

      return {
        success: true,
        from,
        sequence,
      };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Check if a node is alive based on heartbeat
   */
  isNodeAlive(nodeID: NodeID): boolean {
    const state = this.heartbeatStates.get(nodeID);
    if (!state) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastReceived = now - state.lastReceived;

    return timeSinceLastReceived < this.defaultOptions.timeout &&
           state.missed < this.defaultOptions.maxMissed;
  }

  /**
   * Get heartbeat state for a node
   */
  getHeartbeatState(nodeID: NodeID): NodeHeartbeatState | undefined {
    return this.heartbeatStates.get(nodeID);
  }

  /**
   * Get all alive nodes
   */
  getAliveNodes(): NodeID[] {
    const alive: NodeID[] = [];

    for (const [nodeID] of this.heartbeatStates) {
      if (this.isNodeAlive(nodeID)) {
        alive.push(nodeID);
      }
    }

    return alive;
  }

  /**
   * Get all dead nodes
   */
  getDeadNodes(): NodeID[] {
    const dead: NodeID[] = [];

    for (const [nodeID] of this.heartbeatStates) {
      if (!this.isNodeAlive(nodeID)) {
        dead.push(nodeID);
      }
    }

    return dead;
  }

  /**
   * Cleanup dead nodes from heartbeat tracking
   */
  cleanupDeadNodes(): NodeID[] {
    const deadNodes = this.getDeadNodes();

    for (const nodeID of deadNodes) {
      this.stopHeartbeat(nodeID);
    }

    return deadNodes;
  }
}
