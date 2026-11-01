// Proves the boundary rules of CLAUDE.md §6 / ADR-0011 actually fire (Part 2.1 "Done when").
// The fixture under test/fixtures/repo mimics the real layout (apps/*, packages/game-*).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cruise } from 'dependency-cruiser';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { pureGameRules } from '../eslint/index.js';

const require = createRequire(import.meta.url);
const rules = require('../depcruise/rules.cjs') as { forbidden: unknown[]; options: Record<string, unknown> };
const fixtureRoot = fileURLToPath(new URL('./fixtures/repo', import.meta.url));

interface Violation {
  rule: { name: string };
  from: string;
  to: string;
}

async function violations(): Promise<Violation[]> {
  const result = await cruise(['apps', 'packages'], {
    validate: true,
    ruleSet: { forbidden: rules.forbidden } as never,
    baseDir: fixtureRoot,
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: rules.options.enhancedResolveOptions as never,
  });
  const output = result.output as { summary: { violations: Violation[] } };
  return output.summary.violations;
}

const has = (all: Violation[], rule: string, from: string): boolean =>
  all.some((v) => v.rule.name === rule && v.from.startsWith(from));

describe('dependency-cruiser boundary rules', () => {
  it('fails when a game-* package imports from apps/*', async () => {
    expect(has(await violations(), 'packages-not-to-apps', 'packages/game-demo/src/bad-imports-app.ts')).toBe(
      true,
    );
  });

  it('fails when a game-* package imports a Node built-in', async () => {
    expect(has(await violations(), 'game-pure-no-node-builtins', 'packages/game-demo/src/bad-node.ts')).toBe(
      true,
    );
  });

  it('enforces layering: game-combat may not import game-economy', async () => {
    expect(has(await violations(), 'layer-game-combat', 'packages/game-combat/src/bad-layer.ts')).toBe(true);
  });

  it('allows permitted layer edges (game-military → game-economy, game-core)', async () => {
    const v = await violations();
    expect(v.filter((x) => x.from.startsWith('packages/game-military/'))).toEqual([]);
    expect(v.filter((x) => x.from.startsWith('packages/game-economy/'))).toEqual([]);
  });

  it('detects circular dependencies', async () => {
    expect(has(await violations(), 'no-circular', 'packages/game-world/src/')).toBe(true);
  });

  it('forbids one app importing another', async () => {
    expect(has(await violations(), 'apps-not-to-other-apps', 'apps/other/src/index.ts')).toBe(true);
  });
});

describe('ESLint purity rules for game-* packages', () => {
  const eslint = new ESLint({
    cwd: fixtureRoot,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser }, rules: pureGameRules },
    ],
  });
  const lint = async (code: string): Promise<string[]> => {
    const [result] = await eslint.lintText(code, { filePath: `${fixtureRoot}/packages/game-demo/src/x.ts` });
    return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse-error');
  };

  it.each([
    ['Date.now()', 'export const t = Date.now();', 'no-restricted-properties'],
    ['Math.random()', 'export const r = Math.random();', 'no-restricted-properties'],
    ['new Date()', 'export const d = new Date();', 'no-restricted-syntax'],
    ['setTimeout', 'setTimeout(() => 0, 1);', 'no-restricted-globals'],
    [
      'node:fs import',
      "import { readFileSync } from 'node:fs';\nexport const f = readFileSync;",
      'no-restricted-imports',
    ],
    ['@chronos/db import', "import { x } from '@chronos/db';\nexport const y = x;", 'no-restricted-imports'],
    [
      'apps import',
      "import { a } from '../../../apps/api/src/a';\nexport const b = a;",
      'no-restricted-imports',
    ],
  ])('rejects %s', async (_label, code, rule) => {
    expect(await lint(code)).toContain(rule);
  });

  it('accepts a pure function that receives time as an argument', async () => {
    expect(
      await lint('export const later = (nowMs: number, durationMs: number): number => nowMs + durationMs;'),
    ).toEqual([]);
  });
});
