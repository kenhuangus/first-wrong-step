import type { Category } from "./domain";
export type DiagnosisFixture = Readonly<{
  schemaVersion: 1;
  id: string;
  title: string;
  skillTag: string;
  problem: string;
  steps: readonly string[];
  expectedFirstInvalidIndex: number;
  expectedCategory: Category;
  governingRule: string;
  provenance: "GPT-5.6-assisted";
}>;
