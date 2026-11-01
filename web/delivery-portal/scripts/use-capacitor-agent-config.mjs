import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
copyFileSync(join(root, 'capacitor.agent.config.ts'), join(root, 'capacitor.config.ts'));
console.log('capacitor.config.ts -> agent');

