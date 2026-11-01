// =============================================================================
// Consistency check for DOMAINS.md (Part 1.5)
// Run: node docs/architecture/domains-check.mjs   (exit code 1 on any failure)
//
// Verifies the Part 1.5 "Done when" criteria mechanically:
//   1. all 29 domains (D01–D29) exist and each has all 11 fields, non-empty
//   2. every table in the executed reference schema (+ Better Auth tables) is owned by
//      exactly one domain; planned (post-MVP) tables are unique and don't collide
//   3. every event type has exactly one producer; every consumed event is produced
//   4. the event catalog table agrees with the per-domain lists (producer and consumers)
//   5. SYSTEM_ARCHITECTURE §5 (produced events per MVP domain) and §13 (post-MVP events)
//      agree with DOMAINS.md
// =============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const domainsMd = read('DOMAINS.md');
const schemaSql = read('database/mvp-reference-schema.sql');
const archMd = read('SYSTEM_ARCHITECTURE.md');

let failures = 0;
const check = (cond, label, detail = '') => {
  if (cond) console.log('CHECK OK  ', label);
  else { failures++; console.error('CHECK FAIL', label, detail); }
};
const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

const FIELDS = ['Responsibilities', 'Data ownership', 'Dependencies', 'Public interfaces', 'Database entities',
  'Business rules', 'Events produced', 'Events consumed', 'Validation requirements', 'Failure handling', 'Automated tests'];

// --- parse domain entries ----------------------------------------------------
const lines = domainsMd.split('\n');
const entries = [];
let cur = null, field = null;
for (const line of lines) {
  const head = line.match(/^### (D\d\d|P\d) — (.+)$/);
  if (head) { cur = { id: head[1], name: head[2], fields: {} }; entries.push(cur); field = null; continue; }
  if (/^#{1,3} /.test(line)) { cur = null; field = null; continue; }
  if (!cur) continue;
  const f = line.match(/^- \*\*([^*]+):\*\*\s*(.*)$/);
  if (f && FIELDS.includes(f[1])) { field = f[1]; cur.fields[field] = f[2]; continue; }
  if (field && /^\s+\S/.test(line)) cur.fields[field] += '\n' + line.trim();
}

// 1. domains and fields
const dIds = entries.filter((e) => e.id.startsWith('D')).map((e) => e.id).sort();
const expected = Array.from({ length: 29 }, (_, i) => `D${String(i + 1).padStart(2, '0')}`);
check(JSON.stringify(dIds) === JSON.stringify(expected), '29 domains D01–D29 present exactly once', JSON.stringify(dIds));
const missing = [];
for (const e of entries) for (const f of FIELDS) if (!e.fields[f] || !e.fields[f].trim()) missing.push(`${e.id}:${f}`);
check(missing.length === 0, `every entry (${entries.length} incl. platform modules) has all 11 fields`, missing.join(', '));

// 2. table ownership
const schemaTables = new Set([...schemaSql.matchAll(/create table (\w+\.\w+)/g)].map((m) => m[1]));
['auth.user', 'auth.session', 'auth.account', 'auth.verification'].forEach((t) => schemaTables.add(t));
const owners = new Map(), planned = new Map();
const add = (map, table, id) => { if (!map.has(table)) map.set(table, []); map.get(table).push(id); };
for (const e of entries) {
  const db = e.fields['Database entities'] ?? '';
  const ownsNow = db.match(/Owns:\s*([^·]*)/);
  if (ownsNow) ticks(ownsNow[1]).filter((t) => /^\w+\.\w+$/.test(t)).forEach((t) => add(owners, t, e.id));
  const ownsPlanned = db.match(/Owns \(planned\):\s*([^·]*)/);
  if (ownsPlanned) ticks(ownsPlanned[1]).filter((t) => /^\w+\.\w+$/.test(t)).forEach((t) => add(planned, t, e.id));
}
const doubles = [...owners].filter(([, ids]) => ids.length > 1).map(([t, ids]) => `${t}:${ids}`);
check(doubles.length === 0, 'no table is owned by two domains', doubles.join(', '));
const unowned = [...schemaTables].filter((t) => !owners.has(t));
check(unowned.length === 0, `every one of the ${schemaTables.size} schema tables (39 reference + 4 auth) has an owner`, unowned.join(', '));
const phantom = [...owners.keys()].filter((t) => !schemaTables.has(t));
check(phantom.length === 0, 'no domain claims a current table that does not exist in the schema', phantom.join(', '));
const plannedBad = [...planned].filter(([t, ids]) => ids.length > 1 || schemaTables.has(t)).map(([t]) => t);
check(plannedBad.length === 0, `planned post-MVP tables (${planned.size}) are unique and do not collide with MVP tables`, plannedBad.join(', '));

// 3. events
const producers = new Map(), consumers = new Map(), plannedEvents = new Set();
const postMvpStart = domainsMd.indexOf('## Post-MVP domains');
for (const e of entries) {
  const prod = e.fields['Events produced'] ?? '';
  const isPostMvp = domainsMd.indexOf(`### ${e.id} — `) > postMvpStart;
  const plannedPart = prod.includes('planned:') ? prod.slice(prod.indexOf('planned:')) : '';
  for (const ev of ticks(plannedPart)) plannedEvents.add(ev);
  if (isPostMvp) for (const ev of ticks(prod)) plannedEvents.add(ev);
  for (const ev of ticks(prod)) { if (!producers.has(ev)) producers.set(ev, []); producers.get(ev).push(e.id); }
  for (const ev of ticks(e.fields['Events consumed'] ?? '')) { if (!consumers.has(ev)) consumers.set(ev, new Set()); consumers.get(ev).add(e.id); }
}
const multi = [...producers].filter(([, ids]) => ids.length > 1).map(([ev, ids]) => `${ev}:${ids}`);
check(multi.length === 0, `every event (${producers.size}) has exactly one producer`, multi.join(', '));
const orphanConsumed = [...consumers.keys()].filter((ev) => !producers.has(ev));
check(orphanConsumed.length === 0, 'every consumed event is produced by some domain', orphanConsumed.join(', '));
const badName = [...producers.keys()].filter((ev) => !/^[a-z_]+\.[a-z_]+$/.test(ev));
check(badName.length === 0, 'event names follow <domain>.<past_tense>', badName.join(', '));

// 4. event catalog table
const catStart = domainsMd.indexOf('## Event catalog');
const catRows = domainsMd.slice(catStart).split('\n').filter((l) => /^\| `/.test(l)).map((l) => l.split('|').map((c) => c.trim()));
const catalog = new Map(catRows.map((c) => [c[1].replace(/`/g, ''), { producer: c[2], consumers: c[3] === '—' ? [] : c[3].split(',').map((x) => x.trim()) }]));
const catProblems = [];
for (const [ev, ids] of producers) {
  const row = catalog.get(ev);
  if (!row) { catProblems.push(`missing row ${ev}`); continue; }
  if (row.producer !== ids[0]) catProblems.push(`${ev} producer ${row.producer} ≠ ${ids[0]}`);
  const want = [...(consumers.get(ev) ?? [])].sort().join(','), have = [...row.consumers].sort().join(',');
  if (want !== have) catProblems.push(`${ev} consumers catalog [${have}] ≠ domains [${want}]`);
}
for (const ev of catalog.keys()) if (!producers.has(ev)) catProblems.push(`catalog row without producer: ${ev}`);
check(catProblems.length === 0, `event catalog (${catalog.size} rows) matches per-domain producers and consumers`, catProblems.join('; '));

