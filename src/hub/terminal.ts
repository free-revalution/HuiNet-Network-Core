/**
 * Local command runner for the desktop terminal panel.
 * Same-machine only; output capped; timeout enforced.
 */

import { spawn } from 'child_process';
import * as os from 'os';

export interface TerminalRunRequest {
  command: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface TerminalRunResult {
  ok: boolean;
  code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  ms: number;
  command: string;
}

const MAX_OUT = 200_000;

export function runTerminal(
  req: TerminalRunRequest
): Promise<TerminalRunResult> {
  const command = String(req.command || '').trim();
  if (!command) {
    return Promise.reject(new Error('command required'));
  }
  if (command.length > 4000) {
    return Promise.reject(new Error('command too long'));
  }

  const timeoutMs = Math.min(Math.max(req.timeoutMs || 30000, 500), 120000);
  const cwd = req.cwd || os.homedir();
  const started = Date.now();

  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (
      code: number | null,
      signal: NodeJS.Signals | null
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        signal,
        stdout: stdout.slice(0, MAX_OUT),
        stderr: stderr.slice(0, MAX_OUT),
        ms: Date.now() - started,
        command,
      });
    };

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }, 800);
      stderr += '\n[huinet] command timed out\n';
      finish(null, 'SIGTERM');
    }, timeoutMs);

    child.stdout?.on('data', (d: Buffer) => {
      if (stdout.length < MAX_OUT) stdout += d.toString('utf-8');
    });
    child.stderr?.on('data', (d: Buffer) => {
      if (stderr.length < MAX_OUT) stderr += d.toString('utf-8');
    });
    child.on('error', (err) => {
      stderr += err.message;
      finish(1, null);
    });
    child.on('close', (code, signal) => finish(code, signal));
  });
}
