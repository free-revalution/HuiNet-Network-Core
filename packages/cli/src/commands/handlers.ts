/**
 * 命令处理器实现
 */

import { HuiNet } from '@huinet/network';
import { ConfigManager } from '../storage/config';
import { showTitle, showSeparator, showHelp as uiShowHelp } from '../ui/welcome';

/**
 * 显示帮助
 */
export function showHelp(): void {
  uiShowHelp();
}

/**
 * 显示节点状态
 */
export async function showStatus(huinet: HuiNet, config: ConfigManager): Promise<void> {
  const routing = huinet.getRoutingTable();
  const name = config.get('name') || '未命名';
  const nodeID = huinet.getNodeID();

  showTitle('📊 我的节点状态');

  console.log(`  名称: ${name}`);
  console.log(`  NodeID: ${nodeID}`);
  console.log(`  监听端口: ${huinet['config'].listenPort}`);
  console.log(`  已连接节点: ${routing.getActiveNodes().size}`);
  console.log(`  已知节点: ${routing.getKnownNodes().size}`);
  console.log(`  核心节点: ${routing.getCoreNodes().size}`);

  showSeparator();
}

/**
 * 列出所有节点
 */
export async function listNodes(huinet: HuiNet, config: ConfigManager): Promise<void> {
  const routing = huinet.getRoutingTable();
  const aliases = config.get('aliases') || {};

  showTitle('📋 已发现的节点');

  const knownNodes = routing.getKnownNodes();
  const activeNodes = routing.getActiveNodes();

  if (knownNodes.size === 0) {
    console.log('  (还没有发现任何节点)');
    console.log('  💡 等待 mDNS 自动发现，或使用 connect 命令手动连接');
  } else {
    let index = 1;
    knownNodes.forEach((node, nodeID) => {
      const alias = aliases[nodeID] || nodeID.substring(0, 12);
      const status = activeNodes.has(nodeID) ? '● 已连接' : '○ 未连接';
      const emoji = activeNodes.has(nodeID) ? '🟢' : '⚪';

      console.log(`  ${index++}. ${emoji} ${alias}`);
      console.log(`      状态: ${status}`);
      console.log(`      地址: ${node.address}`);
      console.log(`      NodeID: ${nodeID.substring(0, 20)}...`);
      console.log('');
    });
  }

  showSeparator();
}

/**
 * 发送消息
 */
export async function sendMessage(
  huinet: HuiNet,
  config: ConfigManager,
  args: string[]
): Promise<void> {
  if (args.length < 2) {
    console.log('❌ 用法: msg <别名> <消息内容>');
    console.log('   示例: msg 小明 你好');
    return;
  }

  const alias = args[0];
  const message = args.slice(1).join(' ');

  // 解析节点 ID
  const nodeID = resolveNodeID(config, alias);
  if (!nodeID) {
    console.log(`❌ 未找到节点: ${alias}`);
    console.log('   使用 ls 查看可用节点');
    console.log('   使用 alias 命令设置别名');
    return;
  }

  // 发送消息
  try {
    console.log(`📤 正在发送消息到 ${alias}...`);
    await huinet.send(nodeID, {
      type: 'chat',
      text: message,
      timestamp: Date.now()
    });
    console.log('✅ 消息已发送');

    // 记录到历史
    addHistory(config, 'sent', alias, message);
  } catch (error) {
    console.log(`❌ 发送失败: ${(error as Error).message}`);
  }
}

/**
 * 广播消息
 */
export async function broadcastMessage(
  huinet: HuiNet,
  config: ConfigManager,
  args: string[]
): Promise<void> {
  const message = args.join(' ');
  if (!message) {
    console.log('❌ 用法: broadcast <消息内容>');
    return;
  }

  const routing = huinet.getRoutingTable();
  const activeNodes = routing.getActiveNodes();

  if (activeNodes.size === 0) {
    console.log('❌ 没有已连接的节点');
    return;
  }

  console.log(`📢 正在广播消息到 ${activeNodes.size} 个节点...`);

  let successCount = 0;
  for (const [nodeID, node] of activeNodes) {
    try {
      await huinet.send(nodeID, {
        type: 'broadcast',
        text: message,
        timestamp: Date.now()
      });
      successCount++;
    } catch (error) {
      console.log(`   ❌ 发送到 ${node.address} 失败`);
    }
  }

  console.log(`✅ 广播完成，成功 ${successCount}/${activeNodes.size}`);
  addHistory(config, 'broadcast', 'all', message);
}

/**
 * 设置别名
 */
export function setAlias(config: ConfigManager, args: string[]): void {
  if (args.length < 2) {
    console.log('❌ 用法: alias <名称> <NodeID>');
    console.log('   示例: alias 小明 5HueCGue8dnF7iSBz5sYjXxMxq9');
    return;
  }

  const alias = args[0];
  const nodeID = args[1];

  // 验证 NodeID 格式
  if (nodeID.length < 20) {
    console.log('❌ NodeID 格式不正确');
    return;
  }

  config.set(`aliases.${alias}`, nodeID);
  config.save();

  console.log(`✅ 已设置别名: ${alias} = ${nodeID.substring(0, 20)}...`);
}

/**
 * 手动连接
 */
export async function connectTo(huinet: HuiNet, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('❌ 用法: connect <地址>');
    console.log('   示例: connect 192.168.1.100:8000');
    return;
  }

  const address = args[0];
  console.log(`🔗 正在连接到 ${address}...`);

  // 注意：这需要在 HuiNet 中实现手动连接方法
  console.log('ℹ️ 此功能需要扩展 HuiNet 实现');
}

/**
 * 断开连接
 */
export async function disconnectFrom(
  huinet: HuiNet,
  config: ConfigManager,
  args: string[]
): Promise<void> {
  const alias = args[0];
  const nodeID = resolveNodeID(config, alias);

  if (!nodeID) {
    console.log(`❌ 未找到节点: ${alias}`);
    return;
  }

  console.log(`🔌 正在断开与 ${alias} 的连接...`);
  // 注意：这需要在 HuiNet 中实现断开连接方法
  console.log('ℹ️ 此功能需要扩展 HuiNet 实现');
}

/**
 * 显示消息历史
 */
export function showHistory(config: ConfigManager): void {
  const history = config.get('messageHistory') || [];

  showTitle('📜 消息历史');

  if (history.length === 0) {
    console.log('  (还没有消息记录)');
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
 * 退出程序
 */
export async function quit(huinet: HuiNet): Promise<void> {
  console.log('\n👋 正在退出...');
  await huinet.stop();
  process.exit(0);
}

/**
 * 辅助函数：解析节点 ID
 */
function resolveNodeID(config: ConfigManager, alias: string): string | null {
  const aliases = config.get('aliases') || {};

  // 首先检查别名
  if (aliases[alias]) {
    return aliases[alias];
  }

  // 检查是否是完整的 NodeID
  const routing = (global as any).__huinet?.getRoutingTable();
  if (routing) {
    const knownNodes = routing.getKnownNodes();
    for (const [nodeID] of knownNodes) {
      if (nodeID.startsWith(alias)) {
        return nodeID;
      }
    }
  }

  return null;
}

/**
 * 辅助函数：添加消息历史
 */
function addHistory(config: ConfigManager, direction: string, target: string, message: string): void {
  const history = config.get('messageHistory') || [];
  history.push({
    direction,
    target,
    message,
    timestamp: Date.now()
  });

  // 只保留最近 100 条
  if (history.length > 100) {
    history.shift();
  }

  config.set('messageHistory', history);
  config.save();
}
