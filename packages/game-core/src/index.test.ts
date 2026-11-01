import { describe, expect, it } from 'vitest';
import { GAME_CORE_PACKAGE } from './index';

describe('@chronos/game-core pipeline', () => {
  it('is wired into lint, typecheck and test', () => {
    expect(GAME_CORE_PACKAGE).toBe('@chronos/game-core');
  });
});
