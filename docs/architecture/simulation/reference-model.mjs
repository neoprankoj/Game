// =============================================================================
// Chronos Cradle — executable reference model for GAME_SIMULATION_SPEC.md (Part 1.4)
// =============================================================================
// Run:   node docs/architecture/simulation/reference-model.mjs [--write]
//
// What it is: a small, dependency-free model of every MVP formula in the spec.
// It (1) runs property checks on the hard claims (path independence, closed form ==
// per-millisecond iteration, combat determinism, integer-only math) and (2) prints —
// or with --write regenerates — worked-examples.generated.md, which the spec cites.
//
// What it is NOT: production code. Parts 4.x / 6.x / 8.x / 9.x implement the rules in
// packages/game-* (TypeScript) and port the examples below as golden tests; the
// starter balance numbers here become game-data ruleset v1 (and will be tuned in 4.6/12.7).
// =============================================================================
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = [];
const md = (s = '') => out.push(s);
let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.error('CHECK FAIL', label); } else console.log('CHECK OK  ', label);
};

// ---------------------------------------------------------------------------
// §2 Numeric model
// ---------------------------------------------------------------------------
const BP = 10000n;
const MS_PER_HOUR = 3_600_000n;
const MILLI = 1000n;                    // rates are milli-units per hour (mu/h)
const D = MILLI * MS_PER_HOUR;          // numerator units per whole unit = 3.6e9
const mulBp = (x, bp) => (x * BigInt(bp)) / BP;          // floor for x >= 0
const ceilDiv = (a, b) => (a + b - 1n) / b;              // a >= 0, b > 0
const fmtUnits = (N) => `${N / D} (+${N % D}/${D})`;
const units = (N) => N / D;

// ---------------------------------------------------------------------------
// §3 Accrual: piecewise-linear dynamics with sticky boundaries
// ---------------------------------------------------------------------------
// params: p (production mu/h), u (upkeep mu/h), d (decay mu/h), S (stable, units), C (cap, units)
// Regions (numerator space): R1 [0,S·D) v=p−u · R2 [S·D,C·D) v=p−u−d · R3 [C·D,∞) v=−u−d
function makeField({ p, u, d, S, C }, Dn = D) {
  const sD = S * Dn, cD = C * Dn;
  const hasR2 = S < C;
  const vel = (N) => (N < sD && hasR2) || (!hasR2 && N < cD) ? p - u : N < cD ? p - u - d : -u - d;
  const lower = (N) => (N < (hasR2 ? sD : cD)) ? 0n : (hasR2 && N < cD) ? sD : cD;
  const upper = (N) => (N < (hasR2 ? sD : cD)) ? (hasR2 ? sD : cD) : (hasR2 && N < cD) ? cD : null;
  return { vel, lower, upper };
}

// One millisecond of the reference dynamics (the definition).
function stepOnce(field, N) {
  const v = field.vel(N);
  let n2 = N + v;
  if (v > 0n) {
    const ub = field.upper(N);
    if (ub !== null && n2 >= ub && field.vel(ub) <= 0n) n2 = ub;
  } else if (v < 0n) {
    const lb = field.lower(N);
    if (n2 < lb) {
      if (lb === 0n) n2 = 0n;
      else if (field.vel(lb - 1n) >= 0n) n2 = lb;
    }
  }
  return n2;
}

// Closed form over dt milliseconds. Returns { N, zeroAt } where zeroAt is the ms offset at
// which the balance first reached 0 under a negative velocity (deficit start), if it did.
function accrue(params, N, dt, Dn = D) {
  const f = makeField(params, Dn);
  let elapsed = 0n, zeroAt = null;
  if (N === 0n && f.vel(0n) < 0n) zeroAt = 0n;
  while (dt > 0n) {
    const v = f.vel(N);
    if (v === 0n) break;
    if (v > 0n) {
      const ub = f.upper(N);
      if (ub === null) { N += v * dt; break; }
      const k = ceilDiv(ub - N, v);
      if (dt < k) { N += v * dt; break; }
      if (f.vel(ub) <= 0n) { N = ub; break; }        // sticky boundary: equilibrium
      N += v * k; dt -= k; elapsed += k;
    } else {
      const lb = f.lower(N);
      const k = (N - lb) / -v + 1n;                     // steps until strictly below lb
      if (dt < k) { N += v * dt; break; }
      if (lb === 0n) { zeroAt = elapsed + ceilDiv(N, -v); N = 0n; break; }
      if (f.vel(lb - 1n) >= 0n) { N = lb; break; }     // sticky boundary: equilibrium
      N += v * k; dt -= k; elapsed += k;
    }
  }
  return { N, zeroAt };
}

// --- property checks for accrual (small D so brute force is feasible) -------
{
  let seed = 12345;
  const rnd = (n) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return BigInt(seed % n); };
  let okBrute = true, okSplit = true;
  const Dsmall = 50n;
  for (let i = 0; i < 3000; i++) {
    const C = 1n + rnd(20), S = C - rnd(Number(C));
    const params = { p: rnd(30), u: rnd(30), d: rnd(30), S, C };
    let N0 = rnd(Number((C + 5n) * Dsmall));
    const dt = rnd(400);
    let Nb = N0; const f = makeField(params, Dsmall);
    for (let j = 0n; j < dt; j++) Nb = stepOnce(f, Nb);
    const cf = accrue(params, N0, dt, Dsmall).N;
    if (cf !== Nb) { okBrute = false; console.error('brute mismatch', params, N0, dt, cf, Nb); break; }
    const a = rnd(Number(dt) + 1);
    const split = accrue(params, accrue(params, N0, a, Dsmall).N, dt - a, Dsmall).N;
    if (split !== cf) { okSplit = false; console.error('split mismatch', params, N0, dt, a); break; }
  }
  check(okBrute, 'accrual closed form == per-millisecond iteration (3,000 random cases)');
  check(okSplit, 'accrual is path-independent: settle(a) then settle(b) == settle(a+b) (3,000 cases)');
  // production-scale split invariance
  let okBig = true;
  for (let i = 0; i < 2000; i++) {
    const C = 1000n + rnd(50000), S = rnd(2) === 0n ? C : C / 2n;
    const params = { p: rnd(200000), u: rnd(60000), d: rnd(20000), S, C };
    const N0 = rnd(1_000_000) * D / 1000n;
    const dt = rnd(48 * 3600) * 1000n + rnd(1000);
    const parts = [rnd(Number(dt) + 1)]; parts.push(dt - parts[0]);
    const one = accrue(params, N0, dt).N;
    let n = N0; for (const pt of parts) n = accrue(params, n, pt).N;
    if (n !== one) { okBig = false; break; }
  }
  check(okBig, 'path independence at production scale D = 3.6e9 (2,000 cases, up to 48 h)');
}

// ---------------------------------------------------------------------------
// §4 Starter balance data (proposed game-data ruleset v1)
// ---------------------------------------------------------------------------
const RES = ['ore', 'aetherium', 'flux'];
const RESOURCE = {
  ore:       { capFactorBp: 10000, stableBp: 10000, decayBpPerHour: 1000, nexusBaseMuH: 5000n },
  aetherium: { capFactorBp: 10000, stableBp: 10000, decayBpPerHour: 1000, nexusBaseMuH: 3000n },
  flux:      { capFactorBp: 2000,  stableBp: 5000,  decayBpPerHour: 500,  nexusBaseMuH: 0n },
};
const NEXUS_CAP1 = 300n, NEXUS_CAPG = 14000;          // capacity provided by the Command Nexus itself
const nexusCap = (L) => levelSeries(NEXUS_CAP1, NEXUS_CAPG, Math.max(1, L));
const NEXUS_BASE_POP = 100n;

// building: cost at L1 (to reach level 1 from 0), growth bp per level, duration (s) L1, growth, pop per level, effect
const BUILDINGS = {
  command_nexus:       { cost: [200n, 100n, 0n], costG: 14500, dur: 600n,  durG: 17000, pop: 0n, max: 10, effect: 'speed' },
  ore_extractor:       { cost: [60n, 20n, 0n],   costG: 15000, dur: 120n,  durG: 16000, pop: 3n, max: 10, effect: 'prod', res: 'ore', prod1: 30000n, prodG: 12000 },
  aetherium_condenser: { cost: [70n, 30n, 0n],   costG: 15000, dur: 150n,  durG: 16000, pop: 3n, max: 10, effect: 'prod', res: 'aetherium', prod1: 20000n, prodG: 12000 },
  flux_refinery:       { cost: [150n, 120n, 0n], costG: 16000, dur: 600n,  durG: 16000, pop: 5n, max: 10, effect: 'prod', res: 'flux', prod1: 5000n, prodG: 12000, needs: 'temporal_refining' },
  storage_vault:       { cost: [80n, 40n, 0n],   costG: 15000, dur: 180n,  durG: 16000, pop: 1n, max: 10, effect: 'cap', cap1: 200n, capG: 14000 },
  habitat:             { cost: [60n, 30n, 0n],   costG: 15000, dur: 150n,  durG: 16000, pop: 0n, max: 10, effect: 'popcap', pop1: 60n, popG: 12500 },
  research_spire:      { cost: [120n, 80n, 0n],  costG: 16000, dur: 300n,  durG: 16000, pop: 4n, max: 10, effect: 'research_speed' },
  barracks:            { cost: [100n, 50n, 0n],  costG: 16000, dur: 240n,  durG: 16000, pop: 4n, max: 10, effect: 'recruit_speed' },
  bastion_wall:        { cost: [120n, 30n, 0n],  costG: 16000, dur: 300n,  durG: 16000, pop: 2n, max: 10, effect: 'wall' },
};
const levelSeries = (v1, g, L) => { let v = v1; for (let i = 1; i < L; i++) v = mulBp(v, g); return v; };
const buildingCost = (b, L) => b.cost.map((c) => levelSeries(c, b.costG, L));
const buildingDurS = (b, L) => levelSeries(b.dur, b.durG, L);
const speedBp = (level) => 500 * Math.max(0, level - 1);           // +5% per level above 1
const effectiveDurS = (durS, spBp) => { const x = ceilDiv(durS * BP, BP + BigInt(spBp)); return x < 1n ? 1n : x; };

