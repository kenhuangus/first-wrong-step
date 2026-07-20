import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createStaticHost,
  parsePort,
  validateRequestTarget,
  type OperationalLogEntry,
} from "../../server/static-host.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

function entryFor(
  file: string,
  body: Buffer,
  mime = "text/html; charset=utf-8",
) {
  return {
    url: `/${file}`,
    file,
    sha256: createHash("sha256").update(body).digest("hex"),
    bytes: body.byteLength,
    mime,
  };
}

async function fixtureRoot(
  mutate?: (
    manifest: { schemaVersion: number; entries: Record<string, unknown>[] },
    root: string,
  ) => Promise<void> | void,
) {
  const root = await mkdtemp(path.join(tmpdir(), "first-wrong-step-host-"));
  temporaryRoots.push(root);
  const body = Buffer.from("<!doctype html><main>verified</main>");
  await writeFile(path.join(root, "index.html"), body);
  const manifest = {
    schemaVersion: 1,
    entries: [entryFor("index.html", body)],
  };
  await mutate?.(manifest, root);
  await writeFile(
    path.join(root, "static-manifest.json"),
    JSON.stringify(manifest),
  );
  return { root, body };
}

async function listen(root: string, logs?: OperationalLogEntry[]) {
  const server = await createStaticHost(root, {
    serviceVersion: "test-build.1",
    writeLog: logs ? (entry) => logs.push(entry) : undefined,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected TCP address.");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

describe("strict host configuration", () => {
  it.each([
    "",
    "0",
    " 8080",
    "8080 ",
    "+8080",
    "-1",
    "8080junk",
    "8080.5",
    "8e3",
    "65536",
    "999999",
  ])("rejects malformed or out-of-range PORT %j", (value) => {
    expect(() => parsePort(value)).toThrow(
      "PORT must be a whole decimal number from 1 through 65535.",
    );
  });

  it.each([
    [undefined, 8080],
    ["1", 1],
    ["8080", 8080],
    ["65535", 65_535],
  ])("accepts complete canonical decimal PORT %j", (value, expected) => {
    expect(parsePort(value)).toBe(expected);
  });
});

async function rawGet(
  origin: string,
  target: string,
  headers: Record<string, string> = {},
) {
  const url = new URL(origin);
  return await new Promise<{
    status: number;
    body: string;
    headers: Record<string, string | string[] | undefined>;
  }>((resolve, reject) => {
    let responseHeaders: Record<string, string | string[] | undefined> = {};
    const outgoing = request(
      {
        hostname: url.hostname,
        port: url.port,
        method: "GET",
        path: target,
        headers,
      },
      (response) => {
        responseHeaders = response.headers;
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => (body += chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body,
            headers: responseHeaders,
          }),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}

describe("request-target contract", () => {
  it.each([
    "",
    "relative",
    "//authority",
    "/?query=true",
    "/#fragment",
    "/a\\b",
    "/C:/secret",
    "/a//b",
    "/./asset",
    "/../asset",
    "/.env",
    "/a/.hidden",
    "/a@b",
    "/%2fetc",
    "/%5cetc",
    "/%00etc",
    "/%25etc",
    "/%2",
    "/%GG",
    "/%c3%28",
    "/café",
    "/control\u0001",
  ])("rejects %j before lookup", (target) => {
    expect(validateRequestTarget(target)).toEqual({ ok: false, status: 400 });
  });

  it("returns 413 for a target above 2,048 bytes", () => {
    expect(validateRequestTarget(`/${"a".repeat(2_048)}`)).toEqual({
      ok: false,
      status: 413,
    });
  });

  it.each(["/", "/evidence", "/build", "/assets/a-1._~.js"])(
    "accepts the closed ASCII path shape %s",
    (target) => {
      expect(validateRequestTarget(target)).toEqual({ ok: true, path: target });
    },
  );
});

describe("manifest trust boundary", () => {
  it.each([
    ["extra field", (entry: Record<string, unknown>) => (entry.extra = true)],
    ["bad digest", (entry: Record<string, unknown>) => (entry.sha256 = "abc")],
    ["negative size", (entry: Record<string, unknown>) => (entry.bytes = -1)],
    [
      "fractional size",
      (entry: Record<string, unknown>) => (entry.bytes = 1.5),
    ],
    [
      "URL mismatch",
      (entry: Record<string, unknown>) => (entry.url = "/other.html"),
    ],
    [
      "MIME mismatch",
      (entry: Record<string, unknown>) =>
        (entry.mime = "text/css; charset=utf-8"),
    ],
    [
      "unknown type",
      (entry: Record<string, unknown>) => {
        entry.file = "index.exe";
        entry.url = "/index.exe";
      },
    ],
    ["size mismatch", (entry: Record<string, unknown>) => (entry.bytes = 1)],
    [
      "integrity mismatch",
      (entry: Record<string, unknown>) => (entry.sha256 = "0".repeat(64)),
    ],
  ])("rejects %s", async (_name, mutate) => {
    const { root } = await fixtureRoot((manifest) =>
      mutate(manifest.entries[0]),
    );
    await expect(createStaticHost(root)).rejects.toThrow();
  });

  it("rejects an undeclared file in the distribution", async () => {
    const { root } = await fixtureRoot(async (_manifest, directory) => {
      await writeFile(path.join(directory, "rogue.txt"), "not declared");
    });
    await expect(createStaticHost(root)).rejects.toThrow(
      "does not exactly cover",
    );
  });
});

describe("served-byte and response contract", () => {
  it("serves the build-owned SVG icon with its manifest MIME", async () => {
    const icon = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
    );
    const { root } = await fixtureRoot(async (manifest, directory) => {
      await writeFile(path.join(directory, "favicon.svg"), icon);
      manifest.entries.push(entryFor("favicon.svg", icon, "image/svg+xml"));
    });
    const { server, origin } = await listen(root);
    try {
      const response = await rawGet(origin, "/favicon.svg");
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("image/svg+xml");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.body).toBe(icon.toString("utf8"));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("serves startup-verified bytes even if the path is replaced", async () => {
    const { root } = await fixtureRoot();
    const { server, origin } = await listen(root);
    try {
      await writeFile(
        path.join(root, "index.html"),
        "<main>replacement</main>",
      );
      const response = await rawGet(origin, "/", { Accept: "text/html" });
      expect(response.status).toBe(200);
      expect(response.body).toContain("verified");
      expect(response.body).not.toContain("replacement");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("uses deterministic response classes for ranges, queries, navigation, and unknown paths", async () => {
    const { root } = await fixtureRoot();
    const { server, origin } = await listen(root);
    try {
      expect(
        (await rawGet(origin, "/", { Accept: "text/html", Range: "bytes=0-1" }))
          .status,
      ).toBe(416);
      expect(
        (await rawGet(origin, "/?q=1", { Accept: "text/html" })).status,
      ).toBe(400);
      expect(
        (await rawGet(origin, "/evidence", { Accept: "application/json" }))
          .status,
      ).toBe(406);
      expect(
        (await rawGet(origin, "/unknown", { Accept: "text/html" })).status,
      ).toBe(404);
      const head = await fetch(`${origin}/`, {
        method: "HEAD",
        headers: { Accept: "text/html" },
      });
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");
      expect(head.headers.get("cache-control")).toBe("no-store");
      expect(head.headers.get("x-content-type-options")).toBe("nosniff");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("logs only bounded generated correlation and operational metadata", async () => {
    const marker = "private-equation-x-plus-7";
    const logs: OperationalLogEntry[] = [];
    const { root } = await fixtureRoot();
    const { server, origin } = await listen(root, logs);
    try {
      await rawGet(origin, `/?${marker}`, {
        Accept: "text/html",
        "X-Student-Work": marker,
        Authorization: `Bearer ${marker}`,
      });
      await rawGet(origin, "/healthz");
      expect(logs).toHaveLength(2);
      for (const entry of logs) {
        expect(Object.keys(entry).sort()).toEqual([
          "durationBucket",
          "errorCode",
          "requestId",
          "routeClass",
          "serviceVersion",
          "status",
          "timestamp",
        ]);
        expect(entry.requestId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
        );
        expect(entry.serviceVersion).toBe("test-build.1");
        expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
      }
      expect(logs[0]?.requestId).not.toBe(logs[1]?.requestId);
      expect(logs[0]?.errorCode).toBe("invalid_request");
      expect(logs[1]?.errorCode).toBeNull();
      const serialized = JSON.stringify(logs);
      expect(serialized).not.toContain(marker);
      expect(serialized).not.toMatch(
        /target|path|query|header|body|remote|user-agent|authorization/iu,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
