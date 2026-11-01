import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({ REDIS_URL: 'redis://:p@127.0.0.1:6379/0' })).toMatchObject({
      QUEUE_PREFIX: 'chronos',
      WORKER_CONCURRENCY: 5,
      RECONCILER_INTERVAL_MS: 30_000,
      WORKER_SHUTDOWN_TIMEOUT_MS: 30_000,
    });
  });

  it('rejects invalid values with every problem listed', () => {
    expect(() => loadConfig({ REDIS_URL: 'http://x', RECONCILER_INTERVAL_MS: '10' })).toThrow(
      /REDIS_URL[\s\S]*RECONCILER_INTERVAL_MS/,
    );
  });
});
