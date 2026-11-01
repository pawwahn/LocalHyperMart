import { Capacitor } from '@capacitor/core';
import { isNativeApp } from './platform';
import { resolveApiBaseUrl } from './resolveApiBaseUrl';

export type NativePushAppType = 'BUYER' | 'VENDOR' | 'DELIVERY' | 'HUB';

let pushListenersAttached = false;
let latestAccessToken: string | null = null;
let latestAppType: NativePushAppType = 'BUYER';

async function postDeviceToken(accessToken: string, fcmToken: string, appType: NativePushAppType): Promise<void> {
  const apiBase = resolveApiBaseUrl(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined,
  );
  const platform = Capacitor.getPlatform().toUpperCase() === 'IOS' ? 'IOS' : 'ANDROID';
  const response = await fetch(`${apiBase}/api/v1/users/me/devices`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fcmToken, platform, appType }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Device registration failed (${response.status})`);
  }
}

/**
 * Registers FCM token with user-service after login. No-op on web and when push plugin is unavailable.
 */
export async function registerNativePush(options: {
  accessToken: string;
  appType: NativePushAppType;
}): Promise<void> {
  if (!isNativeApp() || !options.accessToken) return;
  latestAccessToken = options.accessToken;
  latestAppType = options.appType;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      return;
    }

    if (!pushListenersAttached) {
      pushListenersAttached = true;
      PushNotifications.addListener('registration', async (ev) => {
        const token = ev.value;
        const accessToken = latestAccessToken;
        if (!token || !accessToken) return;
        try {
          await postDeviceToken(accessToken, token, latestAppType);
        } catch {
          /* keep app usable if push registration fails */
        }
      });
    }

    await PushNotifications.register();
  } catch {
    /* optional native plugin */
  }
}

/** Call on logout so the next login can register again. */
export function resetNativePushRegistration(): void {
  pushListenersAttached = false;
  latestAccessToken = null;
}
