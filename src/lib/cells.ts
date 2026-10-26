// Prototype configuration, not official AICTE organizational mappings.
export const reviewCells = [
  { id: "student", name: "Demo Student Grievance Cell", description: "Student support and general academic concerns." },
  { id: "approval", name: "Demo Approval Review Cell", description: "Approval and recognition concerns." },
  { id: "finance", name: "Demo Finance/Refund Review Cell", description: "Fees and admission refunds." },
  { id: "records", name: "Demo Academic Records Cell", description: "Student records and transcripts." },
];
export function getReviewCell(id: string | null | undefined) {
  return reviewCells.find((cell) => cell.id === id);
}
