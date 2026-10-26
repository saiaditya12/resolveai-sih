import type { SimilarityComplaint } from "../similarity/types.ts";

export interface InstitutionPatternComplaint extends SimilarityComplaint {
  status: string;
  priority: string;
  intelligence?: { category: string; subcategory?: string };
}

export type ComplaintTrend =
  | "Increasing"
  | "Stable"
  | "Decreasing"
  | "New pattern";

export interface IssueCluster {
  id: string;
  institution: string;
  category: string;
  subcategory?: string;
  label: string;
  complaintIds: string[];
  complaintCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  recentCount: number;
  trend: ComplaintTrend;
  commonIssueSignals: string[];
}

export interface InstitutionComplaintHistory {
  institution: string;
  total: number;
  recentCount: number;
  open: number;
  resolved: number;
  escalated: number;
  topCategory: string;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  clusters: IssueCluster[];
}

export const institutionPatternPolicy = {
  recentWindowDays: 7,
  categoryWindowDays: 30,
  historyWindowDays: 90,
  patternWindowDays: 30,
  minimumClusterSize: 2,
  repeatOccurrenceMinimum: 3,
  dashboardSignalLimit: 3,
} as const;
