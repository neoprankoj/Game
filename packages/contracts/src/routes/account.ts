import { z } from 'zod';
import { defineRoute } from './define';

export const AccountRole = z.enum(['player', 'admin']).meta({ id: 'AccountRole' });

export const AccountResponse = z
  .object({
    accountId: z.string().min(1),
    email: z.email(),
    name: z.string(),
    role: AccountRole,
    emailVerified: z.boolean(),
  })
  .meta({ id: 'AccountResponse', description: 'The signed-in account (D01).' });

/** The first protected route: who am I? (Part 2.8). Game routes follow the same `auth: 'session'` rule. */
export const accountRoute = defineRoute({
  id: 'account.get',
  method: 'GET',
  path: '/account',
  summary: 'The signed-in account',
  tags: ['account'],
  auth: 'session',
  idempotent: false,
  responses: { 200: { description: 'The account of the current session', schema: AccountResponse } },
  errors: [],
});
