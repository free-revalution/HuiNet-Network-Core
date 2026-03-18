/**
 * Configuration management for HuiNet Daemon
 */

import * as fs from 'fs';
import * as path from 'path';
import { DaemonConfig } from './types';

/**
 * Default daemon configuration
 * FIXED: Removed machineName and location defaults (not in spec)
 * FIXED: Changed heartbeatInterval from 30000 to 3000 per spec
 * FIXED: Changed heartbeatTimeout from 90000 to 10000 per spec
 * FIXED: Added machineName and location to satisfy Required<DaemonConfig> type
 */
export const DEFAULT_CONFIG: Required<DaemonConfig> = {
  machineName: '', // Will be set to hostname in constructor
  location: 'default', // Will be set by user or default
  listenPort: 8000,
  enableMDNS: true,
  adminPort: 3000,
  proxyPortRange: [8080, 8090],
  heartbeatInterval: 3000, // FIXED: was 30000, spec says 3000
  heartbeatTimeout: 10000, // FIXED: was 90000, spec says 10000
};

/**
 * Load configuration from file
 * FIXED: Changed signature from loadConfig(userConfig: DaemonConfig) to loadConfig(configPath: string)
 * Reads from file using fs.readFileSync() per spec
 */
export function loadConfig(configPath: string): Required<DaemonConfig> {
  try {
    const absolutePath = path.resolve(configPath);
    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
    const userConfig = JSON.parse(fileContent) as Partial<DaemonConfig>;

    // Merge with defaults
    return {
      machineName: userConfig.machineName ?? DEFAULT_CONFIG.machineName,
      location: userConfig.location ?? DEFAULT_CONFIG.location,
      listenPort: userConfig.listenPort ?? DEFAULT_CONFIG.listenPort,
      enableMDNS: userConfig.enableMDNS ?? DEFAULT_CONFIG.enableMDNS,
      adminPort: userConfig.adminPort ?? DEFAULT_CONFIG.adminPort,
      proxyPortRange: userConfig.proxyPortRange ?? DEFAULT_CONFIG.proxyPortRange,
      heartbeatInterval: userConfig.heartbeatInterval ?? DEFAULT_CONFIG.heartbeatInterval,
      heartbeatTimeout: userConfig.heartbeatTimeout ?? DEFAULT_CONFIG.heartbeatTimeout,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Config file doesn't exist, return defaults
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }
}
