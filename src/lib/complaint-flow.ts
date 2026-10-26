import type { Complaint } from "./demo-student";
import type {
  CaseEvent,
  CaseResponse,
  LifecycleStatus,
  Resolution,
  RequestedAction,
} from "./complaint-tracking";
import type { ComplaintIntelligenceResult } from "./intelligence/types";
export { categories } from "./intelligence/categories.ts";
export interface Institution {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
}
export interface EvidenceFile {
  id: string;
  name: string;
  type: string;
  size: number;
  file: File;
}
export interface ComplaintDraft {
  institution: Institution | null;
  title: string;
  description: string;
  category: string;
  incidentDate: string;
  contacted: "" | "yes" | "no";
  contactDate: string;
  response: string;
  evidence: EvidenceFile[];
}
export interface LocalComplaint extends Complaint {
  submittedAt: string;
  description: string;
  incidentDate: string;
  contacted: "yes" | "no";
  contactDate: string;
  response: string;
  evidence: Omit<EvidenceFile, "file">[];
  workflowStatus?: LifecycleStatus;
  dueAt?: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  currentCellId?: string | null;
  overriddenByOfficer?: boolean;
  routingStatus?: "pending" | "routed" | "manual-review";
  intelligence?: ComplaintIntelligenceResult;
  events?: CaseEvent[];
  request?: RequestedAction;
  resolution?: Resolution;
  trackingResponse?: CaseResponse;
}
export const emptyDraft: ComplaintDraft = {
  institution: null,
  title: "",
  description: "",
  category: "",
  incidentDate: "",
  contacted: "",
  contactDate: "",
  response: "",
  evidence: [],
};
export function serializeComplaintDraft(draft: ComplaintDraft): string {
  return JSON.stringify({
    institution: draft.institution,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    incidentDate: draft.incidentDate,
    contacted: draft.contacted,
    contactDate: draft.contactDate,
    response: draft.response,
  });
}
export function restoreComplaintDraft(serialized: string): ComplaintDraft {
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Saved complaint draft is invalid.");
  const draft = value as Record<string, unknown>;
  let institution: Institution | null = null;
  if (draft.institution !== null) {
    const savedInstitution = draft.institution;
    if (
      typeof savedInstitution !== "object" ||
      !savedInstitution ||
      !("id" in savedInstitution) ||
      typeof savedInstitution.id !== "string"
    )
      throw new TypeError("Saved complaint draft is invalid.");
    const match = institutions.find(
      (item) => item.id === savedInstitution.id,
    );
    if (!match) throw new TypeError("Saved complaint draft is invalid.");
    institution = match;
  }
  if (
    typeof draft.title !== "string" ||
    typeof draft.description !== "string" ||
    typeof draft.category !== "string" ||
    typeof draft.incidentDate !== "string" ||
    (draft.contacted !== "" &&
      draft.contacted !== "yes" &&
      draft.contacted !== "no") ||
    typeof draft.contactDate !== "string" ||
    typeof draft.response !== "string"
  )
    throw new TypeError("Saved complaint draft is invalid.");
  return {
    institution: institution ?? null,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    incidentDate: draft.incidentDate,
    contacted: draft.contacted,
    contactDate: draft.contactDate,
    response: draft.response,
    evidence: [],
  };
}
export const institutions: Institution[] = [
  {
    id: "demo-01",
    name: "Example Institute of Technology",
    city: "Pune",
    state: "Maharashtra",
    type: "Engineering institute",
  },
  {
    id: "demo-02",
    name: "Example College of Engineering",
    city: "Jaipur",
    state: "Rajasthan",
    type: "Engineering college",
  },
  {
    id: "demo-03",
    name: "Example Technical Institute",
    city: "Bhopal",
    state: "Madhya Pradesh",
    type: "Technical institute",
  },
  {
    id: "demo-04",
    name: "Demo Riverbend Polytechnic",
    city: "Kochi",
    state: "Kerala",
    type: "Polytechnic",
  },
  {
    id: "demo-05",
    name: "Demo Northfield School of Technology",
    city: "Lucknow",
    state: "Uttar Pradesh",
    type: "Technical institute",
  },
  {
    id: "demo-06",
    name: "Demo Meadow College of Engineering",
    city: "Mysuru",
    state: "Karnataka",
    type: "Engineering college",
  },
  {
    id: "demo-07",
    name: "Demo Cedar Institute of Management",
    city: "Ahmedabad",
    state: "Gujarat",
    type: "Management institute",
  },
  {
    id: "demo-08",
    name: "Demo Horizon Polytechnic",
    city: "Bhubaneswar",
    state: "Odisha",
    type: "Polytechnic",
  },
  {
    id: "demo-09",
    name: "Demo Brookside Technical College",
    city: "Coimbatore",
    state: "Tamil Nadu",
    type: "Technical college",
  },
  {
    id: "demo-10",
    name: "Demo Hillcrest Institute of Design",
    city: "Dehradun",
    state: "Uttarakhand",
    type: "Design institute",
  },
];
export const MAX_FILES = 5,
  MAX_FILE_BYTES = 5 * 1024 * 1024;
export function evidenceError(
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  if (
    !extension ||
    !types[extension] ||
    (file.type && file.type !== types[extension])
  )
    return `${file.name}: choose a PDF, PNG or JPG/JPEG file.`;
  if (file.size === 0) return `${file.name}: the file is empty.`;
  if (file.size > MAX_FILE_BYTES)
    return `${file.name}: exceeds the 5 MB per-file limit.`;
  return null;
}
export function fileSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
export function todayInIndia(asOf: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);
}
export function validPastDate(value: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= today &&
    value >= "1900-01-01"
  );
}
export type DraftErrors = Partial<
  Record<
    | "institution"
    | "title"
    | "description"
    | "incidentDate"
    | "contacted"
    | "contactDate"
    | "response"
    | "declaration",
    string
  >
>;
export function validateDetails(
  draft: ComplaintDraft,
  today: string,
): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.title.trim().length < 5 || draft.title.length > 120)
    errors.title = "Enter a clear title between 5 and 120 characters.";
  if (draft.description.trim().length < 50 || draft.description.length > 3000)
    errors.description =
      "Describe the issue in 50–3,000 characters (excluding leading and trailing spaces).";
  if (draft.incidentDate && !validPastDate(draft.incidentDate, today))
    errors.incidentDate =
      "Choose a valid incident date from 1900 through today.";
  if (!draft.contacted) errors.contacted = "Choose Yes or No.";
  if (
    draft.contacted === "yes" &&
    draft.contactDate &&
    !validPastDate(draft.contactDate, today)
  )
    errors.contactDate =
      "Choose a valid contact date that is not in the future.";
  if (draft.response.length > 500)
    errors.response = "Keep the response to 500 characters or fewer.";
  return errors;
}
