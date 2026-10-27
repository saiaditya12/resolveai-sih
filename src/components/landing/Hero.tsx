import { RoutingVisual } from "@/components/three/RoutingVisual";
import Link from "next/link";
export function Hero() {
  return (
    <>
      <section className="hero shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="small-line" /> A CLEARER PATH TO RESOLUTION
          </p>
          <h1 id="hero-title">
            Your grievance shouldn’t get lost <em>between departments.</em>
          </h1>
          <p className="hero-description">
            You know what went wrong.
            <br />
            You shouldn’t have to know who handles it.
          </p>
          <p className="hero-detail">
            One place to raise institutional grievances. A clear path to the
            right authority. Visibility at every step.
          </p>
          <div className="actions">
            <Link className="button primary" href="/login">
              Raise a complaint <span aria-hidden="true">↗</span>
            </Link>
            <a className="text-link" href="#students">
              Track complaint <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p className="prototype-note">
            <span className="status-dot" /> Grievance routing, tracking and monitoring
          </p>
        </div>
        <RoutingVisual />
      </section>
      <div className="hero-foot shell">
        <span>BUILT AROUND THE GRIEVANCE. NOT THE ORG CHART.</span>
        <a href="#problem">
          Follow the journey <span>↓</span>
        </a>
      </div>
      <div className="principles shell">
        <span>
          01 <strong>One starting point</strong>
        </span>
        <span>
          02 <strong>Clear responsibility</strong>
        </span>
        <span>
          03 <strong>Visible progress</strong>
        </span>
        <span>
          04 <strong>A recorded outcome</strong>
        </span>
      </div>
    </>
  );
}
