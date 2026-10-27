"use client";
import Link from "next/link";
import { useState, useLayoutEffect, useEffect, useRef } from "react";
import { useStudentDemo } from "@/components/student/StudentDemoProvider";
import { getTracking } from "@/lib/complaint-tracking";
import {
  ComplaintHeader,
  ComplaintUnderstanding,
  ComplaintTimeline,
  NextActionCard,
  CurrentOwnerCard,
  SlaStatus,
  CaseEvents,
  EvidenceHistory,
  OriginalComplaint,
  ResolvedState,
} from "@/components/tracking/TrackingSections";
import { StudentSimilarityNotice } from "./SimilarityNotice";
import { StudentActionPanel } from "@/components/tracking/StudentActionPanel";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
import { toStudentComplaint } from "@/lib/complaint-store";
export function ComplaintDetail({ id }: { id: string }) {
  const { mode, records, profile, initialLoading } = useComplaintStore();
  const {
    complaints,
    localComplaints,
    trackingSessions,
    respond,
    giveFeedback,
  } = useStudentDemo();
  const [open, setOpen] = useState(false);
  const focusAfterSave = useRef(false);
  const savedResponse = trackingSessions[id]?.response;
  const nextHeading = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => () => setOpen(false), []);
  useEffect(() => {
    if (savedResponse && focusAfterSave.current) {
      nextHeading.current?.focus();
      focusAfterSave.current = false;
    }
  }, [savedResponse]);
  const ownedRecord =
    mode === "persistent" && profile?.role === "student"
      ? records.find(
          (record) => record.id === id && record.studentId === profile.id,
        )
      : undefined;
  const persistentComplaint = ownedRecord
    ? toStudentComplaint(ownedRecord)
    : undefined;
  const complaint =
    mode === "persistent"
      ? persistentComplaint
      : complaints.find((item) => item.id === id);
  const local =
    mode === "persistent"
      ? persistentComplaint
      : localComplaints.find((item) => item.id === id);
  if (!complaint && initialLoading)
    return (
      <section className="student-placeholder" aria-busy="true">
        <p className="eyebrow">YOUR COMPLAINT</p>
        <h1>Loading your complaint…</h1>
        <p role="status">Checking your account’s complaint records.</p>
      </section>
    );
  if (!complaint)
    return (
      <section className="student-placeholder">
        <p className="eyebrow">
          {mode === "persistent"
            ? "CASE NOT FOUND"
            : "CASE NOT AVAILABLE IN THIS SESSION"}
        </p>
        <h1>
          {mode === "persistent"
            ? "This complaint isn’t available in your account."
            : "This complaint could not be found."}
        </h1>
        <p>
          {mode === "persistent"
            ? "Check the complaint ID or return to your account dashboard. Only complaints submitted by your account are available here."
            : "The ID may be unknown, or the in-memory record was cleared by refreshing or closing the browser session."}
        </p>
        <Link className="button primary" href="/student/dashboard">
          Back to my complaints ↗
        </Link>
      </section>
    );
  const session = trackingSessions[id];
  const data = getTracking(complaint, local, session);
  return (
    <article className="tracking-page">
      <nav className="tracking-nav" aria-label="Complaint navigation">
        <Link className="text-link" href="/student/dashboard#complaints">
          ← Back to my complaints
        </Link>
        <Link className="text-link" href="/student/complaints/new">
          Raise another complaint ↗
        </Link>
      </nav>
      <ComplaintHeader complaint={complaint} data={data} />
      <ComplaintUnderstanding data={data} />
      <p className="tracking-disclaimer">
        {mode === "persistent"
          ? "This complaint and its history are stored in your account. Complaint text is analyzed server-side; evidence file contents are not uploaded."
          : local
          ? "The complaint record and officer actions remain in browser memory. Complaint text is sent to server-side analysis; evidence files are not uploaded."
          : "Review the complaint history, current responsibility and recorded outcome."}{" "}
        Nothing is sent to AICTE.{" "}
        {mode === "persistent"
          ? "Your complaint remains available after sign out or refresh."
          : local
            ? "Records clear on refresh or when the browser session ends."
            : "Responses and feedback clear on refresh or when leaving the student workspace."}
      </p>
      <StudentSimilarityNotice id={id} />
      <ComplaintTimeline data={data} />
      <div className="tracking-columns">
        <div className="tracking-main">
          <div ref={nextHeading} tabIndex={-1}>
            <NextActionCard data={data} onRespond={() => setOpen(true)} />
          </div>
          <ResolvedState
            data={data}
            feedback={session?.feedback}
            onFeedback={(value) => giveFeedback(id, value)}
          />
          <CaseEvents data={data} />
          <EvidenceHistory data={data} />
          <OriginalComplaint complaint={complaint} data={data} />
        </div>
        <aside
          className="tracking-aside"
          aria-label="Ownership and response timing"
        >
          <CurrentOwnerCard data={data} />
          <SlaStatus data={data} />
          <p className="tracking-caption">
            {mode === "persistent"
              ? "Follow your complaint from submission to a recorded outcome."
              : "Follow your complaint from submission to a recorded outcome."}
          </p>
        </aside>
      </div>
      {open && data.request && (
        <StudentActionPanel
          mode={mode}
          request={data.request}
          onClose={() => setOpen(false)}
          onSave={async (response) => {
            focusAfterSave.current = true;
            await respond(id, response);
          }}
        />
      )}
    </article>
  );
}
