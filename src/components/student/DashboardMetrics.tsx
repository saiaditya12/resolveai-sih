import type { Complaint } from "@/lib/demo-student";
export function DashboardMetrics({ items }: { items: Complaint[] }) {
  const metrics = [
    ["Total complaints", items.length, "All your demo cases"],
    [
      "In progress",
      items.filter((c) =>
        ["Submitted", "Assigned", "Under Review", "Escalated"].includes(
          c.status,
        ),
      ).length,
      "Submitted, assigned or in review",
    ],
    [
      "Resolved",
      items.filter((c) => c.status === "Resolved").length,
      "An outcome recorded",
    ],
    [
      "Needs action",
      items.filter((c) => c.status === "Needs Information").length,
      "Information requested",
    ],
  ];
  return (
    <dl className="dashboard-metrics">
      {metrics.map(([label, value, note]) => (
        <div
          key={label}
          className={label === "Needs action" ? "metric-attention" : ""}
        >
          <dt>{label}</dt>
          <dd>{value}</dd>
          <p>{note}</p>
        </div>
      ))}
    </dl>
  );
}
