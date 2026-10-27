import { journey } from "@/lib/site";
export function Journey() {
  return (
    <>
      <section id="problem" className="problem section shell">
        <div className="section-heading">
          <p className="eyebrow">01 / THE DISCONNECT</p>
          <h2>
            A valid grievance.
            <br />
            <em>An unclear destination.</em>
          </h2>
          <p>
            When responsibility is fragmented, the person asking for help is
            left connecting the dots.
          </p>
        </div>
        <div className="problem-route">
          <span>Grievance raised</span>
          <b>→</b>
          <span>Which authority?</span>
          <b>⇄</b>
          <span>Another department</span>
          <b>→</b>
          <span>Who owns it?</span>
          <b>→</b>
          <span className="delay">Still waiting…</span>
        </div>
        <p className="problem-caption">
          The problem isn’t a lack of voice. It’s the absence of a visible path.
        </p>
      </section>
      <section id="how-it-works" className="journey-section section">
        <div className="shell">
          <div className="section-heading">
            <p className="eyebrow">02 / FROM VOICE TO RESOLUTION</p>
            <h2>
              One complaint.
              <br />
              <em>A connected journey.</em>
            </h2>
            <p>
              The workflow keeps responsibility and progress in view,
              from the first word to the final outcome.
            </p>
          </div>
          <div className="journey-layout">
            <div className="journey-map">
              <div className="journey-map-head">
                <span className="eyebrow">CASE GRV-024</span>
                <span className="demo-badge">CASE JOURNEY</span>
              </div>
              <div className="station-track">
                <span className="journey-parcel" aria-hidden="true">
                  ↗
                </span>
                {journey.map(([title], i) => (
                  <div
                    className={`journey-station ${i === 0 ? "active" : ""}`}
                    key={title}
                  >
                    <i />
                    <span>0{i + 1}</span>
                    {title}
                  </div>
                ))}
              </div>
              <div className="journey-current">01 / Complaint raised</div>
              <p className="map-caption">
                Same case. Every handoff accounted for.
              </p>
            </div>
            <div className="journey-steps">
              {journey.map(([title, heading, copy], i) => (
                <article
                  className="journey-step"
                  data-title={title}
                  key={title}
                >
                  <p className="eyebrow">
                    <span>0{i + 1}</span> {title}
                  </p>
                  <h3>{heading}</h3>
                  <p>{copy}</p>
                  <span className="step-rule" />
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
