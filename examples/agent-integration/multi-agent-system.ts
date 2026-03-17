/**
 * Multi-Agent System Example
 *
 * This example demonstrates how to build a coordinated multi-agent system using HuiNet.
 * It shows:
 * - Message routing patterns between agents
 * - Role-based agent coordination
 * - Task distribution and result aggregation
 * - Hierarchical agent organization
 *
 * Architecture:
 * - Orchestrator: Coordinates agents and distributes tasks
 * - Workers: Process tasks and return results
 * - Monitor: Observes system behavior and logs events
 *
 * Usage:
 *   This example shows how to build a distributed multi-agent system
 *   where agents work together to accomplish complex tasks.
 */

import { HuiNet, HuiNetConfig } from '../../src/HuiNet';
import { EventEmitter } from 'events';

interface Task {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  assignedTo?: string;
  result?: any;
  timestamp: number;
}

interface AgentCapabilities {
  role: string;
  canProcess: string[];
  maxConcurrentTasks: number;
}

interface SystemMessage {
  type: 'task_assignment' | 'task_result' | 'heartbeat' | 'discovery' | 'coordination';
  from: string;
  to: string;
  data: any;
  timestamp: number;
}

/**
 * Base class for all agents in the system
 */
abstract class BaseAgent extends EventEmitter {
  protected node: HuiNet;
  protected agentId: string;
  protected capabilities: AgentCapabilities;
  protected active = false;

  constructor(agentId: string, config: HuiNetConfig, capabilities: AgentCapabilities) {
    super();
    this.agentId = agentId;
    this.capabilities = capabilities;

    this.node = new HuiNet({
      listenPort: config.listenPort || 8000,
      listenHost: config.listenHost || '0.0.0.0',
      enableMDNS: config.enableMDNS !== false,
      bootstrapNodes: config.bootstrapNodes || [],
      maxCoreConnections: config.maxCoreConnections || 10,
      maxActiveConnections: config.maxActiveConnections || 50,
    });

    this.setupHandlers();
  }

  protected abstract setupHandlers(): void;
  protected abstract processMessage(from: string, message: SystemMessage): Promise<void>;

  async start(): Promise<void> {
    await this.node.start();
    this.active = true;
    console.log(`[${this.agentId}] 🟢 Agent started`);
  }

  async stop(): Promise<void> {
    await this.node.stop();
    this.active = false;
    console.log(`[${this.agentId}] 🔴 Agent stopped`);
  }

  protected async sendMessage(targetId: string, message: SystemMessage): Promise<void> {
    await this.node.send(targetId, message);
  }

  getNodeId(): string {
    return this.node.getNodeID();
  }

  isActive(): boolean {
    return this.active;
  }
}

/**
 * Orchestrator Agent - Coordinates the multi-agent system
 */
class OrchestratorAgent extends BaseAgent {
  private tasks: Map<string, Task> = new Map();
  private workers: Map<string, string> = new Map(); // workerId -> nodeId
  private pendingResults: Set<string> = new Set();

  constructor(agentId: string, config: HuiNetConfig) {
    super(agentId, config, {
      role: 'orchestrator',
      canProcess: ['coordination', 'task_distribution'],
      maxConcurrentTasks: 100,
    });
  }

  protected setupHandlers(): void {
    this.node.on('ready', () => {
      console.log(`[${this.agentId}] 🎯 Orchestrator ready`);
      this.emit('orchestrator:ready');
    });

    this.node.on('peerConnected', (nodeId: string) => {
      console.log(`[${this.agentId}] 👷 Worker connected: ${nodeId}`);
      this.emit('worker:connected', nodeId);
    });

    this.node.on('peerDisconnected', (nodeId: string) => {
      console.log(`[${this.agentId}] Worker disconnected: ${nodeId}`);
      this.workers.delete(nodeId);
      this.reassignTasks(nodeId);
      this.emit('worker:disconnected', nodeId);
    });

    this.node.on('message', async (from: string, data: any) => {
      const message: SystemMessage = data.data || data;
      await this.processMessage(from, message);
    });
  }

