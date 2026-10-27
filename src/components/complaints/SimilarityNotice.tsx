"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
import { officerSeedCases } from "@/lib/officer-demo";
import { DEMO_STUDENT_ID } from "@/lib/similarity/types";
import {
  ownDuplicateMatches,
  studentRelatedSignal,
} from "@/lib/similarity/similarity";
import type { ComplaintDraft } from "@/lib/complaint-flow";
import { formatDemoDate } from "@/lib/demo-student";
import { statusLabel } from "@/lib/officer-model";
export function DuplicateNotice({
  draft,
  at,
}: {
  draft: ComplaintDraft;
  at: string;
}) {
  const { records } = useComplaintStore();
  const corpus = useMemo(() => [...records, ...officerSeedCases], [records]);
  const matches = useMemo(
    () =>
      ownDuplicateMatches(
        {
          id: "draft",
          studentId: DEMO_STUDENT_ID,
          institution: draft.institution?.name ?? "",
          title: draft.title,
          description: draft.description,
          category: draft.category,
          submittedAt: at,
        },
        corpus,
        DEMO_STUDENT_ID,
      ),
    [draft, at, corpus],
  );
  if (!matches.length) return null;
  return (
    <section
      className="flow-duplicate"
      aria-label="Possible Duplicate"
      aria-live="polite"
    >
      <h3>Possible duplicate complaint detected.</h3>
      <p>
        This looks similar to a complaint from your account. You can view
        it or continue with this complaint. Nothing will be merged or deleted.
      </p>
      <ul>
        {matches.map((match) => {
          const own = corpus.find(
            (r) =>
              r.id === match.complaintId && r.studentId === DEMO_STUDENT_ID,
          )!;
          return (
            <li key={own.id}>
              <strong>{own.id}</strong>
              <p>
                Submitted {formatDemoDate(own.submittedAt)} ·{" "}
                {statusLabel(own.status)}
              </p>
              <Link
                className="text-link"
                href={`/student/complaints/${own.id}`}
              >
                View existing complaint ↗
              </Link>
            </li>
          );
        })}
      </ul>
      <p>Confirm the declaration below before continuing.</p>
      <button className="button secondary" type="submit">
        Continue with this complaint ↗
      </button>
    </section>
  );
}
export function StudentSimilarityNotice({ id }: { id: string }) {
  const { records } = useComplaintStore();
  const hasRelated = useMemo(() => {
    const corpus = [...records, ...officerSeedCases];
    const own = corpus.find(
      (r) => r.id === id && r.studentId === DEMO_STUDENT_ID,
    );
    return own ? studentRelatedSignal(own, corpus, DEMO_STUDENT_ID) : false;
  }, [id, records]);
  if (!hasRelated) return null;
  return (
    <section className="tracking-disclaimer" aria-label="Related issue notice">
      <h2>Related issues reported</h2>
      <p>
        Other complaints with a similar issue have also been reported for this
        institution. Other students’ details remain private. This does not
        change your complaint’s routing or outcome.
      </p>
    </section>
  );
}
