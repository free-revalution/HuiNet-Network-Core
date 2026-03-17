/**
 * Integration tests for connection validation
 */

import { HuiNet } from '../HuiNet';

describe('connectToNode validation', () => {
  it('should return false when connection fails', async () => {
    const node = new HuiNet({ listenPort: 8101, enableMDNS: false });
    await node.start();

    // 尝试连接到不存在的端口
    const result = await (node as any).connectToNode('127.0.0.1', 9999);

    expect(result).toBe(false);

    await node.stop();
  }, 10000);

  it('should return true when connection succeeds', async () => {
    const node1 = new HuiNet({ listenPort: 8102, enableMDNS: false });
    const node2 = new HuiNet({ listenPort: 8103, enableMDNS: false });

    await node1.start();
    await node2.start();

    const result = await (node1 as any).connectToNode('127.0.0.1', 8103);

    expect(result).toBe(true);

    await node1.stop();
    await node2.stop();
  }, 10000);
});
