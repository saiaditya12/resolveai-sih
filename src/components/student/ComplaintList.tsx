"use client";
import Link from "next/link";
import { useState } from "react";
import { type Complaint, formatDemoDate } from "@/lib/demo-student";
import { StatusBadge } from "./StatusBadge";
import { EmptyComplaintsState } from "./EmptyComplaintsState";
export function ComplaintList({ items }: { items: Complaint[] }) {
  const [filter, setFilter] = useState("all");
  const filtered = items.filter(
    (c) =>
      filter === "all" ||
      (filter === "active" &&
        ["Submitted", "Assigned", "Under Review", "Escalated"].includes(
          c.status,
        )) ||
      (filter === "attention" && c.status === "Needs Information") ||
      (filter === "resolved" && c.status === "Resolved"),
  );
  return (
    <section
      id="complaints"
      className="complaints-section"
      aria-labelledby="complaints-title"
    >
      <div className="student-section-head">
        <div>
          <h2 id="complaints-title">My complaints</h2>
          <p>Every case, with its next step in view.</p>
        </div>
        <label className="complaint-filter">
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All complaints</option>
            <option value="active">In progress</option>
            <option value="attention">Needs action</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      </div>
      {items.length === 0 ? (
        <EmptyComplaintsState />
      ) : (
        <>
          <p className="result-count" aria-live="polite">
            {filtered.length} demo{" "}
            {filtered.length === 1 ? "complaint" : "complaints"}
          </p>
          <div className="complaint-table-head" aria-hidden="true">
            <span>COMPLAINT / INSTITUTION</span>
            <span>STATUS</span>
            <span>LAST UPDATED</span>
            <span />
          </div>
          <ul className="complaint-list">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/student/complaints/${c.id}`}
                  className="complaint-row"
                >
                  <div className="complaint-main">
                    <span className="complaint-id">
                      {c.id} <span> / {c.category}</span>
                    </span>
                    <h3>{c.title}</h3>
                    <p>{c.institution}</p>
                  </div>
                  <StatusBadge status={c.status} />
                  <time dateTime={c.updatedAt}>
                    <span className="mobile-date-label">Updated </span>
                    {formatDemoDate(c.updatedAt)}
                  </time>
                  <span className="row-arrow" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <div className="empty-filter">
              <p>No complaints match this view.</p>
              <button
                className="button secondary"
                onClick={() => setFilter("all")}
              >
                Show all complaints
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
