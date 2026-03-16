/**
 * HuiNet CLI - 交互式命令行界面
 *
 * 提供用户友好的命令行交互体验
 */

import readline from 'readline';
import { HuiNet } from '@huinet/network';
import { handleCommand, showWelcome } from '../commands';
import { ConfigManager } from '../storage/config';

export interface REPLOptions {
  name: string;
  port: number;
  host?: string;
  mdns?: boolean;
  bootstrap?: string[];
}

/**
 * 启动交互式命令行界面
 */
export async function startREPL(options: REPLOptions): Promise<void> {
  // 初始化配置管理器
  const config = ConfigManager.getInstance();

  // 保存配置
  if (options.name) {
    config.set('name', options.name);
  }

  // 创建 HuiNet 实例
  console.log('\n🚀 正在启动 HuiNet Agent...');

  const huinet = new HuiNet({
    listenPort: options.port,
    listenHost: options.host || '0.0.0.0',
    enableMDNS: options.mdns !== false,
    bootstrapNodes: options.bootstrap,
  });

  // 等待节点就绪
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('启动超时'));
    }, 10000);

    huinet.on('ready', () => {
      clearTimeout(timeout);
      resolve();
    });

    huinet.start().catch(reject);
  });

  // 显示欢迎界面
  showWelcome(huinet, options.name);

  // 创建 REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'huinet > ',
    // 启用自动补全
    completer: completer
  });

  // 保存引用以便命令使用
  (global as any).__huinet = huinet;
  (global as any).__repl = rl;

  // 显示提示符
  rl.prompt();

  // 监听用户输入
  rl.on('line', async (input) => {
    const cmd = input.trim();

    if (cmd) {
      try {
        await handleCommand(huinet, cmd, config);
      } catch (error) {
        console.log(`❌ 错误: ${(error as Error).message}`);
      }
    }

    rl.prompt();
  });

  // 监听 Ctrl+C
  rl.on('SIGINT', async () => {
    console.log('\n\n👋 正在退出...');
    await huinet.stop();
    rl.close();
    process.exit(0);
  });

  // 监听关闭事件
  rl.on('close', async () => {
    await huinet.stop();
    process.exit(0);
  });
}

/**
 * 命令自动补全
 */
function completer(line: string): [string[], string] {
  const commands = [
    'help', 'status', 'ls', 'msg', 'broadcast',
    'alias', 'connect', 'disconnect', 'history', 'quit'
  ];

  const hits = commands.filter(c => c.startsWith(line));

  return [hits.length ? hits : commands, line];
}

export { showWelcome };
