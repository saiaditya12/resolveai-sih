import {
  officerSla,
  statusLabel,
  type ComplaintQueueItem,
  type ComplaintPriority,
} from "@/lib/officer-model";
import type { LifecycleStatus } from "@/lib/complaint-tracking";
export function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  return (
    <span className={`officer-badge priority-${priority.toLowerCase()}`}>
      {priority === "Critical" ? "!!" : priority === "High" ? "!" : "·"}{" "}
      {priority}
    </span>
  );
}
export function OfficerStatus({ status }: { status: LifecycleStatus }) {
  return (
    <span
      className={`officer-badge ${status === "Resolved" ? "badge-success" : status === "Escalated" ? "badge-alert" : ""}`}
    >
      {status === "Resolved" ? "✓ " : ""}
      {statusLabel(status)}
    </span>
  );
}
export function SlaBadge({ item }: { item: ComplaintQueueItem }) {
  const sla = officerSla(item);
  const label =
    sla.state === "On Track"
      ? "Normal"
      : sla.state === "Complete"
        ? "Resolved"
        : sla.state;
  return (
    <span
      className={`officer-badge sla-${sla.state.toLowerCase().replaceAll(" ", "-")}`}
    >
      {label}
    </span>
  );
}
