/**
 * Command handlers implementation
 */

import { HuiNet } from '../../src';
import { ConfigManager } from '../storage/config';
import { showHelp as uiShowHelp, showMessage, clearScreen, showWelcome as uiShowWelcome } from '../ui/display';

/**
 * Show help
 */
export function showHelp(): void {
  uiShowHelp();
}

/**
 * Show node status
 */
export async function showStatus(huinet: HuiNet, config: ConfigManager): Promise<void> {
  const routing = huinet.getRoutingTable();
  const name = config.get('name') || 'Unnamed';
  const nodeID = huinet.getNodeID();

  const activeNodes = routing.getActiveNodes();
  const knownNodes = routing.getKnownNodes();
  const coreNodes = routing.getCoreNodes();

  console.log('');
  console.log('  Node Status:');
  console.log(`  Name: ${name}`);
  console.log(`  NodeID: ${nodeID.substring(0, 30)}...`);
  console.log(`  Listen Port: ${(huinet as any).config?.listenPort || 'N/A'}`);
  console.log(`  Connected Nodes: ${activeNodes.length}`);
  console.log(`  Known Nodes: ${knownNodes.length}`);
  console.log(`  Core Nodes: ${coreNodes.length}`);
  console.log('');
  showMessage('info', 'Type "fullnodeid" to see complete NodeID');
}

/**
 * Show full NodeID
 */
export function showFullNodeID(huinet: HuiNet): void {
  const nodeID = huinet.getNodeID();
  console.log('');
  console.log('  Complete NodeID:');
  console.log(`  ${nodeID}`);
  console.log('');
}

/**
 * List all nodes
 */
export async function listNodes(huinet: HuiNet, config: ConfigManager): Promise<void> {
  const routing = huinet.getRoutingTable();
  const aliases = config.get('aliases') || {};

  console.log('');
  console.log('  Discovered Nodes:');
  console.log('');

  const knownNodes = routing.getKnownNodes();
  const activeNodes = routing.getActiveNodes();

  if (knownNodes.length === 0) {
    showMessage('warning', 'No nodes discovered yet');
    console.log('  • Wait for mDNS auto-discovery');
    console.log('  • Or use "connect <address>" to manually connect');
  } else {
    // Create a Set of active node IDs for quick lookup
    const activeNodeIDs = new Set(activeNodes.map(n => n.nodeID));

    let index = 1;
    for (const node of knownNodes) {
      const alias = aliases[node.nodeID] || node.nodeID.substring(0, 12);
      const isActive = activeNodeIDs.has(node.nodeID);
      const status = isActive ? '● Connected' : '○ Not Connected';
      const emoji = isActive ? '🟢' : '⚪';

      console.log(`  ${index++}. ${emoji} ${alias}`);
      console.log(`      Status: ${status}`);
      const address = node.addresses[0];
      const addressStr = address ? `${address.host}:${address.port}` : 'N/A';
      console.log(`      Address: ${addressStr}`);
      console.log(`      NodeID: ${node.nodeID.substring(0, 30)}...`);
      console.log('');
    }
  }
}

/**
 * List all aliases
 */
export function listAliases(config: ConfigManager): void {
  const aliases = config.get('aliases') || {};

  console.log('');
  console.log('  Node Aliases:');
  console.log('');

  const aliasKeys = Object.keys(aliases);

  if (aliasKeys.length === 0) {
    showMessage('info', 'No aliases set');
    console.log('  Use: alias <name> <NodeID>');
  } else {
    for (const [name, nodeID] of Object.entries(aliases)) {
      console.log(`  ${name.padEnd(20)} = ${nodeID}`);
    }
  }

  console.log('');
}

/**
 * Send message
 */
export async function sendMessage(
  huinet: HuiNet,
  config: ConfigManager,
  args: string[]
): Promise<void> {
  if (args.length < 2) {
    showMessage('error', 'Usage: msg <name> <message>');
    console.log('  Example: msg Alice Hello');
    return;
  }

  const alias = args[0];
  const message = args.slice(1).join(' ');

  // Resolve node ID
  const nodeID = resolveNodeID(config, alias);
  if (!nodeID) {
    showMessage('error', `Node not found: ${alias}`);
    console.log('  Use "ls" to see available nodes');
    console.log('  Use "alias" command to set an alias');
    return;
  }

  // Send message
  try {
    console.log('');
    showMessage('info', `Sending message to ${alias}...`);
    await huinet.send(nodeID, {
      type: 'chat',
      text: message,
      timestamp: Date.now()
    });
    showMessage('success', 'Message sent!');

    // Add to history
    addHistory(config, 'sent' as const, alias, message);
  } catch (error) {
    showMessage('error', `Send failed: ${(error as Error).message}`);
  }

  console.log('');
}

/**
 * Broadcast message
 */
