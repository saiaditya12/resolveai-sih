import type { ReactNode } from "react";
import { OfficerDemoProvider } from "@/components/officer/OfficerDemoProvider";
import { OfficerNav } from "@/components/officer/OfficerNav";
import "../officer/officer.css";
export const metadata = { title: "Command Center — ResolveAI" };
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { requireRole } from "@/lib/supabase/auth";
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireRole(["admin"]);
  const persistent = hasSupabaseConfiguration();
  return (
    <OfficerDemoProvider trustedProfile={profile} workspace="admin">
      <div className="officer-app">
        <a href="#officer-main" className="skip-link">
          Skip to officer workspace
        </a>
        <OfficerNav />
        <div className="officer-content">
          <header className="officer-topbar">
            <span>ResolveAI Command Center</span>
            <span className="demo-badge">
              {persistent
                ? "PERSISTENT CASEWORK · NO EXTERNAL ACTIONS"
                : "LOCAL DEMO · NO EXTERNAL ACTIONS"}
            </span>
          </header>
          <main id="officer-main">{children}</main>
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
