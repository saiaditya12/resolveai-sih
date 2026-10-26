import { Navigation } from "@/components/layout/Navigation";
import { Hero } from "@/components/landing/Hero";
import { Journey } from "@/components/landing/Journey";
import { Intelligence, Patterns } from "@/components/landing/Intelligence";
import {
  StudentPreview,
  OfficerPreview,
} from "@/components/landing/ExperiencePreviews";
import { NarrativeMotion } from "@/components/motion/NarrativeMotion";
import Link from "next/link";
import { site } from "@/lib/site";
export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navigation />
      <main id="main">
        <Hero />
        <Journey />
        <Intelligence />
        <Patterns />
        <StudentPreview />
        <OfficerPreview />
        <section className="final-cta section">
          <div className="shell">
            <p className="eyebrow">A BETTER PATH STARTS WITH BEING HEARD.</p>
            <h2>
              Raise your grievance.
              <br />
              Know where it goes.
              <br />
              <em>Know what happens next.</em>
            </h2>
            <div className="actions">
              <Link className="button primary" href="/login">
                Raise a complaint ↗
              </Link>
              <a className="button secondary" href="#students">
                Track existing complaint ↗
              </a>
            </div>
            <p className="small-note">
              Explore the concept. Submission and live tracking are coming in a
              later phase.
            </p>
            <span className="cta-mark" aria-hidden="true">
              ↗
            </span>
          </div>
        </section>
      </main>
      <footer className="shell">
        <a className="brand" href="#">
          {site.name}
          <span className="brand-tag">/ a clearer path forward</span>
        </a>
        <p>
          {site.project} · Smart India Hackathon concept
          <br />
          Independent prototype. Not an official AICTE service.
        </p>
        <a className="text-link" href="#">
          Back to top ↑
        </a>
      </footer>
      <NarrativeMotion />
    </>
  );
}
