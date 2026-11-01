import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';
import { Screen, styles } from '../src/ui';

export default function NotFound() {
  return (
    <Screen title="Not found">
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text style={styles.muted}>This screen does not exist.</Text>
      <Link href="/" style={styles.text}>
        ← Home
      </Link>
    </Screen>
  );
}
