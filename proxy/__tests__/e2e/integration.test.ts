/**
 * End-to-End Integration Tests for HuiNet Proxy Server
 */

import { HuiNetProxy } from '../../src/HuiNetProxy';
import { WebSocket } from 'ws';

describe('HuiNet Proxy E2E Tests', () => {
  let proxy1: HuiNetProxy;
  let proxy2: HuiNetProxy;
  let proxy1HttpUrl: string;
  let proxy2HttpUrl: string;
  let proxy1WsUrl: string;
  let proxy2WsUrl: string;
  let proxy1ApiKey: string;
  let proxy2ApiKey: string;

  beforeAll(async () => {
    // Generate random API keys for testing
    proxy1ApiKey = `test-key-${Date.now()}-${Math.random().toString(36)}`;
    proxy2ApiKey = `test-key-${Date.now()}-${Math.random().toString(36)}`;

    // Start first proxy
    proxy1 = new HuiNetProxy({
      apiKey: proxy1ApiKey,
      httpPort: 3100,
      wsPort: 3101,
      huinet: {
        listenPort: 8100,
        enableMDNS: false,
        bootstrapNodes: [],
      },
    });

    await proxy1.start();
    proxy1HttpUrl = 'http://127.0.0.1:3100';
    proxy1WsUrl = 'ws://127.0.0.1:3101';

    // Start second proxy
    proxy2 = new HuiNetProxy({
      apiKey: proxy2ApiKey,
      httpPort: 3200,
      wsPort: 3201,
      huinet: {
        listenPort: 8200,
        enableMDNS: false,
        bootstrapNodes: [],
      },
    });

    await proxy2.start();
    proxy2HttpUrl = 'http://127.0.0.1:3200';
    proxy2WsUrl = 'ws://127.0.0.1:3201';

    // Wait for servers to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    if (proxy1) await proxy1.stop();
    if (proxy2) await proxy2.stop();
  }, 30000);

  describe('HTTP API E2E', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${proxy1HttpUrl}/health`);
      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.running).toBe(true);
    });

    it('should return 401 without API key', async () => {
      const response = await fetch(`${proxy1HttpUrl}/api/nodes`);
      expect(response.status).toBe(401);
    });

    it('should get empty nodes list initially', async () => {
      const response = await fetch(`${proxy1HttpUrl}/api/nodes`, {
        headers: { 'X-API-Key': proxy1ApiKey },
      });
      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
    });

    it('should get proxy status', async () => {
      const response = await fetch(`${proxy1HttpUrl}/api/status`, {
        headers: { 'X-API-Key': proxy1ApiKey },
      });
      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.nodeID).toBeDefined();
      expect(data.data.isRunning).toBe(true);
    });
  });

  describe('Message Sending E2E', () => {
    it('should send message from proxy1 to proxy2', async () => {
      // Get proxy2's node ID first
      const status2 = await fetch(`${proxy2HttpUrl}/api/status`, {
        headers: { 'X-API-Key': proxy2ApiKey },
      });
      const status2Data: any = await status2.json();
      const targetNodeID = status2Data.data.nodeID;

      // Since mDNS is disabled, we manually connect with nodeID
      const connected = await proxy1.getHuiNet().connectToNode('127.0.0.1', 8200, targetNodeID);
      expect(connected).toBe(true);

      // Wait for connection to be established and routing table updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify node is in routing table
      const knownNode = proxy1.getHuiNet().getRoutingTable().getKnownNode(targetNodeID);
      expect(knownNode).toBeDefined();

      // Send message from proxy1 to proxy2
      const sendResponse = await fetch(`${proxy1HttpUrl}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': proxy1ApiKey,
        },
        body: JSON.stringify({
          to: targetNodeID,
          data: { message: 'Hello from proxy1!' },
        }),
      });

      const sendResult: any = await sendResponse.json();
      expect(sendResult.success).toBe(true);
      expect(sendResult.messageId).toBeDefined();

      // Give time for message to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check message history on proxy1
      const messagesResponse = await fetch(`${proxy1HttpUrl}/api/messages?limit=10`, {
        headers: { 'X-API-Key': proxy1ApiKey },
      });
      const messagesData: any = await messagesResponse.json();

      expect(messagesData.success).toBe(true);
      const sentMessage = messagesData.data.find((m: any) => m.direction === 'outbound');
      expect(sentMessage).toBeDefined();
    }, 15000);
  });

  describe('WebSocket E2E', () => {
    it('should connect and authenticate with WebSocket', (done) => {
      const ws = new WebSocket(`${proxy1WsUrl}?apiKey=${proxy1ApiKey}`);

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    it('should reject WebSocket without API key', (done) => {
      const ws = new WebSocket('ws://127.0.0.1:3101');

      let openFired = false;
      let closeFired = false;

      ws.on('open', () => {
        openFired = true;
        // Server might close immediately after open
        if (closeFired) {
          // Already closed, check the code in close handler
          return;
        }
      });

      ws.on('close', (code, reason) => {
        closeFired = true;
        // Close code 4001 indicates authentication failure
        if (code === 4001) {
          done();
        } else {
          done(new Error(`Expected close code 4001, got ${code}`));
        }
      });

      ws.on('error', (err) => {
        // Also accept error event
        if (!closeFired) {
          done();
        }
      });
    });

    it('should receive ping/pong messages', (done) => {
      const ws = new WebSocket(`${proxy1WsUrl}?apiKey=${proxy1ApiKey}`);
      const timeout = setTimeout(() => {
        ws.close();
        done(new Error('Ping/pong timeout'));
      }, 10000);

      let welcomeSkipped = false;

      ws.on('open', () => {
        // Send ping after a short delay
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'ping' }));
        }, 100);
      });

      ws.on('message', (data: any) => {
        let msg: any;
        try {
          // data might be Buffer, string, or already parsed object
          if (typeof data === 'string') {
            msg = JSON.parse(data);
          } else if (Buffer.isBuffer(data)) {
            msg = JSON.parse(data.toString());
          } else if (typeof data === 'object' && data !== null && 'type' in data) {
            msg = data;
          } else {
            return; // Skip unrecognized format
          }
        } catch (e) {
          // Skip non-JSON messages
          return;
        }

        // Skip welcome message (has 'connected' property)
        if (!welcomeSkipped && msg.data && 'connected' in msg.data) {
          welcomeSkipped = true;
          return;
        }

        if (msg.type === 'pong') {
          clearTimeout(timeout);
          ws.close();
          done();
        }
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    it('should handle subscribe/unsubscribe', (done) => {
      const ws = new WebSocket(`${proxy1WsUrl}?apiKey=${proxy1ApiKey}`);

      ws.on('open', () => {
        // Skip welcome message
        ws.addEventListener('message', () => {
          // Subscribe
          ws.send(JSON.stringify({
            type: 'subscribe',
            data: { types: ['message'] },
          }));

          // Unsubscribe
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'unsubscribe' }));
            ws.close();
            done();
          }, 100);
        }, { once: true });
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete message flow: HTTP send -> WebSocket receive', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Integration test timeout'));
      }, 10000);

      // Get proxy2's node ID first
      fetch(`${proxy2HttpUrl}/api/status`, {
        headers: { 'X-API-Key': proxy2ApiKey },
      }).then(async (res) => {
        const status2Data: any = await res.json();
        const targetNodeID = status2Data.data.nodeID;

        // Connect proxies with nodeID
        return proxy1.getHuiNet().connectToNode('127.0.0.1', 8200, targetNodeID);
      }).then(() => {
        // Wait for connection to be established
        return new Promise(resolve => setTimeout(resolve, 1000));
      }).then(async () => {
        const status2 = await fetch(`${proxy2HttpUrl}/api/status`, {
          headers: { 'X-API-Key': proxy2ApiKey },
        });
        const status2Data: any = await status2.json();
        const targetNodeID = status2Data.data.nodeID;

        // Create WebSocket client on proxy2 (the message receiver)
        const ws = new WebSocket(`${proxy2WsUrl}?apiKey=${proxy2ApiKey}`);

        let welcomeSkipped = false;
        let messageReceived = false;

        ws.on('open', () => {
          // Subscribe after a short delay
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'subscribe',
              data: { types: ['message'] },
            }));
          }, 100);
        });

        ws.on('message', (data) => {
          let msg: any;
          try {
            if (typeof data === 'string') {
              msg = JSON.parse(data);
            } else if (Buffer.isBuffer(data)) {
              msg = JSON.parse(data.toString());
            } else if (typeof data === 'object' && data !== null && 'type' in data) {
              msg = data;
            } else {
              return;
            }
          } catch (e) {
            return;
          }

          // Skip welcome message
          if (!welcomeSkipped && msg.data && 'connected' in msg.data) {
            welcomeSkipped = true;
            return;
          }

          // Check for message from the network
          if (msg.type === 'message' && msg.from && !messageReceived) {
            messageReceived = true;
            clearTimeout(timeout);
            ws.close();
            done();
          }
        });

        // Send message via HTTP after WebSocket is ready
        setTimeout(async () => {
          await fetch(`${proxy1HttpUrl}/api/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': proxy1ApiKey,
            },
            body: JSON.stringify({
              to: targetNodeID,
              data: { type: 'test-message', content: 'Integration test' },
            }),
          });
        }, 500);
      }).catch((err) => {
        clearTimeout(timeout);
        done(err);
      });
    }, 15000);
  });
});
