/**
 * Simple HTTP Client for HuiNet Proxy
 *
 * A minimal example showing how to interact with the HuiNet Proxy Server
 * using standard HTTP requests from any programming language.
 */

const http = require('http');
const WebSocket = require('ws');

// Configuration
const PROXY_HOST = 'localhost';
const HTTP_PORT = 3000;
const WS_PORT = 3001;
const API_KEY = process.env.HUINET_API_KEY || 'your-api-key';

/**
 * Helper function to make HTTP requests to the proxy
 */
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PROXY_HOST,
      port: HTTP_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`${res.statusCode}: ${result.error || result.code}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Example: Send a message to a node
 */
async function sendMessage(toNodeId, message) {
  const result = await request('POST', '/api/send', {
    to: toNodeId,
    data: { text: message, timestamp: Date.now() },
  });
  console.log('✓ Message sent:', result.messageId);
}

/**
 * Example: Get all known nodes
 */
async function getNodes() {
  const result = await request('GET', '/api/nodes');
  console.log('✓ Known nodes:', result.data.map(n => n.nodeID));
  return result.data;
}

/**
 * Example: Get message history
 */
async function getMessages(limit = 10) {
  const result = await request('GET', `/api/messages?limit=${limit}`);
  console.log('✓ Recent messages:', result.data.length);
  return result.data;
}

/**
 * Example: Get proxy status
 */
async function getStatus() {
  const result = await request('GET', '/api/status');
  console.log('✓ Status:', result.data);
  return result.data;
}

/**
 * Example: Connect via WebSocket for real-time messages
 */
function connectWebSocket() {
  const ws = new WebSocket(`ws://${PROXY_HOST}:${WS_PORT}?apiKey=${API_KEY}`);

  ws.on('open', () => {
    console.log('✓ WebSocket connected');

    // Subscribe to messages
    ws.send(JSON.stringify({
      type: 'subscribe',
      data: { types: ['message', 'nodeStatus'] },
    }));

    // Send a ping every 30 seconds
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'message' && msg.from) {
      console.log(`→ Message from ${msg.from}:`, msg.data);
    } else if (msg.type === 'nodeStatus') {
      console.log(`→ Node status:`, msg.data);
    } else if (msg.type === 'pong') {
      // Ping response
    }
  });

  ws.on('error', (error) => {
    console.error('✗ WebSocket error:', error.message);
  });

  ws.on('close', () => {
    console.log('✗ WebSocket disconnected');
  });

  return ws;
}

/**
 * Main example
 */
async function main() {
  console.log('HuiNet Proxy Client Example\n');

  try {
    // Check proxy health
    console.log('1. Checking proxy health...');
    await request('GET', '/health');
    console.log('');

    // Get status
    console.log('2. Getting proxy status...');
    await getStatus();
    console.log('');

    // Get nodes
    console.log('3. Getting known nodes...');
    const nodes = await getNodes();
    console.log('');

    // Get recent messages
    console.log('4. Getting recent messages...');
    await getMessages(5);
    console.log('');

    // Connect WebSocket
    console.log('5. Connecting WebSocket...');
    const ws = connectWebSocket();
    console.log('');

    // Send a message if there are nodes
    if (nodes.length > 0) {
      console.log('6. Sending test message...');
      await sendMessage(nodes[0].nodeID, 'Hello from Node.js client!');
      console.log('');
    }

    console.log('Running... Press Ctrl+C to stop');

    // Keep running
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      ws.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { sendMessage, getNodes, getMessages, getStatus, connectWebSocket };
