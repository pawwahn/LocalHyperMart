/** Web / missing native dep — registerNativePush no-ops safely. */
export const PushNotifications = {
  async requestPermissions() {
    return { receive: 'denied' as const };
  },
  async register() {
    /* no-op */
  },
  addListener(_event: string, _handler: (ev: { value: string }) => void) {
    return Promise.resolve({ remove: () => undefined });
  },
};
