import { agentIdToMcpTarget, buildMcpSnippet } from '../install';

describe('mcp install helpers', () => {
  it('maps agent ids to mcp targets', () => {
    expect(agentIdToMcpTarget('claude-code')).toBe('claude');
    expect(agentIdToMcpTarget('cursor')).toBe('cursor');
    expect(agentIdToMcpTarget('codex')).toBe('codex');
    expect(agentIdToMcpTarget('openclaw')).toBeNull();
    expect(
      agentIdToMcpTarget('cursor:session:202a290f-4064-4c18-b36a-8adfa9b789a5')
    ).toBe('cursor');
    expect(
      agentIdToMcpTarget(
        'claude-code:session:21c4e6b5-2236-4bed-ae8f-1bfe2879a730'
      )
    ).toBe('claude');
  });

  it('builds mcp snippet with huinet server', () => {
    const snippet = buildMcpSnippet('tok');
    expect(snippet.mcpServers.huinet.command).toBeTruthy();
    expect(snippet.mcpServers.huinet.args.length).toBeGreaterThan(0);
    expect(snippet.mcpServers.huinet.env?.HUINET_TOKEN).toBe('tok');
  });
});
