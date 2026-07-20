import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readdir, readFile, realpath } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_REQUEST_TARGET_BYTES = 2_048;
const NAVIGATION_ROUTES = new Set(["/", "/evidence", "/build"]);
const MIME_BY_EXTENSION: ReadonlyMap<string, string> = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".svg", "image/svg+xml"],
]);
const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()",
};

interface ManifestEntry {
  readonly url: string;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly mime: string;
}

interface StaticManifest {
  readonly schemaVersion: 1;
  readonly entries: readonly ManifestEntry[];
}

interface VerifiedAsset extends ManifestEntry {
  readonly body: Buffer;
}

export interface OperationalLogEntry {
  readonly timestamp: string;
  readonly serviceVersion: string;
  readonly requestId: string;
  readonly routeClass: "rejected" | "health" | "navigation" | "asset";
  readonly status: number;
  readonly errorCode:
    | "invalid_request"
    | "not_found"
    | "method_not_allowed"
    | "not_acceptable"
    | "request_target_too_long"
    | "range_not_satisfiable"
    | "internal_error"
    | null;
  readonly durationBucket: "lt10ms" | "lt100ms" | "gte100ms";
}

interface StaticHostOptions {
  readonly serviceVersion?: string;
  readonly writeLog?: (entry: OperationalLogEntry) => void;
}

export function parsePort(rawPort = "8080"): number {
  if (!/^[1-9][0-9]{0,4}$/u.test(rawPort))
    throw new Error(
      "PORT must be a whole decimal number from 1 through 65535.",
    );
  const port = Number(rawPort);
  if (port > 65_535)
    throw new Error(
      "PORT must be a whole decimal number from 1 through 65535.",
    );
  return port;
}

function parseServiceVersion(rawVersion = "0.1.0"): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(rawVersion))
    throw new Error("APP_VERSION must use 1-64 safe version characters.");
  return rawVersion;
}

function errorCodeFor(status: number): OperationalLogEntry["errorCode"] {
  switch (status) {
    case 200:
      return null;
    case 400:
      return "invalid_request";
    case 404:
      return "not_found";
    case 405:
      return "method_not_allowed";
    case 406:
      return "not_acceptable";
    case 413:
      return "request_target_too_long";
    case 416:
      return "range_not_satisfiable";
    default:
      return "internal_error";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isManifestEntry(value: unknown): value is ManifestEntry {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.join(",") === "bytes,file,mime,sha256,url" &&
    typeof value.url === "string" &&
    typeof value.file === "string" &&
    typeof value.sha256 === "string" &&
    /^[0-9a-f]{64}$/u.test(value.sha256) &&
    typeof value.bytes === "number" &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes >= 0 &&
    typeof value.mime === "string" &&
    value.url === `/${value.file}` &&
    /^[A-Za-z0-9_~./-]+$/u.test(value.file) &&
    !value.file.includes("//") &&
    !value.file.includes("\\") &&
    !value.file.includes(":") &&
    !path.posix.isAbsolute(value.file) &&
    value.file
      .split("/")
      .every((part) => part.length > 0 && !part.startsWith(".")) &&
    MIME_BY_EXTENSION.get(path.posix.extname(value.file).toLowerCase()) ===
      value.mime &&
    value.bytes <=
      (value.file === "index.html" ? MAX_HTML_BYTES : MAX_FILE_BYTES)
  );
}

function isStaticManifest(value: unknown): value is StaticManifest {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join(",") === "entries,schemaVersion" &&
    value.schemaVersion === 1 &&
    Array.isArray(value.entries) &&
    value.entries.every(isManifestEntry)
  );
}

function writeHeaders(
  response: ServerResponse,
  status: number,
  headers: Record<string, string> = {},
) {
  response.writeHead(status, { ...SECURITY_HEADERS, ...headers });
}

export type RequestTargetResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly status: 400 | 413 };

