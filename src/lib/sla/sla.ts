import type { LifecycleStatus } from "../complaint-tracking.ts";
import type { SlaCalculation, SlaComplaint } from "./types.ts";
import { prototypeSlaPolicy as policy } from "./policy.ts";

const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const finishedStatuses = new Set<LifecycleStatus>(["Resolved", "Closed"]);
const activeRequestTitle =
  /(information requested from student|additional information requested)/i;
const studentResponseTitle = /student response recorded locally/i;

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function studentWaitIntervals(
  item: SlaComplaint,
  asOf: number,
): { completedMs: number; openSince: number | null } {
  if (!policy.pauseWhileWaitingForStudent)
    return { completedMs: 0, openSince: null };
  let completedMs = 0;
  let openSince: number | null = null;
  for (const event of [...item.events].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  )) {
    const at = time(event.at);
    if (at === null || at > asOf) continue;
    if (event.actor === "Demo Officer" && activeRequestTitle.test(event.title))
      openSince = at;
    else if (
      event.actor === "Student" &&
      studentResponseTitle.test(event.title) &&
      openSince !== null
    ) {
      completedMs += Math.max(0, at - openSince);
      openSince = null;
    }
  }
  if (
    item.status === "Student Action Required" &&
    openSince === null &&
    item.request
  ) {
    const requestAt = [...item.events].reverse().find((event) => {
      const eventAt = time(event.at);
      return (
        event.actor === "Demo Officer" &&
        activeRequestTitle.test(event.title) &&
        eventAt !== null &&
        eventAt <= asOf
      );
    });
    openSince = requestAt ? time(requestAt.at) : null;
  }
  return { completedMs, openSince };
}

export function calculateSla(
  item: SlaComplaint,
  asOf: string,
): SlaCalculation {
  const asOfMs = time(asOf);
  const submittedAt = time(item.submittedAt);
  const explicitDeadline = time(item.dueAt);
  const configuredTargetHours = policy.targetHours[item.priority];
  const targetHours =
    Number.isFinite(configuredTargetHours) && configuredTargetHours > 0
      ? configuredTargetHours
      : 0;
  const startedAt = submittedAt === null ? null : item.submittedAt;
  const baseDeadline =
    explicitDeadline ??
    (submittedAt === null || targetHours === 0
      ? null
      : submittedAt + targetHours * HOUR_MS);
  const notScheduled =
    baseDeadline === null || asOfMs === null || targetHours === 0;
  const finished = finishedStatuses.has(item.status);
  const escalated = item.status === "Escalated";
  const wait = asOfMs === null
    ? { completedMs: 0, openSince: null }
    : studentWaitIntervals(item, asOfMs);
  const ongoingPauseMs =
    wait.openSince !== null && asOfMs !== null
      ? Math.max(0, asOfMs - wait.openSince)
      : 0;
  const pausedMs = wait.completedMs + ongoingPauseMs;
  const deadlineMs = baseDeadline === null ? null : baseDeadline + pausedMs;
  const evaluationMs = asOfMs;
  const remainingMs =
    deadlineMs === null || evaluationMs === null
      ? null
      : deadlineMs - evaluationMs;
  const overdueMs =
    remainingMs !== null && remainingMs < 0 ? Math.abs(remainingMs) : 0;
  const escalationRecommended =
    !finished &&
    !escalated &&
    !notScheduled &&
    wait.openSince === null &&
    overdueMs >= policy.escalationGraceHours * HOUR_MS;
  let state: SlaCalculation["state"] = "Normal";
  if (notScheduled) state = "Not scheduled";
  else if (finished) state = "Resolved";
  else if (escalated) state = "Escalated";
  else if (wait.openSince !== null) state = "Paused";
  else if (remainingMs !== null && remainingMs < 0) state = "Overdue";
  else if (
    remainingMs !== null &&
    remainingMs <= targetHours * HOUR_MS * policy.dueSoonRemainingFraction
  )
    state = "Due Soon";
  return {
    state,
    startedAt,
    deadlineAt:
      deadlineMs === null ? null : new Date(deadlineMs).toISOString(),
    targetHours,
    remainingMs,
    overdueMs: finished || escalated ? 0 : overdueMs,
    pausedMs,
    paused: wait.openSince !== null,
    escalationRecommended,
    escalationReason: escalationRecommended
      ? `Overdue beyond the ${policy.escalationGraceHours}-hour prototype grace period.`
      : null,
  };
}

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return "Not scheduled";
  const hours = Math.ceil(Math.abs(durationMs) / HOUR_MS);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const value = days
    ? `${days} ${days === 1 ? "day" : "days"}${remainingHours ? ` ${remainingHours}h` : ""}`
    : `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return durationMs < 0 ? `${value} overdue` : `${value} remaining`;
}

export function isInMonitoringWindow(
  submittedAt: string,
  asOf: string,
  windowDays: number,
): boolean {
  const submitted = time(submittedAt);
  const end = time(asOf);
  return (
    submitted !== null &&
    end !== null &&
    Number.isFinite(windowDays) &&
    windowDays >= 0 &&
    submitted <= end &&
    submitted >= end - windowDays * DAY_MS
  );
}
