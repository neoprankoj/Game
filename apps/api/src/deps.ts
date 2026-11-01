// Composition root for infrastructure (SYSTEM_ARCHITECTURE §3.2: apps import @chronos/db only here and in main.ts).
import { createDatabase } from '@chronos/db';
import { Redis } from 'ioredis';

/** What the HTTP layer needs from infrastructure, as small interfaces (tests inject fakes or real ones). */
export interface ApiDependencies {
  database: { ping(): Promise<void> };
  redis: { ping(): Promise<void> };
  close(): Promise<void>;
}

export interface DependencyEvents {
  /** Infrastructure noise worth a log line but not a crash (dropped idle DB connection, Redis reconnects). */
  onWarning?: (source: 'database' | 'redis', error: Error) => void;
}

export function createDependencies(
  config: { databaseUrl: string; redisUrl: string },
  events: DependencyEvents = {},
): ApiDependencies {
  const database = createDatabase({
    url: config.databaseUrl,
    applicationName: 'chronos-api',
    onIdleClientError: (error) => events.onWarning?.('database', error),
  });
  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    // A ping issued while the connection is still being established waits for it (offline queue) instead of
    // failing; a dead Redis still fails fast (one retry) and /ready's 1 s probe timeout bounds the wait.
    // Found by test/ready.test.ts: with the offline queue disabled, /ready reported "down" right after startup.
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
  });
  // Without a listener ioredis raises unhandled 'error' events while Redis is down; /ready reports the state.
  redis.on('error', (error) => events.onWarning?.('redis', error));
  void redis.connect().catch(() => undefined);
  return {
    database: { ping: () => database.ping() },
    redis: {
      ping: async () => {
        await redis.ping(); // resolves 'PONG' or rejects
      },
    },
    close: async () => {
      redis.disconnect();
      await database.close();
    },
  };
}
