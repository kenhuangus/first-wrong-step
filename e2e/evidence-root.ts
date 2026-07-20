import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { TestInfo } from "@playwright/test";

export const E2E_EVIDENCE_ROOT_ENV = "E2E_EVIDENCE_ROOT";
export const E2E_EVIDENCE_BATCH_ENV = "E2E_EVIDENCE_BATCH_ID";
export const E2E_EVIDENCE_TASK_ENV = "E2E_EVIDENCE_TASK_ID";
export const E2E_EVIDENCE_RESERVATION_ENV = "E2E_EVIDENCE_RESERVATION";

export interface EvidenceAssignment {
  readonly batchId: string;
  readonly taskId: string;
}

export interface EvidenceReservation {
  readonly root: string;
  readonly token: string;
}

const batchPattern = /^BATCH-[0-9]+$/;
const taskPattern = /^TASK-[0-9]+$/;
const runPattern = /^run-[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const reservationFilename = ".playwright-reservation";

const samePath = (left: string, right: string) =>
  process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;

const isContainedBy = (parent: string, candidate: string) => {
  const child = relative(parent, candidate);
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`);
};

const isContainedOrEqual = (parent: string, candidate: string) =>
  samePath(parent, candidate) || isContainedBy(parent, candidate);

function inspectDirectory(path: string, trustedParent?: string): string {
  let stat: Stats;
  try {
    stat = lstatSync(path);
  } catch (error) {
    throw new Error(`Evidence directory is unavailable: ${path}`, {
      cause: error,
    });
  }

  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      `Evidence directory must not be a symlink or reparse point: ${path}`,
    );
  }

  const requested = resolve(path);
  const canonical = realpathSync.native(path);
  // On Windows, junctions are normally reported as symbolic links. The
  // realpath comparison also fails closed for any reparse-like redirection
  // that lstat does not identify directly.
  if (!samePath(requested, canonical)) {
    throw new Error(
      `Evidence directory resolves through a link or reparse point: ${path}`,
    );
  }
  if (
    trustedParent !== undefined &&
    !isContainedOrEqual(trustedParent, canonical)
  ) {
    throw new Error(`Evidence directory escapes its trusted parent: ${path}`);
  }
  return canonical;
}

function createOrInspectDirectory(path: string, trustedParent: string): string {
  try {
    mkdirSync(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") {
      throw error;
    }
  }
  return inspectDirectory(path, trustedParent);
}

function canonicalEvidenceBase(projectRoot: string): string {
  const requestedProject = resolve(projectRoot);
  const canonicalProject = inspectDirectory(requestedProject);
  const factory = createOrInspectDirectory(
    resolve(requestedProject, ".factory"),
    canonicalProject,
  );
  const evidence = createOrInspectDirectory(
    resolve(factory, "evidence"),
    factory,
  );
  if (!isContainedBy(canonicalProject, evidence)) {
    throw new Error(
      "Factory evidence base must remain inside the project root",
    );
  }
  return evidence;
}

function validateAssignment(assignment: EvidenceAssignment): void {
  if (
    !batchPattern.test(assignment.batchId) ||
    !taskPattern.test(assignment.taskId)
  ) {
    throw new Error(
      "Assigned evidence identity must use BATCH-<number> and TASK-<number>",
    );
  }
}

function configuredRun(
  projectRoot: string,
  base: string,
  configured: string,
  assignment: EvidenceAssignment | undefined,
): { parents: readonly string[]; leaf: string } {
  if (configured.trim() === "" || configured.includes("\0")) {
    throw new Error(`${E2E_EVIDENCE_ROOT_ENV} must be a non-empty path`);
  }
  if (assignment === undefined) {
    throw new Error(
      `${E2E_EVIDENCE_ROOT_ENV} requires a separate trusted batch/task assignment`,
    );
  }
  validateAssignment(assignment);

  const candidate = resolve(
    projectRoot,
    isAbsolute(configured) ? configured : configured.trim(),
  );
  if (!isContainedBy(base, candidate)) {
    throw new Error(`${E2E_EVIDENCE_ROOT_ENV} must stay inside ${base}`);
  }

  const segments = relative(base, candidate).split(sep);
  if (
    segments.length !== 3 ||
    segments[0] !== assignment.batchId ||
    segments[1] !== assignment.taskId ||
    !runPattern.test(segments[2] ?? "")
  ) {
    throw new Error(
      `${E2E_EVIDENCE_ROOT_ENV} must exactly match .factory/evidence/${assignment.batchId}/${assignment.taskId}/run-<unique-id>`,
    );
  }

  return {
    parents: [
      resolve(base, segments[0]),
      resolve(base, segments[0], segments[1]),
    ],
    leaf: candidate,
  };
}

function defaultRun(base: string): {
  parents: readonly string[];
  leaf: string;
} {
  const local = resolve(base, "local");
  const playwright = resolve(local, "playwright");
  return {
    parents: [local, playwright],
    leaf: resolve(
      playwright,
      `run-${process.pid}-${Date.now()}-${randomUUID().replaceAll("-", "")}`,
    ),
  };
}

/**
 * Validates ownership and atomically reserves a fresh, exclusive evidence leaf.
 * Calling this function is the only operation in this module that creates paths.
 */
export function initializeE2eEvidenceRoot(
  projectRoot = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
  assignment?: EvidenceAssignment,
): EvidenceReservation {
  const base = canonicalEvidenceBase(projectRoot);
  const hasConfiguredRoot = Object.prototype.hasOwnProperty.call(
    environment,
    E2E_EVIDENCE_ROOT_ENV,
  );
  const run = hasConfiguredRoot
    ? configuredRun(
        projectRoot,
        base,
        environment[E2E_EVIDENCE_ROOT_ENV] ?? "",
        assignment,
      )
    : defaultRun(base);

  let trustedParent = base;
  for (const parent of run.parents) {
    trustedParent = createOrInspectDirectory(parent, trustedParent);
  }

  try {
    // No recursive flag: creation of the exclusively owned leaf is one atomic
    // fail-if-exists operation, so retries and concurrent workers cannot merge.
    mkdirSync(run.leaf);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `Evidence run leaf already exists and cannot be reused: ${run.leaf}`,
        {
          cause: error,
        },
      );
    }
    throw error;
  }

  // Re-read every component after creation. This detects a link/reparse swap or
  // a realpath escape before Playwright receives the directory.
  const verifiedBase = canonicalEvidenceBase(projectRoot);
  if (!samePath(base, verifiedBase)) {
    throw new Error("Factory evidence base changed during initialization");
  }
  trustedParent = verifiedBase;
  for (const parent of run.parents) {
    trustedParent = inspectDirectory(parent, trustedParent);
  }
  const verifiedLeaf = inspectDirectory(run.leaf, trustedParent);
  if (!isContainedBy(verifiedBase, verifiedLeaf)) {
    throw new Error("Evidence run leaf escaped the canonical evidence base");
  }
  const token = randomUUID();
  writeFileSync(resolve(verifiedLeaf, reservationFilename), token, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return { root: verifiedLeaf, token };
}

/**
 * Verifies without creating anything the reservation inherited by a
 * Playwright child worker.
 */
export function verifyE2eEvidenceRootReservation(
  projectRoot: string,
  configured: string,
  token: string,
  assignment?: EvidenceAssignment,
): string {
  if (configured.trim() === "" || token.trim() === "") {
    throw new Error("Playwright evidence reservation is incomplete");
  }
  const requestedProject = resolve(projectRoot);
  const canonicalProject = inspectDirectory(requestedProject);
  const factory = inspectDirectory(
    resolve(requestedProject, ".factory"),
    canonicalProject,
  );
  const base = inspectDirectory(resolve(factory, "evidence"), factory);
  const candidate = resolve(
    projectRoot,
    isAbsolute(configured) ? configured : configured.trim(),
  );
  if (!isContainedBy(base, candidate)) {
    throw new Error("Reserved Playwright evidence root escaped containment");
  }

  const segments = relative(base, candidate).split(sep);
  if (assignment !== undefined) {
    validateAssignment(assignment);
    if (
      segments.length !== 3 ||
      segments[0] !== assignment.batchId ||
      segments[1] !== assignment.taskId ||
      !runPattern.test(segments[2] ?? "")
    ) {
      throw new Error(
        "Reserved Playwright evidence root does not match its assignment",
      );
    }
  } else if (
    segments.length !== 3 ||
    segments[0] !== "local" ||
    segments[1] !== "playwright" ||
    !runPattern.test(segments[2] ?? "")
  ) {
    throw new Error("Reserved local Playwright evidence root is malformed");
  }

  let trustedParent = base;
  for (let index = 0; index < segments.length - 1; index += 1) {
    trustedParent = inspectDirectory(
      resolve(base, ...segments.slice(0, index + 1)),
      trustedParent,
    );
  }
  const verifiedLeaf = inspectDirectory(candidate, trustedParent);
  const storedToken = readFileSync(
    resolve(verifiedLeaf, reservationFilename),
    "utf8",
  );
  if (storedToken !== token) {
    throw new Error("Playwright evidence reservation token does not match");
  }
  return verifiedLeaf;
}

export function e2eArtifactPath(testInfo: TestInfo, name: string): string {
  if (
    name.trim() === "" ||
    name.includes("\0") ||
    name.includes("/") ||
    name.includes("\\") ||
    name === "." ||
    name === ".."
  ) {
    throw new Error("E2E artifact name must be a single non-empty filename");
  }

  const path = testInfo.outputPath(name);
  mkdirSync(resolve(path, ".."), { recursive: true });
  return path;
}
