import type { ComplaintStatus } from "@/lib/demo-student";
const styles: Record<ComplaintStatus, string> = {
  Escalated: "attention",
  Submitted: "submitted",
  Assigned: "assigned",
  "Under Review": "review",
  "Needs Information": "attention",
  Resolved: "resolved",
};
export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return (
    <span className={`complaint-status ${styles[status]}`}>
      <span aria-hidden="true">
        {status === "Resolved"
          ? "✓"
          : status === "Needs Information"
            ? "!"
            : "•"}
      </span>
      {status}
    </span>
  );
}
