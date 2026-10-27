"use client";
import { cellDisplayName } from "@/lib/presentation";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { canReadComplaint, canActOnComplaint, type AppProfile } from "@/lib/authorization";
import { getReviewCell } from "@/lib/cells";
import { officerSeedCases } from "@/lib/officer-demo";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
import {
  applyOfficerAction,
  type ComplaintQueueItem,
  type OfficerAction,
} from "@/lib/officer-model";
interface OfficerState {
  cases: ComplaintQueueItem[];
  basePath: "/admin" | "/officer";
  profile: AppProfile;
  cellName: string;
  act: (id: string, action: OfficerAction) => Promise<void>;
}
const Context = createContext<OfficerState | null>(null);
export function OfficerDemoProvider({ children, trustedProfile, workspace = "officer" }: { children: ReactNode; trustedProfile?: AppProfile | null; workspace?: "officer" | "admin" }) {
  const store = useComplaintStore();
  const profile: AppProfile = store.mode === "persistent"
    ? (store.profile ?? trustedProfile ?? { id: "", display_name: "", role: "officer", cell_id: null })
    : { id: "demo-officer-1", display_name: "", role: workspace, cell_id: workspace === "admin" ? null : "student" };
  const basePath = workspace === "admin" ? "/admin" : "/officer";
  const cellName = cellDisplayName(getReviewCell(profile.cell_id)?.name ?? "No review cell assigned");
  const [cases, setCases] = useState(
    store.mode === "demo" ? officerSeedCases : [],
  );
  const visibleCases = (store.mode === "persistent" ? store.records : [...store.records, ...cases])
    .filter((record) => canReadComplaint(profile, record));
  async function act(id: string, action: OfficerAction) {
    const item = visibleCases.find((record) => record.id === id);
    if (!item || !canActOnComplaint(profile, item)) throw new Error("You no longer own this case. Reload your workspace.");
    if (store.mode === "persistent") {
      await store.applyOfficerAction(id, action);
      return;
    }
    if (store.records.some((record) => record.id === id)) {
      await store.applyOfficerAction(id, action);
      return;
    }
    const at = new Date().toISOString();
    const eventId = crypto.randomUUID();
    setCases((previous) =>
      previous.map((item) =>
        item.id === id ? applyOfficerAction(item, action, at, eventId) : item,
      ),
    );
  }
  return (
    <Context.Provider
      value={{
        cases: visibleCases,
        basePath,
        profile,
        cellName,
        act,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useOfficerDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("OfficerDemoProvider required");
  return value;
}
