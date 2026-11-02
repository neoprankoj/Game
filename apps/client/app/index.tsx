import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useApiClient, useAuth } from '../src/client-context';
import { useApiStatus } from '../src/use-api-status';
import { Button, Loading, Screen, styles } from '../src/ui';

/** Home (placeholder). Real content: the live API status and the session, both from the real backend (rule 17). */
export default function Home() {
  const { status, refresh } = useApiStatus(useApiClient());
  const session = useAuth().useSession();
  return (
    <Screen title="Chronos Cradle">
      <Stack.Screen options={{ title: 'Home' }} />
      <Text style={styles.muted}>Client shell (Parts 2.7–2.8). Gameplay screens arrive in S06.</Text>
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
      <View style={styles.panel}>
        {session.isPending ? (
          <Loading label="Checking your session…" />
        ) : session.data ? (
          <>
            <Text style={styles.text} testID="session">
              Signed in as {session.data.user.email}
            </Text>
            <Link href="/account" style={styles.link} testID="to-account">
              Your account →
            </Link>
          </>
        ) : (
          <>
            <Text style={styles.muted} testID="session">
              Not signed in
            </Text>
            <Link href="/sign-in" style={styles.link} testID="to-sign-in">
              Sign in →
            </Link>
            <Link href="/sign-up" style={styles.link} testID="to-sign-up">
              Create an account →
            </Link>
          </>
        )}
      </View>
    </Screen>
  );
}
