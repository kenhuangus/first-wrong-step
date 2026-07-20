import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const mimeByExtension = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".svg", "image/svg+xml"],
]);

async function walk(directory) {
  const files = [];
  for (const dirent of await readdir(directory, { withFileTypes: true })) {
    if (dirent.name.startsWith(".")) continue;
    const absolute = path.join(directory, dirent.name);
    if (dirent.isDirectory()) files.push(...(await walk(absolute)));
    else if (
      dirent.isFile() &&
      !dirent.name.endsWith(".map") &&
      dirent.name !== "static-manifest.json"
    )
      files.push(absolute);
  }
  return files;
}

const entries = [];
for (const absolute of (await walk(root)).sort()) {
  const file = path.relative(root, absolute).split(path.sep).join("/");
  const extension = path.extname(file).toLowerCase();
  const mime = mimeByExtension.get(extension);
  if (!mime) throw new Error(`Unsupported static file type: ${file}`);
  const body = await readFile(absolute);
  const metadata = await stat(absolute);
  entries.push({
    url: `/${file}`,
    file,
    sha256: createHash("sha256").update(body).digest("hex"),
    bytes: metadata.size,
    mime,
  });
}

await writeFile(
  path.join(root, "static-manifest.json"),
  `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);
