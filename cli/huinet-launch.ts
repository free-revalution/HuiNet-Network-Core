#!/usr/bin/env node
/**
 * HuiNet Launcher CLI
 * Entry point for launching AI agents with HuiNet integration
 */

import { Command } from 'commander';
import { launch } from './launcher/index';

const program = new Command();

program
  .name('huinet-launch')
  .description('Launch AI agents with HuiNet integration')
  .version('0.1.0');

program
  .argument('<command>', 'Agent command to launch (e.g., claude, cursor, windsurf)')
  .argument('[args...]', 'Arguments to pass to the agent command')
  .option('-d, --daemon <url>', 'Daemon URL', 'http://localhost:3000')
  .action(async (agentCommand: string, args: string[], options) => {
    try {
      await launch(agentCommand, args, options.daemon);
    } catch (error) {
      console.error('Failed to launch agent:', error);
      process.exit(1);
    }
  });

program.parse();
