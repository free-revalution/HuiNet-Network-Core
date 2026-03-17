/**
 * HuiNet Proxy Server - Monitoring Module
 *
 * Provides monitoring and metrics collection capabilities
 */

import { Router, Request, Response } from 'express';
import type { HuiNet } from '@huinet/network';
import { MessageHistory } from './MessageHistory';

export interface MonitoringMetrics {
  uptime: number;
  memory: MemoryMetrics;
  connections: ConnectionMetrics;
  messages: MessageMetrics;
  nodes: NodeMetrics;
  timestamp: number;
}

export interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
}

export interface ConnectionMetrics {
  total: number;
  active: number;
  websocket: number;
  http: number;
}

export interface MessageMetrics {
  sent: number;
  received: number;
  queued: number;
  failed: number;
  avgProcessingTime: number;
}

export interface NodeMetrics {
  total: number;
  online: number;
  offline: number;
  unknown: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: MonitoringMetrics) => boolean;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
}

export class MonitoringModule {
  private router: Router;
  private huinet: HuiNet;
  private messageHistory: MessageHistory;
  private startTime: number;
  private metrics: Map<string, number> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private wsClientCount: number = 0;
  private httpRequestCount: number = 0;

  constructor(huinet: HuiNet, messageHistory: MessageHistory) {
    this.huinet = huinet;
    this.messageHistory = messageHistory;
    this.startTime = Date.now();
    this.router = Router();
    this.setupRoutes();
    this.setupDefaultAlertRules();
  }

  /**
   * Setup monitoring routes
   */
  private setupRoutes(): void {
    // Get current metrics
    this.router.get('/metrics', this.getMetrics.bind(this));

    // Get health status
    this.router.get('/health', this.getHealth.bind(this));

    // Get active alerts
    this.router.get('/alerts', this.getAlerts.bind(this));

    // Get metrics history
    this.router.get('/metrics/history', this.getMetricsHistory.bind(this));

    // Resolve an alert
    this.router.post('/alerts/:alertId/resolve', this.resolveAlert.bind(this));

    // Test alert rules
    this.router.post('/alerts/test', this.testAlerts.bind(this));
  }

