import { ApiClientError, healthRoute, readyRoute, type ApiClient } from '@chronos/contracts';
import { useCallback, useEffect, useState } from 'react';

export type ApiStatus =
  | { state: 'loading' }
  | { state: 'online'; ready: boolean; database: 'up' | 'down'; redis: 'up' | 'down' }
  | { state: 'offline'; reason: string; requestId?: string };

/** Calls /health then /ready through the typed client and maps the outcome to a screen state. */
async function loadApiStatus(client: ApiClient, signal: AbortSignal): Promise<ApiStatus> {
  try {
    await client.call(healthRoute, {}, { signal });
    const ready = await client.call(readyRoute, {}, { signal });
    return {
      state: 'online',
      ready: ready.status === 200,
      database: ready.body.checks.database,
      redis: ready.body.checks.redis,
    };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return {
        state: 'offline',
        reason: `${error.code}: ${error.message}`,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      };
    }
    return { state: 'offline', reason: String(error) };
  }
}

/**
 * Live API status for the shell's Home screen. Temporary hand-rolled state until the data layer (Part 5.4)
 * brings caching and retries. Loading is set by the retry *event* (not inside the effect), and an
 * AbortController cancels the request when the screen goes away.
 */
export function useApiStatus(client: ApiClient): { status: ApiStatus; refresh: () => void } {
  const [status, setStatus] = useState<ApiStatus>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void loadApiStatus(client, controller.signal).then((next) => {
      if (!controller.signal.aborted) setStatus(next);
    });
    return () => {
      controller.abort();
    };
  }, [client, attempt]);

  const refresh = useCallback(() => {
    setStatus({ state: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { status, refresh };
}
