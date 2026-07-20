import {
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  E2E_EVIDENCE_ROOT_ENV,
  initializeE2eEvidenceRoot,
  verifyE2eEvidenceRootReservation,
  type EvidenceAssignment,
} from "../../e2e/evidence-root";

const assigned: EvidenceAssignment = {
  batchId: "BATCH-126",
  taskId: "TASK-169",
};

const tempProject = () => {
  const root = mkdtempSync(join(tmpdir(), "first-wrong-step-evidence-"));
  mkdirSync(resolve(root, ".factory", "evidence"), { recursive: true });
  return root;
};

describe("E2E evidence ownership", () => {
  it("does not create directories merely by importing the evidence module", async () => {
    const root = mkdtempSync(join(tmpdir(), "first-wrong-step-import-only-"));
    const moduleUrl = pathToFileURL(
      resolve(process.cwd(), "e2e", "evidence-root.ts"),
    ).href;
    const { spawn } = await import("node:child_process");
    const exitCode = await new Promise<number>((done) => {
      const child = spawn(
        process.execPath,
        [
          "--experimental-strip-types",
          "--input-type=module",
          "-e",
          `await import(${JSON.stringify(moduleUrl)});`,
        ],
        { cwd: root, stdio: "ignore" },
      );
      child.on("exit", (code) => done(code ?? -1));
    });
    expect(exitCode).toBe(0);
    expect(() => lstatSync(resolve(root, ".factory"))).toThrow();
  });

  it("atomically reserves a different local run leaf on every ordinary invocation", () => {
    const root = tempProject();
    const first = initializeE2eEvidenceRoot(root, {});
    const second = initializeE2eEvidenceRoot(root, {});
    expect(isAbsolute(first.root)).toBe(true);
    expect(relative(resolve(root, ".factory", "evidence"), first.root)).toMatch(
      /^local[\\/]playwright[\\/]run-[0-9]+-[0-9]+-[a-f0-9]{32}$/,
    );
    expect(second.root).not.toBe(first.root);
    expect(lstatSync(first.root).isDirectory()).toBe(true);
    expect(lstatSync(second.root).isDirectory()).toBe(true);
  });

  it.each([
    "",
    "   ",
    ".factory/evidence",
    ".factory/evidence/BATCH-126",
    ".factory/evidence/BATCH-x/TASK-169/run-x",
    ".factory/evidence/BATCH-126/TASK-x/run-x",
    ".factory/evidence/BATCH-126/TASK-169",
    ".factory/evidence/BATCH-126/TASK-169/not-a-run",
    ".factory/evidence/BATCH-126/TASK-169/run-x/extra",
    ".factory/evidence/BATCH-126/TASK-169/run-x/../../../outside",
    "../outside",
  ])("rejects malformed or escaping configured root %j", (configured) => {
    const root = tempProject();
    expect(() =>
      initializeE2eEvidenceRoot(
        root,
        { [E2E_EVIDENCE_ROOT_ENV]: configured },
        assigned,
      ),
    ).toThrow();
  });

  it("requires a separate trusted assignment for an explicit root", () => {
    const root = tempProject();
    expect(() =>
      initializeE2eEvidenceRoot(root, {
        [E2E_EVIDENCE_ROOT_ENV]:
          ".factory/evidence/BATCH-126/TASK-169/run-no-assignment",
      }),
    ).toThrow(/separate trusted batch\/task assignment/);
  });

  it.each([
    { batchId: "BATCH-125", taskId: "TASK-169" },
    { batchId: "BATCH-126", taskId: "TASK-168" },
  ])(
    "rejects a prior or different task namespace: $batchId/$taskId",
    (identity) => {
      const root = tempProject();
      expect(() =>
        initializeE2eEvidenceRoot(
          root,
          {
            [E2E_EVIDENCE_ROOT_ENV]:
              ".factory/evidence/BATCH-126/TASK-169/run-owned",
          },
          identity,
        ),
      ).toThrow(/must exactly match/);
    },
  );

  it("accepts exactly the assigned namespace and reserves its fresh leaf", () => {
    const root = tempProject();
    const configured = ".factory/evidence/BATCH-126/TASK-169/run-valid";
    const result = initializeE2eEvidenceRoot(
      root,
      { [E2E_EVIDENCE_ROOT_ENV]: configured },
      assigned,
    );
    expect(result.root).toBe(resolve(root, configured));
    expect(lstatSync(result.root).isDirectory()).toBe(true);
    expect(
      verifyE2eEvidenceRootReservation(
        root,
        configured,
        result.token,
        assigned,
      ),
    ).toBe(result.root);
    expect(() =>
      verifyE2eEvidenceRootReservation(root, configured, "wrong", assigned),
    ).toThrow(/token does not match/);
  });

  it("fails a same-leaf retry without overwriting prior evidence", () => {
    const root = tempProject();
    const configured = ".factory/evidence/BATCH-126/TASK-169/run-once";
    const first = initializeE2eEvidenceRoot(
      root,
      { [E2E_EVIDENCE_ROOT_ENV]: configured },
      assigned,
    );
    const sentinel = resolve(first.root, "sentinel.txt");
    writeFileSync(sentinel, "immutable", "utf8");
    expect(() =>
      initializeE2eEvidenceRoot(
        root,
        { [E2E_EVIDENCE_ROOT_ENV]: configured },
        assigned,
      ),
    ).toThrow(/already exists/);
    expect(readFileSync(sentinel, "utf8")).toBe("immutable");
  });

  it("allows only one winner when two callers contend for the same leaf", async () => {
    const root = tempProject();
    const moduleUrl = pathToFileURL(
      resolve(process.cwd(), "e2e", "evidence-root.ts"),
    ).href;
    const script = `
      import { initializeE2eEvidenceRoot, E2E_EVIDENCE_ROOT_ENV } from ${JSON.stringify(moduleUrl)};
      try {
        initializeE2eEvidenceRoot(process.argv[1], { [E2E_EVIDENCE_ROOT_ENV]: '.factory/evidence/BATCH-126/TASK-169/run-race' }, { batchId: 'BATCH-126', taskId: 'TASK-169' });
        process.exit(0);
      } catch { process.exit(7); }
    `;
    const { spawn } = await import("node:child_process");
    const run = () =>
      new Promise<number>((done) => {
        const child = spawn(
          process.execPath,
          [
            "--experimental-strip-types",
            "--input-type=module",
            "-e",
            script,
            root,
          ],
          { stdio: "ignore" },
        );
        child.on("exit", (code) => done(code ?? -1));
      });
    expect((await Promise.all([run(), run()])).sort()).toEqual([0, 7]);
  });

  it("rejects a real symlink or junction component that escapes containment", () => {
    const root = tempProject();
    const outside = mkdtempSync(join(tmpdir(), "first-wrong-step-outside-"));
    const batch = resolve(root, ".factory", "evidence", "BATCH-126");
    try {
      symlinkSync(
        outside,
        batch,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    expect(() =>
      initializeE2eEvidenceRoot(
        root,
        {
          [E2E_EVIDENCE_ROOT_ENV]:
            ".factory/evidence/BATCH-126/TASK-169/run-escape",
        },
        assigned,
      ),
    ).toThrow(/symlink|reparse|resolves through/);
    expect(readdirSync(outside)).toEqual([]);
  });

  it("rejects a linked factory evidence base", () => {
    const root = mkdtempSync(join(tmpdir(), "first-wrong-step-evidence-"));
    const outside = mkdtempSync(join(tmpdir(), "first-wrong-step-outside-"));
    mkdirSync(resolve(root, ".factory"));
    try {
      symlinkSync(
        outside,
        resolve(root, ".factory", "evidence"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    expect(() => initializeE2eEvidenceRoot(root, {})).toThrow(
      /symlink|reparse|resolves through/,
    );
    expect(readdirSync(outside)).toEqual([]);
  });

  it("contains no stale task or shared-slice destination in E2E source", () => {
    const e2eRoot = resolve(process.cwd(), "e2e");
    const source = readdirSync(e2eRoot)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => readFileSync(join(e2eRoot, name), "utf8"))
      .join("\n");
    expect(source).not.toContain(["BATCH", "111"].join("-"));
    expect(source).not.toContain(["TASK", "154"].join("-"));
    expect(source).not.toMatch(/evidence[\\/]slices/);
  });
});
