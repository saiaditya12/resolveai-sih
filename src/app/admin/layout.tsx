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
                ? "CASE WORKSPACE"
                : "CASE WORKSPACE"}
            </span>
          </header>
          <main id="officer-main">{children}</main>
          <footer className="officer-footer">
            An intelligent grievance routing, tracking and monitoring platform.{" "}
            {persistent
              ? "Actions and case history are saved to the complaint record."
              : "Officer changes stay in memory and reset on refresh."}
          </footer>
        </div>
      </div>
    </OfficerDemoProvider>
  );
}
