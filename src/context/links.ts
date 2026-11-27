/**
 * Wikilink-style memory association ([[Title]] or [[id]]).
 * 1-hop related = explicit links + same project/tag overlap.
 */

import type { MemoryEntry } from './types';

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

export function extractWikilinks(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(WIKILINK_RE)) {
    const raw = (m[1] || '').split('|')[0].trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

export function linksOf(entry: Pick<MemoryEntry, 'title' | 'body'>): string[] {
  return [
    ...extractWikilinks(entry.title || ''),
    ...extractWikilinks(entry.body || ''),
  ];
}

function resolveLink(
  ref: string,
  catalog: MemoryEntry[],
  selfId: string
): MemoryEntry | undefined {
  const lower = ref.toLowerCase();
  return (
    catalog.find((e) => e.id === ref && e.id !== selfId) ||
    catalog.find(
      (e) => e.id !== selfId && e.title.toLowerCase() === lower
    ) ||
    catalog.find(
      (e) =>
        e.id !== selfId && e.title.toLowerCase().includes(lower)
    )
  );
}

export type RelatedHit = {
  memory: MemoryEntry;
  via: 'link' | 'backlink' | 'project' | 'tag';
  score: number;
};

/** One-hop neighborhood around a memory (not a full GraphRAG engine). */
export function relatedMemories(
  seed: MemoryEntry,
  catalog: MemoryEntry[],
  limit = 12
): RelatedHit[] {
  const scores = new Map<string, RelatedHit>();
  const bump = (m: MemoryEntry, via: RelatedHit['via'], score: number) => {
    if (m.id === seed.id) return;
    const prev = scores.get(m.id);
    if (!prev || score > prev.score) {
      scores.set(m.id, { memory: m, via, score });
    }
  };

  for (const ref of linksOf(seed)) {
    const hit = resolveLink(ref, catalog, seed.id);
    if (hit) bump(hit, 'link', 100);
  }

  for (const other of catalog) {
    if (other.id === seed.id) continue;
    for (const ref of linksOf(other)) {
      const hit = resolveLink(ref, [seed], other.id);
      if (hit) bump(other, 'backlink', 90);
    }
  }

  if (seed.project) {
    for (const other of catalog) {
      if (other.project === seed.project) bump(other, 'project', 40);
    }
  }

  const seedTags = new Set((seed.tags || []).map((t) => t.toLowerCase()));
  if (seedTags.size) {
    for (const other of catalog) {
      const overlap = (other.tags || []).filter((t) =>
        seedTags.has(t.toLowerCase())
      ).length;
      if (overlap) bump(other, 'tag', 20 + overlap * 5);
    }
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
