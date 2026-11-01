import { describe, expect, it } from 'vitest';
import { readClientConfig } from './config';

describe('readClientConfig', () => {
  it('accepts an http(s) API URL and strips a trailing slash', () => {
    expect(readClientConfig({ EXPO_PUBLIC_API_URL: 'https://api.example.com/' })).toEqual({
      ok: true,
      config: { apiUrl: 'https://api.example.com' },
    });
  });

  it.each([{}, { EXPO_PUBLIC_API_URL: 'ftp://x' }, { EXPO_PUBLIC_API_URL: 'not a url' }])(
    'reports a readable problem for %j (shown on screen instead of crashing)',
    (env) => {
      const result = readClientConfig(env);
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.problem).toMatch(/EXPO_PUBLIC_API_URL/);
    },
  );
});
