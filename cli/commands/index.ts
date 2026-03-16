/**
 * 命令处理模块
 *
 * 处理用户输入的所有命令
 */

import { HuiNet } from '../../src';
import { ConfigManager } from '../storage/config';
import { parseNaturalLanguage } from '../nlp/parser';
import * as cmd from './handlers';

export async function handleCommand(
  huinet: HuiNet,
  input: string,
  config: ConfigManager
): Promise<void> {
  if (!input.trim()) {
    return;
  }

  // 首先尝试解析自然语言
  const parsed = parseNaturalLanguage(input);

  // 获取命令和参数
  let command: string;
  let args: string[];

  if (parsed.command) {
    // 自然语言解析成功
    command = parsed.command;
    args = parsed.args;
  } else {
    // 按空格分割
    const parts = input.trim().split(/\s+/);
    command = parts[0];
    args = parts.slice(1);
  }

  // 路由到对应的命令处理器
  switch (command.toLowerCase()) {
    case 'help':
    case '?':
      cmd.showHelp();
      break;

    case 'status':
      await cmd.showStatus(huinet, config);
      break;

    case 'ls':
    case 'list':
      await cmd.listNodes(huinet, config);
      break;

    case 'msg':
    case 'send':
      await cmd.sendMessage(huinet, config, args);
      break;

    case 'broadcast':
      await cmd.broadcastMessage(huinet, config, args);
      break;

    case 'alias':
      cmd.setAlias(config, args);
      break;

    case 'connect':
      await cmd.connectTo(huinet, args);
      break;

    case 'disconnect':
      await cmd.disconnectFrom(huinet, config, args);
      break;

    case 'history':
      cmd.showHistory(config);
      break;

    case 'fullnodeid':
      cmd.showFullNodeID(huinet);
      break;

    case 'aliases':
      cmd.listAliases(config);
      break;

    case 'clear':
    case 'cls':
      const { clearScreen } = require('../ui/display');
      const { showWelcome } = require('../ui/display');
      clearScreen();
      showWelcome(huinet, config.get('name') || 'MyAgent');
      break;

    case 'quit':
    case 'exit':
      await cmd.quit(huinet);
      break;

    default:
      const { showMessage } = require('../ui/display');
      showMessage('error', `Unknown command: ${command}`);
      console.log('  Type "help" to see available commands');
  }
}

export { showWelcome } from '../ui/display';
