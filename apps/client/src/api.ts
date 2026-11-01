import { createApiClient, type ApiClient } from '@chronos/contracts';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import type { ClientConfig } from './config';

/** The one place that talks HTTP (lint forbids raw fetch elsewhere): a typed client from the route contracts. */
export function createClient(config: ClientConfig): ApiClient {
  return createApiClient({
    baseUrl: config.apiUrl,
    fetch: (input, init) => fetch(input, init),
    // expo-crypto works on iOS, Android and web; React Native has no global crypto.randomUUID.
    newIdempotencyKey: () => randomUUID(),
    // Web sends the session cookie cross-origin (Part 2.8); native stores its own token.
    ...(Platform.OS === 'web' ? { credentials: 'include' as const } : {}),
  });
}
