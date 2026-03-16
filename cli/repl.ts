/**
 * HuiNet CLI - Interactive REPL
 *
 * User-friendly command-line interface for HuiNet
 */

import readline from 'readline';
import { HuiNet } from '../src';
import { ConfigManager } from './storage/config';
import { showWelcome, showMessage } from './ui/display';
import { handleCommand } from './commands';

export interface REPLOptions {
  name: string;
  port: number;
  host?: string;
  mdns?: boolean;
  bootstrap?: string[];
}

/**
 * Start interactive REPL
 */
export async function startREPL(options: REPLOptions): Promise<void> {
  // Initialize configuration manager
  const config = ConfigManager.getInstance();

  // Save configuration
  if (options.name) {
    config.set('name', options.name);
  }

  // Create HuiNet instance
  console.log('');
  showMessage('info', 'Starting HuiNet Agent...');

  const huinet = new HuiNet({
    listenPort: options.port,
    listenHost: options.host || '0.0.0.0',
    enableMDNS: options.mdns !== false,
    bootstrapNodes: options.bootstrap,
  });

  // Wait for node to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Startup timeout'));
    }, 10000);

    huinet.on('ready', () => {
      clearTimeout(timeout);
      showMessage('success', 'HuiNet is ready!');
      resolve();
    });

    huinet.on('nodeDiscovered', (node: any) => {
      console.log('');
      showMessage('info', `Discovered node: ${node.nodeId?.substring(0, 20)}...`);
      console.log(`  Address: ${node.address}`);
      console.log('');
    });

    huinet.on('peerConnected', (nodeID: string) => {
      console.log('');
      showMessage('success', `Connected to: ${nodeID.substring(0, 20)}...`);
      console.log('');
    });

    huinet.on('peerDisconnected', (nodeID: string) => {
      console.log('');
      showMessage('warning', `Disconnected from: ${nodeID.substring(0, 20)}...`);
      console.log('');
    });

    huinet.start().catch(reject);
  });

  // Show welcome screen
  showWelcome(huinet, options.name);

  // Create REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'HUINET > ',
    completer: completer
  });

  // Save references for commands
  (global as any).__huinet = huinet;
  (global as any).__repl = rl;

  // Show prompt
  rl.prompt();

  // Listen for user input
  rl.on('line', async (input) => {
    const cmd = input.trim();

    if (cmd) {
      try {
        await handleCommand(huinet, cmd, config);
      } catch (error) {
        showMessage('error', `Error: ${(error as Error).message}`);
      }
    }

    rl.prompt();
  });

  // Listen for Ctrl+C
  rl.on('SIGINT', async () => {
    console.log('');
    showMessage('info', 'Exiting...');
    await huinet.stop();
    rl.close();
    process.exit(0);
  });

  // Listen for close event
  rl.on('close', async () => {
    await huinet.stop();
    process.exit(0);
  });
}

/**
 * Command auto-completion
 */
function completer(line: string): [string[], string] {
  const commands = [
    'help', 'status', 'ls', 'fullnodeid', 'msg', 'broadcast',
    'alias', 'aliases', 'connect', 'disconnect', 'history',
    'clear', 'quit'
  ];

  const hits = commands.filter(c => c.startsWith(line));

  return [hits.length ? hits : commands, line];
}
