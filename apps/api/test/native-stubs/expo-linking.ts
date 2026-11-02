// Stand-in for expo-linking (test/native-client.test.ts): deep links on the app scheme.
export const createURL = (path: string, opts?: { scheme?: string }): string =>
  `${opts?.scheme ?? 'chronoscradle'}://${path.replace(/^\//, '')}`;
