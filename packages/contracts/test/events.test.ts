import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineEvent, events } from '../src';

const catalogInDomains = (): Set<string> => {
  const text = readFileSync(
    fileURLToPath(new URL('../../../docs/architecture/DOMAINS.md', import.meta.url)),
    'utf8',
  );
  const section = text.slice(text.indexOf('## Event catalog'));
  return new Set([...section.matchAll(/^\| `([a-z_]+\.[a-z_]+)` \|/gm)].map((m) => m[1] ?? ''));
};

describe('event envelope', () => {
  const built = defineEvent('construction.completed', z.object({ cityId: z.uuid(), level: z.int() }));

  it('parses a wire envelope and decodes occurredAt to epoch ms', () => {
    const parsed = built.envelope.parse({
      id: '018f0000-0000-7000-8000-00000000000a',
      type: 'construction.completed',
      seq: 42,
      occurredAt: '2026-11-01T10:00:00.000Z',
      payload: { cityId: '018f0000-0000-7000-8000-00000000000b', level: 2 },
    });
    expect(parsed.occurredAt).toBe(Date.UTC(2026, 10, 1, 10));
  });

  it('accepts seq = null (ephemeral notification) but not 0', () => {
    const e = {
      id: '018f0000-0000-7000-8000-00000000000a',
      type: 'construction.completed',
      occurredAt: '2026-11-01T10:00:00.000Z',
      payload: { cityId: '018f0000-0000-7000-8000-00000000000b', level: 2 },
    };
    expect(built.envelope.safeParse({ ...e, seq: null }).success).toBe(true);
    expect(built.envelope.safeParse({ ...e, seq: 0 }).success).toBe(false);
  });

  it('rejects event names that are not <domain>.<past_tense>', () => {
    expect(() => defineEvent('ConstructionCompleted', z.object({}))).toThrow();
  });

  it('every event in the contracts catalog exists in the DOMAINS.md catalog', () => {
    const domains = catalogInDomains();
    expect(domains.size).toBe(61); // parser sanity check against Part 1.5
    expect(events.map((e) => e.type).filter((t) => !domains.has(t))).toEqual([]);
  });
});