// 5. SYSTEM_ARCHITECTURE agreement
const s5 = archMd.slice(archMd.indexOf('## 5. MVP domains'), archMd.indexOf('**Platform modules**'));
const archProblems = [];
for (const row of s5.split('\n').filter((l) => /^\| \d+ \|/.test(l))) {
  const c = row.split('|').map((x) => x.trim());
  const id = `D${String(Number(c[1])).padStart(2, '0')}`;
  for (const ev of ticks(c[6])) if ((producers.get(ev) ?? [])[0] !== id) archProblems.push(`§5 says ${id} produces ${ev}, DOMAINS says ${producers.get(ev) ?? 'nobody'}`);
  const mine = [...producers].filter(([, ids]) => ids[0] === id).map(([ev]) => ev);
  for (const ev of mine) if (!ticks(c[6]).includes(ev) && !plannedEvents.has(ev)) archProblems.push(`§5 row ${id} lacks ${ev}`);
}
const s13 = archMd.slice(archMd.indexOf('## 13. Post-MVP domains'), archMd.indexOf('## 14.'));
for (const row of s13.split('\n').filter((l) => /^\| \*\*|^\| [A-Z]/.test(l))) {
  const c = row.split('|').map((x) => x.trim());
  for (const ev of ticks(c[c.length - 2] ?? '')) if (/^[a-z_]+\.[a-z_]+$/.test(ev) && !producers.has(ev)) archProblems.push(`§13 event ${ev} has no producer in DOMAINS`);
}
check(archProblems.length === 0, 'SYSTEM_ARCHITECTURE §5/§13 events agree with DOMAINS.md', archProblems.join('; '));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
