import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Text } from 'react-native';
import { createClient } from '../src/api';
import { createAuth } from '../src/auth';
import { ServicesContext, type Services } from '../src/client-context';
import { clientConfig } from '../src/config';
import { Button, Screen, colors, styles } from '../src/ui';

export default function RootLayout() {
  const services = useMemo((): Services | null => {
    if (!clientConfig.ok) return null;
    const auth = createAuth(clientConfig.config);
    return { auth, api: createClient(clientConfig.config, auth) };
  }, []);
  if (!clientConfig.ok || !services) {
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
    <ServicesContext value={services}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.panel },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </ServicesContext>
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
