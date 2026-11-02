import { randomUUID } from 'node:crypto';
import { accountRoute, APP_SCHEME, AUTH_COOKIE_PREFIX, createApiClient } from '@chronos/contracts';
import { useTestDatabase } from '@chronos/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createVerifiedAccount, makeAuthApp, PASSWORD, type AuthHarness } from './auth-helpers';

// Part 2.8 "sign in on native with the same account": the REAL Better Auth Expo client plugin (the code the app
// runs on iOS/Android) against the real API. Only the React Native platform modules are replaced (vitest.config.ts
// aliases → test/native-stubs: Platform.OS is 'ios'), and SecureStore is an in-memory map. What this proves: the native protocol (no Origin, `expo-origin`
// header, cookie persisted in secure storage and sent back by hand) works with our server configuration.
// What it does not prove: rendering on a device (owner check with Expo Go, README).
const t = useTestDatabase();
let h: AuthHarness;
let baseUrl: string;
beforeAll(async () => {
  h = await makeAuthApp(t.url);
  baseUrl = await h.app.listen({ host: '127.0.0.1', port: 0 });
});
afterAll(async () => {
  await h.close();
});

function memorySecureStore() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    getItemAsync: (key: string) => Promise.resolve(map.get(key) ?? null),
    setItemAsync: (key: string, value: string) => {
      map.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key: string) => {
      map.delete(key);
      return Promise.resolve();
    },
  };
}

describe('native client (Better Auth Expo plugin) against the real API', () => {
  it('signs in with an account created on the web, stores the session securely and calls protected routes', async () => {
    const { createAuthClient } = await import('better-auth/client');
    const { expoClient } = await import('@better-auth/expo/client');
    const email = `native-${randomUUID().slice(0, 8)}@example.com`;
    await createVerifiedAccount(h, email); // created through the web flow (Origin: the web app)

    const store = memorySecureStore();
    const authClient = createAuthClient({
      baseURL: baseUrl,
      plugins: [
        expoClient({
          scheme: APP_SCHEME,
          storagePrefix: 'chronos',
          cookiePrefix: AUTH_COOKIE_PREFIX,
          storage: store,
        }),
      ],
    });

    const signIn = await authClient.signIn.email({ email, password: PASSWORD });
    expect(signIn.error).toBeNull();
    const stored = store.map.get('chronos_cookie') ?? '';
    expect(stored).toContain(`${AUTH_COOKIE_PREFIX}.session_token`);

    // What apps/client/src/api.ts does on native: the typed client sends the stored cookie by hand.
    const cookie = await authClient.getCookie();
    const api = createApiClient({
      baseUrl,
      newIdempotencyKey: () => randomUUID(),
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          credentials: 'omit',
          headers: { ...(init?.headers as Record<string, string>), cookie },
        }),
    });
    const me = await api.call(accountRoute, {});
    expect(me).toMatchObject({ status: 200, body: { email, role: 'player' } });

    const session = await authClient.getSession();
    expect(session.data?.user.email).toBe(email);

    await authClient.signOut();
    expect(await authClient.getCookie()).toBe('');
    const after = await api.call(accountRoute, {}).catch((e: unknown) => e);
    expect(after).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
