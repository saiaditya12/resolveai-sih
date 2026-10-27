import { compareComplaints, corpusClock } from "../similarity/similarity.ts";
import { normalizeText } from "../similarity/normalize.ts";
import { normalizeInstitutionName } from "../presentation.ts";
import {
  getInstitutionComplaintStats,
  isInstitutionComplaintOpen,
} from "./institution-stats.ts";
import type {
  InstitutionComplaintHistory,
  InstitutionPatternComplaint,
  IssueCluster,
} from "./types.ts";
import { institutionPatternPolicy as policy } from "./types.ts";
import {
  classifyTrend,
  countInTimeWindow,
  countPreviousWindow,
} from "./trend.ts";

const DAY_MS = 86400000;
const issueSignalRules: Array<{
  label: string;
  pattern: RegExp;
}> = [
  { label: "admission cancellation", pattern: /\b(admission|cancel|cancellation|withdrawal)\b/ },
  { label: "refund", pattern: /\b(refund|refunded|repayment)\b/ },
  { label: "processing delay", pattern: /\b(delay|delayed|pending|processing|overdue)\b/ },
  { label: "security deposit", pattern: /\b(security|deposit)\b/ },
  { label: "transcript access", pattern: /\b(transcript|download|access)\b/ },
  { label: "certificate return", pattern: /\b(certificate|return|withheld)\b/ },
  { label: "scholarship payment", pattern: /\b(scholarship|payment|credited)\b/ },
  { label: "laboratory accessibility", pattern: /\b(laboratory|lab|accessibility|accessible|ramp)\b/ },
  { label: "examination charges", pattern: /\b(exam|examination|charge|fee)\b/ },
];

function uniqueRecords(
  records: readonly InstitutionPatternComplaint[],
): InstitutionPatternComplaint[] {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function detectedCategory(record: InstitutionPatternComplaint): string {
  return record.intelligence?.category ?? record.category;
}

function detectedSubcategory(record: InstitutionPatternComplaint): string {
  return record.intelligence?.subcategory?.trim() ?? "";
}

function clusterLabel(
  category: string,
  records: readonly InstitutionPatternComplaint[],
): string {
  const text = records
    .map((record) => `${record.title} ${record.description}`)
    .join(" ")
    .toLowerCase();
  if (/\b(admission|cancellation|cancelled|canceled|withdrawal)\b/.test(text) && /\b(refund|refunded|repayment)\b/.test(text))
    return "Admission refund delays";
  if (/\b(security|deposit)\b/.test(text) && /\b(refund|return|pending)\b/.test(text))
    return "Security deposit refund concerns";
  if (/\b(transcript)\b/.test(text) && /\b(access|download|portal|issue)\b/.test(text))
    return "Transcript access problems";
  if (/\b(scholarship)\b/.test(text) && /\b(payment|credited|delay|pending)\b/.test(text))
    return "Scholarship payment delays";
  if (/\b(laboratory|lab)\b/.test(text) && /\b(accessibility|accessible|access|ramp)\b/.test(text))
    return "Laboratory accessibility concerns";
  if (/\b(certificate)\b/.test(text) && /\b(return|withheld|delay|pending)\b/.test(text))
    return "Certificate return concerns";
  return `${category} concerns`;
}

function commonIssueSignals(
  records: readonly InstitutionPatternComplaint[],
): string[] {
  const normalized = records.map((record) =>
    normalizeText(`${record.title} ${record.description}`),
  );
  return issueSignalRules
    .map((rule) => ({
      label: rule.label,
      count: normalized.filter((text) => rule.pattern.test(text)).length,
    }))
    .filter(({ count }) => count >= Math.ceil(records.length / 2))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ label }) => label);
}

function countBreakdown(
  records: readonly InstitutionPatternComplaint[],
  key: "status" | "priority",
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const record of records) {
    const label = record[key] || "Unknown";
    result[label] = (result[label] ?? 0) + 1;
  }
  return result;
}

function withinWindow(date: string, asOf: string, windowDays: number): boolean {
  const at = Date.parse(date);
  const end = Date.parse(asOf);
  return (
    Number.isFinite(at) &&
    Number.isFinite(end) &&
    at <= end &&
    at >= end - windowDays * DAY_MS
  );
}

function createCluster(
  records: readonly InstitutionPatternComplaint[],
  asOf: string,
): IssueCluster {
  const ordered = [...records].sort(
    (a, b) =>
      Date.parse(a.submittedAt) - Date.parse(b.submittedAt) ||
      a.id.localeCompare(b.id),
  );
  const dates = ordered.map((record) => record.submittedAt);
  const recentCount = countInTimeWindow(dates, asOf, policy.patternWindowDays);
  const previousCount = countPreviousWindow(
    dates,
    asOf,
    policy.recentWindowDays,
  );
  const category = detectedCategory(ordered[0]);
  const subcategory = detectedSubcategory(ordered[0]) || undefined;
  return {
    id: `${normalizeText(ordered[0].institution).replace(/\s+/g, "-")}:${normalizeText(category).replace(/\s+/g, "-")}:${normalizeText(subcategory ?? "general").replace(/\s+/g, "-")}:${ordered.map((item) => item.id).sort().join("-")}`,
    institution: ordered[0].institution,
    category,
    subcategory,
    label: clusterLabel(category, ordered),
    complaintIds: ordered.map((record) => record.id),
    complaintCount: ordered.length,
    firstSeenAt: ordered[0].submittedAt,
    lastSeenAt: ordered[ordered.length - 1].submittedAt,
    statusBreakdown: countBreakdown(ordered, "status"),
    priorityBreakdown: countBreakdown(ordered, "priority"),
    recentCount,
    trend: classifyTrend(
      countInTimeWindow(dates, asOf, policy.recentWindowDays),
      previousCount,
    ),
    commonIssueSignals: commonIssueSignals(ordered),
  };
}

