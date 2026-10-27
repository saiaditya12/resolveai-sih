"use client";
import { institutionDisplayName } from "@/lib/presentation";
import { useState } from "react";
import { institutions, type Institution } from "@/lib/complaint-flow";
export function InstitutionSearch({
  selected,
  onSelect,
  error,
}: {
  selected: Institution | null;
  onSelect: (institution: Institution) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const results = institutions.filter((i) =>
    `${institutionDisplayName(i.name)} ${i.city} ${i.state}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <>
      <div className="flow-field">
        <label htmlFor="institution-search">Find your institution</label>
        <input
          id="institution-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search institution, city or state"
          aria-describedby="institution-hint"
        />
        <p id="institution-hint" className="flow-hint">
          Search the institution directory.
        </p>
      </div>
      {selected && (
        <p className="selected-institution">
          ✓ Selected: <strong>{institutionDisplayName(selected.name)}</strong>
        </p>
      )}
      <fieldset
        className="institution-options"
        aria-describedby={error ? "institution-error" : undefined}
      >
        <legend>Choose one institution</legend>
        <p className="flow-hint" role="status">
          {results.length} matching{" "}
          {results.length === 1 ? "institution" : "institutions"}
        </p>
        {error && (
          <p className="flow-error" id="institution-error">
            {error}
          </p>
        )}
        <div className="institution-grid">
          {results.map((i) => (
            <label
              key={i.id}
              className={`institution-option ${selected?.id === i.id ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="institution"
                value={i.id}
                checked={selected?.id === i.id}
                onChange={() => onSelect(i)}
              />
              <span>
                <strong>{institutionDisplayName(i.name)}</strong>
                <span>
                  {i.city}, {i.state}
                </span>
                <small>{i.type}</small>
              </span>
            </label>
          ))}
        </div>
        {!results.length && (
          <div className="flow-empty">
            <h3>No institution found.</h3>
            <p>
              Try a shorter name, a city or a state. Choose an institution from the available directory.
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() => setQuery("")}
            >
              Show all institutions
            </button>
          </div>
        )}
      </fieldset>
    </>
  );
}
