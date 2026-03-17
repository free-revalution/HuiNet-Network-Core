// cli/ui/event-handlers.ts
import { HuiNet } from '../../src';
import { ConfigManager } from '../storage/config';
import { showMessage } from './display';
import readline from 'readline';

/**
 * 设置 HuiNet 事件处理器
 * 所有事件显示逻辑集中在这里
 */
export function setupHuiNetEventHandlers(
  huinet: HuiNet,
  config: ConfigManager,
  rl: readline.Interface
): void {
  // 节点发现事件
  huinet.on('nodeDiscovered', (node: any) => {
    console.log('');
    showMessage('info', `Discovered node: ${node.nodeId?.substring(0, 20)}...`);
    console.log(`  Address: ${node.address}`);
    console.log('');
    rl.prompt();
  });

  // 节点连接事件
  huinet.on('peerConnected', (nodeID: string) => {
    console.log('');
    showMessage('success', `Connected to: ${nodeID.substring(0, 20)}...`);

    const aliases = config.get('aliases') || {};
    const alias = Object.keys(aliases).find(key => aliases[key] === nodeID);
    if (alias) {
      console.log(`  Alias: ${alias}`);
    }
    console.log('');
    rl.prompt();
  });

  // 节点断开事件
  huinet.on('peerDisconnected', (nodeID: string) => {
    console.log('');
    showMessage('warning', `Disconnected from: ${nodeID.substring(0, 20)}...`);
    console.log('');
    rl.prompt();
  });

  // 消息接收事件
  huinet.on('message', (from: string, data: any) => {
    console.log('');
    showMessage('info', `Message received from ${from.substring(0, 20)}...`);

    const messageData = data.data || data;
    if (messageData.text) {
      console.log(`  ${messageData.text}`);
    } else {
      console.log(`  ${JSON.stringify(messageData, null, 2)}`);
    }

    // 保存到历史
    const history = config.get('messageHistory') || [];
    history.push({
      direction: 'received',
      target: from.substring(0, 20),
      message: messageData.text || JSON.stringify(messageData),
      timestamp: Date.now()
    });
    config.set('messageHistory', history.slice(-100));
    config.save();

    console.log('');
    rl.prompt();
  });

  // 错误事件
  huinet.on('error', (error: Error) => {
    console.log('');
    showMessage('error', `HuiNet error: ${error.message}`);
    console.log('');
    rl.prompt();
  });
}
