import { z } from 'zod';

/**
 * Client configuration. Expo inlines `EXPO_PUBLIC_*` variables at BUILD time, so each environment (local,
 * staging, production) is a separate web export or native build. These values are public: never secrets.
 */
const ClientEnv = z.object({
  EXPO_PUBLIC_API_URL: z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' }),
});

export interface ClientConfig {
  apiUrl: string;
}

export type ConfigResult = { ok: true; config: ClientConfig } | { ok: false; problem: string };

export function readClientConfig(env: Record<string, string | undefined>): ConfigResult {
  const parsed = ClientEnv.safeParse(env);
  if (!parsed.success) {
    return {
      ok: false,
      problem: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, config: { apiUrl: parsed.data.EXPO_PUBLIC_API_URL.replace(/\/$/, '') } };
}

// Metro replaces this exact expression at build time (it must stay literal: no dynamic access).
export const clientConfig = readClientConfig({ EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL });
