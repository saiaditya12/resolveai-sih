"use client";
import { useEffect, useRef, useState } from "react";
export function RoutingVisual() {
  const mount = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState("Assigned");
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const media = window.matchMedia(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
    );
    let generation = 0;
    const start = async () => {
      const request = ++generation;
      cleanup?.();
      cleanup = undefined;
      if (!media.matches || paused) return;
      const sceneModule = await import("./routing-scene").catch(() => null);
      if (!sceneModule) return;
      const { createRoutingScene } = sceneModule;
      if (disposed || !media.matches || request !== generation) return;
      cleanup = createRoutingScene(host, setPhase);
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        void start();
        observer.disconnect();
      }
    });
    observer.observe(host);
    media.addEventListener("change", start);
    return () => {
      disposed = true;
      observer.disconnect();
      media.removeEventListener("change", start);
      cleanup?.();
    };
  }, [paused]);
  return (
    <div className="routing-visual">
      <div className="visual-topline">
        <span>
          <i className="status-dot" /> THE ROUTING LAYER
        </span>
        <span>ILLUSTRATIVE MODEL / 01</span>
      </div>
      <div
        className="routing-stage"
        ref={mount}
        role="img"
        aria-label="A complaint enters an understanding layer. Alternative authority paths fade as one destination is selected and assigned."
      >
        <svg
          className="route-fallback"
          viewBox="0 0 640 450"
          aria-hidden="true"
        >
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <path
              d="M72 245H272M320 225L510 90M320 225L550 185M320 225L535 295M320 225L450 385"
              opacity=".25"
            />
            <path
              d="M72 245L295 225L535 295"
              className="selected-route"
              strokeWidth="2"
            />
            <ellipse
              cx="295"
              cy="225"
              rx="80"
              ry="100"
              transform="rotate(-30 295 225)"
            />
            <ellipse
              cx="295"
              cy="225"
              rx="55"
              ry="100"
              transform="rotate(30 295 225)"
            />
            <circle cx="72" cy="245" r="14" />
            <circle cx="510" cy="90" r="7" />
            <circle cx="550" cy="185" r="7" />
            <circle cx="535" cy="295" r="14" className="selected-route" />
            <circle cx="450" cy="385" r="7" />
          </g>
          <rect x="285" y="215" width="20" height="20" fill="currentColor" />
        </svg>
        <div className="scene-label input-label">
          YOUR GRIEVANCE<span>One starting point</span>
        </div>
        <div className="scene-label engine-label">
          UNDERSTANDING<span>Context → responsibility</span>
        </div>
        <div className="scene-label authority-label">
          APPROPRIATE CELL<span>Clear ownership</span>
        </div>
        <span className="other-cell cell-a">Authority path A</span>
        <span className="other-cell cell-b">Authority path B</span>
        <span className="other-cell cell-c">Authority path D</span>
      </div>
      <div className="routing-status">
        <div>
          <span className="eyebrow">COMPLAINT DEMO-024</span>
          <p>
            <span className="animated-status">{phase}</span>
            <span className="static-status">
              Assigned to the appropriate authority
            </span>
          </p>
        </div>
        <button
          className="motion-toggle"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? "Play motion ▷" : "Pause motion Ⅱ"}
        </button>
      </div>
      <ol className="route-progress" aria-label="Illustrative routing progress">{['Complaint received','Understanding issue','Routing','Assigned'].map((label,index)=><li key={label} className={phase===label&&!paused?'is-current':''}><span className="progress-number">0{index+1}</span><span>{label}</span></li>)}</ol>
    </div>
  );
}

