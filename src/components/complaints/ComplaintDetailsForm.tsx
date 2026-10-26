"use client";
import {
  categories,
  type ComplaintDraft,
  type DraftErrors,
} from "@/lib/complaint-flow";
export function ComplaintDetailsForm({
  draft,
  update,
  errors,
}: {
  draft: ComplaintDraft;
  update: (patch: Partial<ComplaintDraft>) => void;
  errors: DraftErrors;
}) {
  return (
    <>
      <div className="flow-field">
        <label htmlFor="title">
          Complaint title <span>Required</span>
        </label>
        <input
          id="title"
          value={draft.title}
          maxLength={120}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Summarise the issue in a few words"
          aria-invalid={!!errors.title}
          aria-describedby="title-hint title-error"
        />
        <p className="flow-hint" id="title-hint">
          5–120 characters
        </p>
        <p id="title-error" className="flow-error">
          {errors.title}
        </p>
      </div>
      <div className="flow-field">
        <label htmlFor="description">
          Tell us what happened <span>Required</span>
        </label>
        <p className="flow-hint" id="description-hint">
          Explain what happened, when it happened, what action you already took,
          and what resolution you are expecting.
        </p>
        <textarea
          id="description"
          rows={7}
          maxLength={3000}
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
          aria-invalid={!!errors.description}
          aria-describedby="description-hint description-count description-error"
        />
        <div className="description-count" id="description-count">
          <span>Minimum 50 characters</span>
          <span>
            {draft.description.length.toLocaleString("en-IN")} / 3,000
          </span>
        </div>
        <p id="description-error" className="flow-error">
          {errors.description}
        </p>
      </div>
      <div className="flow-two">
        <div className="flow-field">
          <label htmlFor="category">
            Category <span>Optional hint</span>
          </label>
          <select
            id="category"
            value={draft.category}
            onChange={(e) => update({ category: e.target.value })}
            aria-describedby="category-hint"
          >
            <option value="">Not sure / choose later</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="flow-field">
          <label htmlFor="incidentDate">
            Date of incident <span>Optional</span>
          </label>
          <input
            id="incidentDate"
            type="date"
            min="1900-01-01"
            value={draft.incidentDate}
            onInput={(e) => update({ incidentDate: e.currentTarget.value })}
            aria-invalid={!!errors.incidentDate}
            aria-describedby="incidentDate-error"
          />
          <p id="incidentDate-error" className="flow-error">
            {errors.incidentDate}
          </p>
        </div>
      </div>
      <p className="flow-callout" id="category-hint">
        Not sure about the category? That’s okay. The system will classify the
        grievance before prototype routing. Your selection is only a hint;
        deterministic fallback rules are used if configured analysis is
        unavailable.
      </p>
      <fieldset className="contact-choice" aria-describedby="contacted-error">
        <legend>Have you already contacted the institution?</legend>
        <div>
          {(["yes", "no"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="contacted"
                value={value}
                checked={draft.contacted === value}
                onChange={() => update({ contacted: value })}
              />
              {value === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
        <p className="flow-error" id="contacted-error">
          {errors.contacted}
        </p>
      </fieldset>
      {draft.contacted === "yes" && (
        <div className="contact-followup">
          <div className="flow-field">
            <label htmlFor="contactDate">
              Date contacted <span>Optional</span>
            </label>
            <input
              id="contactDate"
              type="date"
              min="1900-01-01"
              value={draft.contactDate}
              onInput={(e) => update({ contactDate: e.currentTarget.value })}
              aria-invalid={!!errors.contactDate}
              aria-describedby="contactDate-error"
            />
            <p className="flow-error" id="contactDate-error">
              {errors.contactDate}
            </p>
          </div>
          <div className="flow-field">
            <label htmlFor="response">
              Response received <span>Optional · up to 500 characters</span>
            </label>
            <textarea
              id="response"
              rows={3}
              maxLength={500}
              value={draft.response}
              onChange={(e) => update({ response: e.target.value })}
              aria-invalid={!!errors.response}
              aria-describedby="response-error"
            />
            <p className="flow-error" id="response-error">
              {errors.response}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
