import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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
  ["data/raw/CV_Chae.pdf", "cv/Junghun_Chae_CV.pdf"],
];

await rm(publicDirectory, { recursive: true, force: true });
await mkdir(publicDirectory, { recursive: true });

for (const [source, destination] of publicSources) {
  const sourcePath = resolve(projectDirectory, source);
  const destinationPath = resolve(publicDirectory, destination);
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { recursive: true });
}

// Stamp the deployed page with the checked-out revision's date, not the build date.
// Local previews without Git retain the readable date in the source HTML.
let commitDate = "";
try {
  commitDate = execFileSync("git", ["log", "-1", "--format=%cs"], {
    cwd: projectDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  console.warn("Git date unavailable; keeping the source page's last-updated date.");
}
if (/^\d{4}-\d{2}-\d{2}$/.test(commitDate)) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${commitDate}T00:00:00Z`));
  const indexPath = resolve(publicDirectory, "index.html");
  const html = await readFile(indexPath, "utf8");
  const dateMarker = /<time id="last-updated" datetime="[^"]*">[^<]*<\/time>/;
  if (!dateMarker.test(html)) throw new Error("The last-updated date marker is missing.");
  await writeFile(indexPath, html.replace(dateMarker,
    `<time id="last-updated" datetime="${commitDate}">${formattedDate}</time>`), "utf8");
}

const optionalCvDirectory = resolve(projectDirectory, "public-cv");
try {
  await access(optionalCvDirectory);
  await cp(optionalCvDirectory, resolve(publicDirectory, "public-cv"), {
    recursive: true,
  });
} catch {
  // Additional public documents are optional.
}

console.log("Prepared Cloudflare public assets, including the public CV.");
