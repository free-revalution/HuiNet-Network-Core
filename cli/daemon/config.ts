/**
 * Configuration management for HuiNet Daemon
 */

import { DaemonConfig } from './types';
import * as os from 'os';

/**
 * Default daemon configuration
 */
export const DEFAULT_CONFIG: Required<DaemonConfig> = {
  machineName: os.hostname(),
  location: 'default',
  listenPort: 8000,
  enableMDNS: true,
  adminPort: 3000,
  proxyPortRange: [8080, 8090],
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 90000, // 90 seconds (3x heartbeat interval)
};

/**
 * Load and merge daemon configuration with defaults
 *
 * @param userConfig - User-provided configuration
 * @returns Merged configuration with all required fields
 */
export function loadConfig(userConfig: DaemonConfig = {}): Required<DaemonConfig> {
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
}
