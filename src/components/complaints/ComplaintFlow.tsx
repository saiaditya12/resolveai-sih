"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import {
  emptyDraft,
  restoreComplaintDraft,
  serializeComplaintDraft,
  todayInIndia,
  validateDetails,
  evidenceError,
  type ComplaintDraft,
  type DraftErrors,
  type LocalComplaint,
} from "@/lib/complaint-flow";
import { useStudentDemo } from "@/components/student/StudentDemoProvider";
import { requestComplaintIntelligence } from "@/lib/intelligence/client";
import { isComplaintCategory } from "@/lib/intelligence/categories";
import { ComplaintStepper, complaintSteps } from "./ComplaintStepper";
import { InstitutionSearch } from "./InstitutionSearch";
import { ComplaintDetailsForm } from "./ComplaintDetailsForm";
import { EvidenceUploader } from "./EvidenceUploader";
import { ComplaintReview } from "./ComplaintReview";
import { DuplicateNotice } from "./SimilarityNotice";
import { SubmissionSuccess } from "./SubmissionSuccess";
const headings = [
  "Start with the institution.",
  "Tell your side of the story.",
  "Add context, if you have it.",
  "Make sure it tells your story.",
];
const DRAFT_STORAGE_KEY = "resolveai:student-complaint-draft:v1";
export function ComplaintFlow() {
  const [reviewAt, setReviewAt] = useState("");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ComplaintDraft>(emptyDraft);
  const [draftMessage, setDraftMessage] = useState("");
  const [errors, setErrors] = useState<DraftErrors>({});
  const [declared, setDeclared] = useState(false);
  const [result, setResult] = useState<LocalComplaint | null>(null);
  const [analysisPending, setAnalysisPending] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [fileError, setFileError] = useState("");
  const { submit, attachIntelligence, mode } = useStudentDemo();
  const title = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const submitting = useRef(false);
  const activeComplaintId = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          setDraft(restoreComplaintDraft(saved));
          setDraftMessage("A saved draft was restored from this browser tab.");
        }
      } catch {
        setDraftMessage(
          "The saved draft could not be restored. You can start a new draft.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // Next Activity can preserve hidden routes; discard drafts and file references when this form leaves view.
  useLayoutEffect(
    () => () => {
      setDraft(emptyDraft);
      setStep(0);
      setResult(null);
      setAnalysisPending(false);
      setAnalysisError("");
      setSubmitError("");
      setDeclared(false);
      setErrors({});
      setFileError("");
      submitting.current = false;
      activeComplaintId.current = null;
      moved.current = false;
    },
    [],
  );
  useEffect(() => {
    if (moved.current) title.current?.focus();
  }, [step]);
  useEffect(() => {
    if (Object.keys(errors).length) errorBox.current?.focus();
  }, [errors]);
  function go(next: number) {
    moved.current = true;
    setErrors({});
    setFileError("");
    if (next === 3) setReviewAt(new Date().toISOString());
    setStep(next);
  }
  function update(patch: Partial<ComplaintDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    setDeclared(false);
    setDraftMessage("");
    const hasContent = Boolean(
      next.institution ||
        next.title ||
        next.description ||
        next.category ||
        next.incidentDate ||
        next.contacted ||
        next.contactDate ||
        next.response,
    );
    try {
      if (hasContent)
        sessionStorage.setItem(
          DRAFT_STORAGE_KEY,
          serializeComplaintDraft(next),
        );
      else sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      setDraftMessage(
        "This draft could not be saved in this browser tab. Keep the page open to avoid losing it.",
      );
    }
  }
  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0 && !draft.institution) {
      setErrors({ institution: "Choose an institution to continue." });
      return;
    }
    if (step === 1) {
      const next = validateDetails(draft, todayInIndia(new Date()));
      if (Object.keys(next).length) {
        setErrors(next);
        return;
      }
    }
    if (step === 3) {
      const next = validateDetails(draft, todayInIndia(new Date()));
      if (!draft.institution) next.institution = "Choose an institution.";
      if (!declared)
        next.declaration =
          "Confirm the declaration before submitting this complaint.";
      if (Object.keys(next).length) {
        setErrors(next);
        return;
      }
      const invalid = draft.evidence
        .map((item) => evidenceError(item.file))
        .find(Boolean);
      if (invalid) {
        setFileError(invalid);
        return;
      }
      if (submitting.current) return;
      submitting.current = true;
      let complaint: LocalComplaint;
      try {
        complaint = await submit(draft);
      } catch {
        submitting.current = false;
        activeComplaintId.current = null;
        setSubmitError("The complaint could not be recorded. Please try again.");
        return;
      }
      activeComplaintId.current = complaint.id;
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        setDraftMessage(
          "The complaint was submitted, but this tab could not clear its saved draft.",
        );
      }
      setResult(complaint);
      setDraft(emptyDraft);
      go(4);
      setAnalysisPending(true);
      setAnalysisError("");
      setSubmitError("");
      try {
        const updated =
          mode === "persistent"
            ? await attachIntelligence(complaint.id)
            : await attachIntelligence(
                complaint.id,
                await requestComplaintIntelligence({
                  title: complaint.title,
                  description: complaint.description,
                  institution: complaint.institution,
                  ...(isComplaintCategory(draft.category)
                    ? { studentSelectedCategory: draft.category }
                    : {}),
                }),
              );
        if (activeComplaintId.current === complaint.id) setResult(updated);
      } catch {
        if (activeComplaintId.current === complaint.id)
          setAnalysisError(
            "The complaint was recorded, but its analysis could not be attached. It remains available to track, but has not been routed.",
          );
      } finally {
        if (activeComplaintId.current === complaint.id)
          setAnalysisPending(false);
      }
      return;
    }
    go(step + 1);
  }
  return (
    <div className="complaint-flow">
      <Link className="text-link flow-backlink" href="/student/dashboard">
        ← Back to dashboard
      </Link>
      <div className="flow-heading">
        <div>
          <p className="eyebrow">YOUR VOICE / A NEW GRIEVANCE</p>
          <h1>Raise a complaint.</h1>
          <p>A few clear steps. One place to be heard.</p>
        </div>
        <span className="demo-badge">
          {mode === "persistent" ? "ACCOUNT SUBMISSION" : "COMPLAINT WORKSPACE"}
        </span>
      </div>
      <ComplaintStepper step={step} />
      <div className="flow-layout">
        <div className="flow-paper">
          <h2 ref={title} tabIndex={-1} className="flow-step-title">
            {step === 4 ? "Your receipt" : headings[step]}
          </h2>
          {step === 4 && result ? (
            <SubmissionSuccess
              complaint={result}
              analysisPending={analysisPending}
              analysisError={analysisError}
              mode={mode}
            />
          ) : (
            <form noValidate onSubmit={advance}>
              <div
                ref={errorBox}
                tabIndex={-1}
                className={
                  Object.keys(errors).length ? "flow-error-summary" : "sr-only"
                }
                role="alert"
              >
                {Object.keys(errors).length > 0 && (
                  <>
                    <strong>Please check the following:</strong>
                    <ul>
                      {Object.values(errors).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
                {draftMessage && (
                  <p className="flow-hint" role="status">
                    {draftMessage}
                  </p>
                )}
              {step === 0 && (
                <InstitutionSearch
                  selected={draft.institution}
                  onSelect={(institution) => update({ institution })}
                  error={errors.institution}
                />
              )}{" "}
              {step === 1 && (
                <ComplaintDetailsForm
                  draft={draft}
                  update={update}
                  errors={errors}
                />
              )}{" "}
              {step === 2 && (
                <EvidenceUploader
                  files={draft.evidence}
                  onChange={(evidence) => update({ evidence })}
                />
              )}{" "}
              {step === 3 && (
                <>
                  <ComplaintReview draft={draft} onEdit={go} />
                  <DuplicateNotice draft={draft} at={reviewAt} />
                  <label className="declaration">
                    <input
                      type="checkbox"
                      checked={declared}
                      onChange={(event) => setDeclared(event.target.checked)}
                      aria-invalid={!!errors.declaration}
                      aria-describedby="declaration-error"
                    />
                    <span>
                      I confirm that the information provided is accurate to the
                      best of my knowledge.
                    </span>
                  </label>
                  <p id="declaration-error" className="flow-error">
                    {errors.declaration}
                  </p>
                  <p className="flow-hint">
                    This creates a record, not an official complaint.
                    No information is sent to AICTE.
                  </p>
                  {fileError && (
                    <p role="alert" className="flow-error">
                      {fileError}
                    </p>
                  )}
                  {submitError && (
                    <p role="alert" className="flow-error">
                      {submitError}
                    </p>
                  )}
                </>
              )}
              <div className="flow-actions">
                {step > 0 ? (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => go(step - 1)}
                  >
                    ← Back
                  </button>
                ) : (
                  <span className="flow-hint">
                    Choose the institution related to your complaint
                  </span>
                )}
                <button className="button primary" type="submit">
                  {step === 3
                    ? "Submit complaint"
                    : step === 2
                      ? "Review complaint"
                      : `Continue to ${complaintSteps[step + 1].toLowerCase()}`}{" "}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </form>
          )}
        </div>
        <aside className="flow-aside">
          <p className="eyebrow">A CLEARER START</p>
          <h3>
            Your words.
            <br />
            <em>Your context.</em>
          </h3>
          <p>You don’t need to know which department handles your concern.</p>
          <ol>
            <li>Choose the institution.</li>
            <li>Explain the issue in your own words.</li>
            <li>Include supporting evidence if available.</li>
          </ol>
          <div className="flow-memory-note">
            <strong>Your draft</strong>
            <p>
              Draft text is saved
              in this browser tab and clears when the tab closes or you submit.
              Selected evidence files must be reselected after a reload.
              {mode === "persistent" ? "Submitted complaints are saved to your account." : "Submitted records are available in this browser session and clear on refresh."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
