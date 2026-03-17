/**
 * Tests for CLI command handlers
 */

import { listNodes } from '../handlers';
import { HuiNet } from '../../../src';
import { ConfigManager } from '../../storage/config';

describe('listNodes', () => {
  it('should display address correctly', async () => {
    const mockHuinet = {
      getRoutingTable: () => ({
        getKnownNodes: () => [{
          nodeID: 'test-node-id-12345678901234567890',
          addresses: [{ host: '127.0.0.1', port: 8002, type: 'tcp' }],
          state: 'ONLINE'
        }],
        getActiveNodes: () => [],
        getCoreNodes: () => []
      }),
      getNodeID: () => 'test-current-node-id'
    };
    const mockConfig = { get: () => ({}) };

    // Capture console.log output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    await listNodes(mockHuinet as any, mockConfig as any);

    console.log = originalLog;

    const output = logs.join('\n');
    expect(output).toContain('127.0.0.1:8002');
    expect(output).not.toContain('[object Object]');
  });
});
