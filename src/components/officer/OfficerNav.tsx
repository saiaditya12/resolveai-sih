"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useOfficerDemo } from "./OfficerDemoProvider";
import { SignOutLink } from "@/components/auth/SignOutLink";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
export function OfficerNav() {
  const { profile, basePath, cellName } = useOfficerDemo();
  const { mode } = useComplaintStore();
  const admin = basePath === "/admin";
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => () => setOpen(false), []);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open]);
  return (
    <aside className="officer-nav">
      <div className="officer-brand">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            r<span>↗</span>
          </span>
          ResolveAI
        </Link>
        <button
          ref={toggle}
          className="officer-menu"
          aria-expanded={open}
          aria-controls="officer-nav-links"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close −" : "Menu +"}
        </button>
      </div>
      <div
        id="officer-nav-links"
        className={open ? "officer-nav-body open" : "officer-nav-body"}
      >
        <p className="eyebrow">{admin ? "RESOLVEAI COMMAND CENTER" : "CELL OFFICER WORKSPACE"}</p>
        <nav aria-label="Officer navigation">
          {[
            ["Dashboard", `${basePath}/dashboard`],
            ...(admin ? [["Command Center", "/admin/command-center"]] : []),
            ["Complaint Queue", `${basePath}/queue`],
            ["Escalations", `${basePath}/dashboard#escalations`],
            ["Institutions", `${basePath}/dashboard#institutions`],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              aria-current={
                path === href || (href === "/admin/command-center" && path.startsWith(href))
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
            >
              {label}
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>
        <details className="officer-settings">
          <summary>Settings · preview</summary>
          <p>
            Account roles and cell assignments are managed by your administrator. Cell mappings are prototype configurations.
          </p>
        </details>
        <div className="officer-profile">
          <span className="officer-avatar">{profile.display_name.slice(0, 2).toUpperCase()}</span>
          <strong>{profile.display_name}</strong>
          <p>{admin ? "Admin / Main Officer" : "Cell Officer"}</p><p>{admin ? "System-wide oversight" : cellName}</p>
          <span className="demo-badge">{mode === "persistent" ? "AUTHENTICATED PROFILE" : "DEMO IDENTITY"}</span>
        </div>
        <SignOutLink className="officer-logout" demoHref="/login">
          {profile ? "Log out ↗" : "Exit officer demo ↗"}
        </SignOutLink>
        <p className="officer-fine">
          {profile
            ? "Officer actions are stored with their audit history."
            : "No authenticated session. Leaving clears officer edits."}
        </p>
      </div>
    </aside>
  );
}