export async function broadcastMessage(
  huinet: HuiNet,
  config: ConfigManager,
  args: string[]
): Promise<void> {
  const message = args.join(' ');
  if (!message) {
    showMessage('error', 'Usage: broadcast <message>');
    return;
  }

  const routing = huinet.getRoutingTable();
  const activeNodes = routing.getActiveNodes();

  if (activeNodes.length === 0) {
    showMessage('warning', 'No connected nodes');
    return;
  }

  console.log('');
  showMessage('info', `Broadcasting to ${activeNodes.length} nodes...`);

  let successCount = 0;
  for (const node of activeNodes) {
    try {
      await huinet.send(node.nodeID, {
        type: 'broadcast',
        text: message,
        timestamp: Date.now()
      });
      successCount++;
    } catch (error) {
      const address = node.addresses[0];
      const addressStr = address ? `${address.host}:${address.port}` : 'N/A';
      console.log(`  ❌ Failed to send to ${addressStr}`);
    }
  }

  showMessage('success', `Broadcast complete: ${successCount}/${activeNodes.length} successful`);
  addHistory(config, 'sent' as const, 'all', message);
  console.log('');
}

/**
 * Set alias
 */
export function setAlias(config: ConfigManager, args: string[]): void {
  if (args.length < 2) {
    showMessage('error', 'Usage: alias <name> <NodeID>');
    console.log('  Example: alias Alice 5HueCGue8dnF7iSBz5sYjXxMxq9');
    return;
  }

  const alias = args[0];
  const nodeID = args[1];

  // Validate NodeID format
  if (nodeID.length < 20) {
    showMessage('error', 'Invalid NodeID format');
    return;
  }

  config.setNested(`aliases.${alias}`, nodeID);
  config.save();

  showMessage('success', `Alias set: ${alias} = ${nodeID.substring(0, 20)}...`);
}

/**
 * Manual connect
 */
export async function connectTo(huinet: HuiNet, args: string[]): Promise<void> {
  if (args.length === 0) {
    showMessage('error', 'Usage: connect <address>');
    console.log('  Example: connect 192.168.1.100:8000');
    return;
  }

  const address = args[0];
  const [host, portStr] = address.split(':');
  const port = parseInt(portStr, 10);

  if (!host || isNaN(port)) {
    showMessage('error', 'Invalid address format');
    console.log('  Usage: connect <host:port>');
    console.log('  Example: connect 192.168.1.100:8000');
    return;
  }

  console.log('');
  showMessage('info', `Connecting to ${address}...`);

  try {
    const success = await (huinet as any).connectToNode(host, port);

    if (success) {
      showMessage('success', `Connected to ${address}`);
    } else {
      showMessage('error', `Failed to connect to ${address}`);
    }
  } catch (error) {
    showMessage('error', `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Disconnect
 */
export async function disconnectFrom(
  huinet: HuiNet,
  config: ConfigManager,
  args: string[]
): Promise<void> {
  const alias = args[0];
  const nodeID = resolveNodeID(config, alias);

  if (!nodeID) {
    showMessage('error', `Node not found: ${alias}`);
    return;
  }

  console.log('');
  showMessage('info', `Disconnecting from ${alias}...`);
  showMessage('warning', 'This feature requires extending HuiNet implementation');
}

/**
 * Show message history
 */
export function showHistory(config: ConfigManager): void {
  const history = config.get('messageHistory') || [];

  console.log('');
  console.log('  Message History:');
  console.log('');

  if (history.length === 0) {
    showMessage('info', 'No message history yet');
  } else {
    history.slice(-10).forEach((entry: any) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const dir = entry.direction === 'sent' ? '📤' : '📨';
      console.log(`  ${time} ${dir} ${entry.target}: ${entry.message}`);
    });
  }

  console.log('');
}

/**
 * Quit program
 */
export async function quit(huinet: HuiNet): Promise<void> {
  console.log('');
  showMessage('info', 'Exiting...');
  await huinet.stop();
  process.exit(0);
}

/**
 * Helper: Resolve node ID from alias
 */
function resolveNodeID(config: ConfigManager, alias: string): string | null {
  const aliases = config.get('aliases') || {};

  // First check alias
  if (aliases[alias]) {
    return aliases[alias];
  }

  // Check if it's a partial NodeID
  const routing = (global as any).__huinet?.getRoutingTable();
  if (routing) {
    const knownNodes = routing.getKnownNodes();
    for (const node of knownNodes) {
      if (node.nodeID.startsWith(alias)) {
        return node.nodeID;
      }
    }
  }

  return null;
}

/**
 * Helper: Add message to history
 */
function addHistory(config: ConfigManager, direction: 'sent' | 'received', target: string, message: string): void {
  const history = config.get('messageHistory') || [];
  history.push({
    direction,
    target,
    message,
    timestamp: Date.now()
  });

  // Keep only last 100
  if (history.length > 100) {
    history.shift();
  }

  config.set('messageHistory', history);
  config.save();
}