function buildClusters(
  records: readonly InstitutionPatternComplaint[],
  asOf: string,
): IssueCluster[] {
  const validRecords = records.filter(
    (record) =>
      Number.isFinite(Date.parse(record.submittedAt)) &&
      withinWindow(record.submittedAt, asOf, policy.historyWindowDays),
  );
  const partitions = new Map<string, InstitutionPatternComplaint[]>();
  for (const record of validRecords) {
    const category = detectedCategory(record);
    const subcategory = detectedSubcategory(record);
    const key = `${normalizeText(category)}|${normalizeText(subcategory)}`;
    partitions.set(key, [...(partitions.get(key) ?? []), record]);
  }
  const clusters: IssueCluster[] = [];
  for (const partition of partitions.values()) {
    const remaining = new Map(partition.map((record) => [record.id, record]));
    while (remaining.size) {
      const seed = remaining.values().next().value as
        | InstitutionPatternComplaint
        | undefined;
      if (!seed) break;
      remaining.delete(seed.id);
      const group = [seed];
      const queue = [seed];
      while (queue.length) {
        const current = queue.shift();
        if (!current) continue;
        for (const [id, candidate] of remaining) {
          if (
            compareComplaints(current, candidate) &&
            normalizeInstitutionName(current.institution) ===
              normalizeInstitutionName(candidate.institution)
          ) {
            group.push(candidate);
            queue.push(candidate);
            remaining.delete(id);
          }
        }
      }
      if (group.length >= policy.minimumClusterSize)
        clusters.push(createCluster(group, asOf));
    }
  }
  return clusters.sort(
    (a, b) =>
      b.complaintCount - a.complaintCount ||
      a.institution.localeCompare(b.institution) ||
      a.label.localeCompare(b.label),
  );
}

export function getInstitutionComplaintHistory(
  records: readonly InstitutionPatternComplaint[],
  institution: string,
  asOf = corpusClock(records),
): InstitutionComplaintHistory {
  const unique = uniqueRecords(records).filter(
    (record) =>
      normalizeInstitutionName(record.institution) ===
      normalizeInstitutionName(institution),
  );
  const stats = getInstitutionComplaintStats(
    unique.map((record) => ({
      institution: record.institution,
      submittedAt: record.submittedAt,
      status: record.status,
      category: record.category,
      priority: record.priority,
    })),
    institution,
    asOf,
  );
  const date = Date.parse(asOf);
  const historyRecords = unique.filter((record) =>
    withinWindow(record.submittedAt, asOf, policy.historyWindowDays),
  );
  return {
    institution,
    total: stats.total,
    recentCount: stats.recentCount,
    open: stats.open,
    resolved: stats.resolved,
    escalated: stats.escalated,
    topCategory: stats.topCategory,
    statusBreakdown: stats.statusBreakdown,
    priorityBreakdown: stats.priorityBreakdown,
    clusters: Number.isFinite(date)
      ? buildClusters(historyRecords, asOf)
      : [],
  };
}

export function getCurrentCaseCluster(
  records: readonly InstitutionPatternComplaint[],
  complaintId: string,
  asOf = corpusClock(records),
): IssueCluster | undefined {
  const target = records.find((record) => record.id === complaintId);
  if (!target) return undefined;
  return getInstitutionComplaintHistory(records, target.institution, asOf)
    .clusters.find((cluster) => cluster.complaintIds.includes(complaintId));
}

export function getInstitutionSignals(
  records: readonly InstitutionPatternComplaint[],
  asOf = corpusClock(records),
): Array<{
  institution: string;
  cluster: IssueCluster;
  openCount: number;
}> {
  const institutions = [
    ...new Map(
      uniqueRecords(records).map((record) => [
        normalizeInstitutionName(record.institution),
        record.institution,
      ]),
    ).values(),
  ];
  return institutions
    .flatMap((institution) => {
      const history = getInstitutionComplaintHistory(records, institution, asOf);
      return history.clusters
        .filter((cluster) => cluster.recentCount > 0)
        .map((cluster) => ({
          institution,
          cluster,
          openCount: cluster.complaintIds.filter((id) => {
            const record = records.find((candidate) => candidate.id === id);
            return record && isInstitutionComplaintOpen(record.status);
          }).length,
        }));
    })
    .sort(
      (a, b) =>
        b.cluster.complaintCount - a.cluster.complaintCount ||
        a.institution.localeCompare(b.institution),
    )
    .slice(0, policy.dashboardSignalLimit);
}
