import type { ComplaintPriority } from "../officer-model.ts";

export const prototypeSlaPolicy = {
  label: "Prototype / demo policy",
  targetHours: {
    Critical: 24,
    High: 48,
    Medium: 120,
    Low: 168,
  } satisfies Record<ComplaintPriority, number>,
  dueSoonRemainingFraction: 0.25,
  escalationGraceHours: 24,
  pauseWhileWaitingForStudent: true,
  windowsDays: [7, 30, 90] as const,
  hotlistLimit: 8,
  recentActivityLimit: 10,
} as const;

export type MonitoringWindowDays =
  (typeof prototypeSlaPolicy.windowsDays)[number];
