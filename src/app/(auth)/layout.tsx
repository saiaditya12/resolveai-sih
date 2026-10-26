import Link from "next/link";
import { site } from "@/lib/site";
import type { ReactNode } from "react";
import "./auth.css";
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <a className="skip-link" href="#auth-main">
        Skip to form
      </a>
      <header className="auth-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            r<span>↗</span>
          </span>
          {site.name}
        </Link>
        <Link className="text-link" href="/">
          Back to home ↗
        </Link>
      </header>
      <main id="auth-main" className="auth-grid">
        <aside className="auth-story">
          <p className="eyebrow">YOUR VOICE. A CLEARER PATH.</p>
          <h1>
            One place to begin.
            <br />
            <em>A way to stay informed.</em>
          </h1>
          <p>
            Raise institutional concerns, follow your case, and know what
            happens next.
          </p>
          <ol>
            <li>
              <span>01</span> One starting point
            </li>
            <li>
              <span>02</span> Clear responsibility
            </li>
            <li>
              <span>03</span> Visible progress
            </li>
          </ol>
          <div className="auth-disclaimer">
            PHASE 2 / INTERFACE PREVIEW
            <br />
            <span>Independent SIH concept. Not an official AICTE service.</span>
          </div>
        </aside>
        <section className="auth-form-panel">{children}</section>
      </main>
    </div>
  );
}
