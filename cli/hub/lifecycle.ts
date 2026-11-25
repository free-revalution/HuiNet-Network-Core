/**
 * Singleton Local Hub lifecycle: start / stop / status via PID + HTTP
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import {
  ensureHuiNetDirs,
  getHuiNetPaths,
  loadHubConfig,
  type HuiNetPaths,
} from '../../src/paths';
import { createLocalHub } from '../../src/hub';

export async function httpJson<T = unknown>(
  pathname: string,
  options?: { method?: string; body?: unknown; port?: number; host?: string }
): Promise<T> {
  const config = loadHubConfig();
  const host = options?.host || config.host;
  const port = options?.port || config.httpPort;
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.stringify(options.body) : undefined;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: pathname,
        method,
        headers: body
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            }
          : undefined,
        timeout: 10000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          try {
            resolve(JSON.parse(text) as T);
          } catch {
            reject(new Error(text || `HTTP ${res.statusCode}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export function isHubReachable(): Promise<boolean> {
  return httpJson('/api/health')
    .then(() => true)
    .catch(() => false);
}

export function readPid(paths: HuiNetPaths = getHuiNetPaths()): number | null {
  try {
    const raw = fs.readFileSync(paths.daemonPid, 'utf-8').trim();
    const pid = parseInt(raw, 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run hub in the current process (blocking until signal)
 */
export async function runHubForeground(): Promise<void> {
  const hub = createLocalHub();
  await hub.start();
  const status = hub.getStatus();
  console.log(`HuiNet Local Hub started`);
  console.log(`  HTTP  ${status.httpUrl}`);
  console.log(`  WS    ${status.wsUrl}`);
  console.log(`  PID   ${status.pid}`);

  const shutdown = async () => {
    console.log('\nStopping hub...');
    await hub.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // Keep alive
  await new Promise(() => {});
}

/**
 * Spawn detached hub process
 */
export async function startHubDaemon(): Promise<void> {
  ensureHuiNetDirs();
  const paths = getHuiNetPaths();

  if (await isHubReachable()) {
    console.log('HuiNet hub is already running.');
    return;
  }

  const pid = readPid(paths);
  if (pid && isProcessAlive(pid)) {
    console.log(`HuiNet hub process alive (pid ${pid}) but HTTP not ready yet.`);
    return;
  }

  const runner = path.join(__dirname, 'run-daemon.js');
  const tsRunner = path.join(__dirname, 'run-daemon.ts');
  const useTs = fs.existsSync(tsRunner) && !fs.existsSync(runner);

  const child = child_process.spawn(
    process.execPath,
    useTs
      ? ['-r', 'ts-node/register/transpile-only', tsRunner]
      : [runner],
    {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    }
  );
  child.unref();

  // Wait for health
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isHubReachable()) {
      const status = await httpJson<{ pid: number; httpUrl: string; wsUrl: string }>(
        '/api/status'
      );
      console.log('✓ HuiNet Local Hub started');
      console.log(`  HTTP  ${status.httpUrl}`);
      console.log(`  WS    ${status.wsUrl}`);
      console.log(`  PID   ${status.pid}`);
      return;
    }
  }

  console.error('Hub process started but health check timed out.');
  process.exit(1);
}

export async function stopHubDaemon(): Promise<void> {
  const paths = getHuiNetPaths();
  const pid = readPid(paths);

  if (await isHubReachable()) {
    // Best-effort: kill by pid
  }

  if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // ignore
    }
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (!isProcessAlive(pid)) break;
    }
    if (isProcessAlive(pid)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
    console.log(`✓ HuiNet hub stopped (pid ${pid})`);
  } else {
    console.log('HuiNet hub is not running.');
  }

  try {
    if (fs.existsSync(paths.daemonPid)) fs.unlinkSync(paths.daemonPid);
  } catch {
    // ignore
  }
}

/**
 * Ensure hub is running; auto-start daemon if needed.
 */
export async function ensureHubRunning(options?: {
  quiet?: boolean;
}): Promise<boolean> {
  if (await isHubReachable()) return true;
  if (!options?.quiet) {
    console.log('Hub not running — starting…');
  }
  await startHubDaemon();
  return isHubReachable();
}

export async function printHubStatus(): Promise<void> {
  const paths = getHuiNetPaths();
  const pid = readPid(paths);

  if (await isHubReachable()) {
    const status = await httpJson<Record<string, unknown>>('/api/status');
    console.log('\nHuiNet Local Hub\n');
    console.log(`  Status:     \x1b[32mrunning\x1b[0m`);
    console.log(`  HTTP:       ${status.httpUrl}`);
    console.log(`  WS:         ${status.wsUrl}`);
    console.log(`  PID:        ${status.pid}`);
    console.log(`  Connected:  ${status.connectedAgents}`);
    console.log(`  Inventory:  ${status.inventoryCount}`);
    console.log(`  Memories:   ${status.memoryCount}`);
    console.log('');
    return;
  }

  console.log('\nHuiNet Local Hub\n');
  console.log(`  Status:     \x1b[31mstopped\x1b[0m`);
  if (pid) console.log(`  Stale PID:  ${pid}`);
  console.log(`  Start with: huinet start\n`);
}
