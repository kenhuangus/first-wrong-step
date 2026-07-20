import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("SLICE-003 repository distinctness", () => {
  it("contains no CausalGate import, branding, copied product data, or governance runtime", () => {
    const root = join(process.cwd(), "src");
    const findings = sourceFiles(root).flatMap((path) => {
      const text = readFileSync(path, "utf8").toLowerCase();
      const forbidden = [
        "causalgate",
        "causal-gate",
        "agent governance",
        "policy gate",
        "approval workflow",
      ];
      return forbidden
        .filter((term) => text.includes(term))
        .map((term) => `${relative(process.cwd(), path)}:${term}`);
    });
    expect(findings).toEqual([]);
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );
    expect(packageJson).not.toMatch(/causal.?gate/iu);
  });

  it("documents an independent Education learner journey", () => {
    const app = readFileSync(join(process.cwd(), "src/ui/App.tsx"), "utf8");
    const transfer = readFileSync(
      join(process.cwd(), "src/ui/learner/TransferPanel.tsx"),
      "utf8",
    );
    expect(app).toContain("Education track");
    expect(app).toContain("First Wrong Step");
    expect(transfer).toContain("Prove the skill on changed coefficients");
  });
});
