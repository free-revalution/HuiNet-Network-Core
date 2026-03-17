/**
 * HuiNet Proxy Integration Example for Claude Code
 *
 * This example shows how to integrate HuiNet with Claude Code
 * to enable P2P communication between Claude Code instances.
 */

import { HuiNetProxy } from '@huinet/proxy';

// Configuration
const PROXY_URL = 'http://localhost:3000';
const API_KEY = process.env.HUINET_API_KEY || 'your-api-key-here';

/**
 * HuiNet Client for Claude Code
 */
class ClaudeCodeHuiNetClient {
  private proxyUrl: string;
  private apiKey: string;

  constructor(proxyUrl: string, apiKey: string) {
    this.proxyUrl = proxyUrl;
    this.apiKey = apiKey;
  }

  /**
   * Send a message to another Claude Code instance
   */
  async sendMessage(targetNodeId: string, content: string): Promise<void> {
    const response = await fetch(`${this.proxyUrl}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        to: targetNodeId,
        data: {
          type: 'claude-code-message',
          content,
          timestamp: Date.now(),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to send message: ${error.error}`);
    }

    const result = await response.json();
    console.log(`Message sent: ${result.messageId}`);
  }

  /**
   * Get all known Claude Code instances
   */
  async getNodes(): Promise<any[]> {
    const response = await fetch(`${this.proxyUrl}/api/nodes`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get nodes');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get message history
   */
  async getMessages(since?: number): Promise<any[]> {
    const url = new URL(`${this.proxyUrl}/api/messages`);
    if (since) {
      url.searchParams.set('since', since.toString());
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get messages');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Create a WebSocket connection for real-time messages
   */
  createWebSocket(): WebSocket {
    const wsUrl = this.proxyUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    return new WebSocket(`${wsUrl.replace(':3000', ':3001')}?apiKey=${this.apiKey}`);
  }
}

/**
 * Example usage
 */
async function main() {
  // Start the HuiNet proxy server
  const proxy = new HuiNetProxy({
    apiKey: API_KEY,
    httpPort: 3000,
    wsPort: 3001,
    huinet: {
      listenPort: 8000,
      enableMDNS: true,
    },
  });

  await proxy.start();
  console.log('HuiNet Proxy Server started');
  console.log(`HTTP API: http://localhost:3000/api`);
  console.log(`WebSocket: ws://localhost:3001`);

  // Create client
  const client = new ClaudeCodeHuiNetClient(PROXY_URL, API_KEY);

  // Example: Get all nodes
  const nodes = await client.getNodes();
  console.log('Known nodes:', nodes.map(n => ({ id: n.nodeID, state: n.state })));

  // Example: Send a message
  if (nodes.length > 0) {
    await client.sendMessage(nodes[0].nodeID, 'Hello from Claude Code!');
  }

  // Example: WebSocket for real-time messages
  const ws = client.createWebSocket();

  ws.on('open', () => {
    console.log('WebSocket connected');

    // Subscribe to all message types
    ws.send(JSON.stringify({
      type: 'subscribe',
      data: { types: ['message', 'nodeStatus'] },
    }));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('Received:', message);

    if (message.type === 'message' && message.from) {
      console.log(`Message from ${message.from}:`, message.data);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Keep running
  console.log('Press Ctrl+C to stop');
}

// Only run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}

export { ClaudeCodeHuiNetClient };
