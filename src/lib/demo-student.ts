export type ComplaintStatus =
  | "Submitted"
  | "Under Review"
  | "Assigned"
  | "Needs Information"
  | "Resolved"
  | "Escalated";
export interface Complaint {
  id: string;
  institution: string;
  title: string;
  category: string;
  status: ComplaintStatus;
  updatedAt: string;
}
export const demoStudent = { name: "Aarav Sharma", initials: "AS" };
export const complaints: Complaint[] = [
  {
    id: "GRV-2026-0987",
    institution: "Demo Hillcrest Institute of Design",
    title: "Course completion record withheld",
    category: "Student Records",
    status: "Escalated",
    updatedAt: "2026-10-23T15:00:00+05:30",
  },
  {
    id: "GRV-2026-1042",
    institution: "Example Institute of Technology",
    title: "Refund not received after admission cancellation",
    category: "Fees / Refund",
    status: "Under Review",
    updatedAt: "2026-10-23T08:00:00+05:30",
  },
  {
    id: "GRV-2026-1018",
    institution: "Example College of Engineering",
    title: "Original certificates not returned",
    category: "Student Records",
    status: "Needs Information",
    updatedAt: "2026-10-22T14:30:00+05:30",
  },
  {
    id: "GRV-2026-1007",
    institution: "Example Polytechnic College",
    title: "Clarification on additional examination fees",
    category: "Fees / Examination",
    status: "Assigned",
    updatedAt: "2026-10-21T10:00:00+05:30",
  },
  {
    id: "GRV-2026-1001",
    institution: "Example School of Technology",
    title: "Request for accessible laboratory facilities",
    category: "Campus Facilities",
    status: "Submitted",
    updatedAt: "2026-10-20T11:00:00+05:30",
  },
  {
    id: "GRV-2026-0994",
    institution: "Example Technical Institute",
    title: "Scholarship amount not credited",
    category: "Student Support",
    status: "Resolved",
    updatedAt: "2026-10-18T09:00:00+05:30",
  },
];
export const activity = [
  {
    id: "GRV-2026-1042",
    text: "Your complaint moved to Under Review.",
    at: "23 Oct 2026 · 08:00 IST",
  },
  {
    id: "GRV-2026-1018",
    text: "Additional information was requested.",
    at: "22 Oct 2026 · 14:30 IST",
  },
  {
    id: "GRV-2026-0994",
    text: "Your complaint was marked Resolved.",
    at: "18 Oct 2026 · 09:00 IST",
  },
];
export function formatDemoDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
