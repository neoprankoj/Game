import { Password } from '@chronos/contracts';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../src/client-context';
import { codeOfAuthError, messageFor } from '../src/errors';
import { Button, Field, FormError, Screen, styles } from '../src/ui';
import { useSubmit } from '../src/use-submit';

/** Landing screen of the emailed reset link (`?token=…`, or `?error=INVALID_TOKEN` for a bad/expired link). */
export default function ResetPassword() {
  const { token, error: linkError } = useLocalSearchParams<{ token?: string; error?: string }>();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const { pending, error, run } = useSubmit();

  const submit = async () => {
    if (!token) return;
    const ok = await run(async () => {
      if (!Password.safeParse(password).success) return 'VALIDATION_FAILED';
      const result = await auth.resetPassword({ newPassword: password, token });
      return result.error ? codeOfAuthError(result.error) : null;
    });
    setDone(ok);
  };

  if (linkError || !token) {
    return (
      <Screen title="Reset password">
        <Stack.Screen options={{ title: 'Reset password' }} />
        <Text style={styles.danger} testID="form-error">
          {messageFor('AUTH_TOKEN_INVALID')}
        </Text>
        <Link href="/forgot-password" style={styles.link}>
          Ask for a new link
        </Link>
      </Screen>
    );
  }
  return (
    <Screen title="Reset password">
      <Stack.Screen options={{ title: 'Reset password' }} />
      {done ? (
        <>
          <Text style={styles.text} testID="reset-done">
            Your password was changed and all your devices were signed out.
          </Text>
          <Link href="/sign-in" style={styles.link} testID="to-sign-in">
            Sign in with the new password
          </Link>
        </>
      ) : (
        <>
          <Field
            label="New password (at least 10 characters)"
            testID="password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            onSubmitEditing={() => void submit()}
          />
          <FormError message={error} />
          <Button label="Set new password" onPress={() => void submit()} disabled={pending} testID="submit" />
        </>
      )}
    </Screen>
  );
}
