import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(join(root, "capacitor.config.ts"), "export { default } from './capacitor.hub.config';\n");
console.log("capacitor.config.ts -> hub");
