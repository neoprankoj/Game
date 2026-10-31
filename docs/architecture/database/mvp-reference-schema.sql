-- =============================================================================
-- Chronos Cradle — MVP reference schema (Part 1.3 design artifact)
-- =============================================================================
-- Purpose: an exact, executable statement of DATABASE_DESIGN.md, verified against
-- PostgreSQL 18 (see mvp-reference-checks.sql). It is a DESIGN REFERENCE, not a
-- migration: each Part creates its own tables via Drizzle in packages/db, and from
-- then on the Drizzle schema + committed migrations are authoritative.
--
-- Prerequisite: schema "auth" with table auth."user"(id text primary key) created by
-- Better Auth's migrations (ADR-0007). Identifier conventions: DATABASE_DESIGN.md §2.
-- =============================================================================

create schema if not exists game;
create schema if not exists platform;

-- Append-only guard used by ledger, battles and audit tables.
create or replace function platform.forbid_update_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'table %.% is append-only', tg_table_schema, tg_table_name
    using errcode = '42501';
end $$;

-- -----------------------------------------------------------------------------
-- Simulation core: rulesets
-- -----------------------------------------------------------------------------
create table game.ruleset_versions (
  version      int primary key check (version > 0),
  checksum     text not null,                       -- hash of the game-data bundle
  activated_at timestamptz not null default now(),
  notes        text
);

