import type { Attempt } from "../../contracts/session";

export function AttemptHistory({ attempts }: { attempts: readonly Attempt[] }) {
  if (attempts.length === 0) return null;
  return (
    <section
      className="attempt-history"
      aria-labelledby="attempt-history-title"
    >
      <p className="kicker">Immutable session record</p>
      <h2 id="attempt-history-title">Attempt history</h2>
      <ol>
        {attempts.map((attempt) => (
          <li key={attempt.id}>
            <div className="attempt-history-meta">
              <strong>Attempt {attempt.id}</strong>
              <span className="attempt-history-field">
                <span className="attempt-history-label">Outcome</span>
                {attempt.analysis.kind.replaceAll("_", " ")}
              </span>
              {attempt.repairOfAttemptId !== undefined ? (
                <span className="attempt-history-field">
                  <span className="attempt-history-label">Lineage</span>
                  Repairs attempt {attempt.repairOfAttemptId}
                </span>
              ) : null}
              <span className="attempt-history-field">
                <span className="attempt-history-label">Equations</span>
                {attempt.steps.length}
              </span>
            </div>
            <p>
              Historical problem snapshot: <code>{attempt.problem}</code>
            </p>
            <code className="attempt-history-equations">
              {attempt.steps.join(" → ")}
            </code>
          </li>
        ))}
      </ol>
    </section>
  );
}
