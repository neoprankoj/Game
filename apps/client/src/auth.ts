import { expoClient } from '@better-auth/expo/client';
import { APP_SCHEME, AUTH_COOKIE_PREFIX } from '@chronos/contracts';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ClientConfig } from './config';

/** Native: the session cookie lives in the OS keychain/keystore. Web: the browser keeps it (httpOnly cookie). */
const webStorage = {
  getItem: () => null,
  setItem: () => undefined,
  getItemAsync: () => Promise.resolve(null),
  setItemAsync: () => Promise.resolve(),
  deleteItemAsync: () => Promise.resolve(),
};

/**
 * Better Auth client (ADR-0007): sign-up, sign-in, sign-out, reset and deletion talk to the library endpoints
 * under /api/auth. On web the browser sends the cookie; on native the Expo plugin stores it in SecureStore and
 * adds it (plus the app scheme as `expo-origin`) to every auth request.
 */
export function createAuth(config: ClientConfig) {
  return createAuthClient({
    baseURL: config.apiUrl,
    plugins: [
      expoClient({
        scheme: APP_SCHEME,
        storagePrefix: 'chronos',
        cookiePrefix: AUTH_COOKIE_PREFIX,
        storage: Platform.OS === 'web' ? webStorage : SecureStore,
      }),
    ],
  });
}

export type AuthClient = ReturnType<typeof createAuth>;
