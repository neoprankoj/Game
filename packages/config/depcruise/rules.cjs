// Dependency rules for the whole monorepo (ADR-0001, ADR-0011, SYSTEM_ARCHITECTURE §3.2).
// Paths are relative to the repository root. A rule "forbids" the edge it describes.
// Packages a layer may import are listed positively; everything else in packages/ is forbidden.
// Layering applies to source (src/); tooling files (eslint/vitest configs) may import @chronos/config.

/** Forbid `from` → any workspace package except the allowed ones (plus itself). */
const onlyAllowed = (name, pkg, allowed) => ({
  name,
  severity: 'error',
  comment: `${pkg} may import only: ${allowed.length ? allowed.join(', ') : 'nothing'} (SYSTEM_ARCHITECTURE §3.2)`,
  from: { path: `^packages/${pkg}/src/` },
  to: { path: '^packages/', pathNot: `^packages/(${[pkg, ...allowed].join('|')})/` },
});

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies anywhere (CLAUDE.md §6).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'packages-not-to-apps',
      severity: 'error',
      comment: 'apps/* depend on packages, never the reverse (CLAUDE.md §6).',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'tools-not-to-apps',
      severity: 'error',
      comment: 'tools/* reuse packages, never app internals (ADR-0011).',
      from: { path: '^tools/' },
      to: { path: '^apps/' },
    },
    {
      name: 'apps-not-to-other-apps',
      severity: 'error',
      comment: 'An app never imports another app; shared code belongs in a package.',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'game-pure-no-node-builtins',
      severity: 'error',
      comment:
        'game-* source is pure: no I/O, clock or OS access (CLAUDE.md §6). Tooling config files are exempt.',
      from: { path: '^packages/game-[^/]+/src/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'contracts-client-safe',
      severity: 'error',
      comment: 'contracts is imported by the Expo client: no Node built-ins in its source (Part 2.4).',
      from: { path: '^packages/contracts/src/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'apps-db-only-in-composition-root',
      severity: 'error',
      comment:
        'API and workers reach the database through the application layer; only the composition root (main.ts, deps.ts) wires @chronos/db (SYSTEM_ARCHITECTURE §3.2).',
      from: { path: '^apps/(api|workers)/src/', pathNot: '^apps/(api|workers)/src/(main|deps)\\.ts$' },
      to: { path: '^packages/db/' },
    },
    {
      name: 'client-not-to-server-packages',
      severity: 'error',
      comment: 'The client never imports persistence or use cases (SYSTEM_ARCHITECTURE §3.2).',
      from: { path: '^apps/client/' },
      to: { path: '^packages/(db|application)/' },
    },
    // Layering of the pure packages (SYSTEM_ARCHITECTURE §3.2 / ADR-0011).
    onlyAllowed('layer-game-core', 'game-core', []),
    onlyAllowed('layer-game-data', 'game-data', ['game-core']),
    onlyAllowed('layer-game-temporal', 'game-temporal', ['game-core']),
    onlyAllowed('layer-game-economy', 'game-economy', ['game-core', 'game-data', 'game-temporal']),
    onlyAllowed('layer-game-world', 'game-world', ['game-core', 'game-data']),
    onlyAllowed('layer-game-combat', 'game-combat', ['game-core', 'game-data']),
    onlyAllowed('layer-game-progression', 'game-progression', [
      'game-core',
      'game-data',
      'game-temporal',
      'game-economy',
    ]),
    onlyAllowed('layer-game-military', 'game-military', [
      'game-core',
      'game-data',
      'game-temporal',
      'game-economy',
      'game-progression',
      'game-world',
    ]),
    onlyAllowed('layer-contracts', 'contracts', ['game-core', 'game-data']),
    onlyAllowed('layer-db', 'db', ['game-core']),
    onlyAllowed('layer-design-system', 'design-system', []),
    onlyAllowed('layer-config', 'config', []),
    {
      name: 'layer-application',
      severity: 'error',
      comment: 'application may import game-*, game-data, db and contracts — not UI or tooling config.',
      from: { path: '^packages/application/' },
      to: { path: '^packages/(design-system)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|dist|coverage|\\.turbo)/|/test/fixtures/' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.mts', '.js', '.mjs', '.cjs'],
    },
  },
};
