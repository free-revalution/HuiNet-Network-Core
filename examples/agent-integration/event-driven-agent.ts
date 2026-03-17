/**
 * Event-Driven Agent Example
 *
 * This example demonstrates how to build reactive agents that respond to network events.
 * It shows:
 * - Event-driven architecture patterns
 * - Reactive programming with HuiNet
 * - State management based on network events
 * - Complex event handling and coordination
 *
 * Usage:
 *   This example shows how to build agents that react to network state changes
 *   and coordinate their behavior based on events.
 */

import { HuiNet, HuiNetConfig } from '../../src/HuiNet';
import { EventEmitter } from 'events';

interface AgentState {
  isOnline: boolean;
  connectedPeers: Set<string>;
  lastActivity: number;
  messageCount: number;
  role: string;
}

interface AgentEvent {
  type: 'peer_joined' | 'peer_left' | 'message_received' | 'state_changed';
  timestamp: number;
  data: any;
}

/**
 * EventDrivenAgent - A reactive agent that responds to network events
 */
class EventDrivenAgent extends EventEmitter {
  private node: HuiNet;
  private agentName: string;
  private state: AgentState;
  private eventLog: AgentEvent[] = [];
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private reactionRules: Map<string, () => void> = new Map();

  constructor(agentName: string, config: HuiNetConfig = {}) {
    super();

    this.agentName = agentName;

    // Initialize agent state
    this.state = {
      isOnline: false,
      connectedPeers: new Set(),
      lastActivity: Date.now(),
      messageCount: 0,
      role: config.role || 'participant',
    };

    // Initialize HuiNet node
    this.node = new HuiNet({
      listenPort: config.listenPort || 8000,
      listenHost: config.listenHost || '0.0.0.0',
      enableMDNS: config.enableMDNS !== false,
      bootstrapNodes: config.bootstrapNodes || [],
      maxCoreConnections: config.maxCoreConnections || 10,
      maxActiveConnections: config.maxActiveConnections || 50,
    });

    // Set up event-driven architecture
    this.setupEventHandlers();
    this.setupReactionRules();
  }

  /**
   * Set up comprehensive event handlers for all network events
   */
  private setupEventHandlers(): void {
    // Node ready event
    this.node.on('ready', () => {
      this.updateState({
        isOnline: true,
        lastActivity: Date.now(),
      });
      this.logEvent('state_changed', { online: true });
      console.log(`[${this.agentName}] 🟢 Agent is now online`);
      this.emit('agent:ready', this.getState());
    });

    // Peer connected event
    this.node.on('peerConnected', (nodeID: string) => {
      this.state.connectedPeers.add(nodeID);
      this.updateState({
        lastActivity: Date.now(),
      });
      this.logEvent('peer_joined', { nodeID });
      console.log(`[${this.agentName}] 👋 Peer joined: ${nodeID}`);
      this.emit('peer:joined', nodeID);

      // Trigger reaction rule
      this.triggerReaction('peer_joined');
    });

    // Peer disconnected event
    this.node.on('peerDisconnected', (nodeID: string) => {
      this.state.connectedPeers.delete(nodeID);
      this.updateState({
        lastActivity: Date.now(),
      });
      this.logEvent('peer_left', { nodeID });
      console.log(`[${this.agentName}] 👋 Peer left: ${nodeID}`);
      this.emit('peer:left', nodeID);

      // Trigger reaction rule
      this.triggerReaction('peer_left');
    });

    // Node discovered event
    this.node.on('nodeDiscovered', (event: any) => {
      console.log(`[${this.agentName}] 🔍 Node discovered: ${event.nodeId}`);
      this.emit('node:discovered', event);
    });

    // Message received event
    this.node.on('message', (fromNodeID: string, messageData: any) => {
      this.handleMessage(fromNodeID, messageData);
    });
  }

  /**
   * Set up reactive rules that trigger on specific events
   */
  private setupReactionRules(): void {
    // Rule: Welcome new peers
    this.reactionRules.set('peer_joined', () => {
      this.broadcastToPeers({
        type: 'system',
        text: `New peer detected! Active peers: ${this.state.connectedPeers.size}`,
      });
    });

    // Rule: Announce when peers leave
    this.reactionRules.set('peer_left', () => {
      this.broadcastToPeers({
        type: 'system',
        text: `Peer disconnected. Remaining peers: ${this.state.connectedPeers.size}`,
      });
    });
  }

  /**
   * Handle incoming messages with type-based routing
   */
  private handleMessage(fromNodeID: string, messageData: any): void {
    const message = messageData.data || messageData;
    const messageType = message.type || 'default';

    // Update state
    this.state.messageCount++;
    this.updateState({
      lastActivity: Date.now(),
    });

    // Log event
    this.logEvent('message_received', {
      from: fromNodeID,
      type: messageType,
      text: message.text,
    });

    // Route message to appropriate handler
    const handler = this.messageHandlers.get(messageType);
    if (handler) {
      handler({ from: fromNodeID, ...message });
    } else {
      // Default message handler
      console.log(`[${this.agentName}] 💬 ${message.sender || fromNodeID}: ${message.text}`);
    }

    // Emit message event for external listeners
    this.emit('message:received', {
      from: fromNodeID,
      message: message,
    });
  }

  /**
   * Register a custom message handler
   */
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Register a custom reaction rule
   */
  onReaction(event: string, handler: () => void): void {
    this.reactionRules.set(event, handler);
  }

  /**
   * Trigger a reaction rule
   */
  private triggerReaction(event: string): void {
    const handler = this.reactionRules.get(event);
    if (handler) {
      try {
        handler();
      } catch (error) {
        console.error(`[${this.agentName}] Error in reaction handler for ${event}:`, error);
      }
    }
  }