  protected async processMessage(from: string, message: SystemMessage): Promise<void> {
    switch (message.type) {
      case 'task_result':
        await this.handleTaskResult(from, message.data);
        break;
      case 'discovery':
        await this.handleDiscovery(from, message.data);
        break;
      default:
        console.log(`[${this.agentId}] Unknown message type: ${message.type}`);
    }
  }

  private async handleTaskResult(from: string, data: any): Promise<void> {
    const task = this.tasks.get(data.taskId);
    if (!task) return;

    task.status = 'completed';
    task.result = data.result;
    this.pendingResults.delete(data.taskId);

    console.log(`[${this.agentId}] ✅ Task ${data.taskId} completed by ${from}`);
    console.log(`[${this.agentId}] 📊 Result: ${JSON.stringify(data.result)}`);

    this.emit('task:completed', task);
  }

  private async handleDiscovery(from: string, data: any): Promise<void> {
    console.log(`[${this.agentId}] 🔍 Discovery from ${from}:`, data.capabilities);
    this.workers.set(from, data.workerId);

    // Acknowledge discovery
    await this.sendMessage(from, {
      type: 'coordination',
      from: this.agentId,
      to: from,
      data: { status: 'acknowledged' },
      timestamp: Date.now(),
    });
  }

  private reassignTasks(disconnectedWorker: string): void {
    for (const [taskId, task] of this.tasks) {
      if (task.assignedTo === disconnectedWorker && task.status === 'processing') {
        task.status = 'pending';
        task.assignedTo = undefined;
        console.log(`[${this.agentId}] 🔄 Task ${taskId} reassigned`);
      }
    }
  }

  /**
   * Create and distribute a new task
   */
  async createTask(type: string, payload: any): Promise<string> {
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      status: 'pending',
      timestamp: Date.now(),
    };

    this.tasks.set(task.id, task);
    await this.distributeTask(task);

    return task.id;
  }

  /**
   * Distribute a task to an available worker
   */
  private async distributeTask(task: Task): Promise<void> {
    if (this.workers.size === 0) {
      console.log(`[${this.agentId}] ⏳ No workers available, task ${task.id} queued`);
      return;
    }

    // Simple round-robin distribution
    const workerNodeIds = Array.from(this.workers.keys());
    const targetWorker = workerNodeIds[0]; // Simple selection

    try {
      await this.sendMessage(targetWorker, {
        type: 'task_assignment',
        from: this.agentId,
        to: targetWorker,
        data: {
          taskId: task.id,
          taskType: task.type,
          payload: task.payload,
        },
        timestamp: Date.now(),
      });

      task.status = 'processing';
      task.assignedTo = targetWorker;
      this.pendingResults.add(task.id);

      console.log(`[${this.agentId}] 📤 Task ${task.id} assigned to ${targetWorker}`);
    } catch (error) {
      console.error(`[${this.agentId}] ❌ Failed to assign task ${task.id}:`, error);
      task.status = 'pending';
    }
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get worker statistics
   */
  getWorkerStats(): { workerCount: number; activeTasks: number } {
    return {
      workerCount: this.workers.size,
      activeTasks: this.pendingResults.size,
    };
  }
}

/**
 * Worker Agent - Processes tasks assigned by orchestrator
 */
class WorkerAgent extends BaseAgent {
  private orchestratorId?: string;
  private currentTasks: Set<string> = new Set();

  constructor(agentId: string, config: HuiNetConfig) {
    super(agentId, config, {
      role: 'worker',
      canProcess: ['data_processing', 'computation', 'analysis'],
      maxConcurrentTasks: 5,
    });
  }

