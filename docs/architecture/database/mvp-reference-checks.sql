-- =============================================================================
-- Verification of mvp-reference-schema.sql (Part 1.3)
-- Run on an EMPTY PostgreSQL 18 database, after a stand-in for Better Auth's table:
--   create schema auth; create table auth."user" (id text primary key);
--   psql -v ON_ERROR_STOP=1 -f mvp-reference-schema.sql -f mvp-reference-checks.sql
-- Every check prints "CHECK OK …" or aborts the script; the last line is "ALL CHECKS PASSED".
-- =============================================================================
\set QUIET on

-- Helper: assert that a statement fails with a given SQLSTATE.
create or replace function pg_temp.expect_error(stmt text, expected_state text, label text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then
      raise notice 'CHECK OK  %', label;
      return;
    end if;
    raise exception 'CHECK FAIL % — expected %, got % (%)', label, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'CHECK FAIL % — statement succeeded but should have failed', label;
end $$;

-- ---------- fixture -----------------------------------------------------------
insert into auth."user" (id) values ('acc_a'), ('acc_b');
insert into game.ruleset_versions (version, checksum) values (1, 'sha256:dev');
insert into game.regions (slug, name, width, height) values ('alpha', 'Alpha', 512, 512);
insert into game.sectors (region_id, name, x0, y0, x1, y1) values (1, 'core', 0, 0, 511, 511);
-- 20,000 synthetic islands for the viewport index check
insert into game.islands (region_id, sector_id, x, y, terrain, size, is_spawn_zone)
select 1, 1, (g * 7919) % 512, (g * 104729) % 509, 'stone', 1 + (g % 5), g % 10 = 0
from generate_series(1, 20000) g
on conflict (region_id, x, y) do nothing;
analyze game.islands;

insert into game.players (id, auth_user_id) values
  ('00000000-0000-7000-8000-00000000000a', 'acc_a'),
  ('00000000-0000-7000-8000-00000000000b', 'acc_b');
insert into game.civilizations (id, player_id, name, founded_at, activity_state_since) values
  ('00000000-0000-7000-8000-0000000000ca', '00000000-0000-7000-8000-00000000000a', 'Aurelians', now(), now());
insert into game.cities (id, player_id, civilization_id, island_id, region_id, name, is_capital, founded_at)
values ('00000000-0000-7000-8000-0000000000c1', '00000000-0000-7000-8000-00000000000a',
        '00000000-0000-7000-8000-0000000000ca', (select min(id) from game.islands), 1, 'Prime', true, now());
insert into game.resource_balances (city_id, resource_id, amount) values
  ('00000000-0000-7000-8000-0000000000c1', 'ore', 1000);

-- ---------- constraint checks -------------------------------------------------
select pg_temp.expect_error(
  $q$update game.resource_balances set amount = -1 where resource_id = 'ore'$q$,
  '23514', 'resource balance can never be negative');

select pg_temp.expect_error(
  $q$insert into game.players (auth_user_id) values (null)$q$,
  '23514', 'a live player must be linked to an auth account');

select pg_temp.expect_error(
  $q$insert into game.cities (player_id, civilization_id, island_id, region_id, name, is_capital, founded_at)
     values ('00000000-0000-7000-8000-00000000000a','00000000-0000-7000-8000-0000000000ca',
             (select max(id) from game.islands), 1, 'Second', true, now())$q$,
  '23505', 'at most one capital per player (many cities allowed)');

-- a second, non-capital city IS allowed by the schema (colonies, 13.12)
insert into game.cities (player_id, civilization_id, island_id, region_id, name, is_capital, founded_at)
values ('00000000-0000-7000-8000-00000000000a', '00000000-0000-7000-8000-0000000000ca',
        (select max(id) from game.islands), 1, 'Colony', false, now());
do $$ begin raise notice 'CHECK OK  schema allows several cities per player'; end $$;

select pg_temp.expect_error(
  $q$insert into game.cities (player_id, civilization_id, island_id, region_id, name, founded_at)
     values ('00000000-0000-7000-8000-00000000000a','00000000-0000-7000-8000-0000000000ca',
             (select min(id) from game.islands), 1, 'Clash', now())$q$,
  '23505', 'one city per island');

insert into game.timed_actions (kind, player_id, city_id, starts_at, completes_at, payload, ruleset_version)
values ('construction', '00000000-0000-7000-8000-00000000000a', '00000000-0000-7000-8000-0000000000c1',
        now(), now() + interval '4 hours', '{"building_type":"ore_extractor","to_level":2}', 1);
select pg_temp.expect_error(
  $q$insert into game.timed_actions (kind, player_id, city_id, starts_at, completes_at, payload, ruleset_version)
     values ('construction','00000000-0000-7000-8000-00000000000a','00000000-0000-7000-8000-0000000000c1',
             now(), now() + interval '5 hours', '{"building_type":"ore_extractor","to_level":3}', 1)$q$,
  '23505', 'no two scheduled upgrades of the same building');

select pg_temp.expect_error(
  $q$insert into game.timed_actions (kind, starts_at, completes_at, ruleset_version)
     values ('orphan', now(), now(), 1)$q$,
  '23514', 'timed action must have an owner');
select pg_temp.expect_error(
  $q$insert into game.timed_actions (kind, player_id, region_id, starts_at, completes_at, ruleset_version)
     values ('research', '00000000-0000-7000-8000-00000000000a', 1, now(), now(), 1)$q$,
  '23514', 'timed action must have exactly one owner');

select pg_temp.expect_error(
  $q$update game.timed_actions set status = 'completed' where kind = 'construction'$q$,
  '23514', 'completed status requires completed_at');

select pg_temp.expect_error(
  $q$insert into game.timed_actions (kind, player_id, starts_at, completes_at, ruleset_version)
     values ('research','00000000-0000-7000-8000-00000000000a', now(), now() - interval '1 second', 1)$q$,
  '23514', 'completes_at cannot precede starts_at');

insert into game.armies (id, player_id, home_city_id, name, formation)
values ('00000000-0000-7000-8000-0000000000a1', '00000000-0000-7000-8000-00000000000a',
        '00000000-0000-7000-8000-0000000000c1', 'First', 'balanced');
select pg_temp.expect_error(
  $q$insert into game.unit_stacks (player_id, unit_type, count)
     values ('00000000-0000-7000-8000-00000000000a', 'line_infantry', 10)$q$,
  '23514', 'a unit stack must be in exactly one place (nowhere)');
select pg_temp.expect_error(
  $q$insert into game.unit_stacks (player_id, unit_type, count, city_id, army_id)
     values ('00000000-0000-7000-8000-00000000000a', 'line_infantry', 10,
             '00000000-0000-7000-8000-0000000000c1', '00000000-0000-7000-8000-0000000000a1')$q$,
  '23514', 'a unit stack must be in exactly one place (two places)');
select pg_temp.expect_error(
  $q$insert into game.unit_stacks (player_id, unit_type, count, city_id)
     values ('00000000-0000-7000-8000-00000000000a', 'line_infantry', 0, '00000000-0000-7000-8000-0000000000c1')$q$,
  '23514', 'unit stacks never hold zero units');

-- movements: one active movement per army; one battle per arrival
insert into game.timed_actions (id, kind, player_id, target_player_id, starts_at, completes_at, ruleset_version)
values ('00000000-0000-7000-8000-0000000000d1', 'movement', '00000000-0000-7000-8000-00000000000a',
        '00000000-0000-7000-8000-00000000000b', now(), now() + interval '3 hours', 1),
       ('00000000-0000-7000-8000-0000000000d2', 'movement', '00000000-0000-7000-8000-00000000000a',
        null, now(), now() + interval '3 hours', 1);
insert into game.movements (id, player_id, army_id, timed_action_id, mission, region_id,
                            origin_island_id, target_island_id, departed_at, arrives_at)
values ('00000000-0000-7000-8000-0000000000e1', '00000000-0000-7000-8000-00000000000a',
        '00000000-0000-7000-8000-0000000000a1', '00000000-0000-7000-8000-0000000000d1', 'attack_city', 1,
        (select min(id) from game.islands), (select max(id) from game.islands), now(), now() + interval '3 hours');
select pg_temp.expect_error(
  $q$insert into game.movements (player_id, army_id, timed_action_id, mission, region_id,
                                 origin_island_id, target_island_id, departed_at, arrives_at)
     values ('00000000-0000-7000-8000-00000000000a','00000000-0000-7000-8000-0000000000a1',
             '00000000-0000-7000-8000-0000000000d2','attack_outpost',1,
             (select min(id) from game.islands),(select max(id) from game.islands), now(), now() + interval '1 hour')$q$,
  '23505', 'an army has at most one active movement');

do $$ begin
  if not (select is_interaction from game.timed_actions where id = '00000000-0000-7000-8000-0000000000d1') then
    raise exception 'CHECK FAIL is_interaction should be true for a movement targeting a player';
  end if;
  raise notice 'CHECK OK  movement against another player is flagged as an interaction';
end $$;

insert into game.battles (region_id, island_id, occurred_at, movement_id, attacker_player_id, defender_player_id,
                          ruleset_version, engine_version, seed, input_snapshot, result, result_hash, outcome)
values (1, (select max(id) from game.islands), now(), '00000000-0000-7000-8000-0000000000e1',
        '00000000-0000-7000-8000-00000000000a', '00000000-0000-7000-8000-00000000000b',
        1, 'combat@0.0.0', '\x0102030405060708', '{}', '{}', decode(repeat('ab', 32), 'hex'), 'attacker_victory');
select pg_temp.expect_error(
  $q$insert into game.battles (region_id, island_id, occurred_at, movement_id, attacker_player_id, defender_player_id,
                               ruleset_version, engine_version, seed, input_snapshot, result, result_hash, outcome)
     select region_id, island_id, occurred_at, movement_id, attacker_player_id, defender_player_id,
            ruleset_version, engine_version, seed, input_snapshot, result, result_hash, outcome from game.battles$q$,
  '23505', 'one battle per movement arrival (idempotent orchestration)');
select pg_temp.expect_error(
  $q$update game.battles set outcome = 'draw'$q$, '42501', 'battles are append-only (update)');
select pg_temp.expect_error(
  $q$delete from game.battles$q$, '42501', 'battles are append-only (delete)');

insert into game.resource_ledger (city_id, player_id, resource_id, delta, balance_after, reason, occurred_at)
values ('00000000-0000-7000-8000-0000000000c1', '00000000-0000-7000-8000-00000000000a', 'ore', -200, 800,
        'construction.cost', now());
select pg_temp.expect_error(
  $q$update game.resource_ledger set delta = -1$q$, '42501', 'ledger is append-only');
select pg_temp.expect_error(
  $q$insert into game.resource_ledger (city_id, player_id, resource_id, delta, balance_after, reason, occurred_at)
     values ('00000000-0000-7000-8000-0000000000c1','00000000-0000-7000-8000-00000000000a','ore', 0, 800, 'noop', now())$q$,
  '23514', 'ledger rows never have a zero delta');

select pg_temp.expect_error(
  $q$insert into platform.audit_log (actor_kind, actor_account_id, action) values ('admin','acc_b','resources.grant')$q$,
  '23514', 'admin audit entries require a reason');

select pg_temp.expect_error(
  $q$update game.players set auth_user_id = null where auth_user_id = 'acc_b'$q$,
  '23514', 'auth account cannot be detached before the player is anonymised');

-- account deletion order: anonymise player, then delete auth user (FK sets null)
update game.players set status = 'deleted', deleted_at = now()
 where id = '00000000-0000-7000-8000-00000000000b';
delete from auth."user" where id = 'acc_b';
do $$ begin
  if (select auth_user_id from game.players where id = '00000000-0000-7000-8000-00000000000b') is not null then
    raise exception 'CHECK FAIL auth deletion should null the link';
  end if;
  raise notice 'CHECK OK  account deletion keeps game history and unlinks the auth account';
end $$;

select pg_temp.expect_error(
  $q$insert into game.player_profiles (player_id, display_name) values
       ('00000000-0000-7000-8000-00000000000a', 'Chronos'),
       ('00000000-0000-7000-8000-00000000000b', 'CHRONOS')$q$,
  '23505', 'display names are unique case-insensitively');

-- ---------- index usage checks ------------------------------------------------
-- realistic history: 50,000 completed actions next to the few scheduled ones
insert into game.timed_actions (kind, status, player_id, starts_at, completes_at, completed_at, ruleset_version)
select 'research', 'completed', '00000000-0000-7000-8000-00000000000a',
       now() - (g || ' minutes')::interval - interval '1 hour', now() - (g || ' minutes')::interval,
       now() - (g || ' minutes')::interval, 1
from generate_series(1, 50000) g;
analyze game.timed_actions;

do $$
declare plan json;
begin
  execute $q$explain (format json)
    select id, x, y, terrain, occupant_kind from game.islands
    where region_id = 1 and chunk_x between 3 and 5 and chunk_y between 2 and 4$q$ into plan;
  if plan::text not like '%islands_chunk_idx%' and plan::text not like '%islands_region_id_x_y_key%' then
    raise exception 'CHECK FAIL viewport query does not use an index: %', plan;
  end if;
  raise notice 'CHECK OK  viewport query uses an index (% islands)', (select count(*) from game.islands);
end $$;

do $$
declare plan json;
begin
  execute $q$explain (format json)
    select id from game.timed_actions where status = 'scheduled'
      and completes_at < now() order by completes_at limit 100$q$ into plan;
  if plan::text not like '%timed_actions_due_idx%' then
    raise exception 'CHECK FAIL reconciler query does not use timed_actions_due_idx: %', plan;
  end if;
  raise notice 'CHECK OK  reconciler due-actions query uses timed_actions_due_idx';
end $$;

do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;
