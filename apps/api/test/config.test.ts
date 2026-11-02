import { describe, expect, it } from 'vitest';
import { EXAMPLE_AUTH_SECRET, loadConfig } from '../src/config';

const base = {
  DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/x',
  REDIS_URL: 'redis://:p@127.0.0.1:6379/0',
  BETTER_AUTH_SECRET: EXAMPLE_AUTH_SECRET,
  BETTER_AUTH_URL: 'http://localhost:3000',
};
const production = {
  ...base,
  NODE_ENV: 'production',
  BETTER_AUTH_SECRET: 'a'.repeat(44),
  BETTER_AUTH_URL: 'https://api.example.com',
};

describe('loadConfig', () => {
  it('applies safe defaults', () => {
    expect(loadConfig(base)).toMatchObject({
      env: 'development',
      host: '127.0.0.1',
      port: 3000,
      corsOrigins: [],
      rateLimit: { max: 300, windowMs: 60_000 },
      trustProxy: false,
      auth: { baseUrl: 'http://localhost:3000', rateLimit: true },
      mail: { transport: 'dev-file', devOutboxPath: '.data/dev-mailbox.jsonl' },
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

  it('requires an auth secret of at least 32 characters and an http(s) auth URL', () => {
    expect(() => loadConfig({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => loadConfig({ ...base, BETTER_AUTH_URL: 'ftp://x' })).toThrow(/BETTER_AUTH_URL/);
  });

  it('refuses unsafe auth and mail settings in production', () => {
    // No real mail provider exists before Part 2.10, so production cannot start yet: deliberate.
    const error = (() => {
      try {
        loadConfig({
          ...production,
          BETTER_AUTH_SECRET: EXAMPLE_AUTH_SECRET,
          BETTER_AUTH_URL: 'http://api.example.com',
          AUTH_RATE_LIMIT: 'false',
        });
      } catch (e) {
        return String(e);
      }
      return '';
    })();
    expect(error).toMatch(/BETTER_AUTH_SECRET: the example value/);
    expect(error).toMatch(/BETTER_AUTH_URL: must be https/);
    expect(error).toMatch(/MAIL_TRANSPORT/);
    expect(error).toMatch(/AUTH_RATE_LIMIT/);
  });
});
