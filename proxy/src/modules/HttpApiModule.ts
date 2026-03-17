/**
 * HuiNet Proxy Server - HTTP API Module
 */

import { Router, Request, Response } from 'express';
import { ProxyError, ErrorCodes, ApiResponse, SendMessageRequest, NodeInfo, MessageHistoryQuery } from '../types';
import type { HuiNet } from '@huinet/network';
import { NodeState } from '@huinet/network';
import { MessageHistory } from './MessageHistory';

export interface HttpApiDeps {
  huinet: HuiNet;
  messageHistory: MessageHistory;
}

export class HttpApiModule {
  private router: Router;
  private huinet: HuiNet;
  private messageHistory: MessageHistory;

  constructor(deps: HttpApiDeps) {
    this.huinet = deps.huinet;
    this.messageHistory = deps.messageHistory;
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Setup all HTTP routes
   */
  private setupRoutes(): void {
    // Send message to a node
    this.router.post('/send', this.sendMessage.bind(this));

    // Get list of all nodes
    this.router.get('/nodes', this.getNodes.bind(this));

    // Get proxy status
    this.router.get('/status', this.getStatus.bind(this));

    // Get message history
    this.router.get('/messages', this.getMessages.bind(this));

    // Get message history stats
    this.router.get('/messages/stats', this.getMessageStats.bind(this));

    // Get node status by ID
    this.router.get('/nodes/:nodeID', this.getNodeStatus.bind(this));
  }

  /**
   * POST /api/send - Send message to a target node
   */
  private async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { to, data } = req.body as SendMessageRequest;

      // Validate request
      if (!to || !data) {
        throw new ProxyError(
          ErrorCodes.INVALID_REQUEST,
          'Missing required fields: to, data',
          400
        );
      }

      // Check if target node exists in routing table
      const knownNode = this.huinet.getRoutingTable().getKnownNode(to);
      if (!knownNode) {
        throw new ProxyError(
          ErrorCodes.NODE_NOT_FOUND,
          `Target node not found: ${to}`,
          404
        );
      }

      // Send message via HuiNet
      await this.huinet.send(to, data);

      // Record in history
      this.messageHistory.add({
        from: this.huinet.getNodeID(),
        to,
        data,
        timestamp: Date.now(),
        direction: 'outbound',
      });

      const response: ApiResponse = {
        success: true,
        messageId: `${Date.now()}-${to.substring(0, 8)}`,
      };

      res.json(response);
    } catch (error) {
      if (error instanceof ProxyError) {
        throw error;
      }
      throw new ProxyError(
        ErrorCodes.SERVICE_UNAVAILABLE,
        error instanceof Error ? error.message : 'Failed to send message',
        503
      );
    }
  }

  /**
   * GET /api/nodes - Get list of all known nodes
   */
  private getNodes(req: Request, res: Response): void {
    try {
      const routingTable = this.huinet.getRoutingTable();
      const knownNodes = routingTable.getKnownNodes();

      const nodes: NodeInfo[] = knownNodes.map(node => ({
        nodeID: node.nodeID,
        state: this.mapNodeState(node.state),
        addresses: node.addresses.map(addr => ({
          type: addr.type,
          host: addr.host,
          port: addr.port,
        })),
        lastSeen: node.lastSeen,
      }));

      const response: ApiResponse<NodeInfo[]> = {
        success: true,
        data: nodes,
      };

      res.json(response);
    } catch (error) {
      throw new ProxyError(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get nodes',
        500
      );
    }
  }

  /**
   * GET /api/nodes/:nodeID - Get detailed status of a specific node
   */
  private getNodeStatus(req: Request, res: Response): void {
    try {
      const { nodeID } = req.params;

      const node = this.huinet.getRoutingTable().getKnownNode(nodeID);
      if (!node) {
        throw new ProxyError(
          ErrorCodes.NODE_NOT_FOUND,
          `Node not found: ${nodeID}`,
          404
        );
      }

      // Get message history with this node
      const sentMessages = this.messageHistory.query({
        to: nodeID,
        direction: 'outbound',
        limit: 10,
      });

      const receivedMessages = this.messageHistory.query({
        from: nodeID,
        direction: 'inbound',
        limit: 10,
      });

      const status = {
        success: true,
        data: {
          nodeID: node.nodeID,
          state: this.mapNodeState(node.state),
          addresses: node.addresses.map(addr => ({
            type: addr.type,
            host: addr.host,
            port: addr.port,
          })),
          lastSeen: node.lastSeen,
          metadata: node.metadata,
          connectionCount: node.connectionCount,
          recentMessages: {
            sent: sentMessages.length,
            received: receivedMessages.length,
          },
        },
      };

      res.json(status);
    } catch (error) {
      if (error instanceof ProxyError) {
        throw error;
      }
      throw new ProxyError(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get node status',
        500
      );
    }
  }

  /**
   * GET /api/status - Get proxy status
   */
  private getStatus(req: Request, res: Response): void {
    try {
      const routingTable = this.huinet.getRoutingTable();
      const knownNodes = routingTable.getKnownNodes();
      const historyStats = this.messageHistory.getStats();

      const status = {
        success: true,
        data: {
          nodeID: this.huinet.getNodeID(),
          isRunning: this.huinet.isRunning(),
          knownNodesCount: knownNodes.length,
          uptime: process.uptime(),
          messageStats: historyStats,
        },
      };

      res.json(status);
    } catch (error) {
      throw new ProxyError(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get status',
        500
      );
    }
  }

  /**
   * GET /api/messages - Get message history
   */
  private getMessages(req: Request, res: Response): void {
    try {
      const query: MessageHistoryQuery = {
        since: req.query.since ? parseInt(req.query.since as string, 10) : undefined,
        before: req.query.before ? parseInt(req.query.before as string, 10) : undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        direction: req.query.direction as 'inbound' | 'outbound' | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      };

      // Validate limit
      if (query.limit && (query.limit < 1 || query.limit > 1000)) {
        throw new ProxyError(
          ErrorCodes.INVALID_REQUEST,
          'Limit must be between 1 and 1000',
          400
        );
      }

      const messages = this.messageHistory.query(query);

      const response: ApiResponse = {
        success: true,
        data: messages,
      };

      res.json(response);
    } catch (error) {
      if (error instanceof ProxyError) {
        throw error;
      }
      throw new ProxyError(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get messages',
        500
      );
    }
  }

  /**
   * GET /api/messages/stats - Get message history statistics
   */
  private getMessageStats(req: Request, res: Response): void {
    try {
      const stats = this.messageHistory.getStats();

      const response: ApiResponse = {
        success: true,
        data: stats,
      };

      res.json(response);
    } catch (error) {
      throw new ProxyError(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to get message stats',
        500
      );
    }
  }

  /**
   * Map NodeState enum to string
   */
  private mapNodeState(state: NodeState): 'online' | 'offline' | 'unknown' | 'restricted' {
    switch (state) {
      case NodeState.ONLINE:
        return 'online';
      case NodeState.OFFLINE:
        return 'offline';
      case NodeState.RESTRICTED:
        return 'restricted';
      case NodeState.UNKNOWN:
      default:
        return 'unknown';
    }
  }

  /**
   * Get Express router for mounting
   */
  getRouter(): Router {
    return this.router;
  }
}
