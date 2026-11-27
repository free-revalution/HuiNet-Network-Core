/**
 * Write HuiNet MCP server config into local agent configs
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadHubConfig, getHuiNetPaths } from '../paths';

export type McpWireTarget = 'claude' | 'cursor' | 'codex' | 'claude-code';

export interface McpServerSpec {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpWireResult {
  target: string;
  file: string;
  ok: boolean;
  already?: boolean;
  message: string;
}

export function resolveMcpServerScript(): string {
  const candidates = [
    path.resolve(__dirname, 'server.js'),
    path.resolve(process.cwd(), 'dist/src/mcp/server.js'),
    path.resolve(process.cwd(), 'dist/mcp/server.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export function buildMcpServerSpec(token?: string): McpServerSpec {
  const config = loadHubConfig();
  const paths = getHuiNetPaths();
  let tok = token;
  if (!tok) {
    try {
      tok = fs.readFileSync(paths.tokenFile, 'utf-8').trim();
    } catch {
      tok = undefined;
    }
  }
  const env: Record<string, string> = {
    HUINET_HTTP: `http://${config.host}:${config.httpPort}`,
  };
  if (tok) env.HUINET_TOKEN = tok;

  return {
    command: process.execPath,
    args: [resolveMcpServerScript()],
    env,
  };
}

export function buildMcpSnippet(token?: string): {
  mcpServers: { huinet: McpServerSpec };
} {
  return { mcpServers: { huinet: buildMcpServerSpec(token) } };
}

function normalizeTarget(target: string): 'claude' | 'cursor' | 'codex' {
  if (target === 'claude-code' || target === 'claude') return 'claude';
  if (target === 'cursor') return 'cursor';
  if (target === 'codex') return 'codex';
  throw new Error(
    `Unsupported MCP target "${target}". Use claude, cursor, or codex.`
  );
}

export function isMcpWired(target: string): boolean {
  try {
    const t = normalizeTarget(target);
    const home = os.homedir();
    if (t === 'claude') {
      const file = path.join(home, '.claude.json');
      if (!fs.existsSync(file)) return false;
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return Boolean(data?.mcpServers?.huinet);
    }
    if (t === 'cursor') {
      const file = path.join(home, '.cursor', 'mcp.json');
      if (!fs.existsSync(file)) return false;
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return Boolean(data?.mcpServers?.huinet);
    }
    if (t === 'codex') {
      const file = path.join(home, '.codex', 'config.toml');
      if (!fs.existsSync(file)) return false;
      const text = fs.readFileSync(file, 'utf-8');
      return /\[mcp_servers\.huinet\]/.test(text);
    }
  } catch {
    return false;
  }
  return false;
}

export function wireMcpTarget(
  target: string,
  spec?: McpServerSpec
): McpWireResult {
  const t = normalizeTarget(target);
  const server = spec ?? buildMcpServerSpec();
  const home = os.homedir();

  if (t === 'claude') {
    const file = path.join(home, '.claude.json');
    let data: Record<string, unknown> = {};
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    const already = Boolean(
      (data.mcpServers as Record<string, unknown> | undefined)?.huinet
    );
    const mcp = (data.mcpServers as Record<string, unknown>) || {};
    mcp.huinet = server;
    data.mcpServers = mcp;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return {
      target: t,
      file,
      ok: true,
      already,
      message: already ? 'Updated existing huinet MCP entry' : 'Installed huinet MCP',
    };
  }

  if (t === 'cursor') {
    const file = path.join(home, '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let data: Record<string, unknown> = {};
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    const already = Boolean(
      (data.mcpServers as Record<string, unknown> | undefined)?.huinet
    );
    const mcp = (data.mcpServers as Record<string, unknown>) || {};
    mcp.huinet = server;
    data.mcpServers = mcp;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return {
      target: t,
      file,
      ok: true,
      already,
      message: already ? 'Updated existing huinet MCP entry' : 'Installed huinet MCP',
    };
  }

  // codex — rewrite block idempotently
  const file = path.join(home, '.codex', 'config.toml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  const already = /\[mcp_servers\.huinet\]/.test(text);
  const envLines = Object.entries(server.env || {})
    .map(([k, v]) => `  ${k} = "${v.replace(/"/g, '\\"')}"`)
    .join('\n');
  const block = [
    '',
    '# HuiNet MCP (managed by huinet mcp install-config)',
    '[mcp_servers.huinet]',
    `command = "${server.command}"`,
    `args = ${JSON.stringify(server.args)}`,
    envLines ? `[mcp_servers.huinet.env]\n${envLines}` : '',
    '',
  ]
    .filter((l) => l !== undefined)
    .join('\n');

  if (already) {
    text = text.replace(
      /\n?# HuiNet MCP[\s\S]*?(?=\n\[|\n*$)/,
      '\n' + block.trim() + '\n'
    );
    if (!/\[mcp_servers\.huinet\]/.test(text)) {
      // fallback append if replace missed
      text = text.replace(
        /\[mcp_servers\.huinet\][\s\S]*?(?=\n\[|$)/,
        block.trim() + '\n'
      );
    }
  } else {
    text = text.trimEnd() + '\n' + block;
  }
  fs.writeFileSync(file, text, 'utf-8');
  return {
    target: t,
    file,
    ok: true,
    already,
    message: already ? 'Updated existing huinet MCP entry' : 'Installed huinet MCP',
  };
}

export function wireMcpTargets(
  targets: string[],
  spec?: McpServerSpec
): McpWireResult[] {
  return targets.map((t) => wireMcpTarget(t, spec));
}

/** Map runtime or session node ids onto MCP install targets. */
export function agentIdToMcpTarget(agentId: string): string | null {
  const runtime =
    agentId.match(/^([a-z0-9-]+):session:/i)?.[1] ?? agentId;
  if (runtime === 'claude-code' || runtime === 'claude') return 'claude';
  if (runtime === 'cursor') return 'cursor';
  if (runtime === 'codex') return 'codex';
  return null;
}
