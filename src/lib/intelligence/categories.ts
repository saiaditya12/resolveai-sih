export const categories = [
  "Fees / Refund",
  "Student Records",
  "Scholarship / Financial Support",
  "Academic Issue",
  "Faculty / Staff Conduct",
  "Infrastructure / Facilities",
  "Approval / Recognition",
  "Other",
] as const;

export type ComplaintCategory = (typeof categories)[number];

export function isComplaintCategory(value: unknown): value is ComplaintCategory {
  return (
    typeof value === "string" &&
    categories.some((category) => category === value)
  );
}
