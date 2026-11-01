import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useApiClient } from '../src/client-context';
import { useApiStatus } from '../src/use-api-status';
import { Button, Loading, Screen, styles } from '../src/ui';

/** Home (placeholder). The only real content is the live API status, from the real backend (rule 17). */
export default function Home() {
  const { status, refresh } = useApiStatus(useApiClient());
  return (
    <Screen title="Chronos Cradle">
      <Stack.Screen options={{ title: 'Home' }} />
      <Text style={styles.muted}>Client shell (Part 2.7). Gameplay screens arrive in S06.</Text>
      <View style={styles.panel}>
        {status.state === 'loading' && <Loading label="Contacting the API…" />}
        {status.state === 'online' && (
          <>
            <Text style={styles.text} testID="api-status">
              API: online
            </Text>
            <Text style={styles.muted} testID="api-ready">
              {status.ready ? 'ready' : 'not ready'} · database {status.database} · redis {status.redis}
            </Text>
          </>
        )}
        {status.state === 'offline' && (
          <>
            <Text style={styles.danger} testID="api-status">
              API: unreachable
            </Text>
            <Text style={styles.muted}>{status.reason}</Text>
            <Button label="Retry" onPress={refresh} testID="retry" />
          </>
        )}
      </View>
      <Link href="/sign-in" style={styles.text} testID="to-sign-in">
        Sign in →
      </Link>
    </Screen>
  );
}
