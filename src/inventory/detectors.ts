/**
 * Built-in detectors for mainstream local AI agents
 *
 * Rule: leftover config dirs alone do NOT count as installed.
 * Need a real binary, app bundle, or a live process.
 */

import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AgentCapability, AgentDetector, DiscoveredAgent } from './types';

function which(cmd: string): string | undefined {
  try {
    const out = execFileSync(
      process.platform === 'win32' ? 'where' : 'which',
      [cmd],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    )
      .trim()
      .split(/\r?\n/)[0];
    return out || undefined;
  } catch {
    return undefined;
  }
}

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function tryVersion(binary: string, args = ['--version']): string | undefined {
  try {
    const out = execFileSync(binary, args, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out.split(/\r?\n/)[0].slice(0, 120);
  } catch {
    return undefined;
  }
}

/** Full process argument list (more precise than short comm names). */
function processArgsSnapshot(): string {
  try {
    const cmd =
      process.platform === 'win32'
        ? 'wmic process get CommandLine'
        : 'ps -axo args=';
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      maxBuffer: 8 * 1024 * 1024,
    }).toLowerCase();
  } catch {
    return '';
  }
}

/**
 * True if a live process matches includes and none of excludes.
 * Excludes kill false positives from nested node_modules / leftover workers.
 */
function processRunning(
  includes: string[],
  excludes: string[] = ['node_modules', '/.openclaw/', 'openclaw-']
): boolean {
  const out = processArgsSnapshot();
  if (!out) return false;
  const lines = out.split(/\r?\n/);
  return lines.some((line) => {
    if (!line.trim()) return false;
    if (excludes.some((e) => line.includes(e.toLowerCase()))) return false;
    return includes.some((p) => line.includes(p.toLowerCase()));
  });
}

function base(
  partial: Omit<DiscoveredAgent, 'scannedAt' | 'presence'> & {
    presence?: DiscoveredAgent['presence'];
  }
): DiscoveredAgent {
  return {
    ...partial,
    presence: partial.presence ?? 'unknown',
    scannedAt: Date.now(),
  };
}

function homeSignal(
  id: string,
  name: string,
  homeRel: string,
  binaryNames: string[],
  sessionRel: string | undefined,
  capabilities: AgentCapability[],
  processIncludes: string[],
  processExcludes?: string[]
): AgentDetector {
  return {
    id,
    name,
    detect() {
      const home = os.homedir();
      const homeDir = path.join(home, homeRel);
      const signals: string[] = [];
      let binaryPath: string | undefined;
      for (const b of binaryNames) {
        const found = which(b);
        if (found) {
          binaryPath = found;
          signals.push(`path:${b}`);
          break;
        }
      }
      if (exists(homeDir)) {
        signals.push(`home:${homeRel}`);
      }
      const sessionDir = sessionRel
        ? path.join(home, sessionRel)
        : undefined;
      if (sessionDir && exists(sessionDir)) {
        signals.push(`sessions:${sessionRel}`);
      }
      const running = processRunning(processIncludes, processExcludes);
      if (running) signals.push('process:running');

      // Remnant ~/.foo alone is NOT enough — need binary or live process
      if (!binaryPath && !running) return null;

      let presence: DiscoveredAgent['presence'] = 'installed';
      if (running) presence = 'running';

      return base({
        id,
        name,
        presence,
        binaryPath,
        version: binaryPath ? tryVersion(binaryPath) : undefined,
        homeDir: exists(homeDir) ? homeDir : undefined,
        sessionDir: sessionDir && exists(sessionDir) ? sessionDir : undefined,
        capabilities,
        signals,
      });
    },
  };
}

