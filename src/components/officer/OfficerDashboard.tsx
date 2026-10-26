"use client";
import Link from "next/link";
import { useMemo } from "react";
import { firstRepeatedIssuePattern } from "@/lib/similarity/similarity";
import { formatDemoDate } from "@/lib/demo-student";
import { useOfficerDemo } from "./OfficerDemoProvider";
import {
  OFFICER_DEMO_CLOCK,
  officerMetrics,
  officerCells,
  officerSla,
  institutionHistory,
  priorityRank,
  isOpenCase,
} from "@/lib/officer-model";
import { getInstitutionSignals } from "@/lib/patterns/institution-patterns";
import { institutionPatternPolicy } from "@/lib/patterns/types";
import { QueueRows } from "./ComplaintQueue";
export function OfficerDashboard() {
  const { cases, basePath, cellName } = useOfficerDemo();
  const admin = basePath === "/admin";
  const mine = cases;
  const metrics = officerMetrics(mine);
  const urgent = mine
    .filter(isOpenCase)
    .sort(
      (a, b) =>
        priorityRank[b.priority] - priorityRank[a.priority] ||
        a.dueAt.localeCompare(b.dueAt),
    )
    .slice(0, 3);
  const escalated = cases.filter((c) => c.status === "Escalated");
  const institutions = [...new Set(cases.map((c) => c.institution))].map(
    (name) => institutionHistory(cases, name),
  );
  const pattern = useMemo(() => firstRepeatedIssuePattern(cases), [cases]);
  const institutionSignals = useMemo(
    () => getInstitutionSignals(cases, OFFICER_DEMO_CLOCK),
    [cases],
  );
  return (
    <>
      <div className="officer-page-heading officer-heading-row">
        <div>
          <p className="eyebrow">{admin ? "SYSTEM-WIDE OVERSIGHT" : cellName}</p>
          <h1>{admin ? "ResolveAI Command Center" : "Cell Officer Workspace"}</h1>
          <p>
            {admin ? "System-wide workloads, escalations and institutional context. Cells retain day-to-day responsibility." : "Your cell’s workload, the next priorities, and the context behind them."}
          </p>
        </div>
        <Link href={`${basePath}/queue`} className="button primary">
          Open complaint queue ↗
        </Link>
      </div>
      {admin && <section className="officer-panel"><h2>Cell workloads</h2><dl className="officer-metrics">{officerCells.map(cell => <div key={cell.id}><dt>{cell.name}</dt><dd>{cases.filter(c => c.cellId === cell.id && isOpenCase(c)).length}</dd><p>Active cases</p></div>)}</dl></section>}
      <dl className="officer-metrics">
        {[
          ["New", metrics.new, "Submitted through assignment"],
          [admin ? "Total active complaints" : "Assigned cases", admin ? metrics.active : mine.length, "Within this workspace"],
          ["Under Review", mine.filter(c => c.status === "Officer Review").length, "Officer review in progress"],
          ["Waiting for Student", mine.filter(c => c.status === "Student Action Required").length, "Information requested"],
          ["Due Soon", mine.filter(c => officerSla(c).state === "Due Soon").length, "Prototype response target"],
          ["Escalated", escalated.length, "Higher-level attention"],
          ["Routed", mine.filter(c => c.routingStatus === "routed").length, "Current routing recorded"],
          ["Resolved", mine.filter(c => c.status === "Resolved").length, "Recorded outcomes"],
          ["Needs Action", metrics.needsAction, "Ready for officer attention"],
          ["Overdue", metrics.overdue, "Past the demo response target"],
          [
            "Resolved This Week",
            metrics.resolvedWeek,
            "18–24 Oct 2026 demo window",
          ],
        ].map(([label, value, note]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
            <p>{note}</p>
          </div>
        ))}
      </dl>
      <p className="officer-fine">
        Counts derive only from the cases authorized for this workspace. Time indicators use a fixed scenario:
        24 Oct 2026, 10:00 am IST. No official SLA policy.
      </p>
      {pattern && <section className="officer-pattern">
        <div>
          <p className="eyebrow">REPEATED ISSUE PATTERN / LOCAL DEMO RECORDS</p>
          <h2>A recurring concern deserves context.</h2>
          <p>{pattern.count} related complaints at {pattern.institution}. {pattern.category} · {pattern.windowDays} days ending {formatDemoDate(pattern.asOf)}. A signal for review, not a finding about the institution.</p>
        </div>
        <Link href={`${basePath}/complaints/${pattern.complaintId}`} className="text-link">Review related complaints ↗</Link>
      </section>}
      {institutionSignals.length > 0 && (
        <section
          className="officer-panel officer-institution-signals"
          aria-labelledby="institution-signals-title"
        >
          <p className="eyebrow">INSTITUTION SIGNALS / LOCAL DEMO RECORDS</p>
          <h2 id="institution-signals-title">Patterns to review in context.</h2>
          <div className="officer-signal-grid">
            {institutionSignals.map(({ institution, cluster, openCount }) => (
              <article key={cluster.id}>
                <p className="officer-fine">{institution}</p>
                <h3>{cluster.label}</h3>
                <p>
                  {cluster.recentCount} related complaints in the last{" "}
                  {institutionPatternPolicy.patternWindowDays} days ·{" "}
                  {openCount} open
                </p>
                <p className="officer-signal-trend">
                  {cluster.trend === "New pattern"
                    ? "Newly observed issue"
                    : `${cluster.trend} complaint activity`}
                </p>
                <Link
                  className="text-link"
                  href={`${basePath}/complaints/${cluster.complaintIds[0]}`}
                >
                  Review sample cases ↗
                </Link>
              </article>
            ))}
          </div>
          <p className="officer-fine">
            Activity comparisons are descriptive only, not statistically
            significant and not findings about any institution.
          </p>
        </section>
      )}
      <section className="officer-panel"><h2>Recently updated</h2><QueueRows items={[...cases].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,3)} /></section>
      <section className="officer-panel">
        <div className="officer-section-head">
          <div>
            <p className="eyebrow">01 / PRIORITY WORK</p>
            <h2>Start with what needs attention.</h2>
          </div>
          <Link className="text-link" href={`${basePath}/queue`}>
            All cases ↗
          </Link>
        </div>
        <QueueRows items={urgent} />
        {!urgent.length && <p>No active cases remain in your demo cell.</p>}
      </section>
      <div className="officer-dashboard-lower">
        <section className="officer-panel" id="escalations">
          <p className="eyebrow">02 / ESCALATIONS · THIS WORKSPACE</p>
          <h2>A higher level of review.</h2>
          {escalated.length ? (
            <ul className="officer-related">
              {escalated.map((c) => (
                <li key={c.id}>
                  <Link href={`${basePath}/complaints/${c.id}`}>
                    <span>{c.id}</span>
                    <strong>{c.title} ↗</strong>
                    <p>
                      {c.escalationReason || "Escalated in this demo scenario."}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>No escalated demo cases.</p>
          )}
        </section>
        <section className="officer-panel" id="analytics">
          <p className="eyebrow">03 / ANALYTICS · SAMPLE COUNTS</p>
          <h2>Where the work sits.</h2>
          <dl className="officer-distribution">
            {[...new Set(cases.map((c) => c.category))].map((category) => (
              <div key={category}>
                <dt>{category}</dt>
                <dd>
                  {cases.filter((c) => c.category === category).length} demo
                  cases
                </dd>
              </div>
            ))}
          </dl>
          <p className="officer-fine">
            Derived only from this workspace’s authorized dataset. No live
            analytics pipeline.
          </p>
        </section>
      </div>
      <section className="officer-panel" id="institutions">
        <p className="eyebrow">04 / INSTITUTION CONTEXT · FICTIONAL</p>
        <h2>Patterns with their limits in view.</h2>
        <div className="officer-institution-grid">
          {institutions.map((i) => (
            <article key={i.institution}>
              <h3>{i.institution}</h3>
              <p>
                {i.total} cases · {i.open} open · {i.resolved} resolved
              </p>
              <p>Top category: {i.topCategory}</p>
              <small>{i.pattern}</small>
            </article>
          ))}
        </div>
        <p className="officer-fine">
          Last 90 days relative to the fixed demo clock. These are not real
          institution statistics.
        </p>
      </section>
    </>
  );
}
