import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PAGE_LIMIT_DEFAULT, PageQuery, page } from '../src';

describe('cursor pagination', () => {
  it('defaults the limit and coerces query-string numbers', () => {
    expect(PageQuery.parse({})).toEqual({ limit: PAGE_LIMIT_DEFAULT });
    expect(PageQuery.parse({ limit: '50', cursor: 'abc' })).toEqual({ limit: 50, cursor: 'abc' });
  });

  it.each([{ limit: '0' }, { limit: '101' }, { limit: '2.5' }, { cursor: '' }])('rejects %j', (q) => {
    expect(PageQuery.safeParse(q).success).toBe(false);
  });

  it('builds a page shape with a nullable next cursor', () => {
    const P = page(z.object({ id: z.string() }));
    expect(P.parse({ items: [{ id: 'a' }], nextCursor: null }).nextCursor).toBeNull();
  });
});
