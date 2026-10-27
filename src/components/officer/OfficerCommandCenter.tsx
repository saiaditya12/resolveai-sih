"use client";
import {
  cellDisplayName,
  institutionDisplayName,
  normalizeInstitutionName,
} from "@/lib/presentation";

import Link from "next/link";
import { reviewCells } from "@/lib/cells";
import { lifecycleStatuses } from "@/lib/complaint-tracking";
import { useMemo, useState } from "react";
import { formatEventTime } from "@/lib/complaint-tracking";
import { OFFICER_DEMO_CLOCK, type ComplaintQueueItem } from "@/lib/officer-model";
import {
  calculateCommandCenterMetrics,
  defaultCommandCenterFilters,
  filterCommandCenterCases,
  type CommandCenterFilters,
} from "@/lib/sla/analytics";
import { prototypeSlaPolicy } from "@/lib/sla/policy";
import { useOfficerDemo } from "./OfficerDemoProvider";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
import { PriorityBadge, SlaBadge } from "./OfficerBadges";

const slaStates = [
  "Normal",
  "Due Soon",
  "Overdue",
  "Paused",
  "Escalated",
  "Resolved",
  "Not scheduled",
] as const;

function CaseLink({ item }: { item: ComplaintQueueItem }) {
  const { basePath } = useOfficerDemo();
  return (
    <Link href={`${basePath}/complaints/${item.id}`}>
      {item.id} · {item.title}
    </Link>
  );
}

