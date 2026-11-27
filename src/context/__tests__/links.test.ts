import { extractWikilinks, relatedMemories } from '../links';
import type { MemoryEntry } from '../types';

function mem(
  partial: Partial<MemoryEntry> & Pick<MemoryEntry, 'id' | 'title' | 'body'>
): MemoryEntry {
  return {
    kind: 'fact',
    scope: 'global',
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

describe('memory links', () => {
  it('extracts wikilinks', () => {
    expect(extractWikilinks('See [[Alpha]] and [[Beta|display]]')).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('finds 1-hop related via link and project', () => {
    const a = mem({
      id: 'a',
      title: 'Root',
      body: 'Depends on [[Child Decision]]',
      project: 'HuiNet',
      tags: ['fabric'],
    });
    const b = mem({
      id: 'b',
      title: 'Child Decision',
      body: 'Detail',
      project: 'HuiNet',
      kind: 'decision',
    });
    const c = mem({
      id: 'c',
      title: 'Other',
      body: 'Mentions [[Root]]',
      project: 'Else',
    });
    const hits = relatedMemories(a, [a, b, c]);
    expect(hits.find((h) => h.memory.id === 'b')?.via).toBe('link');
    expect(hits.find((h) => h.memory.id === 'c')?.via).toBe('backlink');
  });
});
