/**
 * HuiNet Agent 聊天示例
 *
 * 这个示例展示如何创建一个可以收发消息的 Agent
 * 可以在两台不同的电脑上运行，实现跨机器通信
 */

import { HuiNet } from '../src';
import * as readline from 'readline';

// 节点配置类型
interface AgentConfig {
  name: string;           // Agent 名称
  listenPort: number;     // 监听端口
  bootstrapNodes?: string[]; // 引导节点地址
}

// 创建聊天 Agent
async function createChatAgent(config: AgentConfig): Promise<HuiNet> {
  console.log(`\n🤖 正在创建 Agent: ${config.name}`);
  console.log(`📡 监听端口: ${config.listenPort}`);

  // 创建 HuiNet 实例
  const huinet = new HuiNet({
    listenPort: config.listenPort,
    listenHost: '0.0.0.0',  // 监听所有网络接口
    enableMDNS: true,       // 启用局域网发现
    bootstrapNodes: config.bootstrapNodes,
  });

  // 设置事件监听器
  setupEventHandlers(huinet, config.name);

  // 启动网络服务
  await huinet.start();

  return huinet;
}

// 设置事件处理器
function setupEventHandlers(huinet: HuiNet, agentName: string) {
  // 就绪事件 - Agent 启动完成
  huinet.on('ready', () => {
    console.log(`✅ ${agentName} 已就绪!`);
    console.log(`🆔 节点ID: ${huinet.getNodeID()}`);
    console.log(`🔑 公钥: ${huinet.getPublicKey().toString('hex').substring(0, 32)}...`);
  });

  // 发现新节点
  huinet.on('nodeDiscovered', (node) => {
    console.log(`\n🔍 发现新节点: ${node.nodeId}`);
    console.log(`   地址: ${node.address}`);
  });

  // 对等节点连接成功
  huinet.on('peerConnected', (nodeID) => {
    console.log(`\n✨ 已连接到节点: ${nodeID}`);
  });

  // 对等节点断开连接
  huinet.on('peerDisconnected', (nodeID) => {
    console.log(`\n💔 节点已断开: ${nodeID}`);
  });

  // 接收消息 - 这里需要扩展 HuiNet 来支持消息接收
  // 注意：当前 HuiNet 实现中需要添加 message 事件
  (huinet as any).on('message', (from: string, data: any) => {
    console.log(`\n📨 收到来自 ${from.substring(0, 16)}... 的消息:`);
    console.log(`   内容: ${JSON.stringify(data, null, 2)}`);
  });
}

// 发送消息到指定节点
async function sendMessage(huinet: HuiNet, targetNodeID: string, message: any) {
  try {
    console.log(`\n📤 发送消息到 ${targetNodeID.substring(0, 16)}...`);
    await huinet.send(targetNodeID, message);
    console.log('✅ 消息已发送');
  } catch (error) {
    console.error('❌ 发送失败:', error);
  }
}

// 创建交互式命令行界面
function createCLI(huinet: HuiNet, agentName: string): readline.Interface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n' + '='.repeat(50));
  console.log('📝 命令列表:');
  console.log('  status       - 查看连接状态');
  console.log('  list         - 列出所有已知节点');
  console.log('  send <id>    - 发送消息到指定节点');
  console.log('  broadcast    - 向所有连接的节点广播消息');
  console.log('  help         - 显示此帮助');
  console.log('  quit         - 退出');
  console.log('='.repeat(50));

  // 处理用户输入
  rl.on('line', async (input) => {
    const [command, ...args] = input.trim().split(/\s+/);

    switch (command.toLowerCase()) {
      case 'status':
        showStatus(huinet, agentName);
        break;

      case 'list':
        listNodes(huinet);
        break;

      case 'send':
        if (args.length < 2) {
          console.log('❌ 用法: send <节点ID> <消息内容>');
          break;
        }
        const nodeID = args[0];
        const message = args.slice(1).join(' ');
        await sendMessage(huinet, nodeID, {
          type: 'chat',
          from: agentName,
          text: message,
          timestamp: Date.now()
        });
        break;

      case 'broadcast':
        // 广播消息到所有已连接的节点
        console.log('📢 广播消息到所有节点...');
        // 注意：需要扩展 HuiNet 来支持广播
        break;

      case 'help':
        console.log('\n📝 命令列表:');
        console.log('  status       - 查看连接状态');
        console.log('  list         - 列出所有已知节点');
        console.log('  send <id>    - 发送消息到指定节点');
        console.log('  broadcast    - 向所有连接的节点广播消息');
        console.log('  help         - 显示此帮助');
        console.log('  quit         - 退出');
        break;

      case 'quit':
      case 'exit':
        console.log('\n👋 正在退出...');
        await huinet.stop();
        rl.close();
        process.exit(0);
        break;

      default:
        console.log(`❌ 未知命令: ${command}`);
        console.log('   输入 "help" 查看可用命令');
    }

    // 显示提示符
    rl.prompt();
  });

  rl.prompt();
  return rl;
}

// 显示状态
function showStatus(huinet: HuiNet, agentName: string) {
  console.log('\n📊 Agent 状态:');
  console.log('─'.repeat(40));
  console.log(`名称: ${agentName}`);
  console.log(`节点ID: ${huinet.getNodeID()}`);
  console.log(`监听地址: 0.0.0.0:${huinet['config'].listenPort}`);
  console.log('─'.repeat(40));
}

// 列出所有已知节点
function listNodes(huinet: HuiNet) {
  const routingTable = huinet.getRoutingTable();

  console.log('\n📋 已知节点:');
  console.log('─'.repeat(40));

  // 获取所有层级的节点
  const coreNodes = routingTable.getCoreNodes();
  const activeNodes = routingTable.getActiveNodes();
  const knownNodes = routingTable.getKnownNodes();

  console.log(`\n🔴 核心节点 (${coreNodes.size}):`);
  if (coreNodes.size === 0) console.log('  (无)');
  coreNodes.forEach((node, id) => {
    console.log(`  ${id.substring(0, 16)}... @ ${node.address}`);
  });

  console.log(`\n🟡 活跃节点 (${activeNodes.size}):`);
  if (activeNodes.size === 0) console.log('  (无)');
  activeNodes.forEach((node, id) => {
    console.log(`  ${id.substring(0, 16)}... @ ${node.address}`);
  });

  console.log(`\n⚪ 已知节点 (${knownNodes.size}):`);
  if (knownNodes.size === 0) console.log('  (无)');
  knownNodes.forEach((node, id) => {
    console.log(`  ${id.substring(0, 16)}... @ ${node.address}`);
  });

  console.log('─'.repeat(40));
}

// 主函数
export async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       HuiNet Agent 聊天示例                      ║');
  console.log('║     跨机器 P2P 通信演示                          ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // 从命令行参数获取配置
  const args = process.argv.slice(2);
  const name = args[0] || 'Agent-Alice';
  const port = parseInt(args[1]) || 8000;
  const bootstrap = args[2] ? [args[2]] : undefined;

  const config: AgentConfig = {
    name,
    listenPort: port,
    bootstrapNodes: bootstrap,
  };

  try {
    // 创建并启动 Agent
    const huinet = await createChatAgent(config);

    // 等待一下确保完全启动
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 创建命令行界面
    createCLI(huinet, config.name);

  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}
