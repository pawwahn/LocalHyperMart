import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const CAP_PACKAGES = ['core', 'app', 'status-bar', 'keyboard', 'splash-screen', 'push-notifications'] as const;

const OPTIONAL_STUB: Partial<Record<(typeof CAP_PACKAGES)[number], string>> = {
  'push-notifications': 'push-notifications.ts',
};

/**
 * Vite resolves imports from the file path. Shared `@hlm-native` lives under `web/shared/`,
 * so `@capacitor/*` must alias to each portal's `node_modules` (same as when native code lived in `src/`).
 * Optional plugins fall back to `stubs/` when not installed so `npm run dev` still works on web.
 */
export function viteCapacitorAliases(portalRoot: URL): Record<string, string> {
  const root = portalRoot.href.endsWith('/') ? portalRoot : new URL(`${portalRoot.href}/`);
  const rootDir = fileURLToPath(root);
  const stubsDir = fileURLToPath(new URL('./stubs', import.meta.url));
  const aliases: Record<string, string> = {};

  for (const pkg of CAP_PACKAGES) {
    const installed = path.join(rootDir, 'node_modules', '@capacitor', pkg);
    const stubName = OPTIONAL_STUB[pkg];
    if (stubName && !fs.existsSync(path.join(installed, 'package.json'))) {
      aliases[`@capacitor/${pkg}`] = path.join(stubsDir, stubName);
    } else {
      aliases[`@capacitor/${pkg}`] = installed;
    }
  }
  return aliases;
}
