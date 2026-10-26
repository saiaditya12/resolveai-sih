// A content-only view of the canonical record; no evidence, contacts or audit data.
export interface SimilarityComplaint {
  id: string;
  studentId?: string;
  institution: string;
  category: string;
  title: string;
  description: string;
  submittedAt: string;
  intelligence?: { category: string };
}
export type Relationship = "duplicate" | "strongly-related" | "related";
export type MatchingSignal =
  | "Same institution"
  | "Same category"
  | "Similar title"
  | "Similar description"
  | "Shared issue terms"
  | "Submitted within 7 days";
export interface ComplaintSimilarityMatch {
  complaintId: string;
  score: number;
  relationship: Relationship;
  matchingSignals: MatchingSignal[];
}
export const similarityPolicy = {
  duplicateThreshold: 0.9,
  strongThreshold: 0.7,
  relatedThreshold: 0.5,
  windowDays: 90,
  patternWindowDays: 30,
  duplicateWindowDays: 7,
  limit: 5,
  patternMinimum: 3,
} as const;
export const relationshipLabels: Record<Relationship, string> = {
  duplicate: "Possible Duplicate",
  "strongly-related": "Strongly Related",
  related: "Related Complaint",
};
export const DEMO_STUDENT_ID = "demo-student-1";
