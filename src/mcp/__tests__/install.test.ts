import { agentIdToMcpTarget, buildMcpSnippet } from '../install';

describe('mcp install helpers', () => {
  it('maps agent ids to mcp targets', () => {
    expect(agentIdToMcpTarget('claude-code')).toBe('claude');
    expect(agentIdToMcpTarget('cursor')).toBe('cursor');
    expect(agentIdToMcpTarget('codex')).toBe('codex');
    expect(agentIdToMcpTarget('openclaw')).toBeNull();
  });

  it('builds mcp snippet with huinet server', () => {
    const snippet = buildMcpSnippet('tok');
    expect(snippet.mcpServers.huinet.command).toBeTruthy();
    expect(snippet.mcpServers.huinet.args.length).toBeGreaterThan(0);
    expect(snippet.mcpServers.huinet.env?.HUINET_TOKEN).toBe('tok');
  });
});