  protected setupHandlers(): void {
    this.node.on('ready', async () => {
      console.log(`[${this.agentId}] 👷 Worker ready`);
      await this.announceToOrchestrator();
    });

    this.node.on('peerConnected', async (nodeId: string) => {
      // First peer is assumed to be orchestrator
      if (!this.orchestratorId) {
        this.orchestratorId = nodeId;
        console.log(`[${this.agentId}] 🎯 Found orchestrator: ${nodeId}`);
        await this.announceToOrchestrator();
      }
    });

    this.node.on('message', async (from: string, data: any) => {
      const message: SystemMessage = data.data || data;
      await this.processMessage(from, message);
    });
  }

  protected async processMessage(from: string, message: SystemMessage): Promise<void> {
    switch (message.type) {
      case 'task_assignment':
        await this.handleTaskAssignment(from, message.data);
        break;
      case 'coordination':
        console.log(`[${this.agentId}] 📋 Coordination message: ${message.data.status}`);
        break;
      default:
        console.log(`[${this.agentId}] Unknown message type: ${message.type}`);
    }
  }

  private async handleTaskAssignment(from: string, data: any): Promise<void> {
    const { taskId, taskType, payload } = data;

    if (this.currentTasks.size >= this.capabilities.maxConcurrentTasks) {
      console.log(`[${this.agentId}] ⚠️ Max concurrent tasks reached`);
      return;
    }

    this.currentTasks.add(taskId);
    console.log(`[${this.agentId}] 🔧 Processing task ${taskId} of type ${taskType}`);

    // Simulate task processing
    setTimeout(async () => {
      const result = await this.processTask(taskType, payload);

      // Send result back to orchestrator
      if (this.orchestratorId) {
        await this.sendMessage(this.orchestratorId, {
          type: 'task_result',
          from: this.agentId,
          to: this.orchestratorId,
          data: {
            taskId,
            result,
          },
          timestamp: Date.now(),
        });
      }

      this.currentTasks.delete(taskId);
      console.log(`[${this.agentId}] ✅ Task ${taskId} completed`);
    }, 1000 + Math.random() * 2000); // Simulate variable processing time
  }

  private async processTask(taskType: string, payload: any): Promise<any> {
    // Simulate different task processing
    switch (taskType) {
      case 'data_processing':
        return { processed: true, items: payload.length || 0 };
      case 'computation':
        return { result: payload.value * 2 };
      case 'analysis':
        return { analysis: 'completed', confidence: 0.95 };
      default:
        return { status: 'processed', input: payload };
    }
  }

  private async announceToOrchestrator(): Promise<void> {
    if (!this.orchestratorId) return;

    await this.sendMessage(this.orchestratorId, {
      type: 'discovery',
      from: this.agentId,
      to: this.orchestratorId,
      data: {
        workerId: this.agentId,
        capabilities: this.capabilities,
      },
      timestamp: Date.now(),
    });

    console.log(`[${this.agentId}] 📢 Announced to orchestrator`);
  }

  /**
   * Get current workload
   */
  getWorkload(): { activeTasks: number; maxCapacity: number } {
    return {
      activeTasks: this.currentTasks.size,
      maxCapacity: this.capabilities.maxConcurrentTasks,
    };
  }
}

/**
 * Monitor Agent - Observes system behavior
 */
class MonitorAgent extends BaseAgent {
  private systemEvents: any[] = [];

  constructor(agentId: string, config: HuiNetConfig) {
    super(agentId, config, {
      role: 'monitor',
      canProcess: ['monitoring', 'logging'],
      maxConcurrentTasks: 10,
    });
  }

  protected setupHandlers(): void {
    this.node.on('ready', () => {
      console.log(`[${this.agentId}] 📊 Monitor ready`);
    });

    this.node.on('peerConnected', (nodeId: string) => {
      this.logEvent('peer_connected', { nodeId });
    });

    this.node.on('peerDisconnected', (nodeId: string) => {
      this.logEvent('peer_disconnected', { nodeId });
    });

    this.node.on('message', (from: string, data: any) => {
      this.logEvent('message', { from, type: data.type });
    });
  }

  protected async processMessage(from: string, message: SystemMessage): Promise<void> {
    // Monitor just observes, doesn't process
  }

