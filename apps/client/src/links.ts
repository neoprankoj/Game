import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Absolute URL of an app screen, for links the API puts in emails (verification, password reset).
 * Web: this site's origin. Native: the app's deep link (chronoscradle://…, or exp://… in Expo Go).
 * Both must be trusted origins on the API (CORS_ORIGINS / the app scheme), or the API refuses the request.
 */
export function appUrl(path: string): string {
  if (Platform.OS === 'web') return new URL(path, globalThis.location.origin).href;
  return Linking.createURL(path);
}
