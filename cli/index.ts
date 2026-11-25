#!/usr/bin/env node
/**
 * HuiNet CLI — Local Agent Fabric
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createConfigManager } from './config/agent-config';
import {
  httpJson,
  isHubReachable,
  printHubStatus,
  runHubForeground,
  startHubDaemon,
  stopHubDaemon,
} from './hub/lifecycle';
import { createAgentScanner } from '../src/inventory';
import { createContextStore, importSessions } from '../src/context';
import { loadHubConfig, getHuiNetPaths, ensureHuiNetDirs } from '../src/paths';

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
    if (await isHubReachable()) {
      const snap = await httpJson<{
        agents: Array<{ id: string; name: string; presence: string; binaryPath?: string }>;
      }>('/api/agents/scan', { method: 'POST', body: {} });
      printAgentTable(snap.agents);
      return;
    }
    const scanner = createAgentScanner();
    const snap = await scanner.scan();
    printAgentTable(snap.agents);
  });

agents
  .command('list')
  .description('List discovered agents')
  .action(async () => {
    if (await isHubReachable()) {
      const data = await httpJson<{ agents: Array<Record<string, unknown>> }>(
        '/api/agents'
      );
      printAgentTable(data.agents as never);
      return;
    }
    const scanner = createAgentScanner();
    const cached = scanner.loadCached() || (await scanner.scan());
    printAgentTable(cached.agents);
  });

agents
  .command('show <id>')
  .description('Show details for one agent')
  .action(async (id: string) => {
    if (await isHubReachable()) {
      try {
        const agent = await httpJson<Record<string, unknown>>(
          `/api/agents/${encodeURIComponent(id)}`
        );
        console.log(JSON.stringify(agent, null, 2));
        return;
      } catch {
        console.error(`Agent "${id}" not found.`);
        process.exit(1);
      }
    }
    const scanner = createAgentScanner();
    await scanner.scan();
    const agent = scanner.getAgent(id);
    if (!agent) {
      console.error(`Agent "${id}" not found. Run: huinet agents scan`);
      process.exit(1);
    }
    console.log(JSON.stringify(agent, null, 2));
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
  }>
): void {
  if (!agentsList.length) {
    console.log('No agents discovered. Install Claude Code, Codex, Cursor, etc.');
    return;
  }
  console.log('\nLocal Agents\n');
  for (const a of agentsList) {
    const mark =
      a.presence === 'connected' || a.online
        ? '\x1b[32m●\x1b[0m'
        : a.presence === 'running'
          ? '\x1b[33m●\x1b[0m'
          : a.presence === 'installed'
            ? '\x1b[36m●\x1b[0m'
            : '○';
    console.log(`  ${mark} ${a.name} (${a.id})  [${a.presence}]`);
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
    if (await isHubReachable()) {
      const q = options.project
        ? `/api/context?project=${encodeURIComponent(options.project)}`
        : '/api/context';
      const data = await httpJson<{ memories: Array<Record<string, unknown>> }>(
        q
      );
      for (const m of data.memories) {
        console.log(`- [${m.kind}] ${m.title} (${m.id})`);
      }
      return;
    }
    const store = createContextStore();
    for (const m of store.list({ project: options.project, limit: 50 })) {
      console.log(`- [${m.kind}] ${m.title} (${m.id})`);
    }
  });

context
  .command('search <query>')
  .description('Search shared memories')
  .action(async (query: string) => {
    if (await isHubReachable()) {
      const data = await httpJson<{ memories: Array<Record<string, unknown>> }>(
        `/api/context?q=${encodeURIComponent(query)}`
      );
      console.log(JSON.stringify(data.memories, null, 2));
      return;
    }
    console.log(JSON.stringify(createContextStore().search(query), null, 2));
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
    const payload = {
      kind: options.kind,
      title: options.title,
      body: options.body,
      scope: options.scope,
      project: options.project,
      tags: [],
    };
    if (await isHubReachable()) {
      const entry = await httpJson('/api/context', {
        method: 'POST',
        body: payload,
      });
      console.log('✓ Saved', (entry as { id: string }).id);
      return;
    }
    const entry = createContextStore().upsert(payload as never);
    console.log('✓ Saved', entry.id);
  });

context
  .command('import')
  .description('Import sessions from a local agent into the context hub')
  .requiredOption('--from <source>', 'claude|codex|cursor')
  .option('--project <slug>', 'Project scope')
  .option('--limit <n>', 'Max sessions', '20')
  .action(async (options) => {
    const from = options.from as 'claude' | 'codex' | 'cursor';
    if (await isHubReachable()) {
      const result = await httpJson<{ imported: number; skipped: number }>(
        '/api/context/import',
        {
          method: 'POST',
          body: {
            from,
            project: options.project,
            limit: parseInt(options.limit, 10),
          },
        }
      );
      console.log(`✓ Imported ${result.imported} (skipped ${result.skipped})`);
      return;
    }
    const result = await importSessions({
      from,
      project: options.project,
      limit: parseInt(options.limit, 10),
    });
    console.log(`✓ Imported ${result.imported} (skipped ${result.skipped})`);
  });

context
  .command('migrate')
  .description('Export a context package for another agent')
  .option('--to <agentId>', 'Target agent id')
  .option('--project <slug>', 'Project scope')
  .option('--out <file>', 'Write markdown to file')
  .action(async (options) => {
    let pkg: { markdown: string; memories: unknown[] };
    if (await isHubReachable()) {
      pkg = await httpJson('/api/context/migrate', {
        method: 'POST',
        body: { targetAgent: options.to, project: options.project },
      });
    } else {
      pkg = createContextStore().migrate({
        targetAgent: options.to,
        project: options.project,
      });
    }
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
    const snippet = await getMcpSnippet();
    console.log('\nMCP config snippet:\n');
    console.log(JSON.stringify(snippet, null, 2));
    console.log('');

    if (!options.write) {
      console.log('Pass --write to merge into Claude/Cursor config files.');
      return;
    }

    const targets =
      options.target === 'all'
        ? ['claude', 'cursor', 'codex']
        : [options.target as string];

    for (const t of targets) {
      try {
        await writeMcpConfig(t, snippet);
        console.log(`✓ Wrote MCP config for ${t}`);
      } catch (err) {
        console.warn(`⚠ ${t}: ${(err as Error).message}`);
      }
    }
  });

async function getMcpSnippet(): Promise<Record<string, unknown>> {
  if (await isHubReachable()) {
    return httpJson('/api/mcp/config');
  }
  const config = loadHubConfig();
  const script = path.resolve(__dirname, '../mcp/server.js');
  const alt = path.resolve(process.cwd(), 'dist/mcp/server.js');
  const serverPath = fs.existsSync(script) ? script : alt;
  return {
    mcpServers: {
      huinet: {
        command: 'node',
        args: [serverPath],
        env: {
          HUINET_HTTP: `http://${config.host}:${config.httpPort}`,
        },
      },
    },
  };
}

async function writeMcpConfig(
  target: string,
  snippet: Record<string, unknown>
): Promise<void> {
  const home = os.homedir();
  const huinetServer = (snippet as { mcpServers: { huinet: unknown } })
    .mcpServers.huinet;

  if (target === 'claude') {
    const file = path.join(home, '.claude.json');
    let data: Record<string, unknown> = {};
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    const mcp = (data.mcpServers as Record<string, unknown>) || {};
    mcp.huinet = huinetServer;
    data.mcpServers = mcp;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return;
  }

  if (target === 'cursor') {
    const file = path.join(home, '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let data: Record<string, unknown> = {};
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    const mcp = (data.mcpServers as Record<string, unknown>) || {};
    mcp.huinet = huinetServer;
    data.mcpServers = mcp;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return;
  }

  if (target === 'codex') {
    const file = path.join(home, '.codex', 'config.toml');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const block = `\n# HuiNet MCP\n[mcp_servers.huinet]\ncommand = "node"\nargs = ${JSON.stringify(
      (huinetServer as { args: string[] }).args
    )}\n`;
    fs.appendFileSync(file, block, 'utf-8');
    return;
  }

  throw new Error(`Unknown target ${target}`);
}

// =============================================================================
// App
// =============================================================================
program
  .command('app')
  .description('Open the HuiNet desktop UI')
  .action(async () => {
    await ensureHub();
    const config = loadHubConfig();
    const url = `http://${config.host}:${config.httpPort}/`;
    const tauriBin = path.join(
      process.cwd(),
      'apps/desktop/src-tauri/target/release/huinet-desktop'
    );
    const open =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'start'
          : 'xdg-open';

    if (fs.existsSync(tauriBin)) {
      const { spawn } = await import('child_process');
      spawn(tauriBin, [], { detached: true, stdio: 'ignore' }).unref();
      console.log('✓ Launched HuiNet desktop app');
      return;
    }

    const { spawn } = await import('child_process');
    spawn(open, [url], { detached: true, stdio: 'ignore' }).unref();
    console.log(`✓ Opened ${url}`);
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

    const reachable = await isHubReachable();
    checks.push({ name: 'Hub HTTP reachable', pass: reachable });

    const scanner = createAgentScanner();
    const snap = await scanner.scan();
    checks.push({
      name: `Agents discovered: ${snap.agents.length}`,
      pass: snap.agents.length > 0,
    });

    for (const check of checks) {
      const icon = check.pass ? '✓' : '✗';
      const color = check.pass ? '\x1b[32m' : '\x1b[31m';
      console.log(`  ${color}${icon}\x1b[0m ${check.name}`);
    }
    console.log('');
  });

async function ensureHub(): Promise<void> {
  if (await isHubReachable()) return;
  console.error('Hub is not running. Start it with: huinet start');
  process.exit(1);
}

program.action(() => {
  program.outputHelp();
});

program.parse();
