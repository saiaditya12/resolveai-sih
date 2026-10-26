import type { ComplaintPriority } from "../officer-model.ts";
import type {
  CaseEvent,
  LifecycleStatus,
  RequestedAction,
} from "../complaint-tracking.ts";

export type SlaState =
  | "Normal"
  | "Due Soon"
  | "Overdue"
  | "Paused"
  | "Escalated"
  | "Resolved"
  | "Not scheduled";

export interface SlaComplaint {
  id: string;
  submittedAt: string;
  dueAt?: string | null;
  priority: ComplaintPriority;
  status: LifecycleStatus;
  events: CaseEvent[];
  resolution?: { at: string } | null;
  request?: RequestedAction;
  routingStatus?: "pending" | "routed" | "manual-review";
  overriddenByOfficer?: boolean;
  institution: string;
  category: string;
  title: string;
  description: string;
  cellId: string;
}

export interface SlaCalculation {
  state: SlaState;
  startedAt: string | null;
  deadlineAt: string | null;
  targetHours: number;
  remainingMs: number | null;
  overdueMs: number;
  pausedMs: number;
  paused: boolean;
  escalationRecommended: boolean;
  escalationReason: string | null;
}