const TECHS = {
  ore_refinement:        { tier: 1, max: 3, cost: [100n, 80n, 0n],   costG: 18000, dur: 900n,  durG: 18000 },
  aether_condensation:   { tier: 1, max: 3, cost: [100n, 100n, 0n],  costG: 18000, dur: 900n,  durG: 18000 },
  storage_engineering:   { tier: 1, max: 2, cost: [150n, 100n, 0n],  costG: 20000, dur: 1200n, durG: 20000 },
  logistics:             { tier: 1, max: 2, cost: [120n, 120n, 0n],  costG: 20000, dur: 1200n, durG: 20000 },
  temporal_refining:     { tier: 2, max: 1, cost: [300n, 300n, 0n],  costG: 10000, dur: 3600n, durG: 10000 },
  weapon_alloys:         { tier: 2, max: 2, cost: [250n, 200n, 0n],  costG: 20000, dur: 2400n, durG: 20000 },
  aether_shielding:      { tier: 2, max: 2, cost: [250n, 250n, 0n],  costG: 20000, dur: 2400n, durG: 20000 },
  bronze_forging:        { tier: 2, max: 1, cost: [400n, 200n, 0n],  costG: 10000, dur: 3600n, durG: 10000 },
  skiff_navigation:      { tier: 2, max: 1, cost: [300n, 250n, 0n],  costG: 10000, dur: 3600n, durG: 10000 },
  tactical_doctrine:     { tier: 2, max: 1, cost: [300n, 300n, 0n],  costG: 10000, dur: 3600n, durG: 10000 },
  flux_stabilization:    { tier: 3, max: 2, cost: [400n, 400n, 60n], costG: 20000, dur: 7200n, durG: 20000, needs: 'temporal_refining' },
  siegecraft:            { tier: 3, max: 1, cost: [600n, 400n, 40n], costG: 10000, dur: 7200n, durG: 10000 },
  chronomancy:           { tier: 3, max: 1, cost: [500n, 500n, 80n], costG: 10000, dur: 10800n, durG: 10000, needs: 'temporal_refining' },
  rewind_mastery:        { tier: 3, max: 3, cost: [400n, 500n, 50n], costG: 18000, dur: 7200n, durG: 18000, needs: 'chronomancy' },
};
const spireNeeded = (tier) => 2 * tier - 1;

// units: atk, def (armor), hp, speed (cells/h), carry, upkeep (mu/h of aetherium), pop, cost, train s
const UNIT_ORDER = ['sentinel', 'lancer', 'colossus', 'skiff_rider', 'rift_ram', 'chrononaut'];
const UNITS = {
  sentinel:    { cls: 'infantry', atk: 10n, def: 10n, hp: 50n,  speed: 6n,  carry: 20n, upkeep: 500n,  pop: 1n, cost: [50n, 20n, 0n],    train: 60n,  barracks: 1 },
  lancer:      { cls: 'ranged',   atk: 14n, def: 4n,  hp: 35n,  speed: 6n,  carry: 10n, upkeep: 500n,  pop: 1n, cost: [40n, 40n, 0n],    train: 75n,  barracks: 2 },
  colossus:    { cls: 'heavy',    atk: 12n, def: 25n, hp: 120n, speed: 4n,  carry: 30n, upkeep: 1500n, pop: 3n, cost: [150n, 60n, 0n],   train: 180n, barracks: 3, needs: 'bronze_forging' },
  skiff_rider: { cls: 'cavalry',  atk: 9n,  def: 6n,  hp: 45n,  speed: 12n, carry: 60n, upkeep: 1000n, pop: 2n, cost: [80n, 40n, 0n],    train: 90n,  barracks: 2, needs: 'skiff_navigation' },
  rift_ram:    { cls: 'siege',    atk: 4n,  def: 8n,  hp: 90n,  speed: 3n,  carry: 0n,  upkeep: 2000n, pop: 4n, cost: [200n, 100n, 0n],  train: 300n, barracks: 4, needs: 'siegecraft' },
  chrononaut:  { cls: 'temporal', atk: 6n,  def: 6n,  hp: 40n,  speed: 6n,  carry: 0n,  upkeep: 3000n, pop: 2n, cost: [100n, 100n, 25n], train: 240n, barracks: 3, needs: 'chronomancy' },
};
const COUNTER = { // attacker class -> target class -> bp (default 10000)
  infantry: { cavalry: 15000, heavy: 8000 },
  ranged:   { heavy: 14000, cavalry: 7000 },
  heavy:    { infantry: 14000, ranged: 12000 },
  cavalry:  { ranged: 15000, siege: 15000, heavy: 6000 },
  siege:    { infantry: 5000, ranged: 5000, heavy: 5000, cavalry: 5000, siege: 5000, temporal: 5000 },
  temporal: { infantry: 8000, ranged: 8000, heavy: 8000, cavalry: 8000, siege: 8000, temporal: 8000 },
};
const counterBp = (a, t) => BigInt(COUNTER[a]?.[t] ?? 10000);
const unitValue = (u) => u.cost[0] + 2n * u.cost[1] + 5n * u.cost[2];

// ---------------------------------------------------------------------------
// §4 Economy rates for a city
// ---------------------------------------------------------------------------
function cityRates(city) {
  const lv = (b) => city.buildings[b] ?? 0;
  const vaultCap = lv('storage_vault') > 0 ? levelSeries(BUILDINGS.storage_vault.cap1, BUILDINGS.storage_vault.capG, lv('storage_vault')) : 0n;
  const storageResearchBp = 1000 * (city.research.storage_engineering ?? 0);
  const fluxStab = city.research.flux_stabilization ?? 0;
  const rates = {};
  for (const r of RES) {
    const R = RESOURCE[r];
    // production
    let base = R.nexusBaseMuH;
    for (const [bid, b] of Object.entries(BUILDINGS)) if (b.effect === 'prod' && b.res === r && lv(bid) > 0) base += levelSeries(b.prod1, b.prodG, lv(bid));
    let p = mulBp(base, 10000 + (city.islandBonus?.[r] ?? 0));                       // 1. island
    const resBp = r === 'ore' ? 1000 * (city.research.ore_refinement ?? 0) : r === 'aetherium' ? 1000 * (city.research.aether_condensation ?? 0) : 0;
    p = mulBp(p, 10000 + resBp);                                                         // 2. research
    if (city.activity === 'inactive') p = mulBp(p, 5000);                               // 3. activity
    if (city.activity === 'dormant') p = 0n;
    if (r === 'flux' && city.aethDeficit) p = 0n;                                       // 4. deficit penalty
    // upkeep (aetherium only)
    let u = 0n;
    if (r === 'aetherium' && city.activity !== 'dormant') for (const [ut, n] of Object.entries(city.units)) u += UNITS[ut].upkeep * BigInt(n);
    // capacity, stable level, decay
    const C = mulBp(mulBp(nexusCap(lv('command_nexus')) + vaultCap, R.capFactorBp), 10000 + storageResearchBp);
    const stableBp = r === 'flux' ? R.stableBp + 1000 * fluxStab : R.stableBp;
    const S = mulBp(C, stableBp);
    const decayBp = r === 'flux' ? R.decayBpPerHour - 100 * fluxStab : R.decayBpPerHour;
    const d = mulBp(C * MILLI, decayBp);
    rates[r] = { p, u, d, S, C };
  }
  return rates;
}

