import { EmailAddress, Password } from '@chronos/contracts';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../src/client-context';
import { codeOfAuthError } from '../src/errors';
import { appUrl } from '../src/links';
import { Button, Field, FormError, Screen, styles } from '../src/ui';
import { useSubmit } from '../src/use-submit';

/** Create an account (D01). The answer is the same whether or not the email is already registered. */
export default function SignUp() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { pending, error, run } = useSubmit();

  const submit = async () => {
    const address = email.trim().toLowerCase();
    const ok = await run(async () => {
      if (!EmailAddress.safeParse(address).success || !Password.safeParse(password).success)
        return 'VALIDATION_FAILED';
      const result = await auth.signUp.email({
        email: address,
        password,
        // Display names are chosen when founding the civilization (D02, Part 6.1); this is the account label.
        name: address.split('@')[0] ?? 'Commander',
        callbackURL: appUrl('/'),
      });
      return result.error ? codeOfAuthError(result.error) : null;
    });
    if (ok) router.replace({ pathname: '/check-email', params: { email: address } });
  };

  return (
    <Screen title="Create account">
      <Stack.Screen options={{ title: 'Create account' }} />
      <Field
        label="Email"
        testID="email"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        label="Password (at least 10 characters)"
        testID="password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={() => void submit()}
      />
      <FormError message={error} />
      <Button
        label={pending ? 'Creating…' : 'Create account'}
        onPress={() => void submit()}
        disabled={pending}
        testID="submit"
      />
      <Text style={styles.muted}>
        Already have an account?{' '}
        <Link href="/sign-in" style={styles.link} testID="to-sign-in">
          Sign in
        </Link>
      </Text>
    </Screen>
  );
}
