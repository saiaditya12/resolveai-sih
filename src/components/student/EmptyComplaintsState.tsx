import Link from "next/link";
export function EmptyComplaintsState() {
  return (
    <div className="empty-complaints">
      <span className="empty-symbol" aria-hidden="true">
        ↗
      </span>
      <h3>No complaints yet.</h3>
      <p>
        When you raise a grievance, you’ll be able to track its progress here.
      </p>
      <Link className="button primary" href="/student/complaints/new">
        Raise your first complaint ↗
      </Link>
    </div>
  );
}
