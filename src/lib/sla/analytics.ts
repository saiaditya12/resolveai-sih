import type { ComplaintQueueItem } from "../officer-model.ts";
import { isOpenCase } from "../officer-model.ts";
import {
  getInstitutionComplaintHistory,
} from "../patterns/institution-patterns.ts";
import type {
  InstitutionPatternComplaint,
  IssueCluster,
} from "../patterns/types.ts";
import { prototypeSlaPolicy, type MonitoringWindowDays } from "./policy.ts";
import { calculateSla, isInMonitoringWindow } from "./sla.ts";
import type { SlaCalculation, SlaState } from "./types.ts";

export interface CategoryMetric {
  category: string;
  count: number;
}

export interface InstitutionMonitorRow {
  institution: string;
  active: number;
  overdue: number;
  repeatedIssue: string | null;
  topCategory: string;
}

export interface AttentionCase {
  item: ComplaintQueueItem;
  sla: SlaCalculation;
  reasons: string[];
}

export interface CommandCenterMetrics {
  windowDays: MonitoringWindowDays;
  active: number;
  dueSoon: number;
  overdue: number;
  escalated: number;
  resolved: number;
  manualReview: number;
  averageResolutionHours: number | null;
  categories: CategoryMetric[];
  institutions: InstitutionMonitorRow[];
  patterns: Array<{ institution: string; cluster: IssueCluster }>;
  attention: AttentionCase[];
  recentActivity: Array<{
    id: string;
    complaintId: string;
    title: string;
    institution: string;
    at: string;
  }>;
  slaBreakdown: Record<SlaState, number>;
  priorityBreakdown: Record<string, number>;
}

export interface CommandCenterFilters {
  windowDays: MonitoringWindowDays;
  category: string;
  institution: string;
  sla: "all" | SlaState;
}

export const defaultCommandCenterFilters: CommandCenterFilters = {
  windowDays: 30,
  category: "all",
  institution: "all",
  sla: "all",
};

const meaningfulActivity =
  /^(complaint submitted|routed to demo cell|information requested from (student|institution)|case transferred|case escalated|resolution added|student response recorded locally)$/i;
const slaStates: SlaState[] = [
  "Normal",
  "Due Soon",
  "Overdue",
  "Paused",
  "Escalated",
  "Resolved",
  "Not scheduled",
];

function uniqueCases(items: readonly ComplaintQueueItem[]) {
  const byId = new Map<string, ComplaintQueueItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    const currentUpdated = Date.parse(item.updatedAt);
    const existingUpdated = Date.parse(existing.updatedAt);
    if (
      (Number.isFinite(currentUpdated) ? currentUpdated : 0) >
      (Number.isFinite(existingUpdated) ? existingUpdated : 0)
    )
      byId.set(item.id, item);
  }
  return [...byId.values()];
}

function completionHours(item: ComplaintQueueItem): number | null {
  const submitted = Date.parse(item.submittedAt);
  const resolved = Date.parse(item.resolution?.at ?? "");
  if (!Number.isFinite(submitted) || !Number.isFinite(resolved) || resolved < submitted)
    return null;
  return (resolved - submitted) / 3600000;
}

function priorityOrder(priority: ComplaintQueueItem["priority"]): number {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[priority];
}

function attentionReasons(
  item: ComplaintQueueItem,
  sla: SlaCalculation,
): string[] {
  const reasons: string[] = [];
  if (sla.escalationRecommended) reasons.push("Escalation recommended");
  if (sla.state === "Overdue") reasons.push("Overdue");
  if (sla.state === "Due Soon") reasons.push("Due soon");
  if (
    item.routingStatus === "manual-review" &&
    !item.overriddenByOfficer
  )
    reasons.push("Manual review");
  return reasons;
}

