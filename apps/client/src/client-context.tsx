import type { ApiClient } from '@chronos/contracts';
import { createContext, use } from 'react';

export const ApiClientContext = createContext<ApiClient | null>(null);

export function useApiClient(): ApiClient {
  const client = use(ApiClientContext);
  if (!client) throw new Error('ApiClientContext missing: the root layout provides it');
  return client;
}
