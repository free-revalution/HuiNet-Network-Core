#!/usr/bin/env node
/**
 * HuiNet CLI — Local Agent Fabric
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createConfigManager } from './config/agent-config';
import {
  httpJson,
  isHubReachable,
  ensureHubRunning,
  printHubStatus,
  runHubForeground,
  startHubDaemon,
  stopHubDaemon,
} from './hub/lifecycle';
import { createAgentScanner } from '../src/inventory';
import { loadHubConfig, getHuiNetPaths, ensureHuiNetDirs } from '../src/paths';
import {
  agentIdToMcpTarget,
  buildMcpSnippet,
  isMcpWired,
  wireMcpTarget,
} from '../src/mcp/install';

const program = new Command();

program
  .name('huinet')
  .description(
    'HuiNet Local Agent Fabric — discover agents, share context, same-machine A2A'
  )
  .version('2.0.0');

// =============================================================================
// Hub lifecycle
// =============================================================================
program
  .command('start')
  .description('Start the local HuiNet hub (singleton daemon)')
  .option('-f, --foreground', 'Run in foreground')
  .action(async (options) => {
    if (options.foreground) {
      await runHubForeground();
    } else {
      await startHubDaemon();
    }
  });

program
  .command('stop')
  .description('Stop the local HuiNet hub')
  .action(async () => {
    await stopHubDaemon();
  });

program
  .command('status')
  .description('Show local hub status')
  .action(async () => {
    await printHubStatus();
  });

// =============================================================================
// Agents
// =============================================================================
const agents = program.command('agents').description('Local agent inventory');

agents
  .command('scan')
  .description('Scan this machine for installed AI agents')
  .action(async () => {
    await ensureHubRunning();
    const snap = await httpJson<{
      agents: Array<{ id: string; name: string; presence: string; binaryPath?: string }>;
    }>('/api/agents/scan', { method: 'POST', body: {} });
    printAgentTable(snap.agents);
  });

agents
  .command('list')
  .description('List discovered agents')
  .action(async () => {
    await ensureHubRunning();
    const data = await httpJson<{ agents: Array<Record<string, unknown>> }>(
      '/api/agents'
    );
    printAgentTable(data.agents as never);
  });

agents
  .command('show <id>')
  .description('Show details for one agent')
  .action(async (id: string) => {
    await ensureHubRunning();
    try {
      const agent = await httpJson<Record<string, unknown>>(
        `/api/agents/${encodeURIComponent(id)}`
      );
      const mcpTarget = agentIdToMcpTarget(id);
      console.log(
        JSON.stringify(
          {
            ...agent,
            mcpWired: mcpTarget ? isMcpWired(mcpTarget) : false,
            mcpTarget,
          },
          null,
          2
        )
      );
    } catch {
      console.error(`Agent "${id}" not found.`);
      process.exit(1);
    }
  });

agents
  .command('connect <id>')
  .description('Open agent on A2A and wire MCP when supported')
  .action(async (id: string) => {
    await ensureHubRunning();
    try {
      const result = await httpJson<{
        message: string;
        wire?: { file: string };
      }>(`/api/agents/${encodeURIComponent(id)}/a2a`, {
        method: 'POST',
        body: { open: true },
      });
      console.log(`✓ ${result.message}`);
      if (result.wire?.file) console.log(`  MCP: ${result.wire.file}`);
    } catch (err) {
      console.error(`✗ ${(err as Error).message}`);
      process.exit(1);
    }
  });

agents
  .command('disconnect <id>')
  .description('Close agent on A2A network')
  .action(async (id: string) => {
    await ensureHubRunning();
    const result = await httpJson<{ message: string }>(
      `/api/agents/${encodeURIComponent(id)}/a2a`,
      { method: 'POST', body: { open: false } }
    );
    console.log(`✓ ${result.message}`);
  });

agents
  .command('connect-all')
  .description('Open all discovered agents on A2A and wire MCP where possible')
  .action(async () => {
    await ensureHubRunning();
    const result = await httpJson<{
      opened: string[];
      wired: Array<{ target: string }>;
    }>('/api/agents/connect-all', { method: 'POST', body: {} });
    console.log(
      `✓ Opened ${result.opened.length} on A2A, wired MCP for ${result.wired.length}`
    );
  });

agents
  .command('disconnect-all')
  .description('Close all agents on A2A network')
  .action(async () => {
    await ensureHubRunning();
    const result = await httpJson<{ closed: string[] }>(
      '/api/agents/disconnect-all',
      { method: 'POST', body: {} }
    );
    console.log(`✓ Closed ${result.closed.length} agents on A2A`);
  });

agents
  .command('add <id>')
  .description('Manually register an agent binary')
  .requiredOption('--command <path>', 'Command / binary path')
  .option('--name <name>', 'Display name')
  .action(async (id: string, options: { command: string; name?: string }) => {
    const configManager = createConfigManager();
    await configManager.load();
    await configManager.setAgent({
      id,
      name: options.name || id,
      command: options.command,
    });
    console.log(`✓ Agent "${id}" added.`);
    if (await isHubReachable()) {
      await httpJson('/api/agents/scan', { method: 'POST', body: {} });
    }
  });

agents
  .command('remove <id>')
  .description('Remove a manually configured agent')
  .action(async (id: string) => {
    const configManager = createConfigManager();
    await configManager.load();
    const removed = await configManager.removeAgent(id);
    console.log(removed ? `✓ Removed "${id}"` : `✗ "${id}" not found`);
  });

function printAgentTable(
  agentsList: Array<{
    id: string;
    name: string;
    presence: string;
    binaryPath?: string;
    online?: boolean;
    a2aOpen?: boolean;
    mcpWired?: boolean;
  }>
): void {
  if (!agentsList.length) {
    console.log('No agents discovered. Install Claude Code, Codex, Cursor, etc.');
    return;
  }
  console.log('\nLocal Agents\n');
  for (const a of agentsList) {
    const mark = a.a2aOpen
      ? '\x1b[32m●\x1b[0m'
      : a.presence === 'connected' || a.online
        ? '\x1b[32m●\x1b[0m'
        : a.presence === 'running'
          ? '\x1b[33m●\x1b[0m'
          : a.presence === 'installed'
            ? '\x1b[36m●\x1b[0m'
            : '○';
    const flags = [
      a.presence,
      a.a2aOpen ? 'a2a:open' : 'a2a:closed',
      a.mcpWired ? 'mcp' : null,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(`  ${mark} ${a.name} (${a.id})  [${flags}]`);
    if (a.binaryPath) console.log(`      ${a.binaryPath}`);
  }
  console.log('');
}

// =============================================================================
// Context
// =============================================================================
const context = program.command('context').description('Shared context hub');

context
  .command('list')
  .description('List memory entries')
  .option('--project <slug>', 'Filter by project')
  .action(async (options) => {
    await ensureHubRunning();
    const q = options.project
      ? `/api/context?project=${encodeURIComponent(options.project)}`
      : '/api/context';
    const data = await httpJson<{ memories: Array<Record<string, unknown>> }>(
      q
    );
    for (const m of data.memories) {
      console.log(`- [${m.kind}] ${m.title} (${m.id})`);
    }
  });

context
  .command('search <query>')
  .description('Search shared memories')
  .action(async (query: string) => {
    await ensureHubRunning();
    const data = await httpJson<{ memories: Array<Record<string, unknown>> }>(
      `/api/context?q=${encodeURIComponent(query)}`
    );
    console.log(JSON.stringify(data.memories, null, 2));
  });

context
  .command('upsert')
  .description('Create or update a memory')
  .requiredOption('--title <title>', 'Title')
  .requiredOption('--body <body>', 'Body')
  .option('--kind <kind>', 'fact|decision|preference|artifact|thread_summary', 'fact')
  .option('--scope <scope>', 'global|project|agent-private', 'global')
  .option('--project <slug>', 'Project slug')
  .action(async (options) => {
    await ensureHubRunning();
    const entry = await httpJson('/api/context', {
      method: 'POST',
      body: {
        kind: options.kind,
        title: options.title,
        body: options.body,
        scope: options.scope,
        project: options.project,
        tags: [],
      },
    });
    console.log('✓ Saved', (entry as { id: string }).id);
  });

context
  .command('import')
  .description('Import sessions from a local agent into the context hub')
  .requiredOption('--from <source>', 'claude|codex|cursor')
  .option('--project <slug>', 'Project scope')
  .option('--limit <n>', 'Max sessions', '20')
  .action(async (options) => {
    await ensureHubRunning();
    const result = await httpJson<{ imported: number; skipped: number }>(
      '/api/context/import',
      {
        method: 'POST',
        body: {
          from: options.from,
          project: options.project,
          limit: parseInt(options.limit, 10),
        },
      }
    );
    console.log(`✓ Imported ${result.imported} (skipped ${result.skipped})`);
  });

context
  .command('migrate')
  .description('Export a context package for another agent')
  .option('--to <agentId>', 'Target agent id')
  .option('--project <slug>', 'Project scope')
  .option('--out <file>', 'Write markdown to file')
  .action(async (options) => {
    await ensureHubRunning();
    const pkg = await httpJson<{ markdown: string; memories: unknown[] }>(
      '/api/context/migrate',
      {
        method: 'POST',
        body: { targetAgent: options.to, project: options.project },
      }
    );
    if (options.out) {
      fs.writeFileSync(options.out, pkg.markdown, 'utf-8');
      console.log(`✓ Wrote ${options.out} (${pkg.memories.length} memories)`);
    } else {
      console.log(pkg.markdown);
    }
  });

// =============================================================================
// Bus
// =============================================================================
const bus = program.command('bus').description('Local A2A message bus');

bus
  .command('peers')
  .description('List connected agents on the bus')
  .action(async () => {
    await ensureHub();
    const data = await httpJson<{ agents: Array<{ id: string; name: string }> }>(
      '/api/agents/connected'
    );
    if (!data.agents.length) {
      console.log('No agents connected. Register via WS or MCP.');
      return;
    }
    for (const a of data.agents) {
      console.log(`  ● ${a.name} (${a.id})`);
    }
  });

bus
  .command('send <to>')
  .description('Send a message to an agent (or * to broadcast)')
  .requiredOption('--message <text>', 'Message text')
  .option('--from <id>', 'Sender id', 'cli')
  .action(async (to: string, options) => {
    await ensureHub();
    const msg = await httpJson('/api/bus/send', {
      method: 'POST',
      body: {
        to,
        from: options.from,
        type: 'chat',
        payload: { text: options.message },
      },
    });
    console.log('✓ Sent', (msg as { id: string }).id);
  });

bus
  .command('listen')
  .description('Print recent bus messages')
  .action(async () => {
    await ensureHub();
    const data = await httpJson<{ messages: unknown[] }>('/api/bus/messages');
    console.log(JSON.stringify(data.messages, null, 2));
  });

// =============================================================================
// MCP
// =============================================================================
const mcpCmd = program.command('mcp').description('MCP helpers');
mcpCmd
  .command('install-config')
  .description('Print / write MCP config snippets for local agents')
  .option('--target <agent>', 'claude|cursor|codex|all', 'all')
  .option('--write', 'Write into agent config files when possible')
  .action(async (options) => {
    await ensureHubRunning();
    const snippet = await httpJson('/api/mcp/config').catch(() =>
      buildMcpSnippet()
    );
    console.log('\nMCP config snippet:\n');
    console.log(JSON.stringify(snippet, null, 2));
    console.log('');

    if (!options.write) {
      console.log('Pass --write to merge into Claude/Cursor config files.');
      console.log('Or: huinet agents connect claude-code');
      return;
    }

    const targets =
      options.target === 'all'
        ? ['claude', 'cursor', 'codex']
        : [options.target as string];

    for (const t of targets) {
      try {
        const result = await httpJson<{ message: string; file: string }>(
          '/api/mcp/wire',
          { method: 'POST', body: { target: t } }
        ).catch(() => wireMcpTarget(t));
        console.log(`✓ ${result.message} → ${result.file}`);
      } catch (err) {
        console.warn(`⚠ ${t}: ${(err as Error).message}`);
      }
    }
  });

mcpCmd
  .command('status')
  .description('Show which agents have HuiNet MCP wired')
  .action(async () => {
    const status = {
      claude: isMcpWired('claude'),
      cursor: isMcpWired('cursor'),
      codex: isMcpWired('codex'),
    };
    console.log('\nMCP wiring\n');
    for (const [k, v] of Object.entries(status)) {
      console.log(`  ${v ? '\x1b[32m●\x1b[0m' : '○'} ${k}`);
    }
    console.log('');
  });

// =============================================================================
// App
// =============================================================================
program
  .command('app')
  .description('Launch HuiNet as a desktop window (Electron)')
  .option('--browser', 'Open in system browser instead (debug)')
  .option('--quit', 'Quit the HuiNet desktop app (and optionally stop hub with --stop-hub)')
  .option('--stop-hub', 'Also stop the local hub when used with --quit')
  .action(async (options) => {
    const { spawn, execSync } = await import('child_process');
    const config = loadHubConfig();
    const url = `http://${config.host}:${config.httpPort}/`;

    if (options.quit) {
      const desktopDir = path.resolve(__dirname, '../../apps/desktop');
      const pidFile = path.join(
        process.env.HOME || process.env.USERPROFILE || '',
        '.huinet',
        'desktop.pid'
      );
      try {
        if (fs.existsSync(pidFile)) {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
          if (pid) {
            try {
              process.kill(pid, 'SIGTERM');
            } catch {
              // already gone
            }
          }
          fs.unlinkSync(pidFile);
        }
      } catch {
        // ignore
      }
      try {
        execSync(`pkill -f "${desktopDir}/node_modules/electron" || true`, {
          stdio: 'ignore',
        });
      } catch {
        // ignore
      }
      console.log('✓ HuiNet desktop quit signal sent');
      if (options.stopHub) {
        await stopHubDaemon();
      } else {
        console.log('  Hub still running. Stop with: huinet stop');
      }
      return;
    }

    if (options.browser) {
      await ensureHub();
      const open =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      spawn(open, [url], { detached: true, stdio: 'ignore' }).unref();
      console.log(`✓ Opened browser ${url}`);
      return;
    }

    const desktopDir = path.resolve(__dirname, '../../apps/desktop');
    const electronBin = path.join(
      desktopDir,
      'node_modules/.bin/electron' + (process.platform === 'win32' ? '.cmd' : '')
    );
    const mainJs = path.join(desktopDir, 'electron/main.cjs');

    if (!fs.existsSync(mainJs)) {
      console.error('Desktop shell missing. Expected apps/desktop/electron/main.cjs');
      process.exit(1);
    }
    if (!fs.existsSync(electronBin)) {
      console.error('Electron not installed. Run: npm install --prefix apps/desktop');
      process.exit(1);
    }

    // Ensure UI build exists
    const uiIndex = path.join(desktopDir, 'dist/index.html');
    if (!fs.existsSync(uiIndex)) {
      console.log('Building UI…');
      const build = spawn(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['run', 'build'],
        { cwd: desktopDir, stdio: 'inherit' }
      );
      await new Promise<void>((resolve, reject) => {
        build.on('exit', (code) =>
          code === 0 ? resolve() : reject(new Error('UI build failed'))
        );
      });
    }

    spawn(electronBin, ['.'], {
      cwd: desktopDir,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    }).unref();
    console.log('✓ Launched HuiNet desktop app');
  });

// =============================================================================
// Doctor
// =============================================================================
program
  .command('doctor')
  .description('Check HuiNet local hub health')
  .action(async () => {
    console.log('\nHuiNet System Check\n');
    const checks: { name: string; pass: boolean }[] = [];
    const nodeOk = parseInt(process.version.slice(1).split('.')[0], 10) >= 18;
    checks.push({ name: `Node.js ${process.version}`, pass: nodeOk });

    ensureHuiNetDirs();
    checks.push({
      name: 'Config directory ~/.huinet',
      pass: fs.existsSync(getHuiNetPaths().root),
    });

    let reachable = await isHubReachable();
    if (!reachable) {
      console.log('  Hub offline — attempting auto-start…');
      await ensureHubRunning({ quiet: true });
      reachable = await isHubReachable();
    }
    checks.push({ name: 'Hub HTTP reachable', pass: reachable });

    const scanner = createAgentScanner();
    const snap = await scanner.scan();
    checks.push({
      name: `Agents discovered: ${snap.agents.length}`,
      pass: snap.agents.length > 0,
    });
    checks.push({ name: 'MCP wired: Claude', pass: isMcpWired('claude') });
    checks.push({ name: 'MCP wired: Cursor', pass: isMcpWired('cursor') });
    checks.push({ name: 'MCP wired: Codex', pass: isMcpWired('codex') });

    for (const check of checks) {
      const icon = check.pass ? '✓' : '✗';
      const color = check.pass ? '\x1b[32m' : '\x1b[31m';
      console.log(`  ${color}${icon}\x1b[0m ${check.name}`);
    }
    console.log('');
  });

async function ensureHub(): Promise<void> {
  const ok = await ensureHubRunning();
  if (!ok) {
    console.error('Failed to start HuiNet hub.');
    process.exit(1);
  }
}

program.action(() => {
  program.outputHelp();
});

program.parse();
