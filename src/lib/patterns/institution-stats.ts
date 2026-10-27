import { normalizeInstitutionName } from "../presentation.ts";
import { institutionPatternPolicy as policy } from "./types.ts";

const DAY_MS = 86400000;
const openStatuses = new Set([
  "Submitted",
  "Initial Review",
  "Routed",
  "Assigned",
  "Officer Review",
  "Student Action Required",
  "Institution Response Requested",
  "Escalated",
]);
const resolvedStatuses = new Set(["Resolved", "Closed"]);
const priorities = ["Critical", "High", "Medium", "Low"] as const;

export interface InstitutionComplaintStatInput {
  institution: string;
  submittedAt: string;
  status: string;
  category: string;
  priority?: string;
}

export interface InstitutionComplaintStats {
  institution: string;
  asOf: string;
  total: number;
  recentCount: number;
  open: number;
  resolved: number;
  escalated: number;
  topCategory: string;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
}

export function getInstitutionComplaintStats(
  records: readonly InstitutionComplaintStatInput[],
  institution: string,
  asOf = new Date().toISOString(),
): InstitutionComplaintStats {
  const end = Date.parse(asOf);
  const normalizedInstitution = normalizeInstitutionName(institution);
  if (!normalizedInstitution || !Number.isFinite(end)) {
    return {
      institution,
      asOf,
      total: 0,
      recentCount: 0,
      open: 0,
      resolved: 0,
      escalated: 0,
      topCategory: "None",
      statusBreakdown: {},
      priorityBreakdown: Object.fromEntries(
        priorities.map((priority) => [priority, 0]),
      ),
    };
  }
  const historyStart = end - policy.historyWindowDays * DAY_MS;
  const categoryStart = end - policy.categoryWindowDays * DAY_MS;
  const matching = records.filter((record) => {
    const submittedAt = Date.parse(record.submittedAt);
    return (
      normalizeInstitutionName(record.institution) === normalizedInstitution &&
      Number.isFinite(submittedAt) &&
      submittedAt <= end &&
      submittedAt >= historyStart
    );
  });
  const recent = matching.filter(
    (record) => Date.parse(record.submittedAt) >= categoryStart,
  );
  const categories = new Map<string, number>();
  for (const record of recent)
    categories.set(record.category, (categories.get(record.category) ?? 0) + 1);
  const topCategory =
    [...categories.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? "None";
  const statusBreakdown: Record<string, number> = {};
  const priorityBreakdown: Record<string, number> = Object.fromEntries(
    priorities.map((priority) => [priority, 0]),
  );
  for (const record of matching) {
    statusBreakdown[record.status] = (statusBreakdown[record.status] ?? 0) + 1;
    if (record.priority && priorityBreakdown[record.priority] !== undefined)
      priorityBreakdown[record.priority] =
        (priorityBreakdown[record.priority] ?? 0) + 1;
  }

  return {
    institution,
    asOf,
    total: matching.length,
    recentCount: recent.length,
    open: matching.filter((record) => openStatuses.has(record.status)).length,
    resolved: matching.filter((record) => resolvedStatuses.has(record.status))
      .length,
    escalated: matching.filter((record) => record.status === "Escalated")
      .length,
    topCategory,
    statusBreakdown,
    priorityBreakdown,
  };
}

export function isInstitutionComplaintOpen(status: string): boolean {
  return openStatuses.has(status);
}
