import type { Dispatch } from "react";
import { canAnalyze } from "../../app/selectors";
import type { WorkbenchAction } from "../../app/session-reducer";
import type { PedagogyResult } from "../../contracts/pedagogy";
import type { SessionState } from "../../contracts/session";
import { AttemptHistory } from "./AttemptHistory";
import { DiagnosisPanel } from "./DiagnosisPanel";
import { HintCard } from "./HintCard";

export function ReasoningWorkbench({
  state,
  dispatch,
  onAnalyze,
  hint,
  hintLoading,
  retryUsed,
  onRetryHint,
  confirmingReset,
  onRequestReset,
  onCancelReset,
  onConfirmReset,
}: {
  state: SessionState;
  dispatch: Dispatch<WorkbenchAction>;
  onAnalyze: () => void | Promise<void>;
  hint: Readonly<{ result: PedagogyResult; failureCode?: string }> | null;
  hintLoading: boolean;
  retryUsed: boolean;
  onRetryHint: () => void | Promise<void>;
  confirmingReset: boolean;
  onRequestReset: () => void;
  onCancelReset: () => void;
  onConfirmReset: () => void;
}) {
  return (
    <div className="workbench-grid">
      <section className="workspace" aria-labelledby="workspace-title">
        <div className="section-heading">
          <div>
            <p className="kicker">Learner workbench</p>
            <h2 id="workspace-title">Show each equation line</h2>
          </div>
          <span className="local-badge">Deterministic · local</span>
        </div>
        <label htmlFor="problem">Starting problem</label>
        <input
          id="problem"
          value={state.problem}
          onChange={(event) =>
            dispatch({ type: "set_problem", value: event.target.value })
          }
          spellCheck={false}
        />
        <p className="step-count" aria-live="polite">
          {state.steps.length} {state.steps.length === 1 ? "step" : "steps"}
        </p>
        <ol className="step-list">
          {state.steps.map((step, index) => {
            const disposition = state.analysis?.lines[index + 1];
            const invalid =
              disposition?.kind === "invalid" ||
              disposition?.kind === "unsupported" ||
              disposition?.kind === "too_complex";
            return (
              <li
                key={index}
                className={invalid ? "step invalid-step" : "step"}
              >
                <label htmlFor={`step-${index}`}>Step {index + 1}</label>
                <input
                  id={`step-${index}`}
                  value={step}
                  aria-invalid={invalid || undefined}
                  onChange={(event) =>
                    dispatch({
                      type: "set_step",
                      index,
                      value: event.target.value,
                    })
                  }
                  spellCheck={false}
                />
                <div
                  className="step-actions"
                  role="group"
                  aria-label={`Equation line ${index + 1} controls`}
                >
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() =>
                      dispatch({ type: "move_step", index, direction: -1 })
                    }
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={index === state.steps.length - 1}
                    onClick={() =>
                      dispatch({ type: "move_step", index, direction: 1 })
                    }
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "remove_step", index })}
                  >
                    Remove
                  </button>
                </div>
                {disposition?.kind === "not_evaluated" ? (
                  <span className="line-status">Not evaluated yet</span>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className="workbench-actions">
          <button type="button" onClick={() => dispatch({ type: "add_step" })}>
            Add step
          </button>
          <button
            className="primary"
            type="button"
            disabled={!canAnalyze(state) || hintLoading}
            onClick={() => void onAnalyze()}
          >
            {state.status === "analyzing" ? "Checking…" : "Check my reasoning"}
          </button>
          <button
            type="button"
            onClick={onRequestReset}
            disabled={state.status === "empty"}
          >
            Reset work
          </button>
        </div>
        {confirmingReset ? (
          <div
            className="reset-confirmation"
            role="alertdialog"
            aria-label="Confirm reset"
          >
            <p>Reset this current-session work and attempt history?</p>
            <button type="button" onClick={onConfirmReset}>
              Confirm reset
            </button>
            <button type="button" onClick={onCancelReset}>
              Keep working
            </button>
          </div>
        ) : null}
      </section>
      <aside className="results" aria-label="Analysis result">
        {state.analysis ? (
          <DiagnosisPanel analysis={state.analysis} />
        ) : (
          <div className="empty-result">
            <p className="kicker">Analysis</p>
            <h2>Find the first change that breaks equivalence</h2>
            <p>Choose a synthetic example, then check the ordered work.</p>
          </div>
        )}
        {hintLoading ? (
          <p aria-live="polite">Loading a safe hint…</p>
        ) : hint ? (
          <HintCard
            hint={hint.result}
            failureCode={hint.failureCode}
            retryUsed={retryUsed}
            onRetry={onRetryHint}
          />
        ) : null}
        <AttemptHistory attempts={state.attempts} />
      </aside>
    </div>
  );
}
