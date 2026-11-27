import { buildFabricCanvas } from '../json-canvas';

describe('json canvas export', () => {
  it('builds nodes and peer edges', () => {
    const canvas = buildFabricCanvas({
      agents: [
        {
          id: 'cursor:session:aaa',
          name: 'Cursor: hello',
          kind: 'session',
          title: 'hello',
          parentId: 'cursor',
          a2aOpen: true,
        },
        {
          id: 'claude-code:session:bbb',
          name: 'Claude: world',
          kind: 'session',
          title: 'world',
          parentId: 'claude-code',
          a2aOpen: true,
        },
      ],
      messages: [
        {
          id: 'm1',
          from: 'cursor:session:aaa',
          to: 'claude-code:session:bbb',
          type: 'chat',
          payload: { text: 'hi' },
          tokens: 12,
          timestamp: Date.now(),
        },
      ],
    });
    expect(canvas.nodes).toHaveLength(2);
    expect(canvas.edges).toHaveLength(1);
    expect(canvas.meta.format).toBe('jsoncanvas');
    expect(canvas.markdown).toMatch(/Fabric Canvas/);
  });
});
