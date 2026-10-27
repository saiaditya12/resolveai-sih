"use client";
import { cellDisplayName, systemDisplayText } from "@/lib/presentation";
import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  officerCells,
  validateOfficerAction,
  type ActionKind,
  type OfficerAction,
  type ComplaintQueueItem,
} from "@/lib/officer-model";
import { todayInIndia } from "@/lib/complaint-flow";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
const titles: Record<ActionKind, string> = {
  request: "Request information",
  status: "Update status",
  transfer: "Transfer case",
  escalate: "Escalate case",
  resolve: "Record a resolution",
};
export function OfficerActionPanel({
  kind,
  item,
  onClose,
  onSave,
  mode,
}: {
  kind: ActionKind;
  item: ComplaintQueueItem;
  onClose: () => void;
  onSave: (action: OfficerAction) => void | Promise<void>;
  mode: "persistent" | "demo";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const errorBox = useRef<HTMLParagraphElement>(null);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [savingState, setSavingState] = useState(false);
  const persistent = mode === "persistent" && hasSupabaseConfiguration();
  const [recipient, setRecipient] = useState<"Student" | "Institution">(
    "Student",
  );
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [cell, setCell] = useState("");
  const [status, setStatus] = useState("Officer Review");
  const [taken, setTaken] = useState("");
  const [reference, setReference] = useState("");
  const resolving =
    kind === "resolve" || (kind === "status" && status === "Resolved");
  const escalating =
    kind === "escalate" || (kind === "status" && status === "Escalated");
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    let action: OfficerAction;
    if (resolving)
      action = { type: "resolve", summary: text, action: taken, reference };
    else if (escalating) action = { type: "escalate", reason: text };
    else if (kind === "request")
      action = { type: "request", recipient, text, dueDate: date };
    else if (kind === "transfer")
      action = { type: "transfer", cellId: cell, reason: text };
    else
      action = {
        type: "status",
        status: status as
          | "Officer Review"
          | "Student Action Required"
          | "Institution Response Requested",
        note: text,
      };
    const problem = validateOfficerAction(
      item,
      action,
      todayInIndia(new Date()),
    );
    if (problem) {
      setError(problem);
      return;
    }
    if (saving.current) return;
    saving.current = true;
    setSavingState(true);
    try {
      await onSave(action);
      onClose();
    } catch {
      setError("We couldn't save this action. Reload the case and try again.");
      saving.current = false;
    } finally {
      setSavingState(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="officer-dialog"
      aria-labelledby="officer-action-title"
      aria-describedby="officer-action-note"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="officer-dialog-head">
        <p className="eyebrow">ACTION / {item.id}</p>
        <button type="button" onClick={onClose} aria-label="Close action panel">
          Close ×
        </button>
      </div>
      <h2 id="officer-action-title">{titles[kind]}</h2>
      <p id="officer-action-note">
        {persistent
          ? "This action is stored with an audit event. No external message is sent and no real authority is contacted."
          : "Changes are held in this browser session. No external message is sent."}
      </p>
      <form onSubmit={submit} noValidate>
        <p className="officer-error" role="alert" tabIndex={-1} ref={errorBox}>
          {systemDisplayText(error)}
        </p>
        {kind === "request" && (
          <label>
            Recipient
            <select
              value={recipient}
              onChange={(e) =>
                setRecipient(e.target.value as "Student" | "Institution")
              }
            >
              <option>Student</option>
              <option>Institution</option>
            </select>
          </label>
        )}
        {kind === "status" && (
          <label>
            New status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setError("");
              }}
            >
              <option value="Officer Review">Officer Review</option>
              <option value="Student Action Required">Awaiting Student</option>
              <option value="Institution Response Requested">
                Awaiting Institution
              </option>
              <option>Escalated</option>
              <option>Resolved</option>
            </select>
          </label>
        )}
        {kind === "transfer" && (
          <>
            <p className="officer-notice">
              Choose the cell responsible for the next review.
            </p>
            <label>
              Destination cell
              <select value={cell} onChange={(e) => setCell(e.target.value)}>
                <option value="">Choose a different cell</option>
                {officerCells.map((c) => (
                  <option
                    value={c.id}
                    key={c.id}
                    disabled={c.id === item.cellId}
                  >
                    {cellDisplayName(c.name)}
                    {c.id === item.cellId ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          {resolving
            ? "Resolution summary"
            : escalating
              ? "Escalation reason"
              : kind === "request"
                ? "Request text"
                : kind === "transfer"
                  ? "Transfer reason"
                  : "Status note"}
          <textarea
            autoFocus
            rows={5}
            maxLength={2000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            aria-describedby="officer-text-hint"
          />
        </label>
        <p id="officer-text-hint" className="officer-fine">
          10–2,000 characters. Explain the action clearly.
        </p>
        {kind === "request" && (
          <label>
            Due date (optional)
            <input
              type="date"
              value={date}
              onInput={(e) => setDate(e.currentTarget.value)}
            />
          </label>
        )}
        {resolving && (
          <>
            <label>
              Action taken
              <textarea
                rows={3}
                maxLength={2000}
                value={taken}
                onChange={(e) => setTaken(e.target.value)}
              />
            </label>
            <label>
              Reference number (optional)
              <input
                value={reference}
                maxLength={120}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <p className="officer-fine">
              Resolving finalises this complaint. Further actions will be
              unavailable until the workspace resets.
            </p>
          </>
        )}
        <div className="officer-dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={savingState}>
            {savingState
              ? "Saving…"
              : resolving
                ? persistent ? "Record resolution" : "Resolve case"
                : kind === "request"
                  ? persistent ? "Save information request" : "Record request"
                  : escalating
                    ? persistent ? "Escalate case" : "Escalate case"
                    : kind === "transfer"
                      ? persistent ? "Transfer case" : "Transfer case"
                      : persistent ? "Save status" : "Save status"}{" "}
            ↗
          </button>
        </div>
      </form>
    </dialog>
  );
}
