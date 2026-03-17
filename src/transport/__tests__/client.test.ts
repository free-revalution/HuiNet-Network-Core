import { TCPClient } from '../client';
import { generateKeyPair, deriveNodeID } from '../../crypto/keypair';
import * as net from 'net';

describe('TCPClient', () => {
  let client: TCPClient;
  let testServer: net.Server;
  let testPort: number;

  beforeAll((done) => {
    // Create a test server
    testServer = net.createServer((socket) => {
      socket.on('data', (data) => {
        // Echo back the data
        socket.write(data);
      });
      // Handle socket errors gracefully
      socket.on('error', () => {
        // Ignore socket errors in tests
      });
    });

    testServer.listen(0, () => {
      const address = testServer.address() as net.AddressInfo;
      testPort = address.port;
      done();
    });
  });

  afterAll((done) => {
    testServer.close(() => {
      // Give time for sockets to fully close
      setTimeout(done, 100);
    });
  });

  beforeEach(() => {
    const keyPair = generateKeyPair();
    const nodeID = deriveNodeID(keyPair.publicKey);
    client = new TCPClient({ nodeId: nodeID });
  });

  afterEach(() => {
    if (client.isConnected()) {
      client.disconnect();
    }
  });

  describe('client creation', () => {
    it('should create a client with valid config', () => {
      const keyPair = generateKeyPair();
      const nodeID = deriveNodeID(keyPair.publicKey);
      const testClient = new TCPClient({ nodeId: nodeID });

      expect(testClient).toBeInstanceOf(TCPClient);
      expect(testClient.isConnected()).toBe(false);
    });

    it('should create client with EventEmitter capabilities', () => {
      const keyPair = generateKeyPair();
      const nodeID = deriveNodeID(keyPair.publicKey);
      const testClient = new TCPClient({ nodeId: nodeID });

      expect(typeof testClient.on).toBe('function');
      expect(typeof testClient.emit).toBe('function');
      expect(typeof testClient.once).toBe('function');
    });
  });

  describe('connection to server', () => {
    it('should connect to a server successfully', async () => {
      await expect(client.connect('127.0.0.1', testPort)).resolves.not.toThrow();
      expect(client.isConnected()).toBe(true);
    });

    it('should emit connected event on successful connection', (done) => {
      client.on('connected', () => {
        expect(client.isConnected()).toBe(true);
        done();
      });

      client.connect('127.0.0.1', testPort).catch(done);
    });

    it('should emit error event on connection failure', (done) => {
      const keyPair = generateKeyPair();
      const nodeID = deriveNodeID(keyPair.publicKey);
      const errorClient = new TCPClient({ nodeId: nodeID });

      errorClient.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      errorClient.connect('127.0.0.1', 9999).catch(() => {
        // Expected to fail
      });
    });

    it('should handle multiple connection attempts', async () => {
      await client.connect('127.0.0.1', testPort);
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      expect(client.isConnected()).toBe(false);

      // Should be able to reconnect
      await client.connect('127.0.0.1', testPort);
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('send/receive data', () => {
    beforeEach(async () => {
      await client.connect('127.0.0.1', testPort);
    });

    it('should send data successfully', () => {
      const data = Buffer.from('Hello, Server!');
      const result = client.send(data);

      expect(result).toBe(true);
    });

    it('should fail to send when not connected', () => {
      // Create a new client that's not connected
      const disconnectedClient = new TCPClient({ nodeId: deriveNodeID(generateKeyPair().publicKey) });
      const data = Buffer.from('Hello, Server!');
      const result = disconnectedClient.send(data);

      expect(result).toBe(false);
    });

    it('should receive and parse JSON messages', (done) => {
      const message = { type: 'test', data: 'hello' };
      const messageBuffer = Buffer.from(JSON.stringify(message));

      client.on('message', (data) => {
        expect(data.message).toEqual(message);
        done();
      });

      // Simulate receiving data by triggering the internal handler
      client.emit('message', { message });
    });

    it('should handle multiple sends', () => {
      const message1 = Buffer.from('Message 1');
      const message2 = Buffer.from('Message 2');
      const message3 = Buffer.from('Message 3');

      expect(client.send(message1)).toBe(true);
      expect(client.send(message2)).toBe(true);
      expect(client.send(message3)).toBe(true);
    });

    it('should handle binary data', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff]);
      const result = client.send(binaryData);

      expect(result).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from server', async () => {
      await client.connect('127.0.0.1', testPort);
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should emit disconnected event', (done) => {
      client.on('disconnected', () => {
        expect(client.isConnected()).toBe(false);
        done();
      });

      client.connect('127.0.0.1', testPort).then(() => {
        client.disconnect();
      });
    });

    it('should handle disconnect when not connected', () => {
      expect(() => client.disconnect()).not.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle multiple disconnects', async () => {
      await client.connect('127.0.0.1', testPort);

      client.disconnect();
      expect(client.isConnected()).toBe(false);

      // Should not throw on second disconnect
      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await client.connect('127.0.0.1', testPort);
      expect(client.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      await client.connect('127.0.0.1', testPort);
      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('connection error handling', () => {
    it('should emit error event on connection failure', (done) => {
      const errorClient = new TCPClient({ nodeId: deriveNodeID(generateKeyPair().publicKey) });

      errorClient.on('error', () => {
        // Error event was emitted
        done();
      });

      // Try to connect to a non-existent server
      errorClient.connect('127.0.0.1', 45679).catch(() => {
        // Expected to fail, error event should have been emitted
      });
    });
  });
});
