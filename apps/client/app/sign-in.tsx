import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../src/client-context';
import { codeOfAuthError } from '../src/errors';
import { appUrl } from '../src/links';
import { Button, Field, FormError, Screen, styles } from '../src/ui';
import { useSubmit } from '../src/use-submit';

/** Email + password sign-in (D01). Errors never say whether the email exists. */
export default function SignIn() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { pending, error, run } = useSubmit();

  const submit = async () => {
    const address = email.trim().toLowerCase();
    const ok = await run(async () => {
      // No callbackURL here: on web, Better Auth's client would then reload the page at that URL after sign-in.
      const result = await auth.signIn.email({ email: address, password });
      if (!result.error) return null;
      const code = codeOfAuthError(result.error);
      // Correct password, unconfirmed email: send a fresh link that returns to THIS app (web page or deep link).
      if (code === 'AUTH_EMAIL_NOT_VERIFIED')
        await auth.sendVerificationEmail({ email: address, callbackURL: appUrl('/') });
      return code;
    });
    if (ok) router.replace('/account');
  };

  return (
    <Screen title="Sign in">
      <Stack.Screen options={{ title: 'Sign in' }} />
      <Field
        label="Email"
        testID="email"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        label="Password"
        testID="password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={() => void submit()}
      />
      <FormError message={error} />
      <Button
        label={pending ? 'Signing in…' : 'Sign in'}
        onPress={() => void submit()}
        disabled={pending}
        testID="submit"
      />
      <Link href="/forgot-password" style={styles.link} testID="to-forgot-password">
        Forgot your password?
      </Link>
      <Text style={styles.muted}>
        New here?{' '}
        <Link href="/sign-up" style={styles.link} testID="to-sign-up">
          Create an account
        </Link>
      </Text>
    </Screen>
  );
}
