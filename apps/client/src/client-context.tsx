import type { ApiClient } from '@chronos/contracts';
import { createContext, use } from 'react';
import type { AuthClient } from './auth';

export interface Services {
  api: ApiClient;
  auth: AuthClient;
}

export const ServicesContext = createContext<Services | null>(null);

function useServices(): Services {
  const services = use(ServicesContext);
  if (!services) throw new Error('ServicesContext missing: the root layout provides it');
  return services;
}

export const useApiClient = (): ApiClient => useServices().api;
export const useAuth = (): AuthClient => useServices().auth;
