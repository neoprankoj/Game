import { EmailAddress } from '@chronos/contracts';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../src/client-context';
import { codeOfAuthError } from '../src/errors';
import { appUrl } from '../src/links';
import { Button, Field, FormError, Screen, styles } from '../src/ui';
import { useSubmit } from '../src/use-submit';

/** Request a reset link. The answer is the same for unknown addresses (no account enumeration). */
export default function ForgotPassword() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { pending, error, run } = useSubmit();

  const submit = async () => {
    const address = email.trim().toLowerCase();
    const ok = await run(async () => {
      if (!EmailAddress.safeParse(address).success) return 'VALIDATION_FAILED';
      const result = await auth.requestPasswordReset({
        email: address,
        redirectTo: appUrl('/reset-password'),
      });
      return result.error ? codeOfAuthError(result.error) : null;
    });
    setSent(ok);
  };

  return (
    <Screen title="Forgot password">
      <Stack.Screen options={{ title: 'Forgot password' }} />
      {sent ? (
        <Text style={styles.text} testID="reset-requested">
          If an account exists for {email.trim().toLowerCase()}, we sent a link to reset its password. It is
          valid for 1 hour.
        </Text>
      ) : (
        <>
          <Field
            label="Email"
            testID="email"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            keyboardType="email-address"
          />
          <FormError message={error} />
          <Button label="Send reset link" onPress={() => void submit()} disabled={pending} testID="submit" />
        </>
      )}
      <Link href="/sign-in" style={styles.link}>
        Back to sign in
      </Link>
    </Screen>
  );
}
