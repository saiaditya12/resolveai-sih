import { getReviewCell } from "./cells.ts";

export type AppRole = "student" | "officer" | "admin";
export interface AppProfile {
  id: string;
  display_name: string;
  role: AppRole;
  cell_id: string | null;
}
export function workspaceHome(role: AppRole) {
  return `/${role}/dashboard`;
}
export function canEnterWorkspace(profile: AppProfile, role: AppRole) {
  return profile.role === role;
}
export function canReadComplaint(
  profile: AppProfile,
  record: { studentId?: string; cellId: string },
) {
  if (profile.role === "admin") return true;
  if (profile.role === "student") return record.studentId === profile.id;
  return profile.role === "officer" && !!getReviewCell(profile.cell_id) && record.cellId === profile.cell_id;
}
export function canActOnComplaint(
  profile: AppProfile,
  record: { studentId?: string; cellId: string; status: string },
) {
  return profile.role !== "student" && canReadComplaint(profile, record) && !["Resolved", "Closed"].includes(record.status);
}
export function actionAudit(profile: AppProfile, fromCell: string, toCell: string, action: string, reason = "") {
  return { action, actor_id: profile.id, actor_name: profile.display_name, actor_role: profile.role, actor_cell: profile.cell_id, from_cell: fromCell, to_cell: toCell, reason };
}
