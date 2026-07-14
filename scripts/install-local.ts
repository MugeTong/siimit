import { chmod, copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const source = resolve("dist/siimit");
const destination = join(homedir(), ".local", "bin", "siimit");
await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
await chmod(destination, 0o755);
console.log(`Installed siimit to ${destination}`);