// Mini settlement for one city: timed events + derived breakpoints (deficit start, desertion ticks).
const DESERTION_GRACE_MS = 12n * MS_PER_HOUR;
const DESERTION_EVERY_MS = MS_PER_HOUR;
const DESERTION_BP = 1000; // 10% per tick, min 1 per non-empty stack
function settleCity(city, from, until, events, log) {
  let t = from;
  const evs = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (;;) {
    const rates = cityRates(city);
    // derived breakpoint candidates
    let next = null;
    const consider = (at, kind) => { if (at > t && at <= until && (next === null || at < next.at)) next = { at, kind }; };
    if (!city.aethDeficit) {
      const r = accrue(rates.aetherium, city.N.aetherium, until - t);
      if (r.zeroAt !== null) consider(t + (r.zeroAt === 0n ? 0n : r.zeroAt), 'deficit_start');
      if (r.zeroAt === 0n) next = { at: t, kind: 'deficit_start' };
    } else {
      const firstTick = city.deficitSince + DESERTION_GRACE_MS;
      let tick = firstTick;
      if (tick <= t) tick = firstTick + ceilDiv(t - firstTick + 1n, DESERTION_EVERY_MS) * DESERTION_EVERY_MS;
      consider(tick, 'desertion');
    }
    const ev = evs.length && evs[0].at <= until ? evs[0] : null;
    let step = next;
    if (ev && (!step || ev.at < step.at)) step = { at: ev.at, kind: 'event', ev };   // derived first on ties
    const to = step ? step.at : until;
    for (const r of RES) city.N[r] = accrue(rates[r], city.N[r], to - t).N;
    t = to;
    if (!step) break;
    if (step.kind === 'deficit_start') { city.aethDeficit = true; city.deficitSince = t; log?.(t, 'deficit started (aetherium 0, upkeep unpaid) → flux production halted, morale −20%'); }
    else if (step.kind === 'desertion') {
      const lost = {};
      for (const ut of UNIT_ORDER) {
        const n = BigInt(city.units[ut] ?? 0); if (n === 0n) continue;
        let l = mulBp(n, DESERTION_BP); if (l < 1n) l = 1n;
        city.units[ut] = Number(n - l); lost[ut] = Number(l);
      }
      log?.(t, `desertion tick: lost ${JSON.stringify(lost)}`);
    } else { evs.shift(); step.ev.apply(city); log?.(t, step.ev.label); }
    // deficit end check after any state change
    if (city.aethDeficit) {
      const v = cityRates(city).aetherium; const vel = v.p - v.u;
      if (city.N.aetherium > 0n || vel >= 0n) { city.aethDeficit = false; city.recoveryUntil = t + 2n * MS_PER_HOUR; log?.(t, 'deficit ended → flux production resumes; morale penalty until +2 h'); }
    }
  }
  return city;
}


// --- game-data invariant: every cost fits the capacity reachable when it may be paid ----------
{
  const capAt = (nexusL, vaultL, r) => mulBp(nexusCap(nexusL) + (vaultL > 0 ? levelSeries(BUILDINGS.storage_vault.cap1, BUILDINGS.storage_vault.capG, vaultL) : 0n), RESOURCE[r].capFactorBp);
  let ok = true; const bad = [];
  for (const [id, b] of Object.entries(BUILDINGS)) for (let L = 1; L <= b.max; L++) {
    const n = id === 'command_nexus' ? Math.max(1, L - 1) : L;          // a building may reach level ≤ Nexus
    const c = buildingCost(b, L);
    RES.forEach((r, i) => { if (c[i] > capAt(n, n, r)) { ok = false; bad.push(`${id} L${L} ${r} ${c[i]} > ${capAt(n, n, r)}`); } });
  }
  for (const [id, tch] of Object.entries(TECHS)) for (let L = 1; L <= tch.max; L++) {
    const n = spireNeeded(tch.tier);                                     // Spire ≥ 2·tier−1 implies Nexus ≥ that
    const c = buildingCost(tch, L);
    RES.forEach((r, i) => { if (c[i] > capAt(n, n, r)) { ok = false; bad.push(`${id} L${L} ${r} ${c[i]} > ${capAt(n, n, r)}`); } });
  }
  if (!ok) console.error(bad.join('\n'));
  check(ok, 'game-data invariant: every building/tech cost fits the storage reachable at that stage');
}
// ---------------------------------------------------------------------------
// §8 Movement
// ---------------------------------------------------------------------------
const isqrt = (n) => { if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; };
const distMilli = (a, b) => { const dx = BigInt(a[0] - b[0]), dy = BigInt(a[1] - b[1]); return isqrt((dx * dx + dy * dy) * 1_000_000n); };
function travelMs(from, to, unitTypes, logisticsLevel) {
  let speed = null;
  for (const ut of unitTypes) { const s = UNITS[ut].speed * 1000n; if (speed === null || s < speed) speed = s; }
  speed = mulBp(speed, 10000 + 1000 * logisticsLevel);
  let ms = ceilDiv(distMilli(from, to) * MS_PER_HOUR, speed);
  ms = ceilDiv(ms, 1000n) * 1000n;                // whole seconds
  return ms < 60_000n ? 60_000n : ms;             // minimum 1 minute
}

// ---------------------------------------------------------------------------
// §9 PRNG: xoshiro128** (Blackman & Vigna), unbiased uniform(n)
// ---------------------------------------------------------------------------
const rotl = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0;
function prng(seedBytes) {
  const s = [0, 1, 2, 3].map((i) => (seedBytes[4 * i] | (seedBytes[4 * i + 1] << 8) | (seedBytes[4 * i + 2] << 16) | (seedBytes[4 * i + 3] << 24)) >>> 0);
  if (s.every((w) => w === 0)) throw new Error('all-zero seed is invalid');
  let draws = 0;
  const nextU32 = () => {
    const r = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] = (s[2] ^ s[0]) >>> 0; s[3] = (s[3] ^ s[1]) >>> 0; s[1] = (s[1] ^ s[2]) >>> 0; s[0] = (s[0] ^ s[3]) >>> 0;
    s[2] = (s[2] ^ t) >>> 0; s[3] = rotl(s[3], 11);
    draws++; return r;
  };
  const uniform = (n) => { const threshold = (4294967296 - n) % n; for (;;) { const x = nextU32(); if (x >= threshold) return x % n; } };
  return { nextU32, uniform, draws: () => draws };
}
{
  const g = prng(Uint8Array.from([1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0]));
  const v = [...Array(6)].map(() => g.nextU32());
  check(v.join(' ') === '11520 0 5927040 70819200 2031721883 1637235492', 'xoshiro128** matches the C reference for state {1,2,3,4}');
}

// ---------------------------------------------------------------------------
// §9 Combat engine (ruleset 1)
// ---------------------------------------------------------------------------
const K_ARMOR = 50n;
const CLASH_ROUNDS = 6;
const FORMATIONS = {
  balanced:       { front: ['infantry', 'heavy', 'siege', 'cavalry'], frontAtkBp: 0,    allArmorBp: 0,     frontArmorBp: 0,    allAtkBp: 0 },
  vanguard:       { front: ['infantry', 'heavy', 'siege', 'cavalry', 'ranged'], frontAtkBp: 1000, allArmorBp: -1000, frontArmorBp: 0, allAtkBp: 0 },
  defensive_line: { front: ['infantry', 'heavy'], frontAtkBp: 0,  allArmorBp: 0,     frontArmorBp: 1500, allAtkBp: -1000 },
};
const STANCES = { aggressive: { atk: 1000, armor: -1000 }, balanced: { atk: 0, armor: 0 }, defensive: { atk: -1000, armor: 1000 } };
const CONDITIONS = [ // uniform(10000) bands
  { upTo: 6000,  id: 'calm',         text: 'Calm — no effect' },
  { upTo: 7500,  id: 'aether_storm', text: 'Aether storm — ranged attack −15% (both sides)' },
  { upTo: 9000,  id: 'temporal_fog', text: 'Temporal fog — no flanking, all attack −5%' },
  { upTo: 10000, id: 'chrono_surge', text: 'Chrono surge — Rewind +5% (both sides)' },
];

