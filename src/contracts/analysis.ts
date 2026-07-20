import type {
  Category,
  InputErrorCode,
  LimitCode,
  SolutionSet,
} from "./domain";
export type MisconceptionEvidence = Readonly<{
  category: Category;
  governingRule: string;
  previousIndex: number;
  currentIndex: number;
}>;
export type LineDisposition =
  | Readonly<{ kind: "valid"; solutionSet: SolutionSet }>
  | Readonly<{
      kind: "invalid";
      previousIndex: number;
      currentIndex: number;
      evidence: MisconceptionEvidence;
    }>
  | Readonly<{
      kind: "unsupported";
      lineIndex: number;
      code: InputErrorCode;
      message: string;
    }>
  | Readonly<{
      kind: "too_complex";
      lineIndex?: number;
      limit: LimitCode;
      message: "Input too complex—shorten this equation or solution";
    }>
  | Readonly<{ kind: "not_evaluated" }>;
export type AnalysisResult =
  | Readonly<{
      kind: "needs_repair";
      lines: LineDisposition[];
      firstInvalidIndex: number;
      solutionSet: SolutionSet;
    }>
  | Readonly<{
      kind: "valid_in_progress";
      lines: LineDisposition[];
      solutionSet: SolutionSet;
    }>
  | Readonly<{
      kind: "valid_complete";
      lines: LineDisposition[];
      solutionSet: Readonly<{ kind: "unique"; value: string }>;
    }>
  | Readonly<{
      kind: "terminal_boundary";
      lines: LineDisposition[];
      solutionSet: Readonly<{ kind: "none" | "all_real" }>;
    }>
  | Readonly<{ kind: "input_error"; lines: LineDisposition[] }>;
export type AnalyzeInput = Readonly<{
  problem: string;
  steps: readonly string[];
}>;
