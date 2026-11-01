import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AmountString, BigIntString, InstantString, Uuid } from '../src';

describe('BigIntString / AmountString (bigint on the wire as decimal strings)', () => {
  it('round-trips values beyond 2^53 exactly', () => {
    const v = 2n ** 63n - 1n;
    expect(z.encode(BigIntString, v)).toBe('9223372036854775807');
    expect(z.decode(BigIntString, '9223372036854775807')).toBe(v);
    expect(z.decode(BigIntString, '-42')).toBe(-42n);
  });

  it.each(['1.5', '1e3', '+1', '01', ' 1', '', '0x10'])('rejects %j', (wire) => {
    expect(BigIntString.safeParse(wire).success).toBe(false);
  });

  it('AmountString rejects negatives but accepts zero', () => {
    expect(AmountString.safeParse('-1').success).toBe(false);
    expect(z.decode(AmountString, '0')).toBe(0n);
  });
});

describe('InstantString (UTC ISO-8601 with milliseconds ↔ epoch ms)', () => {
  it('decodes to integer epoch milliseconds and encodes back identically', () => {
    const wire = '2026-11-01T10:00:00.123Z';
    const ms = z.decode(InstantString, wire);
    expect(ms).toBe(Date.UTC(2026, 10, 1, 10, 0, 0, 123));
    expect(z.encode(InstantString, ms)).toBe(wire);
  });

  it.each([
    '2026-11-01T10:00:00Z',
    '2026-11-01T10:00:00.000+02:00',
    '2026-11-01 10:00:00.000Z',
    '2026-13-01T10:00:00.000Z',
  ])('rejects %j (must be UTC with exactly 3 fractional digits)', (wire) => {
    expect(InstantString.safeParse(wire).success).toBe(false);
  });
});

describe('Uuid', () => {
  it('accepts a UUIDv7 and rejects garbage', () => {
    expect(Uuid.safeParse('018f0000-0000-7000-8000-00000000000a').success).toBe(true);
    expect(Uuid.safeParse('not-a-uuid').success).toBe(false);
  });
});
