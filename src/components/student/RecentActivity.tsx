import Link from "next/link";
import { activity } from "@/lib/demo-student";
export function RecentActivity() {
  return (
    <section className="recent-activity" aria-labelledby="activity-title">
      <div className="student-section-head">
        <h2 id="activity-title">Recent activity</h2>
        <span className="eyebrow">DEMO UPDATES</span>
      </div>
      <ol>
        {activity.map((item) => (
          <li key={item.id}>
            <span className="activity-dot" aria-hidden="true" />
            <div>
              <span className="activity-time">{item.at}</span>
              <p>{item.text}</p>
              <Link href={`/student/complaints/${item.id}`}>{item.id} ↗</Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
