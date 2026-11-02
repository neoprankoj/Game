import { accountRoute } from '@chronos/contracts';
import { bind, type RouteBinding } from '../../http/contract-route';

/** D01 account routes served through contracts (sign-in etc. are Better Auth endpoints, see auth/routes.ts). */
export function accountModule(): RouteBinding[] {
  return [
    bind(accountRoute, ({ account }) =>
      Promise.resolve({
        status: 200,
        body: {
          accountId: account.accountId,
          email: account.email,
          name: account.name,
          role: account.role,
          emailVerified: account.emailVerified,
        },
      } as const),
    ),
  ];
}
