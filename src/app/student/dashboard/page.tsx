"use client";
import { useStudentDemo } from "@/components/student/StudentDemoProvider";
import Link from "next/link";
import { demoStudent } from "@/lib/demo-student";
import { DashboardMetrics } from "@/components/student/DashboardMetrics";
import { ComplaintList } from "@/components/student/ComplaintList";
import { RecentActivity } from "@/components/student/RecentActivity";
export default function StudentDashboard() {
  const { complaints } = useStudentDemo();
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR VOICE, IN VIEW</p>
          <h1>Hello, {demoStudent.name.split(" ")[0]}.</h1>
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
            Keep relevant dates, receipts and correspondence ready. You can try
            the local demo submission flow with fictional information and sample
            evidence.
          </p>
          <span className="demo-badge">LOCAL DEMO · NO SERVER STORAGE</span>
        </aside>
      </div>
    </>
  );
}
