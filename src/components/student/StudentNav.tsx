"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";

import { SignOutLink } from "@/components/auth/SignOutLink";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
export function StudentNav() {
  const { profile } = useComplaintStore();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const support = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const mq = matchMedia("(min-width: 1024px)");
    const resize = () => {
      if (mq.matches) setOpen(false);
    };
    window.addEventListener("keydown", key);
    mq.addEventListener("change", resize);
    return () => {
      window.removeEventListener("keydown", key);
      mq.removeEventListener("change", resize);
    };
  }, [open]);
  return (
    <aside className="student-sidebar">
      <div className="student-brand-row">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            r<span>↗</span>
          </span>
          {site.name}
        </Link>
        <button
          ref={toggle}
          className="student-menu"
          aria-controls="student-nav"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Close −" : "Menu +"}
        </button>
      </div>
      <div
        className={`student-nav-body ${open ? "open" : ""}`}
        id="student-nav"
      >
        <p className="eyebrow">STUDENT PORTAL</p>
        <nav aria-label="Student navigation">
          <Link
            href="/student/dashboard"
            aria-current={path === "/student/dashboard" ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">◫</span> Dashboard
          </Link>
          <Link
            href="/student/dashboard#complaints"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">☷</span> My complaints
          </Link>
          <Link
            href="/student/complaints/new"
            aria-current={
              path === "/student/complaints/new" ? "page" : undefined
            }
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">＋</span> Raise complaint
          </Link>
          <button onClick={() => support.current?.showModal()}>
            <span aria-hidden="true">?</span> Help & support
          </button>
        </nav>
        <div className="student-nav-note">
          <span className="demo-badge">COMPLAINT WORKSPACE</span>
          <p>A clearer path to resolution.</p>
        </div>
        <div className="student-profile">
          <span className="student-avatar">{profile?.display_name?.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "—"}</span>
          <div>
            <strong>{profile?.display_name?.trim() || "Your account"}</strong>
            <span>Student</span>
          </div>
        </div>
        <SignOutLink
          className="student-logout"
          demoHref="/login"
        >
          Sign out ↗
        </SignOutLink>
        <p className="student-session-note">
          {profile ? "Signed in with your student account." : "No authenticated session is active."}
        </p>
      </div>
      <dialog
        ref={support}
        className="preview-dialog"
        aria-label="Help and support"
      >
        <p className="eyebrow">HELP & SUPPORT</p>
        <h2>Support is coming.</h2>
        <p>
          This is an independent platform. Live assistance and complaint
          support are not connected.
        </p>
        <button
          className="button primary"
          onClick={() => support.current?.close()}
        >
          Close
        </button>
      </dialog>
    </aside>
  );
}