export function validateRequestTarget(rawTarget: string): RequestTargetResult {
  if (Buffer.byteLength(rawTarget, "utf8") > MAX_REQUEST_TARGET_BYTES)
    return { ok: false, status: 413 };
  if (
    rawTarget.length === 0 ||
    !rawTarget.startsWith("/") ||
    rawTarget.startsWith("//") ||
    rawTarget.includes("?") ||
    rawTarget.includes("#") ||
    rawTarget.includes("\\") ||
    rawTarget.includes(":") ||
    /[\u0000-\u001f\u007f-\uffff]/u.test(rawTarget) ||
    /%(?:2f|5c|00|25)/iu.test(rawTarget) ||
    /%(?![0-9a-f]{2})/iu.test(rawTarget)
  )
    return { ok: false, status: 400 };
  try {
    const decoded = decodeURIComponent(rawTarget);
    if (
      decoded.includes("%") ||
      decoded.includes("\\") ||
      decoded.includes("\0") ||
      decoded.includes(":") ||
      /[\u0000-\u001f\u007f-\uffff]/u.test(decoded) ||
      !/^\/[A-Za-z0-9._~/-]*$/u.test(decoded) ||
      decoded.startsWith("//") ||
      decoded.slice(1, -1).includes("//")
    )
      return { ok: false, status: 400 };
    const segments = decoded.split("/");
    if (
      segments.some(
        (segment) =>
          segment === "." || segment === ".." || segment.startsWith("."),
      )
    )
      return { ok: false, status: 400 };
    return { ok: true, path: decoded };
  } catch {
    return { ok: false, status: 400 };
  }
}

async function collectDistFiles(
  root: string,
  directory = root,
): Promise<string[]> {
  const collected: string[] = [];
  for (const dirent of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, dirent.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    const stats = await lstat(absolute);
    if (stats.isSymbolicLink())
      throw new Error(`Symlink is not allowed: ${relative}`);
    if (stats.isDirectory())
      collected.push(...(await collectDistFiles(root, absolute)));
    else if (stats.isFile()) collected.push(relative);
    else throw new Error(`Special file is not allowed: ${relative}`);
  }
  return collected;
}

async function verifyEntry(
  root: string,
  rootReal: string,
  entry: ManifestEntry,
): Promise<VerifiedAsset> {
  if (
    !entry.url.startsWith("/") ||
    path.isAbsolute(entry.file) ||
    entry.file.split(/[\\/]/u).some((part) => part.startsWith("."))
  ) {
    throw new Error(`Unsafe manifest entry: ${entry.url}`);
  }
  const absolutePath = path.resolve(root, entry.file);
  let cursor = root;
  for (const component of entry.file.split("/")) {
    cursor = path.join(cursor, component);
    const stats = await lstat(cursor);
    if (stats.isSymbolicLink())
      throw new Error(`Symlink is not serveable: ${entry.file}`);
  }
  const canonical = await realpath(absolutePath);
  if (canonical !== rootReal && !canonical.startsWith(`${rootReal}${path.sep}`))
    throw new Error(`Asset escapes root: ${entry.file}`);
  const handle = await open(canonical, "r");
  try {
    const stats = await handle.stat();
    const ceiling =
      entry.file === "index.html" ? MAX_HTML_BYTES : MAX_FILE_BYTES;
    if (!stats.isFile() || stats.size !== entry.bytes || stats.size > ceiling)
      throw new Error(`Invalid asset metadata: ${entry.file}`);
    const body = await handle.readFile();
    const digest = createHash("sha256").update(body).digest("hex");
    if (digest !== entry.sha256)
      throw new Error(`Asset digest mismatch: ${entry.file}`);
    return { ...entry, body };
  } finally {
    await handle.close();
  }
}

async function loadAssets(
  distRoot: string,
): Promise<Map<string, VerifiedAsset>> {
  const rootReal = await realpath(distRoot);
  const rawManifest: unknown = JSON.parse(
    await readFile(path.join(distRoot, "static-manifest.json"), "utf8"),
  );
  if (!isStaticManifest(rawManifest))
    throw new Error("Static manifest schema is invalid.");
  const actualFiles = (await collectDistFiles(distRoot))
    .filter((file) => file !== "static-manifest.json")
    .sort();
  const declaredFiles = rawManifest.entries.map((entry) => entry.file).sort();
  if (
    actualFiles.length !== declaredFiles.length ||
    actualFiles.some((file, index) => file !== declaredFiles[index])
  )
    throw new Error("Static manifest does not exactly cover the distribution.");
  const assets = new Map<string, VerifiedAsset>();
  for (const entry of rawManifest.entries) {
    if (assets.has(entry.url))
      throw new Error(`Duplicate manifest URL: ${entry.url}`);
    assets.set(entry.url, await verifyEntry(distRoot, rootReal, entry));
  }
  return assets;
}

