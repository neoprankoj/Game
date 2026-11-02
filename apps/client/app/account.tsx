import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useApiClient, useAuth } from '../src/client-context';
import { codeOfAuthError, messageFor } from '../src/errors';
import { useAccount } from '../src/use-account';
import { Button, Field, FormError, Loading, Screen, styles } from '../src/ui';
import { useSubmit } from '../src/use-submit';

/** The signed-in account (GET /account, a protected route): sign out and delete (required by the app stores). */
export default function Account() {
  const auth = useAuth();
  const router = useRouter();
  const account = useAccount(useApiClient());
  const [password, setPassword] = useState('');
  const signOut = useSubmit();
  const remove = useSubmit();

  const doSignOut = async () => {
    const ok = await signOut.run(async () => {
      const result = await auth.signOut();
      return result.error ? codeOfAuthError(result.error) : null;
    });
    if (ok) router.dismissTo('/'); // back to the existing Home instead of stacking a second one
  };

  const doDelete = async () => {
    const ok = await remove.run(async () => {
      if (password.length === 0) return 'AUTH_INVALID_CREDENTIALS';
      const result = await auth.deleteUser({ password });
      return result.error ? codeOfAuthError(result.error) : null;
    });
    if (ok) {
      await auth.signOut().catch(() => undefined); // clears native secure storage; the server session is gone
      router.dismissTo('/');
    }
  };

  return (
    <Screen title="Account">
      <Stack.Screen options={{ title: 'Account' }} />
      {account.state === 'loading' && <Loading label="Loading your account…" />}
      {account.state === 'error' && (
        <>
          <Text style={styles.danger} testID="account-error">
            {account.code === 'UNAUTHENTICATED' ? 'Sign in to see your account.' : messageFor(account.code)}
          </Text>
          <Link href="/sign-in" style={styles.link} testID="to-sign-in">
            Sign in
          </Link>
        </>
      )}
      {account.state === 'ready' && (
        <>
          <View style={styles.panel}>
            <Text style={styles.text} testID="account-email">
              {account.email}
            </Text>
            <Text style={styles.muted} testID="account-role">
              Role: {account.role}
            </Text>
          </View>
          <FormError message={signOut.error} />
          <Button
            label="Sign out"
            onPress={() => void doSignOut()}
            disabled={signOut.pending}
            testID="sign-out"
          />
          <View style={styles.panel}>
            <Text style={styles.text}>Delete account</Text>
            <Text style={styles.muted}>
              This permanently deletes your account and signs you out everywhere. Enter your password to
              confirm.
            </Text>
            <Field
              label="Password"
              testID="delete-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />
            <FormError message={remove.error} />
            <Button
              label="Delete my account permanently"
              tone="danger"
              onPress={() => void doDelete()}
              disabled={remove.pending}
              testID="delete-account"
            />
          </View>
        </>
      )}
    </Screen>
  );
}