function simulateBattle(input, seedBytes) {
  if (input.commanders.length || input.abilities.length || input.decisions.length) throw new Error('ruleset 1: commanders/abilities/decisions must be empty');
  const rng = prng(seedBytes);
  const log = { stasis: {}, clash: [], rewind: {} };
  // --- Stasis ---------------------------------------------------------------
  const roll = rng.uniform(10000);
  const condition = CONDITIONS.find((c) => roll < c.upTo);
  log.stasis.condition = { roll, id: condition.id };
  const ramCount = BigInt(input.attacker.stacks.filter((s) => s.unit === 'rift_ram').reduce((a, s) => a + s.count, 0));
  const wallBp = input.defender.wallLevel ? Math.max(0, 500 * input.defender.wallLevel - 100 * Number(ramCount)) : 0;
  log.stasis.fortificationBp = wallBp;
  const prep = (side, isDefender) => {
    const F = FORMATIONS[side.formation], St = STANCES[side.stance];
    return UNIT_ORDER.filter((ut) => side.stacks.some((s) => s.unit === ut && s.count > 0)).map((ut) => {
      const U = UNITS[ut];
      const count = BigInt(side.stacks.filter((s) => s.unit === ut).reduce((a, s) => a + s.count, 0));
      const front = F.front.includes(U.cls);
      let atk = 10000 + St.atk + F.allAtkBp + (front ? F.frontAtkBp : 0) + 500 * (side.tech.weapon_alloys ?? 0) - (side.morale ? 2000 : 0);
      let arm = 10000 + St.armor + F.allArmorBp + (front ? F.frontArmorBp : 0) + 500 * (side.tech.aether_shielding ?? 0) + (isDefender ? wallBp : 0);
      if (condition.id === 'aether_storm' && U.cls === 'ranged') atk -= 1500;
      if (condition.id === 'temporal_fog') atk -= 500;
      atk = Math.max(2000, atk); arm = Math.max(2000, arm);
      return { unit: ut, U, line: front ? 'front' : 'back', count, initial: count, wounds: 0n, atkBp: BigInt(atk), armorBp: BigInt(arm) };
    });
  };
  const A = prep(input.attacker, false), Dd = prep(input.defender, true);
  log.stasis.attacker = A.map((s) => ({ unit: s.unit, count: Number(s.count), line: s.line, atkBp: Number(s.atkBp), armorBp: Number(s.armorBp) }));
  log.stasis.defender = Dd.map((s) => ({ unit: s.unit, count: Number(s.count), line: s.line, atkBp: Number(s.atkBp), armorBp: Number(s.armorBp) }));
  const pool = (s) => s.count * s.U.hp - s.wounds;
  const sidePool = (S) => S.reduce((a, s) => a + pool(s), 0n);
  const initialPool = { A: sidePool(A), D: sidePool(Dd) };
  const alive = (S) => S.some((s) => s.count > 0n);
  let attackerRetreated = false, roundsFought = 0;
  // --- Clash ----------------------------------------------------------------
  for (let r = 1; r <= CLASH_ROUNDS; r++) {
    if (!alive(A) || !alive(Dd)) break;
    roundsFought = r;
    const variance = new Map();
    for (const S of [A, Dd]) for (const s of S) if (s.count > 0n) variance.set(s, BigInt(9000 + rng.uniform(2001)));
    const dmg = new Map();
    const strikes = [];
    const strike = (S, T, sideName) => {
      for (const s of S) {
        if (s.count === 0n) continue;
        const frontAlive = T.some((t) => t.line === 'front' && t.count > 0n), backAlive = T.some((t) => t.line === 'back' && t.count > 0n);
        let line = frontAlive ? 'front' : 'back';
        if (s.U.cls === 'cavalry' && condition.id !== 'temporal_fog' && backAlive) line = 'back';
        const targets = T.filter((t) => t.line === line && t.count > 0n);
        const linePool = targets.reduce((a, t) => a + pool(t), 0n);
        let raw = s.count * s.U.atk;
        raw = (raw * s.atkBp) / BP;
        raw = (raw * variance.get(s)) / BP;
        const hits = [];
        for (const t of targets) {
          let part = (raw * pool(t)) / linePool;
          part = (part * counterBp(s.U.cls, t.U.cls)) / BP;
          const armor = (t.U.def * t.armorBp) / BP;
          const d = (part * K_ARMOR) / (K_ARMOR + armor);
          dmg.set(t, (dmg.get(t) ?? 0n) + d);
          hits.push({ target: t.unit, damage: Number(d) });
        }
        strikes.push({ side: sideName, unit: s.unit, variance: Number(variance.get(s)), line, hits });
      }
    };
    strike(A, Dd, 'attacker'); strike(Dd, A, 'defender');
    const roundLog = { round: r, strikes, attacker: [], defender: [] };
    for (const [S, key] of [[A, 'attacker'], [Dd, 'defender']]) for (const s of S) {
      const taken = dmg.get(s) ?? 0n;
      if (s.count === 0n) continue;
      s.wounds += taken;
      let deaths = s.wounds / s.U.hp; if (deaths > s.count) deaths = s.count;
      s.wounds -= deaths * s.U.hp; s.count -= deaths; if (s.count === 0n) s.wounds = 0n;
      roundLog[key].push({ unit: s.unit, damageTaken: Number(taken), deaths: Number(deaths), left: Number(s.count) });
    }
    log.clash.push(roundLog);
    const ret = input.attacker.retreatBp;
    if (ret > 0 && alive(A) && alive(Dd) && sidePool(A) * BP < initialPool.A * BigInt(ret)) { attackerRetreated = true; log.clashEnd = `attacker retreats after round ${r} (below ${ret / 100}% HP)`; break; }
  }
  let outcome;
  if (attackerRetreated) outcome = 'attacker_retreat';
  else if (!alive(Dd) && alive(A)) outcome = 'attacker_victory';
  else if (!alive(A)) outcome = 'defender_victory';
  else outcome = 'stalemate';
  // --- Rewind ---------------------------------------------------------------
  const factor = { attacker_victory: [10000, 5000], defender_victory: [5000, 10000], attacker_retreat: [5000, 10000], stalemate: [10000, 10000] }[outcome];
  const rewind = (S, side, f) => {
    if (side.rewindEnabled === false) return { bp: 0, restored: {} };
    const chrono = S.filter((s) => s.unit === 'chrononaut').reduce((a, s) => a + s.count, 0n);
    let bp = 1000 + 500 * (side.tech.rewind_mastery ?? 0) + Math.min(1000, 200 * Number(chrono / 10n)) + (condition.id === 'chrono_surge' ? 500 : 0);
    bp = Math.min(3000, bp);
    bp = Number((BigInt(bp) * BigInt(f)) / BP);
    const restored = {};
    const losses = S.map((s) => ({ s, L: s.initial - s.count }));
    if (side.rewindPriority === 'proportional') for (const { s, L } of losses) restored[s.unit] = (L * BigInt(bp)) / BP;
    else {
      let budget = losses.reduce((a, { s, L }) => a + L * unitValue(s.U), 0n) * BigInt(bp) / BP;
      const order = [...losses].sort((x, y) => { const vx = unitValue(x.s.U), vy = unitValue(y.s.U); const c = side.rewindPriority === 'elite' ? (vy > vx ? 1 : vy < vx ? -1 : 0) : (vx > vy ? 1 : vx < vy ? -1 : 0); return c !== 0 ? c : UNIT_ORDER.indexOf(x.s.unit) - UNIT_ORDER.indexOf(y.s.unit); });
      for (const { s, L } of order) { const v = unitValue(s.U); let n = budget / v; if (n > L) n = L; restored[s.unit] = n; budget -= n * v; }
    }
    for (const s of S) s.count += restored[s.unit] ?? 0n;
    return { bp, restored: Object.fromEntries(Object.entries(restored).map(([k, v]) => [k, Number(v)])) };
  };
  log.rewind.attacker = rewind(A, input.attacker, factor[0]);
  log.rewind.defender = rewind(Dd, input.defender, factor[1]);
  const survivors = (S) => Object.fromEntries(S.map((s) => [s.unit, Number(s.count)]));
  const losses = (S) => Object.fromEntries(S.map((s) => [s.unit, Number(s.initial - s.count)]));
  const result = { outcome, roundsFought, attacker: { survivors: survivors(A), losses: losses(A) }, defender: { survivors: survivors(Dd), losses: losses(Dd) }, log, draws: rng.draws() };
  return result;
}
const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v);
const resultHash = (r) => createHash('sha256').update(canonical(r)).digest('hex');

// Loot (orchestration, §9.8)
function loot({ carry, balances, caps, vaultLevel, weakTarget }) {
  const protectBp = 1000 + 200 * vaultLevel;
  const lootable = RES.map((r) => { const prot = mulBp(caps[r], protectBp); const x = balances[r] - prot; return x > 0n ? x : 0n; });
  const L = lootable.reduce((a, b) => a + b, 0n);
  let take = carry < L ? carry : L;
  if (weakTarget) take = mulBp(take, 2500);
  if (L === 0n) return { lootable, take, perResource: [0n, 0n, 0n] };
  const per = lootable.map((l) => (take * l) / L);
  let rest = take - per.reduce((a, b) => a + b, 0n);
  // largest remainder, ties by resource order
  const rems = lootable.map((l, i) => ({ i, rem: (take * l) % L })).sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.i - b.i));
  for (const { i } of rems) { if (rest === 0n) break; if (per[i] < lootable[i]) { per[i]++; rest--; } }
  return { lootable, take, perResource: per };
}

