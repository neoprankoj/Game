import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

// Minimal shell styling. The real design system (tokens, components) is Part 5.1–5.2.
export const colors = {
  background: '#0b0d17',
  panel: '#151a2e',
  text: '#e8e6df',
  muted: '#9a9fb5',
  cyan: '#3fd0e0',
  danger: '#e0605a',
};

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}

/** A labelled text input. `testID` lands on the input itself (data-testid on web). */
export function Field({
  label,
  testID,
  ...input
}: { label: string; testID: string } & Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'secureTextEntry' | 'autoComplete' | 'keyboardType' | 'onSubmitEditing'
>) {
  return (
    <View style={styles.field}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.muted}
        style={styles.input}
        testID={testID}
        {...input}
      />
    </View>
  );
}

/** Error line for a form; renders nothing without an error. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={styles.danger} testID="form-error">
      {message}
    </Text>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.row} testID="loading">
      <ActivityIndicator color={colors.cyan} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  testID,
  disabled = false,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  tone?: 'primary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, tone === 'danger' && styles.buttonDanger, disabled && styles.buttonDisabled]}
      {...(testID ? { testID } : {})}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  screen: { flexGrow: 1, padding: 24, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  field: { gap: 4 },
  input: {
    color: colors.text,
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a3150',
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: 16,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  text: { color: colors.text, fontSize: 16 },
  muted: { color: colors.muted, fontSize: 14 },
  danger: { color: colors.danger, fontSize: 16 },
  panel: { backgroundColor: colors.panel, borderRadius: 8, padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    backgroundColor: colors.cyan,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.background, fontWeight: '700' },
  link: { color: colors.cyan, fontSize: 16 },
});
