import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? sourceFiles(child) : [child];
  });
}

describe("learner-visible source encoding", () => {
  it("contains no common UTF-8 mojibake or replacement markers", () => {
    const offenders = sourceFiles(join(process.cwd(), "src"))
      .filter((file) => /\.(?:ts|tsx|json|css)$/u.test(file))
      .filter((file) => /[ÃÂâ�]/u.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
