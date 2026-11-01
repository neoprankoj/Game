// Shared ESLint flat config (ADR-0002). Every workspace's eslint.config.js calls defineChronosConfig().
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Rules for pure game packages (CLAUDE.md §6, §8): no clock, randomness, I/O or infrastructure.
 * Exported separately so they can be unit-tested (packages/config/test).
 */
/** @type {import('eslint').Linter.RulesRecord} */
export const pureGameRules = {
  'no-restricted-properties': [
    'error',
    {
      object: 'Date',
      property: 'now',
      message: 'Inject a Clock (game-temporal); never read the wall clock in game rules.',
    },
    {
      object: 'performance',
      property: 'now',
      message: 'Inject a Clock; never read the wall clock in game rules.',
    },
    {
      object: 'Math',
      property: 'random',
      message: 'Inject a seeded Prng (game-core); never use Math.random in game rules.',
    },
    {
      object: 'crypto',
      property: 'getRandomValues',
      message: 'Inject a seeded Prng; game rules must be deterministic.',
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date']",
      message: 'Use Instant values from an injected Clock, not Date.',
    },
    {
      selector: "CallExpression[callee.name='Date']",
      message: 'Use Instant values from an injected Clock, not Date.',
    },
  ],
  'no-restricted-globals': [
    'error',
    { name: 'setTimeout', message: 'Game rules are timestamp-driven; no timers (rule 6).' },
    { name: 'setInterval', message: 'Game rules are timestamp-driven; no timers (rule 6).' },
    { name: 'fetch', message: 'Game rules perform no I/O.' },
    { name: 'process', message: 'Game rules read no environment; inject configuration.' },
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { regex: '^node:', message: 'Game rules perform no I/O (no Node built-ins).' },
        {
          regex: '^(fs|path|os|http|https|net|child_process|crypto|worker_threads|timers)(/|$)',
          message: 'Game rules perform no I/O (no Node built-ins).',
        },
        {
          regex: '^@chronos/(db|contracts|application|design-system)(/|$)',
          message: 'game-* packages may import only game-core, game-data and lower game-* layers (ADR-0011).',
        },
        { regex: '(^|/)apps/', message: 'Packages never import apps (CLAUDE.md §6).' },
      ],
    },
  ],
};

/** Rules for every non-app package: packages never reach into apps. */
/** @type {import('eslint').Linter.RulesRecord} */
export const packageRules = {
  'no-restricted-imports': [
    'error',
    { patterns: [{ regex: '(^|/)apps/', message: 'Packages never import apps (CLAUDE.md §6).' }] },
  ],
};

/**
 * @param {{ tsconfigRootDir: string, kind: 'pure' | 'package' | 'app', ignores?: string[] }} options
 */
export function defineChronosConfig({ tsconfigRootDir, kind, ignores = [] }) {
  return defineConfig(
    { ignores: ['dist/**', 'coverage/**', '.turbo/**', 'node_modules/**', ...ignores] },
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
        globals: kind === 'pure' ? {} : globals.node,
      },
      rules: {
        // `any` only with a commented reason (CLAUDE.md §8) → disable per line with a justification.
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        eqeqeq: ['error', 'always'],
      },
    },
    kind === 'pure' ? { rules: pureGameRules } : kind === 'package' ? { rules: packageRules } : {},
    { files: ['**/*.js', '**/*.cjs', '**/*.mjs'], extends: [tseslint.configs.disableTypeChecked] },
    { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
    prettier,
  );
}
