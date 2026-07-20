import { buildProvenance } from "../../content/provenance";

export function BuildPanel({
  onNavigate,
}: {
  onNavigate: (destination: "learner" | "evidence") => void;
}) {
  return (
    <section
      className="build-view"
      aria-labelledby="build-title"
      data-testid="build-view"
    >
      <p className="eyebrow">Build provenance · {buildProvenance.datedAt}</p>
      <h1 id="build-title">How this project was built</h1>
      <p>{buildProvenance.creation}</p>
      <p>{buildProvenance.execution}</p>
      <p>{buildProvenance.pedagogy}</p>
      <section aria-labelledby="factory-method-title">
        <p className="kicker">Factory method</p>
        <h2 id="factory-method-title">Evidence before claims</h2>
        <p>
          The skill separates writers from independent reviewers, freezes source
          fingerprints at barriers, and reruns every mandatory review lane after
          a repair changes source. That method is part of the project evidence,
          not a learner-facing runtime dependency.
        </p>
      </section>
      <section aria-labelledby="local-evidence-title">
        <p className="kicker">Dated project-local evidence</p>
        <h2 id="local-evidence-title">Review these repository paths</h2>
        <ul>
          {buildProvenance.evidence.map((path) => (
            <li key={path}>
              <code className="build-evidence-path">{path}</code>
            </li>
          ))}
        </ul>
        <p>
          Public repository, deployment, and submission links will be added only
          after those separately authorized artifacts exist.
        </p>
      </section>
      <nav aria-label="Build destinations">
        <button type="button" onClick={() => onNavigate("learner")}>
          Return to learner
        </button>{" "}
        <button type="button" onClick={() => onNavigate("evidence")}>
          Open current-session evidence
        </button>
      </nav>
    </section>
  );
}
