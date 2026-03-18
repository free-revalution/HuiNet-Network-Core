/**
 * HuiNet Monitor - Main entry point
 * Terminal UI for monitoring HuiNet daemon
 */

import { render } from 'ink';
import { DaemonClient } from './client';
import { MonitorApp } from './ui/components';

/**
 * Default daemon URL
 */
const DEFAULT_DAEMON_URL = 'http://127.0.0.1:3000';

/**
 * Get daemon URL from environment or use default
 */
export function getDaemonUrl(): string {
  return process.env.HUINET_DAEMON_URL || DEFAULT_DAEMON_URL;
}

/**
 * Start the monitor TUI
 *
 * @param daemonUrl - URL of the daemon to connect to
 * @returns Promise that resolves when monitor exits
 */
export async function startMonitor(daemonUrl?: string): Promise<void> {
  const url = daemonUrl || getDaemonUrl();
  const client = new DaemonClient(url);

  try {
    // Verify connection
    await client.connect();
    console.log(`Connected to HuiNet daemon at ${url}`);

    // Start TUI
    const { waitUntilExit } = render(<MonitorApp daemonUrl={url} client={client} />);

    // Wait for exit
    await waitUntilExit();
  } catch (error) {
    console.error(`Failed to start monitor: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
