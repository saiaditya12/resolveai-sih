import Link from "next/link";
export default function NotFound() {
  return (
    <div className="student-placeholder">
      <p className="eyebrow">DEMO CASE NOT FOUND</p>
      <h1>This case isn’t in the demo.</h1>
      <p>Choose one of the fictional cases on your dashboard.</p>
      <Link className="button primary" href="/student/dashboard">
        Back to dashboard ↗
      </Link>
    </div>
  );
}