export function calculateCommandCenterMetrics(
  records: readonly ComplaintQueueItem[],
  asOf: string,
  windowDays: MonitoringWindowDays = 30,
): CommandCenterMetrics {
  const cases = uniqueCases(records).filter((item) =>
    isInMonitoringWindow(item.submittedAt, asOf, windowDays),
  );
  const calculations = new Map(
    cases.map((item) => [item.id, calculateSla(item, asOf)]),
  );
  const slaBreakdown = Object.fromEntries(
    slaStates.map((state) => [state, 0]),
  ) as Record<SlaState, number>;
  for (const calculation of calculations.values())
    slaBreakdown[calculation.state] += 1;
  const categories = new Map<string, number>();
  const priorities = new Map<string, number>();
  for (const item of cases) {
    categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
    priorities.set(item.priority, (priorities.get(item.priority) ?? 0) + 1);
  }
  const categoriesByCount = [...categories.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  const institutionNames = [...new Set(cases.map((item) => item.institution))];
  const institutions = institutionNames
    .map((institution) => {
      const institutionCases = cases.filter(
        (item) => item.institution === institution,
      );
      const counts = new Map<string, number>();
      for (const item of institutionCases)
        counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
      const topCategory =
        [...counts.entries()].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0]?.[0] ?? "None";
      const history = getInstitutionComplaintHistory(
        institutionCases as InstitutionPatternComplaint[],
        institution,
        asOf,
      );
      return {
        institution,
        active: institutionCases.filter(isOpenCase).length,
        overdue: institutionCases.filter(
          (item) => calculations.get(item.id)?.state === "Overdue",
        ).length,
        repeatedIssue:
          history.clusters.find((cluster) => cluster.complaintCount >= 2)
            ?.label ?? null,
        topCategory,
      };
    })
    .sort(
      (a, b) =>
        b.active - a.active ||
        b.overdue - a.overdue ||
        a.institution.localeCompare(b.institution),
    );
  const patterns = institutionNames.flatMap((institution) => {
    const history = getInstitutionComplaintHistory(
      cases.filter(
        (item) => item.institution === institution,
      ) as InstitutionPatternComplaint[],
      institution,
      asOf,
    );
    return history.clusters
      .filter((cluster) => cluster.complaintCount >= 2)
      .map((cluster) => ({ institution, cluster }));
  });
  const attention = cases
    .flatMap((item) => {
      const sla = calculations.get(item.id);
      if (!sla) return [];
      const reasons = attentionReasons(item, sla);
      return reasons.length ? [{ item, sla, reasons }] : [];
    })
    .sort((a, b) => {
      const rank = (entry: AttentionCase) =>
        entry.sla.escalationRecommended ? 0 : entry.sla.state === "Overdue" ? 1 : 2;
      return (
        rank(a) - rank(b) ||
        Number(b.sla.state === "Overdue") - Number(a.sla.state === "Overdue") ||
        (a.sla.remainingMs ?? Number.POSITIVE_INFINITY) -
          (b.sla.remainingMs ?? Number.POSITIVE_INFINITY) ||
        priorityOrder(a.item.priority) - priorityOrder(b.item.priority) ||
        a.item.id.localeCompare(b.item.id)
      );
    })
    .slice(0, prototypeSlaPolicy.hotlistLimit);
  const resolutionDurations = cases
    .map(completionHours)
    .filter((hours): hours is number => hours !== null);
  const recentActivity = cases
    .flatMap((item) =>
      item.events
        .filter(
          (event) =>
            meaningfulActivity.test(event.title) &&
            isInMonitoringWindow(event.at, asOf, windowDays),
        )
        .map((event) => ({
          id: `${item.id}:${event.id}`,
          complaintId: item.id,
          title: event.title,
          institution: item.institution,
          at: event.at,
        })),
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, prototypeSlaPolicy.recentActivityLimit);
  return {
    windowDays,
    active: cases.filter(isOpenCase).length,
    dueSoon: slaBreakdown["Due Soon"],
    overdue: slaBreakdown.Overdue,
    escalated: cases.filter((item) => item.status === "Escalated").length,
    resolved: cases.filter((item) =>
      ["Resolved", "Closed"].includes(item.status),
    ).length,
    manualReview: cases.filter(
      (item) =>
        item.routingStatus === "manual-review" &&
        !item.overriddenByOfficer,
    ).length,
    averageResolutionHours: resolutionDurations.length
      ? resolutionDurations.reduce((sum, hours) => sum + hours, 0) /
        resolutionDurations.length
      : null,
    categories: categoriesByCount,
    institutions,
    patterns: patterns.sort(
      (a, b) =>
        b.cluster.complaintCount - a.cluster.complaintCount ||
        a.institution.localeCompare(b.institution),
    ),
    attention,
    recentActivity,
    slaBreakdown,
    priorityBreakdown: Object.fromEntries(priorities),
  };
}

export function filterCommandCenterCases(
  records: readonly ComplaintQueueItem[],
  asOf: string,
  filters: CommandCenterFilters,
): ComplaintQueueItem[] {
  return uniqueCases(records).filter((item) => {
    const sla = calculateSla(item, asOf);
    return (
      isInMonitoringWindow(item.submittedAt, asOf, filters.windowDays) &&
      (filters.category === "all" || item.category === filters.category) &&
      (filters.institution === "all" ||
        item.institution === filters.institution) &&
      (filters.sla === "all" || sla.state === filters.sla)
    );
  });
}
