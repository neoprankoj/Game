import { useCallback, useState } from 'react';
import type { ClientErrorCode } from '@chronos/contracts';
import { messageFor } from './errors';

/** One form submission at a time, with its error message. Returns whether the action succeeded. */
export function useSubmit(): {
  pending: boolean;
  error: string | null;
  run: (action: () => Promise<ClientErrorCode | null>) => Promise<boolean>;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<ClientErrorCode | null>) => {
    setPending(true);
    setError(null);
    try {
      const code = await action();
      if (code) setError(messageFor(code));
      return code === null;
    } catch {
      setError(messageFor('NETWORK_ERROR'));
      return false;
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, error, run };
}
