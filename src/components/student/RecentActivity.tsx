import { auditDisplayText } from "@/lib/presentation";
import Link from "next/link";
import { activity } from "@/lib/demo-student";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
import { formatEventTime } from "@/lib/complaint-tracking";
export function RecentActivity() {
  const { mode, records, profile } = useComplaintStore();
  const updates = mode === "persistent"
    ? records.filter(record => record.studentId === profile?.id)
      .flatMap(record => record.events.map(event => ({
        id: record.id, key: `${record.id}-${event.id}`, text: event.title,
        at: formatEventTime(event.at), timestamp: event.at,
      })))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 3)
    : activity.map(item => ({ ...item, key: item.id }));
  return (
    <section className="recent-activity" aria-labelledby="activity-title">
      <div className="student-section-head">
        <h2 id="activity-title">Recent activity</h2>
        <span className="eyebrow">UPDATES</span>
      </div>
      <ol>
        {updates.map((item) => (
          <li key={item.key}>
            <span className="activity-dot" aria-hidden="true" />
            <div>
              <span className="activity-time">{item.at}</span>
              <p>{auditDisplayText(item.text)}</p>
              <Link href={`/student/complaints/${item.id}`}>{item.id} ↗</Link>
            </div>
          </li>
        ))}
      </ol>
      {!updates.length && <p>No recent activity.</p>}
    </section>
  );
}
