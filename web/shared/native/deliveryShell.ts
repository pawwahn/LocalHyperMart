/** Web delivery portal: both hub + agent. APK builds pin one role. */
export type DeliveryShellMode = 'all' | 'hub' | 'agent';

export function readDeliveryShell(): DeliveryShellMode {
  const raw = import.meta.env.VITE_KOYAKART_SHELL;
  if (raw === 'hub' || raw === 'agent') return raw;
  return 'all';
}

export function deliveryShellAppName(shell: DeliveryShellMode): string {
  if (shell === 'hub') return 'KoyaKart Hub';
  if (shell === 'agent') return 'KoyaKart Agent';
  return 'KoyaKart Delivery';
}
