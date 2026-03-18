#!/usr/bin/env node
/**
 * HuiNet CLI - Main Entry Point
 *
 * Command-line interface for HuiNet P2P Agent Networking
 */

import { Command } from 'commander';
import { createDaemon } from './daemon';
import { createConfigManager } from './config/agent-config';
import { createProcessManager } from './launcher';
import { createNetworkManager } from './network';

const program = new Command();

// CLI information
program
  .name('huinet')
  .description('HuiNet P2P Agent Networking - Connect AI agents across networks')
  .version('1.0.0');

// =============================================================================
// Run Command
// =============================================================================
program
  .command('run <agent-id>')
  .description('Start an agent with HuiNet')
  .option('-w, --workdir <path>', 'Working directory')
  .option('--no-daemon', 'Do not run as daemon (foreground mode)')
  .action(async (agentId, options) => {
    try {
      // Load configuration
      const configManager = createConfigManager();
      await configManager.load();

      const agentConfig = configManager.getAgent(agentId);

      if (!agentConfig) {
        console.error(`❌ Agent "${agentId}" not found in configuration.`);
        console.log(`   Use: huinet agent add ${agentId} --command <path>`);
        process.exit(1);
      }

      // Load network configuration
      const networkManager = createNetworkManager();
      await networkManager.load();

      const activeNetwork = networkManager.getActiveNetwork();
      if (!activeNetwork) {
        console.warn(`⚠ No active network. Agents may not be able to communicate.`);
        console.warn(`  Use: huinet network create <name>`);
      }

      // Create and start daemon
      const daemon = createDaemon();

      daemon.on('ready', () => {
        const nodeId = daemon.getHuiNet()?.getNodeID();
        console.log(`✓ HuiNet daemon started`);
        console.log(`  NodeID: ${nodeId?.substring(0, 16)}...`);

        if (activeNetwork) {
          console.log(`  Network: ${activeNetwork.name}`);
        }
      });

      daemon.on('agentRegistered', (info) => {
        console.log(`✓ Agent registered: ${info.id}`);
      });

      await daemon.start();

      // Launch the agent
      const processManager = createProcessManager(daemon);

      processManager.on('agentLaunched', (status) => {
        console.log(`✓ Agent launched: ${status.agentId} (PID: ${status.pid})`);
        console.log(`  WebSocket: ${status.pid ? 'Connected' : 'Pending'}`);
      });

      processManager.on('agentExited', (id, code) => {
        console.log(`✗ Agent exited: ${id} (code: ${code})`);
      });

      processManager.on('agentStdout', (id, data) => {
        process.stdout.write(`[${id}] ${data}`);
      });

      processManager.on('agentStderr', (id, data) => {
        process.stderr.write(`[${id}] ${data}`);
      });

      await processManager.launchAgent({
        ...agentConfig,
        workdir: options.workdir || agentConfig.workdir,
      });

      // Handle shutdown
      const shutdown = async () => {
        console.log('\nShutting down...');
        await processManager.stopAll();
        await daemon.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // Keep running
      if (options.daemon !== false) {
        console.log(`\nAgent ${agentId} is running. Press Ctrl+C to stop.`);
      }
    } catch (error) {
      console.error('❌ Failed to start agent:', (error as Error).message);
      process.exit(1);
    }
  });

// =============================================================================
// Agent Commands
// =============================================================================
const agentCmd = program.command('agent');

agentCmd
  .command('add <id>')
  .description('Add a new agent configuration')
  .requiredOption('--command <path>', 'Command to execute')
  .option('--name <name>', 'Display name')
  .option('--args <args>', 'Command arguments (comma-separated)')
  .option('--workdir <path>', 'Working directory')
  .action(async (id, options) => {
    const configManager = createConfigManager();
    await configManager.load();

    await configManager.setAgent({
      id,
      name: options.name || id,
      command: options.command,
      args: options.args ? options.args.split(',') : undefined,
      workdir: options.workdir,
    });

    console.log(`✓ Agent "${id}" added to configuration.`);
  });

agentCmd
  .command('list')
  .description('List all configured agents')
  .action(async () => {
    const configManager = createConfigManager();
    await configManager.load();

    const agents = configManager.getAgents();

    if (agents.length === 0) {
      console.log('No agents configured.');
      console.log('Use: huinet agent add <id> --command <path>');
      return;
    }

    console.log('\nConfigured Agents:');
    console.log('─────────────────────────────────────────────────────');

    for (const agent of agents) {
      console.log(`\n  ${agent.name} (${agent.id})`);
      console.log(`  Command: ${agent.command}`);
      if (agent.args) {
        console.log(`  Args: ${agent.args.join(' ')}`);
      }
      if (agent.workdir) {
        console.log(`  Workdir: ${agent.workdir}`);
      }
    }

    console.log('');
  });

agentCmd
  .command('remove <id>')
  .description('Remove an agent configuration')
  .action(async (id) => {
    const configManager = createConfigManager();
    await configManager.load();

    const removed = await configManager.removeAgent(id);

    if (removed) {
      console.log(`✓ Agent "${id}" removed from configuration.`);
    } else {
      console.log(`✗ Agent "${id}" not found.`);
    }
  });

// =============================================================================
// Network Commands
// =============================================================================
const networkCmd = program.command('network');

networkCmd
  .command('create <name>')
  .description('Create a new network')
  .action(async (name) => {
    const networkManager = createNetworkManager();
    await networkManager.load();

    const network = await networkManager.createNetwork(name);

    console.log(`✓ Network "${name}" created!`);
    console.log(`\n🔑 Network Key: \x1b[1m${network.key}\x1b[0m`);
    console.log(`\nShare this key with trusted agents:`);
    console.log(`  huinet network join ${name} ${network.key}\n`);
  });

networkCmd
  .command('join <name> <key>')
  .description('Join an existing network')
  .action(async (name, key) => {
    const networkManager = createNetworkManager();
    await networkManager.load();

    if (!networkManager.verifyKey(key)) {
      console.error(`❌ Invalid network key format.`);
      console.log(`  Key must be 32 character hex string.`);
      process.exit(1);
    }

    const network = await networkManager.joinNetwork(name, key);

    console.log(`✓ Joined network "${name}"`);
    console.log(`  Machine ID: ${network.machineId}`);
    console.log(`\nYou can now start agents with: huinet run <agent-id>\n`);
  });

networkCmd
  .command('list')
  .description('List all networks')
  .action(async () => {
    const networkManager = createNetworkManager();
    await networkManager.load();

    const networks = networkManager.getAllNetworks();

    if (networks.length === 0) {
      console.log('No networks configured.');
      console.log('\nCreate a network:');
      console.log('  huinet network create <name>');
      return;
    }

    console.log('\n📡 Configured Networks\n');

    for (let i = 0; i < networks.length; i++) {
      const network = networks[i];
      const active = network.active ? '\x1b[32m*active\x1b[0m' : '';
      console.log(`  ${i + 1}. \x1b[1m${network.name}\x1b[0m ${active}`);
      console.log(`     Key: ${network.key.substring(0, 16)}...`);
      if (network.machineId) {
        console.log(`     Machine: ${network.machineId}`);
      }
    }
  });

networkCmd
  .command('status')
  .description('Show network status')
  .action(async () => {
    const networkManager = createNetworkManager();
    await networkManager.load();

    const activeNetwork = networkManager.getActiveNetwork();

    if (!activeNetwork) {
      console.log('No active network.');
      console.log('\nCreate or join a network:');
      console.log('  huinet network create <name>');
      console.log('  huinet network join <name> <key>');
      return;
    }

    console.log('\n📡 Network Status\n');
    console.log(`  Name: \x1b[1m${activeNetwork.name}\x1b[0m`);
    console.log(`  Key: ${activeNetwork.key}`);
    console.log(`  Machine: ${activeNetwork.machineId}`);
    console.log(`  Status: \x1b[32mActive\x1b[0m`);
  });

// =============================================================================
// Test Commands
// =============================================================================
program
  .command('doctor')
  .description('Check HuiNet system status')
  .action(async () => {
    console.log('\nHuiNet System Check\n');

    const checks: { name: string; pass: boolean }[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const nodeOk = parseInt(nodeVersion.slice(1).split('.')[0], 10) >= 16;
    checks.push({ name: `Node.js ${nodeVersion}`, pass: nodeOk });

    // Check config directory
    const path = require('path');
    const os = require('os');
    const configDir = path.join(os.homedir(), '.huinet');
    const fs = require('fs');

    const configExists = fs.existsSync(configDir);
    checks.push({ name: 'Config directory exists', pass: configExists });

    // Check configuration file
    const configManager = createConfigManager();
    try {
      await configManager.load();
      const agents = configManager.getAgents();
      checks.push({ name: 'Configuration valid', pass: true });
      checks.push({ name: `Agents configured: ${agents.length}`, pass: agents.length > 0 });
    } catch {
      checks.push({ name: 'Configuration valid', pass: false });
    }

    // Check network
    const networkManager = createNetworkManager();
    try {
      await networkManager.load();
      const activeNetwork = networkManager.getActiveNetwork();
      if (activeNetwork) {
        checks.push({ name: 'Network configured', pass: true });
        checks.push({ name: `Active network: ${activeNetwork.name}`, pass: true });
      } else {
        checks.push({ name: 'Network configured', pass: false });
        checks.push({ name: 'No active network', pass: false });
      }
    } catch {
      checks.push({ name: 'Network configuration', pass: false });
    }

    // Print results
    for (const check of checks) {
      const icon = check.pass ? '✓' : '✗';
      const color = check.pass ? '\x1b[32m' : '\x1b[31m';
      console.log(`  ${color}${icon}\x1b[0m ${check.name}`);
    }

    const allPassed = checks.every((c) => c.pass);
    console.log(`\nSystem Status: ${allPassed ? '\x1b[32mHEALTHY\x1b[0m' : '\x1b[31mISSUES\x1b[0m'}\n`);

    process.exit(allPassed ? 0 : 1);
  });

// =============================================================================
// Default
// =============================================================================
program.action(() => {
  program.outputHelp();
});

// Parse command line arguments
program.parse();
