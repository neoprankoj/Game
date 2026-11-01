#!/usr/bin/env node
// Local development stack: `pnpm dev:up | dev:down | dev:reset | dev:status` (Part 2.2).
// Dependency-free on purpose: it must work on a fresh machine before anything else is set up.
// @ts-check
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const composeFile = join(root, 'infrastructure', 'docker-compose.yml');
const envFile = join(root, '.env');
const envExample = join(root, '.env.example');

/** @param {string} msg */
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};
/** @param {string} msg */
const ok = (msg) => console.log(`✔ ${msg}`);

/** @param {string} file */
function parseEnv(file) {
  /** @type {Record<string, string>} */
  const vars = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1]) vars[m[1]] = (m[2] ?? '').replace(/^["']|["']$/g, '');
  }
  return vars;
}

/**
 * @param {string[]} args
 * @param {{ capture?: boolean }} [opts]
 */
function docker(args, opts = {}) {
  const r = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: opts.capture ? 'pipe' : 'inherit',
  });
  if (r.error)
    fail(`Could not run docker (${r.error.message}). Install Docker Desktop or Docker Engine first.`);
  return { code: r.status ?? 1, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

/** @param {string[]} args @param {{ capture?: boolean }} [opts] */
const compose = (args, opts) => docker(['compose', '-f', composeFile, '--env-file', envFile, ...args], opts);

function preflight() {
  if (docker(['info'], { capture: true }).code !== 0)
    fail('Docker is installed but the Docker daemon is not running. Start Docker and retry.');
  if (docker(['compose', 'version'], { capture: true }).code !== 0)
    fail('Docker Compose v2 (`docker compose`) is required.');
  if (!existsSync(envFile)) fail('No .env file. Create it first:  cp .env.example .env');
  const env = parseEnv(envFile);
  const missing = Object.keys(parseEnv(envExample)).filter((k) => !(k in env));
  if (missing.length)
    fail(
      `.env is missing variables that .env.example defines: ${missing.join(', ')}. Copy them from .env.example.`,
    );
  return env;
}

/** @param {Record<string, string>} env */
function verify(env) {
  let problems = 0;
  /** @param {boolean} cond @param {string} good @param {string} bad */
  const expect = (cond, good, bad) => {
    if (cond) ok(good);
    else {
      problems++;
      console.error(`✖ ${bad}`);
    }
  };
  const ps = compose(['ps', '--format', '{{.Service}} {{.Health}}'], { capture: true }).out;
  for (const svc of ['postgres', 'redis'])
    expect(
      new RegExp(`^${svc} healthy$`, 'm').test(ps),
      `${svc} is healthy`,
      `${svc} is not healthy (docker compose ps: ${ps || 'nothing running'})`,
    );
  if (problems) return problems;

  const psql = (/** @type {string} */ db, /** @type {string} */ sql) =>
    compose(['exec', '-T', 'postgres', 'psql', '-U', env.POSTGRES_USER ?? '', '-d', db, '-tAc', sql], {
      capture: true,
    }).out;
  const version = psql(env.POSTGRES_DB ?? '', 'show server_version');
  expect(version.startsWith('18.'), `PostgreSQL ${version}`, `expected PostgreSQL 18.x, got "${version}"`);
  const tz = psql(env.POSTGRES_DB ?? '', 'show timezone');
  expect(tz === 'UTC', 'database timezone is UTC', `database timezone is "${tz}", expected UTC (rule 5)`);
  const testDb = psql(
    env.POSTGRES_DB ?? '',
    `select 1 from pg_database where datname = '${env.POSTGRES_TEST_DB}'`,
  );
  expect(
    testDb === '1',
    `test database "${env.POSTGRES_TEST_DB}" exists`,
    `test database "${env.POSTGRES_TEST_DB}" missing (run pnpm dev:reset)`,
  );
  const uuid = psql(env.POSTGRES_DB ?? '', 'select uuidv7()');
  expect(/^[0-9a-f-]{36}$/.test(uuid), 'uuidv7() available (DATABASE_DESIGN §2)', 'uuidv7() not available');

  const cli = (/** @type {string[]} */ args) =>
    compose(
      ['exec', '-T', 'redis', 'redis-cli', '-a', env.REDIS_PASSWORD ?? '', '--no-auth-warning', ...args],
      { capture: true },
    ).out;
  const info = cli(['INFO', 'server']);
  const redisVersion = (info.match(/redis_version:(\S+)/) ?? [])[1] ?? '?';
  expect(redisVersion.startsWith('8.'), `Redis ${redisVersion}`, `expected Redis 8.x, got ${redisVersion}`);
  const policy = cli(['CONFIG', 'GET', 'maxmemory-policy']).split('\n')[1];
  expect(
    policy === 'noeviction',
    'maxmemory-policy noeviction (BullMQ, ADR-0008)',
    `maxmemory-policy is "${policy}", BullMQ needs noeviction`,
  );
  const aof = cli(['CONFIG', 'GET', 'appendonly']).split('\n')[1];
  expect(aof === 'yes', 'AOF persistence on', `appendonly is "${aof}"`);
  const anon = compose(['exec', '-T', 'redis', 'redis-cli', 'PING'], { capture: true });
  expect(
    !/PONG/.test(anon.out),
    'Redis rejects unauthenticated clients',
    'Redis accepted a client without a password',
  );

  console.log(
    `\nConnection strings (from .env):\n  DATABASE_URL       ${redact(env.DATABASE_URL)}\n  TEST_DATABASE_URL  ${redact(env.TEST_DATABASE_URL)}\n  REDIS_URL          ${redact(env.REDIS_URL)}`,
  );
  return problems;
}

/** @param {string | undefined} url */
const redact = (url) => (url ?? '(unset)').replace(/:\/\/([^:@/]*):[^@]*@/, '://$1:****@');

const command = process.argv[2];
switch (command) {
  case 'up': {
    const env = preflight();
    console.log('Starting PostgreSQL and Redis (waits until healthy)…');
    if (compose(['up', '-d', '--wait']).code !== 0)
      fail(
        'docker compose up failed (see output above). Is a port already in use? Change POSTGRES_PORT/REDIS_PORT and the URLs in .env.',
      );
    process.exit(verify(env) ? 1 : 0);
    break;
  }
  case 'status': {
    const env = preflight();
    process.exit(verify(env) ? 1 : 0);
    break;
  }
  case 'down': {
    preflight();
    compose(['down']);
    ok('stopped (data kept; `pnpm dev:reset` deletes it)');
    break;
  }
  case 'reset': {
    const env = preflight();
    console.log(
      'Resetting: deleting the local PostgreSQL and Redis volumes (all local dev data), then starting fresh…',
    );
    compose(['down', '--volumes']);
    if (compose(['up', '-d', '--wait']).code !== 0) fail('docker compose up failed after reset.');
    process.exit(verify(env) ? 1 : 0);
    break;
  }
  default:
    fail('usage: node infrastructure/scripts/dev.mjs <up|down|reset|status>');
}
