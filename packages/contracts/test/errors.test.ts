import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ErrorResponse, errorStatus, type ErrorCode } from '../src';

/** Error codes promised by DOMAINS.md "Failure handling" fields (incl. continuation lines). */
function codesInDomains(): Set<string> {
  const text = readFileSync(
    fileURLToPath(new URL('../../../docs/architecture/DOMAINS.md', import.meta.url)),
    'utf8',
  );
  const codes = new Set<string>();
  let inField = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('- **')) inField = line.startsWith('- **Failure handling:**');
    else if (!line.startsWith('  ')) inField = false;
    if (inField) for (const m of line.matchAll(/`([A-Z][A-Z_]{3,})`/g)) if (m[1]) codes.add(m[1]);
  }
  return codes;
}

describe('error catalog', () => {
  it('contains every error code that DOMAINS.md promises', () => {
    const promised = codesInDomains();
    expect(promised.size).toBeGreaterThan(10); // the parser found the fields
    expect([...promised].filter((c) => !(c in ERROR_CODES))).toEqual([]);
  });

  it('maps every code to a 4xx/5xx status', () => {
    for (const code of Object.keys(ERROR_CODES) as ErrorCode[]) {
      expect(errorStatus(code)).toBeGreaterThanOrEqual(400);
      expect(errorStatus(code)).toBeLessThan(600);
    }
  });

  it('accepts the standard error shape and rejects unknown codes', () => {
    const ok = {
      error: {
        code: 'INSUFFICIENT_RESOURCES',
        message: 'Not enough ore',
        details: { ore: '120' },
        requestId: 'r1',
      },
    };
    expect(ErrorResponse.safeParse(ok).success).toBe(true);
    expect(ErrorResponse.safeParse({ error: { ...ok.error, code: 'MADE_UP' } }).success).toBe(false);
    expect(ErrorResponse.safeParse({ error: { code: 'NOT_FOUND', message: 'x' } }).success).toBe(false); // requestId required
  });
});
