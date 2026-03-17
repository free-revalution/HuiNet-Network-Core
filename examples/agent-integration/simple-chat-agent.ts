/**
 * Simple Chat Agent Example
 *
 * This example demonstrates the basic usage of HuiNet for agent-to-agent communication.
 * It shows how to:
 * - Create and configure a HuiNet node
 * - Start the node and listen for events
 * - Send messages to other agents
 * - Handle incoming messages
 *
 * Usage:
 *   Run this file in multiple terminal windows to simulate different agents
 *   Each agent will be able to send messages to others
 */

import { HuiNet, HuiNetConfig } from '../../src/HuiNet';

interface ChatMessage {
  type: 'chat' | 'status';
  text: string;
  sender: string;
  timestamp: number;
}

class SimpleChatAgent {
  private node: HuiNet;
  private agentName: string;
  private messageHistory: ChatMessage[] = [];

  constructor(agentName: string, config: HuiNetConfig = {}) {
    this.agentName = agentName;

    // Initialize HuiNet node with configuration
    this.node = new HuiNet({
      listenPort: config.listenPort || 8000,
      listenHost: config.listenHost || '0.0.0.0',
      enableMDNS: config.enableMDNS !== false,
      bootstrapNodes: config.bootstrapNodes || [],
      maxCoreConnections: config.maxCoreConnections || 10,
      maxActiveConnections: config.maxActiveConnections || 50,
    });

    // Set up event handlers for network events
    this.setupEventHandlers();
  }

  /**
   * Set up event handlers for HuiNet events
   */
  private setupEventHandlers(): void {
    // Handle when the node is ready
    this.node.on('ready', () => {
      console.log(`[${this.agentName}] Node is ready!`);
      console.log(`[${this.agentName}] Node ID: ${this.node.getNodeID()}`);
      this.broadcastStatus();
    });

    // Handle when a peer connects
    this.node.on('peerConnected', (nodeID: string) => {
      console.log(`[${this.agentName}] Peer connected: ${nodeID}`);
      this.sendWelcomeMessage(nodeID);
    });

    // Handle when a peer disconnects
    this.node.on('peerDisconnected', (nodeID: string) => {
      console.log(`[${this.agentName}] Peer disconnected: ${nodeID}`);
    });

    // Handle when a new node is discovered via mDNS
    this.node.on('nodeDiscovered', (event: any) => {
      console.log(`[${this.agentName}] Node discovered: ${event.nodeId} at ${event.address}`);
    });

    // Handle incoming messages
    this.node.on('message', (fromNodeID: string, messageData: any) => {
      this.handleIncomingMessage(fromNodeID, messageData);
    });
  }

  /**
   * Handle incoming messages from other agents
   */
  private handleIncomingMessage(fromNodeID: string, messageData: any): void {
    try {
      // Parse the message
      const message: ChatMessage = messageData.data || messageData;

      // Add to message history
      this.messageHistory.push({
        type: message.type || 'chat',
        text: message.text || '',
        sender: message.sender || fromNodeID,
        timestamp: message.timestamp || Date.now(),
      });

      // Process different message types
      switch (message.type) {
        case 'status':
          console.log(`[${this.agentName}] Status update from ${message.sender}: ${message.text}`);
          break;
        case 'chat':
        default:
          console.log(`[${this.agentName}] Message from ${message.sender}: ${message.text}`);
          break;
      }
    } catch (error) {
      console.error(`[${this.agentName}] Error handling message:`, error);
    }
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    try {
      console.log(`[${this.agentName}] Starting agent...`);
      await this.node.start();
      console.log(`[${this.agentName}] Agent started successfully!`);
      console.log(`[${this.agentName}] Listening on port ${this.node.getNodeID()}`);
    } catch (error) {
      console.error(`[${this.agentName}] Failed to start agent:`, error);
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    try {
      console.log(`[${this.agentName}] Stopping agent...`);
      await this.node.stop();
      console.log(`[${this.agentName}] Agent stopped successfully!`);
    } catch (error) {
      console.error(`[${this.agentName}] Failed to stop agent:`, error);
      throw error;
    }
  }

  /**
   * Send a message to a specific agent
   */
  async sendMessage(targetNodeID: string, text: string): Promise<void> {
    try {
      const message: ChatMessage = {
        type: 'chat',
        text: text,
        sender: this.agentName,
        timestamp: Date.now(),
      };

      await this.node.send(targetNodeID, message);
      console.log(`[${this.agentName}] Sent message to ${targetNodeID}: ${text}`);
    } catch (error) {
      console.error(`[${this.agentName}] Failed to send message:`, error);
      throw error;
    }
  }

  /**
   * Broadcast a status message to all connected peers
   */
  private async broadcastStatus(): Promise<void> {
    const message: ChatMessage = {
      type: 'status',
      text: `${this.agentName} is online and ready to chat!`,
      sender: this.agentName,
      timestamp: Date.now(),
    };

    // Note: In a real implementation, you'd track connected peers
    // For now, this is a placeholder for broadcasting
    console.log(`[${this.agentName}] Broadcasting status: ${message.text}`);
  }

  /**
   * Send a welcome message to a newly connected peer
   */
  private async sendWelcomeMessage(nodeID: string): Promise<void> {
    const message: ChatMessage = {
      type: 'chat',
      text: `Hello from ${this.agentName}! Nice to connect with you.`,
      sender: this.agentName,
      timestamp: Date.now(),
    };

    try {
      await this.node.send(nodeID, message);
    } catch (error) {
      console.error(`[${this.agentName}] Failed to send welcome message:`, error);
    }
  }

  /**
   * Get message history
   */
  getMessageHistory(): ChatMessage[] {
    return [...this.messageHistory];
  }

  /**
   * Get the node's ID
   */
  getNodeID(): string {
    return this.node.getNodeID();
  }

  /**
   * Check if the node is running
   */
  isRunning(): boolean {
    return this.node.isRunning();
  }
}

// Example usage
async function main() {
  // Create agent instances with different configurations
  const agent1 = new SimpleChatAgent('Agent-Alice', {
    listenPort: 8001,
    enableMDNS: true,
  });

  const agent2 = new SimpleChatAgent('Agent-Bob', {
    listenPort: 8002,
    enableMDNS: true,
    bootstrapNodes: ['127.0.0.1:8001'], // Connect to agent1
  });

  try {
    // Start both agents
    await agent1.start();
    await agent2.start();

    // Wait for connections to establish
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send messages between agents
    await agent1.sendMessage(agent2.getNodeID(), 'Hi Bob! How are you?');
    await agent2.sendMessage(agent1.getNodeID(), 'Hey Alice! I am doing great!');

    // Wait a bit to see message exchanges
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Stop agents
    await agent1.stop();
    await agent2.stop();

    console.log('\n=== Message History ===');
    console.log('Agent Alice messages:', agent1.getMessageHistory());
    console.log('Agent Bob messages:', agent2.getMessageHistory());

  } catch (error) {
    console.error('Error in main:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other modules
export { SimpleChatAgent, ChatMessage };
