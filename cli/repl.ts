/**
 * HuiNet CLI - Interactive REPL
 *
 * User-friendly command-line interface for HuiNet
 */

import readline from 'readline';
import { HuiNet } from '../src';
import { ConfigManager } from './storage/config';
import { showWelcome, showMessage, clearScreen } from './ui/display';
import { setupHuiNetEventHandlers } from './ui/event-handlers';
import { handleCommand } from './commands';
import { createREPLContext, REPLContext } from './context';

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

  // Flag to prevent duplicate welcome screen display
  // Create readline interface early for event handlers
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'HUINET > ',
    completer: completer
  });

  // Create REPL context
  const context: REPLContext = createREPLContext(huinet, config, rl);

  // Wait for node to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Startup timeout'));
    }, 10000);

    huinet.on('ready', () => {
      clearTimeout(timeout);
      showMessage('success', 'HuiNet is ready!');

      // Show welcome screen only once
      if (!context.welcomeShown) {
        showWelcome(huinet, options.name);
        context.welcomeShown = true;
      }

      // Setup event handlers after ready
      setupHuiNetEventHandlers(huinet, config, rl);

      resolve();
    });

    huinet.start().catch(reject);
  });

  // Show prompt
  context.rl.prompt();

  // Listen for user input
  context.rl.on('line', async (input) => {
    const cmd = input.trim();

    if (cmd) {
      try {
        await handleCommand(context, cmd);
      } catch (error) {
        showMessage('error', `Error: ${(error as Error).message}`);
      }
    }

    context.rl.prompt();
  });

  // Listen for Ctrl+C
  context.rl.on('SIGINT', async () => {
    console.log('');
    showMessage('info', 'Exiting...');
    context.running = false;
    await context.huinet.stop();
    context.rl.close();
    process.exit(0);
  });

  // Listen for close event
  context.rl.on('close', async () => {
    context.running = false;
    await context.huinet.stop();
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
