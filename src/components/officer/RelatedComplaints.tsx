"use client";
import Link from "next/link";
import { useOfficerDemo } from "./OfficerDemoProvider";
import { useMemo } from "react";
import type { ComplaintQueueItem } from "@/lib/officer-model";
import { formatDemoDate } from "@/lib/demo-student";
import {
  corpusClock,
  findSimilarComplaints,
  repeatedIssuePattern,
} from "@/lib/similarity/similarity";
import { relationshipLabels, similarityPolicy } from "@/lib/similarity/types";
import { OfficerStatus } from "./OfficerBadges";
export function RelatedComplaints({
  item,
  cases,
}: {
  item: ComplaintQueueItem;
  cases: ComplaintQueueItem[];
}) {
  const { basePath } = useOfficerDemo();
  const { matches, pattern, asOf } = useMemo(() => {
    const asOf = corpusClock(cases);
    return {
      matches: findSimilarComplaints(item, cases, { asOf }),
      pattern: repeatedIssuePattern(item, cases, asOf),
      asOf,
    };
  }, [item, cases]);
  return (
    <section className="officer-panel" aria-label="Related Complaints">
      <p className="eyebrow">LOCAL CASE CONTEXT</p>
      <h2>Related Complaints</h2>
      <p className="officer-fine">
        Content-based suggestions from this demo dataset. No AI matching,
        automatic merging or routing. Up to {similarityPolicy.limit} matches
        from the {similarityPolicy.windowDays} days ending{" "}
        {formatDemoDate(asOf)}.
      </p>
      {pattern && (
        <div className="officer-notice">
          <h3>Repeated Issue Pattern</h3>
          <p>
            {pattern.count} complaints with related issues at{" "}
            {pattern.institution}.
          </p>
          <p>
            {pattern.category} · Within {pattern.windowDays} days ending{" "}
            {formatDemoDate(pattern.asOf)}.
          </p>
          <p className="officer-fine">
            A signal for review, not a finding about the institution.
          </p>
        </div>
      )}
      {matches.length ? (
        <ul className="officer-related">
          {matches.map((match) => {
            const record = cases.find((c) => c.id === match.complaintId)!;
            return (
              <li key={record.id}>
                <Link href={`${basePath}/complaints/${record.id}`}>
                  <span>
                    {record.id} · {relationshipLabels[match.relationship]}
                  </span>
                  <strong>{record.title} ↗</strong>
                  <p>{record.institution}</p>
                  <p>
                    {record.category} · {Math.round(match.score * 100)}% match
                  </p>
                  <OfficerStatus status={record.status} />
                  <p>Submitted {formatDemoDate(record.submittedAt)}</p>
                  <p className="officer-fine">
                    Matched on: {match.matchingSignals.join(", ").toLowerCase()}
                    . This score is a text comparison, not a probability.
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No related complaints meet the current matching threshold.</p>
      )}
    </section>
  );
}
