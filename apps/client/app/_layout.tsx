import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Text } from 'react-native';
import { createClient } from '../src/api';
import { ApiClientContext } from '../src/client-context';
import { clientConfig } from '../src/config';
import { Button, Screen, colors, styles } from '../src/ui';

export default function RootLayout() {
  const client = useMemo(() => (clientConfig.ok ? createClient(clientConfig.config) : null), []);
  if (!clientConfig.ok || !client) {
    return (
      <Screen title="Configuration error">
        <Text style={styles.danger} testID="config-error">
          {clientConfig.ok ? 'API client unavailable' : clientConfig.problem}
        </Text>
        <Text style={styles.muted}>Set EXPO_PUBLIC_API_URL (see .env.example) and rebuild.</Text>
      </Screen>
    );
  }
  return (
    <ApiClientContext value={client}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.panel },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </ApiClientContext>
  );
}

/** Route-level error boundary (Expo Router): a crash in a screen shows this instead of a white screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Screen title="Something went wrong">
      <Text style={styles.danger} testID="error-boundary">
        {error.message}
      </Text>
      <Button label="Try again" onPress={() => void retry()} />
    </Screen>
  );
}
