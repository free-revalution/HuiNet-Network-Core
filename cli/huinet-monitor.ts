#!/usr/bin/env node
/**
 * HuiNet Monitor CLI
 * Terminal UI for monitoring HuiNet daemon
 */

import { startMonitor, getDaemonUrl } from './monitor/index';

/**
 * Main entry point
 */
async function main() {
  const daemonUrl = getDaemonUrl();

  try {
    await startMonitor(daemonUrl);
  } catch (error) {
    console.error(`Monitor error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// Run main
main();
