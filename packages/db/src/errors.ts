/**
 * SQLSTATEs after which re-running the whole transaction is safe and expected to succeed
 * (DATABASE_DESIGN §5.2): serialization_failure, deadlock_detected, lock_not_available (lock timeout / NOWAIT).
 */
export const RETRYABLE_SQLSTATES: ReadonlySet<string> = new Set(['40001', '40P01', '55P03']);

/** Extracts the PostgreSQL SQLSTATE from an error, following Drizzle's `cause` wrapping. */
export function sqlState(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export const isRetryableTransactionError = (error: unknown): boolean => {
  const code = sqlState(error);
  return code !== undefined && RETRYABLE_SQLSTATES.has(code);
};

/** Thrown when locks are requested out of the canonical order (DATABASE_DESIGN §5.2). Always a bug. */
export class LockOrderViolation extends Error {
  override readonly name = 'LockOrderViolation';
}
