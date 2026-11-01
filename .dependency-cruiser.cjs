// Import-graph rules (ADR-0001, ADR-0011, SYSTEM_ARCHITECTURE §3.2). The rules live in
// packages/config so they are unit-tested there against fixtures.
module.exports = require('./packages/config/depcruise/rules.cjs');
