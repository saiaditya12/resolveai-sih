"use client";
import { useEffect, useRef, useState } from "react";
import { EvidenceUploader } from "@/components/complaints/EvidenceUploader";
import { evidenceError, type EvidenceFile } from "@/lib/complaint-flow";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import {
  responseError,
  type CaseResponse,
  type RequestedAction,
} from "@/lib/complaint-tracking";
export function StudentActionPanel({
  request,
  onClose,
  onSave,
  mode,
}: {
  request: RequestedAction;
  onClose: () => void;
  onSave: (response: CaseResponse) => void | Promise<void>;
  mode: "persistent" | "demo";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const textField = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [error, setError] = useState("");
  const [savingState, setSavingState] = useState(false);
  const persistent = mode === "persistent" && hasSupabaseConfiguration();
  const saving = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    element?.showModal();
    textField.current?.focus();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const invalid =
      responseError(text, files.length) ||
      files.map((f) => evidenceError(f.file)).find(Boolean);
    if (invalid) {
      setError(invalid);
      textField.current?.focus();
      return;
    }
    if (saving.current) return;
    saving.current = true;
    setSavingState(true);
    try {
      await onSave({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        text: text.trim(),
        evidence: files.map(({ id, name, type, size }) => ({
          id,
          name,
          type,
          size,
        })),
      });
      setFiles([]);
      onClose();
    } catch {
      setError("We couldn't save your response. Please try again.");
      saving.current = false;
    } finally {
      setSavingState(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="student-action-dialog"
      aria-labelledby="action-title"
      aria-describedby="action-explanation"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="action-dialog-head">
        <p className="eyebrow">{persistent ? "STUDENT RESPONSE" : "RESPONSE"}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close response panel"
        >
          Close ×
        </button>
      </div>
      <h2 id="action-title">Add the missing context.</h2>
      <p id="action-explanation">{request.prompt}</p>
      <form onSubmit={save} noValidate>
        <div className="flow-field">
          <label htmlFor="student-response">
            Your response <span>Up to 1,500 characters</span>
          </label>
          <textarea
            id="student-response"
            ref={textField}
            rows={4}
            maxLength={1500}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            aria-invalid={!!error}
            aria-describedby="response-rule response-validation"
          />
          <p id="response-rule" className="flow-hint">
            Add at least 10 characters or select a supporting file. Describe the requested information clearly.
          </p>
          <p id="response-validation" role="alert" className="flow-error">
            {error}
          </p>
        </div>
        <EvidenceUploader files={files} onChange={setFiles} />
        <p className="flow-callout">
          {persistent
            ? "Your response is saved to this complaint. File contents are not uploaded; only supported evidence metadata is retained."
            : "This saves a response in memory. No files are uploaded and no officer is notified. File contents are released when you close this panel; only metadata is retained after saving."}
        </p>
        <div className="flow-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={savingState}>
            {savingState ? "Saving…" : persistent ? "Save response ↗" : "Save response ↗"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
