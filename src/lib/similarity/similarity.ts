import { normalizeText, tokenize, overlap, issueTerms } from "./normalize.ts";
import { isLikelyDuplicate } from "./duplicate-policy.ts";
import {
  similarityPolicy as policy,
  type SimilarityComplaint,
  type ComplaintSimilarityMatch,
  type MatchingSignal,
} from "./types.ts";
export function compareComplaints(
  a: SimilarityComplaint,
  b: SimilarityComplaint,
): ComplaintSimilarityMatch | null {
  if (a.id === b.id) return null;
  if (
    tokenize(a.title + " " + a.description).length < 4 ||
    tokenize(b.title + " " + b.description).length < 4
  )
    return null;
  const title = overlap(tokenize(a.title), tokenize(b.title));
  const description = overlap(tokenize(a.description), tokenize(b.description));
  const issue = overlap(
    issueTerms(tokenize(a.title + " " + a.description)),
    issueTerms(tokenize(b.title + " " + b.description)),
  );
  const sameInstitution =
    !!a.institution.trim() &&
    normalizeText(a.institution) === normalizeText(b.institution);
  const categoryA = normalizeText(a.intelligence?.category ?? a.category),
    categoryB = normalizeText(b.intelligence?.category ?? b.category);
  const sameCategory =
    !!categoryA && categoryA !== "other" && categoryA === categoryB;
  const days =
    Math.abs(Date.parse(a.submittedAt) - Date.parse(b.submittedAt)) / 86400000;
  if (!Number.isFinite(days)) return null;
  // Context alone cannot produce a match. Content and shared issue terms must support it.
  if (
    Math.max(title, description) < 0.2 ||
    (issue < 0.25 && description < 0.45)
  )
    return null;
  let score =
    (sameInstitution ? 0.18 : 0) +
    (sameCategory ? 0.1 : 0) +
    title * 0.22 +
    description * 0.3 +
    issue * 0.18 +
    (days <= 7 ? 0.02 : 0);
  const duplicate = isLikelyDuplicate(a, b);
  if (duplicate) score = Math.max(policy.duplicateThreshold, score);
  // Shared category across unrelated institutions is not a strong case-level relationship.
  if (!sameInstitution) score = Math.min(score, policy.strongThreshold - 0.01);
  score = Math.round(Math.min(1, score) * 1000) / 1000;
  if (score < policy.relatedThreshold) return null;
  const matchingSignals: MatchingSignal[] = [];
  if (sameInstitution) matchingSignals.push("Same institution");
  if (sameCategory) matchingSignals.push("Same category");
  if (title >= 0.5) matchingSignals.push("Similar title");
  if (description >= 0.4) matchingSignals.push("Similar description");
  if (issue >= 0.5) matchingSignals.push("Shared issue terms");
  if (days <= 7) matchingSignals.push("Submitted within 7 days");
  return {
    complaintId: b.id,
    score,
    relationship: duplicate
      ? "duplicate"
      : score >= policy.strongThreshold
        ? "strongly-related"
        : "related",
    matchingSignals,
  };
}
export function findSimilarComplaints(
  target: SimilarityComplaint,
  records: readonly SimilarityComplaint[],
  options: { windowDays?: number; limit?: number; asOf?: string } = {},
): ComplaintSimilarityMatch[] {
  const windowDays = options.windowDays ?? policy.windowDays;
  const asOf = Date.parse(options.asOf ?? target.submittedAt);
  if (!Number.isFinite(asOf) || !Number.isFinite(windowDays) || windowDays < 0)
    return [];
  const unique = new Map(records.map((record) => [record.id, record]));
  return [...unique.values()]
    .filter((record) => {
      const at = Date.parse(record.submittedAt);
      return at <= asOf && at >= asOf - windowDays * 86400000;
    })
    .flatMap((record) => {
      const match = compareComplaints(target, record);
      return match ? [match] : [];
    })
    .sort(
      (a, b) => b.score - a.score || a.complaintId.localeCompare(b.complaintId),
    )
    .slice(0, Math.max(0, options.limit ?? policy.limit));
}
// Fixed relative-to-record clock makes SSR deterministic and permits newer cases to relate to older ones.
export function corpusClock(records: readonly SimilarityComplaint[]): string {
  const times = records
    .map((r) => Date.parse(r.submittedAt))
    .filter(Number.isFinite);
  return new Date(times.length ? Math.max(...times) : 0).toISOString();
}
export function repeatedIssuePattern(
  target: SimilarityComplaint,
  records: readonly SimilarityComplaint[],
  asOf = corpusClock(records),
) {
  const start = Date.parse(asOf) - policy.patternWindowDays * 86400000;
  if (
    Date.parse(target.submittedAt) < start ||
    Date.parse(target.submittedAt) > Date.parse(asOf)
  )
    return null;
  const matches = findSimilarComplaints(target, records, {
    asOf,
    windowDays: policy.patternWindowDays,
    limit: records.length,
  });
  const ids = new Set(
    matches
      .filter((m) => m.matchingSignals.includes("Same institution"))
      .map((m) => m.complaintId),
  );
  const group = [target, ...records.filter((r) => ids.has(r.id))];
  const unique = [...new Map(group.map((r) => [r.id, r])).values()];
  if (
    unique.length < policy.patternMinimum ||
    new Set(unique.map((r) => r.studentId).filter(Boolean)).size < 2
  )
    return null;
  return {
    count: unique.length,
    windowDays: policy.patternWindowDays,
    institution: target.institution,
    category: target.intelligence?.category ?? target.category,
    asOf,
  };
}
// The student projection deliberately returns a boolean, never another person's case payload.
export function studentRelatedSignal(
  target: SimilarityComplaint,
  records: readonly SimilarityComplaint[],
  studentId: string,
): boolean {
  if (target.studentId !== studentId) return false;
  return findSimilarComplaints(target, records, {
    asOf: corpusClock(records),
    limit: records.length,
  }).some(
    (m) =>
      m.matchingSignals.includes("Same institution") &&
      records.some((r) => r.id === m.complaintId && r.studentId !== studentId),
  );
}
export function ownDuplicateMatches(
  target: SimilarityComplaint,
  records: readonly SimilarityComplaint[],
  studentId: string,
) {
  if (target.studentId !== studentId) return [];
  return findSimilarComplaints(
    target,
    records.filter((r) => r.studentId === studentId),
    { windowDays: policy.duplicateWindowDays, limit: policy.limit },
  ).filter((m) => m.relationship === "duplicate");
}

export function firstRepeatedIssuePattern(records: readonly SimilarityComplaint[]) {
  const asOf = corpusClock(records);
  for (const item of records) {
    const signal = repeatedIssuePattern(item, records, asOf);
    if (signal) return { ...signal, complaintId: item.id };
  }
  return null;
}
