"use client";
import { useRef, type ReactNode } from "react";
export function PreviewButton({
  children,
  small = false,
}: {
  children: ReactNode;
  small?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className={`button primary ${small ? "small" : ""}`}
        onClick={() => dialog.current?.showModal()}
      >
        {children}
      </button>
      <dialog
        ref={dialog}
        className="preview-dialog"
        aria-label="Complaint submission preview"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <p className="eyebrow">PHASE 1 / PRODUCT CONCEPT</p>
        <h2>A clearer path is taking shape.</h2>
        <p>
          Complaint submission isn’t available in this prototype. No personal
          information is collected or sent.
        </p>
        <p>
          Explore the example tracking journey to see how a future case could
          progress.
        </p>
        <div className="actions">
          <a
            className="button primary"
            href="#students"
            onClick={() => dialog.current?.close()}
          >
            View example journey ↗
          </a>
          <button
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
