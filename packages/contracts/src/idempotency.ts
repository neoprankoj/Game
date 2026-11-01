import { z } from 'zod';

/**
 * Idempotency (Part 3.6, DATABASE_DESIGN §5.5): every mutating request carries this header. Clients
 * generate a fresh random key per *intent* (e.g. a UUID) and reuse it when retrying that intent.
 * Same key + same request → the stored response; same key + different request → IDEMPOTENCY_KEY_REUSED.
 */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const IdempotencyKey = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,128}$/, '16–128 characters: letters, digits, _ or -')
  .meta({ description: 'Client-generated key, unique per intent; reuse it only to retry the same request.' });
