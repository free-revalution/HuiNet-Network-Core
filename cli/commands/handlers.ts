/**
 * Command handlers implementation
 */

import { HuiNet } from '../../src';
import { ConfigManager } from '../storage/config';
import { showTitle, showSeparator, showHelp as uiShowHelp } from '../ui/welcome';

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

  showTitle('📊 My Node Status');

  console.log(`  Name: ${name}`);
  console.log(`  NodeID: ${nodeID}`);
  console.log(`  Listen Port: ${(huinet as any).config?.listenPort || 'N/A'}`);
  console.log(`  Connected Nodes: ${activeNodes.length}`);
  console.log(`  Known Nodes: ${knownNodes.length}`);
  console.log(`  Core Nodes: ${coreNodes.length}`);

  showSeparator();
}

/**
 * List all nodes
 */
export async function listNodes(huinet: HuiNet, config: ConfigManager): Promise<void> {
  const routing = huinet.getRoutingTable();
  const aliases = config.get('aliases') || {};

  showTitle('📋 Discovered Nodes');

  const knownNodes = routing.getKnownNodes();
  const activeNodes = routing.getActiveNodes();

  if (knownNodes.length === 0) {
    console.log('  (No nodes discovered yet)');
    console.log('  💡 Wait for mDNS auto-discovery, or use connect command');
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
      console.log(`      Address: ${node.addresses[0] || 'N/A'}`);
      console.log(`      NodeID: ${node.nodeID.substring(0, 20)}...`);
      console.log('');
    }
  }

  showSeparator();
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
    console.log('❌ Usage: msg <alias> <message>');
    console.log('   Example: msg Alice Hello');
    return;
  }

  const alias = args[0];
  const message = args.slice(1).join(' ');

  // Resolve node ID
  const nodeID = resolveNodeID(config, alias);
  if (!nodeID) {
    console.log(`❌ Node not found: ${alias}`);
    console.log('   Use "ls" to see available nodes');
    console.log('   Use "alias" command to set an alias');
    return;
  }

  // Send message
  try {
    console.log(`📤 Sending message to ${alias}...`);
    await huinet.send(nodeID, {
      type: 'chat',
      text: message,
      timestamp: Date.now()
    });
    console.log('✅ Message sent');

    // Add to history
    addHistory(config, 'sent' as const, alias, message);
  } catch (error) {
    console.log(`❌ Send failed: ${(error as Error).message}`);
  }
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
    console.log('❌ Usage: broadcast <message>');
    return;
  }

  const routing = huinet.getRoutingTable();
  const activeNodes = routing.getActiveNodes();

  if (activeNodes.length === 0) {
    console.log('❌ No connected nodes');
    return;
  }

  console.log(`📢 Broadcasting to ${activeNodes.length} nodes...`);

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
      console.log(`   ❌ Failed to send to ${node.addresses[0]}`);
    }
  }

  console.log(`✅ Broadcast complete, ${successCount}/${activeNodes.length} successful`);
  addHistory(config, 'sent' as const, 'all', message);
}

/**
 * Set alias
 */
export function setAlias(config: ConfigManager, args: string[]): void {
  if (args.length < 2) {
    console.log('❌ Usage: alias <name> <NodeID>');
    console.log('   Example: alias Alice 5HueCGue8dnF7iSBz5sYjXxMxq9');
    return;
  }

  const alias = args[0];
  const nodeID = args[1];

  // Validate NodeID format
  if (nodeID.length < 20) {
    console.log('❌ Invalid NodeID format');
    return;
  }

  config.setNested(`aliases.${alias}`, nodeID);
  config.save();

  console.log(`✅ Alias set: ${alias} = ${nodeID.substring(0, 20)}...`);
}

/**
 * Manual connect
 */
export async function connectTo(huinet: HuiNet, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('❌ Usage: connect <address>');
    console.log('   Example: connect 192.168.1.100:8000');
    return;
  }

  const address = args[0];
  console.log(`🔗 Connecting to ${address}...`);

  // Note: This requires extending HuiNet implementation
  console.log('ℹ️ This feature requires extending HuiNet implementation');
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
    console.log(`❌ Node not found: ${alias}`);
    return;
  }

  console.log(`🔌 Disconnecting from ${alias}...`);
  // Note: This requires extending HuiNet implementation
  console.log('ℹ️ This feature requires extending HuiNet implementation');
}

/**
 * Show message history
 */
export function showHistory(config: ConfigManager): void {
  const history = config.get('messageHistory') || [];

  showTitle('📜 Message History');

  if (history.length === 0) {
    console.log('  (No message history yet)');
  } else {
    history.slice(-10).forEach((entry: any) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const dir = entry.direction === 'sent' ? '📤' : '📨';
      console.log(`  ${time} ${dir} ${entry.target}: ${entry.message}`);
    });
  }

  showSeparator();
}

/**
 * Quit program
 */
export async function quit(huinet: HuiNet): Promise<void> {
  console.log('\n👋 Exiting...');
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
