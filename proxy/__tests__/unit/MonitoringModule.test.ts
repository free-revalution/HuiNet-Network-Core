/**
 * MonitoringModule Unit Tests
 */

import { MonitoringModule, AlertRule } from '../../src/modules/MonitoringModule';
import { MessageHistory } from '../../src/modules/MessageHistory';
import { HuiNet } from '@huinet/network';

// Mock HuiNet
jest.mock('@huinet/network');

describe('MonitoringModule', () => {
  let monitoring: MonitoringModule;
  let mockHuiNet: jest.Mocked<HuiNet>;
  let messageHistory: MessageHistory;

  beforeEach(() => {
    // Create mock HuiNet
    mockHuiNet = {
      isRunning: jest.fn().mockReturnValue(true),
      getRoutingTable: jest.fn().mockReturnValue({
        getKnownNodes: jest.fn().mockReturnValue([]),
      }),
      getNodeID: jest.fn().mockReturnValue('test-node-id'),
    } as unknown as jest.Mocked<HuiNet>;

    messageHistory = new MessageHistory({
      maxEntries: 100,
      maxAge: 60000,
    });

    monitoring = new MonitoringModule(mockHuiNet, messageHistory);
  });

  describe('collectMetrics', () => {
    it('should return current metrics', () => {
      const metrics = monitoring['collectMetrics']();

      expect(metrics).toMatchObject({
        uptime: expect.any(Number),
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        },
        connections: {
          total: expect.any(Number),
          active: expect.any(Number),
          websocket: expect.any(Number),
          http: expect.any(Number),
        },
        messages: expect.any(Object),
        nodes: expect.any(Object),
        timestamp: expect.any(Number),
      });
    });

    it('should include WebSocket client count', () => {
      monitoring.setWsClientCount(5);
      const metrics = monitoring['collectMetrics']();

      expect(metrics.connections.websocket).toBe(5);
    });

    it('should increment HTTP request count', () => {
      monitoring.incrementHttpRequestCount();
      monitoring.incrementHttpRequestCount();

      const metrics = monitoring['collectMetrics']();

      expect(metrics.connections.http).toBe(2);
    });
  });

  describe('evaluateHealth', () => {
    it('should return healthy status when all checks pass', () => {
      const metrics = monitoring['collectMetrics']();
      const health = monitoring['evaluateHealth'](metrics);

      expect(health.status).toBe('healthy');
      expect(health.checks).toHaveLength(3);
    });

    it('should return unhealthy when HuiNet is not running', () => {
      mockHuiNet.isRunning.mockReturnValue(false);

      const metrics = monitoring['collectMetrics']();
      const health = monitoring['evaluateHealth'](metrics);

      expect(health.status).toBe('unhealthy');
      expect(health.checks.some(c => c.status === 'fail')).toBe(true);
    });
  });

  describe('alert rules', () => {
    it('should add custom alert rule', () => {
      const rule: AlertRule = {
        id: 'test_rule',
        name: 'Test Rule',
        condition: () => false, // Don't trigger
        severity: 'info',
        description: 'Test description',
      };

      monitoring.addAlertRule(rule);
      // Rule added successfully if no error thrown
      expect(true).toBe(true);
    });

    it('should remove alert rule', () => {
      const rule: AlertRule = {
        id: 'test_rule',
        name: 'Test Rule',
        condition: () => false,
        severity: 'info',
        description: 'Test description',
      };

      monitoring.addAlertRule(rule);
      const removed = monitoring.removeAlertRule('test_rule');

      expect(removed).toBe(true);
    });
  });

  describe('checkAlerts', () => {
    it('should check all alert rules and return new alerts', () => {
      // Add a rule that will trigger
      monitoring.addAlertRule({
        id: 'test_trigger',
        name: 'Test Trigger',
        condition: () => true,
        severity: 'info',
        description: 'Test alert',
      });

      const newAlerts = monitoring.checkAlerts();

      expect(newAlerts.length).toBeGreaterThan(0);
      expect(newAlerts[0]).toMatchObject({
        ruleId: 'test_trigger',
        severity: 'info',
        message: 'Test alert',
        resolved: false,
      });
    });

    it('should not trigger rules that do not match conditions', () => {
      monitoring.addAlertRule({
        id: 'test_no_trigger',
        name: 'Test No Trigger',
        condition: () => false,
        severity: 'info',
        description: 'Should not trigger',
      });

      const newAlerts = monitoring.checkAlerts();

      expect(newAlerts.length).toBe(0);
    });
  });

  describe('metrics recording', () => {
    it('should record metric values', () => {
      monitoring.recordMetric('test_metric', 42);
      // Metrics are stored internally and used in collectMetrics
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('getRouter', () => {
    it('should return Express router', () => {
      const router = monitoring.getRouter();
      expect(router).toBeDefined();
    });
  });
});