  private logEvent(type: string, data: any): void {
    const event = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.systemEvents.push(event);
    console.log(`[${this.agentId}] 📝 ${type}:`, data);
  }

  /**
   * Get event log
   */
  getEventLog(): any[] {
    return [...this.systemEvents];
  }

  /**
   * Generate system report
   */
  generateReport(): { totalEvents: number; eventsByType: Record<string, number> } {
    const eventsByType: Record<string, number> = {};

    for (const event of this.systemEvents) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    }

    return {
      totalEvents: this.systemEvents.length,
      eventsByType,
    };
  }
}

// Example usage demonstrating multi-agent coordination
async function main() {
  // Create orchestrator
  const orchestrator = new OrchestratorAgent('Orchestrator-Main', {
    listenPort: 10001,
    enableMDNS: true,
  });

  // Create workers
  const workers = [
    new WorkerAgent('Worker-1', {
      listenPort: 10002,
      enableMDNS: true,
      bootstrapNodes: ['127.0.0.1:10001'],
    }),
    new WorkerAgent('Worker-2', {
      listenPort: 10003,
      enableMDNS: true,
      bootstrapNodes: ['127.0.0.1:10001'],
    }),
    new WorkerAgent('Worker-3', {
      listenPort: 10004,
      enableMDNS: true,
      bootstrapNodes: ['127.0.0.1:10001'],
    }),
  ];

  // Create monitor
  const monitor = new MonitorAgent('System-Monitor', {
    listenPort: 10005,
    enableMDNS: true,
    bootstrapNodes: ['127.0.0.1:10001'],
  });

  try {
    // Start orchestrator first
    await orchestrator.start();
    console.log('✅ Orchestrator started');

    // Start monitor
    await monitor.start();
    console.log('✅ Monitor started');

    // Start all workers
    for (const worker of workers) {
      await worker.start();
    }
    console.log('✅ All workers started');

    // Wait for network to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Submit various tasks
    console.log('\n=== Submitting tasks to orchestrator ===');

    const taskIds = await Promise.all([
      orchestrator.createTask('data_processing', { data: [1, 2, 3, 4, 5] }),
      orchestrator.createTask('computation', { value: 42 }),
      orchestrator.createTask('analysis', { text: 'Sample data for analysis' }),
      orchestrator.createTask('data_processing', { data: [6, 7, 8, 9, 10] }),
      orchestrator.createTask('computation', { value: 100 }),
    ]);

    console.log(`📋 Created ${taskIds.length} tasks`);

    // Wait for tasks to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Display results
    console.log('\n=== Task Results ===');
    const allTasks = orchestrator.getAllTasks();
    for (const task of allTasks) {
      console.log(`Task ${task.id}:`);
      console.log(`  Type: ${task.type}`);
      console.log(`  Status: ${task.status}`);
      console.log(`  Assigned to: ${task.assignedTo || 'None'}`);
      console.log(`  Result: ${JSON.stringify(task.result)}`);
    }

    // Display statistics
    console.log('\n=== System Statistics ===');
    console.log('Orchestrator:', orchestrator.getWorkerStats());

    console.log('\nWorker Status:');
    for (const worker of workers) {
      const workload = worker.getWorkload();
      console.log(`  ${worker.agentId}: ${workload.activeTasks}/${workload.maxCapacity} tasks`);
    }

    console.log('\nMonitor Report:');
    const report = monitor.generateReport();
    console.log(`  Total Events: ${report.totalEvents}`);
    console.log(`  Events by Type: ${JSON.stringify(report.eventsByType)}`);

    // Stop all agents
    console.log('\n=== Shutting down system ===');
    await monitor.stop();
    await orchestrator.stop();
    for (const worker of workers) {
      await worker.stop();
    }

    console.log('\n✅ Multi-agent system example completed!');

  } catch (error) {
    console.error('❌ Error in main:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other modules
export {
  BaseAgent,
  OrchestratorAgent,
  WorkerAgent,
  MonitorAgent,
  Task,
  AgentCapabilities,
  SystemMessage,
};
