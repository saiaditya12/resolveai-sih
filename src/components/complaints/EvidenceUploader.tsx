"use client";
import { useState } from "react";
import {
  evidenceError,
  fileSize,
  MAX_FILES,
  type EvidenceFile,
} from "@/lib/complaint-flow";
export function EvidenceUploader({
  files,
  onChange,
}: {
  files: EvidenceFile[];
  onChange: (files: EvidenceFile[]) => void;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  function add(incoming: File[]) {
    const next = [...files];
    const messages: string[] = [];
    for (const file of incoming) {
      const error = evidenceError(file);
      if (error) {
        messages.push(error);
        continue;
      }
      if (
        next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.file.lastModified === file.lastModified,
        )
      ) {
        messages.push(`${file.name}: already selected.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        messages.push(
          `${file.name}: select up to ${MAX_FILES} files in this demo.`,
        );
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || file.name.split(".").pop() || "File",
        size: file.size,
        file,
      });
    }
    setErrors(messages);
    onChange(next);
  }
  return (
    <>
      <p className="flow-intro">
        Upload screenshots, receipts, letters, notices, or other supporting
        evidence if available. Evidence is optional.
      </p>
      <div
        className={`evidence-drop ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add(Array.from(event.dataTransfer.files));
        }}
      >
        <span aria-hidden="true">↥</span>
        <h3>Keep the supporting details together.</h3>
        <p>Drop files here, or use the file picker.</p>
        <label htmlFor="evidence-files">Choose evidence files</label>
        <input
          id="evidence-files"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          multiple
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          aria-describedby="evidence-limits evidence-local"
        />
        <p id="evidence-limits">
          PDF, PNG or JPG/JPEG · Up to 5 MB each · Maximum 5 files
        </p>
      </div>
      <p id="evidence-local" className="flow-callout">
        Selected locally, not uploaded. Files stay in browser memory and are
        released after demo submission or when you leave this form. Use sample
        documents only.
      </p>
      <div role="alert">
        {errors.map((error, index) => (
          <p className="flow-error" key={`${error}-${index}`}>
            {error}
          </p>
        ))}
      </div>
      <p className="flow-hint" role="status">
        {files.length} of {MAX_FILES} files selected locally
      </p>
      <ul className="evidence-list">
        {files.map((file) => (
          <li key={file.id}>
            <span className="file-glyph" aria-hidden="true">
              ↳
            </span>
            <div>
              <strong>{file.name}</strong>
              <span>
                {file.type} · {fileSize(file.size)} · Local selection
              </span>
            </div>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={() => {
                onChange(files.filter((item) => item.id !== file.id));
                setErrors([]);
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
