import { z } from 'zod';
import { InstantString, Uuid } from './primitives';

/** `<domain>.<past_tense>` (DOMAINS.md cross-domain rules). */
export const EventType = z.string().regex(/^[a-z_]+\.[a-z_]+$/);

/**
 * Envelope of every event sent to clients (SYSTEM_ARCHITECTURE §4.4, Part 10.1):
 * `seq` is the per-player, gap-free sequence for persistent domain events, or null for ephemeral notifications.
 */
export const eventEnvelope = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.object({
    id: Uuid,
    type: z.literal(type),
    seq: z.int().positive().nullable(),
    occurredAt: InstantString,
    payload,
  });

export interface EventDefinition<T extends string = string, P extends z.ZodType = z.ZodType> {
  type: T;
  payload: P;
  envelope: ReturnType<typeof eventEnvelope<T, P>>;
}

export function defineEvent<const T extends string, P extends z.ZodType>(
  type: T,
  payload: P,
): EventDefinition<T, P> {
  EventType.parse(type);
  return { type, payload, envelope: eventEnvelope(type, payload) };
}

/**
 * Event catalog. Populated by the Parts that produce events (3.4, 6.x, 8.x, 9.x, 10.1), always matching the
 * catalog in DOMAINS.md (test/events.test.ts).
 */
export const events: readonly EventDefinition[] = [];
