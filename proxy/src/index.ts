/**
 * HuiNet Proxy Server - Main Entry Point
 */

export { HuiNetProxy } from './HuiNetProxy';
export { ConfigManager } from './config/ConfigManager';
export { HttpApiModule } from './modules/HttpApiModule';
export { WebSocketModule } from './modules/WebSocketModule';
export { MessageHistory } from './modules/MessageHistory';
export {
  createAuthMiddleware,
  createWsAuth,
  errorHandler,
  validateRequest,
  type AuthRequest,
} from './middleware/AuthMiddleware';
export type {
  ProxyConfig,
  ProxyMessage,
  SendMessageRequest,
  ApiResponse,
  NodeInfo,
  WebSocketClient,
  WSMessage,
  LogLevel,
  HuinetConfig,
  MessageHistoryQuery,
} from './types';
export { ProxyError, ErrorCodes } from './types';
