import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children}
    </View>
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

export function Button({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.button}
      {...(testID ? { testID } : {})}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 24, gap: 16 },
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
  buttonText: { color: colors.background, fontWeight: '700' },
});
