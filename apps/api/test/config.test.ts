import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const base = { DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/x', REDIS_URL: 'redis://:p@127.0.0.1:6379/0' };

describe('loadConfig', () => {
  it('applies safe defaults', () => {
    expect(loadConfig(base)).toMatchObject({
      env: 'development',
      host: '127.0.0.1',
      port: 3000,
      corsOrigins: [],
      rateLimit: { max: 300, windowMs: 60_000 },
      trustProxy: false,
    });
  });

  it('uses the platform PORT unless API_PORT is set, and parses lists and booleans', () => {
    expect(loadConfig({ ...base, PORT: '8080' }).port).toBe(8080);
    expect(loadConfig({ ...base, PORT: '8080', API_PORT: '9000' }).port).toBe(9000);
    const c = loadConfig({
      ...base,
      CORS_ORIGINS: 'https://a.example, https://b.example',
      TRUST_PROXY: 'true',
    });
    expect(c.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(c.trustProxy).toBe(true);
  });

  it('fails fast listing every problem', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://x', NODE_ENV: 'staging' })).toThrow(
      /DATABASE_URL[\s\S]*REDIS_URL|NODE_ENV[\s\S]*DATABASE_URL/,
    );
  });
});
