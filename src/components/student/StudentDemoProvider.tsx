"use client";
import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  type ReactNode,
} from "react";
import {
  complaints as seedComplaints,
  type Complaint,
} from "@/lib/demo-student";
import type { ComplaintDraft, LocalComplaint } from "@/lib/complaint-flow";
import {
  toStudentComplaint,
} from "@/lib/complaint-store";
import { DEMO_STUDENT_ID } from "@/lib/similarity/types";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
import {
  responseError,
  type TrackingSession,
  type CaseResponse,
} from "@/lib/complaint-tracking";
type DemoState = {
  mode: "persistent" | "demo";
  trackingSessions: Record<string, TrackingSession>;
  respond: (id: string, response: CaseResponse) => Promise<void>;
  giveFeedback: (id: string, feedback: "yes" | "no") => void;
  complaints: Complaint[];
  localComplaints: LocalComplaint[];
  submit: (draft: ComplaintDraft) => Promise<LocalComplaint>;
  attachIntelligence: (
    id: string,
    intelligence?: LocalComplaint["intelligence"],
  ) => Promise<LocalComplaint>;
};
const DemoContext = createContext<DemoState | null>(null);
export function StudentDemoProvider({ children }: { children: ReactNode }) {
  const store = useComplaintStore();
  const studentId = store.profile?.id ?? DEMO_STUDENT_ID;
  const localComplaints = store.records
    .filter((record) => record.studentId === studentId)
    .map(toStudentComplaint);
  const [trackingSessions, setTrackingSessions] = useState<
    Record<string, TrackingSession>
  >({});
  // Activity cleanup also clears records when navigating outside the student layout.
  useLayoutEffect(
    () => () => {
      setTrackingSessions({});
    },
    [],
  );
  async function submit(draft: ComplaintDraft): Promise<LocalComplaint> {
    return toStudentComplaint(await store.createComplaint(draft));
  }
  async function attachIntelligence(
    id: string,
    intelligence?: LocalComplaint["intelligence"],
  ): Promise<LocalComplaint> {
    return toStudentComplaint(await store.attachIntelligence(id, intelligence));
  }
  async function respond(id: string, response: CaseResponse): Promise<void> {
    if (responseError(response.text, response.evidence.length)) return;
    const sharedRecord = store.records.find(
      (record) => record.id === id && record.studentId === studentId,
    );
    if (sharedRecord) {
      if (sharedRecord.trackingResponse) return;
      await store.recordStudentResponse(id, response);
      return;
    }
    if (store.mode === "persistent") return;
    setTrackingSessions((previous) =>
      previous[id]?.response
        ? previous
        : { ...previous, [id]: { ...previous[id], response } },
    );
  }
  function giveFeedback(id: string, feedback: "yes" | "no") {
    setTrackingSessions((previous) => ({
      ...previous,
      [id]: { ...previous[id], feedback },
    }));
  }
  return (
    <DemoContext.Provider
      value={{
        mode: store.mode,
        complaints: [
          ...localComplaints,
          ...(store.mode === "demo" ? seedComplaints : []),
        ].map((c) =>
          trackingSessions[c.id]?.response
            ? {
                ...c,
                status: "Under Review" as const,
                updatedAt: trackingSessions[c.id].response!.at,
              }
            : c,
        ),
        trackingSessions,
        respond,
        giveFeedback,
        localComplaints,
        submit,
        attachIntelligence,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useStudentDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("StudentDemoProvider is required");
  return value;
}
