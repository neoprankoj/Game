import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';
import { Screen, styles } from '../src/ui';

/** Placeholder: email + password sign-in arrives in Part 2.8 (ADR-0007). No fake form until it works. */
export default function SignIn() {
  return (
    <Screen title="Sign in">
      <Stack.Screen options={{ title: 'Sign in' }} />
      <Text style={styles.muted} testID="sign-in-placeholder">
        Accounts arrive in Part 2.8.
      </Text>
      <Link href="/" style={styles.text}>
        ← Home
      </Link>
    </Screen>
  );
}
