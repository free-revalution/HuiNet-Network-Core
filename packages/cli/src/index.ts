#!/usr/bin/env node
/**
 * HuiNet CLI - 主入口
 *
 * 命令行工具主程序
 */

import { Command } from 'commander';
import { startREPL } from './ui/repl';
import { showTitle } from './ui/welcome';

const program = new Command();

// CLI 信息
program
  .name('huinet')
  .description('HuiNet P2P Agent CLI - 简单易用的 P2P 通信命令行工具')
  .version('1.0.0');

// 启动交互式命令行（默认命令）
program
  .argument('[name]', 'Agent 名称', 'MyAgent')
  .option('-p, --port <number>', '监听端口', '8000')
  .option('-h, --host <address>', '监听地址', '0.0.0.0')
  .option('--no-mdns', '禁用 mDNS 自动发现')
  .option('-b, --bootstrap <addresses...>', '引导节点地址')
  .action(async (name, options) => {
    try {
      await startREPL({
        name,
        port: parseInt(options.port),
        host: options.host,
        mdns: options.mdns,
        bootstrap: options.bootstrap
      });
    } catch (error) {
      console.error('❌ 启动失败:', (error as Error).message);
      process.exit(1);
    }
  });

// 添加别名命令
program
  .command('alias')
  .description('管理节点别名')
  .argument('<name>', '别名')
  .argument('<nodeID>', '节点 ID')
  .action((name, nodeID) => {
    const { ConfigManager } = require('./storage/config');
    const config = ConfigManager.getInstance();
    config.addAlias(name, nodeID);
    config.save();
    console.log(`✅ 已设置别名: ${name} = ${nodeID.substring(0, 20)}...`);
  });

// 列出别名命令
program
  .command('aliases')
  .description('列出所有别名')
  .action(() => {
    const { ConfigManager } = require('./storage/config');
    const config = ConfigManager.getInstance();
    const aliases = config.getAliases();

    showTitle('📋 节点别名');

    if (Object.keys(aliases).length === 0) {
      console.log('  (还没有设置任何别名)');
      console.log('  使用: huinet alias <名称> <NodeID>');
    } else {
      for (const [name, nodeID] of Object.entries(aliases)) {
        console.log(`  ${name.padEnd(20)} = ${nodeID}`);
      }
    }
  });

// 清理配置命令
program
  .command('reset')
  .description('重置所有配置')
  .option('-f, --force', '强制重置，不询问确认')
  .action((options) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirm = () => {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const configPath = path.join(os.homedir(), '.huinet', 'config.json');

      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
        console.log('✅ 配置已重置');
      } else {
        console.log('ℹ️ 没有找到配置文件');
      }

      rl.close();
    };

    if (options.force) {
      confirm();
    } else {
      rl.question('⚠️ 确定要删除所有配置吗？(yes/no): ', (answer: string) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
          confirm();
        } else {
          console.log('❌ 已取消');
          rl.close();
        }
      });
    }
  });

// 解析命令行参数
program.parse();
