import type { AnalysisResult } from "./analysis";
export type Attempt = Readonly<{
  id: number;
  problem: string;
  steps: readonly string[];
  contextRevision: number;
  contextSignature: string;
  analysis: AnalysisResult;
  repairOfAttemptId?: number;
}>;
export type PendingRepair = Readonly<{
  diagnosisAttemptId: number;
  problem: string;
  repairStepIndex: number;
  preservedPrefix: readonly string[];
  contextRevision: number;
  contextSignature: string;
}>;
export type SessionStatus = "empty" | "editing" | "analyzing" | "analyzed";
export type AnalysisRequest = Readonly<{
  requestId: string;
  contextRevision: number;
  contextSignature: string;
}>;
export type SessionState = Readonly<{
  status: SessionStatus;
  problem: string;
  steps: readonly string[];
  analysis: AnalysisResult | null;
  attempts: readonly Attempt[];
  nextAttemptId: number;
  contextRevision: number;
  activeAnalysis: AnalysisRequest | null;
  pendingRepair: PendingRepair | null;
}>;
export type SessionAction =
  | Readonly<{ type: "load"; problem: string; steps: readonly string[] }>
  | Readonly<{ type: "set_problem"; value: string }>
  | Readonly<{ type: "set_step"; index: number; value: string }>
  | (Readonly<{ type: "analysis_started" }> & AnalysisRequest)
  | (Readonly<{ type: "analysis_completed"; result: AnalysisResult }> &
      AnalysisRequest)
  | (Readonly<{ type: "analysis_failed" }> & AnalysisRequest)
  | Readonly<{ type: "reset" }>;
