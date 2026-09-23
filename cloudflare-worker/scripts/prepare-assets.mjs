import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workerDirectory = resolve(scriptDirectory, "..");
const projectDirectory = resolve(workerDirectory, "..");
const publicDirectory = resolve(workerDirectory, "public");

const publicSources = [
  ["index.html", "index.html"],
  ["css", "css"],
  ["js", "js"],
  ["data/knowledge.json", "data/knowledge.json"],
];

await rm(publicDirectory, { recursive: true, force: true });
await mkdir(publicDirectory, { recursive: true });

for (const [source, destination] of publicSources) {
  const sourcePath = resolve(projectDirectory, source);
  const destinationPath = resolve(publicDirectory, destination);
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { recursive: true });
}

const optionalCvDirectory = resolve(projectDirectory, "public-cv");
try {
  await access(optionalCvDirectory);
  await cp(optionalCvDirectory, resolve(publicDirectory, "public-cv"), {
    recursive: true,
  });
} catch {
  // A public CV is optional. The private data/raw directory is never copied.
}

console.log("Prepared Cloudflare public assets (private data/raw files were not copied).");
