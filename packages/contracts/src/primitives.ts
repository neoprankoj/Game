import { z } from 'zod';

/** UUID (v7 for entities, DATABASE_DESIGN §2). Lowercase canonical form on the wire. */
export const Uuid = z.uuid().meta({ description: 'UUID, lowercase canonical form' });

/**
 * Integer amounts (resources, counts) travel as **decimal strings** and are `bigint` in code
 * (ADR-0006, R-13): JSON numbers cannot represent int8 safely. One codec defines both directions.
 */
export const BigIntString = z.codec(
  z.string().regex(/^-?(0|[1-9]\d*)$/, 'integer in decimal notation'),
  z.bigint(),
  {
    decode: (wire) => BigInt(wire),
    encode: (value) => value.toString(),
  },
);

/** Non-negative variant for balances and costs (DB `CHECK (amount >= 0)`). */
export const AmountString = z.codec(
  z.string().regex(/^(0|[1-9]\d*)$/, 'non-negative integer in decimal notation'),
  z.bigint(),
  {
    decode: (wire) => BigInt(wire),
    encode: (value) => value.toString(),
  },
);

/**
 * Instants travel as UTC ISO-8601 with exactly 3 fractional digits and `Z` (e.g. 2026-11-01T10:00:00.000Z)
 * and are integer epoch milliseconds in code (GAME_SIMULATION_SPEC §1.1; rule 5).
 */
export const InstantString = z.codec(z.iso.datetime({ precision: 3 }), z.int(), {
  decode: (wire) => Date.parse(wire),
  encode: (epochMs) => new Date(epochMs).toISOString(),
});
