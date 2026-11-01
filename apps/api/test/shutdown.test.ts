import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '@chronos/db/testing';

const t = useTestDatabase();
const apiDir = fileURLToPath(new URL('..', import.meta.url));

describe('process lifecycle (real process)', () => {
  it('starts, serves, and on SIGTERM drains and exits 0', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: apiDir,
      env: { ...process.env, NODE_ENV: 'test', API_PORT: '0', LOG_LEVEL: 'info', DATABASE_URL: t.url },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr.on('data', (d: Buffer) => (output += d.toString()));
    const address = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`API did not start:\n${output}`));
      }, 15_000);
      child.stdout.on('data', () => {
        const m = /Server listening at (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (m?.[1]) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
    });
    const health = await fetch(`${address}/health`);
    expect(health.status).toBe(200);
    const ready = await fetch(`${address}/ready`);
    expect(ready.status).toBe(200);

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('exit', resolve);
      child.kill('SIGTERM');
    });
    expect(exitCode).toBe(0);
    expect(output).toContain('shutdown started');
    expect(output).toContain('shutdown complete');
  });
});
