"use client";
import { useStudentDemo } from "@/components/student/StudentDemoProvider";
import Link from "next/link";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
import { DashboardMetrics } from "@/components/student/DashboardMetrics";
import { ComplaintList } from "@/components/student/ComplaintList";
import { RecentActivity } from "@/components/student/RecentActivity";
export default function StudentDashboard() {
  const { complaints } = useStudentDemo();
  const { profile } = useComplaintStore();
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR VOICE, IN VIEW</p>
          <h1>
            {profile?.display_name?.trim()
              ? `Hello, ${profile.display_name.trim()}.`
              : "Your complaints, in view."}
          </h1>
          <p>Here’s where your grievances stand.</p>
        </div>
        <Link className="button primary" href="/student/complaints/new">
          Raise new complaint <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <DashboardMetrics items={complaints} />
      {complaints.some((c) => c.status === "Needs Information") && (
        <div className="attention-banner">
          <span aria-hidden="true">!</span>
          <div>
            <strong>One complaint needs your attention.</strong>
            <p>
              Additional information was requested for your certificate return
              case.
            </p>
          </div>
          <Link href="/student/complaints/GRV-2026-1018">View case ↗</Link>
        </div>
      )}
      <ComplaintList items={complaints} />
      <div className="dashboard-lower">
        <RecentActivity />
        <aside className="student-guidance">
          <p className="eyebrow">ONE STEP AT A TIME</p>
          <h2>
            A clear record
            <br />
            <em>makes a difference.</em>
          </h2>
          <p>
            Keep relevant dates, receipts and correspondence ready to support your complaint.
          </p>
          <span className="demo-badge">COMPLAINT GUIDANCE</span>
        </aside>
      </div>
    </>
  );
}
