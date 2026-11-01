/** A promise that a test resolves by hand: used as a barrier between concurrent transactions. */
export function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export const pgError = (code: string, message = `simulated ${code}`): Error =>
  Object.assign(new Error(message), { code });
