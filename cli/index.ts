#!/usr/bin/env node
/**
 * HuiNet CLI - Main Entry Point
 *
 * Command-line interface for HuiNet P2P Agent
 */

import { Command } from 'commander';
import { startREPL } from './repl';
import { showTitle } from './ui/welcome';

const program = new Command();

// CLI information
program
  .name('huinet')
  .description('HuiNet P2P Agent CLI - Simple command-line interface for P2P communication')
  .version('1.0.0');

// Start interactive REPL (default command)
program
  .argument('[name]', 'Agent name', 'MyAgent')
  .option('-p, --port <number>', 'Listen port', '8000')
  .option('-h, --host <address>', 'Listen address', '0.0.0.0')
  .option('--no-mdns', 'Disable mDNS discovery')
  .option('-b, --bootstrap <addresses...>', 'Bootstrap node addresses')
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
      console.error('❌ Startup failed:', (error as Error).message);
      process.exit(1);
    }
  });

// Add alias command
program
  .command('alias')
  .description('Manage node aliases')
  .argument('<name>', 'Alias name')
  .argument('<nodeID>', 'Node ID')
  .action((name, nodeID) => {
    const { ConfigManager } = require('./storage/config');
    const config = ConfigManager.getInstance();
    config.addAlias(name, nodeID);
    config.save();
    console.log(`✅ Alias set: ${name} = ${nodeID.substring(0, 20)}...`);
  });

// List aliases command
program
  .command('aliases')
  .description('List all aliases')
  .action(() => {
    const { ConfigManager } = require('./storage/config');
    const config = ConfigManager.getInstance();
    const aliases = config.getAliases();

    showTitle('📋 Node Aliases');

    if (Object.keys(aliases).length === 0) {
      console.log('  (No aliases set yet)');
      console.log('  Use: huinet alias <name> <NodeID>');
    } else {
      for (const [name, nodeID] of Object.entries(aliases)) {
        console.log(`  ${name.padEnd(20)} = ${nodeID}`);
      }
    }
  });

// Reset configuration command
program
  .command('reset')
  .description('Reset all configuration')
  .option('-f, --force', 'Force reset without confirmation')
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
        console.log('✅ Configuration reset');
      } else {
        console.log('ℹ️ No configuration file found');
      }

      rl.close();
    };

    if (options.force) {
      confirm();
    } else {
      rl.question('⚠️ Are you sure you want to delete all configuration? (yes/no): ', (answer: string) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
          confirm();
        } else {
          console.log('❌ Cancelled');
          rl.close();
        }
      });
    }
  });

// Parse command line arguments
program.parse();