// ---------------------------------------------------------------------------
// Determinism & integer checks for combat
// ---------------------------------------------------------------------------
{
  let seed = 777;
  const rnd = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const randomSide = (def) => ({
    stacks: UNIT_ORDER.filter(() => rnd(3) > 0).map((u) => ({ unit: u, count: 1 + rnd(200) })),
    formation: Object.keys(FORMATIONS)[rnd(3)], stance: Object.keys(STANCES)[rnd(3)],
    retreatBp: def ? 0 : rnd(5000), rewindPriority: ['proportional', 'elite', 'numbers'][rnd(3)],
    tech: { weapon_alloys: rnd(3), aether_shielding: rnd(3), rewind_mastery: rnd(4) }, morale: rnd(5) === 0,
    wallLevel: def ? rnd(11) : 0, rewindEnabled: true,
  });
  let same = true, ints = true;
  for (let i = 0; i < 1000; i++) {
    const input = { rulesetVersion: 1, attacker: randomSide(false), defender: randomSide(true), commanders: [], abilities: [], decisions: [] };
    if (!input.attacker.stacks.length) input.attacker.stacks.push({ unit: 'sentinel', count: 5 });
    const seedBytes = Uint8Array.from([...Array(16)].map(() => rnd(256))); if (seedBytes.every((b) => b === 0)) seedBytes[0] = 1;
    const r1 = simulateBattle(structuredClone(input), seedBytes), r2 = simulateBattle(structuredClone(input), seedBytes);
    if (resultHash(r1) !== resultHash(r2)) { same = false; break; }
    const walk = (v) => { if (typeof v === 'number' && !Number.isInteger(v)) ints = false; else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(r1);
  }
  check(same, 'combat determinism: 1,000 random battles run twice → identical result hashes');
  check(ints, 'combat output contains integers only (no float leakage)');
}

// =============================================================================
// Worked examples (generated markdown)
// =============================================================================
const h = (n) => `${n / MS_PER_HOUR} h ${(n % MS_PER_HOUR) / 60000n} min ${(n % 60000n) / 1000n} s`;
md('# Worked examples and starter tables (GENERATED — do not edit)');
md();
md('Generated by `node docs/architecture/simulation/reference-model.mjs --write`. Every number below is computed by the reference model that implements the formulas of `GAME_SIMULATION_SPEC.md`; the model also runs the property checks listed in the spec (§11). Section numbers (W-x) are cited from the spec.');
md();

// W-1 numeric model
{
  md('## W-1 Numeric model and remainder carry (spec §2)');
  const p = 7000n; // 7 ore/h
  const ten = accrue({ p, u: 0n, d: 0n, S: 10_000n, C: 10_000n }, 0n, 10n * 60_000n).N;
  let n = 0n; for (let i = 0; i < 10; i++) n = accrue({ p, u: 0n, d: 0n, S: 10_000n, C: 10_000n }, n, 60_000n).N;
  md(`- Rate 7 ore/h = **7000 mu/h**; one whole unit = D = ${D} numerator units; per millisecond the numerator grows by exactly the rate (7000).`);
  md(`- 1 minute: N = 7000 × 60,000 = 420,000,000 → **0 ore** + remainder 420,000,000 (0.1167 ore carried, not lost).`);
  md(`- 10 × 1 minute: N = ${fmtUnits(n)}; 1 × 10 minutes: N = ${fmtUnits(ten)} → identical (**1 ore**, remainder ${ten % D}).`);
  check(n === ten && units(ten) === 1n, 'W-1 remainder carry example');
  md();
}

// W-2 cap
{
  md('## W-2 Storage cap and waste (spec §3)');
  const P = { p: 30000n, u: 0n, d: 100000n, S: 1000n, C: 1000n };
  const r = accrue(P, 990n * D, MS_PER_HOUR);
  const k = ceilDiv(10n * D, 30000n);
  md(`- Ore 990 / cap 1,000, production 30/h, no upkeep. The cap is reached after ⌈10·D / 30000⌉ = ${k} ms = ${h(k)}; the balance then stays at the sticky boundary.`);
  md(`- After 1 h: **${units(r.N)} ore**; production wasted at cap = 30 × 40/60 = **20 ore** (reported as "idle waste" in the breakdown and the 4.6 harness).`);
  check(r.N === 1000n * D && k === 1_200_000n, 'W-2 cap example');
  md();
}

// W-3 overflow decay
{
  md('## W-3 Overflow above capacity decays (spec §3.4)');
  const P = { p: 30000n, u: 0n, d: mulBp(1000n * MILLI, 1000), S: 1000n, C: 1000n };
  const r1 = accrue(P, 1300n * D, MS_PER_HOUR).N, r4 = accrue(P, 1300n * D, 4n * MS_PER_HOUR).N;
  md(`- Ore 1,300 after loot, cap 1,000, decay 10% of cap per hour = d = ${P.d} mu/h (100 ore/h); production is paused above cap (R3 velocity = −u − d = −100/h).`);
  md(`- After 1 h: **${units(r1)}**; after 4 h: **${units(r4)}** (reaches cap after 3 h, then production resumes and holds it at the cap).`);
  check(units(r1) === 1200n && r4 === 1000n * D, 'W-3 overflow decay example');
  md();
}

// W-4 flux stability
{
  md('## W-4 Flux-Matter instability (spec §3.4)');
  const city = { buildings: { command_nexus: 5, storage_vault: 5 }, research: {}, units: {}, activity: 'active' };
  const R = cityRates(city).flux;
  md(`- City with Nexus 5 + Vault 5: capacity before factor ${nexusCap(5)} + ${levelSeries(200n, 14000, 5)} = ${nexusCap(5) + levelSeries(200n, 14000, 5)}; flux factor 20% → C = **${R.C}**, stable level S = 50% = **${R.S}**, decay = 5% of C per hour = **${Number(R.d) / 1000}/h** (applies only between S and C).`);
  const P = { ...R, p: 6000n };
  const a5 = accrue(P, 300n * D, 5n * MS_PER_HOUR).N, a10 = accrue(P, 300n * D, 10n * MS_PER_HOUR).N;
  const below = accrue(P, 100n * D, 10n * MS_PER_HOUR).N, below20 = accrue(P, 100n * D, 20n * MS_PER_HOUR).N;
  const v2 = 6000n - R.d;
  md(`- Refinery making 6/h. Between S and C the velocity is 6 − ${Number(R.d) / 1000} = **${Number(v2) / 1000}/h**; below S it is +6/h.`);
  md(`  - From 300 flux (after loot): after 5 h **${units(a5)}**; after 10 h **${units(a10)}** (S is reached after ${h(ceilDiv((300n - R.S) * D, -v2))} and holds).`);
  md(`  - From 100 flux: after 10 h **${units(below)}**; after 20 h **${units(below20)}** — production beyond S is useless. The stable level is an **attractor**: below it production pushes up, above it decay wins.`);
  const P2 = { ...R, p: 30000n };
  const b = accrue(P2, R.S * D, 10n * MS_PER_HOUR).N, b2 = accrue(P2, R.S * D, 100n * MS_PER_HOUR).N;
  md(`- A refinery making 30/h (> decay) keeps growing above S at 30 − ${Number(R.d) / 1000} = **${Number(30000n - R.d) / 1000}/h**: from ${R.S}, after 10 h **${units(b)}**; it reaches the cap **${units(b2)}**.`);
  // hand-verified: C=383, S=191, d=19.15/h → 300−65.75=234; pinned 191; 100+60=160; 191; 191+108.5=299; 383
  check(R.C === 383n && R.S === 191n && units(a5) === 234n && a10 === R.S * D && units(below) === 160n && below20 === R.S * D && units(b) === 299n && b2 === R.C * D, 'W-4 flux stability example');
  md();
}

// W-5 settlement with mid-interval completion
{
  md('## W-5 Settlement across a construction completion (spec §1.4, §3.5)');
  const city = { buildings: { command_nexus: 1, ore_extractor: 1, aetherium_condenser: 1, storage_vault: 1, habitat: 1 }, research: {}, units: {}, activity: 'active',
    N: { ore: 300n * D, aetherium: 300n * D, flux: 0n } };
  const lines = [];
  const T0 = 0n; // 10:00
  settleCity(city, T0, 2n * MS_PER_HOUR, [{ at: 40n * 60_000n, label: 'construction.completed: ore_extractor → level 2', apply: (c) => { c.buildings.ore_extractor = 2; } }], (t, s) => lines.push(`  - t = 10:00 + ${h(t)}: ${s}`));
  md('- Player last settled at 10:00 with 300 ore (cap 500); Ore Extractor 1 → 2 completes at 10:40; the player opens the app at 12:00.');
  md(`- Ore rate before = Nexus 5 + Extractor L1 30 = **35/h**; after = 5 + L2 ${levelSeries(30000n, 12000, 2) / MILLI} = **${(5000n + levelSeries(30000n, 12000, 2)) / MILLI}/h**.`);
  lines.forEach((l) => md(l));
  md(`- Segment 1: 40 min × 35/h = 23.33 → segment 2: 80 min × 41/h = 54.67 → **${units(city.N.ore)} ore** at 12:00 (300 + 78; remainders carried exactly).`);
  // compare with settling at 10:20 and 11:00 too
  const city2 = { ...city, buildings: { ...city.buildings, ore_extractor: 1 }, N: { ore: 300n * D, aetherium: 300n * D, flux: 0n } };
  const ev = () => [{ at: 40n * 60_000n, label: '', apply: (c) => { c.buildings.ore_extractor = 2; } }];
  settleCity(city2, 0n, 20n * 60_000n, ev());
  settleCity(city2, 20n * 60_000n, 60n * 60_000n, ev());
  settleCity(city2, 60n * 60_000n, 2n * MS_PER_HOUR, []);
  md(`- Settling at 10:20, 11:00 and 12:00 instead gives **${units(city2.N.ore)} ore** with the same remainder (${city2.N.ore === city.N.ore ? 'identical' : 'DIFFERENT'}).`);
  check(units(city.N.ore) === 378n && city2.N.ore === city.N.ore, 'W-5 settlement split example');
  md();
}

// W-6 deficit, penalties, desertion, recovery
{
  md('## W-6 Aetherium deficit → penalties → desertion → recovery (spec §3.6)');
  const city = { buildings: { command_nexus: 1, aetherium_condenser: 0, storage_vault: 1, flux_refinery: 1 }, research: { temporal_refining: 1 }, units: { sentinel: 30 }, activity: 'active',
    N: { ore: 500n * D, aetherium: 20n * D, flux: 10n * D } };
  const r0 = cityRates(city);
  md(`- City without a Condenser: aetherium production 3/h (Nexus), upkeep 30 sentinels × 0.5 = 15/h → net **${(r0.aetherium.p - r0.aetherium.u) / MILLI}/h** from 20 aetherium; flux refinery makes ${r0.flux.p / MILLI}/h.`);
  const lines = [];
  settleCity(city, 0n, 20n * MS_PER_HOUR, [{ at: 17n * MS_PER_HOUR, label: 'construction.completed: aetherium_condenser → level 1 (+20/h)', apply: (c) => { c.buildings.aetherium_condenser = 1; } }], (t, s) => lines.push(`  - +${h(t)}: ${s}`));
  lines.forEach((l) => md(l));
  md(`- State at +20 h: sentinels **${city.units.sentinel}**, aetherium **${units(city.N.aetherium)}**, flux **${units(city.N.flux)}**; deficit ${city.aethDeficit ? 'ongoing' : 'ended'}; morale penalty until +${h(city.recoveryUntil ?? 0n)}.`);
  // hand-verified: 30 → 27 → 25 → 23 → 21 (floor 10%, min 1); +12.5/h for 3 h → 37; flux 10 + 8.33 then 3 h × 5 → 33
  check(city.units.sentinel === 21 && city.aethDeficit === false && units(city.N.aetherium) === 37n && units(city.N.flux) === 33n, 'W-6 deficit/desertion/recovery example');
  md();
}

// W-7 population
{
  md('## W-7 Population growth (spec §6)');
  const cap = NEXUS_BASE_POP + levelSeries(BUILDINGS.habitat.pop1, BUILDINGS.habitat.popG, 1);
  const g = mulBp(cap * MILLI, 500);
  const P = { p: g, u: 0n, d: 0n, S: cap, C: cap };
  const after4 = accrue(P, 40n * D, 4n * MS_PER_HOUR).N, after30 = accrue(P, 40n * D, 30n * MS_PER_HOUR).N;
  md(`- Nexus 100 + Habitat L1 60 → cap **${cap}**; growth 5% of cap per hour = **${g / MILLI}/h** (linear, stops at cap).`);
  md(`- From 40: after 4 h **${units(after4)}**; after 30 h **${units(after30)}** (capped).`);
  const employed = 3n * 1n + 3n * 1n + 1n; const drafted = 10n;
  md(`- Employed = Σ building pop × level (Extractor 3 + Condenser 3 + Vault 1 = ${employed}); drafted = units' pop (10 sentinels = ${drafted}); free = ${units(after4)} − ${employed} − ${drafted} = **${units(after4) - employed - drafted}**.`);
  check(units(after4) === 72n && after30 === 160n * D, 'W-7 population example');
  md();
}

// W-8 construction cost, duration, refund
{
  md('## W-8 Construction cost, duration, cancel refund (spec §5.1)');
  const b = BUILDINGS.ore_extractor;
  const c3 = buildingCost(b, 3), d3 = buildingDurS(b, 3), eff = effectiveDurS(d3, speedBp(3));
  md(`- Ore Extractor to level 3: cost = floor-iterated base × 1.5 per level → L1 ${buildingCost(b, 1).join('/')}, L2 ${buildingCost(b, 2).join('/')}, **L3 ${c3.join('/')}** (ore/aeth/flux).`);
  md(`- Duration: 120 s × 1.6 per level → L3 **${d3} s**; with Command Nexus 3 (+${speedBp(3) / 100}% speed): ⌈${d3} × 10000 / ${10000 + speedBp(3)}⌉ = **${eff} s**.`);
  md(`- Cancel while running: refund 80% (floor) = **${c3.map((x) => mulBp(x, 8000)).join('/')}**; cancel while still queued: 100%.`);
  check(c3[0] === 135n && eff === 280n, 'W-8 construction example');
  md();
}

// W-9 research
{
  md('## W-9 Research (spec §5.2)');
  const t = TECHS.ore_refinement;
  const c2 = buildingCost(t, 2), d2 = buildingDurS(t, 2), eff = effectiveDurS(d2, speedBp(3));
  md(`- Ore Refinement level 2: cost **${c2.join('/')}**, base duration **${d2} s**; Research Spire 3 (+10%) → **${eff} s**. Requires Spire ≥ ${spireNeeded(t.tier)} (tier ${t.tier}).`);
  md(`- Effect: ore production research bonus = 2 × 10% = +2000 bp, applied after the island bonus: Nexus 5 + Extractor L3 ${Number(levelSeries(30000n, 12000, 3)) / 1000} = ${Number(5000n + levelSeries(30000n, 12000, 3)) / 1000}/h → ×1.2 = **${Number(mulBp(5000n + levelSeries(30000n, 12000, 3), 12000)) / 1000}/h**.`);
  check(mulBp(5000n + levelSeries(30000n, 12000, 3), 12000) === 57840n, 'W-9 research-modified rate 57.84/h');
  check(eff === 1473n, 'W-9 research example');
  md();
}

// W-10 recruitment
{
  md('## W-10 Recruitment batch (spec §5.3)');
  const n = 25n, U = UNITS.sentinel;
  const dur = effectiveDurS(U.train * n, speedBp(2));
  md(`- 25 sentinels at Barracks 2: cost 25 × ${U.cost.join('/')} = **${U.cost.map((c) => c * n).join('/')}**; duration ⌈60 s × 25 × 10000 / 10500⌉ = **${dur} s** (${h(dur * 1000n)}); population reserved 25; aetherium upkeep +12.5/h starts at completion.`);
  check(dur === 1429n, 'W-10 recruitment example');
  md();
}

// W-11 movement
{
  md('## W-11 Movement and recall (spec §8)');
  const ms = travelMs([10, 10], [13, 14], ['sentinel', 'skiff_rider'], 0);
  md(`- From (10,10) to (13,14): distance = isqrt((3² + 4²) × 10⁶) = **${distMilli([10, 10], [13, 14])} milli-cells**; slowest unit sentinel 6 cells/h → ⌈5000 × 3,600,000 / 6000⌉ = **${ms} ms (${h(ms)})**.`);
  const ms2 = travelMs([10, 10], [13, 14], ['sentinel', 'skiff_rider'], 1);
  md(`- With Logistics 1 (+10%): speed 6600 → **${h(ms2)}**. Skiff riders alone (12/h): **${h(travelMs([10, 10], [13, 14], ['skiff_rider'], 0))}**.`);
  md(`- Recall 20 min after departure: the army turns around and is home **20 min** later (return time = time already travelled).`);
  const far = travelMs([0, 0], [1, 1], ['skiff_rider'], 0);
  md(`- The 1-minute floor cannot trigger with ruleset-1 speeds (shortest trip: one diagonal cell (0,0)→(1,1) by skiff riders = ${h(far)}); it exists for future fast units and gates.`);
  check(ms === 3_000_000n && ms2 === 2_727_273n + 727n, 'W-11 movement example');
  md();
}

// W-12 PRNG
{
  md('## W-12 PRNG test vectors (spec §9.2)');
  const g = prng(Uint8Array.from([1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0]));
  md(`- xoshiro128** with state words {1, 2, 3, 4} (seed bytes 01000000 02000000 03000000 04000000, little-endian): first six outputs **${[...Array(6)].map(() => g.nextU32()).join(', ')}** (identical to Blackman & Vigna's C reference, compiled and run during Part 1.4).`);
  const g2 = prng(Uint8Array.from([1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0]));
  md(`- uniform(10000) on the same seed: ${[...Array(5)].map(() => g2.uniform(10000)).join(', ')} (rejection threshold (2³² − n) mod n = ${(4294967296 - 10000) % 10000}).`);
  md();
}

// W-13 combat
const exampleSeed = Uint8Array.from([...Array(16)].map((_, i) => i + 1));
const battleInput = {
  rulesetVersion: 1,
  attacker: { stacks: [{ unit: 'sentinel', count: 40 }, { unit: 'lancer', count: 15 }, { unit: 'skiff_rider', count: 12 }], formation: 'balanced', stance: 'aggressive', retreatBp: 3000, rewindPriority: 'proportional', tech: { weapon_alloys: 1 }, morale: false, rewindEnabled: true },
  defender: { stacks: [{ unit: 'sentinel', count: 25 }, { unit: 'lancer', count: 12 }, { unit: 'colossus', count: 4 }], formation: 'balanced', stance: 'defensive', retreatBp: 0, rewindPriority: 'elite', tech: { rewind_mastery: 1 }, morale: false, wallLevel: 2, rewindEnabled: true },
  commanders: [], abilities: [], decisions: [],
};
{
  md('## W-13 A complete battle (spec §9)');
  md(`- Seed bytes \`${Buffer.from(exampleSeed).toString('hex')}\`, ruleset 1. Attacker (aggressive, balanced, retreat at 30%, Weapon Alloys 1): 40 sentinels, 15 lancers, 12 skiff riders. Defender city (defensive, balanced, Bastion Wall 2, Rewind Mastery 1, priority *elite*): 25 sentinels, 12 lancers, 4 colossi.`);
  const r = simulateBattle(structuredClone(battleInput), exampleSeed);
  const s = r.log.stasis;
  md(`- **Stasis:** condition roll ${s.condition.roll} → **${s.condition.id}**; fortification +${s.fortificationBp / 100}% armor for the defender.`);
  md('  | side | unit | count | line | attack bp | armor bp |');
  md('  |---|---|---|---|---|---|');
  for (const side of ['attacker', 'defender']) for (const x of s[side]) md(`  | ${side} | ${x.unit} | ${x.count} | ${x.line} | ${x.atkBp} | ${x.armorBp} |`);
  {
    // hand-traceable breakdown of the first attacker strike in round 1 (spec §9.4)
    const st = r.log.clash[0].strikes[0];
    const A0 = s.attacker.find((x) => x.unit === st.unit);
    const U = UNITS[st.unit];
    const tgts = s.defender.filter((x) => x.line === st.line);
    const linePool = tgts.reduce((a, x) => a + BigInt(x.count) * UNITS[x.unit].hp, 0n);
    md(`- **One strike, traced by hand** (round 1, attacker ${st.unit}, variance draw ${st.variance} bp, target line *${st.line}*, line HP pool ${linePool}):`);
    let raw = BigInt(A0.count) * U.atk; const raw0 = raw;
    raw = (raw * BigInt(A0.atkBp)) / BP; const raw1 = raw;
    raw = (raw * BigInt(st.variance)) / BP;
    md(`  raw = ${A0.count} × ${U.atk} = ${raw0} → × ${A0.atkBp}/10000 = ${raw1} → × ${st.variance}/10000 = **${raw}**`);
    for (const x of tgts) {
      const TU = UNITS[x.unit]; const pool = BigInt(x.count) * TU.hp;
      let part = (raw * pool) / linePool; const p0 = part;
      part = (part * counterBp(U.cls, TU.cls)) / BP;
      const armor = (TU.def * BigInt(x.armorBp)) / BP;
      const d = (part * K_ARMOR) / (K_ARMOR + armor);
      const engine = st.hits.find((hh) => hh.target === x.unit).damage;
      md(`  → ${x.unit}: share ${raw} × ${pool}/${linePool} = ${p0}; × counter ${counterBp(U.cls, TU.cls)}/10000 = ${part}; armor ${TU.def} × ${x.armorBp}/10000 = ${armor}; × 50/(50+${armor}) = **${d}** (engine: ${engine})`);
      check(Number(d) === engine, `W-13 hand trace matches engine for ${st.unit} → ${x.unit}`);
    }
  }
  md('- **Clash:**');
  md('  | round | side | unit | damage taken | deaths | left |');
  md('  |---|---|---|---|---|---|');
  for (const rd of r.log.clash) for (const side of ['attacker', 'defender']) for (const x of rd[side]) md(`  | ${rd.round} | ${side} | ${x.unit} | ${x.damageTaken} | ${x.deaths} | ${x.left} |`);
  if (r.log.clashEnd) md(`  - ${r.log.clashEnd}`);
  md(`- **Outcome after Clash:** \`${r.outcome}\` (${r.roundsFought} rounds).`);
  md(`- **Rewind:** attacker ${r.log.rewind.attacker.bp} bp → restored ${JSON.stringify(r.log.rewind.attacker.restored)}; defender ${r.log.rewind.defender.bp} bp → restored ${JSON.stringify(r.log.rewind.defender.restored)}.`);
  md(`- **Final:** attacker survivors ${JSON.stringify(r.attacker.survivors)} (losses ${JSON.stringify(r.attacker.losses)}); defender survivors ${JSON.stringify(r.defender.survivors)} (losses ${JSON.stringify(r.defender.losses)}).`);
  md(`- PRNG draws used: ${r.draws}. Result hash (SHA-256 of canonical JSON): \`${resultHash(r)}\` — Part 9.2 must reproduce this exactly.`);
  if (r.outcome === 'attacker_victory') {
    const carry = Object.entries(r.attacker.survivors).reduce((a, [u, n]) => a + UNITS[u].carry * BigInt(n), 0n);
    const L = loot({ carry, balances: { ore: 1800n, aetherium: 900n, flux: 120n }, caps: { ore: 2500n, aetherium: 2500n, flux: 500n }, vaultLevel: 1, weakTarget: false });
    md(`- **Loot:** carry = ${carry}; defender has 1800/900/120 with caps 2500/2500/500 and Vault 1 protecting 12% → lootable ${L.lootable.join('/')}; taken **${L.perResource.join('/')}** (total ${L.take}).`);
  }
  md();
  globalThis.__battle = r;
}
{
  md('## W-14 Outpost tier 1 and a retreat (spec §9.6, §10.3)');
  const outpost = { stacks: [{ unit: 'sentinel', count: 12 }], formation: 'balanced', stance: 'balanced', retreatBp: 0, rewindPriority: 'proportional', tech: {}, morale: false, wallLevel: 0, rewindEnabled: false };
  const att = { stacks: [{ unit: 'sentinel', count: 15 }, { unit: 'lancer', count: 5 }], formation: 'balanced', stance: 'balanced', retreatBp: 3000, rewindPriority: 'proportional', tech: {}, morale: false, rewindEnabled: true };
  const r = simulateBattle({ rulesetVersion: 1, attacker: att, defender: outpost, commanders: [], abilities: [], decisions: [] }, Uint8Array.from([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6]));
  md(`- 15 sentinels + 5 lancers vs outpost tier 1 (12 sentinels, no Rewind): outcome **${r.outcome}** in ${r.roundsFought} rounds; attacker survivors ${JSON.stringify(r.attacker.survivors)}, restored by Rewind ${JSON.stringify(r.log.rewind.attacker.restored)}.`);
  const weak = { ...att, stacks: [{ unit: 'sentinel', count: 10 }], retreatBp: 5000 };
  const strong = { ...outpost, stacks: [{ unit: 'sentinel', count: 30 }, { unit: 'lancer', count: 10 }] };
  const r2 = simulateBattle({ rulesetVersion: 1, attacker: weak, defender: strong, commanders: [], abilities: [], decisions: [] }, exampleSeed);
  md(`- 10 sentinels (retreat at 50%) vs a tier-3-sized garrison (30 sentinels, 10 lancers): **${r2.outcome}** — ${r2.log.clashEnd ?? 'no retreat'}; survivors ${JSON.stringify(r2.attacker.survivors)} (Rewind at half strength: ${r2.log.rewind.attacker.bp} bp).`);
  check(r2.outcome === 'attacker_retreat' || r2.outcome === 'defender_victory', 'W-14 weak attack does not win');
  md();
}
{
  md('## W-15 Loot with protection and the weak-target rule (spec §9.8, §10.2)');
  const L = loot({ carry: 1000n, balances: { ore: 2000n, aetherium: 700n, flux: 50n }, caps: { ore: 2500n, aetherium: 2500n, flux: 500n }, vaultLevel: 2, weakTarget: false });
  md(`- Carry 1000; defender 2000/700/50, caps 2500/2500/500, Vault 2 protects 14% of capacity (350/350/70) → lootable ${L.lootable.join('/')} (sum ${L.lootable.reduce((a, b) => a + b, 0n)}); taken proportionally with largest remainder: **${L.perResource.join('/')}**.`);
  const W = loot({ carry: 1000n, balances: { ore: 2000n, aetherium: 700n, flux: 50n }, caps: { ore: 2500n, aetherium: 2500n, flux: 500n }, vaultLevel: 2, weakTarget: true });
  md(`- Same raid against a target below 25% of the attacker's power: take × 25% → **${W.perResource.join('/')}**.`);
  check(L.perResource.reduce((a, b) => a + b, 0n) === 1000n && W.take === 250n, 'W-15 loot example');
  md();
}

{
  md('## W-16 Modifier order, inactivity, power score (spec §4.2, §10.2, §10.3, §7)');
  const city = { buildings: { command_nexus: 3, ore_extractor: 4, storage_vault: 3 }, research: { ore_refinement: 1 }, units: {}, activity: 'active', islandBonus: { ore: 1500 } };
  const base = 5000n + levelSeries(30000n, 12000, 4);
  const s1 = mulBp(base, 11500), s2 = mulBp(s1, 11000);
  const active = cityRates(city).ore.p;
  md(`- Ore: base = Nexus 5 + Extractor L4 ${Number(levelSeries(30000n, 12000, 4)) / 1000} = **${Number(base) / 1000}/h** (${base} mu/h) → 1. island +15%: ⌊${base} × 11500 / 10000⌋ = ${s1} → 2. research +10%: ⌊${s1} × 11000 / 10000⌋ = **${s2} mu/h = ${Number(s2) / 1000}/h** (engine: ${active}).`);
  const inactive = cityRates({ ...city, activity: 'inactive' }).ore.p, dormant = cityRates({ ...city, activity: 'dormant', units: { sentinel: 10 } });
  md(`- Same city after 7 days without activity (inactive, ×50%): **${Number(inactive) / 1000}/h**; after 21 days (dormant): production **${dormant.ore.p}**, upkeep **${dormant.aetherium.u}** (units frozen).`);
  check(active === s2 && s2 === 71902n && inactive === 35951n && dormant.ore.p === 0n && dormant.aetherium.u === 0n, 'W-16 modifier order example');
  const power = (bl, units) => 10 * bl + units;
  const atk = power(3 + 6 + 5 + 4 + 3 + 4 + 2, 60 + 2 * 15), def = power(1 + 1 + 1 + 1 + 1, 5);
  md(`- Power score = 10 × Σ building levels + Σ unit pop × count. Attacker: buildings 27 levels, 60 sentinels + 15 skiff riders (pop 2) → 10·27 + 90 = **${atk}**; new defender: 5 levels, 5 sentinels → **${def}**; ${def} / ${atk} = ${(def * 100 / atk).toFixed(1)}% < 25% → **weak target**, loot × 25%.`);
  check(atk === 360 && def === 55 && def * 4 < atk, 'W-16 power score example');
  const d1 = distMilli([40, 40], [44, 43]), d2 = distMilli([40, 40], [46, 40]);
  md(`- Spawn spacing (≥ 6 cells): candidate (44,43) is ${d1} milli-cells from a city at (40,40) → **rejected**; (46,40) is ${d2} → **allowed**.`);
  check(d1 === 5000n && d2 === 6000n, 'W-16 spawn distance example');
  md();
}
{
  md('## W-17 Queue shift on cancel and a resource transfer (spec §5.1, §4.3)');
  const T = (m) => BigInt(m) * 60_000n;
  const e1 = { start: 0n, dur: 280_000n }, e2dur = 450_000n;
  const e2start = e1.start + e1.dur, cancelAt = T(2);
  md(`- Queue: entry 1 (Extractor L3, 280 s) starts 10:00:00, entry 2 (Vault, 450 s) starts at entry 1's completion 10:04:40 and completes 10:12:10.`);
  md(`- Player cancels entry 1 at 10:02:00 → refund 80% of 135/45/0 = 108/36/0; entry 2 now starts **10:02:00** and completes **10:09:30** (its frozen 450 s duration is kept).`);
  check(e2start === 280_000n && cancelAt + e2dur === 570_000n, 'W-17 queue shift example');
  const dist = distMilli([10, 10], [22, 15]);
  const ms = ceilDiv(ceilDiv(dist * MS_PER_HOUR, 8000n), 1000n) * 1000n;
  md(`- Transfer (flag on in 13.12) of 600 ore from (10,10) to a colony at (22,15): distance ${dist} milli-cells at caravan speed 8 cells/h → **${h(ms)}**; maximum per transfer with Nexus 2 = 1000 units. 600 ore leave at dispatch (ledger \`transfer.out\`) and arrive later (\`transfer.in\`). If the colony holds 700/1000 ore by then, it ends at **1300**, and the 300 overflow decays at 10% of capacity per hour (W-3).`);
  check(dist === 13000n && ms === 5_850_000n, 'W-17 transfer example');
  md();
}

// Tables
md('## T-1 Building tables (ruleset v1 proposal)');
md();
for (const [id, b] of Object.entries(BUILDINGS)) {
  md(`### ${id}`);
  md('| level | cost ore/aeth/flux | base duration | effect at level |');
  md('|---|---|---|---|');
  for (let L = 1; L <= b.max; L++) {
    let eff = '';
    if (b.effect === 'prod') eff = `+${Number(levelSeries(b.prod1, b.prodG, L)) / 1000} ${b.res}/h`;
    if (b.effect === 'cap') eff = `+${levelSeries(b.cap1, b.capG, L)} capacity (× resource factor: flux 20%); protects ${10 + 2 * L}% from loot`;
    if (b.effect === 'popcap') eff = `+${levelSeries(b.pop1, b.popG, L)} population cap`;
    if (b.effect === 'speed') eff = `build speed +${speedBp(L) / 100}%; max level of other buildings = ${L}; base capacity ${nexusCap(L)}`;
    if (b.effect === 'research_speed') eff = `research speed +${speedBp(L) / 100}%; unlocks tier ${Math.floor((L + 1) / 2)}`;
    if (b.effect === 'recruit_speed') eff = `training speed +${speedBp(L) / 100}%`;
    if (b.effect === 'wall') eff = `defender armor +${5 * L}% (−1% per enemy rift ram)`;
    md(`| ${L} | ${buildingCost(b, L).join('/')} | ${h(buildingDurS(b, L) * 1000n)} | ${eff}; employs ${b.pop * BigInt(L)} pop |`);
  }
  md();
}
md('## T-2 Research (ruleset v1 proposal)');
md();
md('| tech | tier (Spire ≥) | levels | cost L1 | duration L1 | effect per level |');
md('|---|---|---|---|---|---|');
const TECH_EFFECT = { ore_refinement: '+10% ore production', aether_condensation: '+10% aetherium production', storage_engineering: '+10% capacity', logistics: '+10% army speed', temporal_refining: 'unlocks Flux Refinery', weapon_alloys: '+5% attack', aether_shielding: '+5% armor', bronze_forging: 'unlocks colossus', skiff_navigation: 'unlocks skiff rider', tactical_doctrine: 'unlocks vanguard & defensive line formations', flux_stabilization: 'flux stable level +10% of cap, decay −1%/h', siegecraft: 'unlocks rift ram', chronomancy: 'unlocks chrononaut', rewind_mastery: '+5% Rewind' };
for (const [id, t] of Object.entries(TECHS)) md(`| ${id} | ${t.tier} (${spireNeeded(t.tier)}) | ${t.max} | ${t.cost.join('/')} | ${h(t.dur * 1000n)} | ${TECH_EFFECT[id]}${t.needs ? ` (needs ${t.needs})` : ''} |`);
md();
md('## T-3 Units (ruleset v1 proposal)');
md();
md('| unit | class | attack | armor | hp | speed (cells/h) | carry | upkeep aeth/h | pop | cost | train | needs |');
md('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const ut of UNIT_ORDER) { const u = UNITS[ut]; md(`| ${ut} | ${u.cls} | ${u.atk} | ${u.def} | ${u.hp} | ${u.speed} | ${u.carry} | ${Number(u.upkeep) / 1000} | ${u.pop} | ${u.cost.join('/')} | ${u.train} s | Barracks ${u.barracks}${u.needs ? `, ${u.needs}` : ''} |`); }
md();
md('## T-4 Counter matrix (attack multiplier, bp; blank = 10000)');
md();
const classes = ['infantry', 'ranged', 'heavy', 'cavalry', 'siege', 'temporal'];
md(`| attacker \\ target | ${classes.join(' | ')} |`);
md(`|---|${classes.map(() => '---').join('|')}|`);
for (const a of classes) md(`| ${a} | ${classes.map((t) => (COUNTER[a]?.[t] ? COUNTER[a][t] : '')).join(' | ')} |`);
md();
md('## T-5 Outposts (ruleset v1 proposal)');
md();
md('| tier | garrison | loot (ore/aeth/flux) | respawn after cleared |');
md('|---|---|---|---|');
const OUTPOSTS = [
  [1, '12 sentinel', '150/75/0', 8], [2, '20 sentinel, 6 lancer', '300/150/0', 10], [3, '30 sentinel, 10 lancer, 2 colossus', '450/225/10', 12],
  [4, '40 sentinel, 15 lancer, 6 colossus', '600/300/20', 14], [5, '50 sentinel, 20 lancer, 10 colossus, 5 skiff_rider', '750/375/30', 16],
];
for (const [t, g, l, r] of OUTPOSTS) md(`| ${t} | ${g} | ${l} | ${r} h |`);
md();

// ---------------------------------------------------------------------------
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
if (process.argv.includes('--write')) {
  const file = join(dirname(fileURLToPath(import.meta.url)), 'worked-examples.generated.md');
  writeFileSync(file, out.join('\n') + '\n');
  console.log('wrote', file);
}
process.exit(failures === 0 ? 0 : 1);