export const BUILTIN_DETECTORS: AgentDetector[] = [
  homeSignal(
    'claude-code',
    'Claude Code',
    '.claude',
    ['claude'],
    '.claude/projects',
    ['mcp', 'skills', 'sessions', 'cli'],
    ['claude'],
    ['node_modules', 'claude.app', 'claude helper']
  ),
  homeSignal(
    'codex',
    'OpenAI Codex',
    '.codex',
    ['codex'],
    '.codex/sessions',
    ['mcp', 'skills', 'sessions', 'cli'],
    ['codex'],
    ['node_modules', '/.openclaw/', 'openclaw-', 'codex++']
  ),
  {
    id: 'cursor',
    name: 'Cursor',
    detect() {
      const home = os.homedir();
      const signals: string[] = [];
      const cursorHome = path.join(home, '.cursor');
      const macApp = '/Applications/Cursor.app';
      const binaryPath =
        which('cursor-agent') || which('cursor') || undefined;
      if (binaryPath) signals.push('path:cursor');
      if (exists(macApp)) signals.push('app:Cursor.app');
      if (exists(cursorHome)) signals.push('home:.cursor');

      const macAppSupport = path.join(
        home,
        'Library/Application Support/Cursor'
      );
      const linuxConfig = path.join(home, '.config/Cursor');
      let ideHome: string | undefined;
      if (exists(macAppSupport)) {
        ideHome = macAppSupport;
        signals.push('ide:Application Support/Cursor');
      } else if (exists(linuxConfig)) {
        ideHome = linuxConfig;
        signals.push('ide:.config/Cursor');
      }

      const chatsDir = path.join(cursorHome, 'chats');
      const transcripts = path.join(cursorHome, 'projects');
      let sessionDir: string | undefined;
      if (exists(chatsDir)) sessionDir = chatsDir;
      else if (exists(transcripts)) sessionDir = transcripts;

      const running = processRunning(
        ['/applications/cursor.app', 'cursor-agent', 'cursor helper'],
        [
          'node_modules/electron',
          'huinet/apps/desktop',
          'cursoruiviewservice',
        ]
      );
      if (running) signals.push('process:running');

      // Need app, CLI, or live Cursor — not just ~/.cursor crumbs
      if (!binaryPath && !exists(macApp) && !running && !ideHome) return null;
      if (!binaryPath && !exists(macApp) && !running) {
        // Application Support alone can be remnant if app deleted
        return null;
      }

      return base({
        id: 'cursor',
        name: 'Cursor',
        presence: running ? 'running' : 'installed',
        binaryPath,
        version: binaryPath ? tryVersion(binaryPath) : undefined,
        homeDir: exists(cursorHome) ? cursorHome : ideHome,
        sessionDir,
        capabilities: ['mcp', 'skills', 'sessions', 'ide', 'cli'],
        signals,
      });
    },
  },
  homeSignal(
    'copilot',
    'GitHub Copilot CLI',
    '.copilot',
    ['copilot'],
    undefined,
    ['mcp', 'skills', 'cli'],
    ['copilot']
  ),
  homeSignal(
    'openclaw',
    'OpenClaw',
    '.openclaw',
    ['openclaw'],
    '.openclaw',
    ['mcp', 'skills', 'cli'],
    ['openclaw'],
    ['node_modules']
  ),
  homeSignal(
    'gemini',
    'Gemini CLI',
    '.gemini',
    ['gemini'],
    '.gemini',
    ['mcp', 'cli', 'sessions'],
    ['gemini']
  ),
  homeSignal(
    'opencode',
    'OpenCode',
    '.local/share/opencode',
    ['opencode'],
    '.local/share/opencode',
    ['mcp', 'skills', 'sessions', 'cli'],
    ['opencode']
  ),
  homeSignal(
    'windsurf',
    'Windsurf',
    '.codeium/windsurf',
    ['windsurf'],
    '.codeium/windsurf',
    ['mcp', 'skills', 'ide'],
    ['windsurf']
  ),
  homeSignal(
    'kiro',
    'Kiro',
    '.kiro',
    ['kiro'],
    undefined,
    ['skills', 'ide'],
    ['kiro']
  ),
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    detect() {
      const home = os.homedir();
      const signals: string[] = [];
      const macApp = '/Applications/Claude.app';
      const support = path.join(home, 'Library/Application Support/Claude');
      if (exists(macApp)) signals.push('app:Claude.app');
      if (exists(support)) signals.push('home:Application Support/Claude');
      const running = processRunning(
        ['/applications/claude.app', 'claude helper'],
        ['node_modules', 'claude-code']
      );
      if (running) signals.push('process:running');
      // Support folder alone = remnant
      if (!exists(macApp) && !running) return null;
      return base({
        id: 'claude-desktop',
        name: 'Claude Desktop',
        presence: running ? 'running' : 'installed',
        homeDir: exists(support) ? support : undefined,
        capabilities: ['mcp', 'ide'],
        signals,
      });
    },
  },
];

export function getDetectorRegistry(
  extras: AgentDetector[] = []
): Map<string, AgentDetector> {
  const map = new Map<string, AgentDetector>();
  for (const d of [...BUILTIN_DETECTORS, ...extras]) {
    map.set(d.id, d);
  }
  return map;
}
