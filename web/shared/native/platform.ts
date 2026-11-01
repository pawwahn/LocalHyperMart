import { Capacitor } from '@capacitor/core';

/** True inside Capacitor Android/iOS — false in desktop/mobile browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
