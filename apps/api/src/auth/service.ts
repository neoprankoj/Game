import { expo } from '@better-auth/expo';
import {
  APP_SCHEME,
  AUTH_BASE_PATH,
  AUTH_COOKIE_PREFIX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@chronos/contracts';
import { betterAuth } from 'better-auth';
import type { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { AuthConfig } from '../config';
import { existingAccount, resetPassword, verifyEmail } from './emails';
import type { Mailer, MailMessage } from './mailer';

/** The authenticated caller, as the rest of the API sees it (D01 `requireAccount`). */
export interface Account {
  accountId: string;
  email: string;
  name: string;
  role: 'player' | 'admin';
  emailVerified: boolean;
  sessionId: string;
}

/** Runs before the auth user is deleted (D01 deletion order: anonymise the player FIRST). Empty until 3.3/6.1. */
export type AccountDeletionHook = (accountId: string) => Promise<void>;

export interface AuthLog {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

export interface AuthServiceOptions {
  config: AuthConfig;
  /** Better Auth database adapter, built in the composition root (deps.ts) from @chronos/db. */
  database: ReturnType<typeof drizzleAdapter>;
  mailer: Mailer;
  /** Browser origins of the web client (the CORS allow-list): trusted for redirects and CSRF origin checks. */
  trustedOrigins: readonly string[];
  log: AuthLog;
  deletionHooks?: readonly AccountDeletionHook[];
}

export interface AuthService {
  /** Origin of BETTER_AUTH_URL; the API is served at the root of its host. */
  readonly origin: string;
  /** Serves every Better Auth endpoint under AUTH_BASE_PATH (Fetch API request in, response out). */
  handle(request: Request): Promise<Response>;
  /** The account behind the session cookie in `headers`, or null (no, expired or revoked session). */
  getAccount(headers: Headers): Promise<Account | null>;
}

/** Per-IP limits (window in seconds). Basic level for Part 2.8; categories move to Redis in 11.2. */
export const AUTH_RATE_LIMITS = {
  '/sign-in/email': { window: 60, max: 5 },
  '/sign-up/email': { window: 60, max: 3 },
  '/request-password-reset': { window: 300, max: 3 },
  '/send-verification-email': { window: 300, max: 3 },
  '/reset-password': { window: 300, max: 5 },
  '/delete-user': { window: 60, max: 5 },
} as const;

/**
 * Header the HTTP adapter sets from Fastify's `request.ip` (which honours TRUST_PROXY). Better Auth reads the client
 * IP only from this header, so rate limits use the same IP as the rest of the API and a client cannot spoof it
 * (the adapter overwrites any incoming value).
 */
export const CLIENT_IP_HEADER = 'x-chronos-client-ip';

/** Better Auth configuration for Chronos Cradle (ADR-0007). All credential handling stays inside the library. */
export function createAuthService(options: AuthServiceOptions): AuthService {
  const { config, mailer, log } = options;
  const deliver = async (message: MailMessage): Promise<void> => {
    // D01: a mail problem never fails sign-up or reset; the user can ask for a new link.
    try {
      await mailer.send(message);
    } catch (error) {
      log.error({ err: error, kind: message.kind }, 'email delivery failed');
    }
  };

  const auth = betterAuth({
    appName: 'Chronos Cradle',
    baseURL: config.baseUrl,
    basePath: AUTH_BASE_PATH,
    secret: config.secret,
    database: options.database,
    // Browsers must match the web client's origins; native requests identify as the app scheme (expo plugin).
    trustedOrigins: [...options.trustedOrigins, `${APP_SCHEME}://`],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      // Also makes sign-up enumeration-safe: a duplicate email gets the same answer as a new one (+ a notice email).
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await deliver(resetPassword(user.email, url));
      },
      onExistingUserSignUp: async ({ user }) => {
        await deliver(existingAccount(user.email));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Not on sign-in: the client re-requests the link itself with the right return URL (web page or app deep
      // link). A server-sent link here would return the user to the API host instead of the app.
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await deliver(verifyEmail(user.email, url));
      },
    },
    user: {
      additionalFields: {
        // Never settable through sign-up or profile updates (`input: false`); granted by the admin CLI (11.6).
        role: { type: 'string', required: true, defaultValue: 'player', input: false },
      },
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          for (const hook of options.deletionHooks ?? []) await hook(user.id);
        },
        afterDelete: (user) => {
          log.info({ accountId: user.id }, 'account deleted');
          return Promise.resolve();
        },
      },
    },
    session: {
      // Sliding 30-day sessions stored in the database (revocable). No cookie cache: revocation is immediate.
      expiresIn: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    rateLimit: {
      enabled: config.rateLimit,
      storage: 'memory', // one API instance in the MVP (moves to Redis in 11.2)
      customRules: AUTH_RATE_LIMITS,
    },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      useSecureCookies: config.baseUrl.startsWith('https://'),
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      // EXPLICITLY on. Better Auth turns its origin/redirect and CSRF checks OFF when NODE_ENV=test unless these are
      // set, so tests would pass against weaker behaviour than production (found in Part 2.8: an untrusted reset
      // `redirectTo` leaked the reset token while NODE_ENV=test). Every environment runs the same checks.
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    hooks: {
      before: createAuthMiddleware((ctx) => {
        // Deleting an account always needs the password, even on a fresh session (a borrowed, unlocked phone).
        const body = ctx.body as { password?: unknown } | undefined;
        if (
          ctx.path === '/delete-user' &&
          (typeof body?.password !== 'string' || body.password.length === 0)
        ) {
          throw new APIError('BAD_REQUEST', {
            code: 'VALIDATION_ERROR',
            message: 'Your password is required to delete the account.',
          });
        }
        return Promise.resolve();
      }),
    },
    plugins: [expo()],
    telemetry: { enabled: false },
    logger: {
      level: 'warn',
      log: (level, message) => {
        if (level === 'error') log.error({ source: 'better-auth' }, message);
        else log.warn({ source: 'better-auth' }, message);
      },
    },
  });

  return {
    origin: new URL(config.baseUrl).origin,
    handle: (request) => auth.handler(request),
    getAccount: async (headers) => {
      const result = await auth.api.getSession({ headers });
      if (!result) return null;
      const { user, session } = result;
      return {
        accountId: user.id,
        email: user.email,
        name: user.name,
        role: user.role === 'admin' ? 'admin' : 'player',
        emailVerified: user.emailVerified,
        sessionId: session.id,
      };
    },
  };
}
