import { accountRoute, type ApiClient, type ClientErrorCode } from '@chronos/contracts';
import { useEffect, useState } from 'react';
import { codeOfApiError } from './errors';

export type AccountState =
  | { state: 'loading' }
  | { state: 'ready'; email: string; role: 'player' | 'admin' }
  | { state: 'error'; code: ClientErrorCode };

/** GET /account through the typed client (a protected contract route). Data layer proper: Part 5.4. */
export function useAccount(client: ApiClient): AccountState {
  const [account, setAccount] = useState<AccountState>({ state: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    void client
      .call(accountRoute, {}, { signal: controller.signal })
      .then(
        (res): AccountState => ({ state: 'ready', email: res.body.email, role: res.body.role }),
        (error: unknown): AccountState => ({ state: 'error', code: codeOfApiError(error) }),
      )
      .then((next) => {
        if (!controller.signal.aborted) setAccount(next);
      });
    return () => {
      controller.abort();
    };
  }, [client]);
  return account;
}