  /**
   * Update agent state and emit change event
   */
  private updateState(changes: Partial<AgentState>): void {
    const oldState = { ...this.state };
    Object.assign(this.state, changes);
    this.emit('state:changed', oldState, this.state);
  }

  /**
   * Log an event for debugging and analysis
   */
  private logEvent(type: AgentEvent['type'], data: any): void {
    const event: AgentEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.eventLog.push(event);

    // Keep only last 1000 events
    if (this.eventLog.length > 1000) {
      this.eventLog.shift();
    }
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    try {
      console.log(`[${this.agentName}] 🚀 Starting event-driven agent...`);
      await this.node.start();
      console.log(`[${this.agentName}] ✅ Agent started!`);
      console.log(`[${this.agentName}] 📋 Node ID: ${this.node.getNodeID()}`);
    } catch (error) {
      console.error(`[${this.agentName}] ❌ Failed to start:`, error);
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    try {
      console.log(`[${this.agentName}] 🛑 Stopping agent...`);
      await this.node.stop();
      this.updateState({ isOnline: false });
      console.log(`[${this.agentName}] ✅ Agent stopped!`);
    } catch (error) {
      console.error(`[${this.agentName}] ❌ Failed to stop:`, error);
      throw error;
    }
  }

  /**
   * Send a message to a specific peer
   */
  async sendMessage(targetNodeID: string, message: any): Promise<void> {
    try {
      await this.node.send(targetNodeID, message);
      this.state.messageCount++;
      this.updateState({ lastActivity: Date.now() });
    } catch (error) {
      console.error(`[${this.agentName}] ❌ Failed to send message:`, error);
      throw error;
    }
  }

  /**
   * Broadcast a message to all connected peers
   */
  async broadcastToPeers(message: any): Promise<void> {
    const promises = Array.from(this.state.connectedPeers).map(nodeID =>
      this.sendMessage(nodeID, message).catch(error => {
        console.error(`[${this.agentName}] Failed to send to ${nodeID}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return {
      ...this.state,
      connectedPeers: new Set(this.state.connectedPeers),
    };
  }

  /**
   * Get event log
   */
  getEventLog(): AgentEvent[] {
    return [...this.eventLog];
  }

  /**
   * Get statistics about the agent
   */
  getStatistics(): {
    uptime: number;
    messageCount: number;
    peerCount: number;
    eventCount: number;
  } {
    const uptime = Date.now() - (this.state.lastActivity - this.state.messageCount * 1000);
    return {
      uptime,
      messageCount: this.state.messageCount,
      peerCount: this.state.connectedPeers.size,
      eventCount: this.eventLog.length,
    };
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this.node.isRunning();
  }
}

// Example usage demonstrating reactive patterns
async function main() {
  // Create a coordinator agent that responds to events
  const coordinator = new EventDrivenAgent('Coordinator', {
    listenPort: 9001,
    enableMDNS: true,
    role: 'coordinator',
  });

  // Create worker agents
  const worker1 = new EventDrivenAgent('Worker-1', {
    listenPort: 9002,
    enableMDNS: true,
    bootstrapNodes: ['127.0.0.1:9001'],
    role: 'worker',
  });

  const worker2 = new EventDrivenAgent('Worker-2', {
    listenPort: 9003,
    enableMDNS: true,
    bootstrapNodes: ['127.0.0.1:9001'],
    role: 'worker',
  });

  // Set up custom message handlers for coordinator
  coordinator.onMessage('task', async (data) => {
    console.log(`[Coordinator] 📋 Received task from ${data.from}: ${data.task}`);
    // Distribute task to workers
    await coordinator.broadcastToPeers({
      type: 'work',
      task: data.task,
      from: data.from,
    });
  });

  coordinator.onMessage('result', (data) => {
    console.log(`[Coordinator] ✅ Result from ${data.from}: ${data.result}`);
  });

  // Set up custom message handlers for workers
  worker1.onMessage('work', async (data) => {
    console.log(`[Worker-1] 🔧 Processing task: ${data.task}`);
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000));
    await coordinator.sendMessage(coordinator.getNodeID(), {
      type: 'result',
      result: `Task "${data.task}" completed by Worker-1`,
      from: 'Worker-1',
    });
  });

  worker2.onMessage('work', async (data) => {
    console.log(`[Worker-2] 🔧 Processing task: ${data.task}`);
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000));
    await coordinator.sendMessage(coordinator.getNodeID(), {
      type: 'result',
      result: `Task "${data.task}" completed by Worker-2`,
      from: 'Worker-2',
    });
  });

  // Set up custom reaction rules
  coordinator.onReaction('peer_joined', () => {
    console.log('[Coordinator] 🎉 New peer joined, updating cluster state');
  });

  try {
    // Start all agents
    await coordinator.start();
    await worker1.start();
    await worker2.start();

    // Wait for network to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Submit a task to coordinator
    console.log('\n=== Submitting task to coordinator ===');
    await worker1.sendMessage(coordinator.getNodeID(), {
      type: 'task',
      task: 'Process data batch #123',
      from: 'Worker-1',
    });

    // Wait for task distribution and completion
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Display statistics
    console.log('\n=== Agent Statistics ===');
    console.log('Coordinator:', coordinator.getStatistics());
    console.log('Worker 1:', worker1.getStatistics());
    console.log('Worker 2:', worker2.getStatistics());

    // Stop all agents
    await coordinator.stop();
    await worker1.stop();
    await worker2.stop();

    console.log('\n✅ Event-driven agent example completed!');

  } catch (error) {
    console.error('❌ Error in main:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other modules
export { EventDrivenAgent, AgentState, AgentEvent };
