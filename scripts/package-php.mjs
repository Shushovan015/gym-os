import { cpSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const backend = join(root, "backend");
const template = join(backend, "deploy", "shared-hosting");
if (!existsSync(join(backend, "vendor", "autoload.php"))) {
  throw new Error("Install production Composer dependencies in backend before packaging.");
}
const outputParent = join(root, ".runtime");
mkdirSync(outputParent, { recursive: true });
const release = mkdtempSync(join(outputParent, "gym-php-release-"));
const publicRoot = join(release, "public_html");
const privateRoot = join(release, "gym-private");

cpSync(join(root, "dist"), publicRoot, { recursive: true });
cpSync(join(template, "public"), publicRoot, { recursive: true });
mkdirSync(privateRoot);
cpSync(join(template, "config.example.php"), join(privateRoot, "config.example.php"));
const privateBackend = join(privateRoot, "backend");
mkdirSync(privateBackend);
for (const entry of ["src", "bin", "database", "public", "composer.json", "composer.lock", "vendor"]) {
  cpSync(join(backend, entry), join(privateBackend, entry), { recursive: true });
}
console.log(release);
