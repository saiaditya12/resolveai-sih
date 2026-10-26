import { normalizeText, overlap, tokenize } from "./normalize.ts";
import { similarityPolicy, type SimilarityComplaint } from "./types.ts";
export function isLikelyDuplicate(
  a: SimilarityComplaint,
  b: SimilarityComplaint,
): boolean {
  if (
    !a.institution.trim() ||
    !a.studentId ||
    a.studentId !== b.studentId ||
    normalizeText(a.institution) !== normalizeText(b.institution)
  )
    return false;
  const days =
    Math.abs(Date.parse(a.submittedAt) - Date.parse(b.submittedAt)) / 86400000;
  if (!Number.isFinite(days) || days > similarityPolicy.duplicateWindowDays)
    return false;
  const ad = tokenize(a.description),
    bd = tokenize(b.description);
  // Generic one-line complaints are insufficient evidence, even when identical.
  if (
    ad.length < 8 ||
    bd.length < 8 ||
    tokenize(a.title + " " + a.description).length < 10 ||
    tokenize(b.title + " " + b.description).length < 10
  )
    return false;
  // Preserve numbers and negation for duplicate decisions; related scoring is more tolerant.
  const rawA = normalizeText(a.description).split(" "),
    rawB = normalizeText(b.description).split(" ");
  const negative = (text: string) =>
    /\b(not|never|no|without|unable|cannot|can t|hasn t|haven t|didn t)\b/.test(
      normalizeText(text),
    );
  if (negative(a.description) !== negative(b.description)) return false;
  const numbers = (s: string) =>
    normalizeText(s)
      .match(/\b\d+\b/g)
      ?.sort()
      .join(",") ?? "";
  if (
    numbers(a.title + " " + a.description) !==
    numbers(b.title + " " + b.description)
  )
    return false;
  return (
    overlap(tokenize(a.title), tokenize(b.title)) >= 0.85 &&
    overlap(ad, bd) >= 0.9 &&
    overlap([...new Set(rawA)], [...new Set(rawB)]) >= 0.88
  );
}
