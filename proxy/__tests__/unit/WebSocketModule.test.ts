/**
 * Unit Tests - WebSocketModule
 */

import { WebSocket } from 'ws';
import { WebSocketModule } from '../../src/modules/WebSocketModule';
import { WSMessage, WebSocketClient } from '../../src/types';

describe('WebSocketModule', () => {
  let wsModule: WebSocketModule;
  let mockOnMessage: jest.Mock;
  let mockOnDisconnect: jest.Mock;

  const testConfig = {
    port: 3010, // Use different port for tests
    host: '127.0.0.1',
    apiKey: 'test-api-key',
    heartbeatInterval: 5000, // Shorter interval for tests
  };

  beforeEach(() => {
    mockOnMessage = jest.fn();
    mockOnDisconnect = jest.fn();

    wsModule = new WebSocketModule(testConfig, {
      onMessage: mockOnMessage,
      onDisconnect: mockOnDisconnect,
    });
  });

  afterEach(async () => {
    try {
      await wsModule.stop();
    } catch {
      // Ignore if not started
    }
  });

  describe('initialization', () => {
    it('should create WebSocket module with config', () => {
      expect(wsModule).toBeDefined();
      expect(wsModule.getClientCount()).toBe(0);
    });

    it('should reject invalid heartbeat interval', () => {
      expect(() => {
        new WebSocketModule(
          { ...testConfig, heartbeatInterval: 500 },
          { onMessage: jest.fn(), onDisconnect: jest.fn() }
        );
      }).toThrow('heartbeatInterval must be at least 1000ms');
    });
  });

  describe('client management', () => {
    let client: WebSocket;

    beforeEach((done) => {
      wsModule.start();
      client = new WebSocket(`ws://127.0.0.1:3010?apiKey=${testConfig.apiKey}`);

      client.on('open', () => done());
      client.on('error', (err) => {
        done(err);
      });
    });

    afterEach(() => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    it('should accept connection with valid API key', (done) => {
      expect(wsModule.getClientCount()).toBeGreaterThan(0);
      done();
    });

    it('should reject connection with invalid API key', (done) => {
      const badClient = new WebSocket('ws://127.0.0.1:3010?apiKey=wrong-key');

      badClient.on('error', () => {
        // Expected
      });

      badClient.on('close', (code, reason) => {
        expect(code).toBe(4001);
        badClient.close();
        done();
      });
    });

    it('should send welcome message on connection', (done) => {
      // Create a new client for this test to catch the welcome message
      const newClient = new WebSocket(`ws://127.0.0.1:3010?apiKey=${testConfig.apiKey}`);

      newClient.on('message', (data) => {
        const message = JSON.parse(data.toString()) as WSMessage;
        expect(message.type).toBe('message');
        expect(message.data).toHaveProperty('connected', true);
        expect(message.data).toHaveProperty('clientId');
        newClient.close();
        done();
      });

      newClient.on('error', (err) => {
        newClient.close();
        done(err);
      });
    });

    it('should handle ping/pong', (done) => {
      client.send(JSON.stringify({ type: 'ping' }));

      client.on('message', (data) => {
        const message = JSON.parse(data.toString()) as WSMessage;
        if (message.type === 'pong') {
          expect(message.type).toBe('pong');
          done();
        }
      });
    });

    it('should handle subscribe', (done) => {
      client.send(JSON.stringify({
        type: 'subscribe',
        data: { types: ['chat', 'notification'] }
      }));

      // Wait for processing
      setTimeout(() => {
        const clients = wsModule.getAllClients();
        expect(clients.length).toBeGreaterThan(0);
        expect(clients[0].subscriptions).toContain('chat');
        expect(clients[0].subscriptions).toContain('notification');
        done();
      }, 100);
    });

    it('should handle unsubscribe', (done) => {
      // Subscribe first
      client.send(JSON.stringify({
        type: 'subscribe',
        data: { types: ['chat'] }
      }));

      setTimeout(() => {
        // Then unsubscribe
        client.send(JSON.stringify({ type: 'unsubscribe' }));

        setTimeout(() => {
          const clients = wsModule.getAllClients();
          expect(clients[0].subscriptions).toEqual([]);
          done();
        }, 100);
      }, 100);
    });

    it('should handle disconnect', (done) => {
      const clientId = wsModule.getAllClients()[0]?.id;
      expect(clientId).toBeDefined();

      client.close();

      setTimeout(() => {
        expect(mockOnDisconnect).toHaveBeenCalledWith(clientId);
        expect(wsModule.getClientCount()).toBe(0);
        done();
      }, 100);
    });
  });

  describe('message sending', () => {
    let client: WebSocket;

    beforeEach((done) => {
      wsModule.start();
      client = new WebSocket(`ws://127.0.0.1:3010?apiKey=${testConfig.apiKey}`);

      // Wait for welcome message then proceed
      client.on('message', () => {
        done();
      });
    });

    afterEach(() => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    it('should send message to specific client', (done) => {
      const wsClient = wsModule.getAllClients()[0];
      expect(wsClient).toBeDefined();

      const testMessage: WSMessage = {
        type: 'message',
        from: 'test-node',
        data: { hello: 'world' },
        timestamp: Date.now(),
      };

      // Listen for next message
      const handleMessage = (data: any) => {
        const message = JSON.parse(data.toString()) as WSMessage;
        if (message.data && typeof message.data === 'object' && 'hello' in message.data) {
          expect(message.type).toBe('message');
          expect(message.data).toEqual({ hello: 'world' });
          client.off('message', handleMessage);
          done();
        }
      };

      client.on('message', handleMessage);
      wsModule.sendToClient(wsClient!, testMessage);
    });

    it('should broadcast message to all clients', (done) => {
      // Create second client
      const client2 = new WebSocket(`ws://127.0.0.1:3010?apiKey=${testConfig.apiKey}`);
      let receivedCount = 0;

      const testMessage: WSMessage = {
        type: 'message',
        data: { broadcast: 'test' },
        timestamp: Date.now(),
      };

      const checkReceived = (data: any) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        if (msg.data && typeof msg.data === 'object' && 'broadcast' in msg.data) {
          receivedCount++;
          if (receivedCount === 2) {
            client2.close();
            done();
          }
        }
      };

      client.on('message', checkReceived);
      client2.on('message', checkReceived);

      client2.on('open', () => {
        // Wait for welcome messages to be processed
        setTimeout(() => {
          wsModule.broadcast(testMessage);
        }, 100);
      });
    });

    it('should broadcast to subscribers only', (done) => {
      // Subscribe first client to 'chat'
      client.send(JSON.stringify({
        type: 'subscribe',
        data: { types: ['chat'] }
      }));

      let receivedChat = false;
      let receivedNotification = false;

      const handleMessage = (data: any) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        if (msg.data && typeof msg.data === 'object') {
          if ('type' in msg.data && msg.data.type === 'chat') {
            receivedChat = true;
          } else if ('type' in msg.data && msg.data.type === 'notification') {
            receivedNotification = true;
          }
        }
      };

      client.on('message', handleMessage);

      setTimeout(() => {
        // Broadcast to 'chat' subscribers
        wsModule.broadcastToSubscribers('chat', {
          type: 'message',
          data: { type: 'chat' },
          timestamp: Date.now(),
        });

        // Broadcast to 'notification' subscribers (should not receive)
        wsModule.broadcastToSubscribers('notification', {
          type: 'message',
          data: { type: 'notification' },
          timestamp: Date.now(),
        });

        setTimeout(() => {
          expect(receivedChat).toBe(true);
          expect(receivedNotification).toBe(false);
          client.off('message', handleMessage);
          done();
        }, 200);
      }, 100);
    });
  });

  describe('lifecycle', () => {
    it('should start and stop gracefully', async () => {
      expect(wsModule.getClientCount()).toBe(0);

      wsModule.start();
      expect(wsModule.getClientCount()).toBe(0); // No clients yet

      await wsModule.stop();
      // Should be able to start again
      wsModule.start();
      await wsModule.stop();
    });
  });
});
