import { StudentDemoProvider } from "@/components/student/StudentDemoProvider";
import type { ReactNode } from "react";
import { StudentNav } from "@/components/student/StudentNav";
import "./student.css";
export const metadata = { title: "Student Portal — ResolveAI" };
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { requireRole } from "@/lib/supabase/auth";
export default async function StudentLayout({ children }: { children: ReactNode }) {
  await requireRole(["student"]);
  const persistent = hasSupabaseConfiguration();
  return (
    <StudentDemoProvider>
      <div className="student-app">
        <a className="skip-link" href="#student-main">
          Skip to workspace
        </a>
        <StudentNav />
        <div className="student-content">
          <header className="workspace-header">
            <span>Student Portal</span>
            <span className="demo-badge">
              {persistent
                ? "ACCOUNT WORKSPACE"
                : "STUDENT WORKSPACE"}
            </span>
          </header>
          <main id="student-main">{children}</main>
          <div className="student-bottom-note">
            ResolveAI · A clearer path to resolution.{" "}
            {persistent
              ? "Your complaints and responses are saved to your account."
              : "Records clear when the browser session ends."}
          </div>
        </div>
      </div>
    </StudentDemoProvider>
  );
}
