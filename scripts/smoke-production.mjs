import { spawn } from "node:child_process";

const port = 41739;
const origin = `http://127.0.0.1:${port}`;
const privateMarker = "private-equation-x-plus-7";
const child = spawn(process.execPath, ["build/server/static-host.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    NODE_ENV: "test",
  },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});

let output = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => (output += chunk));
child.stderr.on("data", (chunk) => (output += chunk));

async function waitUntilReady() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/healthz`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error(`Host did not become ready. ${output}`);
}

try {
  await waitUntilReady();
  const health = await fetch(`${origin}/healthz`);
  const healthBody = await health.json();
  if (
    health.status !== 200 ||
    healthBody.status !== "ok" ||
    healthBody.mode !== "judge"
  )
    throw new Error("Health contract failed.");

  const navigation = await fetch(`${origin}/evidence`, {
    headers: { Accept: "text/html" },
  });
  if (
    navigation.status !== 200 ||
    !(await navigation.text()).includes('id="root"')
  )
    throw new Error("Navigation shell failed.");

  const traversal = await fetch(`${origin}/%252e%252e/package.json`);
  if (traversal.status !== 400)
    throw new Error(`Double-encoded traversal returned ${traversal.status}.`);

  const query = await fetch(`${origin}/?${privateMarker}`, {
    headers: { Accept: "text/html" },
  });
  if (query.status !== 400)
    throw new Error(`Query target returned ${query.status}.`);

  const range = await fetch(`${origin}/`, {
    headers: { Accept: "text/html", Range: "bytes=0-1" },
  });
  if (range.status !== 416)
    throw new Error(`Range request returned ${range.status}.`);

  const mutation = await fetch(`${origin}/healthz`, { method: "POST" });
  if (mutation.status !== 405)
    throw new Error(`Mutation returned ${mutation.status}.`);

  child.send("shutdown");
  const exitCode = await new Promise((resolve) => child.once("exit", resolve));
  if (exitCode !== 0)
    throw new Error(`Host exited ${String(exitCode)}. ${output}`);
  if (output.includes(privateMarker))
    throw new Error("Operational logs exposed the private request marker.");
  const logEntries = output
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line))
    .filter((entry) => typeof entry.requestId === "string");
  if (logEntries.length < 6)
    throw new Error("Expected one structured operational log per request.");
  const requestIds = new Set();
  for (const entry of logEntries) {
    const keys = Object.keys(entry).sort().join(",");
    if (
      keys !==
      "durationBucket,errorCode,requestId,routeClass,serviceVersion,status,timestamp"
    )
      throw new Error(`Unexpected operational log fields: ${keys}`);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        entry.requestId,
      )
    )
      throw new Error("Operational log requestId format is invalid.");
    requestIds.add(entry.requestId);
  }
  if (requestIds.size !== logEntries.length)
    throw new Error("Operational log requestIds are not unique per request.");
  process.stdout.write(
    "production smoke passed: health, navigation, traversal/query/range rejection, mutation rejection, privacy-safe request logs, graceful shutdown\n",
  );
} finally {
  if (child.exitCode === null) child.kill("SIGKILL");
}
