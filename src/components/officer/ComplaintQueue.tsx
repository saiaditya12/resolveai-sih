"use client";
import { cellDisplayName, institutionDisplayName } from "@/lib/presentation";
import Link from "next/link";
import { useState } from "react";
import { useOfficerDemo } from "./OfficerDemoProvider";
import {
  defaultQueueFilters,
  filterQueue,
  officerCells,
  officerSla,
  statusLabel,
  type QueueFilters,
  type ComplaintQueueItem,
} from "@/lib/officer-model";
import { lifecycleStatuses } from "@/lib/complaint-tracking";
import { formatDemoDate } from "@/lib/demo-student";
import { PriorityBadge, OfficerStatus, SlaBadge } from "./OfficerBadges";
export function QueueFiltersPanel({
  filters,
  onChange,
  cases,
}: {
  filters: QueueFilters;
  onChange: (value: QueueFilters) => void;
  cases: ComplaintQueueItem[];
}) {
  const controls: [keyof QueueFilters, string, string[]][] = [
    ["status", "Status", ["all", ...lifecycleStatuses]],
    ["priority", "Priority", ["all", "Critical", "High", "Medium", "Low"]],
    ["category", "Category", ["all", ...new Set(cases.map((c) => c.category))]],
    [
      "sla",
      "SLA state",
      [
        "all",
        "Normal",
        "Due Soon",
        "Overdue",
        "Escalated",
        "Resolved",
        "Paused",
        "Not scheduled",
      ],
    ],
    [
      "institution",
      "Institution",
      ["all", ...new Set(cases.map((c) => c.institution))],
    ],
    [
      "sort",
      "Sort by",
      ["priority", "newest", "oldest", "overdue", "deadline"],
    ],
  ];
  const labels: Record<string, string> = {
    all: "All",
    mine: "My cell",
    priority: "Highest Priority",
    newest: "Newest",
    oldest: "Oldest",
    overdue: "Most Overdue",
    deadline: "Deadline Soonest",
  };
  return (
    <div className="queue-filters">
      {controls.map(([key, label, options]) => (
        <label key={key}>
          {label}
          <select
            value={filters[key]}
            onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
          >
            {options.map((value) => (
              <option key={value} value={value}>
                {key === "scope" && value === "all"
                  ? "All cells"
                  : key === "status" && value !== "all"
                    ? statusLabel(value as ComplaintQueueItem["status"])
                    : key === "institution"
                      ? institutionDisplayName(value)
                      : labels[value] || value}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button
        className="officer-text-button"
        onClick={() => onChange({ ...defaultQueueFilters, scope: "all" })}
      >
        Reset filters
      </button>
    </div>
  );
}
export function QueueRows({ items }: { items: ComplaintQueueItem[] }) {
  const { basePath } = useOfficerDemo();
  return (
    <ul className="officer-queue-list">
      {items.map((item) => (
        <li key={item.id}>
          <div className="queue-case">
            <span className="eyebrow">
              {item.id} / {item.category}
            </span>
            <h3>
              <Link href={`${basePath}/complaints/${item.id}`}>
                {item.title} <span aria-hidden="true">↗</span>
              </Link>
            </h3>
            <p>{institutionDisplayName(item.institution)}</p>
            <p className="queue-cell">
              {item.routingStatus === "manual-review" &&
              !item.overriddenByOfficer
                ? "Manual review queue"
                : cellDisplayName(officerCells.find((c) => c.id === item.cellId)?.name)}
            </p>
            {item.routingStatus === "manual-review" && (
              <p className="queue-cell">Manual review required</p>
            )}
            {item.intelligence?.reviewRecommended && (
              <p className="queue-cell">Officer review recommended</p>
            )}
          </div>
          <div className="queue-state">
            <PriorityBadge priority={item.priority} />
            <OfficerStatus status={item.status} />
          </div>
          <div className="queue-sla">
            <SlaBadge item={item} />
            <p>{officerSla(item).text}</p>
            {officerSla(item).escalationRecommended && (
              <p className="queue-escalation-recommendation">
                Escalation recommended
              </p>
            )}
          </div>
          <div className="queue-dates">
            <p>
              Submitted{" "}
              <time dateTime={item.submittedAt}>
                {formatDemoDate(item.submittedAt)}
              </time>
            </p>
            <p>
              Last activity{" "}
              <time dateTime={item.updatedAt}>
                {formatDemoDate(item.updatedAt)}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
export function ComplaintQueue() {
  const { cases, cellName, profile } = useOfficerDemo();
  const [filters, setFilters] = useState<QueueFilters>({
    ...defaultQueueFilters,
    scope: "all",
  });
  const items = filterQueue(cases, { ...filters, scope: "all" });
  return (
    <>
      <div className="officer-page-heading">
        <p className="eyebrow">OPERATIONS / THE COMPLAINT QUEUE</p>
        <h1>A clear view of the work.</h1>
        <p>
          Filter the caseload, find the next priority, and open the
          full record.
        </p>
      </div>
      <p className="officer-notice">
        {profile.role === "admin" ? "System-wide oversight across cells." : `Cases currently assigned to ${cellName}. Transfers move access to the new cell.`}
      </p>
      <section className="officer-panel">
        <QueueFiltersPanel
          filters={filters}
          onChange={setFilters}
          cases={cases}
        />
        <p className="queue-result" role="status">
          {items.length} of {cases.length} cases ·{" "}
          {profile.role === "admin" ? "All configured cells" : cellName}
        </p>
        <QueueRows items={items} />
        {!items.length && (
          <div className="officer-empty">
            <h2>No cases match this view.</h2>
            <p>Try another filter within your authorized workspace.</p>
            <button
              className="button secondary"
              onClick={() =>
                setFilters({ ...defaultQueueFilters, scope: "all" })
              }
            >
              Reset filters
            </button>
          </div>
        )}
      </section>
    </>
  );
}