export function OfficerCommandCenter() {
  const { cases, basePath } = useOfficerDemo();
  const { mode } = useComplaintStore();
  const asOf = useMemo(
    () => (mode === "persistent" ? new Date().toISOString() : OFFICER_DEMO_CLOCK),
    [mode],
  );
  const [cell, setCell] = useState("all");
  const [status, setStatus] = useState("all");
  const [filters, setFilters] = useState<CommandCenterFilters>(
    defaultCommandCenterFilters,
  );
  const filteredCases = useMemo(
    () => filterCommandCenterCases(cases.filter(item => (cell === "all" || item.cellId === cell) && (status === "all" || item.status === status)), asOf, filters),
    [cases, filters, cell, status, asOf],
  );
  const metrics = useMemo(
    () =>
      calculateCommandCenterMetrics(
        filteredCases,
        asOf,
        filters.windowDays,
      ),
    [filteredCases, filters.windowDays, asOf],
  );
  const categories = [...new Set(cases.map((item) => item.category))].sort();
  const institutions = [
    ...new Map(
      cases.map((item) => [
        normalizeInstitutionName(item.institution),
        item.institution,
      ]),
    ).values(),
  ].sort();

  return (
    <>
      <div className="officer-page-heading">
        <p className="eyebrow">OPERATIONS / MONITORING</p>
        <h1>Command center</h1>
        <p>
          A view of response windows, workload signals, and meaningful
          case activity.
        </p>
      </div>
      <p className="officer-notice">
        Service-level targets are configurable by the administering authority. SLA targets and escalation recommendations
        do not change case status, priority, ownership, or routing.
      </p>
      <section className="officer-panel command-center-filters" aria-label="Command center filters">
        <label>Cell<select value={cell} onChange={e => setCell(e.target.value)}><option value="all">All configured cells</option>{reviewCells.map(c => <option key={c.id} value={c.id}>{cellDisplayName(c.name)}</option>)}</select></label>
        <label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{lifecycleStatuses.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>
          Monitoring window
          <select
            value={filters.windowDays}
            onChange={(event) => {
              const windowDays = prototypeSlaPolicy.windowsDays.find(
                (days) => days === Number(event.target.value),
              );
              if (windowDays) setFilters({ ...filters, windowDays });
            }}
          >
            {prototypeSlaPolicy.windowsDays.map((days) => (
              <option key={days} value={days}>
                Last {days} days
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={filters.category}
            onChange={(event) =>
              setFilters({ ...filters, category: event.target.value })
            }
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Institution
          <select
            value={filters.institution}
            onChange={(event) =>
              setFilters({ ...filters, institution: event.target.value })
            }
          >
            <option value="all">All institutions</option>
            {institutions.map((institution) => (
              <option key={institution} value={institution}>
                {institutionDisplayName(institution)}
              </option>
            ))}
          </select>
        </label>
        <label>
          SLA state
          <select
            value={filters.sla}
            onChange={(event) => {
              const sla = slaStates.find(
                (state) => state === event.target.value,
              );
              setFilters({ ...filters, sla: sla ?? "all" });
            }}
          >
            <option value="all">All SLA states</option>
            {slaStates.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <button
          className="officer-text-button"
          onClick={() => setFilters(defaultCommandCenterFilters)}
        >
          Reset filters
        </button>
      </section>

      <section aria-label="Complaint monitoring metrics">
        <dl className="officer-metrics command-center-metrics">
          <div><dt>Active complaints</dt><dd>{metrics.active}</dd></div>
          <div><dt>Due soon</dt><dd>{metrics.dueSoon}</dd></div>
          <div><dt>Overdue</dt><dd>{metrics.overdue}</dd></div>
          <div><dt>Escalated</dt><dd>{metrics.escalated}</dd></div>
          <div><dt>Resolved</dt><dd>{metrics.resolved}</dd></div>
          <div><dt>Manual review</dt><dd>{metrics.manualReview}</dd></div>
        </dl>
        <p className="officer-fine">
          Average resolution time:{" "}
          {metrics.averageResolutionHours === null
            ? "Not available for this view"
            : `${metrics.averageResolutionHours.toFixed(1)} hours`}
          . Filtered to {filteredCases.length} unique complaints.
        </p>
      </section>

      <div className="command-center-grid">
        <section className="officer-panel">
          <p className="eyebrow">SLA / CASE STATES</p>
          <h2>Response window breakdown</h2>
          <ul className="command-center-list">
            {slaStates.map((state) => (
              <li key={state}><span>{state}</span><strong>{metrics.slaBreakdown[state]}</strong></li>
            ))}
          </ul>
          <h3>Priority mix</h3>
          <ul className="command-center-list">
            {["Critical", "High", "Medium", "Low"].map((priority) => (
              <li key={priority}><span>{priority}</span><strong>{metrics.priorityBreakdown[priority] ?? 0}</strong></li>
            ))}
          </ul>
        </section>

        <section className="officer-panel">
          <p className="eyebrow">CASE ATTENTION / HOTLIST</p>
          <h2>Needs attention</h2>
          {metrics.attention.length ? (
            <ul className="command-center-cases">
              {metrics.attention.map(({ item, reasons }) => (
                <li key={item.id}>
                  <div><CaseLink item={item} /><p>{reasons.join(" · ")}</p></div>
                  <div className="officer-badges"><PriorityBadge priority={item.priority} /><SlaBadge item={item} /></div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No attention cases match the current filters.</p>
          )}
        </section>

        <section className="officer-panel">
          <p className="eyebrow">INSTITUTIONS / CATEGORIES</p>
          <h2>Monitoring signals</h2>
          {metrics.institutions.length ? (
            <ul className="command-center-cases">
              {metrics.institutions.map((institution) => (
                <li key={institution.institution}>
                  <div>
                    <strong>{institutionDisplayName(institution.institution)}</strong>
                    <p>Top category: {institution.topCategory}</p>
                    {institution.repeatedIssue && <p>Repeated issue signal: {institution.repeatedIssue}</p>}
                  </div>
                  <span>{institution.active} active · {institution.overdue} overdue</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No institution records match the current filters.</p>
          )}
          <h3>Category volume</h3>
          {metrics.categories.length ? (
            <ul className="command-center-list">
              {metrics.categories.map(({ category, count }) => (
                <li key={category}><span>{category}</span><strong>{count}</strong></li>
              ))}
            </ul>
          ) : (
            <p>No categories match the current filters.</p>
          )}
        </section>

        <section className="officer-panel">
          <p className="eyebrow">REPEATED ISSUE PATTERNS</p>
          <h2>Institution issue patterns</h2>
          {metrics.patterns.length ? (
            <ul className="command-center-cases">
              {metrics.patterns.map(({ institution, cluster }) => (
                <li key={`${institution}:${cluster.id}`}>
                  <div><strong>{cluster.label}</strong><p>{institution}</p></div>
                  <span>{cluster.complaintCount} related complaints</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No repeated issue cluster in the filtered records.</p>
          )}
          <p className="officer-fine">
            Signals reuse the institution-history clustering and are
            not findings about an institution.
          </p>
        </section>

        <section className="officer-panel command-center-activity">
          <p className="eyebrow">MEANINGFUL CASE EVENTS</p>
          <h2>Recent activity</h2>
          {metrics.recentActivity.length ? (
            <ul className="command-center-cases">
              {metrics.recentActivity.map((event) => (
                <li key={event.id}>
                  <div>
                    <Link href={`${basePath}/complaints/${event.complaintId}`}>
                      {event.complaintId} · {event.title}
                    </Link>
                    <p>{institutionDisplayName(event.institution)}</p>
                  </div>
                  <time dateTime={event.at}>{formatEventTime(event.at)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p>No meaningful activity matches the current monitoring window.</p>
          )}
        </section>
      </div>
      <p className="officer-fine">
        {mode === "persistent"
          ? `Reporting as of ${formatEventTime(asOf)} IST. `
          : `Illustrative scenario as of ${formatEventTime(asOf)} IST. `}
        A recommendation is advisory only; officers retain control of escalation.
        {filters.sla === "all" ? "" : ` Filter: ${filters.sla}.`}
      </p>
    </>
  );
}