  /**
   * GET /api/monitoring/metrics - Get current metrics
   */
  private getMetrics(req: Request, res: Response): void {
    try {
      const metrics = this.collectMetrics();

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to collect metrics',
      });
    }
  }

  /**
   * GET /api/monitoring/health - Get health status
   */
  private getHealth(req: Request, res: Response): void {
    try {
      const metrics = this.collectMetrics();
      const health = this.evaluateHealth(metrics);

      const statusCode = health.status === 'healthy' ? 200 :
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode);
      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      res.status(503);
      res.json({
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
        data: {
          status: 'unhealthy',
          checks: [],
        },
      });
    }
  }

  /**
   * GET /api/monitoring/alerts - Get active alerts
   */
  private getAlerts(req: Request, res: Response): void {
    try {
      const alerts = Array.from(this.activeAlerts.values());

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get alerts',
      });
    }
  }

  /**
   * POST /api/monitoring/alerts/:alertId/resolve - Resolve an alert
   */
  private resolveAlert(req: Request, res: Response): void {
    try {
      const { alertId } = req.params;

      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        res.status(404);
        res.json({
          success: false,
          error: 'Alert not found',
        });
        return;
      }

      alert.resolved = true;
      this.activeAlerts.delete(alertId);

      res.json({
        success: true,
        data: { alertId, resolved: true },
      });
    } catch (error) {
      res.status(500);
      res.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve alert',
      });
    }
  }

  /**
   * GET /api/monitoring/metrics/history - Get metrics history
   */
  private getMetricsHistory(req: Request, res: Response): void {
    try {
      const since = req.query.since ? parseInt(req.query.since as string, 10) : Date.now() - 3600000; // Default 1 hour

      // In a real implementation, this would retrieve from a time-series database
      // For now, return current metrics only
      const current = this.collectMetrics();

      res.json({
        success: true,
        data: {
          from: new Date(since).toISOString(),
          to: new Date().toISOString(),
          samples: [current],
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get metrics history',
      });
    }
  }

  /**
   * POST /api/monitoring/alerts/test - Test alert rules
   */
  private testAlerts(req: Request, res: Response): void {
    try {
      const metrics = this.collectMetrics();
      const triggeredAlerts: Alert[] = [];

      for (const rule of this.alertRules.values()) {
        if (rule.condition(metrics)) {
          const alert: Alert = {
            id: `test_${rule.id}_${Date.now()}`,
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.description,
            timestamp: Date.now(),
            resolved: false,
          };
          triggeredAlerts.push(alert);
        }
      }

      res.json({
        success: true,
        data: {
          tested: this.alertRules.size,
          triggered: triggeredAlerts.length,
          alerts: triggeredAlerts,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test alerts',
      });
    }
  }

  /**
   * Collect all metrics
   */
  private collectMetrics(): MonitoringMetrics {
    const memUsage = process.memoryUsage();
    const historyStats = this.messageHistory.getStats();
    const routingTable = this.huinet.getRoutingTable();
    const knownNodes = routingTable.getKnownNodes();

    return {
      uptime: process.uptime(),
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      connections: {
        total: this.wsClientCount + this.httpRequestCount,
        active: this.wsClientCount,
        websocket: this.wsClientCount,
        http: this.httpRequestCount,
      },
      messages: {
        sent: historyStats.outbound,
        received: historyStats.inbound,
        queued: 0, // Would come from MessageQueue
        failed: 0, // Would track failed messages
        avgProcessingTime: this.metrics.get('avgProcessingTime') || 0,
      },
      nodes: {
        total: knownNodes.length,
        online: knownNodes.filter(n => n.state === 1).length, // NodeState.ONLINE = 1
        offline: knownNodes.filter(n => n.state === 2).length, // NodeState.OFFLINE = 2
        unknown: knownNodes.filter(n => n.state === 0).length, // NodeState.UNKNOWN = 0
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Evaluate health status
   */
  private evaluateHealth(metrics: MonitoringMetrics): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message?: string;
    }>;
  } {
    const checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message?: string;
    }> = [];

    // Memory check
    if (metrics.memory.percentage > 90) {
      checks.push({ name: 'memory', status: 'fail', message: 'High memory usage' });
    } else if (metrics.memory.percentage > 75) {
      checks.push({ name: 'memory', status: 'warn', message: 'Elevated memory usage' });
    } else {
      checks.push({ name: 'memory', status: 'pass' });
    }

    // HuiNet status check
    if (!this.huinet.isRunning()) {
      checks.push({ name: 'huinet', status: 'fail', message: 'HuiNet not running' });
    } else {
      checks.push({ name: 'huinet', status: 'pass' });
    }

    // Node connectivity check
    const nodeRatio = metrics.nodes.total > 0 ? metrics.nodes.online / metrics.nodes.total : 0;
    if (nodeRatio < 0.2 && metrics.nodes.total > 5) {
      checks.push({ name: 'connectivity', status: 'warn', message: 'Low node connectivity' });
    } else {
      checks.push({ name: 'connectivity', status: 'pass' });
    }

    // Determine overall status
    const hasFail = checks.some(c => c.status === 'fail');
    const hasWarn = checks.some(c => c.status === 'warn');

    const status = hasFail ? 'unhealthy' : hasWarn ? 'degraded' : 'healthy';

    return { status, checks };
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    // High memory usage alert
    this.addAlertRule({
      id: 'high_memory',
      name: 'High Memory Usage',
      condition: (m) => m.memory.percentage > 85,
      severity: 'warning',
      description: 'Memory usage exceeds 85%',
    });

    // HuiNet down alert
    this.addAlertRule({
      id: 'huinet_down',
      name: 'HuiNet Down',
      condition: () => !this.huinet.isRunning(),
      severity: 'critical',
      description: 'HuiNet SDK is not running',
    });

    // Low node connectivity alert
    this.addAlertRule({
      id: 'low_connectivity',
      name: 'Low Node Connectivity',
      condition: (m) => m.nodes.total > 5 && (m.nodes.online / m.nodes.total) < 0.2,
      severity: 'warning',
      description: 'Less than 20% of known nodes are online',
    });

    // High message failure rate
    this.addAlertRule({
      id: 'high_failure_rate',
      name: 'High Message Failure Rate',
      condition: (m) => {
        const total = m.messages.sent + m.messages.received;
        return total > 100 && (m.messages.failed / total) > 0.1;
      },
      severity: 'warning',
      description: 'Message failure rate exceeds 10%',
    });
  }

  /**
   * Add an alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  /**
   * Check all alert rules and generate alerts
   */
  checkAlerts(): Alert[] {
    const metrics = this.collectMetrics();
    const newAlerts: Alert[] = [];

    for (const rule of this.alertRules.values()) {
      if (rule.condition(metrics)) {
        // Check if alert already exists
        if (!this.activeAlerts.has(rule.id)) {
          const alert: Alert = {
            id: `${rule.id}_${Date.now()}`,
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.description,
            timestamp: Date.now(),
            resolved: false,
          };
          this.activeAlerts.set(rule.id, alert);
          newAlerts.push(alert);
        }
      } else {
        // Condition no longer met, remove alert
        this.activeAlerts.delete(rule.id);
      }
    }

    return newAlerts;
  }

  /**
   * Update WebSocket client count
   */
  setWsClientCount(count: number): void {
    this.wsClientCount = count;
  }

  /**
   * Increment HTTP request count
   */
  incrementHttpRequestCount(): void {
    this.httpRequestCount++;
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  /**
   * Get router for mounting
   */
  getRouter(): Router {
    return this.router;
  }
}
