// Authentication domain tables (D01, ADR-0007), owned by Better Auth and kept in their own `auth` schema.
// Generated with Better Auth's schema CLI (`auth generate`, 1.7.15) for our options (email + password, expo plugin,
// `role` additional field), then adapted: `auth` schema, timestamptz (DATABASE_DESIGN §2: all instants are UTC
// timestamptz) and CHECK constraints. Better Auth validates this definition at startup (`validateSchema`), so a
// library upgrade that needs new columns fails tests instead of failing at runtime. Game tables reference only
// `auth.user(id)`; game domains never read these tables directly.
import { sql } from 'drizzle-orm';
import { boolean, check, index, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Roles in the MVP (Part 2.8 scope: `player` and `admin` only). */
export const ACCOUNT_ROLES = ['player', 'admin'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const authUser = authSchema.table(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    role: text('role').$type<AccountRole>().default('player').notNull(),
  },
  (t) => [
    check('user_role_check', sql`${t.role} in ('player', 'admin')`),
    // Better Auth lowercases emails; the database guarantees "one account per email, case-insensitive" (D01).
    check('user_email_lowercase_check', sql`${t.email} = lower(${t.email})`),
    check('user_email_length_check', sql`char_length(${t.email}) between 3 and 254`),
  ],
);

export const authSession = authSchema.table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: instant('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

export const authAccount = authSchema.table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: instant('access_token_expires_at'),
    refreshTokenExpiresAt: instant('refresh_token_expires_at'),
    scope: text('scope'),
    /** Password hash written by the library (scrypt); never read by our code. */
    password: text('password'),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
);

export const authVerification = authSchema.table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: instant('expires_at').notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

/** The object Better Auth's Drizzle adapter needs: its model names → our tables. */
export const betterAuthTables = {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
};
