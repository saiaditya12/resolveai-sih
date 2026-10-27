"use client";
import Link from "next/link";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useOfficerDemo } from "./OfficerDemoProvider";
import { isOpenCase, type ActionKind } from "@/lib/officer-model";
import { formatEventTime } from "@/lib/complaint-tracking";
import {
  OfficerCaseHeader,
  CaseSummaryPanel,
  EvidencePanel,
  StudentResponsesPanel,
  OriginalOfficerComplaint,
  OfficerCaseTimeline,
  InstitutionHistoryPanel,
  OwnerSlaPanel,
  SuggestedNextAction,
} from "./OfficerCaseSections";
import { RelatedComplaints } from "./RelatedComplaints";
import { OfficerActionPanel } from "./OfficerActionPanel";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
import { institutionResponseDisplayText } from "@/lib/presentation";
export function OfficerCase({ id }: { id: string }) {
  const { cases, act, basePath, cellName } = useOfficerDemo();
  const { mode } = useComplaintStore();
  const item = cases.find((c) => c.id === id);
  const [panel, setPanel] = useState<ActionKind | null>(null);
  const [message, setMessage] = useState("");
  const confirmation = useRef<HTMLParagraphElement>(null);
  const saved = useRef(false);
  useLayoutEffect(
    () => () => {
      setPanel(null);
      setMessage("");
    },
    [],
  );
  useEffect(() => {
    if (saved.current) {
      confirmation.current?.focus();
      saved.current = false;
    }
  }, [item?.events.length]);
  if (!item)
    return (
      <section className="officer-panel officer-empty">
        <p className="eyebrow">{mode === "persistent" ? "CASE NOT FOUND" : "CASE NOT FOUND"}</p>
        <h1>This case is not available in your workspace.</h1>
        <p>
          {mode === "persistent"
            ? "The case may have transferred to another cell. Reload your queue to check current ownership."
            : "This case may have been cleared when the browser session ended or was refreshed. Student submissions are shared only in this browser session."}
        </p>
        <Link className="button primary" href={`${basePath}/queue`}>
          Back to complaint queue ↗
        </Link>
      </section>
    );
  return (
    <article>
      <nav className="officer-case-nav" aria-label="Case navigation">
        <Link className="text-link" href={`${basePath}/queue`}>
          ← Back to complaint queue
        </Link>
        <Link className="text-link" href={`${basePath}/dashboard`}>
          Dashboard ↗
        </Link>
      </nav>
      <OfficerCaseHeader item={item} /><p className="officer-notice">{basePath === "/admin" ? "Admin oversight / all configured cells" : `Officer Workspace: ${cellName}`}</p>
      <p className="officer-notice">
        {mode === "persistent"
          ? "This complaint and its audit history are persisted. No institution or authority is contacted."
          : item.intelligence
            ? "This complaint and its officer actions are shared with the student tracking view in browser memory only. No institution or authority is contacted."
            : "Review the case context and evidence before taking action. No external notifications are sent."}
      </p>
      <p
        ref={confirmation}
        tabIndex={-1}
        role="status"
        className={message ? "officer-confirmation" : "sr-only"}
      >
        {message}
      </p>
      <div className="officer-case-grid">
        <section className="officer-panel officer-case-actions">
          <p className="eyebrow">
            {mode === "persistent"
              ? "CASE CONTROLS / AUTHORIZED OFFICER"
              : "CASE CONTROLS"}
          </p>
          <h2>Move the case forward.</h2>
          <div>
            {(
              [
                ["request", "Request Information"],
                ["status", "Update Status"],
                ["transfer", "Transfer Case"],
                ["escalate", "Escalate"],
                ["resolve", "Resolve"],
              ] as [ActionKind, string][]
            ).map(([kind, label]) => (
              <button
                key={kind}
                className={
                  kind === "resolve" ? "button primary" : "button secondary"
                }
                disabled={
                  !isOpenCase(item) ||
                  (kind === "escalate" && item.status === "Escalated")
                }
                onClick={() => setPanel(kind)}
              >
                {label}
              </button>
            ))}
          </div>
          {!isOpenCase(item) && (
            <p className="officer-fine">
              {mode === "persistent"
                ? "This case is finalised. Further workflow actions are disabled."
                : "This case is finalised in memory. Actions are disabled; refresh to restore the original dataset."}
            </p>
          )}
        </section>
        <div className="officer-case-main">
          <CaseSummaryPanel item={item} />
          {item.resolution && (
            <section className="officer-panel officer-resolution">
              <p className="eyebrow">✓ RESOLVED / OUTCOME</p>
              <h2>A decision on record.</h2>
              <p className="officer-preserve">{item.resolution.summary}</p>
              <dl className="officer-facts">
                <div>
                  <dt>Action taken</dt>
                  <dd className="officer-preserve">{item.resolution.action}</dd>
                </div>
                <div>
                  <dt>Resolved</dt>
                  <dd>{formatEventTime(item.resolution.at)} IST</dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>{item.resolution.reference || "Not provided"}</dd>
                </div>
              </dl>
            </section>
          )}
          <OriginalOfficerComplaint item={item} />
          <EvidencePanel item={item} />
          <StudentResponsesPanel item={item} />
          {item.institutionResponse && (
            <section className="officer-panel">
              <p className="eyebrow">INSTITUTION RESPONSE</p>
              <h2>What the institution said.</h2>
              <p>{institutionResponseDisplayText(item.institutionResponse.text)}</p>
              <p className="officer-fine">
                {formatEventTime(item.institutionResponse.at)} IST · No real
                response was received.
              </p>
            </section>
          )}
          <OfficerCaseTimeline item={item} />
        </div>
        <aside
          className="officer-case-support"
          aria-label="Case intelligence and ownership"
        >
          <OwnerSlaPanel item={item} />
          <SuggestedNextAction item={item} />
          <RelatedComplaints item={item} cases={cases} />
          <InstitutionHistoryPanel item={item} cases={cases} />
        </aside>
      </div>
      {panel && (
        <OfficerActionPanel
          kind={panel}
          item={item}
          mode={mode}
          onClose={() => setPanel(null)}
          onSave={async (action) => {
            saved.current = true;
            await act(id, action);
            setMessage(
              mode === "persistent"
                ? "Action saved to the complaint audit history."
                : "Action recorded in memory. The case and its history are updated; nothing was sent externally.",
            );
          }}
        />
      )}
    </article>
  );
}
