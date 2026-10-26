const capabilities = [
  [
    "Smart routing",
    "Understand the issue. Find the responsibility.",
    "A planned understanding layer would match the grievance to configured responsibility paths, with officer oversight.",
  ],
  [
    "Similar complaint detection",
    "Different words. The same underlying issue.",
    "Related grievances could be connected even when complainants describe the issue differently.",
  ],
  [
    "Priority detection",
    "Bring the urgent into focus.",
    "Potentially urgent or high-impact grievances could be surfaced for human review.",
  ],
  [
    "SLA & escalation",
    "Make delays visible before they grow.",
    "Configured response timelines could flag overdue cases and support accountable escalation.",
  ],
  [
    "Pattern detection",
    "See the institution-level picture.",
    "Recurring complaints could reveal systemic issues that are easy to miss one case at a time.",
  ],
];
export function Intelligence() {
  return (
    <section id="intelligence" className="intelligence section shell">
      <div className="intelligence-intro">
        <p className="eyebrow">03 / INTELLIGENCE WITH PURPOSE</p>
        <h2>
          Beyond moving cases.
          <br />
          <em>Understanding them.</em>
        </h2>
        <p>
          Designed to support the people resolving grievances. Not to replace
          their judgement.
        </p>
        <span className="demo-badge">PLANNED CAPABILITIES</span>
      </div>
      <div className="capability-list">
        {capabilities.map(([title, heading, copy], i) => (
          <details key={title} open={i === 0}>
            <summary>
              <span className="cap-index">0{i + 1}</span>
              <span>{title}</span>
              <span className="expand" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="capability-body">
              <h3>{heading}</h3>
              <p>{copy}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
export function Patterns() {
  const complaints = [
    "Refund not received",
    "College has not returned my security deposit",
    "They are refusing to return the admission fee",
    "Refund is pending for months",
  ];
  return (
    <section className="patterns section">
      <div className="shell">
        <div className="pattern-heading">
          <div>
            <p className="eyebrow">04 / THE BIGGER PICTURE</p>
            <h2>
              Separate voices.
              <br />
              <em>A shared signal.</em>
            </h2>
          </div>
          <p>
            A single complaint tells a story.
            <br />
            Related complaints can reveal a pattern.
          </p>
        </div>
        <div className="pattern-visual">
          <div className="complaint-stack">
            {complaints.map((text, i) => (
              <div className="complaint-slip" key={text}>
                <span>0{i + 1}</span>
                <p>“{text}”</p>
                <b aria-hidden="true">↗</b>
              </div>
            ))}
          </div>
          <div className="converge" aria-hidden="true">
            <svg viewBox="0 0 200 300" preserveAspectRatio="none">
              <path d="M0 30C100 30 70 150 200 150M0 110C100 110 70 150 200 150M0 190C100 190 70 150 200 150M0 270C100 270 70 150 200 150" />
            </svg>
          </div>
          <div className="pattern-result">
            <span className="demo-badge">DEMO SCENARIO · FICTIONAL DATA</span>
            <p className="eyebrow">↗ EMERGING PATTERN</p>
            <h3>
              Refund-related
              <br />
              grievances
            </h3>
            <div className="pattern-number">
              23 <span>similar complaints</span>
            </div>
            <div className="pattern-tags">
              <span>Same institution</span>
              <span>Recurring issue</span>
            </div>
          </div>
        </div>
        <p className="pattern-note">
          Illustrative scenario only. These are not real complaints or actual
          AICTE statistics.
        </p>
      </div>
    </section>
  );
}
