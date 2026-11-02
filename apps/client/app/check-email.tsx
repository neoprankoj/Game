import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../src/client-context';
import { codeOfAuthError } from '../src/errors';
import { appUrl } from '../src/links';
import { Button, FormError, Screen, styles } from '../src/ui';
import { useSubmit } from '../src/use-submit';

/** After sign-up: the account works once the emailed link is opened. */
export default function CheckEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const auth = useAuth();
  const [resent, setResent] = useState(false);
  const { pending, error, run } = useSubmit();

  const resend = async () => {
    if (!email) return;
    const ok = await run(async () => {
      const result = await auth.sendVerificationEmail({ email, callbackURL: appUrl('/') });
      return result.error ? codeOfAuthError(result.error) : null;
    });
    setResent(ok);
  };

  return (
    <Screen title="Check your email">
      <Stack.Screen options={{ title: 'Check your email' }} />
      <Text style={styles.text} testID="check-email">
        We sent a confirmation link to {email ?? 'your address'}. Open it to activate your account.
      </Text>
      <Text style={styles.muted}>
        No email? Check your spam folder or send a new link. If the address already had an account, we sent a
        notice there instead.
      </Text>
      <FormError message={error} />
      {resent && <Text style={styles.muted}>A new link is on its way.</Text>}
      {email ? (
        <Button label="Send a new link" onPress={() => void resend()} disabled={pending} testID="resend" />
      ) : null}
      <Link href="/sign-in" style={styles.link}>
        Go to sign in
      </Link>
    </Screen>
  );
}