export async function createStaticHost(
  distRoot: string,
  options: StaticHostOptions = {},
): Promise<Server> {
  const assets = await loadAssets(distRoot);
  const index = assets.get("/index.html");
  if (!index) throw new Error("Static manifest has no index document.");
  const serviceVersion = parseServiceVersion(
    options.serviceVersion ?? process.env.APP_VERSION,
  );
  const writeLog =
    options.writeLog ??
    ((entry: OperationalLogEntry) => {
      process.stdout.write(`${JSON.stringify(entry)}\n`);
    });

  return createServer((request, response) => {
    const started = performance.now();
    const requestId = randomUUID();
    let routeClass: OperationalLogEntry["routeClass"] = "rejected";
    let status = 500;
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        status = 405;
        writeHeaders(response, status, {
          Allow: "GET, HEAD",
          "Cache-Control": "no-store",
        });
        response.end();
        return;
      }
      const target = validateRequestTarget(request.url ?? "");
      if (!target.ok) {
        status = target.status;
        writeHeaders(response, status, { "Cache-Control": "no-store" });
        response.end();
        return;
      }
      const requestPath = target.path;
      if (request.headers.range !== undefined) {
        status = 416;
        writeHeaders(response, status, { "Cache-Control": "no-store" });
        response.end();
        return;
      }
      if (requestPath === "/healthz") {
        routeClass = "health";
        status = 200;
        const body = JSON.stringify({
          status: "ok",
          version: serviceVersion,
          mode: "judge",
        });
        writeHeaders(response, status, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        response.end(request.method === "HEAD" ? undefined : body);
        return;
      }
      const acceptsHtml = (request.headers.accept ?? "")
        .toLowerCase()
        .includes("text/html");
      if (NAVIGATION_ROUTES.has(requestPath) && !acceptsHtml) {
        status = 406;
        writeHeaders(response, status, { "Cache-Control": "no-store" });
        response.end();
        return;
      }
      const asset =
        assets.get(requestPath) ??
        (NAVIGATION_ROUTES.has(requestPath) && acceptsHtml ? index : undefined);
      if (!asset) {
        status = 404;
        writeHeaders(response, status, { "Cache-Control": "no-store" });
        response.end();
        return;
      }
      routeClass = asset.file === "index.html" ? "navigation" : "asset";
      status = 200;
      const body = asset.body;
      writeHeaders(response, status, {
        "Content-Type": asset.mime,
        "Content-Length": String(body.byteLength),
        "Cache-Control":
          asset.file === "index.html"
            ? "no-store"
            : "public, max-age=31536000, immutable",
        ETag: `"${asset.sha256}"`,
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      status = 500;
      if (!response.headersSent)
        writeHeaders(response, status, { "Cache-Control": "no-store" });
      response.end();
    } finally {
      const durationMs = Math.max(0, performance.now() - started);
      writeLog({
        timestamp: new Date().toISOString(),
        serviceVersion,
        requestId,
        routeClass,
        status,
        errorCode: errorCodeFor(status),
        durationBucket:
          durationMs < 10
            ? "lt10ms"
            : durationMs < 100
              ? "lt100ms"
              : "gte100ms",
      });
    }
  });
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distRoot = path.resolve(here, "../../dist");
  const host =
    process.env.HOST ??
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  const port = parsePort(process.env.PORT);
  const serviceVersion = parseServiceVersion(process.env.APP_VERSION);
  const server = await createStaticHost(distRoot, { serviceVersion });
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  if (process.send) {
    process.once("message", (message) => {
      if (message === "shutdown") shutdown();
    });
  }
  server.listen(port, host, () =>
    process.stdout.write(
      `${JSON.stringify({ timestamp: new Date().toISOString(), event: "ready", serviceVersion, host, port, mode: "judge" })}\n`,
    ),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main().catch(() => {
    process.stderr.write("Static host failed to start.\n");
    process.exitCode = 1;
  });
}
