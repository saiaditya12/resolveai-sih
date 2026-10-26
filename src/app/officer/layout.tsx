import { getReviewCell } from "@/lib/cells";
import type { ReactNode } from "react";
import { OfficerDemoProvider } from "@/components/officer/OfficerDemoProvider";
import { OfficerNav } from "@/components/officer/OfficerNav";
import "./officer.css";
export const metadata = { title: "Cell Officer Workspace — ResolveAI" };
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { requireRole } from "@/lib/supabase/auth";
export default async function OfficerLayout({ children }: { children: ReactNode }) {
  const profile = await requireRole(["officer"]);
  const persistent = hasSupabaseConfiguration();
  return (
    <OfficerDemoProvider trustedProfile={profile}>
      <div className="officer-app">
        <a href="#officer-main" className="skip-link">
          Skip to officer workspace
        </a>
        <OfficerNav />
        <div className="officer-content">
          <header className="officer-topbar">
            <span>Cell Officer Workspace / {getReviewCell(profile?.cell_id)?.name ?? (profile ? "Unassigned account" : "Demo Student Grievance Cell")}</span>
            <span className="demo-badge">
              {persistent
                ? "PERSISTENT CASEWORK · NO EXTERNAL ACTIONS"
                : "LOCAL DEMO · NO EXTERNAL ACTIONS"}
            </span>
          </header>
          <main id="officer-main">{profile && !getReviewCell(profile.cell_id) ? <section className="officer-panel"><h1>No review cell has been assigned to this officer account.</h1><p>Contact your administrator to configure your account. Complaint access is disabled.</p></section> : children}</main>
          <footer className="officer-footer">
            Independent SIH prototype. Not an official AICTE service.{" "}
            {persistent
              ? "Officer actions and case history are stored in the configured database."
              : "Officer changes stay in memory and reset on refresh."}
          </footer>
        </div>
      </div>
    </OfficerDemoProvider>
  );
}
