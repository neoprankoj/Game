import { describe, expect, it } from 'vitest';
import { readDatabaseUrl } from '../src';
import { assertSeedAllowed } from '../src/seed';

describe('readDatabaseUrl', () => {
  it('returns a valid postgres URL', () => {
    expect(readDatabaseUrl('DATABASE_URL', { DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/x' })).toBe(
      'postgres://u:p@127.0.0.1:5432/x',
    );
  });

  it.each([{}, { DATABASE_URL: 'mysql://x' }, { DATABASE_URL: '' }])(
    'rejects %j with a helpful message',
    (env) => {
      expect(() => readDatabaseUrl('DATABASE_URL', env)).toThrow(/DATABASE_URL .*\.env\.example/);
    },
  );
});

describe('assertSeedAllowed (dev-only seeding)', () => {
  const local = 'postgres://u:p@127.0.0.1:55432/chronos';
  it('allows NODE_ENV=development on a local database', () => {
    expect(() => {
      assertSeedAllowed({ NODE_ENV: 'development' }, local);
    }).not.toThrow();
  });

  it.each([{ NODE_ENV: 'production' }, { NODE_ENV: 'test' }, {}])('refuses %j', (env) => {
    expect(() => {
      assertSeedAllowed(env, local);
    }).toThrow(/Refusing to seed/);
  });

  it('refuses a remote database even in development', () => {
    expect(() => {
      assertSeedAllowed({ NODE_ENV: 'development' }, 'postgres://u:p@db.neon.example:5432/chronos');
    }).toThrow(/not local/);
  });
});
