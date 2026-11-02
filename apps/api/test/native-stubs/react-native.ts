// Stand-in for react-native in test/native-client.test.ts (aliased in vitest.config.ts): an iOS device.
export const Platform = { OS: 'ios' as const };
export const AppState = { addEventListener: () => ({ remove: () => undefined }) };
