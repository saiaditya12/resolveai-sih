const filler = new Set(
  "a an the i me my we our you your they their this that these those is are was were be been being have has had do does did to of for from in on at by with and or but as it its please kindly college institution student demo fictional sample complaint issue problem about after before still already several very also would could should can will not no".split(
    " ",
  ),
);
const words: Record<string, string> = {
  refunds: "refund",
  refunded: "refund",
  refunding: "refund",
  repayment: "refund",
  cancelled: "cancel",
  cancelling: "cancel",
  canceling: "cancel",
  canceled: "cancel",
  cancellation: "cancel",
  withdrawal: "cancel",
  withdrew: "cancel",
  admissions: "admission",
  fees: "fee",
  payment: "fee",
  paid: "fee",
  delayed: "delay",
  delays: "delay",
  pending: "delay",
  waiting: "delay",
  overdue: "delay",
  received: "receive",
  receiving: "receive",
  arrived: "receive",
  credited: "receive",
  certificates: "certificate",
  transcripts: "transcript",
  records: "record",
  returned: "return",
  returning: "return",
  withheld: "withhold",
  weeks: "week",
  days: "day",
};
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function tokenize(text: string): string[] {
  return [
    ...new Set(
      normalizeText(text)
        .split(" ")
        .filter((w) => w.length > 1 && !filler.has(w))
        .map((w) => words[w] ?? w),
    ),
  ];
}
export function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const set = new Set(b);
  return (2 * a.filter((w) => set.has(w)).length) / (a.length + b.length);
}
export function issueTerms(tokens: string[]): string[] {
  const issues = new Set([
    "refund",
    "cancel",
    "admission",
    "fee",
    "delay",
    "certificate",
    "transcript",
    "scholarship",
    "laboratory",
    "accessibility",
    "harassment",
    "approval",
    "exam",
    "hostel",
    "deposit",
    "download",
  ]);
  return tokens.filter((word) => issues.has(word));
}