-- -----------------------------------------------------------------------------
-- World: regions → sectors → islands (+ outposts)
-- -----------------------------------------------------------------------------
create table game.regions (
  id         int generated always as identity primary key,
  slug       text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name       text not null,
  width      int not null check (width > 0),
  height     int not null check (height > 0),
  status     text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create table game.world_generation_runs (
  id                uuid primary key default uuidv7(),
  region_id         int not null references game.regions (id),
  seed              bytea not null check (octet_length(seed) between 8 and 32),
  generator_version int not null check (generator_version > 0),
  params            jsonb not null,
  created_at        timestamptz not null default now()
);

create table game.sectors (
  id        int generated always as identity primary key,
  region_id int not null references game.regions (id),
  name      text not null,
  x0 int not null, y0 int not null, x1 int not null, y1 int not null,
  check (x0 <= x1 and y0 <= y1),
  unique (region_id, name)
);

create table game.islands (
  id             bigint generated always as identity primary key,
  region_id      int not null references game.regions (id),
  sector_id      int not null references game.sectors (id),
  x              int not null check (x >= 0),
  y              int not null check (y >= 0),
  chunk_x        int generated always as (x / 32) stored,   -- 32×32 map chunks
  chunk_y        int generated always as (y / 32) stored,
  terrain        text not null check (terrain ~ '^[a-z][a-z0-9_]{1,31}$'),
  size           smallint not null check (size between 1 and 5),
  bonus_resource text check (bonus_resource ~ '^[a-z][a-z0-9_]{1,31}$'),
  bonus_bp       int not null default 0 check (bonus_bp between 0 and 10000),
  is_spawn_zone  boolean not null default false,
  occupant_kind  text not null default 'none'
                 check (occupant_kind in ('none', 'city', 'outpost', 'reserved')),
  unique (region_id, x, y)
);
create index islands_chunk_idx      on game.islands (region_id, chunk_x, chunk_y);
create index islands_free_spawn_idx on game.islands (region_id, id)
  where is_spawn_zone and occupant_kind = 'none';

create table game.outposts (
  id         uuid primary key default uuidv7(),
  island_id  bigint not null unique references game.islands (id),
  region_id  int not null references game.regions (id),
  tier       smallint not null check (tier between 1 and 10),
  status     text not null default 'active' check (status in ('active', 'cleared')),
  cleared_at timestamptz,
  settled_at timestamptz not null,
  check ((status = 'cleared') = (cleared_at is not null))
);

create table game.outpost_garrison (
  outpost_id uuid not null references game.outposts (id),
  unit_type  text not null check (unit_type ~ '^[a-z][a-z0-9_]{1,39}$'),
  count      int not null check (count > 0),
  primary key (outpost_id, unit_type)
);

-- -----------------------------------------------------------------------------
-- Players, profiles, civilizations, cities
-- -----------------------------------------------------------------------------
create table game.players (                         -- ROOT LOCK ROW per player
  id             uuid primary key default uuidv7(),
  auth_user_id   text unique references auth."user" (id) on delete set null,
  status         text not null default 'active'
                 check (status in ('active', 'suspended', 'dormant', 'deleted')),
  created_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  deleted_at     timestamptz,
  check ((status = 'deleted') = (deleted_at is not null)),
  -- the auth user may only disappear after the player was anonymised
  check (status = 'deleted' or auth_user_id is not null)
);

create table game.player_settlement (                -- owned by Simulation core
  player_id  uuid primary key references game.players (id),
  settled_at timestamptz not null
);

create table game.player_profiles (
  player_id    uuid primary key references game.players (id),
  display_name text not null check (char_length(display_name) between 3 and 24),
  avatar_key   text,
  banner_key   text,
  show_stats   boolean not null default true,
  updated_at   timestamptz not null default now()
);
create unique index player_profiles_display_name_uq on game.player_profiles (lower(display_name));

create table game.player_stats (                     -- read model, fed by events
  player_id        uuid primary key references game.players (id),
  battles_won      int not null default 0 check (battles_won >= 0),
  battles_lost     int not null default 0 check (battles_lost >= 0),
  outposts_cleared int not null default 0 check (outposts_cleared >= 0),
  updated_at       timestamptz not null default now()
);

create table game.civilizations (
  id                      uuid primary key default uuidv7(),
  player_id               uuid not null unique references game.players (id),
  name                    text not null check (char_length(name) between 3 and 32),
  founded_at              timestamptz not null,
  protection_until        timestamptz,
  protection_ended_reason text check (protection_ended_reason in ('expired', 'attacked_other', 'forfeited')),
  activity_state          text not null default 'active'
                          check (activity_state in ('active', 'inactive', 'dormant')),
  activity_state_since    timestamptz not null
);
create unique index civilizations_name_uq on game.civilizations (lower(name));

create table game.cities (
  id              uuid primary key default uuidv7(),
  player_id       uuid not null references game.players (id),
  civilization_id uuid not null references game.civilizations (id),
  island_id       bigint not null unique references game.islands (id),
  region_id       int not null references game.regions (id),
  name            text not null check (char_length(name) between 2 and 32),
  is_capital      boolean not null default false,
  founded_at      timestamptz not null
);
create index cities_player_idx on game.cities (player_id);
create unique index cities_one_capital_uq on game.cities (player_id) where is_capital;

create table game.city_buildings (
  city_id       uuid not null references game.cities (id),
  building_type text not null check (building_type ~ '^[a-z][a-z0-9_]{1,39}$'),
  level         smallint not null check (level >= 0),
  primary key (city_id, building_type)
);

-- -----------------------------------------------------------------------------
-- Economy
-- -----------------------------------------------------------------------------
create table game.city_economy (                     -- the city's economy clock
  city_id    uuid primary key references game.cities (id),
  settled_at timestamptz not null
);

create table game.resource_balances (
  city_id     uuid not null references game.cities (id),
  resource_id text not null check (resource_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  amount      bigint not null check (amount >= 0),       -- whole units
  remainder   bigint not null default 0 check (remainder >= 0), -- sub-unit carry (scale: SIM_SPEC)
  primary key (city_id, resource_id)
);

create table game.resource_deficits (
  id             uuid primary key default uuidv7(),
  city_id        uuid not null references game.cities (id),
  resource_id    text not null check (resource_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  started_at     timestamptz not null,
  ended_at       timestamptz,
  recovery_until timestamptz,                             -- penalty fade-out, rules in SIM_SPEC
  check (ended_at is null or ended_at >= started_at)
);
create unique index resource_deficits_open_uq on game.resource_deficits (city_id, resource_id)
  where ended_at is null;

create table game.resource_ledger (
  id            bigint generated always as identity primary key,
  city_id       uuid not null references game.cities (id),
  player_id     uuid not null references game.players (id),
  resource_id   text not null check (resource_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  delta         bigint not null check (delta <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reason        text not null check (reason ~ '^[a-z][a-z0-9_.]{1,63}$'),
  ref_kind      text,
  ref_id        text,
  occurred_at   timestamptz not null,                     -- game time of the change
  recorded_at   timestamptz not null default now(),       -- wall time of the write
  details       jsonb
);
create index resource_ledger_city_idx on game.resource_ledger (city_id, resource_id, id);
create index resource_ledger_ref_idx  on game.resource_ledger (ref_kind, ref_id) where ref_id is not null;
create trigger resource_ledger_append_only before update or delete on game.resource_ledger
  for each row execute function platform.forbid_update_delete();

-- -----------------------------------------------------------------------------
-- Progression: population, research
-- -----------------------------------------------------------------------------
create table game.city_population (
  city_id    uuid primary key references game.cities (id),
  population int not null check (population >= 0),
  remainder  bigint not null default 0 check (remainder >= 0),
  settled_at timestamptz not null
);

create table game.player_research (
  player_id    uuid not null references game.players (id),
  tech_id      text not null check (tech_id ~ '^[a-z][a-z0-9_]{1,39}$'),
  level        smallint not null default 1 check (level >= 1),
  completed_at timestamptz not null,
  primary key (player_id, tech_id)
);

-- -----------------------------------------------------------------------------
-- Simulation core: timed actions
-- -----------------------------------------------------------------------------
create table game.timed_actions (
  id                uuid primary key default uuidv7(),
  kind              text not null check (kind ~ '^[a-z][a-z0-9_]{1,31}$'),
  status            text not null default 'scheduled'
                    check (status in ('scheduled', 'completed', 'cancelled')),
  -- exactly one owner (player | outpost | region-scoped world action)
  player_id         uuid references game.players (id),
  outpost_id        uuid references game.outposts (id),
  region_id         int references game.regions (id),
  city_id           uuid references game.cities (id),          -- city scope, when relevant
  -- counterparty for INTERACTIONS (SYSTEM_ARCHITECTURE §4.3)
  target_player_id  uuid references game.players (id),
  target_outpost_id uuid references game.outposts (id),
  is_interaction    boolean generated always as
                    (target_player_id is not null or target_outpost_id is not null) stored,
  starts_at         timestamptz not null,
  completes_at      timestamptz not null,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  payload           jsonb not null default '{}',               -- Zod-validated per kind
  ruleset_version   int not null references game.ruleset_versions (version),
  version           int not null default 0,                    -- optimistic check for jobs
  created_at        timestamptz not null default now(),
  check (num_nonnulls(player_id, outpost_id, region_id) = 1),
  check (num_nonnulls(target_player_id, target_outpost_id) <= 1),
  check (completes_at >= starts_at),
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null))
);
create index timed_actions_due_idx on game.timed_actions (completes_at)
  where status = 'scheduled';
create index timed_actions_player_due_idx on game.timed_actions (player_id, completes_at, id)
  where status = 'scheduled' and player_id is not null;
create index timed_actions_target_player_due_idx on game.timed_actions (target_player_id, completes_at, id)
  where status = 'scheduled' and target_player_id is not null;
create index timed_actions_outpost_due_idx on game.timed_actions (outpost_id, completes_at, id)
  where status = 'scheduled' and outpost_id is not null;
create index timed_actions_target_outpost_due_idx on game.timed_actions (target_outpost_id, completes_at, id)
  where status = 'scheduled' and target_outpost_id is not null;
-- defence in depth: never two scheduled upgrades of the same building
create unique index timed_actions_one_upgrade_per_building_uq
  on game.timed_actions (city_id, (payload ->> 'building_type'))
  where kind = 'construction' and status = 'scheduled';

-- -----------------------------------------------------------------------------
-- Military
-- -----------------------------------------------------------------------------
create table game.armies (
  id                   uuid primary key default uuidv7(),
  player_id            uuid not null references game.players (id),
  home_city_id         uuid not null references game.cities (id),
  name                 text not null check (char_length(name) between 1 and 32),
  status               text not null default 'home'
                       check (status in ('home', 'outbound', 'stationed', 'returning', 'destroyed', 'disbanded')),
  stationed_at_city_id uuid references game.cities (id),
  formation            text not null check (formation ~ '^[a-z][a-z0-9_]{1,31}$'),
  commander_id         uuid,                 -- FK to game.commanders added in 13.13 (NOT VALID → VALIDATE)
  created_at           timestamptz not null default now(),
  ended_at             timestamptz,
  check ((status in ('destroyed', 'disbanded')) = (ended_at is not null)),
  check ((status = 'stationed') = (stationed_at_city_id is not null))
);
create index armies_player_active_idx on game.armies (player_id) where ended_at is null;
create unique index armies_commander_uq on game.armies (commander_id)
  where commander_id is not null and ended_at is null;

create table game.doctrines (
  id                   uuid primary key default uuidv7(),
  player_id            uuid not null references game.players (id),
  army_id              uuid unique references game.armies (id),
  city_id              uuid unique references game.cities (id),
  stance               text not null check (stance ~ '^[a-z][a-z0-9_]{1,31}$'),
  retreat_threshold_bp int not null check (retreat_threshold_bp between 0 and 10000),
  rewind_priority      text not null check (rewind_priority ~ '^[a-z][a-z0-9_]{1,31}$'),
  updated_at           timestamptz not null default now(),
  check (num_nonnulls(army_id, city_id) = 1)
);

create table game.unit_stacks (
  id        uuid primary key default uuidv7(),
  player_id uuid not null references game.players (id),
  unit_type text not null check (unit_type ~ '^[a-z][a-z0-9_]{1,39}$'),
  count     int not null check (count > 0),
  city_id   uuid references game.cities (id),    -- garrison …
  army_id   uuid references game.armies (id),    -- … or army: exactly one place
  check (num_nonnulls(city_id, army_id) = 1)
);
create unique index unit_stacks_garrison_uq on game.unit_stacks (city_id, unit_type) where city_id is not null;
create unique index unit_stacks_army_uq     on game.unit_stacks (army_id, unit_type) where army_id is not null;
create index unit_stacks_player_idx         on game.unit_stacks (player_id);

create table game.movements (
  id                uuid primary key default uuidv7(),
  player_id         uuid not null references game.players (id),
  army_id           uuid not null references game.armies (id),
  timed_action_id   uuid not null unique references game.timed_actions (id),
  mission           text not null check (mission in ('attack_outpost', 'attack_city', 'reinforce', 'return')),
  region_id         int not null references game.regions (id),
  origin_island_id  bigint not null references game.islands (id),
  target_island_id  bigint not null references game.islands (id),
  target_city_id    uuid references game.cities (id),
  target_outpost_id uuid references game.outposts (id),
  departed_at       timestamptz not null,
  arrives_at        timestamptz not null,
  status            text not null default 'travelling'
                    check (status in ('travelling', 'arrived', 'recalled', 'aborted')),
  ended_at          timestamptz,
  check (arrives_at > departed_at),
  check (num_nonnulls(target_city_id, target_outpost_id) <= 1),
  check ((status = 'travelling') = (ended_at is null))
);
create unique index movements_one_active_per_army_uq on game.movements (army_id) where status = 'travelling';
create index movements_incoming_city_idx  on game.movements (target_city_id, arrives_at) where status = 'travelling';
create index movements_player_active_idx  on game.movements (player_id) where status = 'travelling';

create table game.movement_cargo (               -- loot in transit (part of resource conservation)
  movement_id uuid not null references game.movements (id),
  resource_id text not null check (resource_id ~ '^[a-z][a-z0-9_]{1,31}$'),
  amount      bigint not null check (amount > 0),
  primary key (movement_id, resource_id)
);

-- -----------------------------------------------------------------------------
-- Combat
-- -----------------------------------------------------------------------------
create table game.battles (
  id                  uuid primary key default uuidv7(),
  region_id           int not null references game.regions (id),
  island_id           bigint not null references game.islands (id),
  occurred_at         timestamptz not null,
  movement_id         uuid not null unique references game.movements (id),  -- one battle per arrival
  attacker_player_id  uuid not null references game.players (id),
  defender_player_id  uuid references game.players (id),
  defender_outpost_id uuid references game.outposts (id),
  ruleset_version     int not null references game.ruleset_versions (version),
  engine_version      text not null,
  seed                bytea not null check (octet_length(seed) between 8 and 32),
  input_snapshot      jsonb not null,
  result              jsonb not null,
  result_hash         bytea not null check (octet_length(result_hash) = 32),
  outcome             text not null check (outcome ~ '^[a-z][a-z0-9_]{1,31}$'),
  created_at          timestamptz not null default now(),
  check (num_nonnulls(defender_player_id, defender_outpost_id) = 1)
);
create index battles_attacker_idx on game.battles (attacker_player_id, occurred_at desc);
create index battles_defender_idx on game.battles (defender_player_id, occurred_at desc)
  where defender_player_id is not null;
create trigger battles_append_only before update or delete on game.battles
  for each row execute function platform.forbid_update_delete();

create table game.battle_reports (
  id             uuid primary key default uuidv7(),
  battle_id      uuid not null references game.battles (id),
  player_id      uuid not null references game.players (id),
  side           text not null check (side in ('attacker', 'defender')),
  report_version int not null check (report_version > 0),
  content        jsonb not null,
  created_at     timestamptz not null default now(),
  read_at        timestamptz,
  unique (battle_id, player_id)
);
create index battle_reports_inbox_idx on game.battle_reports (player_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Onboarding
-- -----------------------------------------------------------------------------
create table game.tutorial_progress (
  player_id         uuid not null references game.players (id),
  step_id           text not null check (step_id ~ '^[a-z][a-z0-9_]{1,39}$'),
  completed_at      timestamptz not null,
  reward_granted_at timestamptz,
  primary key (player_id, step_id)
);

-- -----------------------------------------------------------------------------
-- Notifications (player-facing)
-- -----------------------------------------------------------------------------
create table game.notifications (
  id              uuid primary key default uuidv7(),
  player_id       uuid not null references game.players (id),
  category        text not null check (category ~ '^[a-z][a-z0-9_]{1,31}$'),
  type            text not null,
  params          jsonb not null default '{}',
  source_event_id bigint,                         -- outbox id: idempotent consumption
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  unique (player_id, source_event_id)
);
create index notifications_inbox_idx  on game.notifications (player_id, created_at desc);
create index notifications_unread_idx on game.notifications (player_id) where read_at is null;

create table game.device_tokens (
  id             uuid primary key default uuidv7(),
  player_id      uuid not null references game.players (id),
  token          text not null unique,
  platform       text not null check (platform in ('ios', 'android', 'web')),
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  invalidated_at timestamptz
);
create index device_tokens_player_idx on game.device_tokens (player_id) where invalidated_at is null;

create table game.notification_prefs (
  player_id           uuid primary key references game.players (id),
  disabled_categories text[] not null default '{}',
  quiet_start_minute  smallint check (quiet_start_minute between 0 and 1439),
  quiet_end_minute    smallint check (quiet_end_minute between 0 and 1439),
  time_zone           text not null default 'UTC',          -- IANA name, validated in app
  check (num_nulls(quiet_start_minute, quiet_end_minute) in (0, 2))
);

-- -----------------------------------------------------------------------------
-- Platform: outbox, per-player event sequence, consumers, idempotency, audit
-- -----------------------------------------------------------------------------
create table platform.outbox_events (
  id             bigint generated always as identity primary key,
  event_id       uuid not null unique default uuidv7(),
  type           text not null check (type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  schema_version smallint not null default 1 check (schema_version > 0),
  producer       text not null,
  payload        jsonb not null,
  occurred_at    timestamptz not null,
  created_at     timestamptz not null default now(),
  published_at   timestamptz,
  attempts       int not null default 0 check (attempts >= 0),
  last_error     text
);
create index outbox_unpublished_idx on platform.outbox_events (id) where published_at is null;

create table platform.player_event_cursors (     -- LEAF lock rank (see §5)
  player_id uuid primary key references game.players (id),
  last_seq  bigint not null default 0 check (last_seq >= 0)
);

create table platform.player_events (
  player_id       uuid not null references game.players (id),
  seq             bigint not null check (seq > 0),
  outbox_event_id bigint not null references platform.outbox_events (id),
  created_at      timestamptz not null default now(),
  primary key (player_id, seq)
);

create table platform.event_consumptions (
  consumer        text not null,
  outbox_event_id bigint not null references platform.outbox_events (id),
  consumed_at     timestamptz not null default now(),
  primary key (consumer, outbox_event_id)
);

create table platform.idempotency_keys (
  account_id      text not null references auth."user" (id) on delete cascade,
  key             text not null check (char_length(key) between 16 and 128),
  request_hash    bytea not null check (octet_length(request_hash) = 32),
  route           text not null,
  response_status smallint not null,
  response_body   jsonb not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  primary key (account_id, key)
);
create index idempotency_keys_expiry_idx on platform.idempotency_keys (expires_at);

create table platform.audit_log (                -- no FKs: must outlive what it describes
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  actor_kind       text not null check (actor_kind in ('player', 'admin', 'system')),
  actor_account_id text,
  actor_player_id  uuid,
  action           text not null check (action ~ '^[a-z][a-z0-9_.]+$'),
  target_kind      text,
  target_id        text,
  reason           text,
  request_id       text,
  ip_prefix        inet,                          -- truncated (/24, /48) for privacy
  details          jsonb not null default '{}',
  check (actor_kind <> 'admin' or reason is not null)
);
create index audit_log_target_idx on platform.audit_log (target_kind, target_id, occurred_at);
create index audit_log_actor_idx  on platform.audit_log (actor_account_id, occurred_at);
create index audit_log_player_idx on platform.audit_log (actor_player_id, occurred_at);
create trigger audit_log_append_only before update or delete on platform.audit_log
  for each row execute function platform.forbid_update_delete();

create table platform.fairness_signals (
  id                bigint generated always as identity primary key,
  kind              text not null check (kind ~ '^[a-z][a-z0-9_.]+$'),
  player_id         uuid not null,
  related_player_id uuid,
  score             int not null default 0,
  details           jsonb not null default '{}',
  observed_at       timestamptz not null default now()
);
create index fairness_signals_player_idx on platform.fairness_signals (player_id, observed_at);
create index fairness_signals_kind_idx   on platform.fairness_signals (kind, observed_at);
