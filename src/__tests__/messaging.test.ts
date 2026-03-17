import { HuiNet } from '../HuiNet';

describe('Message sending', () => {
  it('should send message to connected node', async () => {
    const node1 = new HuiNet({ listenPort: 8201, enableMDNS: false });
    const node2 = new HuiNet({ listenPort: 8202, enableMDNS: false });

    await node1.start();
    await node2.start();

    // Establish connection first
    await node1.connectToNode('127.0.0.1', 8202);

    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send message
    const received = new Promise<any>(resolve => {
      node2.on('message', (from, data) => resolve(data));
    });

    await node1.send('127.0.0.1:8202', { type: 'test', text: 'hello' });

    const result = await received;
    expect(result.data.text).toBe('hello');

    await node1.stop();
    await node2.stop();
  });

  it('should reconnect if connection lost', async () => {
    const node1 = new HuiNet({ listenPort: 8203, enableMDNS: false });
    const node2 = new HuiNet({ listenPort: 8204, enableMDNS: false });

    await node1.start();
    await node2.start();

    // Establish connection first
    const connected = await node1.connectToNode('127.0.0.1', 8204);
    expect(connected).toBe(true);

    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now stop node2 to simulate connection loss
    await node2.stop();

    // Wait a bit for the connection to be detected as lost
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify connection is lost
    const routingTable = node1.getRoutingTable();
    const knownNode = routingTable.getKnownNode('127.0.0.1:8204');
    expect(knownNode).toBeDefined();

    // Restart node2
    await node2.start();

    // Wait for node2 to be ready
    await new Promise(resolve => setTimeout(resolve, 200));

    // Try to send message - should reconnect automatically
    let messageResolve: any;
    let messageReject: any;
    const received = new Promise<any>((resolve, reject) => {
      messageResolve = resolve;
      messageReject = reject;
      const timeout = setTimeout(() => {
        reject(new Error('Message not received'));
      }, 2000);
      node2.once('message', (from, data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    // This should succeed by reconnecting automatically
    await node1.send('127.0.0.1:8204', { type: 'test', text: 'reconnected' });

    const result = await received;
    expect(result.data.text).toBe('reconnected');

    await node1.stop();
    await node2.stop();
  });
});
