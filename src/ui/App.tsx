import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { analyzeSession } from "../app/analyze-use-case";
import {
  beginTransfer,
  submitTransfer,
  type TransferSession,
} from "../app/transfer-use-case";
import {
  initialSessionState,
  sessionReducer,
  sessionContextSignature,
  type WorkbenchAction,
} from "../app/session-reducer";
import { fixtures } from "../content/pedagogy-assets";
import type { PedagogyAdapter, PedagogyResult } from "../contracts/pedagogy";
import {
  JudgeFixtureAdapter,
  requestSafePedagogy,
  type SafePedagogyEvidence,
} from "../pedagogy/adapters";
import { ReasoningWorkbench } from "./learner/ReasoningWorkbench";
import { TransferPanel } from "./learner/TransferPanel";
import { EvidencePanel } from "./evidence/EvidencePanel";
import {
  selectTeacherEvidence,
  type HintEvidence,
} from "./evidence/evidence-selectors";
import { BuildPanel } from "./build/BuildPanel";

type HintState = Readonly<{
  result: PedagogyResult;
  failureCode?: string;
}>;
type HintLineage = Pick<
  HintEvidence,
  "attemptId" | "problem" | "steps" | "contextRevision" | "contextSignature"
>;

export function App({
  pedagogyAdapter = new JudgeFixtureAdapter(),
}: {
  pedagogyAdapter?: PedagogyAdapter;
}) {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [hint, setHint] = useState<HintState | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [retryUsed, setRetryUsed] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [transfer, setTransfer] = useState<TransferSession | null>(null);
  const [hintEvidence, setHintEvidence] = useState<readonly HintEvidence[]>([]);
  const [view, setView] = useState<"learner" | "evidence" | "build">("learner");
  const evidenceRef = useRef<SafePedagogyEvidence | null>(null);
  const requestRef = useRef<{
    token: number;
    context: string;
    controller: AbortController;
  } | null>(null);
  const nextTokenRef = useRef(1);
  const analysisBusyRef = useRef(false);
  const retryBusyRef = useRef(false);
  const nextAnalysisRequestRef = useRef(1);

  const invalidatePedagogy = () => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    nextTokenRef.current += 1;
    evidenceRef.current = null;
    retryBusyRef.current = false;
    setHint(null);
    setHintLoading(false);
  };

  useEffect(
    () => () => {
      requestRef.current?.controller.abort();
      requestRef.current = null;
      nextTokenRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (state.analysis === null) setHint(null);
  }, [state.analysis]);

  const loadFixture = (id: string) => {
    const fixture = fixtures.find((candidate) => candidate.id === id);
    if (!fixture) return;
    invalidatePedagogy();
    analysisBusyRef.current = false;
    dispatch({ type: "load", problem: fixture.problem, steps: fixture.steps });
    setTransfer(null);
    setHintEvidence([]);
    setView("learner");
    setRetryUsed(false);
    setConfirmingReset(false);
  };

  const loadHint = async (
    evidence: SafePedagogyEvidence,
    lineage: HintLineage,
  ) => {
    requestRef.current?.controller.abort();
    const controller = new AbortController();
    const token = nextTokenRef.current++;
    const context = JSON.stringify(evidence);
    requestRef.current = { token, context, controller };
    setHintLoading(true);
    const nextHint = await requestSafePedagogy(
      pedagogyAdapter,
      evidence,
      controller.signal,
    );
    const active = requestRef.current;
    if (
      controller.signal.aborted ||
      !active ||
      active.token !== token ||
      active.context !== context
    )
      return;
    setHint(nextHint);
    setHintEvidence((current) => [
      ...current.filter((record) => record.attemptId !== lineage.attemptId),
      Object.freeze({
        ...lineage,
        steps: Object.freeze([...lineage.steps]),
        firstInvalidIndex: evidence.firstInvalidIndex,
        category: evidence.category,
        governingRule: evidence.governingRule,
        result: nextHint.result,
        ...(nextHint.failureCode ? { failureCode: nextHint.failureCode } : {}),
      }),
    ]);
    setHintLoading(false);
    requestRef.current = null;
  };

  const runAnalysis = async () => {
    if (analysisBusyRef.current || requestRef.current) return;
    analysisBusyRef.current = true;
    invalidatePedagogy();
    const request = {
      requestId: `analysis-${nextAnalysisRequestRef.current++}`,
      contextRevision: state.contextRevision,
      contextSignature: sessionContextSignature(state.problem, state.steps),
    };
    const attemptId = state.nextAttemptId;
    dispatch({ type: "analysis_started", ...request });
    const result = analyzeSession(state);
    dispatch({ type: "analysis_completed", result, ...request });
    setRetryUsed(false);
    if (result.kind !== "needs_repair") {
      // Dispatch is synchronous in ordering but state is committed on the next
      // render, so derive from the accepted reducer state in an effect below.
      setTransfer(null);
      analysisBusyRef.current = false;
      return;
    }
    setTransfer(null);
    const line = result.lines[result.firstInvalidIndex];
    if (line?.kind !== "invalid") {
      analysisBusyRef.current = false;
      return;
    }
    const exactFixture = fixtures.find(
      (candidate) =>
        candidate.problem === state.problem &&
        candidate.steps.length === state.steps.length &&
        candidate.steps.every((step, index) => step === state.steps[index]),
    );
    const evidence: SafePedagogyEvidence = {
      fixtureId: exactFixture?.id,
      category: line.evidence.category,
      governingRule: line.evidence.governingRule,
      firstInvalidIndex: result.firstInvalidIndex,
      ...(result.solutionSet.kind === "unique"
        ? { solutionAnswer: result.solutionSet.value }
        : {}),
    };
    evidenceRef.current = evidence;
    // The retained request is now the single-flight lock. Edits/switch/reset
    // abort it, which intentionally permits a newer analysis generation.
    analysisBusyRef.current = false;
    await loadHint(evidence, {
      attemptId,
      problem: state.problem,
      steps: state.steps,
      contextRevision: state.contextRevision,
      contextSignature: request.contextSignature,
    });
  };

  useEffect(() => {
    if (state.analysis?.kind === "valid_complete")
      setTransfer(beginTransfer(state));
  }, [state]);

  const retryHint = async () => {
    if (retryUsed || retryBusyRef.current || !evidenceRef.current) return;
    retryBusyRef.current = true;
    const evidence = evidenceRef.current;
    requestRef.current?.controller.abort();
    requestRef.current = null;
    setRetryUsed(true);
    const attempt = [...state.attempts]
      .reverse()
      .find(
        (candidate) =>
          candidate.analysis.kind === "needs_repair" &&
          candidate.problem === state.problem &&
          candidate.contextRevision === state.contextRevision &&
          candidate.contextSignature ===
            sessionContextSignature(state.problem, state.steps),
      );
    if (!attempt) {
      retryBusyRef.current = false;
      return;
    }
    await loadHint(evidence, {
      attemptId: attempt.id,
      problem: attempt.problem,
      steps: attempt.steps,
      contextRevision: attempt.contextRevision,
      contextSignature: attempt.contextSignature,
    });
    retryBusyRef.current = false;
  };

  const reset = () => {
    invalidatePedagogy();
    analysisBusyRef.current = false;
    dispatch({ type: "reset" });
    setTransfer(null);
    setHintEvidence([]);
    setView("learner");
    setRetryUsed(false);
    setConfirmingReset(false);
  };

  const workbenchDispatch = (action: WorkbenchAction) => {
    if (
      action.type === "set_problem" ||
      action.type === "set_step" ||
      action.type === "add_step" ||
      action.type === "remove_step" ||
      action.type === "move_step"
    ) {
      invalidatePedagogy();
      analysisBusyRef.current = false;
      setRetryUsed(false);
      setTransfer(null);
    }
    dispatch(action);
  };

  const teacherEvidence = useMemo(
    () => selectTeacherEvidence(state, hintEvidence, transfer),
    [state, hintEvidence, transfer],
  );

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Education track · private judge mode</p>
          <h1>First Wrong Step</h1>
          <p className="lede">
            Check whether each algebra move preserves the exact same solution
            set—and stop at the first one that does not.
          </p>
        </div>
        <div className="fixture-choices" aria-label="Synthetic examples">
          {fixtures.map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              className="fixture-button"
              onClick={() => loadFixture(fixture.id)}
            >
              {fixture.id === "distribution-first-wrong-step"
                ? "Load distribution example"
                : fixture.id === "sign-equality-first-wrong-step"
                  ? "Load equality example"
                  : "Load fully valid example"}
            </button>
          ))}
        </div>
      </header>
      <aside className="privacy-note" aria-label="Privacy note">
        <strong>synthetic judge data only.</strong> This slice analyzes in your
        browser, makes zero model calls, and does not persist learner work.
      </aside>
      <nav aria-label="Primary views">
        <button type="button" onClick={() => setView("learner")}>
          Learner
        </button>{" "}
        <button type="button" onClick={() => setView("evidence")}>
          Evidence
        </button>{" "}
        <button type="button" onClick={() => setView("build")}>
          Build
        </button>
      </nav>
      {view === "learner" ? (
        <>
          <ReasoningWorkbench
            state={state}
            dispatch={workbenchDispatch}
            onAnalyze={runAnalysis}
            hint={hint}
            hintLoading={hintLoading}
            retryUsed={retryUsed}
            onRetryHint={retryHint}
            confirmingReset={confirmingReset}
            onRequestReset={() => setConfirmingReset(true)}
            onCancelReset={() => setConfirmingReset(false)}
            onConfirmReset={reset}
          />
          {transfer ? (
            <TransferPanel
              transfer={transfer}
              diagnosis={teacherEvidence.diagnosis}
              hint={teacherEvidence.hint}
              onSubmit={(response) =>
                setTransfer((current) =>
                  current ? submitTransfer(current, response) : null,
                )
              }
            />
          ) : null}
        </>
      ) : view === "evidence" ? (
        <EvidencePanel evidence={teacherEvidence} onNavigate={setView} />
      ) : (
        <BuildPanel onNavigate={setView} />
      )}
    </main>
  );
}
