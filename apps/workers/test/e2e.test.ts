import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { deletePrefix, testPrefix } from './helpers';

const dir = fileURLToPath(new URL('..', import.meta.url));
const prefix = testPrefix();
afterAll(async () => {
  await deletePrefix(prefix);
});

function run(args: string[], env: Record<string, string>) {
  const child = spawn(process.execPath, ['--import', 'tsx', ...args], {
    cwd: dir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d: Buffer) => (output += d.toString()));
  child.stderr.on('data', (d: Buffer) => (output += d.toString()));
  const exit = new Promise<number | null>((resolve) => child.on('exit', resolve));
  return { child, exit, output: () => output };
}

describe('end to end (Part 2.6 "Done when"): real worker process + enqueue script', () => {
  it('processes the sample job once, dead-letters the failing job after its retries, and shuts down cleanly', async () => {
    const env = {
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      QUEUE_PREFIX: prefix,
      RECONCILER_INTERVAL_MS: '60000',
    };
    const worker = run(['src/main.ts'], env);
    const deadline = Date.now() + 15_000;
    while (!worker.output().includes('workers started')) {
      if (Date.now() > deadline) throw new Error(`worker did not start:\n${worker.output()}`);
      await new Promise((r) => setTimeout(r, 50));
    }

    const script = run(['scripts/enqueue-sample.ts'], env);
    expect(await script.exit).toBe(0); // the script exits on its own: no leaked connections
    const steps = script
      .output()
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(steps[0]).toMatchObject({
      step: 'echo',
      state: 'completed',
      attemptsMade: 1,
      result: { echoed: 'hello from enqueue-sample' },
    });
    expect(steps[1]).toMatchObject({ step: 'fail', state: 'failed', attemptsMade: 3, failedSetSize: 1 });

    worker.child.kill('SIGTERM');
    expect(await worker.exit).toBe(0);
    expect(worker.output()).toContain('shutdown complete');
  });
});
