// Values the global setup provides to test files (vitest provide/inject). Imported by both sides so the
// augmentation is visible in every package that uses @chronos/db/testing.
declare module 'vitest' {
  export interface ProvidedContext {
    chronosDbAdminUrl: string;
    chronosDbTemplate: string;
    chronosDbPrefix: string;
  }
}

export {};
