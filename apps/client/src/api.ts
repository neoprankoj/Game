import { createApiClient, type ApiClient } from '@chronos/contracts';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import type { AuthClient } from './auth';
import type { ClientConfig } from './config';

/**
 * The one place that talks HTTP for game routes (lint forbids raw fetch elsewhere): a typed client from the route
 * contracts. Sessions: web sends the httpOnly cookie (`credentials: include`; app and API are same-site); native
 * reads the cookie the Better Auth Expo plugin stored in SecureStore and sends it by hand.
 */
export function createClient(config: ClientConfig, auth: AuthClient): ApiClient {
  const isWeb = Platform.OS === 'web';
  return createApiClient({
    baseUrl: config.apiUrl,
    fetch: isWeb
      ? (input, init) => fetch(input, init)
      : async (input, init) => {
          const cookie = await auth.getCookie();
          const headers = new Headers(init?.headers);
          if (cookie) headers.set('cookie', cookie);
          return fetch(input, { ...init, headers, credentials: 'omit' });
        },
    // expo-crypto works on iOS, Android and web; React Native has no global crypto.randomUUID.
    newIdempotencyKey: () => randomUUID(),
    ...(isWeb ? { credentials: 'include' as const } : {}),
  });
}
