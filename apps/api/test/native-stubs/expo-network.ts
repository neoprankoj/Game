// Stand-in for expo-network (test/native-client.test.ts): no network change events.
export const addNetworkStateListener = () => ({ remove: () => undefined });
