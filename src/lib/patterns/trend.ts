import type { ComplaintTrend } from "./types.ts";

const DAY_MS = 86400000;

export function classifyTrend(
  recentCount: number,
  previousCount: number,
): ComplaintTrend {
  if (recentCount === previousCount) return "Stable";
  if (previousCount === 0 && recentCount > 0) return "New pattern";
  return recentCount > previousCount ? "Increasing" : "Decreasing";
}

export function countInTimeWindow(
  dates: readonly string[],
  asOf: string,
  windowDays: number,
): number {
  const end = Date.parse(asOf);
  if (!Number.isFinite(end) || !Number.isFinite(windowDays) || windowDays < 0)
    return 0;
  const start = end - windowDays * DAY_MS;
  return dates.filter((date) => {
    const at = Date.parse(date);
    return Number.isFinite(at) && at <= end && at >= start;
  }).length;
}

export function countPreviousWindow(
  dates: readonly string[],
  asOf: string,
  windowDays: number,
): number {
  const end = Date.parse(asOf);
  if (!Number.isFinite(end) || !Number.isFinite(windowDays) || windowDays < 0)
    return 0;
  const recentStart = end - windowDays * DAY_MS;
  const previousStart = end - windowDays * 2 * DAY_MS;
  return dates.filter((date) => {
    const at = Date.parse(date);
    return (
      Number.isFinite(at) &&
      at < recentStart &&
      at >= previousStart &&
      at <= end
    );
  }).length;
}
